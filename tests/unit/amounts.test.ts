import { it, expect } from "vitest";
import { nearToYocto, formatNear, isAccountId } from "../../src/utils/amounts";
it("preserves yoctoNEAR precision without floating point", () => {
  const amount = "340282366920938.463463374607431768211455";
  expect(formatNear(nearToYocto(amount))).toBe(amount);
  expect(nearToYocto("0.000000000000000000000001")).toBe("1");
  expect(() =>
    nearToYocto("340282366920938.463463374607431768211456"),
  ).toThrow();
});
it("rejects exponent, negative and excess-precision amounts", () => {
  for (const amount of ["1e3", "-1", "NaN", "1.0000000000000000000000001"])
    expect(() => nearToYocto(amount)).toThrow();
});
it("rejects path separators and URL-like account inputs", () => {
  expect(isAccountId("w7.writ-demo.testnet")).toBe(true);
  expect(isAccountId("https://evil.testnet")).toBe(false);
  expect(isAccountId("bad/../path")).toBe(false);
});
