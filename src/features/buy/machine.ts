import type { PurchaseHandle, PurchaseState } from "../../chain/types";
import type { ChainErrorCode } from "../../chain/errors";
export type BuyState =
  | { step: "pins"; error?: string; errorCode?: ChainErrorCode }
  | { step: "signing" }
  | { step: "reading"; handle: PurchaseHandle }
  | { step: "unknown"; handle: PurchaseHandle; message: string }
  | {
      step: "result";
      handle: PurchaseHandle;
      outcome: Exclude<PurchaseState, { status: "checking" }>;
    };
export type BuyEvent =
  | { type: "submit" }
  | { type: "signed"; handle: PurchaseHandle }
  | { type: "error"; code: ChainErrorCode; message: string }
  | { type: "outcome"; value: PurchaseState }
  | { type: "retry" }
  | { type: "review" };
export function buyReducer(state: BuyState, event: BuyEvent): BuyState {
  switch (event.type) {
    case "submit":
      return state.step === "pins" ? { step: "signing" } : state;
    case "signed":
      return state.step === "signing"
        ? { step: "reading", handle: event.handle }
        : state;
    case "error": {
      if (state.step === "reading" || state.step === "unknown")
        return {
          step: "unknown",
          handle: state.handle,
          message: event.message,
        };
      if (state.step === "signing")
        return { step: "pins", error: event.message, errorCode: event.code };
      return state;
    }
    case "outcome": {
      if (!("handle" in state)) return state;
      if (state.step === "result") {
        const prior = state.outcome.status;
        if (prior === "settled") return state;
        if (prior === "releasable" && event.value.status !== "released")
          return state;
        if (
          (prior === "refused" || prior === "released") &&
          event.value.status !== prior
        )
          return state;
      }
      if (event.value.status === "checking") return state;
      return { step: "result", handle: state.handle, outcome: event.value };
    }
    case "retry":
      return state.step === "unknown"
        ? { step: "reading", handle: state.handle }
        : state;
    case "review":
      return state.step === "pins" ? { step: "pins" } : state;
  }
}
