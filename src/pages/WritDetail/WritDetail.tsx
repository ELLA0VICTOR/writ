import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import type {
  CheckSnapshot,
  HistoryPage,
  MockScenario,
  Writ,
} from "../../chain/types";
import { messageOf } from "../../chain/errors";
import { useAdapter, useChain, useTitle } from "../../hooks/useChain";
import { getTemplate } from "../../templates/registry";
import { formatNear, utcDate, writNumber } from "../../utils/amounts";
import { Button, ButtonLink, ModeLink } from "../../components/Button/Button";
import { NftFace } from "../../components/NftFace/NftFace";
import { FieldList } from "../../components/FieldList/FieldList";
import { CheckTable } from "../../components/CheckTable/CheckTable";
import { DisclosedBox } from "../../components/DisclosedBox/DisclosedBox";
import { LedgerPaper } from "../../components/LedgerPaper/LedgerPaper";
import { Loading, Skeleton } from "../../components/Loading/Loading";
import { ErrorSheet } from "../../components/ErrorSheet/ErrorSheet";
import { BuyDialog } from "../../features/buy/BuyDialog";
import {
  ActionDialog,
  type ActionKind,
} from "../../features/actions/ActionDialog";
import s from "./WritDetail.module.css";
const scenarios: { value: MockScenario; label: string }[] = [
  { value: "clean", label: "Conditions pass" },
  { value: "proposed", label: "Hidden next owner" },
  { value: "pending", label: "Call in flight" },
  { value: "rejected", label: "Wallet rejected" },
  { value: "changed", label: "Version changed" },
  { value: "busy", label: "Another buyer" },
  { value: "insufficient", label: "Insufficient balance" },
  { value: "stuck", label: "Callback past deadline" },
  { value: "unknown", label: "Outcome unconfirmed" },
];
export default function WritDetail() {
  const { id = "" } = useParams();
  useTitle(`Writ ${writNumber(id)}`);
  const adapter = useAdapter();
  const { mode, session, revision, changed } = useChain();
  const [writ, setWrit] = useState<Writ | null>(null);
  const [checks, setChecks] = useState<CheckSnapshot | null>(null);
  const [history, setHistory] = useState<HistoryPage | null>(null);
  const [busy, setBusy] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [readError, setReadError] = useState("");
  const [historyError, setHistoryError] = useState("");
  const [retry, setRetry] = useState(0);
  const [age, setAge] = useState(0);
  const [buying, setBuying] = useState(false);
  const [action, setAction] = useState<ActionKind | null>(null);
  const [actionError, setActionError] = useState("");
  const [scenario, setScenario] = useState<MockScenario>("clean");
  useEffect(() => {
    setBuying(false);
    setAction(null);
    setActionError("");
    setWrit(null);
    setScenario("clean");
  }, [id, mode]);
  useEffect(() => {
    if (!adapter) return;
    const abort = new AbortController();
    setBusy(true);
    setError(null);
    setChecks(null);
    setHistory(null);
    setReadError("");
    setHistoryError("");
    void adapter
      .getWrit(id, abort.signal)
      .then(async (value) => {
        if (abort.signal.aborted) return;
        setWrit(value);
        if (value) {
          const results = await Promise.allSettled([
            adapter.readChecks(id, abort.signal),
            adapter.getHistory(id),
          ]);
          if (abort.signal.aborted) return;
          if (results[0].status === "fulfilled") setChecks(results[0].value);
          else setReadError(messageOf(results[0].reason));
          if (results[1].status === "fulfilled") setHistory(results[1].value);
          else setHistoryError(messageOf(results[1].reason));
        }
      })
      .catch((reason) => {
        if (!abort.signal.aborted) setError(reason);
      })
      .finally(() => {
        if (!abort.signal.aborted) setBusy(false);
      });
    return () => abort.abort();
  }, [adapter, id, retry, revision]);
  useEffect(() => {
    if (!checks) return;
    const update = () =>
      setAge(
        Math.max(0, Math.floor((Date.now() - checks.read.observedAtMs) / 1000)),
      );
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [checks]);
  async function readAgain() {
    if (!adapter) return;
    setRefreshing(true);
    setReadError("");
    try {
      setChecks(await adapter.readChecks(id));
    } catch (reason) {
      setReadError(messageOf(reason));
    } finally {
      setRefreshing(false);
    }
  }
  async function unlist() {
    if (!adapter || !writ) return;
    setActionError("");
    try {
      await adapter.removeListing(writ.id);
      changed();
    } catch (reason) {
      setActionError(messageOf(reason));
    }
  }
  async function endLoan(loanId: string) {
    if (!adapter || !writ) return;
    setActionError("");
    try {
      await adapter.endLoan(writ.id, loanId);
      changed();
    } catch (reason) {
      setActionError(messageOf(reason));
    }
  }
  const refresh = () => setRetry((value) => value + 1);
  if (error)
    return (
      <div className={`${s.page} appContainer`}>
        <h1 className="srOnly">Writ {writNumber(id)}</h1>
        <ErrorSheet error={error} retry={refresh} />
      </div>
    );
  if (busy && !writ)
    return (
      <div className={`${s.page} appContainer`}>
        <Loading label="Opening the public Writ page…" />
        <Skeleton />
      </div>
    );
  if (!writ)
    return (
      <div className={`${s.page} appContainer`}>
        <div className="emptySheet">
          <h1>
            No Writ with that number exists on{" "}
            {adapter?.contractId ?? "writ-demo.testnet"}.
          </h1>
          <p>Check the number, or inspect a Writ from the market.</p>
          <ButtonLink to="/market" variant="primary">
            Browse the market
          </ButtonLink>
        </div>
      </div>
    );
  const template = getTemplate(writ.templateId);
  const owner = session?.accountId === writ.owner;
  const paused = writ.status === "listed" || writ.status === "locked";
  const loaned = writ.loans.some(
    (l) =>
      l.borrower === session?.accountId &&
      l.epoch === writ.epoch &&
      Date.parse(l.expiresAt) > Date.now(),
  );
  return (
    <div className={`${s.page} appContainer`}>
      <div className={s.breadcrumb}>
        <ModeLink to="/market">The market</ModeLink>
        <span>/</span>
        <span>Writ {writNumber(writ.id)}</span>
      </div>
      <div className={s.layout}>
        <aside className={s.aside} data-reveal>
          <NftFace writ={writ} />
          <div className={s.fields}>
            <FieldList
              fields={[
                { label: "Held by", value: writ.owner, typed: true },
                { label: "Writ account", value: writ.executor, typed: true },
                {
                  label: "Template",
                  value: (
                    <>
                      {template.name}
                      <br />
                      <code>{writ.templateHash.slice(0, 20)}</code>
                    </>
                  ),
                },
              ]}
            />
          </div>
          <div className={s.actionsPanel}>
            <h2>{owner ? "Your holder actions" : "While it’s listed"}</h2>
            {writ.status === "locked" ? (
              <p>A sale is being checked. Try again in a few seconds.</p>
            ) : owner ? (
              <>
                <div className={s.actionButtons}>
                  {adapter?.capabilities.execute && (
                    <Button
                      disabled={paused}
                      title={paused ? "Paused while listed" : undefined}
                      onClick={() => setAction("use")}
                    >
                      Use the role
                    </Button>
                  )}
                  {adapter?.capabilities.lend && (
                    <Button
                      disabled={paused}
                      title={paused ? "Paused while listed" : undefined}
                      onClick={() => setAction("lend")}
                    >
                      Lend a method
                    </Button>
                  )}
                  {adapter?.capabilities.withdraw && (
                    <Button
                      disabled={paused || writ.withdrawableFees === "0"}
                      title={paused ? "Paused while listed" : undefined}
                      onClick={() => setAction("withdraw")}
                    >
                      Withdraw fees ({formatNear(writ.withdrawableFees)} NEAR)
                    </Button>
                  )}
                  {adapter?.capabilities.list && (
                    <Button variant="primary" onClick={() => setAction("list")}>
                      {writ.status === "listed"
                        ? "Change listing"
                        : "List for sale"}
                    </Button>
                  )}
                  {writ.status === "listed" && (
                    <Button onClick={() => void unlist()}>Take off sale</Button>
                  )}
                  {adapter?.capabilities.unwrap && template.supportsUnwrap && (
                    <Button
                      disabled={paused || writ.loans.length > 0}
                      title={
                        paused
                          ? "Paused while listed"
                          : writ.loans.length
                            ? "End loans before unwrapping"
                            : undefined
                      }
                      onClick={() => setAction("unwrap")}
                    >
                      Unwrap
                    </Button>
                  )}
                </div>
                {paused && (
                  <p className={s.pauseNote}>
                    Paused while listed: using the role, lending, withdrawing
                    and unwrapping.
                  </p>
                )}
              </>
            ) : (
              <>
                <dl className={s.statusRows}>
                  {[
                    "Using the role",
                    "Lending",
                    "Withdrawing",
                    "Unwrapping",
                  ].map((label) => (
                    <div key={label}>
                      <dt>{label}</dt>
                      <dd>{paused ? "Paused" : "Holder only"}</dd>
                    </div>
                  ))}
                  <div>
                    <dt>Changing the price</dt>
                    <dd>Voids open offers</dd>
                  </div>
                </dl>
                {loaned && !paused && (
                  <Button onClick={() => setAction("use")}>
                    Use your loaned method
                  </Button>
                )}
              </>
            )}
            {actionError && (
              <p className="errorText" role="alert">
                {actionError}
              </p>
            )}
          </div>
        </aside>
        <div className={s.content}>
          <div className={s.title} data-reveal>
            <p className="sectionLabel">Public Writ record</p>
            <h1>Owner of {writ.target.replace(/\.testnet$/, "")}.</h1>
            <p className="lead">{template.description}</p>
            {writ.price && (
              <div className={s.price}>
                <span>
                  <small>Asking price</small>
                  <strong className="typed">
                    {formatNear(writ.price)} NEAR
                  </strong>
                </span>
                {!owner && (
                  <Button
                    variant="primary"
                    disabled={writ.status === "locked"}
                    onClick={() => setBuying(true)}
                  >
                    {writ.status === "locked"
                      ? "Sale in progress"
                      : "Buy with conditions"}
                  </Button>
                )}
              </div>
            )}
          </div>
          {mode === "mock" && (
            <details className={s.demoControls}>
              <summary>Example purchase controls</summary>
              <p>
                Choose an outcome to exercise the flow. These controls never
                appear in testnet mode.
              </p>
              <label>
                Purchase scenario
                <select
                  value={scenario}
                  onChange={(e) => {
                    const value = e.target.value as MockScenario;
                    setScenario(value);
                    adapter?.setMockScenario?.(value);
                  }}
                >
                  {scenarios.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>
            </details>
          )}
          <section className={s.section} data-reveal>
            <div className={s.sectionHeading}>
              <div>
                <h2>Live checks.</h2>
                {checks && (
                  <p>
                    {mode === "mock" ? "Example snapshot at" : "Read at"} block{" "}
                    <code>{checks.read.blockHeight}</code>, {age} seconds ago
                  </p>
                )}
              </div>
              <Button
                disabled={refreshing || busy}
                onClick={() => void readAgain()}
              >
                {refreshing ? "Reading…" : "Read again"}
              </Button>
            </div>
            {readError && (
              <p className="errorText" role="alert">
                {readError}
              </p>
            )}
            {checks ? (
              <CheckTable rows={checks.rows} />
            ) : (
              !readError && <Loading label="Reading the declared checks…" />
            )}
            <p className={s.checkNote} role="status">
              {refreshing
                ? "Refreshing the page observations."
                : checks
                  ? "Page observations loaded. A purchase runs its own settlement checks."
                  : ""}
            </p>
            <DisclosedBox>
              Access keys and the executor code hash are checked by this page,
              not by the sale. {template.blindSpot}
            </DisclosedBox>
          </section>
          <section className={s.section} data-reveal>
            <h2>Inside the Writ.</h2>
            <FieldList
              fields={[
                {
                  label: "Executor account balance",
                  value: `${formatNear(writ.balance)} NEAR`,
                  typed: true,
                },
                {
                  label: "Withdrawable fees",
                  value: `${formatNear(writ.withdrawableFees)} NEAR`,
                  typed: true,
                },
                { label: "Role", value: template.name },
                {
                  label: "Token inventory",
                  value: writ.tokens.length
                    ? writ.tokens
                        .map((t) => `${t.amount} ${t.symbol}`)
                        .join(", ")
                    : "No tokens reported",
                },
              ]}
            />
          </section>
          <section className={s.section} data-reveal>
            <h2>Loans.</h2>
            <p className={s.sectionIntro}>
              Scoped actions, bound to this ownership epoch. Every loan ends at
              any sale.
            </p>
            {writ.loans.length ? (
              <div className={s.loans}>
                {writ.loans.map((loan) => (
                  <article key={loan.id}>
                    <h3>
                      <code>{loan.method}</code>
                    </h3>
                    <FieldList
                      fields={[
                        {
                          label: "Borrower",
                          value: loan.borrower,
                          typed: true,
                        },
                        {
                          label: "Expiry",
                          value: utcDate(loan.expiresAt),
                          typed: true,
                        },
                        {
                          label: "Arguments",
                          value: JSON.stringify(loan.args),
                          typed: true,
                        },
                        {
                          label: "Deposit cap",
                          value: `${formatNear(loan.maxDeposit)} NEAR`,
                          typed: true,
                        },
                      ]}
                    />
                    <p>Ends at any sale</p>
                    {owner && (
                      <Button
                        disabled={paused}
                        onClick={() => void endLoan(loan.id)}
                      >
                        End loan
                      </Button>
                    )}
                  </article>
                ))}
              </div>
            ) : (
              <p>No active loans.</p>
            )}
          </section>
          <section className={`${s.section} ${s.lastSection}`} data-reveal>
            <h2>Ledger.</h2>
            <p className={s.sectionIntro}>
              {history?.source === "mock"
                ? "Example event history."
                : history?.source === "contract"
                  ? "On-chain history view. No indexer is connected."
                  : "Indexed contract events."}
            </p>
            {history ? (
              <LedgerPaper
                entries={history.entries}
                label={`${mode === "mock" ? "Example ledger" : "Ledger"} for Writ ${writNumber(writ.id)}.`}
              />
            ) : historyError ? (
              <p className="errorText" role="alert">
                {historyError}
              </p>
            ) : (
              <Loading label="Reading the ledger…" />
            )}
          </section>
        </div>
      </div>
      {buying && (
        <BuyDialog
          writ={writ}
          onClose={() => setBuying(false)}
          onRefresh={refresh}
        />
      )}{" "}
      {action && (
        <ActionDialog
          kind={action}
          writ={writ}
          onClose={() => setAction(null)}
          onDone={refresh}
        />
      )}
    </div>
  );
}
