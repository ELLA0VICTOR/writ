import { useEffect, useState } from "react";
import type { Writ, WritStatus } from "../../chain/types";
import { useAdapter, useChain, useTitle } from "../../hooks/useChain";
import { ButtonLink, ModeLink } from "../../components/Button/Button";
import { NftFace } from "../../components/NftFace/NftFace";
import { Loading } from "../../components/Loading/Loading";
import { ErrorSheet } from "../../components/ErrorSheet/ErrorSheet";
import { getTemplate } from "../../templates/registry";
import { writNumber } from "../../utils/amounts";
import s from "./Market.module.css";
import { RecoveryPanel } from "../../features/actions/RecoveryPanel";
export default function Market({ mine = false }: { mine?: boolean }) {
  useTitle(mine ? "My Writs" : "The market");
  const adapter = useAdapter();
  const { session, revision } = useChain();
  const [items, setItems] = useState<Writ[]>([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [kind, setKind] = useState("all");
  const [status, setStatus] = useState("all");
  const [retry, setRetry] = useState(0);
  const [cursor, setCursor] = useState<string | undefined>();
  const [moreBusy, setMoreBusy] = useState(false);
  useEffect(() => {
    if (!adapter) return;
    const abort = new AbortController();
    setBusy(true);
    setError(null);
    if (mine && !session) {
      setItems([]);
      setBusy(false);
      return;
    }
    void adapter
      .listWrits(
        mine ? { owner: session!.accountId } : { listedOnly: true },
        abort.signal,
      )
      .then((result) => {
        if (!abort.signal.aborted) {
          setItems(result.items);
          setCursor(result.nextCursor ?? undefined);
        }
      })
      .catch((reason) => {
        if (!abort.signal.aborted) setError(reason);
      })
      .finally(() => {
        if (!abort.signal.aborted) setBusy(false);
      });
    return () => abort.abort();
  }, [adapter, mine, session, revision, retry]);
  const shown = items.filter(
    (w) =>
      (kind === "all" || w.templateId === kind) &&
      (status === "all" || w.status === status),
  );
  async function more() {
    if (!adapter || !cursor) return;
    setMoreBusy(true);
    try {
      const page = await adapter.listWrits({
        ...(mine ? { owner: session!.accountId } : { listedOnly: true }),
        cursor,
      });
      setItems((old) => [
        ...old,
        ...page.items.filter((w) => !old.some((o) => o.id === w.id)),
      ]);
      setCursor(page.nextCursor ?? undefined);
    } catch (e) {
      setError(e);
    } finally {
      setMoreBusy(false);
    }
  }
  return (
    <div className={`${s.page} appContainer`}>
      <div className={s.heading} data-reveal>
        <div>
          <p className="sectionLabel">
            {mine ? "Your authority, in one place" : "An inspectable handover"}
          </p>
          <h1>{mine ? "My Writs." : "The market."}</h1>
          <p className="lead">
            {mine
              ? "The roles you hold, the actions you have lent, and the next handover."
              : "Look inside before you buy. Every Writ has a holder, a role and declared conditions."}
          </p>
        </div>
        <ButtonLink to="/wrap" variant={mine ? "primary" : "secondary"}>
          Wrap a role
        </ButtonLink>
      </div>
      {mine && <RecoveryPanel />}
      <div className={s.filters}>
        <label>
          Kind of role
          <select value={kind} onChange={(e) => setKind(e.target.value)}>
            <option value="all">All kinds</option>
            {Array.from(new Set(items.map((w) => w.templateId))).map((id) => (
              <option key={id} value={id}>
                {getTemplate(id).name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Status
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="all">All statuses</option>
            {(mine
              ? ["held", "listed", "locked", "lent"]
              : ["listed", "locked"]
            ).map((value) => (
              <option key={value} value={value}>
                {
                  (
                    {
                      held: "Held",
                      listed: "For sale",
                      locked: "In sale",
                      lent: "Lent",
                    } as Record<WritStatus, string>
                  )[value as WritStatus]
                }
              </option>
            ))}
          </select>
        </label>
        <p>
          {!busy && !error
            ? `${shown.length} ${shown.length === 1 ? "Writ" : "Writs"}`
            : "Browsing the collection"}
        </p>
      </div>
      {busy ? (
        <Loading label="Reading the collection…" />
      ) : error ? (
        <ErrorSheet error={error} retry={() => setRetry((v) => v + 1)} />
      ) : shown.length ? (
        <div className={s.grid}>
          {shown.map((writ) => (
            <ModeLink
              key={writ.id}
              to={`/writ/${writ.id}`}
              className={s.cardLink}
              data-reveal
            >
              <NftFace writ={writ} />
              <div>
                <span>{writ.target}</span>
                <span>Inspect Writ {writNumber(writ.id)}</span>
              </div>
            </ModeLink>
          ))}
        </div>
      ) : (
        <div className="emptySheet">
          <h2 className={s.emptyTitle}>
            {mine
              ? "No Writs in your wallet yet."
              : "No Writs match these filters."}
          </h2>
          <p>
            {mine
              ? "You don’t hold any Writs yet. Wrap a role you already hold, or browse the market."
              : "Try another filter, or return after a holder opens a listing."}
          </p>
          <div className="actions">
            <ButtonLink
              to={mine ? "/wrap" : "/market"}
              variant="primary"
              onClick={() => {
                setKind("all");
                setStatus("all");
              }}
            >
              {mine ? "Wrap a role" : "Clear filters"}
            </ButtonLink>
            {mine && <ButtonLink to="/market">Browse the market</ButtonLink>}
          </div>
        </div>
      )}
      {cursor && !busy && !error && (
        <ButtonLink
          to="#"
          onClick={(e) => {
            e.preventDefault();
            if (!moreBusy) void more();
          }}
        >
          {moreBusy ? "Reading…" : "Load more Writs"}
        </ButtonLink>
      )}
    </div>
  );
}
