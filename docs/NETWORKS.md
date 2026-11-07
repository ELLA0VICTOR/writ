# Mainnet and testnet

Writ's browser client and standalone SDK support **NEAR Mainnet and Testnet**. The published demo uses our existing testnet deployment. This repository does not claim that we have deployed or exercised Writ with real mainnet funds.

The organizers explicitly accept testnet-only projects in Q-010 of [the official hackathon brief](https://nearhackathon.com/HACKATHON.md), except integrations that exist only on mainnet. Writ does not use a mainnet-only integration. A mainnet deployment is not required for our NFT-track demonstration.

## Use your own deployment in the hosted app

1. Open **Network & deployment** in the top banner.
2. Select **NEAR Mainnet** or **NEAR Testnet**.
3. Enter an existing **Writ collection/controller account** on that network. Alternatively, import its public JSON manifest.
4. Select **Verify deployment**. The app reads the RPC chain ID and checks collection bytecode, ABI, executor bytecode and all five template hashes against this client release. This works before the first NFT is minted.
5. Select **Use verified deployment**, reconnect a compatible wallet and open **Wrap a role**. Enter your existing compatible external contract there.

No frontend rebuild is required. The selection persists in this browser. Switching networks or controllers clears the app's active wallet session and resets forms; reconnect deliberately. Settings cannot be applied while a wallet request is outstanding. Old preflights are invalidated before signing. An empty mainnet selection displays an unconfigured state and disables Writ actions; it never falls back to our testnet controller. **Restore default testnet demo** returns to the bundled demo configuration.

A game, collection, service, token or DAO account is the **target**, not the Writ collection. The target and a Writ controller must both exist on the chosen network. You can use a compatible Writ controller that another team operates, or deploy one yourself. The app cannot operate a testnet controller against a mainnet target or move testnet NFTs/balances to mainnet.

The five supported profiles still require their documented contract interfaces. Selecting mainnet does not add support for arbitrary contract APIs. No NFT is minted automatically just by changing networks or verifying an address.

## Deploy a new Writ collection yourself

This is an operator-run procedure, not a deployment performed by Writ's maintainers. An existing compatible controller needs no redeployment.

1. Review the collection/executor source, supported templates, target permissions and [upgrade-authority risks](RELEASE_READINESS.md). Choose a new named account you control on the chosen network. Keep its ID at most **41 characters**, leaving space for `w` plus a 20-digit token ID and a dot within NEAR's 64-character account limit. Fund storage and gas with your own budget; inspect fresh quotes rather than assuming demo costs apply.
2. Use the reviewed `artifacts/collection.wasm`. It embeds the executor, role templates and compatible practice-target Wasm; those do not need separate shared deployments. Existing external targets stay in place. Artifacts are generated locally, not committed. Follow the README's contract build instructions if they are absent. A new compiler/build may produce different bytes; the client intentionally rejects an unknown release until reviewed hashes and release evidence are updated.
3. On a **fresh empty account**, deploy the collection and initialize **`new` with `{}`** in the same transaction. `new` has no owner/network argument. Do not overwrite another application's account or call `new` on an initialized collection.

For operators with the Rust [NEAR CLI](https://github.com/near/near-cli-rs/blob/main/docs/GUIDE.en.md#deploy---add-a-new-contract-code) installed and their chosen account already available in their own secure keychain, this is the command shape (replace the account; this spends that account's funds):

```sh
near contract deploy writ.your-team.near use-file artifacts/collection.wasm with-init-call new json-args '{}' prepaid-gas '100 Tgas' attached-deposit '0 NEAR' network-config mainnet sign-with-keychain send
```

Use your testnet account and `network-config testnet` for a rehearsal. The account must already have enough NEAR for Wasm/state storage plus gas; the attached zero is the initialization deposit, not a claim of free deployment. Review upgrade keys before exposing a public controller. Never paste a key into the frontend, manifest or repository. The existing `integration/deploy-testnet.mjs` helper is deliberately testnet-only; do not repurpose it by replacing its RPC URL.

4. Open **Network & deployment** and verify the new collection address. If verification fails, stop and compare the actual deployed artifact/configuration to the reviewed release. Do not substitute its unreviewed hash just to bypass the check.
5. Download the verified public configuration and share it with your users. Perform a small, budgeted real-wallet lifecycle on your deployment before relying on it with valuable roles. Automated simulated mainnet checks are not a mainnet signed rehearsal or independent audit.

## Public manifest

An address-only manifest is enough; this frontend supplies the pinned release hashes and the default public RPC for that network:

```json
{
  "network": "mainnet",
  "collection": "writ.your-team.near"
}
```

That account is a **placeholder**, not an existing deployment. A downloaded verified manifest also includes `rpcUrl`, `abiVersion`, `collectionCodeHash`, `executorCodeHash` and `templateHashes`. Imported hashes must match the reviewed client release. Unknown fields are discarded, not persisted or exported. Public HTTPS endpoints must not contain credentials or query parameters. Verification uses the chosen RPC as its chain observation source, so choose an endpoint you trust.

Legacy `VITE_WRIT_*`/`VITE_NEAR_RPC_URL` overrides remain **testnet defaults only**. They never silently become mainnet configuration. Runtime settings take precedence until reset. Every `VITE_` variable is public; use no private keys or secret provider tokens.

Wallet discovery, connector storage, session flags, purchase recovery, practice requests, transaction confirmation and explorer links follow the selected network. Wallet session and purchase recovery also include the collection identity. Legacy testnet practice/purchase attempts are recovered only within their matching testnet deployment. V1 collection settlement JSON contains a legacy `testnet` source label; the frontend derives its displayed network from the checked RPC chain ID, without modifying block/transaction evidence or the deployed Wasm.

## External applications and SDK

Pass `network: "mainnet"` or `"testnet"`, the public RPC and reviewed deployment hashes to `new WritClient(...)`. `verifyDeployment()` is a read-only release check requiring no token ID. `inspect`, `buildAction` and `confirmAction` check the selected network and deployment. Wallet signing remains the caller's responsibility and must use that same network.

For the separate example app, set an optional **public** manifest path before starting/building:

```powershell
$env:WRIT_EXAMPLE_DEPLOYMENT = 'C:\path\to\writ-mainnet-deployment.json'
npm run example
```

The prepare step validates the release and writes public fields only. Without that variable, it prepares the bundled testnet release. The example uses the manifest's network for wallet discovery/signing, RPC and labels. Restart/rebuild that separate example after changing its manifest; the main Writ app's settings need no rebuild.

## Verification limits

Mainnet configuration and signing guards are tested with controlled RPC/wallet responses, including rejected wrong-network endpoints, replaced bytecode, stale preflights, session separation, recovery identity and no duplicate submission. Browser checks cover switching, verification/import, persistence and mobile accessibility. The unchanged contracts and SDK are also exercised on a local NEAR sandbox; the public release has real testnet receipts. **No mainnet contract deployment or mainnet transaction is claimed.** Independent review, an operator's upgrade policy and an actual small-value mainnet rehearsal remain deployment responsibilities.
