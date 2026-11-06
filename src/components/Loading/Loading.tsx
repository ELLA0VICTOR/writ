import s from "./Loading.module.css";
export function Loading({
  label = "Reading the chain…",
  bar = false,
}: {
  label?: string;
  bar?: boolean;
}) {
  return (
    <div className={s.loading} role="status">
      {bar ? <div className={s.bar} /> : <span className={s.spinner} />}
      <span>{label}</span>
    </div>
  );
}
export function Skeleton() {
  return <div className={s.skeleton} role="status" aria-label="Loading Writ" />;
}
