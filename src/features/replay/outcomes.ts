import { exampleWrit, exampleLoan } from "../../chain/fixtures/writs";
import { mockChecks } from "../../chain/checks";
import { getTemplate } from "../../templates/registry";
export type ReplayChoice = "none" | "proposed" | "pending" | "lent";
export const replayOptions: {
  id: ReplayChoice;
  label: string;
  detail: string;
}[] = [
  { id: "none", label: "Nothing", detail: "Ada leaves the role as it is." },
  {
    id: "proposed",
    label: "Proposes a next owner",
    detail: "ada-alt.testnet is waiting to accept.",
  },
  {
    id: "pending",
    label: "Starts a fee withdrawal, then lists",
    detail: "An outgoing call is still in flight.",
  },
  {
    id: "lent",
    label: "Lends set_price to Sam",
    detail: "sam.testnet gets a temporary, scoped action.",
  },
];
export function replayOutcome(choice: ReplayChoice) {
  const writ = structuredClone(exampleWrit);
  if (choice === "proposed") writ.proposedOwner = "ada-alt.testnet";
  if (choice === "pending") writ.pendingCalls = 1;
  if (choice === "lent") writ.loans = [exampleLoan];
  const rows = mockChecks(writ, getTemplate(writ.templateId), {
    blockHeight: "196",
    blockHash: "example-block-196",
    observedAtMs: 0,
    source: "mock",
  }).filter((r) => r.enforcedBy === "sale");
  const refused = rows.some((r) => r.result === "fail");
  return {
    rows,
    refused,
    word: refused ? "REFUSED" : "CLEAN",
    sentence:
      choice === "proposed"
        ? "Sale refused. A next owner is still proposed. Ben keeps his purchase funds."
        : choice === "pending"
          ? "Sale refused. A call is still in flight; this Writ cannot be listed yet."
          : choice === "lent"
            ? "Sale settled. Ben holds the Writ. Sam’s loan ended."
            : "Sale settled. Ben holds the Writ. Ada has no holder permission.",
  };
}
