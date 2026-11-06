import type { ReactNode } from "react";
import s from "./FieldList.module.css";
export function FieldList({
  fields,
}: {
  fields: { label: string; value: ReactNode; typed?: boolean }[];
}) {
  return (
    <dl className={s.fields}>
      {fields.map((field) => (
        <div key={field.label}>
          <dt>{field.label}</dt>
          <dd className={field.typed ? "typed" : ""}>{field.value}</dd>
        </div>
      ))}
    </dl>
  );
}
