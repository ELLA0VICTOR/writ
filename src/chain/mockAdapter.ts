import type { WritAdapter } from "./adapter";
import type {
  BuyRequest,
  HistoryEntry,
  MockScenario,
  PurchaseState,
  WalletSession,
  Writ,
} from "./types";
import { initialWrits, exampleHistory } from "./fixtures/writs";
import { getTemplate, templates } from "../templates/registry";
import { mockChecks } from "./checks";
import { ChainError } from "./errors";
import { isAccountId, nearToYocto } from "../utils/amounts";

const clone = <T>(value: T): T => structuredClone(value);
export function createMockAdapter(): WritAdapter {
  let writs = initialWrits();
  let session: WalletSession | null = null;
  let scenario: MockScenario = "clean";
  let block = 196;
  let serial = 0;
  const purchases = new Map<
    string,
    {
      request: BuyRequest;
      buyer: string;
      seller: string;
      phase: number;
      state?: PurchaseState;
      scenario: MockScenario;
    }
  >();
  const histories = new Map<string, HistoryEntry[]>();
  const read = () => ({
    blockHeight: String(++block),
    blockHash: `example-block-${block}`,
    observedAtMs: Date.now(),
    source: "mock" as const,
  });
  const tx = () => ({ mock: true as const });
  function get(id: string): Writ {
    const writ = writs.find((w) => w.id === String(Number(id)));
    if (!writ)
      throw new ChainError(
        "not_found",
        "No example Writ with that number exists.",
      );
    return writ;
  }
  function connected(): string {
    if (!session)
      throw new ChainError("unauthorized", "Connect an example wallet first.");
    return session.accountId;
  }
  function holder(id: string, allowListed = false): Writ {
    const writ = get(id);
    if (writ.owner !== connected())
      throw new ChainError(
        "unauthorized",
        "Only the current holder can do this.",
      );
    if (writ.status === "locked" || (!allowListed && writ.status === "listed"))
      throw new ChainError(
        "busy",
        "Paused while listed or while a sale is being checked.",
      );
    return writ;
  }
  function event(
    writ: Writ,
    name: string,
    detail: string,
    refused = false,
  ): void {
    const history = histories.get(writ.id) ?? clone(exampleHistory);
    history.push({
      id: `event-${++serial}`,
      at: new Date().toISOString(),
      event: name,
      detail,
      actor: session?.accountId ?? "writ-demo.testnet",
      refused,
    });
    histories.set(writ.id, history);
  }
  function mutate(writ: Writ): void {
    writ.nonce = String(BigInt(writ.nonce) + 1n);
  }
  return {
    mode: "mock",
    contractId: "writ-demo.testnet",
    capabilities: {
      execute: true,
      lend: true,
      list: true,
      withdraw: true,
      unwrap: true,
      wrap: true,
    },
    async getSession() {
      return session;
    },
    async getWalletOptions() {
      return [];
    },
    async connect(accountId = "ben.testnet") {
      session = { accountId };
      return session;
    },
    async disconnect() {
      session = null;
    },
    async getSpendableBalance() {
      return scenario === "insufficient" ? "0" : nearToYocto("100");
    },
    async getPurchaseFeeAllowance() {
      return nearToYocto("0.03");
    },
    async getTemplates() {
      return clone(templates.filter((t) => t.id === "contract-owner"));
    },
    async getWrit(id) {
      try {
        return clone(get(id));
      } catch {
        return null;
      }
    },
    async listWrits(query) {
      return {
        items: clone(
          writs.filter(
            (w) =>
              (!query.owner || w.owner === query.owner) &&
              (!query.listedOnly ||
                w.status === "listed" ||
                w.status === "locked"),
          ),
        ),
      };
    },
    async readChecks(id) {
      const writ = get(id);
      const snapshot = read();
      return {
        rows: mockChecks(writ, getTemplate(writ.templateId), snapshot),
        read: snapshot,
      };
    },
    async getHistory(id) {
      get(id);
      return {
        entries: clone(histories.get(String(Number(id))) ?? exampleHistory),
        source: "mock",
      };
    },
    async buy(request) {
      const buyer = connected();
      const writ = get(request.writId);
      if (scenario === "rejected")
        throw new ChainError(
          "wallet_rejected",
          "You declined the example wallet request. Your conditions have been kept.",
        );
      if (
        scenario === "changed" ||
        request.expectedNonce !== writ.nonce ||
        request.expectedTemplateHash !== writ.templateHash
      )
        throw new ChainError(
          "version_changed",
          "This Writ changed while you were looking. Review the new state before paying.",
        );
      if (scenario === "busy" || writ.status === "locked")
        throw new ChainError(
          "busy",
          "Another purchase is being checked. Try again in a moment.",
        );
      if (scenario === "insufficient")
        throw new ChainError(
          "insufficient_balance",
          "Your available balance does not cover this purchase and transaction fees.",
        );
      if (writ.owner === buyer)
        throw new ChainError("invalid_input", "You already hold this Writ.");
      if (
        writ.status !== "listed" ||
        !writ.price ||
        BigInt(writ.price) > BigInt(request.maximumPrice)
      )
        throw new ChainError(
          "version_changed",
          "The listing changed. Review its current price.",
        );
      if (scenario === "proposed") writ.proposedOwner = "ada-alt.testnet";
      if (scenario === "pending") writ.pendingCalls = 1;
      const attemptId = `example-attempt-${++serial}`;
      purchases.set(attemptId, {
        request: clone(request),
        buyer,
        seller: writ.owner,
        phase: 0,
        scenario,
      });
      writ.status = "locked";
      writ.saleDeadlineBlock = String(block + 200);
      return { ...tx(), writId: writ.id, attemptId };
    },
    async getPurchase(handle) {
      const attempt = purchases.get(handle.attemptId);
      if (!attempt)
        throw new ChainError(
          "outcome_unknown",
          "The example purchase could not be found. Reset the examples to start again.",
        );
      if (attempt.state) return clone(attempt.state);
      const writ = get(handle.writId);
      if (attempt.scenario === "unknown")
        throw new ChainError(
          "outcome_unknown",
          "The purchase was submitted, but its outcome is not confirmed. Check this same purchase again.",
        );
      if (attempt.scenario === "stuck") return { status: "releasable" };
      if (attempt.phase++ === 0)
        return { status: "checking", deadlineBlock: writ.saleDeadlineBlock! };
      const snapshot = read();
      const rows = mockChecks(
        writ,
        getTemplate(writ.templateId),
        snapshot,
      ).filter((r) => r.enforcedBy === "sale");
      for (const pin of attempt.request.pins) {
        if (pin.id !== "minimum_balance")
          throw new ChainError("invalid_input", "Unknown condition.");
        rows.push({
          id: pin.id,
          label: "Minimum executor balance",
          method: "get_balance",
          actual: writ.balance,
          expected: pin.value,
          result: BigInt(writ.balance) >= BigInt(pin.value) ? "pass" : "fail",
          enforcedBy: "sale",
          read: snapshot,
        });
      }
      if (rows.some((r) => r.result !== "pass")) {
        writ.status = "listed";
        attempt.state = {
          status: "refused",
          checks: rows,
          refundStatus: "claimable",
        };
        event(
          writ,
          "Purchase refused",
          rows.find((r) => r.result === "fail")!.label,
          true,
        );
      } else {
        const ended = writ.loans.map((l) => l.id);
        const price = writ.price!;
        writ.owner = attempt.buyer;
        writ.epoch = String(BigInt(writ.epoch) + 1n);
        mutate(writ);
        writ.status = "held";
        writ.price = null;
        writ.loans = [];
        attempt.state = {
          status: "settled",
          holder: attempt.buyer,
          seller: attempt.seller,
          price,
          endedLoanIds: ended,
          sellerPayment: "claimable",
        };
        event(
          writ,
          "Sale settled",
          `Control passed from ${attempt.seller}; ${ended.length} loans ended`,
        );
      }
      return clone(attempt.state);
    },
    async releaseStuck(handle) {
      const attempt = purchases.get(handle.attemptId);
      if (!attempt || attempt.scenario !== "stuck" || attempt.state)
        throw new ChainError(
          "invalid_input",
          "This purchase cannot be released.",
        );
      get(handle.writId).status = "listed";
      attempt.state = { status: "released", refundStatus: "claimable" };
      return tx();
    },
    async claimRefund(handle) {
      const attempt = purchases.get(handle.attemptId);
      if (
        !attempt ||
        connected() !== attempt.buyer ||
        !attempt.state ||
        !["refused", "released"].includes(attempt.state.status)
      )
        throw new ChainError(
          "unauthorized",
          "No refund is available to this wallet.",
        );
      if (
        attempt.state.status === "refused" ||
        attempt.state.status === "released"
      ) {
        if (attempt.state.refundStatus !== "claimable")
          throw new ChainError(
            "invalid_input",
            "This refund has already been claimed.",
          );
        attempt.state.refundStatus = "paid";
      }
      return tx();
    },
    async execute(request) {
      const writ = get(request.writId);
      const actor = connected();
      if (writ.status === "listed" || writ.status === "locked")
        throw new ChainError("busy", "Using the role is paused while listed.");
      const action = getTemplate(writ.templateId).actions.find(
        (a) => a.method === request.method,
      );
      if (!action)
        throw new ChainError(
          "invalid_input",
          "This action is not declared by the template.",
        );
      if (BigInt(request.deposit) > BigInt(action.maxDeposit))
        throw new ChainError(
          "invalid_input",
          "The deposit exceeds this action’s cap.",
        );
      if (
        actor !== writ.owner &&
        !writ.loans.some(
          (l) =>
            l.borrower === actor &&
            l.method === request.method &&
            l.epoch === writ.epoch &&
            Date.parse(l.expiresAt) > Date.now() &&
            JSON.stringify(l.args) === JSON.stringify(request.args) &&
            BigInt(request.deposit) <= BigInt(l.maxDeposit),
        )
      )
        throw new ChainError(
          "unauthorized",
          "This wallet has no current permission for these exact arguments.",
        );
      if (request.method === "own_propose_owner")
        writ.proposedOwner = request.args.account_id as string | null;
      mutate(writ);
      event(writ, "Role used", request.method);
      return tx();
    },
    async lend(request) {
      const writ = holder(request.writId);
      const action = getTemplate(writ.templateId).actions.find(
        (a) => a.method === request.method && a.lendable,
      );
      if (
        !action ||
        !isAccountId(request.borrower) ||
        Date.parse(request.expiresAt) <= Date.now() ||
        !Number.isFinite(Date.parse(request.expiresAt))
      )
        throw new ChainError(
          "invalid_input",
          "Choose a lendable method, a valid borrower, and a future expiry.",
        );
      if (BigInt(request.maxDeposit) > BigInt(action.maxDeposit))
        throw new ChainError(
          "invalid_input",
          "This loan exceeds the declared deposit cap.",
        );
      writ.loans.push({
        ...request,
        id: `loan-${++serial}`,
        epoch: writ.epoch,
      });
      writ.status = "lent";
      mutate(writ);
      event(writ, "Method lent", `${request.method} to ${request.borrower}`);
      return tx();
    },
    async endLoan(id, loanId) {
      const writ = holder(id);
      writ.loans = writ.loans.filter((l) => l.id !== loanId);
      writ.status = writ.loans.length ? "lent" : "held";
      mutate(writ);
      event(writ, "Loan ended", loanId);
      return tx();
    },
    async setListing(request) {
      const writ = holder(request.writId, true);
      if (writ.pendingCalls)
        throw new ChainError(
          "busy",
          "Wait for all calls in flight to finish before listing.",
        );
      if (writ.nonce !== request.expectedNonce)
        throw new ChainError(
          "version_changed",
          "This Writ changed. Read it again before listing.",
        );
      if (BigInt(request.price) <= 0n)
        throw new ChainError(
          "invalid_input",
          "Enter a price greater than zero.",
        );
      writ.status = "listed";
      writ.price = request.price;
      mutate(writ);
      event(writ, "Listed for sale", "The executor is paused");
      return tx();
    },
    async removeListing(id) {
      const writ = holder(id, true);
      writ.status = writ.loans.length ? "lent" : "held";
      writ.price = null;
      mutate(writ);
      event(writ, "Listing removed", "Holder actions resumed");
      return tx();
    },
    async withdrawFees(id, amount) {
      const writ = holder(id);
      if (
        BigInt(amount) <= 0n ||
        BigInt(amount) > BigInt(writ.withdrawableFees)
      )
        throw new ChainError(
          "invalid_input",
          "The amount exceeds available fees.",
        );
      writ.withdrawableFees = (
        BigInt(writ.withdrawableFees) - BigInt(amount)
      ).toString();
      writ.balance = (BigInt(writ.balance) - BigInt(amount)).toString();
      mutate(writ);
      event(writ, "Fees withdrawn", "Paid to current holder");
      return tx();
    },
    async inspectWrap(request) {
      if (!isAccountId(request.target))
        throw new ChainError("invalid_input", "Enter a valid NEAR account.");
      connected();
      return {
        holder: request.target.startsWith("other")
          ? "other.testnet"
          : connected(),
        isCurrentHolder: !request.target.startsWith("other"),
        read: read(),
      };
    },
    async mintWrit(request) {
      const owner = connected();
      const id = String(100 + writs.length);
      const executor = `w${id}.writ-demo.testnet`;
      const writ: Writ = {
        ...clone(initialWrits()[0]),
        id,
        target: request.target,
        owner,
        executor,
        roleOwner: owner,
        status: "held",
        price: null,
        nonce: "0",
        epoch: "0",
        balance: nearToYocto("3"),
        withdrawableFees: "0",
      };
      writs.push(writ);
      histories.set(id, []);
      event(writ, "Writ minted", "Executor provisioned without keys");
      return { ...tx(), writ: clone(writ) };
    },
    async performWrapStep(request) {
      const writ = holder(request.writId);
      if (request.step === 0) writ.proposedOwner = writ.executor;
      else if (request.step === 1 && writ.proposedOwner === writ.executor) {
        writ.roleOwner = writ.executor;
        writ.proposedOwner = null;
      } else
        throw new ChainError(
          "invalid_input",
          "Complete the ownership proposal first.",
        );
      mutate(writ);
      event(writ, "Wrap step completed", String(request.step + 1));
      return tx();
    },
    async unwrap(id) {
      const writ = holder(id);
      if (writ.loans.length)
        throw new ChainError("busy", "End the loans before unwrapping.");
      writ.roleOwner = connected();
      event(writ, "Role unwrapped", "Role returned to holder");
      writs = writs.filter((w) => w.id !== id);
      return tx();
    },
    setMockScenario(value) {
      scenario = value;
    },
    resetMock() {
      writs = initialWrits();
      session = null;
      scenario = "clean";
      purchases.clear();
      histories.clear();
      if (typeof sessionStorage !== "undefined") {
        for (const key of Object.keys(sessionStorage))
          if (key.startsWith("writ-purchase:mock:"))
            sessionStorage.removeItem(key);
      }
    },
  };
}
