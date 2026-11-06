import { useEffect, useState } from "react";
import { useAdapter, useChain } from "../../hooks/useChain";
import type { AccountRecovery } from "../../chain/types";
import { formatNear } from "../../utils/amounts";
import { messageOf } from "../../chain/errors";
import { Button } from "../../components/Button/Button";

export function RecoveryPanel() {
  const adapter = useAdapter();
  const { session, revision, changed } = useChain();
  const [data, setData] = useState<AccountRecovery | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let live = true;
    setData(null);
    setError("");
    if (adapter && session)
      void adapter
        .getAccountRecovery(session.accountId)
        .then((v) => {
          if (live) setData(v);
        })
        .catch((e) => {
          if (live) setError(messageOf(e));
        });
    return () => {
      live = false;
    };
  }, [adapter, session, revision]);
  async function withdraw(id?: string, amount?: string) {
    if (!adapter || !data) return;
    setBusy(true);
    setError("");
    try {
      if (id) await adapter.withdrawRetired(id, amount!);
      else await adapter.withdrawCredit(data.credit);
      changed();
    } catch (e) {
      setError(messageOf(e));
    } finally {
      setBusy(false);
    }
  }
  if (!session) return null;
  return (
    <section
      aria-label="Withdrawals and recovery"
      style={{ border: "1px solid", padding: 24, marginBottom: 32 }}
    >
      <h2>Withdrawals &amp; recovery.</h2>
      {data ? (
        <>
          <p>
            Sale proceeds and returned provisioning funds:{" "}
            <code>{formatNear(data.credit)} NEAR</code>.
          </p>
          <Button
            disabled={busy || data.credit === "0"}
            onClick={() => void withdraw()}
          >
            Withdraw credit
          </Button>
          {data.retired.map((r) => (
            <div key={r.id} style={{ marginTop: 20 }}>
              <p>
                Retired Writ {r.id} · <code>{r.executor}</code> ·{" "}
                <code>{formatNear(r.available)} NEAR</code> available.
              </p>
              <Button
                disabled={busy || r.available === "0"}
                onClick={() => void withdraw(r.id, r.available)}
              >
                Recover executor funds
              </Button>
            </div>
          ))}
          <p className="quiet">
            Executor storage and its operating reserve stay in the account.
            Purchase refunds are claimed from their individual purchase record.
          </p>
        </>
      ) : (
        !error && <p role="status">Reading withdrawal balances…</p>
      )}
      {error && (
        <p className="errorText" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
