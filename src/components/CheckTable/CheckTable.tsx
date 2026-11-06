import type { CheckResult } from "../../chain/types";
import { displayValue } from "../../utils/amounts";
import s from "./CheckTable.module.css";
export function CheckTable({
  rows,
  caption = "Conditions and values read",
}: {
  rows: CheckResult[];
  caption?: string;
}) {
  return (
    <div className={s.scroll} role="region" aria-label={caption} tabIndex={0}>
      <table className={s.table}>
        <caption className="srOnly">{caption}</caption>
        <thead>
          <tr>
            {["Check", "Asked", "Value read", "Needed", "Result"].map(
              (label) => (
                <th scope="col" key={label}>
                  {label}
                </th>
              ),
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className={row.result === "fail" ? s.failed : ""}>
              <th scope="row">
                {row.label}
                {row.enforcedBy === "page" && <small>Page only</small>}
              </th>
              <td>
                <code>{row.method}</code>
              </td>
              <td>
                <code>
                  {row.result === "unavailable"
                    ? "Not verified"
                    : displayValue(row.actual)}
                </code>
              </td>
              <td>
                <code>{displayValue(row.expected)}</code>
              </td>
              <td
                className={
                  row.result === "pass"
                    ? s.pass
                    : row.result === "fail"
                      ? s.fail
                      : s.unknown
                }
              >
                {row.result === "pass"
                  ? "Pass"
                  : row.result === "fail"
                    ? "Fail"
                    : "Unavailable"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
