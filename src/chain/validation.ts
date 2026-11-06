import { ChainError } from "./errors";
import type {
  CheckResult,
  HistoryPage,
  JsonValue,
  PurchaseState,
  Writ,
} from "./types";
import { isAccountId } from "../utils/amounts";
export function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw invalid();
  return value as Record<string, unknown>;
}
const integer = (value: unknown): value is string =>
  typeof value === "string" && /^\d{1,78}$/.test(value);
const text = (value: unknown): value is string =>
  typeof value === "string" && value.length <= 4096;
const account = (value: unknown): value is string =>
  typeof value === "string" && isAccountId(value);
function invalid() {
  return new ChainError(
    "rpc_unavailable",
    "The contract response does not match the configured ABI. No successful outcome has been assumed.",
  );
}
export function parseWrit(value: unknown): Writ | null {
  if (value === null) return null;
  const w = record(value);
  for (const key of ["id", "epoch", "nonce", "balance", "withdrawableFees"])
    if (!integer(w[key])) throw invalid();
  for (const key of ["collection", "owner", "executor", "target", "roleOwner"])
    if (!account(w[key])) throw invalid();
  for (const key of ["templateId", "templateHash", "executorCodeHash"])
    if (!text(w[key]) || !w[key]) throw invalid();
  if (
    !["held", "listed", "locked", "lent"].includes(String(w.status)) ||
    !Number.isSafeInteger(w.pendingCalls) ||
    Number(w.pendingCalls) < 0 ||
    !(w.proposedOwner === null || account(w.proposedOwner)) ||
    !(w.price === null || integer(w.price)) ||
    !Array.isArray(w.loans) ||
    !Array.isArray(w.tokens) ||
    !Array.isArray(w.accessKeys)
  )
    throw invalid();
  if (w.loans.length > 64 || w.tokens.length > 256 || w.accessKeys.length > 100)
    throw invalid();
  if (w.status === "listed" && (!integer(w.price) || BigInt(w.price) <= 0n))
    throw invalid();
  if (BigInt(w.withdrawableFees as string) > BigInt(w.balance as string))
    throw invalid();
  for (const loan of w.loans) {
    const l = record(loan);
    if (
      !text(l.id) ||
      !account(l.borrower) ||
      !text(l.method) ||
      !integer(l.maxDeposit) ||
      !integer(l.epoch) ||
      !text(l.expiresAt) ||
      !Number.isFinite(Date.parse(l.expiresAt))
    )
      throw invalid();
    record(l.args);
  }
  for (const token of w.tokens) {
    const t = record(token);
    if (!text(t.symbol) || !text(t.amount)) throw invalid();
  }
  if (!w.accessKeys.every(text)) throw invalid();
  return w as unknown as Writ;
}
export function parseHistory(value: unknown): HistoryPage {
  const h = record(value);
  if (!Array.isArray(h.entries) || h.entries.length > 100) throw invalid();
  for (const entry of h.entries) {
    const e = record(entry);
    for (const key of ["id", "at", "event", "actor", "detail"])
      if (!text(e[key])) throw invalid();
    if (!Number.isFinite(Date.parse(e.at as string))) throw invalid();
    if (e.transactionHash !== undefined && !text(e.transactionHash))
      throw invalid();
  }
  return { ...h, source: "contract" } as unknown as HistoryPage;
}
function parseCheck(value: unknown): CheckResult {
  const c = record(value);
  for (const key of ["id", "label", "method"])
    if (!text(c[key])) throw invalid();
  if (
    !["pass", "fail", "unavailable"].includes(String(c.result)) ||
    !["sale", "page"].includes(String(c.enforcedBy))
  )
    throw invalid();
  const r = record(c.read);
  if (
    !integer(r.blockHeight) ||
    !(
      text(r.blockHash) ||
      (r.blockHash === null && r.phase === "settlement_callback")
    ) ||
    typeof r.observedAtMs !== "number" ||
    !Number.isFinite(r.observedAtMs) ||
    r.source !== "testnet"
  )
    throw invalid();
  return c as unknown as CheckResult;
}
export function parsePurchase(value: unknown): PurchaseState {
  const p = record(value);
  if (p.status === "refused" || p.status === "released") {
    if (!["pending", "claimable", "paid"].includes(String(p.refundStatus)))
      throw invalid();
    if (p.refundTransactionHash !== undefined && !text(p.refundTransactionHash))
      throw invalid();
  }
  switch (p.status) {
    case "checking":
      if (!integer(p.deadlineBlock)) throw invalid();
      break;
    case "settled":
      if (
        !account(p.holder) ||
        !account(p.seller) ||
        !integer(p.price) ||
        !Array.isArray(p.endedLoanIds) ||
        !p.endedLoanIds.every(text) ||
        !["paid", "claimable", "credited"].includes(String(p.sellerPayment))
      )
        throw invalid();
      break;
    case "refused":
      if (!Array.isArray(p.checks) || p.checks.length > 16) throw invalid();
      p.checks = p.checks.map(parseCheck);
      if (!(p.checks as CheckResult[]).some((c) => c.result !== "pass"))
        throw invalid();
      break;
    case "released":
      break;
    case "releasable":
      break;
    default:
      throw invalid();
  }
  return p as unknown as PurchaseState;
}
export function jsonValue(value: unknown): JsonValue {
  if (value === null || typeof value === "boolean" || typeof value === "string")
    return value;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (Array.isArray(value)) return value.map(jsonValue);
  const result: Record<string, JsonValue> = {};
  for (const [key, item] of Object.entries(record(value)))
    Object.defineProperty(result, key, {
      value: jsonValue(item),
      enumerable: true,
    });
  return result;
}
