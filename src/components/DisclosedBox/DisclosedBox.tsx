import { Stamp } from "../Stamp/Stamp";
import s from "./DisclosedBox.module.css";
export function DisclosedBox({
  children,
  compact = false,
  label = "Disclosed limits",
}: {
  children: React.ReactNode;
  compact?: boolean;
  label?: string;
}) {
  return (
    <aside
      className={`${s.box} ${compact ? s.compact : ""}`}
      aria-label={label}
    >
      <div>
        <Stamp word="DISCLOSED" tone="listed" size="small" rotate={-3} />
      </div>
      <p>{children}</p>
    </aside>
  );
}
