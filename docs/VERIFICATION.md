# Verification — 6 November 2026

| Check                           | Result                                                                                                                                                                                                                                |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Frontend unit tests             | 48 passed across 9 files, including buyer-bound requests, unresolved provisioning, role/delegation rules and a shared public-RPC read budget.                                                                                         |
| Mock/unconfigured browser suite | 41 passed: all five profile flows, direct transfer, lending, purchase/refund/recovery, keyboard focus, responsive accessibility and denied local credential paths.                                                                    |
| Actual Wasm / NEAR sandbox      | 14 scenarios passed against the recorded release artifacts; 256 transactions recorded, including expected rejected attacks. The standalone-client scenario also passed again after the final SDK changes.                             |
| Actual app-wallet lifecycle     | 18 final receipts independently re-read after real Intear Wallet approvals. Mint, grant/resume, use, lending, funding, withdrawal, transfer, purchase, refusal/refund and hand-back/recovery were exercised.                          |
| External application            | A separate origin and wallet connection executed a real role command through the standalone SDK, without Writ React components. See wallet-verification.json.                                                                         |
| Production builds               | Strict TypeScript and both Vite builds passed. Landing: 70,901 gzip JS bytes; all emitted app JS: 236,033 bytes (limits 120,000 / 250,000).                                                                                           |
| Lint                            | Exits successfully with React lifecycle/ref/purity advisory warnings; this is not a warning-free claim.                                                                                                                               |
| Git safety                      | Commit-candidate pattern scan passed. Local credentials, wallet profiles, environment files, Wasm, dependency/build directories and raw screenshots remain ignored. No files were staged, committed or pushed by this implementation. |

The final live production sweep passed **18 route/viewport checks** at 1440 and 390 pixels: all five profile pages, the deliberately refused-sale example, landing, market and wrap. Tested views had no page/console errors, horizontal overflow or axe violations. The real settled purchase and refused/paid refund also decoded correctly. See [live-verification.json](live-verification.json).

The separate app's final read-only browser check also passed, with verified artwork, signing disabled while disconnected, zero axe violations and a denied local credential path. See [external-app-verification.json](external-app-verification.json); its actual signed command is recorded separately in the wallet evidence. A [clean static build](published-build-verification.json) passed real testnet reads without loading local environment files.

## On-chain evidence

The [deployment manifest](../deployments/testnet.json) records public identities, template/code hashes, genuine receipt IDs and the six initial example NFTs. Collection: `writ-collection-mw5cm75f.testnet`.

- Writ 1: service ownership, scoped delegation, sale and income. This is the landing page's live Owner example.
- Writ 2: a deliberately pending successor. Conditional purchases are refused; purchase-price refunds were actually withdrawn.
- Writ 3: one council membership in unchanged upstream Sputnik DAO. This is not sole DAO ownership.
- Writ 4: collection administration, including an actual upstream NEP-171 collectible minted to Bob. Bob subsequently purchased the Writ through the real wallet UI.
- Writ 5: compatible token issuance, including 25 actual upstream NEP-141 credits issued to Bob.
- Writ 6: native-NEAR treasury control, with actual funding and payout. Target treasury funds are separate from executor funds.
- Writ 7: created for the signed browser rehearsal, transferred to Bob and used from the external app. It was then unwrapped and retired; the target now directly names Bob as owner and available executor funds were recovered to zero. It is no longer an active live example. The independent mock illustration still uses token ID 7.

[wallet-verification.json](wallet-verification.json) contains the 18 signed transaction hashes and current readback. Intear's Collectibles page displayed all five profile types and their Writ artwork. The practice-account creation was observed in the browser but its initial transaction hash was not captured in that packet. Screenshots and the generated-wallet profile remain local under ignored `.local/`. These checks establish Intear compatibility for this testnet run; other vendors have not completed the same signed rehearsal. Meteor's website was blocked by its external browser challenge during the attempt.

## Scope and reproduction

Run `bash scripts/build-contracts.sh` and `npm --prefix integration test` under Linux/WSL. [contract-verification.json](contract-verification.json) records actual artifact hashes and sampled gas observations. The added profiles exercise real external NFT/FT/native-money effects, old-wallet rejection, transfer and verified hand-back. The standalone-client scenario checks exact signed actions, old-holder rejection, pinned hashes and artwork integrity. These are executed scenarios, not worst-case gas bounds, an independent audit or competitor benchmarks.

[storage-verification.json](storage-verification.json) records a capacity case with 64 retained entries, 64-byte account IDs and eight 4,091-byte loans. The observed 78,617-byte increase fit the 131,072-byte record allocation and settlement succeeded; this is not an exhaustive storage proof.

Run `npm test`, `npm run test:e2e`, `npm run build` and `npm run example:build`. With preview on port 4173, `node scripts/check-production.mjs` checks static assets, the mock purchase and wallet picker; `node scripts/check-live.mjs` checks real public pages. With the separate app on 5174, `node scripts/check-example.mjs` checks its read-only browser flow. `node scripts/check-published-build.mjs` builds with no local environment files and checks the source-supplied public configuration. Public summaries are recorded separately; raw browser output remains ignored.

Public RPC availability is an external dependency. An initial expanded live sweep rendered its views but failed the strict console check when the free provider rate-limited requests without CORS headers. The app and SDK now share a conservative per-endpoint read queue, with bounded concurrency and spaced starts. Missing evidence never becomes Pass. No wallet write is automatically repeated.

The deployment key remains a collection upgrade authority. This is an unaudited testnet prototype, with no mainnet deployment, public hosting, production indexer, recorded submission video or submitted hackathon entry claimed. Other APIs and target contracts require reviewed adapters; the three added profiles are compatible application APIs, not universal token-administration standards. [RELEASE_READINESS.md](RELEASE_READINESS.md) retains the mainnet review, authority, network and spending gates.
