# Writ ABI: writ-ui-v1

Implemented in `contracts/collection`, `contracts/executor` and `src/chain/testnetAdapter.ts`. Public deployment metadata is in `deployments/testnet.json`, with minimal public frontend defaults in `src/content/deployment.json`. The adapter checks ABI, executor hash, every configured template hash, and the published collection code hash before writes. Collection upgrades remain a trust assumption; a hash check does not remove a deployment key.

The five compiled profiles are contract-owner, dao-council, collection-admin, token-issuer and treasury-controller. The last three share upstream Owner plus a fixed profile predicate and compatible application-specific commands. They are not universal token administrative standards. See INTEGRATION_GUIDE.md for external application integration through the standalone SDK and separate example app.

Practice quote/creation accept optional `template_id`, defaulting to contract-owner. DAO practice creation is not supported; membership uses the DAO's existing governance. Fresh frontend practice requests are allowed only after a prior request is known ready/failed, never while its outcome is unresolved. Owner-compatible wrap/unwrap recipes apply to all four Owner profiles; new profiles require full confirmation, including their profile marker, before listing. The example target accepts `fund_treasury` deposits for its storage/treasury budget; this direct target balance is separate from executor funds.

`nft_token` supplies `metadata.media_hash` as base64 SHA-256 of decoded SVG bytes. Dynamic owner/status changes update the media and hash together. Wallet indexing and cached image refresh are not guaranteed. The SDK can read NFT and account evidence at the same finalized block; account-key observations remain page evidence rather than additional on-chain purchase predicates.

## Read methods

| Method                | Arguments                                 | Meaning                                                                                                                                                                                               |
| --------------------- | ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `get_frontend_config` | `{}`                                      | ABI, executor/template hashes, purchase record charge and limits.                                                                                                                                     |
| `get_writ`            | `{token_id}`                              | Contract state or null. The adapter enriches actual account balance, available balance, keys, code hash and Owner observations through RPC. Raw contract account fields are not independent evidence. |
| `get_writs`           | `{owner_id?,listed_only?,cursor?,limit?}` | Up to 24 items; scans at most 256 IDs; nullable nextCursor.                                                                                                                                           |
| `get_history`         | `{token_id,cursor?,limit?}`               | Up to 50 of 64 retained entries; nullable nextCursor.                                                                                                                                                 |
| `get_purchase`        | `{token_id,buyer_id,client_attempt_id}`   | Buyer-bound attempt status. Null is unknown, never success.                                                                                                                                           |
| `get_credit`          | `{account_id}`                            | Decimal native-NEAR credit.                                                                                                                                                                           |
| `get_mint_quote`      | `{template_id,target}`                    | Exact funding + retained storage deposit.                                                                                                                                                             |
| `get_mint_result`     | `{owner_id,client_request_id}`            | tokenId and creating/ready/failed.                                                                                                                                                                    |
| `get_practice_quote`  | `{}`                                      | Exact practice-target funding + retained record deposit.                                                                                                                                              |
| `get_practice_target` | `{owner_id,client_request_id}`            | target and creating/ready/failed.                                                                                                                                                                     |
| `get_retired_writs`   | `{owner_id}`                              | Last-holder native-fund recovery rights.                                                                                                                                                              |

Amounts/nonces/epochs are decimal strings. `expires_at_ms` is a decimal SDK U64 string; UI loan expiry is ISO UTC. Executor `get_balance` means native NEAR available after storage and reserve. The adapter obtains its total balance separately.

## Holder and borrower calls

| Method                   | Arguments / deposit                                                    |
| ------------------------ | ---------------------------------------------------------------------- |
| `execute`                | `{token_id,target_method,args,deposit:"0"}`; attaches zero.            |
| `lend`                   | `{token_id,borrower_id,method,args,max_deposit:"0",expires_at_ms}`.    |
| `end_loan`               | `{token_id,loan_id}`.                                                  |
| `fund_executor`          | `{token_id}`; positive native deposit, holder only.                    |
| `withdraw_fees`          | `{token_id,amount}`; pays current holder only.                         |
| `nft_transfer`           | `{token_id,receiver_id,approval_id?:null,memo?}`; exactly 1 yoctoNEAR. |
| `nft_transfer_call`      | Same plus `msg`; exactly 1 yoctoNEAR.                                  |
| `list`                   | `{token_id,price,expected_nonce}`; confirmed role, zero pending calls. |
| `unlist`                 | `{token_id}`; disallowed while purchase-locked.                        |
| `withdraw_credit`        | `{amount}`; caller's general credit only.                              |
| `withdraw_retired_funds` | `{token_id,amount}`; retired token's last holder only.                 |

