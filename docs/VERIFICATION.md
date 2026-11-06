# Verification ? 6 November 2026

| Check                           | Result                                                                                                                                                                     |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Frontend unit tests             | 44 passed across 8 files. Includes buyer-bound wire arguments, retained storage payment, loan expiry units, direct-transfer deposit and target-loss withdrawal visibility. |
| Mock/unconfigured browser suite | 36 passed, including direct transfer, lending, purchase/refund/recovery, keyboard focus and responsive accessibility.                                                      |
| Actual Wasm/NEAR sandbox        | 9 scenarios passed against the final deployed artifact hashes; 183 transactions recorded, including expected rejected attacks.                                             |
| Live production browser         | 12 route/viewport checks passed at 1440?900 and 390?844 with real testnet RPC data; no page/console errors, no horizontal overflow, zero axe violations in tested views.   |
| Live purchase readback          | Production adapter decoded Settled/Credited and Refused/Paid from actual buyer-bound contract records.                                                                     |
| Production smoke                | Mock purchase, static docs/licenses, real RPC chain identity and real wallet picker passed. Picker cancelled without signing.                                              |
| Build                           | Strict TypeScript, Vite and bundle limits passed. Landing 69,306 gzip JS bytes; all emitted app JS 228,297 bytes (limits 120,000 / 250,000).                               |
| Dependencies                    | npm production audit and separate integration audit reported zero known vulnerabilities at the time checked.                                                               |
| Lint                            | Exited successfully with React lifecycle/ref/purity advisory warnings. Not a warning-free claim.                                                                           |
| Secret scan                     | Commit-candidate scan passed. Credentials, environment files, Wasm/targets, local journals and generated reports remain ignored.                                           |

## On-chain evidence

[Deployment manifest](../deployments/testnet.json) records the collection, executor/template hashes, actual transaction/receipt IDs, gas observations and public recovery handles. Collection: `writ-collection-mw55doim.testnet`.

- Writ 1: upstream Owner handover, real service income, scoped loan, conditional sale, old-holder rejection, new-holder action, income withdrawal, seller proceeds withdrawal and relisting.
- Writ 2: a next owner is deliberately left proposed. The purchase is refused and its native purchase-price refund is paid. Its live condition correctly remains Fail.
- Writ 3: unchanged upstream Sputnik council membership, direct NFT transfer and a vote from the new holder through the same keyless executor.

The old NEAR public endpoint returned a deprecation/rate-limit rejection during deployment. The journal retained completed transactions; the remaining DAO state was checked before resuming on `https://test.rpc.fastnear.com`, listed in the [official provider documentation](https://docs.near.org/api/rpc/providers). Frontend defaults and the generated environment now use that endpoint.

## Reproduction and scope

Run `bash scripts/build-contracts.sh` then `npm --prefix integration test` under Linux/WSL. [contract-verification.json](contract-verification.json) records artifact hashes and measured maximum gas per method from those executed calls. Examples: direct transfer about 9.408 Tgas, purchase about 28.871 Tgas, role execution about 23.755 Tgas and mint about 30.612 Tgas. These are sampled local observations, not worst-case upper bounds or competitor comparisons. The added capacity scenario exercised 64 retained entries, 64-byte account IDs and eight 4,091-byte loans; 78,617 added bytes fit the 131,072-byte allocation, and settlement succeeded. See storage-verification.json; this remains a scenario, not an exhaustive bound.

Run `npm test`, `npm run test:e2e`, `npm run build`. With preview on port 4173, `node scripts/check-production.mjs` checks mock production behavior and `node scripts/check-live.mjs` checks real read flows. Raw local screenshots/reports stay under ignored `.local/live-browser/`; [live-verification.json](live-verification.json) is the public, key-free summary. Actual app-wallet signatures still need a human wallet interaction; public testnet writes were signed programmatically by the local demo accounts. No wallet signature was automated through an app wallet.

The collection full-access deployment key remains local. This is an unaudited testnet prototype, with no mainnet deployment, public hosting, indexer, submitted entry or competitor-winning benchmark claimed. Contract tests establish the executed scenarios, not every possible async schedule, globally atomic external reads, permanent authority, or an exhaustive solvency proof.

Hardening release: the original collection is retained in deployments/testnet-before-hardening.json. The new collection rejects its own infrastructure namespace as NFT recipients. Browser and deployment code reject a mainnet RPC in this testnet-only build. Release-readiness gates remain open in RELEASE_READINESS.md.
