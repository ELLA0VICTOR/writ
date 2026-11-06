import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import { exampleWrit } from "../../src/chain/fixtures/writs";
const rpc = vi.hoisted(() => vi.fn());
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
    rpc.mockReset();
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
});
