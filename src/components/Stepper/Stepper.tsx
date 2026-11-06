import s from "./Stepper.module.css";
export function Stepper({
  steps,
  current,
}: {
  steps: string[];
  current: number;
}) {
  return (
    <ol className={s.steps} aria-label="Wrap progress" tabIndex={0}>
      {steps.map((step, i) => (
        <li
          key={step}
          className={i === current ? s.current : i < current ? s.done : s.later}
          aria-current={i === current ? "step" : undefined}
        >
          <span className={s.number}>{i + 1}</span>
          <span>
            {step}
            {i < current && <small>Completed</small>}
          </span>
        </li>
      ))}
    </ol>
  );
}
