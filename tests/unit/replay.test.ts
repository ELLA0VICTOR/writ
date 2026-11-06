import { describe, it, expect } from "vitest";
import { replayOutcome } from "../../src/features/replay/outcomes";
describe("landing purchase replay", () => {
  it("refuses a next-owner proposal", () => {
    const outcome = replayOutcome("proposed");
    expect(outcome.refused).toBe(true);
    expect(outcome.rows.find((r) => r.id === "proposed")).toMatchObject({
      actual: "ada-alt.testnet",
      expected: null,
      result: "fail",
    });
  });
  it("refuses a call in flight", () => {
    const outcome = replayOutcome("pending");
    expect(outcome.rows.find((r) => r.id === "pending")).toMatchObject({
      actual: 1,
      expected: 0,
      result: "fail",
    });
    expect(outcome.refused).toBe(true);
  });
  it("accepts the unchanged example", () => {
    expect(replayOutcome("none").rows.every((r) => r.result === "pass")).toBe(
      true,
    );
  });
  it("discloses that a sale ends the loan", () => {
    const outcome = replayOutcome("lent");
    expect(outcome.refused).toBe(false);
    expect(outcome.sentence).toContain("Sam’s loan ended");
  });
});
