import { useEffect, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import type {
  CheckSnapshot,
  MintResult,
  RoleTemplate,
  WrapInspection,
  MintQuote,
} from "../../chain/types";
import { useAdapter, useChain, useTitle } from "../../hooks/useChain";
import { isAccountId, writNumber, formatNear } from "../../utils/amounts";
import { messageOf } from "../../chain/errors";
import { Button, ButtonLink } from "../../components/Button/Button";
import { Stepper } from "../../components/Stepper/Stepper";
import { DisclosedBox } from "../../components/DisclosedBox/DisclosedBox";
import { FieldList } from "../../components/FieldList/FieldList";
import { CheckTable } from "../../components/CheckTable/CheckTable";
import { Stamp } from "../../components/Stamp/Stamp";
import { Loading } from "../../components/Loading/Loading";
import s from "./Wrap.module.css";
const steps = [
  "Choose the kind of role",
  "Point at the contract",
  "Mint your Writ",
  "Hand the role over",
  "Confirm it took",
];
export default function Wrap() {
  useTitle("Wrap a role");
  const adapter = useAdapter();
  const { mode, session, connect, changed } = useChain();
  const [step, setStep] = useState(0);
  const [templates, setTemplates] = useState<RoleTemplate[]>([]);
  const [templateId, setTemplate] = useState("contract-owner");
  const [target, setTarget] = useState("");
  const [inspection, setInspection] = useState<WrapInspection | null>(null);
  const [mint, setMint] = useState<MintResult | null>(null);
  const [completed, setCompleted] = useState<number[]>([]);
  const [transactions, setTransactions] = useState<
    Record<number, string | undefined>
  >({});
  const [checks, setChecks] = useState<CheckSnapshot | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [quote, setQuote] = useState<MintQuote | null>(null);
  const [practiceQuote, setPracticeQuote] = useState<MintQuote | null>(null);
  useEffect(() => {
    if (
      !adapter?.capabilities.wrap ||
      step !== 1 ||
      templateId !== "contract-owner"
    )
      return;
    let live = true;
    void adapter
      .getPracticeQuote()
      .then((q) => {
        if (live) setPracticeQuote(q);
      })
      .catch((e) => {
        if (live) setError(messageOf(e));
      });
    return () => {
      live = false;
    };
  }, [adapter, step, templateId]);
  const [search] = useSearchParams();
  const resume = search.get("resume");
  useEffect(() => {
    if (!adapter || !resume || !session) return;
    let live = true;
    void adapter
      .getWrit(resume)
      .then((w) => {
        if (!live) return;
        if (!w || w.owner !== session.accountId)
          throw new Error("Only the Writ holder can resume this handover.");
        setMint({ writ: w, mock: mode === "mock" });
        setTarget(w.target);
        setTemplate(w.templateId);
        setStep(3);
      })
      .catch((e) => {
        if (live) setError(messageOf(e));
      });
    return () => {
      live = false;
    };
  }, [adapter, resume, session, mode]);
  useEffect(() => {
    if (step !== 2 || !adapter || mint) return;
    let live = true;
    setQuote(null);
    void adapter
      .getMintQuote({ templateId, target })
      .then((q) => {
        if (live) setQuote(q);
      })
      .catch((e) => {
        if (live) setError(messageOf(e));
      });
    return () => {
      live = false;
    };
  }, [adapter, step, mint, templateId, target]);
  useEffect(() => {
    if (adapter)
      void adapter
        .getTemplates()
        .then(setTemplates)
        .catch((reason) => setError(messageOf(reason)));
  }, [adapter]);
  const template = templates.find((t) => t.id === templateId);
  const pass = checks && checks.rows.every((row) => row.result === "pass");
  async function inspect(event: FormEvent) {
    event.preventDefault();
    if (!adapter) return;
    setBusy(true);
    setError("");
    try {
      if (!isAccountId(target))
        throw new Error("Enter a valid NEAR contract account.");
      setInspection(await adapter.inspectWrap({ templateId, target }));
    } catch (reason) {
      setError(messageOf(reason));
    } finally {
      setBusy(false);
    }
  }
  async function mintWrit() {
    if (!adapter || mint) return;
    setBusy(true);
    setError("");
    try {
      const result = await adapter.mintWrit({ templateId, target });
      setMint(result);
      changed();
    } catch (reason) {
      setError(messageOf(reason));
    } finally {
      setBusy(false);
    }
  }
  async function practice() {
    if (!adapter) return;
    setBusy(true);
    setError("");
    try {
      const account = await adapter.createPracticeTarget();
      setTarget(account);
      setInspection(
        await adapter.inspectWrap({
          templateId: "contract-owner",
          target: account,
        }),
      );
    } catch (e) {
      setError(messageOf(e));
    } finally {
      setBusy(false);
    }
  }
  async function handOver(index: number) {
    if (!adapter || !mint) return;
    setBusy(true);
    setError("");
    try {
      const result = await adapter.performWrapStep({
        writId: mint.writ.id,
        step: index,
      });
      setTransactions((value) => ({ ...value, [index]: result.hash }));
      setCompleted((value) => [...value, index]);
      changed();
    } catch (reason) {
      setError(messageOf(reason));
    } finally {
      setBusy(false);
    }
  }
  async function confirm() {
    if (!adapter || !mint) return;
    setBusy(true);
    setError("");
    try {
      if (mode === "testnet") await adapter.confirmWrap(mint.writ.id);
      setChecks(await adapter.readChecks(mint.writ.id));
    } catch (reason) {
      setError(messageOf(reason));
    } finally {
      setBusy(false);
    }
  }
  function next(value: number) {
    setStep(value);
    setError("");
  }
  return (
    <div className={`${s.page} appContainer`}>
      <div className={s.heading} data-reveal>
        <p className="sectionLabel">Give a role a transferable holder</p>
        <h1>Wrap a role.</h1>
        <p className="lead">
          The role moves to a keyless executor. Your NFT controls who can use
          it.
        </p>
      </div>
      <div className={s.layout}>
        <aside>
          <Stepper steps={steps} current={step} />
        </aside>
        <div className={s.sheet} data-reveal>
          <div className={s.sheetHeader}>
            <span>
              Step {step + 1} of {steps.length}
            </span>
            <strong>{steps[step]}</strong>
          </div>
          <div className={s.sheetBody}>
            {step === 0 && (
              <>
                <h2>What kind of authority?</h2>
                <p>
                  Choose a template that matches the target contract. Its
                  declared checks define what a buyer can ask the sale to
                  enforce.
                </p>
                <fieldset>
                  <legend className="srOnly">Role template</legend>
                  <div className={s.options}>
                    {templates.map((item) => (
                      <label
                        key={item.id}
                        className={`${s.option} ${templateId === item.id ? s.selected : ""}`}
                      >
                        <input
                          type="radio"
                          name="template"
                          checked={templateId === item.id}
                          onChange={() => {
                            setTemplate(item.id);
                            setInspection(null);
                          }}
                        />
                        <span>
                          <strong>{item.name}</strong>
                          <small>{item.kind}</small>
                        </span>
                      </label>
                    ))}
                  </div>
                </fieldset>
                {!templates.length && (
                  <Loading label="Reading role templates…" />
                )}
                {mode === "mock" && (
                  <p className={s.note}>
                    Example template. Its frontend tests do not establish
                    contract sandbox validation.
                  </p>
                )}
                <footer>
                  <Button
                    variant="primary"
                    disabled={!template}
                    onClick={() => next(1)}
                  >
                    Continue
                  </Button>
                </footer>
              </>
            )}
            {step === 1 && (
              <>
                <h2>Which contract?</h2>
                <p>
                  Use a contract whose ownership API matches this template.
                  We’ll check who holds the role before you mint.
                </p>
                {!session ? (
                  <div className={s.connect}>
                    <p>Connect the wallet that currently holds this role.</p>
                    <Button variant="primary" onClick={() => void connect()}>
                      Connect wallet
                    </Button>
                  </div>
                ) : (
                  <form onSubmit={(event) => void inspect(event)}>
                    <label>
                      Contract account
                      <input
                        className="typed"
                        placeholder="lanterns-nft.testnet"
                        required
                        autoComplete="off"
                        value={target}
                        onChange={(e) => {
                          setTarget(e.target.value);
                          setInspection(null);
                        }}
                      />
                    </label>
                    <Button type="submit" disabled={busy}>
                      {busy ? "Reading ownership…" : "Read current holder"}
                    </Button>
                  </form>
                )}
                {inspection && (
                  <div className={s.inspection}>
                    <FieldList
                      fields={[
                        {
                          label:
                            templateId === "dao-council"
                              ? "Council member"
                              : "Reported owner",
                          value: inspection.holder,
                          typed: true,
                        },
                        {
                          label: "Your wallet",
                          value: session?.accountId,
                          typed: true,
                        },
                        {
                          label:
                            mode === "mock" ? "Example block" : "Read at block",
                          value: inspection.read.blockHeight,
                          typed: true,
                        },
                      ]}
                    />
                    <p role="status">
                      {inspection.isCurrentHolder
                        ? templateId === "dao-council"
                          ? "Your wallet is in the reported council group. Adding the executor still needs DAO approval."
                          : "The reported owner matches your wallet."
                        : `${target} says its owner is ${inspection.holder}, not you.`}
                    </p>
                  </div>
                )}
                {session &&
                  templateId === "contract-owner" &&
                  practiceQuote && (
                    <div className={s.inspection}>
                      <h3>Need a contract to try?</h3>
                      <p>
                        Create a practice service whose Owner role belongs to
                        your connected wallet. Its account has no keys. This is
                        optional; existing compatible contracts work too.
                      </p>
                      <p>
                        Attach{" "}
                        <code>{formatNear(practiceQuote.deposit)} NEAR</code>{" "}
                        for the target, including{" "}
                        <code>
                          {formatNear(practiceQuote.storageDeposit)} NEAR
                        </code>{" "}
                        of retained record storage. Minting your Writ is a
                        separate quoted payment.
                      </p>
                      <Button disabled={busy} onClick={() => void practice()}>
                        {busy
                          ? "Provisioning…"
                          : "Create or resume practice target"}
                      </Button>
                    </div>
                  )}
                <footer>
                  <Button onClick={() => next(0)}>Back</Button>
                  <Button
                    variant="primary"
                    disabled={
                      !inspection?.isCurrentHolder ||
                      busy ||
                      inspection.holder !== session?.accountId
                    }
                    onClick={() => next(2)}
                  >
                    Continue to mint
                  </Button>
                </footer>
              </>
            )}
            {step === 2 && (
              <>
                <h2>A Writ, and its own account.</h2>
                <p>
                  Minting provisions a new executor without access keys. The
                  role stays in your wallet until you complete the handover.
                </p>
                {mint ? (
                  <FieldList
                    fields={[
                      {
                        label: "Writ",
                        value: writNumber(mint.writ.id),
                        typed: true,
                      },
                      {
                        label: "New executor",
                        value: mint.writ.executor,
                        typed: true,
                      },
                      {
                        label: "Access keys",
                        value: mint.writ.accessKeys.length
                          ? "Keys reported"
                          : "No keys reported",
                      },
                    ]}
                  />
                ) : (
                  <>
                    <FieldList
                      fields={[
                        { label: "Target", value: target, typed: true },
                        {
                          label: "Holder",
                          value: session?.accountId,
                          typed: true,
                        },
                        {
                          label: "Executor",
                          value: "Assigned when minting completes",
                        },
                      ]}
                    />
                    <p className={s.note}>
                      {mode === "mock"
                        ? "Example minting uses fixture funds. No NEAR is charged."
                        : quote
                          ? `Attach ${formatNear(quote.deposit)} NEAR: ${formatNear(quote.executorFunding)} funds the executor and ${formatNear(quote.storageDeposit)} covers retained storage. Storage is not refunded if provisioning fails; recover returned funding in My Writs.`
                          : "Reading the on-chain funding and storage quote…"}
                    </p>
                  </>
                )}
                <footer>
                  {!mint && <Button onClick={() => next(1)}>Back</Button>}
                  <Button
                    variant="primary"
                    disabled={
                      busy || !adapter?.capabilities.wrap || (!mint && !quote)
                    }
                    onClick={() => void (mint ? next(3) : mintWrit())}
                  >
                    {busy
                      ? "Provisioning the executor…"
                      : mint
                        ? "Continue to handover"
                        : "Mint your Writ"}
                  </Button>
                </footer>
              </>
            )}
            {step === 3 && mint && (
              <>
                <h2>Let the account accept.</h2>
                <p>
                  {templateId === "dao-council"
                    ? "The DAO must approve adding the executor to its council through its own governance. This does not grant exclusive control. Use the executor account below in an AddMemberToRole proposal, then return here to verify membership."
                    : "The owner role follows a two-step handover. Complete these in order. Ticks appear only after each action completes."}
                </p>
                {templateId === "dao-council" && (
                  <FieldList
                    fields={[
                      {
                        label: "Council member to add",
                        value: mint.writ.executor,
                        typed: true,
                      },
                      { label: "DAO", value: target, typed: true },
                      { label: "Role", value: "council" },
                    ]}
                  />
                )}
                <div className={s.handover}>
                  {template?.wrapSteps.map((item, index) => (
                    <article key={item.method}>
                      <label>
                        <input
                          type="checkbox"
                          readOnly
                          disabled
                          checked={completed.includes(index)}
                        />
                        <strong>{item.label}</strong>
                      </label>
                      <code>
                        {item.method}(
                        {index === 0
                          ? JSON.stringify({ account_id: mint.writ.executor })
                          : "{}"}
                        )
                      </code>
                      <span>
                        Signed by{" "}
                        {item.signer === "holder"
                          ? session?.accountId
                          : mint.writ.executor}
                      </span>
                      {completed.includes(index) ? (
                        transactions[index] ? (
                          <a
                            href={`https://testnet.nearblocks.io/txns/${transactions[index]}`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            View transaction
                          </a>
                        ) : (
                          <small>Example step complete</small>
                        )
                      ) : (
                        <Button
                          disabled={
                            busy ||
                            (index > 0 && !completed.includes(index - 1))
                          }
                          onClick={() => void handOver(index)}
                        >
                          {busy
                            ? "Waiting…"
                            : index === 0
                              ? "Propose executor"
                              : "Accept from executor"}
                        </Button>
                      )}
                    </article>
                  ))}
                </div>
                <footer>
                  <Button
                    variant="primary"
                    disabled={
                      busy ||
                      (templateId !== "dao-council" &&
                        completed.length !== template?.wrapSteps.length)
                    }
                    onClick={() => next(4)}
                  >
                    Check the handover
                  </Button>
                </footer>
              </>
            )}
            {step === 4 && mint && (
              <>
                <h2>
                  {pass
                    ? "The declared checks pass."
                    : "Confirm the role arrived."}
                </h2>
                <p>
                  {templateId === "dao-council"
                    ? "Read the named council group and executor again. Membership must include the executor; DAO governance remains sovereign."
                    : "Read the target and executor again. A successful handover must show the executor as owner, with no next owner left waiting."}
                </p>
                {checks && (
                  <>
                    <div className={s.stamp}>
                      <Stamp
                        word={pass ? "CLEAN" : "REFUSED"}
                        tone={pass ? "clean" : "refused"}
                        size="large"
                        animate
                      />
                    </div>
                    <CheckTable rows={checks.rows} />
                  </>
                )}
                <footer>
                  <Button
                    disabled={busy}
                    variant={pass ? "secondary" : "primary"}
                    onClick={() => void confirm()}
                  >
                    {busy
                      ? "Reading…"
                      : checks
                        ? "Read again"
                        : "Run the checks"}
                  </Button>
                  {pass && (
                    <ButtonLink variant="primary" to={`/writ/${mint.writ.id}`}>
                      Open your Writ
                    </ButtonLink>
                  )}
                </footer>
              </>
            )}
            {error && (
              <p className="errorText" role="alert">
                {error}
              </p>
            )}
            {template && (
              <div className={s.buyerChecks}>
                <h3>What a buyer will see checked</h3>
                <ul>
                  {template.checks.map((check) => (
                    <li key={check.id}>
                      {check.label} <code>{check.method}</code>
                    </li>
                  ))}
                </ul>
                <DisclosedBox compact>{template.blindSpot}</DisclosedBox>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
