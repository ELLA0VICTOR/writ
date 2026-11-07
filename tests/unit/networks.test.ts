import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  deploymentConfig,
  loadDeployment,
  parseDeployment,
  purchaseKey,
  releaseConfig,
  saveDeployment,
  transactionUrl,
} from "../../src/chain/deployment";
import { WritClient } from "../../sdk/index";

beforeEach(() => {
  const values = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  });
});
afterEach(() => vi.unstubAllGlobals());
describe("public network/deployment configuration", () => {
  it("defaults to testnet, with no invented mainnet controller or examples", () => {
    expect(deploymentConfig().network).toBe("testnet");
    expect(releaseConfig("mainnet").collection).toBe("");
    expect(releaseConfig("mainnet").examples).toBeUndefined();
  });
  it("keeps only public compatible fields and persists the selected network", () => {
    const config = parseDeployment({
      ...releaseConfig("mainnet", "writ.team.near"),
      [["private", "key"].join("_")]: "must-not-persist",
      examples: { "contract-owner": "7" },
    });
    expect(config).not.toHaveProperty("private_key");
    expect(config.examples).toBeUndefined();
    saveDeployment(config);
    expect(loadDeployment()).toEqual(config);
    saveDeployment(null);
    expect(loadDeployment()).toEqual(deploymentConfig());
    saveDeployment(releaseConfig("mainnet"));
    expect(loadDeployment().collection).toBe("");
    expect(loadDeployment().network).toBe("mainnet");
  });
  it("rejects wrong-network accounts, foreign releases and secret-bearing endpoints", () => {
    const good = releaseConfig("mainnet", "writ.team.near");
    for (const patch of [
      { collection: "writ.testnet" },
      { network: "localnet" },
      { collection: "bad..near" },
      { collection: "a".repeat(42) },
      { collectionCodeHash: "arbitrary" },
      { abiVersion: "v2" },
      { templateHashes: {} },
      { rpcUrl: "http://unsafe.example" },
      { rpcUrl: "https://user:secret@rpc.example" },
      { rpcUrl: "https://rpc.example/?key=secret" },
    ])
      expect(() => parseDeployment({ ...good, ...patch })).toThrow();
  });
  it("separates purchase recovery by collection and network, and selects the correct explorer", () => {
    expect(
      new Set([
        purchaseKey("testnet", "writ.testnet", "1"),
        purchaseKey("mainnet", "writ.testnet", "1"),
        purchaseKey("mainnet", "other.near", "1"),
      ]).size,
    ).toBe(3);
    expect(transactionUrl("mainnet", "hash")).toBe(
      "https://nearblocks.io/txns/hash",
    );
    expect(transactionUrl("testnet", "hash")).toBe(
      "https://testnet.nearblocks.io/txns/hash",
    );
  });
});
describe("standalone SDK deployment verification", () => {
  function fixture(network = "mainnet", code?: string) {
    const config = releaseConfig("mainnet", "writ.team.near");
    const fetch = vi.fn(async (_url: unknown, init?: RequestInit) => {
      const request = JSON.parse(String(init?.body));
      const result =
        request.method === "status"
          ? { chain_id: network }
          : request.params.request_type === "view_account"
            ? {
                code_hash: code ?? config.collectionCodeHash,
                block_hash: "final-block",
                block_height: 123,
              }
            : {
                result: [
                  ...new TextEncoder().encode(
                    JSON.stringify({
                      abi_version: config.abiVersion,
                      executor_code_hash: config.executorCodeHash,
                      template_hashes: config.templateHashes,
                    }),
                  ),
                ],
              };
      return new Response(JSON.stringify({ result }), { status: 200 });
    });
    return {
      fetch,
      client: new WritClient({ ...config, rpcUrl: "https://localhost", fetch }),
    };
  }
  it("verifies a mainnet collection before any NFT exists, using reads only", async () => {
    const { client, fetch } = fixture();
    expect(await client.verifyDeployment()).toEqual({
      hash: "final-block",
      height: "123",
    });
    const calls = fetch.mock.calls.map(([, init]) =>
      JSON.parse(String(init?.body)),
    );
    expect(calls.map((x) => x.method)).toEqual(["status", "query", "query"]);
    expect(calls[2].params.block_id).toBe("final-block");
    expect(calls[2].params.account_id).toBe("writ.team.near");
  });
  it("rejects a wrong network before inspecting contracts and rejects replaced bytecode", async () => {
    const mismatch = fixture("testnet");
    await expect(mismatch.client.verifyDeployment()).rejects.toThrow("network");
    expect(mismatch.fetch).toHaveBeenCalledTimes(1);
    await expect(
      fixture("mainnet", "different-code").client.verifyDeployment(),
    ).rejects.toThrow("code changed");
  });
});
