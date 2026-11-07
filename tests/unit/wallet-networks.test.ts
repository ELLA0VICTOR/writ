import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { releaseConfig } from "../../src/chain/deployment";
const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  sign: vi.fn(),
  options: [] as {
    network: string;
    storage: {
      get: (key: string) => Promise<string | null>;
      set: (key: string, value: string) => Promise<void>;
    };
  }[],
  endpoints: [] as string[],
}));
vi.mock("near-api-js", () => ({
  JsonRpcProvider: class {
    constructor(options: { url: string }) {
      mocks.endpoints.push(options.url);
    }
    sendJsonRpc = mocks.rpc;
  },
}));
vi.mock("@hot-labs/near-connect", () => ({
  NearConnector: class {
    constructor(options: (typeof mocks.options)[number]) {
      mocks.options.push(options);
    }
    on() {}
    wallet = async () => ({ signAndSendTransaction: mocks.sign });
    getConnectedWallet = async () => ({
      accounts: [{ accountId: "ben.near" }],
    });
  },
}));
import {
  getConnector,
  rememberWallet,
  walletCall,
  walletRequestPending,
  walletSession,
} from "../../src/chain/wallet";
const config = releaseConfig("mainnet", "writ.team.near");
beforeEach(() => {
  vi.clearAllMocks();
  mocks.endpoints.length = 0;
  const store = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => store.set(k, v),
    removeItem: (k: string) => store.delete(k),
  });
  vi.stubGlobal("window", new EventTarget());
  mocks.rpc.mockImplementation(async (method: string) =>
    method === "status"
      ? { chain_id: "mainnet" }
      : {
          status: { SuccessValue: "dHJ1ZQ==" },
          transaction: { hash: "confirmed", signer_id: "ben.near" },
        },
  );
  mocks.sign.mockResolvedValue({
    transaction: { hash: "confirmed", signer_id: "ben.near" },
  });
});
afterEach(() => vi.unstubAllGlobals());
it("selects mainnet wallet, RPC and FINAL confirmation without sending to a live network", async () => {
  expect(
    await walletCall(config.collection, "execute", {}, "0", config),
  ).toEqual({ hash: "confirmed", mock: false });
  expect(mocks.options.some((o) => o.network === "mainnet")).toBe(true);
  expect(mocks.endpoints).toEqual([config.rpcUrl]);
  expect(mocks.rpc).toHaveBeenLastCalledWith(
    "tx",
    expect.objectContaining({ wait_until: "FINAL", tx_hash: "confirmed" }),
  );
  expect(walletRequestPending()).toBe(false);
});
it("refuses a mismatched RPC before the wallet can sign", async () => {
  mocks.rpc.mockResolvedValue({ chain_id: "testnet" });
  await expect(
    walletCall(config.collection, "execute", {}, "0", config),
  ).rejects.toMatchObject({ code: "not_configured" });
  expect(mocks.sign).not.toHaveBeenCalled();
  expect(walletRequestPending()).toBe(false);
});
it("invalidates a stale preflight immediately before signing", async () => {
  let active = true;
  mocks.rpc.mockImplementation(async () => {
    active = false;
    return { chain_id: "mainnet" };
  });
  await expect(
    walletCall(config.collection, "execute", {}, "0", config, () => active),
  ).rejects.toMatchObject({ code: "not_configured" });
  expect(mocks.sign).not.toHaveBeenCalled();
});
it("isolates restored sessions and connector selection by network and collection", async () => {
  localStorage.setItem("writ-wallet-connected", "1");
  expect(await walletSession(config)).toBeNull();
  rememberWallet(config, true);
  expect(await walletSession(config)).toEqual({ accountId: "ben.near" });
  expect(
    await walletSession(releaseConfig("mainnet", "other.near")),
  ).toBeNull();
  expect(
    await walletSession(releaseConfig("testnet", config.collection)),
  ).toBeNull();
  await getConnector("testnet");
  const main = mocks.options.find((o) => o.network === "mainnet")!;
  const test = mocks.options.find((o) => o.network === "testnet")!;
  await main.storage.set("selected-wallet", "mainnet-wallet");
  expect(await test.storage.get("selected-wallet")).toBeNull();
  rememberWallet(config, false);
  expect(await walletSession(config)).toBeNull();
});
it("blocks a second signature while one request is outstanding and does not resubmit an unknown outcome", async () => {
  let finish!: (value: unknown) => void;
  mocks.sign.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const first = walletCall(config.collection, "execute", {}, "0", config);
  await vi.waitFor(() => expect(finish).toBeTypeOf("function"));
  expect(walletRequestPending()).toBe(true);
  await expect(
    walletCall(config.collection, "execute", {}, "0", config),
  ).rejects.toMatchObject({ code: "busy" });
  finish({ transaction: { hash: "confirmed", signer_id: "ben.near" } });
  await first;
  mocks.sign.mockRejectedValueOnce(new Error("Transport disconnected"));
  await expect(
    walletCall(config.collection, "execute", {}, "0", config),
  ).rejects.toMatchObject({ code: "outcome_unknown" });
  expect(mocks.sign).toHaveBeenCalledTimes(2);
  expect(walletRequestPending()).toBe(false);
});
