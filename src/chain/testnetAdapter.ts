import type { WritAdapter } from "./adapter";
import type {
  CheckResult,
  JsonValue,
  ReadContext,
  Writ,
  WritPage,
} from "./types";
import { bindings } from "./contractBindings";
import { ChainError, PurchaseSubmissionError } from "./errors";
import { mapCheck } from "./checks";
import { templates, getTemplate } from "../templates/registry";

import {
  record as object,
  parseWrit,
  parseHistory,
  parsePurchase,
  jsonValue,
} from "./validation";
type ObjectValue = Record<string, unknown>;
export function createTestnetAdapter(): WritAdapter {
  const contractId = (import.meta.env.VITE_WRIT_CONTRACT as string) || "";
  const enabled = Boolean(
    contractId &&
    import.meta.env.VITE_WRIT_ABI_VERSION === bindings.abiVersion &&
    import.meta.env.VITE_EXECUTOR_CODE_HASH &&
    import.meta.env.VITE_OWNER_TEMPLATE_HASH,
  );
  let providerPromise:
    Promise<import("near-api-js").JsonRpcProvider> | undefined;
  const provider = () =>
    (providerPromise ??= import("near-api-js").then(
      ({ JsonRpcProvider }) =>
        new JsonRpcProvider({
          url:
            import.meta.env.VITE_NEAR_RPC_URL || "https://rpc.testnet.near.org",
        }),
    ));
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
      const result = object(
        await (await provider()).sendJsonRpc("query", params),
      );
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
  function ensureConfig(): Promise<void> {
    configured();
    return (configPromise ??= view(contractId, bindings.config)
      .then((value) => {
        const config = object(value);
        const hashes = object(config.template_hashes);
        if (
          config.abi_version !== bindings.abiVersion ||
          config.executor_code_hash !==
            import.meta.env.VITE_EXECUTOR_CODE_HASH ||
          hashes["contract-owner"] !== import.meta.env.VITE_OWNER_TEMPLATE_HASH
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
        writ.templateId !== "contract-owner" ||
        writ.templateHash !== import.meta.env.VITE_OWNER_TEMPLATE_HASH ||
        (id !== undefined && writ.id !== String(Number(id))))
    )
      throw new ChainError(
        "rpc_unavailable",
        "The Writ identity or template hash differs from the configured deployment.",
      );
    return writ;
  }
  async function call(
    method: string,
    args: object,
    deposit = "0",
    receiver = contractId,
  ) {
    await ensureConfig();
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
      unwrap: false,
      wrap: false,
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
        await (
          await provider()
        ).sendJsonRpc("EXPERIMENTAL_protocol_config", { finality: "final" }),
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
      const price = object(
        await (await provider()).sendJsonRpc("gas_price", [null]),
      );
      const gasPrice = BigInt(String(price.gas_price));
      return ((gasPrice * 250000000000000n * 13n) / 10n).toString();
    },
    async getTemplates() {
      if (enabled) await ensureConfig();
      return templates.filter((t) => t.id === "contract-owner");
    },
    async getWrit(id, signal) {
      await ensureConfig();
      return checkedWrit(
        await view(
          contractId,
          bindings.writ,
          { token_id: String(Number(id)) },
          undefined,
          signal,
        ),
        id,
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
        items: page.items
          .map((value) => checkedWrit(value))
          .filter((w): w is Writ => w !== null),
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
          read.blockHash,
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
              read.blockHash,
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
          const expected =
            kind === "keys" ? [] : import.meta.env.VITE_EXECUTOR_CODE_HASH;
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
      const handle = { mock: false, writId: request.writId, attemptId };
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
          request.maximumPrice,
        );
        return { ...result, ...handle };
      } catch (error) {
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
        client_attempt_id: handle.attemptId,
      });
    },
    async claimRefund(handle) {
      return call(bindings.refund, {
        token_id: handle.writId,
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
        expires_at: request.expiresAt,
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
      const holder = await view(
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
    async mintWrit() {
      throw new ChainError(
        "not_configured",
        "Minting needs a published provisioning quote and storage deposit. The contract integration is not ready yet.",
      );
    },
    async performWrapStep(request) {
      const writ = await this.getWrit(request.writId);
      if (!writ) throw new ChainError("not_found", "This Writ does not exist.");
      if (request.step === 0)
        return call(
          "own_propose_owner",
          { account_id: writ.executor },
          "0",
          writ.target,
        );
      return call(bindings.wrap, { token_id: writ.id, step: request.step });
    },
    async unwrap(id) {
      return call(bindings.unwrap, { token_id: id });
    },
  };
}
