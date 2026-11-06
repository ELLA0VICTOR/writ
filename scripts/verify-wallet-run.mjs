// Re-read public receipts from an actual browser-wallet run. Never loads signing keys.
import { readFile, writeFile } from "node:fs/promises";
import { JsonRpcProvider } from "near-api-js";
import assert from "node:assert/strict";
const input = process.argv[2] || ".local/wallet-receipts.json";
const run = JSON.parse(await readFile(input, "utf8"));
const rpc = new JsonRpcProvider({ url: "https://test.rpc.fastnear.com" });
assert.equal((await rpc.sendJsonRpc("status", [])).chain_id, "testnet");
const browserActions = [];
for (const action of run.browserActions) {
  const result = await rpc.sendJsonRpc("tx", {
    tx_hash: action.hash,
    sender_account_id: action.signer,
    wait_until: "FINAL",
  });
  assert.equal(result.transaction.hash, action.hash);
  assert.equal(result.transaction.signer_id, action.signer);
  assert(!result.status.Failure);
  if (action.expectedResult === false)
    assert.equal(result.status.SuccessValue, "ZmFsc2U=");
  else assert.notEqual(result.status.SuccessValue, "ZmFsc2U=");
  const method = result.transaction.actions[0].FunctionCall.method_name;
  assert.equal(method, action.expectedMethod);
  let purchase;
  if (method === "buy") {
    const args = JSON.parse(
      Buffer.from(
        result.transaction.actions[0].FunctionCall.args,
        "base64",
      ).toString("utf8"),
    );
    purchase = await rpc.callFunction({
      contractId: run.collection,
      method: "get_purchase",
      args: {
        token_id: args.token_id,
        buyer_id: action.signer,
        client_attempt_id: args.client_attempt_id,
      },
    });
    assert.equal(
      purchase.status,
      action.expectedResult === false ? "refused" : "settled",
    );
    if (action.expectedResult === false)
      assert.equal(purchase.refundStatus, "paid");
  }
  browserActions.push({
    ...action,
    receiver: result.transaction.receiver_id,
    status: result.status,
    confirmed: true,
    ...(purchase ? { purchase } : {}),
  });
}
const view = (account, method, args = {}) =>
  rpc.callFunction({ contractId: account, method, args });
const [writ, targetOwner, nft] = await Promise.all([
  view(run.collection, "get_writ", { token_id: run.tokenId }),
  view(run.target, "own_get_owner"),
  view(run.collection, "nft_token", { token_id: run.tokenId }),
]);
const report = {
  ...run,
  verifiedAt: new Date().toISOString(),
  browserActions,
  currentState: {
    holder: writ?.owner ?? null,
    loans: writ?.loans?.length ?? null,
    targetOwner,
    nftExists: nft !== null,
    executorAvailable: await view(
      `w${run.tokenId}.${run.collection}`,
      "get_balance",
    ),
  },
  scope:
    "The listed transactions were approved through Intear Wallet in a real browser using generated testnet accounts. This script independently checks their public final receipts. It cannot independently prove how a signature was produced. Wallet collectible display was inspected separately; screenshots remain local. Mainnet, other wallet vendors and an independent security audit are not claimed.",
};
await writeFile(
  "docs/wallet-verification.json",
  JSON.stringify(report, null, 2) + "\n",
);
console.log(
  `Verified ${browserActions.length} real browser-wallet receipts; current NFT holder ${report.currentState.holder}.`,
);
