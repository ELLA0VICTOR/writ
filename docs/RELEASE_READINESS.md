# Release readiness, 6 November 2026

The feature checklist is not a mainnet safety approval. Work remains before a mainnet release. Testnet remains the demonstration network. No mainnet funds have been spent or deployment authorized by this document.

## What Writ actually transfers

A target application gives a role to a dedicated account. The NFT identifies who may instruct that account through Writ's declared actions. Transferring the NFT updates that authorization and invalidates old loans; it does not move the target role to the buyer's wallet on every sale. Hand-back is a separate verified operation. Payment is optional: ordinary transfers work without a sale.

The former NFT holder loses Writ's authorization. Writ cannot erase an independent role, key or governance permission held outside Writ. A Sputnik executor has one council membership; it is not the whole DAO, and other members may remain. DAO wrapping currently adds a dedicated executor membership rather than automatically deleting the initiating person's separate seat.

## Compatibility and breadth

There are two implemented, tested adapters, with any number of NFTs/compatible targets. This is not universal role support. The owner adapter currently exposes the demonstrated `set_price` and `own_propose_owner` actions. A target merely calling something "owner" is not enough. Custom APIs, other actions, paid actions and other chains require explicit adapters and testing. Native NEAR is the supported executor asset; arbitrary FT/NFT inventory control is not implemented.

For broader compatibility, the next architecture should let reviewed, immutable adapter versions describe grants, predicates, exact actions and hand-back recipes. Existing NFTs must pin the adapter version. The current two compiled templates are not an open runtime registry; removing collection upgrade authority now would freeze that limitation into that release. Do not add cosmetic role labels and claim working integrations.

## Findings addressed in this hardening pass

- Reproduced a direct transfer into the NFT's own keyless executor. It could strand control. The patched contract rejects the collection and its entire internal namespace as NFT recipients. Both transfer paths and buyer validation share the guard. The frontend rejects such recipients before asking for a signature.
- Added an explicit testnet chain-ID check in the adapter and deployment helper. A mainnet RPC accidentally supplied to this testnet-only build now fails before signing or deployment.
- Exercised 64 retained entries, 640-byte UTF-8 transfer notes, 64-byte account IDs, eight 4,091-byte loan arguments, refusal and successful settlement. Observed collection state increase: 78,617 bytes against 131,072 funded bytes. This is an actual capacity case, not an exhaustive proof of every state.
- Regression suites now include recipient safety and capacity. Current run details and binary hashes are in `contract-verification.json`; storage measurements are in `storage-verification.json`. Older deployment evidence is retained separately rather than relabelled as the patched artifact.

## Gates before filming

- [ ] Complete one end-to-end run through an actual app wallet: connect, provisioning, mint, grant, use, lend, transfer, conditional purchase, refund, withdrawal and resumable hand-back. Programmatic signers plus browser readback are not this test.
- [ ] Close any failures from that wallet run and freeze a demo build with matching deployed code and frontend configuration.
- [ ] Prepare and rehearse the video: explain the authority transfer first; show a normal transfer, old-holder rejection, and an optional refused purchase/refund. Label every testnet transaction honestly.

## Gates before mainnet

- [ ] Decide which additional adapters, if any, must ship. Verify real target behavior rather than promising every role.
- [ ] Complete an independent contract review of the exact release artifact. Current automated scenarios and this review do not constitute an independent audit.
- [ ] Decide collection upgrade authority. A full-access deployment key can replace collection code and change executor authorization. Mainnet must have a reviewed immutability or controlled-upgrade policy. Do not destroy keys during unfinished development.
- [ ] Review actual target code, external upgrade keys, queued changes and sovereign governance. Declared predicate checks do not establish permanent or exclusive authority. External reads happen asynchronously.
- [ ] Finish mainnet-specific wallet, RPC, explorer, network labels and evidence configuration. Changing only the RPC URL is insufficient; this build intentionally refuses mainnet.
- [ ] Optimize and remeasure code/storage costs. Current per-Writ record allocation is deliberately conservative and retained. Do not describe it as an automatically refundable deposit.
- [ ] Present the exact mainnet deployment topology, quoted funding and maximum spend for user approval. Current 12-15 NEAR planning range covers one small release with one Writ and optional practice target, not all demo accounts, a new DAO or multiple NFTs.
- [ ] Deploy fresh mainnet accounts/NFTs from the approved tested build, verify hashes, perform small-value checks, then publish the mainnet configuration. Testnet assets and balances do not become mainnet assets.

No finite test suite establishes that software is perfect, cannot be improved or has no remaining loopholes. Release readiness means bounded claims, demonstrated scenarios, reviewed authority and no unresolved release-blocking findings.
