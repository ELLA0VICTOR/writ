import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import { exampleWrit } from "../../src/chain/fixtures/writs";
const rpc = vi.hoisted(() => vi.fn());
const walletCall = vi.hoisted(() =>
  vi.fn(async () => ({ mock: false, hash: "actual-wallet-result" })),
);
vi.mock("../../src/chain/wallet", () => ({
  walletSession: async () => ({ accountId: "ben.testnet" }),
  walletCall,
}));
vi.mock("near-api-js", () => ({
  JsonRpcProvider: class {
    sendJsonRpc = rpc;
  },
}));
import { createTestnetAdapter } from "../../src/chain/testnetAdapter";
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
    rpc.mockReset();
    walletCall.mockClear();
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
    );
    expect(handle.buyerId).toBe("ben.testnet");
    expect(sessionStorage.getItem("writ-purchase:testnet:7")).toContain(
      "ben.testnet",
    );
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
    );
    await a.transfer("7", "sam.testnet");
    expect(walletCall).toHaveBeenLastCalledWith(
      "writ-demo.testnet",
      "nft_transfer",
      { token_id: "7", receiver_id: "sam.testnet" },
      "1",
    );
  });
});
