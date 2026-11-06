import { useState } from "react";
import { replayOptions, replayOutcome, type ReplayChoice } from "./outcomes";
import { Button } from "../../components/Button/Button";
import { CheckTable } from "../../components/CheckTable/CheckTable";
import { Stamp } from "../../components/Stamp/Stamp";
import evidence from "../../content/evidence.json";
import s from "./SaleReplay.module.css";
export function SaleReplay() {
  const [choice, setChoice] = useState<ReplayChoice>("proposed");
  const [result, setResult] = useState<ReturnType<typeof replayOutcome> | null>(
    null,
  );
  const hash = evidence[choice === "none" ? "clean" : choice];
  return (
    <div className={s.replay}>
      <div>
        <fieldset>
          <legend>What does Ada try before selling?</legend>
          <div className={s.options}>
            {replayOptions.map((option) => (
              <label
                key={option.id}
                className={`${s.option} ${choice === option.id ? s.selected : ""}`}
              >
                <input
                  type="radio"
                  name="seller-trick"
                  value={option.id}
                  checked={choice === option.id}
                  onChange={() => {
                    setChoice(option.id);
                    setResult(null);
                  }}
                />
                <span>
                  <strong>{option.label}</strong>
                  <small>{option.detail}</small>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        <Button variant="dark" onClick={() => setResult(replayOutcome(choice))}>
          Run Ben’s purchase
        </Button>
        <p className={s.caption}>
          Interactive example. No wallet or funds involved.
          {hash && (
            <a href={`https://testnet.nearblocks.io/txns/${hash}`}>
              View the testnet evidence
            </a>
          )}
        </p>
      </div>
      <div className={s.panel} aria-live="polite">
        {!result ? (
          <div className={s.idle}>
            <span className={s.idleSymbol} aria-hidden="true">
              W
            </span>
            <h3>The receipt tells the story.</h3>
            <p>
              Choose a seller’s move, then run the purchase. See which
              conditions pass and where a sale stops.
            </p>
            <span>
              Example purchase for Writ <code>0007</code>
            </span>
          </div>
        ) : (
          <>
            <div className={s.panelTop}>
              <span>Ben’s purchase receipt</span>
              <span>Example data</span>
            </div>
            <CheckTable rows={result.rows} />
            <div className={s.verdict}>
              <Stamp
                key={choice}
                word={result.word}
                tone={result.refused ? "refused" : "clean"}
                animate
              />
              <p>{result.sentence}</p>
            </div>
            <p className={s.scope}>
              This illustration checks the declared conditions. It is not proof
              that a target has no hidden permissions.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
