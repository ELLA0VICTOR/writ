import type { WritAdapter } from "./adapter";
import type {
  CheckResult,
  JsonValue,
  ReadContext,
  Writ,
  WritPage,
} from "./types";
import { bindings } from "./contractBindings";
import { deploymentConfig } from "./deployment";
import { ChainError, PurchaseSubmissionError } from "./errors";
import { mapCheck } from "./checks";
import { templates, getTemplate } from "../templates/registry";
import { scheduleRpcRead } from "../../sdk/index";

import {
  record as object,
  parseWrit,
  parseHistory,
  parsePurchase,
  jsonValue,
} from "./validation";
type ObjectValue = Record<string, unknown>;
export function createTestnetAdapter(): WritAdapter {
  const deployment = deploymentConfig();
  const configuredHashes: Record<string, string> = deployment.templateHashes;
  const contractId = deployment.collection;
  const enabled = Boolean(
    contractId &&
    deployment.abiVersion === bindings.abiVersion &&
    deployment.executorCodeHash &&
    configuredHashes["contract-owner"],
  );
  let providerPromise:
    Promise<import("near-api-js").JsonRpcProvider> | undefined;
  const provider = () =>
    (providerPromise ??= import("near-api-js").then(
      ({ JsonRpcProvider }) =>
        new JsonRpcProvider({
          url: deployment.rpcUrl,
        }),
    ));
  const readRpc = (
    method: "query" | "status" | "EXPERIMENTAL_protocol_config" | "gas_price",
    params: unknown,
  ) =>
    scheduleRpcRead(deployment.rpcUrl, async () =>
      (await provider()).sendJsonRpc(method, params),
    );
  function configured() {
    if (!enabled)
      throw new ChainError(
        "not_configured",
        "The Writ testnet deployment is not connected yet. Explore the labelled examples while the contracts are being built.",
      );
  }
  async function query(
    params: object,
    signal?: AbortSignal,
  ): Promise<ObjectValue> {
    signal?.throwIfAborted();
    try {
      const result = object(await readRpc("query", params));
      signal?.throwIfAborted();
      return result;
    } catch (error) {
      if (error instanceof ChainError) throw error;
      if (signal?.aborted) throw error;
      throw new ChainError(
        "rpc_unavailable",
        "Can't reach NEAR testnet right now. Your Writ is unaffected. Retry.",
      );
    }
  }
  async function view(
    account: string,
    method: string,
    args: object = {},
    blockId?: string,
    signal?: AbortSignal,
  ): Promise<unknown> {
    const encoded = btoa(
      String.fromCharCode(...new TextEncoder().encode(JSON.stringify(args))),
    );
    const response = await query(
      {
        request_type: "call_function",
        account_id: account,
        method_name: method,
        args_base64: encoded,
        ...(blockId ? { block_id: blockId } : { finality: "final" }),
      },
      signal,
    );
    const bytes = response.result;
    if (!Array.isArray(bytes) || bytes.length > 65536)
      throw new ChainError(
        "rpc_unavailable",
        "The check response is malformed or too large.",
      );
    try {
      return JSON.parse(
        new TextDecoder("utf-8", { fatal: true }).decode(
          Uint8Array.from(bytes as number[]),
        ),
      ) as unknown;
    } catch {
      throw new ChainError(
        "rpc_unavailable",
        "The check returned invalid JSON.",
      );
    }
  }
  let configPromise: Promise<void> | undefined;
  let purchaseStorage = "0";
  function ensureConfig(): Promise<void> {
    configured();
    return (configPromise ??= provider()
      .then(async () => {
        const status = object(await readRpc("status", []));
        if (status.chain_id !== "testnet")
          throw new ChainError(
            "not_configured",
            "This build is testnet-only. The RPC belongs to a different network; transactions are disabled.",
          );
        return view(contractId, bindings.config);
      })
      .then((value) => {
        const config = object(value);
        const hashes = object(config.template_hashes);
        purchaseStorage = String(config.purchase_storage_deposit);
        if (
          config.abi_version !== bindings.abiVersion ||
          config.executor_code_hash !== deployment.executorCodeHash ||
          hashes["contract-owner"] !== configuredHashes["contract-owner"] ||
          Object.entries(configuredHashes).some(
            ([id, hash]) => hash && hashes[id] !== hash,
          )
        )
          throw new ChainError(
            "not_configured",
            "The deployed ABI, executor hash or owner template differs from this frontend configuration. Transactions are disabled.",
          );
      })
      .catch((error) => {
        configPromise = undefined;
        throw error;
      }));
  }
  function checkedWrit(value: unknown, id?: string): Writ | null {
    const writ = parseWrit(value);
    if (
      writ &&
      (writ.collection !== contractId ||
        !configuredHashes[writ.templateId] ||
        writ.templateHash !== configuredHashes[writ.templateId] ||
        (id !== undefined && writ.id !== String(Number(id))))
    )
      throw new ChainError(
        "rpc_unavailable",
        "The Writ identity or template hash differs from the configured deployment.",
      );
    return writ;
  }
  async function enrich(
    writ: Writ | null,
    signal?: AbortSignal,
  ): Promise<Writ | null> {
    if (!writ || writ.provisioned === false) return writ;
    const state = await query(
      {
        request_type: "view_account",
        account_id: writ.executor,
        finality: "final",
      },
      signal,
    );
    const hash = String(state.block_hash);
    const [available, keys] = await Promise.all([
      view(writ.executor, "get_balance", {}, hash, signal),
      query(
        {
          request_type: "view_access_key_list",
          account_id: writ.executor,
          block_id: hash,
        },
        signal,
      ),
    ]);
    writ.balance = String(state.amount);
    writ.withdrawableFees = String(available);
    writ.executorCodeHash = String(state.code_hash);
    writ.accessKeys = Array.isArray(keys.keys)
      ? keys.keys.map((k) => String(object(k).public_key))
      : [];
    // Role views are checked separately. Never substitute a fabricated owner when unavailable.
    if (getTemplate(writ.templateId).handoverKind === "owner") {
      try {
        const [owner, proposed] = await Promise.all([
          view(writ.target, "own_get_owner", {}, hash, signal),
          view(writ.target, "own_get_proposed_owner", {}, hash, signal),
        ]);
        if (
          !(owner === null || typeof owner === "string") ||
          !(proposed === null || typeof proposed === "string")
        )
          throw new ChainError(
            "rpc_unavailable",
            "The target returned an invalid owner observation.",
          );
        writ.roleOwner = owner;
        writ.proposedOwner = proposed;
      } catch (error) {
        if (signal?.aborted) throw error;
        // A broken/deleted target must not hide the holder's independent native-fund controls.
        writ.roleOwner = null;
        writ.proposedOwner = null;
        writ.roleObservationUnavailable = true;
      }
    }
    return parseWrit(writ);
  }
  async function call(
    method: string,
    args: object,
    deposit = "0",
    receiver = contractId,
  ) {
    await ensureConfig();
    if (deployment.collectionCodeHash) {
      const code = await query({
        request_type: "view_account",
        account_id: contractId,
        finality: "final",
      });
      if (code.code_hash !== deployment.collectionCodeHash)
        throw new ChainError(
          "not_configured",
          "Collection code differs from the published release. Review the deployment before signing.",
        );
    }
    return (await import("./wallet")).walletCall(
      receiver,
      method,
      args,
      deposit,
    );
  }
  return {
    mode: "testnet",
    contractId: contractId || "writ-demo.testnet",
    capabilities: {
      execute: enabled,
      lend: enabled,
      list: enabled,
      withdraw: enabled,
      unwrap: enabled,
      wrap: enabled,
    },
    async getSession() {
      return (await import("./wallet")).walletSession();
    },
    async getWalletOptions() {
      const connector = await (await import("./wallet")).getConnector();
      await connector.whenManifestLoaded;
      return connector.availableWallets
        .filter(
          (wallet) =>
            wallet.manifest.features.testnet &&
            wallet.manifest.features.signAndSendTransaction,
        )
        .map((wallet) => ({
          id: wallet.manifest.id,
          name: wallet.manifest.name,
          website: wallet.manifest.website,
        }));
    },
    async connect(walletId) {
      if (!walletId)
        throw new ChainError(
          "invalid_input",
          "Choose a wallet from the Writ connection dialog.",
        );
      const connector = await (await import("./wallet")).getConnector();
      const wallet = await connector.connect({ walletId });
      const accounts = await wallet.getAccounts();
      if (!accounts[0])
        throw new ChainError(
          "wallet_rejected",
          "No wallet account was selected.",
        );
      return { accountId: accounts[0].accountId };
    },
    async disconnect() {
      const connector = await (await import("./wallet")).getConnector();
      await connector.disconnect();
    },
    async getSpendableBalance(accountId) {
      const state = await query({
        request_type: "view_account",
        account_id: accountId,
        finality: "final",
      });
      const protocol = object(
        await readRpc("EXPERIMENTAL_protocol_config", { finality: "final" }),
      );
      const cost = BigInt(
        String(object(protocol.runtime_config).storage_amount_per_byte),
      );
      const available =
        BigInt(String(state.amount)) -
        BigInt(String(state.storage_usage)) * cost;
      return (available > 0n ? available : 0n).toString();
    },
    async getPurchaseFeeAllowance() {
      const price = object(await readRpc("gas_price", [null]));
      const gasPrice = BigInt(String(price.gas_price));
      return ((gasPrice * 250000000000000n * 13n) / 10n).toString();
    },
    async getPurchaseStorageDeposit() {
      await ensureConfig();
      return purchaseStorage;
    },
    async getMintQuote(request) {
      await ensureConfig();
      const q = object(
        await view(contractId, "get_mint_quote", {
          template_id: request.templateId,
          target: request.target,
        }),
      );
      for (const k of ["deposit", "executorFunding", "storageDeposit"])
        if (typeof q[k] !== "string" || !/^\d+$/.test(String(q[k])))
          throw new ChainError("rpc_unavailable", "Invalid funding quote.");
      return {
        deposit: String(q.deposit),
        executorFunding: String(q.executorFunding),
        storageDeposit: String(q.storageDeposit),
        nonRefundableStorage: q.nonRefundableStorage === true,
      };
    },
    async transfer(id, receiver) {
      if (receiver === contractId || receiver.endsWith(`.${contractId}`))
        throw new ChainError(
          "invalid_input",
          "Writ infrastructure cannot receive its own role NFTs.",
        );
      return call("nft_transfer", { token_id: id, receiver_id: receiver }, "1");
    },
    async getPracticeQuote(templateId = "contract-owner") {
      await ensureConfig();
      return object(
        await view(contractId, "get_practice_quote", {
          template_id: templateId,
        }),
      ) as unknown as import("./types").MintQuote;
    },
    async createPracticeTarget(
      templateId = "contract-owner",
      newRequest = false,
    ) {
      const session = await this.getSession();
      if (!session)
        throw new ChainError("unauthorized", "Connect your wallet first.");
      const saved = `writ-practice:${contractId}:${session.accountId}:${templateId}`;
      let id = sessionStorage.getItem(saved);
      if (newRequest && id) {
        const previous = await view(contractId, "get_practice_target", {
          owner_id: session.accountId,
          client_request_id: id,
        });
        if (
          previous === null ||
          !["ready", "failed"].includes(String(object(previous).status))
        )
          throw new ChainError(
            "outcome_unknown",
            "Resolve the previous provisioning attempt before paying for another target.",
          );
        id = null;
      }
      if (!id) {
        id = crypto.randomUUID();
        sessionStorage.setItem(saved, id);
      }
      let result = await view(contractId, "get_practice_target", {
        owner_id: session.accountId,
        client_request_id: id,
      });
      if (result === null) {
        const quote = await this.getPracticeQuote(templateId);
        await call(
          "create_practice_target",
          { client_request_id: id, template_id: templateId },
          quote.deposit,
        );
        result = await view(contractId, "get_practice_target", {
          owner_id: session.accountId,
          client_request_id: id,
        });
      }
      const r = object(result);
      if (r.status !== "ready")
        throw new ChainError(
          "outcome_unknown",
          "Practice provisioning has not completed. Retry to check this same request; recover any credited funding in My Writs.",
        );
      return String(r.target);
    },
    async fundExecutor(id, amount) {
      return call("fund_executor", { token_id: id }, amount);
    },
    async fundTarget(id, amount) {
      const writ = await this.getWrit(id);
      if (
        !writ ||
        !getTemplate(writ.templateId).integration?.practiceSupported ||
        writ.templateId === "contract-owner"
      )
        throw new ChainError(
          "invalid_input",
          "This integration does not expose a target funding command.",
        );
      if (!/^[0-9]+$/.test(amount) || BigInt(amount) <= 0n)
        throw new ChainError(
          "invalid_input",
          "Choose a positive funding amount.",
        );
      return call("fund_treasury", {}, amount, writ.target);
    },
    async confirmWrap(id) {
      return call("confirm_wrap", { token_id: id });
    },
    async getAccountRecovery(accountId) {
      await ensureConfig();
      const [credit, retired] = await Promise.all([
        view(contractId, "get_credit", { account_id: accountId }),
        view(contractId, "get_retired_writs", { owner_id: accountId }),
      ]);
      if (
        typeof credit !== "string" ||
        !/^\d+$/.test(credit) ||
        !Array.isArray(retired)
      )
        throw new ChainError("rpc_unavailable", "Invalid recovery response.");
      return {
        credit,
        retired: await Promise.all(
          retired.map(async (item) => {
            const r = object(item);
            const available = await view(String(r.executor), "get_balance");
            return {
              id: String(r.id),
              executor: String(r.executor),
              target: String(r.target),
              available: String(available),
            };
          }),
        ),
      };
    },
    async withdrawCredit(amount) {
      return call("withdraw_credit", { amount });
    },
    async withdrawRetired(id, amount) {
      return call("withdraw_retired_funds", { token_id: id, amount });
    },
    async getTemplates() {
      if (enabled) await ensureConfig();
      return templates.filter(
        (t) => t.id === "contract-owner" || Boolean(configuredHashes[t.id]),
      );
    },
    async getWrit(id, signal) {
      await ensureConfig();
      return enrich(
        checkedWrit(
          await view(
            contractId,
            bindings.writ,
            { token_id: String(Number(id)) },
            undefined,
            signal,
          ),
          id,
        ),
        signal,
      );
    },
    async listWrits(options, signal) {
      await ensureConfig();
      const page = object(
        await view(
          contractId,
          bindings.list,
          {
            owner_id: options.owner ?? null,
            listed_only: options.listedOnly ?? false,
            cursor: options.cursor ?? null,
            limit: 24,
          },
          undefined,
          signal,
        ),
      );
      if (!Array.isArray(page.items) || page.items.length > 24)
        throw new ChainError("rpc_unavailable", "Invalid Writ list response.");
      return {
        ...page,
        items: await Promise.all(
          page.items
            .map((value) => checkedWrit(value))
            .filter((w): w is Writ => w !== null)
            .map((w) => enrich(w, signal)),
        ),
      } as unknown as WritPage;
    },
    async readChecks(id, signal) {
      await ensureConfig();
      const state = await query(
        {
          request_type: "view_account",
          account_id: contractId,
          finality: "final",
        },
        signal,
      );
      const read: ReadContext = {
        blockHeight: String(state.block_height),
        blockHash: String(state.block_hash),
        observedAtMs: Date.now(),
        source: "testnet",
      };
      const writ = checkedWrit(
        await view(
          contractId,
          bindings.writ,
          { token_id: String(Number(id)) },
          read.blockHash ?? undefined,
          signal,
        ),
        id,
      );
      if (!writ) throw new ChainError("not_found", "This Writ does not exist.");
      const template = getTemplate(writ.templateId);
      const rows: CheckResult[] = await Promise.all(
        template.checks.map(async (def) => {
          try {
            const target =
              def.target === "role"
                ? writ.target
                : def.target === "executor"
                  ? writ.executor
                  : contractId;
            const response = await view(
              target,
              def.method,
              {},
              read.blockHash ?? undefined,
              signal,
            );
            return mapCheck(def, jsonValue(response), writ, read);
          } catch (error) {
            if (signal?.aborted) throw error;
            return {
              id: def.id,
              label: def.label,
              method: def.method,
              actual: null,
              expected: def.expected === "$WRIT" ? writ.executor : def.expected,
              result: "unavailable" as const,
              enforcedBy: "sale" as const,
              read,
              reason: "The response could not be verified.",
            };
          }
        }),
      );
      rows.push({
        id: "pending",
        label: "No calls in flight",
        method: bindings.writ,
        actual: writ.pendingCalls,
        expected: 0,
        result: writ.pendingCalls === 0 ? "pass" : "fail",
        enforcedBy: "sale",
        read,
      });
      for (const kind of ["keys", "code"] as const) {
        try {
          const response = await query(
            {
              request_type:
                kind === "keys" ? "view_access_key_list" : "view_account",
              account_id: writ.executor,
              block_id: read.blockHash,
            },
            signal,
          );
          const actual = kind === "keys" ? response.keys : response.code_hash;
          const expected = kind === "keys" ? [] : deployment.executorCodeHash;
          const available =
            kind === "keys"
              ? Array.isArray(actual)
              : typeof expected === "string" && Boolean(expected);
          rows.push({
            id: kind,
            label:
              kind === "keys"
                ? "Executor has no access keys"
                : "Executor code matches",
            method: kind === "keys" ? "view_access_key_list" : "view_account",
            actual: actual as JsonValue,
            expected: (expected ??
              "Published executor hash not configured") as JsonValue,
            result: !available
              ? "unavailable"
              : JSON.stringify(actual) === JSON.stringify(expected)
                ? "pass"
                : "fail",
            enforcedBy: "page",
            read,
          });
        } catch (error) {
          if (signal?.aborted) throw error;
          rows.push({
            id: kind,
            label:
              kind === "keys"
                ? "Executor has no access keys"
                : "Executor code matches",
            method: kind === "keys" ? "view_access_key_list" : "view_account",
            actual: null,
            expected: null,
            result: "unavailable",
            enforcedBy: "page",
            read,
          });
        }
      }
      return { rows, read };
    },
    async getHistory(id, cursor) {
      await ensureConfig();
      const history = object(
        await view(contractId, bindings.history, {
          token_id: id,
          cursor: cursor ?? null,
          limit: 50,
        }),
      );
      if (!Array.isArray(history.entries))
        throw new ChainError("rpc_unavailable", "Invalid history response.");
      return parseHistory(history);
    },
    async buy(request) {
      const session = await (await import("./wallet")).walletSession();
      if (!session)
        throw new ChainError("unauthorized", "Connect your wallet first.");
      const attemptId = request.clientAttemptId ?? crypto.randomUUID();
      const handle = {
        mock: false,
        writId: request.writId,
        attemptId,
        buyerId: session.accountId,
      };
      await ensureConfig();
      const savedKey = `writ-purchase:testnet:${request.writId}`;
      sessionStorage.setItem(savedKey, JSON.stringify(handle));
      try {
        const result = await call(
          bindings.buy,
          {
            token_id: request.writId,
            expected_nonce: request.expectedNonce,
            expected_template_hash: request.expectedTemplateHash,
            maximum_price: request.maximumPrice,
            pins: request.pins,
            client_attempt_id: attemptId,
          },
          (BigInt(request.maximumPrice) + BigInt(purchaseStorage)).toString(),
        );
        return { ...result, ...handle };
      } catch (error) {
        if (error instanceof ChainError && error.code !== "outcome_unknown")
          sessionStorage.removeItem(savedKey);
        if (error instanceof ChainError && error.code === "outcome_unknown")
          throw new PurchaseSubmissionError(handle);
        throw error;
      }
    },
    async getPurchase(handle) {
      await ensureConfig();
      const result = object(
        await view(contractId, bindings.purchase, {
          token_id: handle.writId,
          buyer_id: handle.buyerId ?? (await this.getSession())?.accountId,
          client_attempt_id: handle.attemptId,
        }),
      );
      if (
        !["checking", "refused", "settled", "releasable", "released"].includes(
          String(result.status),
        )
      )
        throw new ChainError(
          "outcome_unknown",
          "The purchase outcome is not confirmed yet.",
        );
      return parsePurchase(result);
    },
    async releaseStuck(handle) {
      return call(bindings.release, {
        token_id: handle.writId,
        buyer_id: handle.buyerId ?? (await this.getSession())?.accountId,
        client_attempt_id: handle.attemptId,
      });
    },
    async claimRefund(handle) {
      return call(bindings.refund, {
        token_id: handle.writId,
        buyer_id: handle.buyerId ?? (await this.getSession())?.accountId,
        client_attempt_id: handle.attemptId,
      });
    },
    async execute(request) {
      return call(
        bindings.execute,
        {
          token_id: request.writId,
          target_method: request.method,
          args: request.args,
          deposit: request.deposit,
        },
        request.deposit,
      );
    },
    async lend(request) {
      return call(bindings.lend, {
        token_id: request.writId,
        borrower_id: request.borrower,
        method: request.method,
        args: request.args,
        max_deposit: request.maxDeposit,
        expires_at_ms: String(Date.parse(request.expiresAt)),
      });
    },
    async endLoan(id, loanId) {
      return call(bindings.endLoan, { token_id: id, loan_id: loanId });
    },
    async setListing(request) {
      return call(bindings.listForSale, {
        token_id: request.writId,
        price: request.price,
        expected_nonce: request.expectedNonce,
      });
    },
    async removeListing(id) {
      return call(bindings.unlist, { token_id: id });
    },
    async withdrawFees(id, amount) {
      return call(bindings.withdraw, { token_id: id, amount });
    },
    async inspectWrap(request) {
      configured();
      const session = await (await import("./wallet")).walletSession();
      if (!session)
        throw new ChainError("unauthorized", "Connect your wallet first.");
      const state = await query({
        request_type: "view_account",
        account_id: request.target,
        finality: "final",
      });
      let holder: unknown;
      const template = getTemplate(request.templateId);
      const profileCheck = template.checks.find(
        (check) => check.id === "profile",
      );
      if (
        profileCheck &&
        (await view(
          request.target,
          profileCheck.method,
          {},
          String(state.block_hash),
        )) !== profileCheck.expected
      )
        throw new ChainError(
          "invalid_input",
          "This contract does not match the selected integration profile.",
        );
      if (request.templateId === "dao-council") {
        const policy = object(
          await view(
            request.target,
            "get_policy",
            {},
            String(state.block_hash),
          ),
        );
        const roles = Array.isArray(policy.roles) ? policy.roles : [];
        const council = roles.map(object).find((r) => r.name === "council");
        const members = council ? object(council.kind).Group : [];
        holder =
          Array.isArray(members) && members.includes(session.accountId)
            ? session.accountId
            : Array.isArray(members)
              ? String(members[0] ?? "")
              : "";
      } else
        holder = await view(
          request.target,
          "own_get_owner",
          {},
          String(state.block_hash),
        );
      if (typeof holder !== "string")
        throw new ChainError(
          "invalid_input",
          "This contract does not expose a supported owner role.",
        );
      return {
        holder,
        isCurrentHolder: holder === session.accountId,
        read: {
          blockHeight: String(state.block_height),
          blockHash: String(state.block_hash),
          observedAtMs: Date.now(),
          source: "testnet",
        },
      };
    },
    async mintWrit(request) {
      const session = await this.getSession();
      if (!session)
        throw new ChainError("unauthorized", "Connect your wallet first.");
      const storageKey = `writ-mint:${contractId}:${session.accountId}:${request.templateId}:${request.target}`;
      let client = sessionStorage.getItem(storageKey);
      if (!client) {
        client = crypto.randomUUID();
        sessionStorage.setItem(storageKey, client);
      }
      await ensureConfig();
      const args = { owner_id: session.accountId, client_request_id: client };
      let state = await view(contractId, "get_mint_result", args);
      // A definitive failed/retired attempt can be replaced only on a fresh, explicit Mint click.
      // Creating/unknown attempts keep their ID and never trigger a second payment here.
      if (state !== null && object(state).status === "failed") {
        client = crypto.randomUUID();
        sessionStorage.setItem(storageKey, client);
        args.client_request_id = client;
        state = null;
      }
      let tx: { hash?: string; mock: boolean } = { mock: false };
      if (state === null) {
        const quote = await this.getMintQuote(request);
        tx = await call(
          "mint",
          {
            template_id: request.templateId,
            target: request.target,
            client_request_id: client,
          },
          quote.deposit,
        );
        state = await view(contractId, "get_mint_result", args);
      }
      const result = object(state);
      if (result.status !== "ready")
        throw new ChainError(
          "outcome_unknown",
          result.status === "failed"
            ? "Provisioning failed. Recover credited funding in My Writs; storage is retained. Clicking Mint again starts a new quoted request."
            : "Provisioning has not finished. Retry this same request to check it without another payment.",
        );
      const writ = await this.getWrit(String(result.tokenId));
      if (!writ)
        throw new ChainError(
          "outcome_unknown",
          "Minted Writ is not readable yet.",
        );
      return { ...tx, writ };
    },
    async performWrapStep(request) {
      const writ = await this.getWrit(request.writId);
      if (!writ) throw new ChainError("not_found", "This Writ does not exist.");
      if (writ.templateId === "dao-council")
        return call("confirm_wrap", { token_id: writ.id });
      if (writ.roleOwner === writ.executor) return { mock: false };
      if (request.step === 0 && writ.proposedOwner === writ.executor)
        return { mock: false };
      if (request.step !== 0 && request.step !== 1)
        throw new ChainError("invalid_input", "Unsupported handover step.");
      if (request.step === 0)
        return call(
          "own_propose_owner",
          { account_id: writ.executor },
          "1",
          writ.target,
        );
      return call(bindings.wrap, { token_id: writ.id, step: request.step });
    },
    async unwrap(id) {
      let writ = await this.getWrit(id);
      if (!writ) throw new ChainError("not_found", "This Writ does not exist.");
      const session = await this.getSession();
      if (session?.accountId !== writ.owner)
        throw new ChainError("unauthorized", "Holder only.");
      const owner = await view(writ.target, "own_get_owner");
      if (owner !== session.accountId) {
        if (!writ.unwrapPending) await call("begin_unwrap", { token_id: id });
        const proposed = await view(writ.target, "own_get_proposed_owner");
        if (proposed !== session.accountId)
          throw new ChainError(
            "outcome_unknown",
            "Hand-back was not proposed. Inspect the role and retry.",
          );
        await call("own_accept_owner", {}, "1", writ.target);
      }
      const tx = await call("finish_unwrap", { token_id: id });
      writ = await this.getWrit(id);
      if (writ)
        throw new ChainError(
          "outcome_unknown",
          "The role hand-back has not been confirmed. Retry to check; the NFT has not been retired.",
        );
      return tx;
    },
  };
}
