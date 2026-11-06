import { Link, useLocation } from "react-router-dom";
import { useChain } from "../../hooks/useChain";
import s from "./ModeBanner.module.css";
export function ModeBanner() {
  const { mode, session, connect, disconnect, getAdapter, changed } =
    useChain();
  const location = useLocation();
  if (mode !== "mock")
    return (
      <aside className={s.testnet} aria-label="Network">
        <span>NEAR testnet prototype. No real value.</span>
        <Link to={`${location.pathname}?mock=1`}>
          Try the interactive examples
        </Link>
      </aside>
    );
  return (
    <aside className={s.banner} aria-label="Example settings">
      <div>
        <strong>Example mode</strong>
        <span>Fixture data. No funds move and no transactions are sent.</span>
      </div>
      <div className={s.controls}>
        <label>
          Example viewer
          <select
            aria-label="Example viewer"
            value={session?.accountId ?? ""}
            onChange={(e) =>
              void (e.target.value ? connect(e.target.value) : disconnect())
            }
          >
            <option value="">Visitor</option>
            <option value="ben.testnet">Ben, buyer</option>
            <option value="ada.testnet">Ada, holder</option>
            <option value="sam.testnet">Sam, borrower</option>
          </select>
        </label>
        <button
          onClick={() =>
            void getAdapter().then(async (a) => {
              a.resetMock?.();
              await disconnect();
              changed();
            })
          }
        >
          Reset examples
        </button>
        <Link to={location.pathname}>Exit examples</Link>
      </div>
    </aside>
  );
}
