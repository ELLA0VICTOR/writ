import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import type { JsonValue, Writ } from "../../chain/types";
import { useAdapter, useChain } from "../../hooks/useChain";
import { getTemplate } from "../../templates/registry";
import { formatNear, isAccountId, nearToYocto } from "../../utils/amounts";
import { messageOf } from "../../chain/errors";
import { Dialog } from "../../components/Dialog/Dialog";
import { Button } from "../../components/Button/Button";
import { DisclosedBox } from "../../components/DisclosedBox/DisclosedBox";
export type ActionKind = "use" | "lend" | "list" | "withdraw" | "unwrap" | "transfer" | "fund";
export function ActionDialog({
  kind,
  writ,
  onClose,
  onDone,
}: {
  kind: ActionKind;
  writ: Writ;
  onClose: () => void;
  onDone: () => void;
}) {
  const adapter = useAdapter();
  const { changed, mode, session } = useChain();
  const navigate = useNavigate();
  const template = getTemplate(writ.templateId);
  const ownLoan = writ.loans.find(
    (l) =>
      l.borrower === session?.accountId &&
      l.epoch === writ.epoch &&
      Date.parse(l.expiresAt) > Date.now(),
  );
  const choices = template.actions
    .filter((a) => kind !== "lend" || a.lendable)
    .filter(
      (a) => session?.accountId === writ.owner || a.method === ownLoan?.method,
    );
  const [method, setMethod] = useState(choices[0]?.method ?? "");
  const [args, setArgs] = useState(
    JSON.stringify(ownLoan?.args ?? choices[0]?.args ?? {}, null, 2),
  );
  const [price, setPrice] = useState(
    formatNear(writ.price ?? nearToYocto("40")),
  );
  const [borrower, setBorrower] = useState("");
  const [receiver, setReceiver] = useState("");
  const [expiry, setExpiry] = useState("");
  const [amount, setAmount] = useState(formatNear(writ.withdrawableFees));
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const title = {
    use: "Use the role",
    lend: "Lend a method",
    list: writ.status === "listed" ? "Change listing" : "List for sale",
    withdraw: "Withdraw fees",
    unwrap: "Unwrap the role",
    transfer: "Transfer the Writ",
    fund: "Fund the executor",
  }[kind];
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!adapter) return;
    setBusy(true);
    setError("");
    try {
      if (kind === "list")
        await adapter.setListing({
          writId: writ.id,
          price: nearToYocto(price),
          expectedNonce: writ.nonce,
        });
      if (kind === "withdraw")
        await adapter.withdrawFees(writ.id, nearToYocto(amount));
      if(kind==="fund") await adapter.fundExecutor(writ.id,nearToYocto(amount));
      if(kind==="transfer") {
        if(!confirmed||!isAccountId(receiver)||receiver===writ.owner)throw new Error("Confirm a different, valid receiving account.");
        await adapter.transfer(writ.id,receiver);
      }
      if (kind === "use" || kind === "lend") {
        const parsed = JSON.parse(args) as unknown;
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
          throw new Error("Arguments must be a JSON object.");
        if (kind === "use")
          await adapter.execute({
            writId: writ.id,
            method,
            args: parsed as Record<string, JsonValue>,
            deposit: "0",
          });
        else {
          if (!isAccountId(borrower))
            throw new Error("Enter a valid borrower account.");
          const expiresAt = new Date(expiry + "Z");
          if (
            !Number.isFinite(expiresAt.getTime()) ||
            expiresAt.getTime() <= Date.now()
          )
            throw new Error("Choose a future expiry in UTC.");
          await adapter.lend({
            writId: writ.id,
            method,
            args: parsed as Record<string, JsonValue>,
            borrower,
            maxDeposit: "0",
            expiresAt: expiresAt.toISOString(),
          });
        }
      }
      if (kind === "unwrap") {
        if (!confirmed)
          throw new Error("Confirm that you understand what will move.");
        await adapter.unwrap(writ.id);
        navigate(`/app${mode === "mock" ? "?mock=1" : ""}`);
      }
      changed();
      onDone();
      onClose();
    } catch (reason) {
      setError(messageOf(reason));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog title={title} onClose={onClose}>
      <form onSubmit={(event) => void submit(event)}>
        <div>
          <p className="sectionLabel">Current holder permissions</p>
          <h3>{title}.</h3>
          <p>
            Role on <code>{writ.target}</code>, held through{" "}
            <code>{writ.executor}</code>.
          </p>
        </div>
        {kind === "list" && (
          <>
            <label>
              Asking price in NEAR
              <input
                className="typed"
                inputMode="decimal"
                required
                value={price}
                onChange={(e) => setPrice(e.target.value)}
              />
            </label>
            <p>
              Listing pauses role use, lending, withdrawals and unwrapping.
              Changing the price advances the version and invalidates earlier
              buyer offers.
            </p>
          </>
        )}
        {(kind === "use" || kind === "lend") && (
          <>
            <label>
              Method
              <select
                value={method}
                onChange={(e) => {
                  setMethod(e.target.value);
                  setArgs(
                    JSON.stringify(
                      choices.find((a) => a.method === e.target.value)?.args ??
                        {},
                      null,
                      2,
                    ),
                  );
                }}
              >
                {choices.map((action) => (
                  <option key={action.method} value={action.method}>
                    {action.method}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Exact JSON arguments
              <textarea
                className="typed"
                rows={4}
                required
                value={args}
                onChange={(e) => setArgs(e.target.value)}
              />
            </label>
            <p className="quiet">
              Attached deposit: <code>0 NEAR</code>. The template does not
              permit a larger deposit for these actions.
            </p>
          </>
        )}
        {kind === "lend" && (
          <>
            <label>
              Borrower account
              <input
                className="typed"
                autoComplete="off"
                required
                placeholder="sam.testnet"
                value={borrower}
                onChange={(e) => setBorrower(e.target.value)}
              />
            </label>
            <label>
              Expiry in UTC
              <input
                type="datetime-local"
                required
                value={expiry}
                onChange={(e) => setExpiry(e.target.value)}
              />
            </label>
            <DisclosedBox compact>
              The borrower can use this method only with the exact arguments and
              deposit cap shown here. A sale ends the loan. A loan does not
              grant an access key.
            </DisclosedBox>
          </>
        )}
        {kind === "withdraw" && (
          <>
            <p>
              Available fees:{" "}
              <code>{formatNear(writ.withdrawableFees)} NEAR</code>. Storage
              reserves are excluded.
            </p>
            <label>
              NEAR to withdraw
              <input
                className="typed"
                inputMode="decimal"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </label>
          </>
        )}
        {kind === "fund" && <label>NEAR to add<input className="typed" inputMode="decimal" required value={amount} onChange={e=>setAmount(e.target.value)}/></label>}
        {kind === "transfer" && <>
          <label>Receiving account<input className="typed" required autoComplete="off" placeholder="sam.testnet" value={receiver} onChange={e=>setReceiver(e.target.value)}/></label>
          <DisclosedBox compact>The NFT, executor control and its remaining balance move together. Every existing loan ends. This direct transfer has no purchase price or buyer settlement checks. The receiving account must exist.</DisclosedBox>
          <label><input type="checkbox" required checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/> Transfer control to this account.</label>
        </>}
        {kind === "unwrap" && (
          <>
            <DisclosedBox compact>
              Unwrapping is supported only by a template-specific hand-back
              recipe. It must verify the external role moved before retiring the
              NFT. End outstanding loans first.
              Your wallet will approve the hand-back, accept the role, then verify retirement. If interrupted, reopen Unwrap to resume. Remaining executor funds can be recovered from My Writs after retirement.
            </DisclosedBox>
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                fontSize: 14,
              }}
            >
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
                required
              />
              Return this role to my wallet and retire its Writ.
            </label>
          </>
        )}
        {error && (
          <p className="errorText" role="alert">
            {error}
          </p>
        )}
        {mode === "mock" && (
          <small>Example action. No blockchain transaction is sent.</small>
        )}
        <footer>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            type="submit"
            disabled={
              busy ||
              !adapter ||
              ((kind === "use" || kind === "lend") && !choices.length)
            }
          >
            {busy ? "Waiting for the outcome…" : title}
          </Button>
        </footer>
      </form>
    </Dialog>
  );
}
