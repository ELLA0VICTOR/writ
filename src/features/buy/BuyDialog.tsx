import { useEffect, useReducer, useState, type FormEvent } from "react";
import type { Writ } from "../../chain/types";
import {
  ChainError,
  PurchaseSubmissionError,
  messageOf,
} from "../../chain/errors";
import { getTemplate } from "../../templates/registry";
import { formatNear, nearToYocto, writNumber } from "../../utils/amounts";
import { useAdapter, useChain } from "../../hooks/useChain";
import { Dialog } from "../../components/Dialog/Dialog";
import { Button } from "../../components/Button/Button";
import { Stamp } from "../../components/Stamp/Stamp";
import { CheckTable } from "../../components/CheckTable/CheckTable";
import { DisclosedBox } from "../../components/DisclosedBox/DisclosedBox";
import { FieldList } from "../../components/FieldList/FieldList";
import { Loading } from "../../components/Loading/Loading";
import { buyReducer, type BuyState } from "./machine";
import s from "./BuyDialog.module.css";
function initialState(mode: string, id: string): BuyState {
  try {
    const saved = sessionStorage.getItem(`writ-purchase:${mode}:${id}`);
    if (saved) {
      const handle = JSON.parse(saved) as {
        writId: string;
        attemptId: string;
        mock: boolean;
      };
      if (handle.writId === id && typeof handle.attemptId === "string")
        return { step: "reading", handle };
    }
  } catch {
    /* Unavailable session storage does not prevent inspection. */
  }
  return { step: "pins" };
}
export function BuyDialog({
  writ: liveWrit,
  onClose,
  onRefresh,
}: {
  writ: Writ;
  onClose: () => void;
  onRefresh: () => void;
}) {
  const [writ] = useState(() => structuredClone(liveWrit));
  const adapter = useAdapter();
  const { mode, session, connect, changed } = useChain();
  const [state, dispatch] = useReducer(buyReducer, undefined, () =>
    initialState(mode, writ.id),
  );
  const template = getTemplate(writ.templateId);
  const [pins, setPins] = useState<
    Record<string, { enabled: boolean; value: string }>
  >({});
  const [balance, setBalance] = useState<string | null>(null);
  const [feeAllowance, setFeeAllowance] = useState<string | null>(null);
  const [storageDeposit, setStorageDeposit] = useState<string | null>(null);
  const [balanceError, setBalanceError] = useState("");
  const [operationError, setOperationError] = useState("");
  const [operationBusy, setOperationBusy] = useState(false);
  const price = formatNear(writ.price ?? "0");
  const handle = "handle" in state ? state.handle : null;
  useEffect(() => {
    if (!adapter || !session) return;
    let active = true;
    setBalance(null);
    setFeeAllowance(null);
    setBalanceError("");
    void Promise.all([
      adapter.getSpendableBalance(session.accountId),
      adapter.getPurchaseFeeAllowance(),
      adapter.getPurchaseStorageDeposit(),
    ])
      .then(([value, fee, storage]) => {
        if (active) {
          setBalance(value);
          setFeeAllowance(fee);
          setStorageDeposit(storage);
        }
      })
      .catch(() => {
        if (active)
          setBalanceError(
            "Available balance or the current gas price could not be checked. Close and reopen the purchase to retry before paying.",
          );
      });
    return () => {
      active = false;
    };
  }, [adapter, session]);
  useEffect(() => {
    if (handle) {
      try {
        sessionStorage.setItem(
          `writ-purchase:${mode}:${writ.id}`,
          JSON.stringify(handle),
        );
      } catch {
        /* Wallet activity remains a recovery source. */
      }
    }
  }, [handle, mode, writ.id]);
  useEffect(() => {
    if (state.step !== "reading" || !adapter) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    let polls = 0;
    async function poll() {
      try {
        const result = await adapter!.getPurchase(
          state.step === "reading" ? state.handle : handle!,
        );
        if (!active) return;
        if (result.status === "checking") {
          if (++polls >= 60) {
            dispatch({
              type: "error",
              code: "outcome_unknown",
              message:
                "This purchase is still awaiting confirmation. Check the same attempt again; do not pay a second time.",
            });
            return;
          }
          timer = setTimeout(() => void poll(), mode === "mock" ? 250 : 2000);
        } else {
          dispatch({ type: "outcome", value: result });
          changed();
        }
      } catch (error) {
        if (active)
          dispatch({
            type: "error",
            code: error instanceof ChainError ? error.code : "outcome_unknown",
            message: messageOf(error),
          });
      }
    }
    void poll();
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [state.step, adapter, handle, mode, changed]);
  async function pay(event: FormEvent) {
    event.preventDefault();
    if (!adapter || !session) return;
    dispatch({ type: "submit" });
    try {
      const conditions = template.pins
        .filter((pin) => pins[pin.id]?.enabled)
        .map((pin) => ({
          id: pin.id,
          value:
            pin.unit === "NEAR"
              ? nearToYocto(pins[pin.id].value)
              : pins[pin.id].value,
        }));
      const next = await adapter.buy({
        writId: writ.id,
        clientAttemptId: crypto.randomUUID(),
        expectedNonce: writ.nonce,
        expectedTemplateHash: writ.templateHash,
        maximumPrice: writ.price!,
        pins: conditions,
      });
      dispatch({ type: "signed", handle: next });
    } catch (error) {
      if (error instanceof PurchaseSubmissionError)
        dispatch({ type: "signed", handle: error.handle });
      dispatch({
        type: "error",
        code: error instanceof ChainError ? error.code : "invalid_input",
        message: messageOf(error),
      });
    }
  }
  async function operate(kind: "release" | "refund") {
    if (!adapter || !handle) return;
    setOperationBusy(true);
    setOperationError("");
    try {
      await (kind === "release"
        ? adapter.releaseStuck(handle)
        : adapter.claimRefund(handle));
      dispatch({ type: "outcome", value: await adapter.getPurchase(handle) });
      changed();
    } catch (error) {
      setOperationError(messageOf(error));
    } finally {
      setOperationBusy(false);
    }
  }
  function finish() {
    try {
      sessionStorage.removeItem(`writ-purchase:${mode}:${writ.id}`);
    } catch {
      /* Safe to leave a completed attempt available for recovery. */
    }
    onRefresh();
    onClose();
  }
  const outcome = state.step === "result" ? state.outcome : null;
  const insufficient =
    balance !== null &&
    feeAllowance !== null &&
    BigInt(balance) <
      BigInt(writ.price ?? "0") +
        BigInt(feeAllowance) +
        BigInt(storageDeposit ?? "0");
  return (
    <Dialog title={`Purchase Writ ${writNumber(writ.id)}`} onClose={onClose}>
      {(state.step === "pins" || state.step === "signing") && (
        <form onSubmit={(event) => void pay(event)}>
          <div>
            <p className="sectionLabel">
              Your conditions travel with your payment
            </p>
            <h3>
              Buy authority.
              <br />
              Name your conditions.
            </h3>
            <p>
              You pay <code>{price} NEAR</code> for the{" "}
              {template.name.toLowerCase()} role on <code>{writ.target}</code>.
              The sale settles only if its required on-chain checks pass during
              this purchase.
            </p>
            {storageDeposit !== null && storageDeposit !== "0" && (
              <p>
                Attached payment:{" "}
                <code>
                  {formatNear(
                    (
                      BigInt(writ.price ?? "0") + BigInt(storageDeposit)
                    ).toString(),
                  )}{" "}
                  NEAR
                </code>
                , including <code>{formatNear(storageDeposit)} NEAR</code> for
                retained purchase records. That storage charge and network fees
                are not refunded when conditions fail; the full purchase price
                remains refundable.
              </p>
            )}
          </div>
          <div className={s.required}>
            <h4>Always checked for this kind of Writ</h4>
            <ul>
              {template.checks.map((check) => (
                <li key={check.id}>
                  <span className={s.lock} aria-hidden="true" />
                  {check.label}
                </li>
              ))}
              <li>
                <span className={s.lock} aria-hidden="true" />
                No calls in flight
              </li>
              <li>
                <span className={s.lock} aria-hidden="true" />
                The Writ is unchanged since you opened it: version{" "}
                <code>{writ.nonce}</code>
              </li>
            </ul>
          </div>
          {template.pins.length > 0 && (
            <fieldset>
              <legend>Your own conditions</legend>
              {template.pins.map((pin) => (
                <div className={s.pin} key={pin.id}>
                  <label>
                    <input
                      type="checkbox"
                      checked={pins[pin.id]?.enabled ?? false}
                      onChange={(e) =>
                        setPins((value) => ({
                          ...value,
                          [pin.id]: {
                            enabled: e.target.checked,
                            value: value[pin.id]?.value ?? "0",
                          },
                        }))
                      }
                    />
                    <span>{pin.label}</span>
                  </label>
                  <div>
                    <input
                      aria-label={pin.label}
                      type="text"
                      inputMode="decimal"
                      required={pins[pin.id]?.enabled}
                      disabled={!pins[pin.id]?.enabled}
                      className="typed"
                      value={pins[pin.id]?.value ?? "0"}
                      onChange={(e) =>
                        setPins((value) => ({
                          ...value,
                          [pin.id]: { enabled: true, value: e.target.value },
                        }))
                      }
                    />
                    <span>{pin.unit}</span>
                  </div>
                </div>
              ))}
            </fieldset>
          )}
          <DisclosedBox compact>
            {template.blindSpot} The executor’s access keys and published code
            hash are page checks; the sale does not enforce those RPC checks.
          </DisclosedBox>
          {state.step === "pins" && state.error && (
            <div className="errorText" role="alert">
              <p>{state.error}</p>
              {state.errorCode === "version_changed" && (
                <Button
                  onClick={() => {
                    onRefresh();
                    onClose();
                  }}
                >
                  Review the new state
                </Button>
              )}
            </div>
          )}
          {insufficient && (
            <p className="errorText" role="alert">
              Your available balance does not cover this purchase and the fee
              buffer. No signing request will be sent.
            </p>
          )}
          {balanceError && (
            <p className="errorText" role="alert">
              {balanceError}
            </p>
          )}
          <p className={s.refundNote}>
            If a required check fails, the purchase amount is refunded or made
            claimable according to the contract outcome. Network fees still
            apply.
          </p>
          {feeAllowance && (
            <small>
              Fee allowance: <code>{formatNear(feeAllowance)} NEAR</code>.{" "}
              {mode === "mock"
                ? "Example allowance."
                : "Based on the current gas price with a buffer; the wallet shows the transaction details."}
            </small>
          )}
          <footer>
            <Button onClick={onClose}>Cancel</Button>
            {session ? (
              <Button
                type="submit"
                variant="primary"
                disabled={
                  !adapter ||
                  state.step === "signing" ||
                  balance === null ||
                  storageDeposit === null ||
                  insufficient ||
                  Boolean(
                    state.step === "pins" &&
                    state.errorCode === "version_changed",
                  )
                }
              >
                {state.step === "signing"
                  ? "Confirm in your wallet…"
                  : `Pay ${formatNear((BigInt(writ.price ?? "0") + BigInt(storageDeposit ?? "0")).toString())} NEAR and check`}
              </Button>
            ) : (
              <Button variant="primary" onClick={() => void connect()}>
                Connect wallet to continue
              </Button>
            )}
          </footer>
        </form>
      )}
      {state.step === "reading" && (
        <div aria-live="polite">
          <p className="sectionLabel">One purchase, one decision</p>
          <h3>Reading the conditions.</h3>
          <Loading bar label="Waiting for the purchase outcome…" />
          <p>
            Declared reads go out in parallel and return to one decision.
            Settlement takes multiple blocks; there is no fixed completion time.
          </p>
          <ul className={s.reading}>
            {template.checks.map((check) => (
              <li key={check.id}>
                <Loading label={check.label} />
              </li>
            ))}
          </ul>
          <p className="quiet">
            You may close this dialog. This browser tab keeps the attempt so you
            can check it again without paying twice.
          </p>
        </div>
      )}
      {state.step === "unknown" && (
        <div role="status">
          <p className="sectionLabel">Outcome not yet confirmed</p>
          <h3>Your purchase needs another look.</h3>
          <p>{state.message}</p>
          {handle && (
            <FieldList
              fields={[
                {
                  label: "Purchase attempt",
                  value: handle.attemptId,
                  typed: true,
                },
              ]}
            />
          )}
          <footer>
            <Button onClick={onClose}>Close</Button>
            <Button
              variant="primary"
              onClick={() => dispatch({ type: "retry" })}
            >
              Check this purchase again
            </Button>
          </footer>
        </div>
      )}
      {outcome && (
        <div className={s.result} aria-live="polite">
          {outcome.status === "settled" ? (
            <>
              <div className={s.stamp}>
                <Stamp word="CLEAN" size="large" animate />
              </div>
              <h3>Writ {writNumber(writ.id)} is yours.</h3>
              <p>
                You bought from <code>{outcome.seller}</code>.{" "}
                {outcome.sellerPayment === "credited"
                  ? "The seller’s proceeds were credited to their withdrawal balance."
                  : outcome.sellerPayment === "claimable"
                    ? "The seller’s proceeds are ready to withdraw."
                    : "The seller has been paid."}{" "}
                {outcome.endedLoanIds.length
                  ? "Earlier loans ended at this sale."
                  : "No earlier loans remain."}
              </p>
              <FieldList
                fields={[
                  { label: "Holder", value: outcome.holder, typed: true },
                  {
                    label: "Fees inside",
                    value: `${formatNear(writ.withdrawableFees)} NEAR`,
                    typed: true,
                  },
                  { label: "Loans", value: "None" },
                ]}
              />
              <footer>
                {handle?.hash && (
                  <a
                    href={`https://testnet.nearblocks.io/txns/${handle.hash}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    View the sale on testnet
                  </a>
                )}
                <Button variant="primary" onClick={finish}>
                  Open your Writ
                </Button>
              </footer>
            </>
          ) : outcome.status === "releasable" ? (
            <>
              <h3>The callback passed its deadline.</h3>
              <p>
                The contract reports that this attempt can be released.{" "}
                <code>release_stuck</code> invalidates it before releasing the
                refund, so a late callback cannot settle the same purchase.
              </p>
              <footer>
                <Button onClick={onClose}>Close</Button>
                <Button
                  variant="primary"
                  disabled={operationBusy}
                  onClick={() => void operate("release")}
                >
                  Release this purchase
                </Button>
              </footer>
            </>
          ) : (
            <>
              <div className={s.stamp}>
                <Stamp word="REFUSED" tone="refused" size="large" animate />
              </div>
              <h3>
                {outcome.refundStatus === "paid"
                  ? `${price} NEAR has been returned.`
                  : outcome.refundStatus === "claimable"
                    ? `Your ${price} NEAR refund is ready to withdraw.`
                    : "Your refund is pending."}
              </h3>
              <p>
                {outcome.status === "refused"
                  ? outcome.checks.find((check) => check.result !== "pass")
                      ?.label + " did not pass. The sale did not settle."
                  : "The purchase was released. The Writ did not change hands."}
              </p>
              {outcome.status === "refused" && (
                <CheckTable
                  rows={[...outcome.checks].sort(
                    (a, b) =>
                      Number(a.result === "pass") - Number(b.result === "pass"),
                  )}
                />
              )}
              <footer>
                {outcome.status === "refused" &&
                  outcome.refundTransactionHash && (
                    <a
                      href={`https://testnet.nearblocks.io/txns/${outcome.refundTransactionHash}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      View the refund on testnet
                    </a>
                  )}
                <Button onClick={finish}>
                  Back to Writ {writNumber(writ.id)}
                </Button>
                {outcome.refundStatus === "claimable" && (
                  <Button
                    variant="primary"
                    disabled={operationBusy}
                    onClick={() => void operate("refund")}
                  >
                    {operationBusy ? "Withdrawing…" : "Withdraw refund"}
                  </Button>
                )}
              </footer>
            </>
          )}
          {operationError && (
            <p className="errorText" role="alert">
              {operationError}
            </p>
          )}
          {mode === "mock" && (
            <p className={s.mockNote}>
              Example outcome. No NEAR was sent or returned.
            </p>
          )}
        </div>
      )}
    </Dialog>
  );
}
