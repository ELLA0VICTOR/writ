import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Button, ButtonLink, ModeLink } from "../../components/Button/Button";
import { WritCard } from "../../components/WritCard/WritCard";
import { Step } from "../../components/Step/Step";
import { Stamp } from "../../components/Stamp/Stamp";
import { LedgerPaper } from "../../components/LedgerPaper/LedgerPaper";
import { TechMarquee } from "../../components/TechMarquee/TechMarquee";
import { exampleWrit, exampleHistory } from "../../chain/fixtures/writs";
import { validatedTemplates } from "../../templates/registry";
import release from "../../content/deployment.json";
import { authoritySteps, sellerTricks } from "../../content/landing";
import { useChain, useTitle } from "../../hooks/useChain";
import s from "./Landing.module.css";
export default function Landing() {
  useTitle("On-chain authority, handed over");
  const [id, setId] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const { mode } = useChain();
  function check(event: FormEvent) {
    event.preventDefault();
    if (!/^\d{1,12}$/.test(id)) {
      setError(`Enter a Writ number, such as ${mode === "mock" ? 7 : 1}.`);
      return;
    }
    navigate(`/writ/${Number(id)}${mode === "mock" ? "?mock=1" : ""}`);
  }
  return (
    <>
      <section className={`${s.hero} container`}>
        <div className={s.heroCopy} data-reveal>
          <p className="sectionLabel">NFTs that hold on-chain authority</p>
          <h1>Hand over the keys. Keep no spares.</h1>
          <p className="lead">
            A contract role. A keyless account. One NFT that decides who’s in
            charge. Use the role, lend a scoped action, or hand over the NFT to
            pass control to its next holder.
          </p>
          <div className="actions">
            <ButtonLink to="/wrap" variant="primary">
              Wrap a role
            </ButtonLink>
            <ButtonLink to="/market">Explore Writs</ButtonLink>
          </div>
          <p className={s.testnetNote}>
            Testnet build for NEAR HACKATHON 2026.
            <br />
            Nothing here holds real value.
          </p>
        </div>
        <div className={s.heroCard} data-reveal>
          <WritCard writ={exampleWrit} hero receipt />
          <p className={s.exampleCaption}>
            Example NFT face. The public Writ page reads actual state when a
            deployment is connected.
          </p>
        </div>
      </section>
      <TechMarquee />
      <section className={`${s.section} ${s.ruled}`}>
        <div className="container" data-reveal>
          <p className="sectionLabel">One mechanism, different roles</p>
          <h2>What a Writ can hold.</h2>
          <p className="lead">
            Authority already exists inside contracts. Writ gives a supported
            role a transferable holder, a declared check template and an
            inspectable history.
          </p>
          {validatedTemplates.length ? (
            <div className={s.templateGrid}>
              {validatedTemplates.map((template) => (
                <article key={template.id}>
                  <span className="typed">{template.kind}</span>
                  <h3>{template.name}</h3>
                  <p>{template.description}</p>
                  <div>
                    {template.checks.map((check) => (
                      <code key={check.id}>{check.method}</code>
                    ))}
                  </div>
                  {mode !== "mock" &&
                    release.examples[
                      template.id as keyof typeof release.examples
                    ] && (
                      <ModeLink
                        to={`/writ/${release.examples[template.id as keyof typeof release.examples]}`}
                      >
                        Inspect {template.name} example
                      </ModeLink>
                    )}
                </article>
              ))}
            </div>
          ) : (
            <div className={s.validationNote}>
              <div>
                <strong>Templates earn their place here.</strong>
                <p>
                  Supported integrations will appear after their contract
                  sandbox tests pass. No integration is marked validated yet.
                </p>
              </div>
              <ModeLink to="/writ/7?mock=1">
                Inspect the contract-owner example
              </ModeLink>
            </div>
          )}
        </div>
      </section>
      <section className={`${s.section} ${s.ruled}`} id="how-it-works">
        <div className="container" data-reveal>
          <div className={s.sectionHead}>
            <div>
              <p className="sectionLabel">From one holder to the next</p>
              <h2>The NFT moves. Control follows.</h2>
            </div>
            <p className="lead">
              Writ carries authority, not just a picture. Holding it decides who
              can use the role. Selling is optional; the holder is what matters.
            </p>
          </div>
          <div className={s.steps}>
            {authoritySteps.map((step, i) => (
              <Step key={step.title} number={i + 1} {...step} />
            ))}
          </div>
          <p className={s.asyncNote}>
            NEAR calls are asynchronous. Checks observe returned states during
            the purchase; they do not freeze outside contracts or guarantee what
            happens afterward.
          </p>
        </div>
      </section>
      <section className={`${s.section} ${s.ruled}`}>
        <div className={`${s.tricks} container`} data-reveal>
          <div>
            <p className="sectionLabel">The fine print, up front</p>
            <h2>
              Clear authority.
              <br />
              Named defences.
            </h2>
            <p className="lead">
              When you choose a sale, declared checks help protect the handover.
              Other risks stay in plain sight. A green verdict covers only the
              conditions you see.
            </p>
            <a href="/docs/THREAT_MODEL.md">Read the transfer threat model</a>
          </div>
          <div className={s.trickList}>
            {sellerTricks.map((trick) => (
              <article key={trick.attempt}>
                <strong>{trick.attempt}</strong>
                <p>{trick.defence}</p>
                <Stamp
                  word={trick.disclosed ? "DISCLOSED" : "REFUSED"}
                  tone={trick.disclosed ? "listed" : "refused"}
                  size="small"
                  rotate={trick.disclosed ? 3 : -4}
                />
              </article>
            ))}
          </div>
        </div>
      </section>
      <section className={`${s.section} ${s.ruled}`}>
        <div className="container" data-reveal>
          <div className={s.sectionHead}>
            <div>
              <p className="sectionLabel">Authority leaves a paper trail</p>
              <h2>A role with a record.</h2>
            </div>
            <p className="lead">
              Who held it. What they did. What changed at the sale. The history
              travels with the Writ.
            </p>
          </div>
          <LedgerPaper
            entries={exampleHistory}
            label="Example ledger for Writ 0007."
          />
        </div>
      </section>
      <section className={`${s.section} ${s.cta}`}>
        <div className={`${s.ctaInner} container`} data-reveal>
          <div>
            <p className="sectionLabel">Open to inspection</p>
            <h2>
              Check a Writ.
              <br />
              No wallet needed.
            </h2>
            <p className="lead">
              Look at the holder, the account and the conditions. Know what’s
              checked before you connect.
            </p>
          </div>
          <form onSubmit={check}>
            <label htmlFor="check-id">Writ number</label>
            <div className={s.lookup}>
              <input
                id="check-id"
                inputMode="numeric"
                className="typed"
                placeholder={mode === "mock" ? "e.g. 0007" : "e.g. 0001"}
                value={id}
                onChange={(e) => {
                  setId(e.target.value);
                  setError("");
                }}
                aria-describedby={error ? "check-error" : undefined}
              />
              <Button type="submit" variant="dark">
                Check this Writ
              </Button>
            </div>
            {error && (
              <p id="check-error" role="alert">
                {error}
              </p>
            )}
            <small>
              {mode === "mock"
                ? "You are checking labelled example data."
                : "Public checks use the configured NEAR testnet deployment."}
            </small>
          </form>
        </div>
      </section>
    </>
  );
}
