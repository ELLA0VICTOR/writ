import s from "./Seal.module.css";
export function Seal({ small = false }: { small?: boolean }) {
  return (
    <span className={`${s.seal} ${small ? s.small : ""}`} aria-hidden="true">
      <span>W</span>
    </span>
  );
}
