# On-chain implementation

Authorized: implement the remaining Writ functionality. Do not stage, commit or push. Testnet only; keep credentials outside tracked files.

This completed feature checklist is not a mainnet security approval. Additional open release gates are tracked in [RELEASE_READINESS.md](RELEASE_READINESS.md).

- [x] Collection and keyless executor; direct NFT transfer and receiver resolution.
- [x] Actual contract-tools Owner role handover and old-holder rejection in sandbox.
- [x] Scoped zero-deposit loans, revocation, epoch invalidation, pending-call locks.
- [x] Joined predicate checks, purchase locks, refunds, proceeds and timeout recovery.
- [x] Funding quotes, verified unwrap, metadata/history and failed-payment callbacks.
- [x] Browser actions against the finalized ABI, including direct transfers.
- [x] Second template using unchanged third-party contract behavior.
- [x] Real sandbox attack/lifecycle suite and measured gas and binary evidence.
- [x] Testnet deployment, genuine receipts and documented reproduction.

Implementation constraints: private idempotent callbacks; bounded checks/args/history; no executor key/deploy/delete surface; no claim of globally atomic external reads. Unknown action completion cannot be turned into permission to transfer by a frontend timer. Purchase timeout invalidates the attempt before refund credit. Financial transfers debit credits before dispatch and restore them on failure.
