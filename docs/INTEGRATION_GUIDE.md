# Integrate an external application with Writ

Writ is a NEAR contract interface, not a website permission database. The external application assigns its supported role to a keyless executor. The current NFT holder can ask the collection contract to forward approved commands through that executor. Direct NFT transfer is available without a sale. The external application still enforces its own permission checks.

The client supports both NEAR mainnet and testnet. An external target and a compatible Writ controller must exist on the same network. Use **Network & deployment** in the frontend to verify/select an operator's controller without a rebuild. See [NETWORKS.md](NETWORKS.md) for manifests, independent deployment instructions and the separate example app's `WRIT_EXAMPLE_DEPLOYMENT` option. Our published controller and signed demo remain on testnet.

## Tested profiles

| Profile                      | External action             | Verification and limits                                                                                                        |
| ---------------------------- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Contract owner               | `set_price`; owner proposal | Upstream contract-tools Owner 4.0.0. A compatible application must expose these exact commands.                                |
| DAO council seat             | `act_proposal`              | Unmodified pinned Sputnik DAO v2. One council membership, not the whole DAO. Governance can remove the seat.                   |
| NFT collection administrator | `mint_collectible`          | Compatible example using upstream NEP-171, NEP-177 and NEP-181 components. Mint administration is an application-specific API. |
| Token issuance controller    | `mint_tokens`               | Compatible example using upstream NEP-141 and NEP-148 components. The token standard does not define the mint administrator.   |
| Treasury controller          | `treasury_pay`              | Compatible native-NEAR treasury with upstream Owner checks. This does not claim arbitrary FT or NFT spending.                  |

The three new profiles check a fixed `get_integration_profile` marker on the example target, in addition to owner and proposed owner. They are different tested application interfaces sharing the same ownership primitive, not three independent industry-wide permission standards. Each NFT pins the exact compiled template hash. Other deployed contracts need matching interfaces or a separately reviewed adapter version. Target upgrades can change its behavior. Do not activate an unsupported profile just by changing its label.

## Run the separate example

1. From this repository, run `npm install` and `npm run example`.
2. Open `http://127.0.0.1:5174`. This is a separate application with no Writ React components or application session.
3. Connect a testnet wallet that owns a Writ, or holds a valid exact-arguments delegation.
4. Enter the token ID, inspect its capabilities, account permissions and verified NFT artwork.
5. Select a declared command, enter its exact arguments and approve it in that wallet. Inspect receipts for the final external outcome.
6. Transfer the NFT using Writ. The former holder is then rejected by the integration client and by the collection contract. The new holder can reconnect and use the same external target.

The example reads only `deployments/testnet.json`, copied into its public directory by `scripts/prepare-example.mjs`. Never put generated demo private keys in it. Testnet is the supported app network for this release.

## Minimal code

```ts
import { WritClient } from "./sdk/index";

const client = new WritClient({
  rpcUrl: "https://test.rpc.fastnear.com",
  network: "testnet",
  collection: release.collection,
  collectionCodeHash: release.collectionCodeHash,
  executorCodeHash: release.executorCodeHash,
  templateHashes: release.templateHashes,
});

const evidence = await client.inspect(tokenId);
const tx = await client.buildAction({
  tokenId,
  actor: walletAccountId,
  method: "set_price",
  args: { price: "7" },
});
const outcome = await wallet.signAndSendTransaction(tx);
await client.confirmAction(outcome.transaction.hash, walletAccountId, tx);
```

The transaction is signed by the user's wallet; the external target sees the executor as its caller. A user cannot gain authority by supplying another person's account name to this client. The actual transaction signer is checked on-chain.

## Mint to handover

Connect the wallet that currently holds the supported external role. Select a profile and target. Inspect ownership and interface compatibility before paying. The quote separates executor funding from retained record storage. Mint creates the controller and NFT but does not, on its own, acquire the external role. The existing administrator must propose the executor; it accepts through Writ. Run confirmation to check the actual owner, proposed owner and any profile predicate. Interrupted steps can resume from My Writs using Complete role handover. Owner-compatible profiles can unwrap back into the current holder's wallet; the NFT retires only after external ownership is verified.

The DAO grant uses existing DAO governance. Adding an executor seat does not revoke the initiating person's independent council membership. Any exclusivity claim needs a separate verified removal of that membership.

## Wallets and evidence

The collection implements NFT core, enumeration, metadata and mint/transfer/burn events. Artwork is an embedded SVG with a base64 SHA-256 `media_hash`. Transferring a token changes its rendered holder and hash. A wallet may cache an older picture or fail to index a testnet collection. Use the account, collection and token ID on the public Writ page to check ownership independently of collectible display. Never import the deployment's private keys into a real-money wallet or distribute them to viewers.

The authority panel reports executor, target and collection keys at one finalized block. Full-access keys can replace account code. No access keys does not prove that contract methods cannot upgrade it. Declared role checks do not discover all hidden roles or queued changes. The collection still retains its testnet deployment key; this is disclosed, not described as immutable or independently audited.
