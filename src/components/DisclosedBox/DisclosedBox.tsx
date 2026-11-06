import { Stamp } from "../Stamp/Stamp";
import s from "./DisclosedBox.module.css";
export function DisclosedBox({
  children,
  compact = false,
}: {
  children: React.ReactNode;
  compact?: boolean;
}) {
  return (
    <aside
      className={`${s.box} ${compact ? s.compact : ""}`}
      aria-label="Disclosed limits"
    >
      <div>
        <Stamp word="DISCLOSED" tone="listed" size="small" rotate={-3} />
      </div>
      <p>{children}</p>
    </aside>
  );
}
