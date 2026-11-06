export type ChainErrorCode =
  | "wallet_rejected"
  | "version_changed"
  | "busy"
  | "insufficient_balance"
  | "rpc_unavailable"
  | "not_configured"
  | "not_found"
  | "unauthorized"
  | "invalid_input"
  | "outcome_unknown";
export class ChainError extends Error {
  readonly code: ChainErrorCode;
  constructor(code: ChainErrorCode, message: string) {
    super(message);
    this.name = "ChainError";
    this.code = code;
  }
}
export class PurchaseSubmissionError extends ChainError {
  readonly handle: PurchaseHandle;
  constructor(handle: PurchaseHandle) {
    super(
      "outcome_unknown",
      "The wallet request has no confirmed outcome. Check this purchase attempt and your wallet activity before paying again.",
    );
    this.handle = handle;
  }
}
export function messageOf(error: unknown): string {
  if (error instanceof ChainError) return error.message;
  return error instanceof Error
    ? error.message
    : "Something interrupted the request. Please try again.";
}
import type { PurchaseHandle } from "./types";
