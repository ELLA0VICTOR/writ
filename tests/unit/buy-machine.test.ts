import { describe, it, expect } from "vitest";
import { buyReducer, type BuyState } from "../../src/features/buy/machine";
const handle = { mock: true, writId: "7", attemptId: "example-1" };
describe("purchase states", () => {
  for (const code of [
    "wallet_rejected",
    "version_changed",
    "busy",
    "insufficient_balance",
  ] as const)
    it(`returns to conditions for ${code}`, () => {
      const result = buyReducer(
        { step: "signing" },
        { type: "error", code, message: "Example reason" },
      );
      expect(result).toEqual({
        step: "pins",
        errorCode: code,
        error: "Example reason",
      });
    });
  it("tracks a signed attempt and does not settle on submission", () => {
    let state = buyReducer({ step: "pins" }, { type: "submit" });
    state = buyReducer(state, { type: "signed", handle });
    expect(state).toEqual({ step: "reading", handle });
    expect(
      buyReducer(state, {
        type: "outcome",
        value: { status: "checking", deadlineBlock: "200" },
      }),
    ).toBe(state);
  });
  it("retains the attempt on unknown outcomes", () => {
    const state = buyReducer(
      { step: "reading", handle },
      { type: "error", code: "rpc_unavailable", message: "Read interrupted" },
    );
    expect(state).toEqual({
      step: "unknown",
      handle,
      message: "Read interrupted",
    });
    expect(buyReducer(state, { type: "retry" })).toEqual({
      step: "reading",
      handle,
    });
  });
  it("releases only an eligible purchase", () => {
    const state: BuyState = {
      step: "result",
      handle,
      outcome: { status: "releasable" },
    };
    expect(
      buyReducer(state, {
        type: "outcome",
        value: { status: "released", refundStatus: "claimable" },
      }),
    ).toMatchObject({ outcome: { status: "released" } });
  });
  it("ignores late contradictory outcomes after a refusal", () => {
    const state: BuyState = {
      step: "result",
      handle,
      outcome: { status: "refused", checks: [], refundStatus: "claimable" },
    };
    expect(
      buyReducer(state, {
        type: "outcome",
        value: {
          status: "settled",
          holder: "ben",
          seller: "ada",
          price: "40",
          endedLoanIds: [],
          sellerPayment: "claimable",
        },
      }),
    ).toBe(state);
  });
  it("cannot start a second payment from an unconfirmed attempt", () => {
    const state: BuyState = {
      step: "unknown",
      handle,
      message: "Still checking",
    };
    expect(buyReducer(state, { type: "submit" })).toBe(state);
  });
});
