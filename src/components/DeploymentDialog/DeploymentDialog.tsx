import { useState, type ChangeEvent, type FormEvent } from "react";
import { Dialog } from "../Dialog/Dialog";
import { Button } from "../Button/Button";
import { useChain } from "../../hooks/useChain";
import {
  parseDeployment,
  releaseConfig,
  rpcUrls,
  type DeploymentConfig,
  type NearNetwork,
} from "../../chain/deployment";
import { integrationClient } from "../../features/authority/client";
import { messageOf } from "../../chain/errors";
import s from "./DeploymentDialog.module.css";

export default function DeploymentDialog({ onClose }: { onClose: () => void }) {
  const { deployment, selectDeployment, walletBusy, requestPending } =
    useChain();
  const [network, setNetwork] = useState(deployment.network);
  const [collection, setCollection] = useState(deployment.collection);
  const [rpcUrl, setRpcUrl] = useState(deployment.rpcUrl);
  const [verified, setVerified] = useState<DeploymentConfig | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [evidence, setEvidence] = useState("");
  const disabled = busy || walletBusy || requestPending;
  function invalidate() {
    setVerified(null);
    setEvidence("");
    setError("");
  }
  async function verify(event: FormEvent) {
    event.preventDefault();
    invalidate();
    setBusy(true);
    try {
      const config = parseDeployment({
        network,
        collection: collection.trim(),
        rpcUrl: rpcUrl.trim(),
      });
      const result = await integrationClient(config).verifyDeployment();
      setVerified(config);
      setEvidence(
        `Verified NEAR ${config.network}, block ${result.height}. Collection code, ABI, executor and all five role templates match this client release.`,
      );
    } catch (e) {
      setError(messageOf(e));
    } finally {
      setBusy(false);
    }
  }
  async function apply(config: DeploymentConfig | null) {
    setBusy(true);
    setError("");
    try {
      await selectDeployment(config);
      onClose();
    } catch (e) {
      setError(messageOf(e));
      setBusy(false);
    }
  }
  async function importManifest(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    invalidate();
    setBusy(true);
    try {
      if (file.size > 1_000_000)
        throw new Error("Use a public deployment manifest smaller than 1 MB.");
      const config = parseDeployment(JSON.parse(await file.text()));
      setNetwork(config.network);
      setCollection(config.collection);
      setRpcUrl(config.rpcUrl);
    } catch (e) {
      setError(messageOf(e));
    } finally {
      setBusy(false);
    }
  }
  function download() {
    if (!verified) return;
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(verified, null, 2)], {
        type: "application/json",
      }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `writ-${verified.network}-deployment.json`;
    a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <Dialog title="Network & deployment" onClose={onClose}>
      <p>
        Use the public testnet demo, or connect your team's compatible Writ
        deployment on NEAR mainnet or testnet.
      </p>
      <p>
        Enter the <strong>Writ collection/controller account</strong> here. You
        connect your existing game, collection or DAO separately through{" "}
        <strong>Wrap a role</strong>. Both contracts must be on the same
        network.
      </p>
      <form onSubmit={(event) => void verify(event)} className={s.form}>
        <label>
          Network
          <select
            aria-label="Network"
            value={network}
            disabled={disabled}
            onChange={(event) => {
              const next = event.target.value as NearNetwork;
              setNetwork(next);
              setCollection("");
              setRpcUrl(rpcUrls[next]);
              invalidate();
            }}
          >
            <option value="testnet">NEAR Testnet</option>
            <option value="mainnet">NEAR Mainnet</option>
          </select>
        </label>
        <label>
          Writ collection account
          <input
            value={collection}
            disabled={disabled}
            onChange={(e) => {
              setCollection(e.target.value);
              invalidate();
            }}
            placeholder={
              network === "mainnet"
                ? "writ.your-team.near"
                : "writ.your-team.testnet"
            }
            autoCapitalize="none"
            spellCheck={false}
            required
            maxLength={41}
          />
        </label>
        <details>
          <summary>Public RPC endpoint</summary>
          <label>
            HTTPS RPC URL
            <input
              type="url"
              value={rpcUrl}
              disabled={disabled}
              onChange={(e) => {
                setRpcUrl(e.target.value);
                invalidate();
              }}
              required
            />
          </label>
          <p>Use a trusted public endpoint. Do not enter API secrets.</p>
        </details>
        <label>
          Import public deployment JSON
          <input
            type="file"
            accept=".json,application/json"
            disabled={disabled}
            onChange={(event) => void importManifest(event)}
          />
        </label>
        <p>
          Verification reads the chain. It does not deploy a contract or spend
          NEAR. A different Writ release needs a reviewed client update. Code
          verification does not remove any deployment operator's upgrade
          authority.
        </p>
        {error && (
          <p role="alert" className="errorText">
            {error}
          </p>
        )}
        {evidence && (
          <p role="status" className={s.verified}>
            {evidence}
          </p>
        )}
        <div className="actions">
          <Button type="submit" disabled={disabled}>
            {busy ? "Checking…" : "Verify deployment"}
          </Button>
          {verified && (
            <Button
              type="button"
              variant="primary"
              disabled={disabled}
              onClick={() => void apply(verified)}
            >
              Use verified deployment
            </Button>
          )}
          {verified && (
            <Button type="button" disabled={disabled} onClick={download}>
              Download public config
            </Button>
          )}
        </div>
      </form>
      <div className={s.alternatives}>
        {!collection && (
          <Button
            disabled={disabled}
            onClick={() => void apply(releaseConfig(network))}
          >
            View {network} without a deployment
          </Button>
        )}
        <Button disabled={disabled} onClick={() => void apply(null)}>
          Restore default testnet demo
        </Button>
        <a href="/docs/NETWORKS.md" target="_blank" rel="noreferrer">
          Deploy your own Writ controller
        </a>
      </div>
      <p className={s.note}>
        Mainnet uses real funds. Your selection is saved in this browser. No
        private keys belong in this form or its JSON file.
      </p>
    </Dialog>
  );
}
