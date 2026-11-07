import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import { exampleWrit } from "../../src/chain/fixtures/writs";
const rpc = vi.hoisted(() => vi.fn());
const statusRpc = vi.hoisted(() => vi.fn());
const walletCall = vi.hoisted(() =>
  vi.fn(async () => ({ mock: false, hash: "actual-wallet-result" })),
);
vi.mock("../../src/chain/wallet", () => ({
  walletSession: async () => ({ accountId: "ben.testnet" }),
  walletCall,
}));
vi.mock("near-api-js", () => ({
  JsonRpcProvider: class {
    sendJsonRpc = (method: string, ...args: unknown[]) =>
      method === "status" ? statusRpc() : rpc(method, ...args);
  },
}));
vi.mock("../../sdk/index", () => ({
  scheduleRpcRead: async (_endpoint: string, request: () => Promise<unknown>) =>
    request(),
}));
import { createTestnetAdapter } from "../../src/chain/testnetAdapter";
import { ChainError } from "../../src/chain/errors";
import { releaseConfig } from "../../src/chain/deployment";
const encoded = (value: unknown) => ({
  result: [...new TextEncoder().encode(JSON.stringify(value))],
});
describe("real adapter wire contract with controlled RPC responses", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_WRIT_CONTRACT", "writ-demo.testnet");
    vi.stubEnv("VITE_WRIT_ABI_VERSION", "writ-ui-v1");
    vi.stubEnv("VITE_EXECUTOR_CODE_HASH", "published-executor");
    vi.stubEnv("VITE_OWNER_TEMPLATE_HASH", "published-owner");
    vi.stubEnv("VITE_DAO_TEMPLATE_HASH", "");
    vi.stubEnv("VITE_COLLECTION_CODE_HASH", "");
    vi.stubEnv("VITE_COLLECTION_TEMPLATE_HASH", "");
    vi.stubEnv("VITE_ISSUER_TEMPLATE_HASH", "");
    vi.stubEnv("VITE_TREASURY_TEMPLATE_HASH", "");
    rpc.mockReset();
    statusRpc.mockReset();
    statusRpc.mockResolvedValue({ chain_id: "testnet" });
    walletCall.mockReset();
    walletCall.mockResolvedValue({ mock: false, hash: "actual-wallet-result" });
    const saved = new Map<string, string>();
    vi.stubGlobal("sessionStorage", {
      getItem: (k: string) => saved.get(k) ?? null,
      setItem: (k: string, v: string) => saved.set(k, v),
      removeItem: (k: string) => saved.delete(k),
    });
  });
  afterEach(() => vi.unstubAllEnvs());
  it("fails closed for incompatible deployment metadata", async () => {
    rpc.mockResolvedValue(
      encoded({
        abi_version: "different",
        executor_code_hash: "published-executor",
        template_hashes: { "contract-owner": "published-owner" },
      }),
    );
    await expect(createTestnetAdapter().getWrit("7")).rejects.toMatchObject({
      code: "not_configured",
    });
  });
  it("refuses a mainnet RPC even with testnet build settings", async () => {
    statusRpc.mockResolvedValue({ chain_id: "mainnet" });
    await expect(createTestnetAdapter().getWrit("7")).rejects.toMatchObject({
      code: "not_configured",
    });
    expect(walletCall).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });
  it("rejects transfers into the collection namespace before asking for a wallet signature", async () => {
    const a = createTestnetAdapter();
    for (const receiver of [
      "writ-demo.testnet",
      "w7.writ-demo.testnet",
      "nested.w7.writ-demo.testnet",
    ]) {
      await expect(a.transfer("7", receiver)).rejects.toMatchObject({
        code: "invalid_input",
      });
    }
    expect(walletCall).not.toHaveBeenCalled();
  });
  it("stops signing when the collection code differs from the pinned release", async () => {
    vi.stubEnv("VITE_COLLECTION_CODE_HASH", "reviewed-collection");
    rpc.mockImplementation(
      async (_method: string, args: Record<string, unknown>) =>
        args.request_type === "view_account"
          ? { code_hash: "changed-collection" }
          : encoded({
              abi_version: "writ-ui-v1",
              executor_code_hash: "published-executor",
              template_hashes: { "contract-owner": "published-owner" },
            }),
    );
    await expect(
      createTestnetAdapter().fundExecutor("7", "1"),
    ).rejects.toMatchObject({ code: "not_configured" });
    expect(walletCall).not.toHaveBeenCalled();
  });
  it("requires the exact new integration profile before minting inspection can succeed", async () => {
    vi.stubEnv("VITE_ISSUER_TEMPLATE_HASH", "published-issuer");
    rpc.mockImplementation(
      async (_method: string, args: Record<string, unknown>) => {
        if (args.method_name === "get_frontend_config")
          return encoded({
            abi_version: "writ-ui-v1",
            executor_code_hash: "published-executor",
            template_hashes: {
              "contract-owner": "published-owner",
              "token-issuer": "published-issuer",
            },
          });
        if (args.request_type === "view_account")
          return { block_hash: "pinned-block", block_height: 123 };
        if (args.method_name === "get_integration_profile")
          return encoded("collection-admin");
        throw new Error(
          "Owner must not be checked as if the wrong profile were compatible",
        );
      },
    );
    await expect(
      createTestnetAdapter().inspectWrap({
        templateId: "token-issuer",
        target: "tokens.testnet",
      }),
    ).rejects.toMatchObject({ code: "invalid_input" });
    expect(walletCall).not.toHaveBeenCalled();
  });
  it("does not start another paid practice target while a previous attempt is unresolved", async () => {
    sessionStorage.setItem(
      "writ-practice:writ-demo.testnet:ben.testnet:contract-owner",
      "pending-request",
    );
    rpc.mockResolvedValue(encoded({ status: "creating" }));
    await expect(
      createTestnetAdapter().createPracticeTarget("contract-owner", true),
    ).rejects.toMatchObject({ code: "outcome_unknown" });
    expect(walletCall).not.toHaveBeenCalled();
    expect(
      sessionStorage.getItem(
        "writ-practice:writ-demo.testnet:ben.testnet:contract-owner",
      ),
    ).toBe("pending-request");
  });
  it("pins all page observations to the same finalized block hash", async () => {
    const queries: Record<string, unknown>[] = [];
    rpc.mockImplementation(
      async (method: string, args: Record<string, unknown>) => {
        expect(method).toBe("query");
        queries.push(args);
        if (args.method_name === "get_frontend_config")
          return encoded({
            abi_version: "writ-ui-v1",
            executor_code_hash: "published-executor",
            template_hashes: { "contract-owner": "published-owner" },
          });
        if (args.method_name === "get_writ")
          return encoded({ ...exampleWrit, templateHash: "published-owner" });
        if (args.method_name === "own_get_owner")
          return encoded(exampleWrit.executor);
        if (args.method_name === "own_get_proposed_owner") return encoded(null);
        if (args.request_type === "view_access_key_list") return { keys: [] };
        return {
          block_height: 123,
          block_hash: "pinned-block",
          code_hash: "published-executor",
        };
      },
    );
    const result = await createTestnetAdapter().readChecks("7");
    expect(result.rows.every((row) => row.result === "pass")).toBe(true);
    expect(result.rows.filter((row) => row.enforcedBy === "page")).toHaveLength(
      2,
    );
    const pinned = queries.filter(
      (query) =>
        query.method_name !== "get_frontend_config" &&
        query.finality !== "final",
    );
    expect(pinned).toHaveLength(5);
    expect(pinned.every((query) => query.block_id === "pinned-block")).toBe(
      true,
    );
  });
  it("keeps a failed external response unavailable rather than passing", async () => {
    rpc.mockImplementation(
      async (_method: string, args: Record<string, unknown>) => {
        if (args.method_name === "get_frontend_config")
          return encoded({
            abi_version: "writ-ui-v1",
            executor_code_hash: "published-executor",
            template_hashes: { "contract-owner": "published-owner" },
          });
        if (args.method_name === "get_writ")
          return encoded({ ...exampleWrit, templateHash: "published-owner" });
        if (args.method_name === "own_get_owner")
          return encoded(exampleWrit.executor);
        if (args.method_name === "own_get_proposed_owner")
          return { result: [255, 255] };
        if (args.request_type === "view_access_key_list") return { keys: [] };
        return {
          block_height: 123,
          block_hash: "pinned-block",
          code_hash: "published-executor",
        };
      },
    );
    const result = await createTestnetAdapter().readChecks("7");
    expect(result.rows.find((row) => row.id === "proposed")?.result).toBe(
      "unavailable",
    );
  });
  it("exposes implemented provisioning/retirement only with deployment configuration", () => {
    const a = createTestnetAdapter();
    expect(a.capabilities.wrap).toBe(true);
    expect(a.capabilities.unwrap).toBe(true);
    vi.stubEnv("VITE_WRIT_CONTRACT", "");
    expect(createTestnetAdapter().capabilities.wrap).toBe(false);
  });
  it("attaches retained storage to a purchase and keeps buyer identity for refund recovery", async () => {
    rpc.mockImplementation(
      async (_method: string, args: Record<string, unknown>) => {
        if (args.method_name === "get_frontend_config")
          return encoded({
            abi_version: "writ-ui-v1",
            executor_code_hash: "published-executor",
            template_hashes: { "contract-owner": "published-owner" },
            purchase_storage_deposit: "500",
          });
        if (args.method_name === "get_purchase")
          return encoded({ status: "released", refundStatus: "claimable" });
        throw new Error("Unexpected query");
      },
    );
    const a = createTestnetAdapter();
    const handle = await a.buy({
      writId: "7",
      expectedNonce: "12",
      expectedTemplateHash: "published-owner",
      maximumPrice: "1000",
      pins: [],
      clientAttemptId: "stable-request",
    });
    expect(walletCall).toHaveBeenCalledWith(
      "writ-demo.testnet",
      "buy",
      expect.objectContaining({ client_attempt_id: "stable-request" }),
      "1500",
      expect.objectContaining({
        network: "testnet",
        collection: "writ-demo.testnet",
      }),
      expect.any(Function),
    );
    expect(handle.buyerId).toBe("ben.testnet");
    expect(
      sessionStorage.getItem("writ-purchase:testnet:writ-demo.testnet:7"),
    ).toContain("ben.testnet");
    await a.getPurchase(handle);
    await a.claimRefund(handle);
    expect(walletCall).toHaveBeenLastCalledWith(
      "writ-demo.testnet",
      "claim_refund",
      {
        token_id: "7",
        buyer_id: "ben.testnet",
        client_attempt_id: "stable-request",
      },
      "0",
      expect.objectContaining({
        network: "testnet",
        collection: "writ-demo.testnet",
      }),
      expect.any(Function),
    );
    const lookup = rpc.mock.calls.find(
      ([, p]) => p.method_name === "get_purchase",
    )![1];
    expect(
      JSON.parse(Buffer.from(lookup.args_base64, "base64").toString()),
    ).toEqual({
      token_id: "7",
      buyer_id: "ben.testnet",
      client_attempt_id: "stable-request",
    });
  });
  it("uses milliseconds for loan expiry and one yocto for standard NFT transfer", async () => {
    rpc.mockResolvedValue(
      encoded({
        abi_version: "writ-ui-v1",
        executor_code_hash: "published-executor",
        template_hashes: { "contract-owner": "published-owner" },
        purchase_storage_deposit: "500",
      }),
    );
    const a = createTestnetAdapter();
    await a.lend({
      writId: "7",
      borrower: "sam.testnet",
      method: "set_price",
      args: { price: "1" },
      maxDeposit: "0",
      expiresAt: "2026-11-07T00:00:00Z",
    });
    expect(walletCall).toHaveBeenLastCalledWith(
      "writ-demo.testnet",
      "lend",
      expect.objectContaining({
        expires_at_ms: String(Date.parse("2026-11-07T00:00:00Z")),
      }),
      "0",
      expect.objectContaining({ network: "testnet" }),
      expect.any(Function),
    );
    await a.transfer("7", "sam.testnet");
    expect(walletCall).toHaveBeenLastCalledWith(
      "writ-demo.testnet",
      "nft_transfer",
      { token_id: "7", receiver_id: "sam.testnet" },
      "1",
      expect.objectContaining({ network: "testnet" }),
      expect.any(Function),
    );
  });
  it("keeps native-fund controls observable when the external Owner target disappears", async () => {
    rpc.mockImplementation(
      async (_method: string, args: Record<string, unknown>) => {
        if (args.method_name === "get_frontend_config")
          return encoded({
            abi_version: "writ-ui-v1",
            executor_code_hash: "published-executor",
            template_hashes: { "contract-owner": "published-owner" },
            purchase_storage_deposit: "500",
          });
        if (args.method_name === "get_writ")
          return encoded({ ...exampleWrit, templateHash: "published-owner" });
        if (args.method_name === "get_balance") return encoded("100");
        if (args.request_type === "view_access_key_list") return { keys: [] };
        if (args.request_type === "view_account")
          return {
            amount: "200",
            code_hash: "published-executor",
            block_hash: "pinned-block",
          };
        throw new Error("Target method no longer exists");
      },
    );
    const w = await createTestnetAdapter().getWrit("7");
    expect(w?.roleOwner).toBeNull();
    expect(w?.roleObservationUnavailable).toBe(true);
    expect(w?.withdrawableFees).toBe("100");
  });
  it("clears a definitively failed purchase handle but preserves an unknown submission", async () => {
    rpc.mockResolvedValue(
      encoded({
        abi_version: "writ-ui-v1",
        executor_code_hash: "published-executor",
        template_hashes: { "contract-owner": "published-owner" },
        purchase_storage_deposit: "500",
      }),
    );
    const a = createTestnetAdapter();
    const request = {
      writId: "7",
      expectedNonce: "1",
      expectedTemplateHash: "published-owner",
      maximumPrice: "1000",
      pins: [],
      clientAttemptId: "known-attempt",
    };
    walletCall.mockRejectedValueOnce(
      new ChainError("invalid_input", "Confirmed on-chain failure"),
    );
    await expect(a.buy(request)).rejects.toThrow("Confirmed on-chain failure");
    expect(
      sessionStorage.getItem("writ-purchase:testnet:writ-demo.testnet:7"),
    ).toBeNull();
    walletCall.mockRejectedValueOnce(
      new ChainError("outcome_unknown", "RPC interrupted"),
    );
    await expect(a.buy(request)).rejects.toMatchObject({
      code: "outcome_unknown",
    });
    expect(
      sessionStorage.getItem("writ-purchase:testnet:writ-demo.testnet:7"),
    ).toContain("known-attempt");
  });
  it("routes mainnet writes to the configured controller and rejects a purchase from another deployment", async () => {
    const config = releaseConfig("mainnet", "writ.team.near");
    statusRpc.mockResolvedValue({ chain_id: "mainnet" });
    rpc.mockImplementation(
      async (_method: string, args: Record<string, unknown>) =>
        args.request_type === "view_account"
          ? { code_hash: config.collectionCodeHash }
          : encoded({
              abi_version: config.abiVersion,
              executor_code_hash: config.executorCodeHash,
              template_hashes: config.templateHashes,
            }),
    );
    const adapter = createTestnetAdapter(config);
    await adapter.transfer("1", "ben.near");
    expect(walletCall).toHaveBeenCalledWith(
      "writ.team.near",
      "nft_transfer",
      { token_id: "1", receiver_id: "ben.near" },
      "1",
      config,
      expect.any(Function),
    );
    const foreign = {
      mock: false,
      writId: "1",
      attemptId: "attempt",
      network: "testnet" as const,
      collection: "writ.team.near",
    };
    await expect(adapter.getPurchase(foreign)).rejects.toMatchObject({
      code: "invalid_input",
    });
    await expect(
      adapter.claimRefund({
        ...foreign,
        network: "mainnet",
        collection: "other.near",
      }),
    ).rejects.toMatchObject({ code: "invalid_input" });
    await expect(
      adapter.releaseStuck({ mock: false, writId: "1", attemptId: "legacy" }),
    ).rejects.toMatchObject({ code: "invalid_input" });
    expect(walletCall).toHaveBeenCalledTimes(1);
  });
  it("rejects stale adapters before querying or signing", async () => {
    const adapter = createTestnetAdapter(
      releaseConfig("mainnet", "writ.team.near"),
      () => false,
    );
    await expect(adapter.transfer("1", "ben.near")).rejects.toMatchObject({
      code: "not_configured",
    });
    expect(statusRpc).not.toHaveBeenCalled();
    expect(walletCall).not.toHaveBeenCalled();
  });
  it("labels legacy settlement evidence with the independently checked mainnet network", async () => {
    const config = releaseConfig("mainnet", "writ.team.near");
    statusRpc.mockResolvedValue({ chain_id: "mainnet" });
    rpc.mockImplementation(
      async (_method: string, args: Record<string, unknown>) =>
        encoded(
          args.method_name === "get_frontend_config"
            ? {
                abi_version: config.abiVersion,
                executor_code_hash: config.executorCodeHash,
                template_hashes: config.templateHashes,
              }
            : {
                status: "refused",
                refundStatus: "claimable",
                checks: [
                  {
                    id: "proposed",
                    label: "No next owner",
                    method: "own_get_proposed_owner",
                    result: "fail",
                    enforcedBy: "sale",
                    read: {
                      blockHeight: "123",
                      blockHash: null,
                      observedAtMs: 1000,
                      source: "testnet",
                      phase: "settlement_callback",
                    },
                  },
                ],
              },
        ),
    );
    const result = await createTestnetAdapter(config).getPurchase({
      mock: false,
      network: "mainnet",
      collection: config.collection,
      writId: "1",
      attemptId: "attempt",
      buyerId: "ben.near",
    });
    expect(result.status).toBe("refused");
    if (result.status === "refused")
      expect(result.checks[0].read).toEqual({
        blockHeight: "123",
        blockHash: null,
        observedAtMs: 1000,
        source: "mainnet",
        phase: "settlement_callback",
      });
    expect(walletCall).not.toHaveBeenCalled();
  });
});
