# Proposed frontend integration: writ-ui-v1

This is an integration contract for the parallel smart-contract work, **not documentation of an existing deployment**. All method names live in `src/chain/contractBindings.ts`. Translate responses there/in the adapter if the finalized ABI differs; components must not contain RPC calls.

## Activation and identities

Use only testnet. Configure the actual collection account, ABI version, independently published executor code hash and owner-template hash. Before collection reads/writes, the adapter requires:

```text
get_frontend_config({}) -> {
  abi_version: "writ-ui-v1",
  executor_code_hash: <published hash>,
  template_hashes: { "contract-owner": <published hash> }
}
```

The three values must match frontend configuration. Every decoded Writ must match the configured collection, requested ID and owner-template hash. Metadata is not a code audit: collection code/upgrade authority remain trust assumptions. Publish source/build provenance separately. The frontend must not silently accept a new template schema under an old identifier.

## Views and JSON

Argument keys below use snake_case. Normalized response keys match the camelCase TypeScript interfaces in `src/chain/types.ts`.

| View           | Arguments                                                                             | Result                                                                                |
| -------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `get_writ`     | `{token_id}`                                                                          | `Writ` or null, never an invented default.                                            |
| `get_writs`    | `{owner_id: string or null, listed_only: boolean, cursor: string or null, limit: 24}` | `{items: Writ[], nextCursor?: string}`.                                               |
| `get_history`  | `{token_id, cursor: string or null, limit: 50}`                                       | `{entries: HistoryEntry[], nextCursor?: string}`. Indexer unavailable: use this view. |
| `get_purchase` | `{token_id, client_attempt_id}`                                                       | Discriminated `PurchaseState` below.                                                  |

Required Writ fields: `id`, `collection`, `owner`, `executor`, `target`, `templateId`, `templateHash`, `executorCodeHash`, `epoch`, `nonce`, `pendingCalls`, `status`, `price`, `balance`, `withdrawableFees`, `tokens`, `loans`, `roleOwner`, `proposedOwner`, `accessKeys`; optional `saleDeadlineBlock`. Amounts/nonces/epochs/block heights are decimal strings. `pendingCalls` is a bounded non-negative integer. Status is held/listed/locked/lent. Listed/locked require a positive price. Missing or malformed data must not turn into zero/Pass.

This is a normalized UI shape: a finalized Rust ABI may expose fewer fields and have the adapter enrich account data through RPC. In particular, real access keys and code are always checked through RPC; a contract's reported `accessKeys` field is not evidence that an account is keyless. `withdrawableFees` must exclude storage/reserves/pending withdrawals and describe a genuinely available claim, not the whole account balance.

Loan: `{id, borrower, method, args, maxDeposit, expiresAt, epoch}`; UTC ISO expiry. Bind a target as well when the executor can reach multiple contracts. History: `{id, at, event, actor, detail, refused?, transactionHash?}`. Only include actual transaction hashes. Contract NEP-297 events should map to these same entries. Record actor, prior/new holder, attempt ID, epoch/nonce and financial outcome in the finalized event schema.

## Purchase and financial outcomes

`buy({token_id, expected_nonce, expected_template_hash, maximum_price, pins, client_attempt_id})`, with `maximum_price` attached in yoctoNEAR. Pins are `{id, value}`; only approved template pins are accepted. The demonstrated executor-balance pin requires an actual executor `get_balance` predicate implemented and measured by the contract team.

The client generates a UUID **before** requesting the signature. Bind it to buyer + token, reject replay/replacement, and provide lookup through `get_purchase`. A successful outer transaction alone is not a settled purchase. Required outcomes:

```ts
type PurchaseState =
  | { status: "checking"; deadlineBlock: string }
  | {
      status: "refused";
      checks: CheckResult[];
      refundStatus: "pending" | "claimable" | "paid";
      refundTransactionHash?: string;
    }
  | {
      status: "settled";
      holder: string;
      seller: string;
      price: string;
      endedLoanIds: string[];
      sellerPayment: "paid" | "claimable";
    }
  | { status: "releasable" }
  | { status: "released"; refundStatus: "pending" | "claimable" | "paid" };
```

Check results require `{id,label,method,actual,expected,result,enforcedBy,read}`. `result` is pass/fail/unavailable; real receipt evidence uses `read.source:'testnet'` with block height/hash and observation time. If reads ran in different blocks, retain each row's actual context. Do not fabricate one global read block. Refused purchases need at least one non-passing condition.

`release_stuck({token_id,client_attempt_id})`: contract enforces deadline; invalidates that attempt before releasing funds. A late callback cannot settle/refund it again. `claim_refund` uses the same arguments and pays only the bound buyer. Debit before transfer, private callback restores failed transfers. Claimable is not paid. A refused amount is not reported returned until its payment succeeds. Gas is separate.

The browser retains attempt handles in session storage and offers status recovery. A wallet interruption after possible submission does not trigger a second buy. Polling elapsed time never determines success or refund eligibility.

## Holder operations

| Method          | Arguments                                                       |
| --------------- | --------------------------------------------------------------- |
| `execute`       | `{token_id,target_method,args,deposit}`; attaches that deposit. |
| `lend`          | `{token_id,borrower_id,method,args,max_deposit,expires_at}`.    |
| `end_loan`      | `{token_id,loan_id}`.                                           |
| `list`          | `{token_id,price,expected_nonce}`.                              |
| `unlist`        | `{token_id}`.                                                   |
| `withdraw_fees` | `{token_id,amount}`.                                            |

The current frontend constructs zero-deposit template actions; finalize any one-yocto authentication convention in bindings before activation. Authorization belongs on chain, not in disabled buttons. Check current owner/epoch, argument/deposit caps, pending executions and listing/purchase locks. Changing a listing advances the version. Transfers invalidate prior loans. A failed withdrawal restores the appropriate claim rather than paying a stale owner by default. Test NFT transfer-call, sale/payout races and callback spoofing on a sandbox.

All wallet calls currently request 250 Tgas. The preflight fee allowance multiplies current RPC gas price by that budget and a 1.3 buffer; it is conservative local policy, not a measured actual fee or execution benchmark. Measure actual receipts/gas/storage before choosing final budgets.

## Wrap and unwrap: disabled testnet integrations

The owner recipe is `own_propose_owner({account_id:executor})` signed by the current role holder, then `own_accept_owner({})` forwarded by the executor. Actual target calls are from the established contract-tools Owner API. Example `set_price` is an additional demo-target action, not part of the generic Owner trait; expose it only for targets that implement it.

Mint requires a published provisioning/storage quote, explicit funding, idempotent request identity, failure recovery and a way to resolve the created executor. Never invent the future account or fixed deposit. The mock models this lifecycle; `testnetAdapter.mintWrit` deliberately refuses until the finalized contract API exists.

Unwrap requires a template-specific verified hand-back before retiring the NFT. A burn alone does not migrate a role. `unwrap` is a proposed binding but is not exposed in testnet mode. Standard staking-pool owners cannot generally be changed after pool initialization. DAO membership checks do not confer sole control or prevent later sovereign removal.

## Validation handoff

Before promoting an integration: implement the agreed ABI; publish reviewed executor/template hashes; run actual sandbox attacks and funding/failure paths; then supply genuine testnet receipts and set the matching validation gate. The frontend already separates real RPC from examples and has empty evidence files for this handoff. No contract benchmark or competitive-win claim is implied by frontend test passes.
