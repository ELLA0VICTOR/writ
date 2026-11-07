import { Link, useLocation } from "react-router-dom";
import { useChain } from "../../hooks/useChain";
import { lazy, Suspense, useState } from "react";
import s from "./ModeBanner.module.css";
const DeploymentDialog = lazy(
  () => import("../DeploymentDialog/DeploymentDialog"),
);
export function ModeBanner() {
  const [settings, setSettings] = useState(false);
  const {
    mode,
    deployment,
    session,
    connect,
    disconnect,
    getAdapter,
    changed,
    requestPending,
    walletBusy,
  } = useChain();
  const location = useLocation();
  if (mode !== "mock")
    return (
      <aside className={s.testnet} aria-label="Network">
        <span>
          {mode === "testnet"
            ? "NEAR testnet prototype. No real value."
            : "NEAR mainnet. Real funds."}{" "}
          {!deployment.collection && "No Writ deployment connected."}
        </span>
        <button
          className={s.settings}
          onClick={() => setSettings(true)}
          disabled={requestPending || walletBusy}
        >
          Network & deployment
        </button>
        <Link to={`${location.pathname}?mock=1`}>
          Try the interactive examples
        </Link>
        {settings && (
          <Suspense fallback={<span role="status">Opening settings…</span>}>
            <DeploymentDialog onClose={() => setSettings(false)} />
          </Suspense>
        )}
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
