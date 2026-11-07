# Writ integration client

`index.ts` is a standalone, dependency-free TypeScript client. It does not import React or the Writ frontend. Copy it into an application, or import the generated `/sdk/writ.js` browser module from a published Writ build. No npm package has been published.

Public RPC reads share a per-endpoint queue within the module: at most three requests are in flight, with starts spaced by at least 300 ms. This reduces bursts when the application and permission report load together. It does not guarantee a public provider's availability or bypass its limits. Local sandbox reads are exempt. No wallet transaction enters this queue.

Both `mainnet` and `testnet` are supported; `localnet` is reserved for explicit localhost sandbox endpoints. `verifyDeployment()` checks the network, collection bytecode, ABI, executor and template hashes without requiring an NFT to exist. Pass an operator's reviewed public deployment configuration and use a wallet configured for the same network. Mainnet support is not a claim that this project has deployed on mainnet. See [NETWORKS.md](../docs/NETWORKS.md) for runtime frontend settings, manifests and independent deployment instructions.

Pin the network, collection code hash, executor code hash and template hashes from a reviewed release. `inspect(id)` returns finalized account/key observations and the declared commands. `inspect(id, true)` also verifies NFT artwork at that same block. `nft(id)` reads/verifies artwork separately. `buildAction(...)` checks the current controller and prepares a NEAR Connect / Wallet Selector compatible transaction. Pass it to the user's own wallet, then use `confirmAction(hash, signer, requestedTransaction)` to check the final successful command and its exact requested arguments/deposit. The client never receives private keys. Transient RPC read failures are retried; no wallet write is automatically resubmitted.

The on-chain contracts are the final authorization check. A view can become stale before execution. Browser observations do not prove the absence of hidden roles, delayed changes or contract-internal upgrade mechanisms. Full-access keys and restricted keys are disclosed separately. This client does not make a server's HTTP endpoint private: a server needs its own signed, replay-resistant authentication for that.

Run the separate application with `npm run example` from the repository root. It uses a separate wallet connection and reads the deployment's public configuration. See `docs/INTEGRATION_GUIDE.md` for the complete recipe and compatibility boundaries.
