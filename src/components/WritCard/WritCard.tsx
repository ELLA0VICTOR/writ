import type { Writ } from "../../chain/types";
import { getTemplate } from "../../templates/registry";
import { formatNear, writNumber, utcDate } from "../../utils/amounts";
import { Seal } from "../Seal/Seal";
import { Stamp } from "../Stamp/Stamp";
import s from "./WritCard.module.css";
export function WritCard({
  writ,
  hero = false,
  receipt = false,
}: {
  writ: Writ;
  hero?: boolean;
  receipt?: boolean;
}) {
  const template = getTemplate(writ.templateId);
  return (
    <div className={hero ? s.hero : ""}>
      <article
        className={s.card}
        aria-label={`Writ ${writNumber(writ.id)}, ${template.name}, ${writ.status}`}
      >
        <div className={s.header}>
          <strong>Writ {writNumber(writ.id)}</strong>
          <span>{writ.collection}</span>
        </div>
        <div className={s.body}>
          <div className={s.seal}>
            <Seal />
          </div>
          <p className={s.label}>Holds the role</p>
          <p className={s.role}>
            {template.roleTitle.split("\n").map((part, i) => (
              <span key={i}>{part}</span>
            ))}
          </p>
          <p className={s.target}>{writ.target}</p>
          <dl className={s.grid}>
            <div>
              <dt>Epoch</dt>
              <dd>{writ.epoch}</dd>
            </div>
            <div>
              <dt>Nonce</dt>
              <dd>{writ.nonce}</dd>
            </div>
            <div>
              <dt>Template</dt>
              <dd>
                {writ.templateId === "contract-owner"
                  ? "Owner v1"
                  : template.name}
              </dd>
            </div>
          </dl>
          <div className={s.stamp}>
            {writ.status === "listed" && (
              <Stamp
                word="LISTED"
                sub={`${formatNear(writ.price ?? "0")} NEAR`}
                tone="listed"
              />
            )}
            {writ.status === "locked" && (
              <Stamp word="IN SALE" sub="Checks running" tone="refused" />
            )}
          </div>
        </div>
        <div className={`${s.stub} ${s[writ.status]}`}>
          <strong>
            {writ.status === "held" ? (
              "Status: Held"
            ) : writ.status === "listed" ? (
              <>
                For sale:{" "}
                <span className="typed">
                  {formatNear(writ.price ?? "0")} NEAR
                </span>
              </>
            ) : writ.status === "locked" ? (
              "Sale in progress"
            ) : (
              <>
                Lent until{" "}
                <span className="typed">
                  {writ.loans[0] ? utcDate(writ.loans[0].expiresAt) : "expiry"}
                </span>
              </>
            )}
          </strong>
          <span>
            Held by <span className="typed">{writ.owner}</span>
            {writ.status === "lent" && writ.loans[0] && (
              <>
                {" "}
                / <span className="typed">{writ.loans[0].method}</span>
              </>
            )}
          </span>
        </div>
      </article>
      {receipt && (
        <div className={s.receipt}>
          <span className={s.receiptTitle}>Example check receipt</span>
          <div>
            <span>Owner matches executor</span>
            <strong>Pass</strong>
          </div>
          <div>
            <span>No next owner proposed</span>
            <strong>Pass</strong>
          </div>
          <p>Illustration only. No live reads.</p>
        </div>
      )}
    </div>
  );
}
