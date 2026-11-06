# Writ frontend threat model

Scope: frontend, behavioral mock and proposed integration adapter. This repository does not implement or audit a deployed collection/executor.

## Meaning of checks

The public page reports declared template calls and separate RPC observations at one finalized block hash. A later sale performs independent asynchronous calls. A clean result covers only the declared checks. It does not discover every backdoor or establish permanent authority or a simultaneous global snapshot.

Collection code, deployment identity, upgrade authority and the approved template are trust assumptions. A keyless executor alone does not establish safe collection behavior. External governance may remove an acquired role. Targets may omit relevant permissions from their views.

| Threat                            | Frontend defense                                                                       | Required contract defense                                                                          |
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
| False evidence                    | Persistent example label, no fake hashes, sandbox gates false.                         | Supply real sandbox results/testnet receipts.                                                      |
| Injected NFT text                 | XML-escape SVG text; React-escape UI.                                                  | Bound metadata and validate accounts.                                                              |
| Modal keyboard escape             | Modal, explicit Tab loop, Escape, focus restoration and scroll lock.                   | Not applicable.                                                                                    |

## Remaining boundaries

Mock passes do not prove NEAR receipt execution, solvency, gas viability or secure executor behavior. Contract tests must cover ordinary transfers, transfer-call resolver races, withdrawal failures, provisioning and retirement.

Account key/code checks are page-only. An on-chain method name does not guarantee read-only behavior; templates need review for side effects, gas, return types and backdoors.

Wrap supports the demonstrated ownership API. Standard staking-pool ownership is fixed at initialization; DAO membership is not sole control. Minting needs a funding/storage quote. Unwrap needs a verified hand-back before retirement. Both stay disabled in testnet mode here.

No indexer, live Writ deployment, sandbox validation or testnet sale evidence is claimed by this frontend build.
