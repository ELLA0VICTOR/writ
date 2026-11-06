import { describe, it, expect } from "vitest";
import { createMockAdapter } from "../../src/chain/mockAdapter";
import { nearToYocto } from "../../src/utils/amounts";
describe("frontend mock behavioral contract (not a blockchain audit)", () => {
  it("invalidates the seller and borrower after a sale", async () => {
    const a = createMockAdapter();
    await a.connect("ada.testnet");
    await a.removeListing("7");
    await a.lend({
      writId: "7",
      borrower: "sam.testnet",
      method: "set_price",
      args: { price: "1" },
      maxDeposit: "0",
      expiresAt: "2099-01-01T00:00:00Z",
    });
    let w = (await a.getWrit("7"))!;
    await a.setListing({
      writId: "7",
      price: nearToYocto("40"),
      expectedNonce: w.nonce,
    });
    w = (await a.getWrit("7"))!;
    await a.connect("ben.testnet");
    const handle = await a.buy({
      writId: "7",
      expectedNonce: w.nonce,
      expectedTemplateHash: w.templateHash,
      maximumPrice: w.price!,
      pins: [],
    });
    await a.getPurchase(handle);
    expect(await a.getPurchase(handle)).toMatchObject({
      status: "settled",
      endedLoanIds: [expect.any(String)],
    });
    expect(await a.getWrit("7")).toMatchObject({
      owner: "ben.testnet",
      loans: [],
    });
    for (const account of ["ada.testnet", "sam.testnet"]) {
      await a.connect(account);
      await expect(
        a.execute({
          writId: "7",
          method: "set_price",
          args: { price: "1" },
          deposit: "0",
        }),
      ).rejects.toMatchObject({ code: "unauthorized" });
    }
  });
  it("authorizes a borrower only for exact arguments", async () => {
    const a = createMockAdapter();
    await a.connect("sam.testnet");
    await expect(
      a.execute({
        writId: "21",
        method: "set_price",
        args: { price: "100" },
        deposit: "0",
      }),
    ).rejects.toMatchObject({ code: "unauthorized" });
    await expect(
      a.execute({
        writId: "21",
        method: "set_price",
        args: { price: "1" },
        deposit: "0",
      }),
    ).resolves.toMatchObject({ mock: true });
  });
  it("refuses hidden proposals and prevents duplicate refund claims", async () => {
    const a = createMockAdapter();
    await a.connect();
    a.setMockScenario?.("proposed");
    const w = (await a.getWrit("7"))!;
    const handle = await a.buy({
      writId: "7",
      expectedNonce: w.nonce,
      expectedTemplateHash: w.templateHash,
      maximumPrice: w.price!,
      pins: [],
    });
    await a.getPurchase(handle);
    expect(await a.getPurchase(handle)).toMatchObject({
      status: "refused",
      refundStatus: "claimable",
    });
    await a.claimRefund(handle);
    await expect(a.claimRefund(handle)).rejects.toThrow("already been claimed");
    expect((await a.getWrit("7"))!.owner).toBe("ada.testnet");
  });
  it("checks a buyer balance pin independently of the owner predicate", async () => {
    const a = createMockAdapter();
    await a.connect();
    const w = (await a.getWrit("7"))!;
    const h = await a.buy({
      writId: "7",
      expectedNonce: w.nonce,
      expectedTemplateHash: w.templateHash,
      maximumPrice: w.price!,
      pins: [{ id: "minimum_balance", value: nearToYocto("99") }],
    });
    await a.getPurchase(h);
    expect(await a.getPurchase(h)).toMatchObject({ status: "refused" });
  });
  it("release invalidates an attempt so it cannot settle later", async () => {
    const a = createMockAdapter();
    await a.connect();
    a.setMockScenario?.("stuck");
    const w = (await a.getWrit("7"))!;
    const h = await a.buy({
      writId: "7",
      expectedNonce: w.nonce,
      expectedTemplateHash: w.templateHash,
      maximumPrice: w.price!,
      pins: [],
    });
    expect(await a.getPurchase(h)).toMatchObject({ status: "releasable" });
    await a.releaseStuck(h);
    expect(await a.getPurchase(h)).toMatchObject({ status: "released" });
    await expect(a.releaseStuck(h)).rejects.toThrow();
  });
});
