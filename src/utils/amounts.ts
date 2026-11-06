const UNIT = 10n ** 24n;
export function nearToYocto(input: string): string {
  if (input.length > 64) throw new Error("The amount is too large.");
  if (!/^(0|[1-9]\d*)(\.\d{1,24})?$/.test(input))
    throw new Error(
      "Enter a non-negative NEAR amount with at most 24 decimal places.",
    );
  const [whole, fraction = ""] = input.split(".");
  const amount = BigInt(whole) * UNIT + BigInt(fraction.padEnd(24, "0"));
  if (amount > 2n ** 128n - 1n)
    throw new Error("The amount exceeds the NEAR contract integer limit.");
  return amount.toString();
}
export function formatNear(input: string): string {
  const amount = BigInt(input);
  const whole = amount / UNIT;
  const remainder = (amount % UNIT)
    .toString()
    .padStart(24, "0")
    .replace(/0+$/, "");
  return `${whole}${remainder ? `.${remainder}` : ""}`;
}
export const isAccountId = (value: string): boolean =>
  /^(?=.{2,64}$)[a-z0-9]+(?:[._-][a-z0-9]+)*$/.test(value);
export const writNumber = (id: string): string => id.padStart(4, "0");
export function utcDate(value: string): string {
  return (
    new Intl.DateTimeFormat("en-GB", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "UTC",
    }).format(new Date(value)) + " UTC"
  );
}
export function displayValue(value: unknown): string {
  if (value === null) return "None";
  if (Array.isArray(value) && value.length === 0) return "No keys";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}
