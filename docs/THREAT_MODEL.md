# Writ threat model

Scope: collection, keyless executor, practice-target factory, frontend and adapter. Sandbox evidence is in contract-verification.json; public testnet identities and receipts are in ../deployments/testnet.json. This is an implementation threat model, not an independent audit.

## Meaning of checks

The public page reports declared template calls and separate RPC observations at one finalized block hash. A later sale performs independent asynchronous calls. A clean result covers only the declared checks. It does not discover every backdoor or establish permanent authority or a simultaneous global snapshot.

Collection code, deployment identity, upgrade authority and the approved template are trust assumptions. A keyless executor alone does not establish safe collection behavior. External governance may remove an acquired role. Targets may omit relevant permissions from their views.

| Threat                            | Frontend defense                                                                       | Implemented contract defense                                                                       |
| --------------------------------- | -------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Seller changes listing/template   | Pin observed nonce, template hash and maximum price; require review on mismatch.       | Recheck pins and active attempt before settlement.                                                 |
| Next owner left waiting           | Show declared proposed-owner check, requiring null.                                    | Run check; reject failed/malformed responses.                                                      |
| Calls remain in flight            | Show pending calls and paused listed actions.                                          | Listing requires zero pending; increment before promise, clear in private callback.                |
| Old holder/borrower keeps access  | Follow current owner/epoch; mock denies old permissions.                               | Keyless executor authenticates collection; transfer advances epoch and invalidates loans.          |
| Borrower redirects allowed method | Expose exact args/deposit cap.                                                         | Bind target, method, args, deposit, expiry and epoch.                                              |
| Timeout after submission          | Retain attempt ID and offer status reads instead of another payment.                   | Stable buyer-bound lookup, idempotent settlement.                                                  |
| Late callback/duplicate refund    | Reject contradictory terminal UI outcomes; mock prevents repeat claims.                | Invalidate attempt before refund, private callbacks, debit before transfer and restore on failure. |
| Refund merely scheduled           | Distinguish pending/claimable/paid.                                                    | Expose actual financial callback result.                                                           |
| Malformed RPC data                | Bound JSON, validate fields, unavailable never becomes Pass.                           | Document ABI and bound results.                                                                    |
| Unexpected executor/template      | Compare configured hashes/deployment metadata.                                         | Publish reviewed hashes and protect upgrades.                                                      |
| Unexpected signing authority      | Construct function calls only; no app-generated access keys, deploy or delete actions. | Minimal executor surface authenticates collection.                                                 |
| False evidence                    | Persistent example label; genuine sandbox/testnet evidence distinguished.              | Supply real sandbox results/testnet receipts.                                                      |
| Injected NFT text                 | XML-escape SVG text; React-escape UI.                                                  | Bound metadata and validate accounts.                                                              |
| Modal keyboard escape             | Modal, explicit Tab loop, Escape, focus restoration and scroll lock.                   | Not applicable.                                                                                    |

## Remaining boundaries

Hardening now rejects NFT recipients inside the collection namespace in direct transfers, transfer-call and purchases. The adapter and deployment helper also require RPC chain ID `testnet`; this prototype cannot be moved to mainnet by changing only an endpoint. Capacity evidence and unresolved release gates are recorded in [RELEASE_READINESS.md](RELEASE_READINESS.md).

Mock passes do not prove NEAR receipt execution, solvency, gas viability or secure executor behavior. The actual sandbox suite covers transfers, receiver reentry/rollback, pending locks, provisioning, segregated refunds, failed native payments, deadline release/late callbacks and retirement. Its results do not prove every possible schedule or global solvency.

Account key/code checks are page-only. An on-chain method name does not guarantee read-only behavior; templates need review for side effects, gas, return types and backdoors.

Wrap supports the demonstrated ownership API. Standard staking-pool ownership is fixed at initialization; DAO membership is not sole control. Minting needs a funding/storage quote. Unwrap needs a verified hand-back before retirement. Both use exact on-chain funding quotes and resumable hand-back transactions.

No production indexer or independent audit is configured. The collection deployment key remains a full-access upgrade authority; changing collection code could change executor permissions. Testnet keys stay in ignored local storage. Native-NEAR-only withdrawals do not imply support for arbitrary FT/NFT assets sent to an executor. Record storage and network fees are not refunded. Account names remain reclaimable according to NEAR account rules; permissions bind account IDs, not a permanent natural-person identity.
