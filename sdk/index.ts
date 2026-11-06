/** Writ integration client. No React, wallet keys, backend or near-api-js required. */
export interface WritClientOptions {
  rpcUrl: string;
  network: "testnet" | "mainnet" | "localnet";
  collection: string;
  collectionCodeHash: string;
  executorCodeHash: string;
  templateHashes: Record<string, string>;
  fetch?: typeof globalThis.fetch;
}
export interface WalletTransaction {
  receiverId: string;
  actions: {
    type: "FunctionCall";
    params: {
      methodName: string;
      args: Record<string, unknown>;
      gas: string;
      deposit: string;
    };
  }[];
}
export interface Controller {
  id: string;
  collection: string;
  owner: string;
  executor: string;
  target: string;
  templateId: string;
  templateHash: string;
  epoch: string;
  nonce: string;
  pendingCalls: number;
  status: string;
  roleConfirmed?: boolean;
  provisioned?: boolean;
  unwrapPending?: boolean;
  loans: {
    borrower: string;
    method: string;
    args: Record<string, unknown>;
    epoch: string;
    expiresAt: string;
  }[];
}
export interface AccountObservation {
  account: string;
  balance: string | null;
  codeHash: string | null;
  keys: { publicKey: string; permission: unknown }[] | null;
  unavailable: string | null;
}
export interface AuthoritySnapshot {
  nft?: NftRecord;
  writ: Controller;
  template: {
    name: string;
    actions: {
      method: string;
      label: string;
      lendable: boolean;
      args: Record<string, unknown>;
    }[];
    checks: unknown[];
    blindSpot: string;
  };
  blockHash: string;
  blockHeight: string;
  observedAt: string;
  executor: AccountObservation;
  target: AccountObservation;
  collection: AccountObservation;
}
export interface NftRecord {
  token_id: string;
  owner_id: string;
  metadata: {
    title: string;
    description: string;
    media: string;
    media_hash: string;
    extra: string;
  };
}
const record = (v: unknown): Record<string, unknown> => {
  if (!v || typeof v !== "object" || Array.isArray(v))
    throw new Error("Unexpected contract response.");
  return v as Record<string, unknown>;
};
// Share a conservative read budget when several panels use the same public RPC.
// This schedules observations only: wallet writes never enter this queue.
const readQueues = new Map<
  string,
  { turn: Promise<void>; nextStart: number; active: Set<Promise<unknown>> }
