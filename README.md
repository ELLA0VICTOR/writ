# Writ

Transfer an NFT, and transfer who can exercise an on-chain role. The role stays with the same keyless NEAR executor account. The previous holder and all previous loans lose permission at the collection.

Built for NEAR's **NFTs That Do Something** track. React 18, TypeScript and Vite frontend; Rust/near-sdk collection and executor. Supports native NEAR, scoped zero-deposit role calls, direct NFT transfers, optional conditional sales and verified Owner-role hand-back.

## Try it

```sh
npm ci
npm run dev
```

Use the configured testnet deployment, or add `?mock=1` for labelled examples. `/app` shows your Writs and withdrawal credits; `/market` shows listings; `/wrap` creates a Writ; `/writ/<id>` exposes checks, history and holder actions.

Public identities, hashes and genuine receipts are in [deployments/testnet.json](deployments/testnet.json). On a clean checkout, copy its public values into `.env.local` using [.env.example](.env.example), then restart Vite. Every `VITE_` value is public. Never put a signing key in one.

Connect a testnet wallet, open **Wrap a role**, and choose **Contract owner**. If you have no compatible contract, **Create or resume practice target** provisions a keyless practice service owned by your wallet. Funding/storage quotes appear before signing. Minting provisions a separate keyless executor; propose that executor as owner, let it accept, and verify the handover. A mint alone does not move the role.

Use the Writ to exercise or lend `set_price`, fund/withdraw native NEAR, transfer directly, or optionally list for sale. Direct transfers have no purchase price or settlement checks. Listing pauses use, lending, withdrawals and transfers. Buyers pin the version, template, price and optional minimum available executor balance. Failed conditions preserve the seller's NFT and make the full purchase price refundable. The disclosed **0.05 NEAR retained record charge** and network fees remain spent. Successful sales credit the seller's withdrawal balance in **My Writs**.

Unwrap uses three transactions: propose the wallet, accept from the wallet, then verify the external role before retiring the NFT. Reopen **Unwrap** after an interruption to resume. Remaining native executor funds are recoverable by the last holder through **My Writs**.

## Role compatibility

| Template       | Integration                                           | Boundary                                                                                                                                   |
| -------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Contract owner | Actual upstream `near-sdk-contract-tools` Owner 4.0.0 | `set_price` belongs to the example service, not the generic Owner trait. Targets must expose the declared methods.                         |
| DAO council    | Pinned, unchanged upstream Sputnik DAO v2 Wasm        | Matches the named council group. DAO governance must approve membership and can later revoke it. A seat does not confer exclusive control. |
| Staking pool   | Unimplemented draft                                   | Not offered as a supported live template. Immutable standard pool ownership cannot simply be wrapped after creation.                       |

For DAO wrapping, approve an `AddMemberToRole` proposal through the existing DAO governance interface, adding the displayed executor to `council`, then confirm in Writ. Writ does not bypass approval. Its role action forwards `act_proposal` with exact JSON arguments.

## Build and verify

```sh
# Linux or WSL: Node 24+, Rust 1.99.1, cargo-near 0.23.0
npm ci
bash scripts/build-contracts.sh
npm --prefix integration ci
npm --prefix integration test

# Frontend
npm test
npx playwright install chromium
npm run test:e2e
npm run build
npm run check:secrets
```

Contracts originate from `cargo near new` scaffolds and use pinned Cargo locks/toolchain. Builds use `cargo near build non-reproducible-wasm`; published hashes identify the tested/deployed artifacts, without claiming reproducible container-build certification. The local Windows helper is `wsl -d Ubuntu-24.04 -- bash /mnt/c/Users/kolev/Desktop/writ/scripts/linux-env.sh <command>`.

The sandbox suite executes actual Wasm and receipts: upstream Owner handover, direct transfer, receiver rollback/reentry, lending/revocation, sale/refund accounting, spoofed callbacks, yielded calls, deadline release, late callbacks, failed provisioning, real failed native payments, retirement and residual-fund recovery. [Measurements](docs/contract-verification.json) include binary hashes and gas observations. [Verification](docs/VERIFICATION.md) distinguishes local sandbox, browser and public testnet evidence. It is not an audit or competitor benchmark.

`node integration/deploy-testnet.mjs` creates funded **testnet-only** accounts, deploys local artifacts and records real demonstration receipts. Run through the WSL helper with integration dependencies installed. It journals completed steps and refuses silent upgrades. Credentials and journal stay in ignored `.local/deployment/`; only public identities/hashes enter frontend configuration and the deployment manifest. No mainnet deployment is configured.

## Security and limits

The completed functionality checklist is not a mainnet release approval. See [release readiness](docs/RELEASE_READINESS.md) for remaining wallet, authority, compatibility and budget gates, and [mainnet planning estimate](docs/mainnet-cost-estimate.json) before funding anything.

- Executors have no keys. Only the collection can instruct them. No key, deploy or delete surface exists. Authorization checks the current NFT holder or an exact unexpired loan at the current epoch.
- Transfers into the collection's own namespace are rejected, preventing NFTs becoming stuck in Writ's keyless infrastructure. External receivers must still be able to control a received NFT.
- Ordinary role calls attach zero deposit. The executor supplies exactly 1 yoctoNEAR for upstream Owner authentication; those ownership methods cannot be lent.
- A pending counter is set before dispatch. Listing/transfers wait for completion of returned promises. Browser timers cannot unlock an unknown action.
- Sales join independent external calls. This is **not a simultaneous global snapshot**. Targets can misreport state or schedule future changes; governance may revoke authority later. Only declared predicates are enforced.
- Executor key/code observations are page-only RPC checks. The collection's full-access deployment key remains local for this testnet prototype; collection upgrades remain a trust assumption. No independent security audit is claimed.
- Purchase refunds and seller/account credits have separate ledgers. Outgoing amounts are reserved before dispatch; private callbacks restore failed payments. Deadline release invalidates an attempt before refund availability.
- Withdrawable native NEAR excludes storage and the 0.05 NEAR operating reserve. Arbitrary FT/NFT inventories and paid forwarded role calls are not implemented: do not send unsupported assets to an executor.
- History retains 64 entries; event logs preserve separate transaction evidence. Loans are capped at eight, each with 4 KB of canonical JSON arguments and at most 366 days of validity. No production indexer is configured.

See [threat model](docs/THREAT_MODEL.md), [ABI](docs/contract-integration.md), [NFT media](docs/NFT_MEDIA.md), and [AI/library disclosure](docs/AI_USE.md). Dynamic standalone SVG media derives from the same face renderer as the frontend, including embedded font subsets. Marketplaces may cache it.

## Hosting and Git safety

Build `npm run build`, publish `dist` to Vercel or Netlify; SPA rewrites are supplied. No hosting account, public website, hackathon submission, commit or push is created by these scripts. The gallery is development-only. Original headline weights and reduced-motion-aware scroll reveals are retained.

`.local/`, environment files, keys, dependencies, Wasm artifacts, targets, reports and generated fonts/media are ignored. Source, Cargo/npm locks, public deployment provenance and tests remain eligible. The pre-commit scanner is in `.githooks`; activate it on a clone with `git config core.hooksPath .githooks`. Pattern checks supplement a human review.