Listed, purchase-locked, receiver-locked and unwrapping states pause ordinary actions. A receiving contract cannot exercise or transfer a Writ before receiver resolution. Failed/declined/malformed responses roll back ownership, with old loans remaining invalidated. Optional NFT approval management is not implemented; transfers require the actual holder.

Loan authorization binds the immutable target, declared lendable method, canonical JSON object, zero deposit, expiry and epoch. Arguments are at most 4096 bytes; eight loans; expiry at most 366 days. Transfers/sales increment epoch and clear loans. Ownership methods cannot be lent; the executor attaches a fixed 1 yoctoNEAR to `own_propose_owner`/`own_accept_owner`.

## Purchases

`buy({token_id,expected_nonce,expected_template_hash,maximum_price,pins,client_attempt_id})` attaches **price + 0.05 NEAR retained record storage**. maximum_price must equal the current price. One optional pin: `{id:"minimum_balance",value:<yocto>}`; checks available executor balance.

The buyer-bound handle is generated and stored before signing. UUIDs cannot be reused for that buyer/token. The contract locks the token, joins declared external calls and the balance read, then rechecks local nonce, seller, pending count and the 200-block deadline. Missing/malformed/oversized responses never pass. The private callback must still own that exact active lock.

Outcomes are checking (deadlineBlock), refused (checks, refundStatus), settled (holder, seller, price, endedLoanIds, sellerPayment), releasable, or released (refundStatus). `sellerPayment:"credited"` means proceeds were placed in the seller's withdrawal ledger; it does not claim they remain unwithdrawn.

`release_stuck({token_id,buyer_id,client_attempt_id})` is permissionless after the contract deadline. It marks Released and clears the lock before refund availability. `claim_refund` uses the same arguments and requires the bound buyer. Refund states: claimable/pending/paid. Purchase refunds are isolated from ordinary credits. Failed payments restore the appropriate ledger; callbacks are private and consume unique operation IDs. A late settlement cannot reactivate a released attempt.

Page reads use one actual finalized block hash. Settlement evidence instead records the callback's block height/time, `blockHash:null`, `phase:"settlement_callback"`; the contract cannot retrieve remote receipt hashes. This does not claim a simultaneous snapshot or exact external-read block. Key/code RPC observations are page-only, not sale predicates.

## Provisioning and retirement

`create_practice_target({client_request_id})` attaches the exact practice quote and deploys a keyless upstream-Owner demonstration service owned by the caller. Optional. `mint({template_id,target,client_request_id})` attaches its separate quote and creates an executor without keys. Both have persistent caller-bound request lookup. On failure, returned funding becomes account credit; record storage is retained.

Owner wrap: wallet calls target `own_propose_owner({account_id:executor})` with 1 yoctoNEAR; collection `wrap_step({token_id,step:1})` forwards acceptance. `confirm_wrap({token_id})` independently runs template predicates and records confirmation. DAO membership must first be approved outside Writ through sovereign governance, then confirmed here.

Owner unwrap: `begin_unwrap({token_id})` proposes the holder; the wallet calls target `own_accept_owner({})` with 1 yoctoNEAR; `finish_unwrap({token_id})` verifies owner=holder and proposed_owner=null before retiring. Failed verification remains resumable. `cancel_unwrap` can clear the proposal while the executor still owns the role. Retired native funds stay recoverable by the last holder. No DAO hand-back recipe is claimed.

Browser calls budget 250 Tgas and await final receipt status. Actual sampled gas is in `docs/contract-verification.json`. Preflight gas allowance is a conservative budget, not a measured fee. No audit, permanent authority or globally atomic read guarantee is claimed.