>();
export async function scheduleRpcRead<T>(
  endpoint: string,
  request: () => Promise<T>,
): Promise<T> {
  const url = new URL(endpoint);
  if (["localhost", "127.0.0.1", "[::1]"].includes(url.hostname))
    return request();
  const key = url.href;
  let queue = readQueues.get(key);
  if (!queue) {
    queue = { turn: Promise.resolve(), nextStart: 0, active: new Set() };
    readQueues.set(key, queue);
  }
  const previous = queue.turn;
  let release!: () => void;
  queue.turn = new Promise<void>((resolve) => {
    release = resolve;
  });
  await previous;
  try {
    while (queue.active.size >= 3)
      await Promise.race(queue.active).catch(() => undefined);
    const delay = queue.nextStart - Date.now();
    if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay));
    queue.nextStart = Date.now() + 300;
    const pending = Promise.resolve().then(request);
    queue.active.add(pending);
    const remove = () => {
      queue.active.delete(pending);
    };
    void pending.then(remove, remove);
    return pending;
  } finally {
    release();
  }
}
function base64(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}
function canonical(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonical).join(",")}]`;
  if (v && typeof v === "object")
    return `{${Object.entries(v)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([k, x]) => `${JSON.stringify(k)}:${canonical(x)}`)
      .join(",")}}`;
  return JSON.stringify(v);
}
export class WritClient {
  private readonly request: typeof globalThis.fetch;
  readonly options: WritClientOptions;
  constructor(options: WritClientOptions) {
    this.options = options;
    this.request = options.fetch ?? globalThis.fetch.bind(globalThis);
    const url = new URL(options.rpcUrl);
    if (
      url.protocol !== "https:" &&
      !(
        options.network === "localnet" &&
        ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
      )
    )
      throw new Error("Use HTTPS, or an explicitly local sandbox RPC.");
    if (
      options.network === "localnet" &&
      !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
    )
      throw new Error("Localnet is restricted to localhost.");
    if (
      !options.collectionCodeHash ||
      !options.executorCodeHash ||
      !Object.keys(options.templateHashes).length
    )
      throw new Error("Pin the published code and template hashes.");
  }
  private async rpc(
    method: string,
    params: unknown,
  ): Promise<Record<string, unknown>> {
    // All SDK requests are reads. Retry transient transport failures, never wallet writes.
    for (let attempt = 0; attempt < 3; attempt++) {
      let r: Response;
      try {
        r = await scheduleRpcRead(this.options.rpcUrl, () =>
          this.request(this.options.rpcUrl, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              jsonrpc: "2.0",
              id: "writ-sdk",
              method,
              params,
            }),
            signal: AbortSignal.timeout(15000),
          }),
        );
      } catch (error) {
        if (attempt === 2) throw error;
        await new Promise((resolve) =>
          setTimeout(resolve, 300 * (attempt + 1)),
        );
        continue;
      }
      if ([429, 502, 503, 504].includes(r.status) && attempt < 2) {
        await new Promise((resolve) =>
          setTimeout(resolve, 400 * (attempt + 1)),
        );
        continue;
      }
      if (!r.ok) throw new Error(`NEAR RPC returned HTTP ${r.status}.`);
      const data = record(await r.json());
      if (data.error)
        throw new Error("The requested chain observation is unavailable.");
      return record(data.result);
    }
    throw new Error("The chain observation is unavailable.");
  }
  private async network() {
    const status = await this.rpc("status", []);
    if (
      this.options.network !== "localnet" &&
      status.chain_id !== this.options.network
    )
      throw new Error("RPC network does not match the configured network.");
  }
  async view(
    account: string,
    method: string,
    args: Record<string, unknown> = {},
    blockHash?: string,
  ): Promise<unknown> {
    const q = await this.rpc("query", {
      request_type: "call_function",
      account_id: account,
      method_name: method,
      args_base64: base64(new TextEncoder().encode(JSON.stringify(args))),
      ...(blockHash ? { block_id: blockHash } : { finality: "final" }),
    });
    if (
      !Array.isArray(q.result) ||
      q.result.length > 524288 ||
      !q.result.every(
        (x) => Number.isInteger(x) && Number(x) >= 0 && Number(x) <= 255,
      )
    )
      throw new Error("Invalid or oversized contract response.");
    return JSON.parse(
      new TextDecoder("utf-8", { fatal: true }).decode(
        Uint8Array.from(q.result),
      ),
    );
  }
  private async anchor() {
    await this.network();
    const state = await this.rpc("query", {
      request_type: "view_account",
      account_id: this.options.collection,
      finality: "final",
    });
    if (state.code_hash !== this.options.collectionCodeHash)
      throw new Error(
        "Collection code changed from the pinned release. Review it before using this integration.",
      );
    const hash = String(state.block_hash);
    const config = record(
      await this.view(this.options.collection, "get_frontend_config", {}, hash),
    );
    const hashes = record(config.template_hashes);
    if (
      config.abi_version !== "writ-ui-v1" ||
      config.executor_code_hash !== this.options.executorCodeHash ||
      Object.entries(this.options.templateHashes).some(
        ([id, h]) => hashes[id] !== h,
      )
    )
      throw new Error(
        "Published Writ configuration does not match this integration.",
      );
    return { hash, height: String(state.block_height) };
  }
  private async controller(tokenId: string, hash: string): Promise<Controller> {
    if (!/^[1-9]\d{0,19}$/.test(tokenId))
      throw new Error("Enter a canonical Writ token ID.");
    const w = record(
      await this.view(
        this.options.collection,
        "get_writ",
        { token_id: tokenId },
        hash,
      ),
    );
    if (
      w.id !== tokenId ||
      w.collection !== this.options.collection ||
      typeof w.templateId !== "string" ||
      !this.options.templateHashes[w.templateId] ||
      w.templateHash !== this.options.templateHashes[w.templateId] ||
      !Array.isArray(w.loans)
    )
      throw new Error("Writ identity does not match the pinned release.");
    // Collection view placeholders are not independent balance/key/role observations.
    const fields = [
      "id",
      "collection",
      "owner",
      "executor",
      "target",
      "templateId",
      "templateHash",
      "epoch",
      "nonce",
      "pendingCalls",
      "status",
      "roleConfirmed",
      "provisioned",
      "unwrapPending",
      "loans",
    ];
    return Object.fromEntries(
      fields.map((key) => [key, w[key]]),
    ) as unknown as Controller;
  }
  private async account(
    account: string,
    hash: string,
  ): Promise<AccountObservation> {
    const [state, keys] = await Promise.allSettled([
      this.rpc("query", {
        request_type: "view_account",
        account_id: account,
        block_id: hash,
      }),
      this.rpc("query", {
        request_type: "view_access_key_list",
        account_id: account,
        block_id: hash,
      }),
    ]);
    const validState =
      state.status === "fulfilled" &&
      typeof state.value.amount === "string" &&
      /^\d{1,78}$/.test(state.value.amount) &&
      typeof state.value.code_hash === "string" &&
      state.value.code_hash.length > 0;
    return {
      account,
      balance:
        validState && state.status === "fulfilled"
          ? String(state.value.amount)
          : null,
      codeHash:
        validState && state.status === "fulfilled"
          ? String(state.value.code_hash)
          : null,
      keys:
        keys.status === "fulfilled" && Array.isArray(keys.value.keys)
          ? keys.value.keys.map((k) => {
              const x = record(k);
              return {
                publicKey: String(x.public_key),
                permission: record(x.access_key).permission,
              };
            })
          : null,
      unavailable:
        !validState || keys.status === "rejected"
          ? "Account code or access keys could not be observed."
          : null,
    };
  }
  async inspect(
    tokenId: string,
    includeNft = false,
  ): Promise<AuthoritySnapshot> {
    const { hash, height } = await this.anchor();
    const writ = await this.controller(tokenId, hash);
    const [executor, target, collection, template, nft] = await Promise.all([
      this.account(writ.executor, hash),
      this.account(writ.target, hash),
      this.account(this.options.collection, hash),
      this.view(
        this.options.collection,
        "get_template",
        { template_id: writ.templateId },
        hash,
      ),
      includeNft ? this.nftAt(tokenId, hash) : Promise.resolve(undefined),
    ]);
    return {
      writ,
      executor,
      target,
      collection,
      template: template as AuthoritySnapshot["template"],
      blockHash: hash,
      blockHeight: height,
      observedAt: new Date().toISOString(),
      ...(nft ? { nft: nft.nft } : {}),
    };
  }
  async nft(tokenId: string): Promise<{
    nft: NftRecord;
    mediaHashVerified: boolean;
    blockHash: string;
  }> {
    const { hash } = await this.anchor();
    return this.nftAt(tokenId, hash);
  }
  private async nftAt(tokenId: string, hash: string) {
    const nft = record(
      await this.view(
        this.options.collection,
        "nft_token",
        { token_id: tokenId },
        hash,
      ),
    ) as unknown as NftRecord;
    if (
      nft.token_id !== tokenId ||
      !nft.metadata ||
      !nft.metadata.media?.startsWith("data:image/svg+xml;base64,")
    )
      throw new Error("Unsupported NFT metadata.");
    const bytes = Uint8Array.from(atob(nft.metadata.media.split(",")[1]), (c) =>
      c.charCodeAt(0),
    );
    const actual = base64(
      new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
    );
    if (actual !== nft.metadata.media_hash)
      throw new Error("NFT artwork does not match its media hash.");
    return { nft, mediaHashVerified: true, blockHash: hash };
  }
  async buildAction(input: {
    tokenId: string;
    actor: string;
    method: string;
    args: Record<string, unknown>;
  }): Promise<WalletTransaction> {
    const snapshot = await this.inspect(input.tokenId);
    const w = snapshot.writ;
    if (
      !snapshot.executor.keys ||
      snapshot.executor.keys.length ||
      snapshot.executor.codeHash !== this.options.executorCodeHash
    )
      throw new Error(
        "Executor code or keys do not match the expected controller.",
      );
    if (
      w.provisioned === false ||
      w.roleConfirmed !== true ||
      w.unwrapPending ||
      w.pendingCalls ||
      ["listed", "locked"].includes(w.status)
    )
      throw new Error(
        "Complete role handover and resolve locks before using this controller.",
      );
    const action = snapshot.template.actions.find(
      (a) => a.method === input.method,
    );
    if (!action)
      throw new Error("This command is not exposed by the pinned integration.");
    const encoded = JSON.stringify(input.args);
    if (
      !input.args ||
      Array.isArray(input.args) ||
      typeof input.args !== "object" ||
      new TextEncoder().encode(encoded).length > 4096
    )
      throw new Error("Arguments must be a JSON object of at most 4096 bytes.");
    const loan = w.loans.some(
      (l) =>
        l.borrower === input.actor &&
        l.method === input.method &&
        l.epoch === w.epoch &&
        Date.parse(l.expiresAt) > Date.now() &&
        canonical(l.args) === canonical(input.args),
    );
    if (w.owner !== input.actor && !loan)
      throw new Error(
        "This wallet has no permission for these exact arguments.",
      );
    return {
      receiverId: this.options.collection,
      actions: [
        {
          type: "FunctionCall",
          params: {
            methodName: "execute",
            args: {
              token_id: w.id,
              target_method: input.method,
              args: input.args,
              deposit: "0",
            },
            gas: "250000000000000",
            deposit: "0",
          },
        },
      ],
    };
  }
  async confirmAction(
    hash: string,
    signer: string,
    expected?: WalletTransaction,
  ): Promise<{ hash: string; success: true }> {
    await this.network();
    const result = await this.rpc("tx", {
      tx_hash: hash,
      sender_account_id: signer,
      wait_until: "FINAL",
    });
    const tx = record(result.transaction);
    const status = record(result.status);
    if (
      tx.hash !== hash ||
      tx.signer_id !== signer ||
      tx.receiver_id !== this.options.collection ||
      status.SuccessValue !== "dHJ1ZQ=="
    )
      throw new Error(
        "The external command did not return a confirmed successful execution. Inspect its receipts before retrying.",
      );
    if (!Array.isArray(tx.actions) || tx.actions.length !== 1)
      throw new Error("Unexpected transaction actions.");
    const call = record(record(tx.actions[0]).FunctionCall);
    if (call.method_name !== "execute")
      throw new Error("This transaction is not a Writ command.");
    if (expected) {
      const requested = expected.actions[0]?.params;
      const decoded = JSON.parse(
        new TextDecoder("utf-8", { fatal: true }).decode(
          Uint8Array.from(atob(String(call.args)), (c) => c.charCodeAt(0)),
        ),
      );
      if (
        expected.receiverId !== tx.receiver_id ||
        requested?.methodName !== call.method_name ||
        requested.deposit !== call.deposit ||
        canonical(decoded) !== canonical(requested.args)
      )
        throw new Error(
          "The confirmed transaction differs from the requested command.",
        );
    }
    return { hash, success: true };
  }
}
