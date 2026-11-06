import type { HistoryEntry } from "../../chain/types";
import { utcDate } from "../../utils/amounts";
import s from "./LedgerPaper.module.css";
export function LedgerPaper({
  entries,
  label,
}: {
  entries: HistoryEntry[];
  label: string;
}) {
  return (
    <div className={s.paper}>
      <p className={s.label}>{label}</p>
      <ol className={s.rows}>
        {entries.map((entry) => (
          <li key={entry.id} className={entry.refused ? s.refused : ""}>
            <time dateTime={entry.at}>{utcDate(entry.at)}</time>
            <strong>{entry.event}</strong>
            <span>{entry.detail}</span>
          </li>
        ))}
      </ol>
      {entries.length === 0 && (
        <p className={s.empty}>No events have been recorded yet.</p>
      )}
    </div>
  );
}
