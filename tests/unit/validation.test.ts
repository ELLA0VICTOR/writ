import { describe, it, expect } from "vitest";
import { parseWrit, parsePurchase } from "../../src/chain/validation";
import { exampleWrit } from "../../src/chain/fixtures/writs";
describe("untrusted RPC data", () => {
  it("accepts a complete supported Writ shape", () => {
    expect(parseWrit(exampleWrit)).toEqual(exampleWrit);
  });
  it("rejects misleading listing and balance fields", () => {
    for (const patch of [
      { price: null },
      { withdrawableFees: "999999999999999999999999999999" },
      { pendingCalls: -1 },
      { loans: [{}] },
      { owner: "https://not-an-account" },
    ])
      expect(() => parseWrit({ ...exampleWrit, ...patch })).toThrow();
  });
  it("does not accept a success label without settlement data", () => {
    expect(() => parsePurchase({ status: "settled" })).toThrow();
    expect(() =>
      parsePurchase({ status: "released", refundStatus: "sent-maybe" }),
    ).toThrow();
  });
  it("rejects a refusal whose checks all passed", () => {
    expect(() =>
      parsePurchase({ status: "refused", checks: [], refundStatus: "paid" }),
    ).toThrow();
  });
});
