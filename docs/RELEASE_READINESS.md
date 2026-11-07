# Release readiness, updated 7 November 2026

The feature checklist is not a mainnet safety approval. Work remains before a mainnet release. Testnet remains the demonstration network. No mainnet funds have been spent or deployment authorized by this document.

## What Writ actually transfers

A target application gives a role to a dedicated account. The NFT identifies who may instruct that account through Writ's declared actions. Transferring the NFT updates that authorization and invalidates old loans; it does not move the target role to the buyer's wallet on every sale. Hand-back is a separate verified operation. Payment is optional: ordinary transfers work without a sale.

The former NFT holder loses Writ's authorization. Writ cannot erase an independent role, key or governance permission held outside Writ. A Sputnik executor has one council membership; it is not the whole DAO, and other members may remain. DAO wrapping currently adds a dedicated executor membership rather than automatically deleting the initiating person's separate seat.

## Compatibility and breadth

There are five implemented, tested profiles: service ownership, Sputnik council membership, NFT collection administration, token issuance and native-NEAR treasury control. The three new profiles use upstream Owner plus explicit application-specific APIs; they are not three additional universal permission standards. Upstream NEP-171/177/181 and NEP-141/148 components power the example token contracts. A target merely calling something "owner" is not enough. Other APIs, paid actions and other chains require reviewed adapters and tests. Native NEAR is the supported executor asset; arbitrary FT/NFT inventory control is not implemented.

All five compiled template versions describe exact predicates, actions and hand-back support. NFTs pin their template hash. The standalone SDK and separate example application let external frontends use the same controllers. An open runtime adapter registry is not implemented or required for this release; supporting a new API requires a reviewed release. Removing collection upgrade authority freezes this release's interfaces.

## Findings addressed in this hardening pass

- Reproduced a direct transfer into the NFT's own keyless executor. It could strand control. The patched contract rejects the collection and its entire internal namespace as NFT recipients. Both transfer paths and buyer validation share the guard. The frontend rejects such recipients before asking for a signature.
- Added selected-network chain-ID checks in the browser adapter, standalone SDK and wallet preflight. A mainnet endpoint with a testnet selection (or the reverse) fails before signing. The deployment helper remains deliberately testnet-only.
- Exercised 64 retained entries, 640-byte UTF-8 transfer notes, 64-byte account IDs, eight 4,091-byte loan arguments, refusal and successful settlement. Observed collection state increase: 78,617 bytes against 131,072 funded bytes. This is an actual capacity case, not an exhaustive proof of every state.
- Regression suites now include recipient safety and capacity. Current run details and binary hashes are in `contract-verification.json`; storage measurements are in `storage-verification.json`. Older deployment evidence is retained separately rather than relabelled as the patched artifact.
- Added and exercised three external application profiles, including actual collectible creation, fungible-token issuance, treasury payments, direct old-wallet rejection and verified hand-back.
- NFT artwork now includes the required base64 SHA-256 `media_hash`. The SDK verifies its bytes and pins collection code before preparing a command. The frontend refuses writes if collection code differs from the published release.
- Public release configuration is included in source without signing material, so a clean frontend deployment connects without local environment files. Explicit environment overrides replace that configuration rather than mixing identities.

## Gates before filming

- [x] Complete one end-to-end run through an actual app wallet. Intear Wallet approved mint, role grant, use, lending, transfer, purchase, refund, withdrawal and resumable hand-back with generated testnet accounts. The separate external app also executed a command. See [18 verified receipts](wallet-verification.json). Practice provisioning and wallet collectible display were inspected in the browser; their screenshots remain local.
- [x] Close the wallet-run findings and match the demo build to the deployed collection, executor and five template hashes. Static deployment uses the public configuration in source; local signing credentials are excluded. Other wallet vendors have not completed this same signed rehearsal.
- [x] Prepare and rehearse the narrated video with real browser-wallet testnet transactions, transfer, optional refused purchase/refund, separate SDK application and hand-back. The final video and receipts are in `submission/`; private capture material remains ignored locally.

## Gates before mainnet

- [x] Select and test the five release profiles. Keep unsupported staking-pool ownership out of the live selector.
- [ ] Complete an independent contract review of the exact release artifact. Current automated scenarios and this review do not constitute an independent audit.
- [ ] Decide collection upgrade authority. A full-access deployment key can replace collection code and change executor authorization. Mainnet must have a reviewed immutability or controlled-upgrade policy. Do not destroy keys during unfinished development.
- [ ] Review actual target code, external upgrade keys, queued changes and sovereign governance. Declared predicate checks do not establish permanent or exclusive authority. External reads happen asynchronously.
- [x] Add runtime mainnet/testnet wallet, RPC, explorer, labels and public deployment settings with release verification, session/recovery separation and stale-signature guards. Mainnet can use an operator-supplied compatible Writ deployment without rebuilding the app. Controlled mainnet tests do not replace a real signed rehearsal. See [NETWORKS.md](NETWORKS.md).
- [x] Remeasure the tested release's code/storage costs. Current per-Writ record allocation is deliberately conservative and retained. Do not describe it as an automatically refundable deposit. Any later size or topology change requires a fresh quote.
- [ ] For an operator choosing to deploy mainnet: quote and fund their exact deployment topology, then verify hashes and perform a small-value signed lifecycle before publishing their configuration. The maintainers are not deploying or funding mainnet for this submission. See `mainnet-cost-estimate.json` for a dated planning-only estimate. Testnet assets and balances do not become mainnet assets.

Mainnet deployment is not a hackathon submission gate: official Q-010 permits testnet-only projects except mainnet-only integrations. The NFT-track demo and video remain on testnet. Mainnet deployment/review gates apply to an operator's future mainnet release, not to an obligation to spend funds for this submission.

No finite test suite establishes that software is perfect, cannot be improved or has no remaining loopholes. Release readiness means bounded claims, demonstrated scenarios, reviewed authority and no unresolved release-blocking findings.
