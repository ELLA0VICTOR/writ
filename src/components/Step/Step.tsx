import s from "./Step.module.css";
export function Step({
  number,
  title,
  body,
  signer,
  contract = false,
}: {
  number: number;
  title: string;
  body: string;
  signer: string;
  contract?: boolean;
}) {
  return (
    <article className={s.step}>
      <span className={s.number}>{number}</span>
      <h3>{title}</h3>
      <p>{body}</p>
      <div className={s.signer}>
        <span>Signed off by</span>
        <span className={contract ? s.contract : s.person}>{signer}</span>
      </div>
    </article>
  );
}
