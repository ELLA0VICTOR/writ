import { describe, it, expect } from "vitest";
import { atPointer, mapCheck } from "../../src/chain/checks";
import { getTemplate } from "../../src/templates/registry";
import { exampleWrit } from "../../src/chain/fixtures/writs";
import type { ReadContext } from "../../src/chain/types";
const read: ReadContext = {
  blockHeight: "12",
  blockHash: "example",
  observedAtMs: 0,
  source: "mock",
};
describe("template mapping", () => {
  it("substitutes the executor for $WRIT", () => {
    const def = getTemplate("contract-owner").checks[0];
    expect(
      mapCheck(def, exampleWrit.executor, exampleWrit, read),
    ).toMatchObject({
      actual: exampleWrit.executor,
      expected: exampleWrit.executor,
      result: "pass",
      enforcedBy: "sale",
      read,
    });
  });
  it("does not treat a proposed owner as empty", () => {
    const def = getTemplate("contract-owner").checks[1];
    expect(mapCheck(def, "attacker.testnet", exampleWrit, read).result).toBe(
      "fail",
    );
    expect(mapCheck(def, null, exampleWrit, read).result).toBe("pass");
  });
  it("resolves escaped JSON pointers and rejects missing paths", () => {
    expect(
      atPointer({ "a/b": { "~c": ["member.testnet"] } }, "/a~1b/~0c/0"),
    ).toBe("member.testnet");
    expect(() => atPointer({}, "/missing")).toThrow();
  });
  it("does not coerce types for equality", () => {
    const def = getTemplate("contract-owner").checks[0];
    expect(
      mapCheck({ ...def, expected: "1" }, 1, exampleWrit, read).result,
    ).toBe("fail");
  });
});
