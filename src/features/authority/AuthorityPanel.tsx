import { useEffect, useState } from "react";
import type { AuthoritySnapshot, NftRecord } from "../../../sdk/index";
import type { Writ } from "../../chain/types";
import { integrationClient } from "./client";
import { getTemplate } from "../../templates/registry";
import { formatNear } from "../../utils/amounts";
import { useChain } from "../../hooks/useChain";
import { Button } from "../../components/Button/Button";
import { DisclosedBox } from "../../components/DisclosedBox/DisclosedBox";
import s from "./AuthorityPanel.module.css";
const fullKeys = (account: AuthoritySnapshot["target"]) =>
  account.keys?.filter((k) => k.permission === "FullAccess");
export function AuthorityPanel({ writ }: { writ: Writ }) {
  const { mode, deployment, revision } = useChain();
  const template = getTemplate(writ.templateId);
  const [report, setReport] = useState<AuthoritySnapshot | null>(null);
  const [nft, setNft] = useState<NftRecord | null>(null);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (mode === "mock") return;
    let live = true;
    setBusy(true);
    setError("");
    setReport(null);
    setNft(null);
    try {
      const client = integrationClient(deployment);
      void client
        .inspect(writ.id, true)
        .then((result) => {
          if (!live) return;
          setReport(result);
          setNft(result.nft ?? null);
        })
        .catch(() => {
          if (live)
            setError(
              "Some evidence could not be verified. Do not treat missing observations as a clean handover.",
            );
        })
        .finally(() => {
          if (live) setBusy(false);
        });
    } catch {
      setError(
        "The published integration configuration is incomplete. Authority evidence is unavailable.",
      );
      setBusy(false);
    }
    return () => {
      live = false;
    };
  }, [writ.id, mode, deployment, revision, retry]);
  const download = () => {
    if (!report) return;
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(report, null, 2)], { type: "application/json" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `writ-${writ.id}-authority.json`;
    a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <div className={s.panel}>
      <h2>What this NFT controls.</h2>
      <p>{template.description}</p>
      <ul>
        {template.actions.map((action) => (
          <li key={action.method}>
            <strong>{action.label}</strong> <code>{action.method}</code>.{" "}
            {action.lendable
              ? "Can be delegated with exact arguments and an expiry."
              : "Holder only; cannot be lent."}
          </li>
        ))}
      </ul>
      <p>
        Delegation permits repeated calls until expiry or revocation; the target
        may separately reject duplicates. Transferring the Writ ends its
        existing delegations.
      </p>
      <h3>Other ways control could change</h3>
      {mode === "mock" ? (
        <p>
          Example mode: external account keys and artwork integrity have not
          been inspected.
        </p>
      ) : (
        <>
          {busy && (
            <p role="status">Inspecting account permissions and NFT artwork…</p>
          )}
          {error && <p role="alert">{error}</p>}
          {report && (
            <>
              <dl className={s.facts}>
                <div>
                  <dt>Observed at block</dt>
                  <dd>
                    <code>{report.blockHeight}</code>
                  </dd>
                </div>
                <div>
                  <dt>Target code hash</dt>
                  <dd>
                    <code>{report.target.codeHash ?? "Unavailable"}</code>
                  </dd>
                </div>
                <div>
                  <dt>External account balance</dt>
                  <dd>
                    {report.target.balance
                      ? `${formatNear(report.target.balance)} NEAR (includes its storage stake)`
                      : "Unavailable"}
                  </dd>
                </div>
                {[
                  ["External application", report.target],
                  ["Writ collection", report.collection],
                  ["Executor", report.executor],
                ].map(([label, observation]) => {
                  const a = observation as AuthoritySnapshot["target"];
                  const keys = fullKeys(a);
                  return (
                    <div key={String(label)}>
                      <dt>{String(label)} access keys</dt>
                      <dd>
                        {a.keys === null
                          ? "Unavailable"
                          : `${keys?.length ?? 0} full-access; ${a.keys.length - (keys?.length ?? 0)} restricted`}
                        {a.keys?.length ? (
                          <details>
                            <summary>Inspect public permissions</summary>
                            <pre>{JSON.stringify(a.keys, null, 2)}</pre>
                          </details>
                        ) : null}
                      </dd>
                    </div>
                  );
                })}
              </dl>
              {!!fullKeys(report.target)?.length && (
                <p>
                  The external application has full-access keys that can replace
                  its code. NFT ownership does not remove those keys.
                </p>
              )}
              {!!fullKeys(report.collection)?.length && (
                <p>
                  This Writ release retains collection upgrade keys. Their
                  holders can change its authorization code.
                </p>
              )}
              <Button onClick={download}>Download authority evidence</Button>
            </>
          )}
          <Button disabled={busy} onClick={() => setRetry((x) => x + 1)}>
            Refresh authority evidence
          </Button>
        </>
      )}
      <DisclosedBox compact label="Authority evidence limits">
        These are page observations, not extra purchase conditions. Account-key
        checks do not discover hidden contract roles, queued governance actions
        or every upgrade mechanism. No access keys does not, by itself, prove
        exclusive or permanent control. {template.blindSpot}
      </DisclosedBox>
      <h3>Find the NFT in your wallet</h3>
      <dl className={s.facts}>
        <div>
          <dt>Network</dt>
          <dd>{mode === "mock" ? "Example only" : `NEAR ${mode}`}</dd>
        </div>
        <div>
          <dt>Collection</dt>
          <dd>
            <code>{writ.collection}</code>
          </dd>
        </div>
        <div>
          <dt>Token ID</dt>
          <dd>
            <code>{writ.id}</code>
          </dd>
        </div>
        <div>
          <dt>Recorded holder</dt>
          <dd>
            <code>{nft?.owner_id ?? writ.owner}</code>
          </dd>
        </div>
        <div>
          <dt>Artwork integrity</dt>
          <dd>
            {nft
              ? "SHA-256 media hash verified"
              : mode === "mock"
                ? "Not checked in example mode"
                : "Not verified yet"}
          </dd>
        </div>
      </dl>
      <p>
        Use the wallet account shown above on{" "}
        {mode === "mock" ? "the selected network" : mode}. A wallet may need to
        index the collection before showing it in Collectibles. Ownership is
        recorded on-chain even when a wallet has not displayed its picture.
        Wallets may cache older artwork.
      </p>
      {nft && (
        <a href={nft.metadata.media} download={`writ-${writ.id}.svg`}>
          Download verified NFT artwork
        </a>
      )}
      <p>
        <a href="/docs/INTEGRATION_GUIDE.md" target="_blank" rel="noreferrer">
          Use this controller in another application
        </a>
      </p>
    </div>
  );
}
