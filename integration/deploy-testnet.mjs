// Testnet only. Credentials are generated/read exclusively in ignored .local/deployment.
import { actions, nearToYocto } from "near-api-js";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import { provider, testnetAccounts } from "./testnet-accounts.mjs";
const root = new URL("../", import.meta.url);
const directory = new URL(".local/deployment/", root);
const accounts = await testnetAccounts();
const { collection, alice, bob, target, dao } = accounts;
const journalFile = new URL("journal.json", directory);
let journal;
try {
  journal = JSON.parse(await readFile(journalFile, "utf8"));
} catch (e) {
  if (e.code !== "ENOENT") throw e;
  journal = { requests: {}, steps: {} };
}
const save = () =>
  writeFile(journalFile, JSON.stringify(journal, null, 2), { mode: 0o600 });
async function request(name) {
  if (!journal.requests[name]) {
    journal.requests[name] = crypto.randomUUID();
    await save();
  }
  return journal.requests[name];
}
async function step(name, fn) {
  if (journal.steps[name]) return journal.steps[name];
  console.log(`Running testnet step: ${name}`);
  const r = await fn();
  journal.steps[name] = r;
  await save();
  return r;
}
const view = (account, method, args = {}) =>
  provider.callFunction({
    contractId: typeof account === "string" ? account : account.accountId,
    method,
    args,
  });
function summary(r) {
  const outcomes = [r.transaction_outcome, ...r.receipts_outcome];
  const encoded = r.status.SuccessValue;
  return {
    hash: r.transaction.hash,
    signer: r.transaction.signer_id,
    receiver: r.transaction.receiver_id,
    status: r.status,
    value: encoded
      ? JSON.parse(Buffer.from(encoded, "base64").toString("utf8"))
      : null,
    gasBurnt: outcomes
      .reduce((n, o) => n + BigInt(o.outcome.gas_burnt), 0n)
      .toString(),
    receiptIds: r.receipts_outcome.map((o) => o.id),
  };
}
const call = (
  name,
  signer,
  receiver,
  method,
  args = {},
  deposit = "0",
  allowFailure = false,
) =>
  step(name, async () =>
    summary(
      await signer.signAndSendTransaction({
        receiverId:
          typeof receiver === "string" ? receiver : receiver.accountId,
        actions: [
          actions.functionCall(
            method,
            args,
            250_000_000_000_000n,
            BigInt(deposit),
          ),
        ],
        waitUntil: "FINAL",
        throwOnFailure: !allowFailure,
      }),
    ),
  );
async function deploy(name, account, artifact, args) {
  const bytes = await readFile(new URL(`artifacts/${artifact}.wasm`, root));
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const r = await step(name, async () => ({
    ...summary(
      await account.signAndSendTransaction({
        receiverId: account.accountId,
        actions: [
          actions.deployContract(bytes),
          actions.functionCall("new", args, 80_000_000_000_000n, 0n),
        ],
        waitUntil: "FINAL",
      }),
    ),
    sha256,
  }));
  assert.equal(
    r.sha256,
    sha256,
    "Artifact changed since deployment. Use a fresh deployment, not an unreviewed upgrade.",
  );
  const code = await provider.sendJsonRpc("query", {
    request_type: "view_code",
    account_id: account.accountId,
    finality: "final",
  });
  assert.equal(
    createHash("sha256")
      .update(Buffer.from(code.code_base64, "base64"))
      .digest("hex"),
    sha256,
  );
}
await deploy("deploy-collection", collection, "collection", {});
await step("fund-demo-operator", async () =>
  summary(
    await target.signAndSendTransaction({
      receiverId: alice.accountId,
      actions: [actions.transfer(nearToYocto("5"))],
      waitUntil: "FINAL",
    }),
  ),
);
await deploy("deploy-dao", dao, "vendor/sputnikdao2", {
  config: {
    name: "Writ demonstration council",
    purpose: "Transferable council membership; DAO remains sovereign",
    metadata: "",
  },
  policy: [alice.accountId],
});
async function practice(label) {
  const id = await request(`practice-${label}`);
  let state = await view(collection, "get_practice_target", {
    owner_id: alice.accountId,
    client_request_id: id,
  });
  if (state === null) {
    const q = await view(collection, "get_practice_quote");
    await call(
      `practice-${label}`,
      alice,
      collection,
      "create_practice_target",
      { client_request_id: id },
      q.deposit,
    );
    state = await view(collection, "get_practice_target", {
      owner_id: alice.accountId,
      client_request_id: id,
    });
  }
  assert.equal(state.status, "ready");
  return state.target;
}
async function mint(label, roleTarget, template = "contract-owner") {
  const id = await request(`mint-${label}`);
  let state = await view(collection, "get_mint_result", {
    owner_id: alice.accountId,
    client_request_id: id,
  });
  if (state === null) {
    const q = await view(collection, "get_mint_quote", {
      target: roleTarget,
      template_id: template,
    });
    await call(
      `mint-${label}`,
      alice,
      collection,
      "mint",
      { target: roleTarget, template_id: template, client_request_id: id },
      q.deposit,
    );
    state = await view(collection, "get_mint_result", {
      owner_id: alice.accountId,
      client_request_id: id,
    });
  }
  assert.equal(state.status, "ready");
  return view(collection, "get_writ", { token_id: state.tokenId });
}
async function wrap(label, w) {
  await call(
    `${label}-propose`,
    alice,
    w.target,
    "own_propose_owner",
    { account_id: w.executor },
    "1",
  );
  assert.equal(
    (
      await call(`${label}-accept`, alice, collection, "wrap_step", {
        token_id: w.id,
        step: 1,
      })
    ).value,
    true,
  );
}
const config = await view(collection, "get_frontend_config");
const first = await mint("clean", await practice("clean"));
await wrap("clean", first);
await call(
  "clean-service-income",
  alice,
  first.target,
  "pay_service",
  { receiver_id: first.executor },
  nearToYocto("0.5").toString(),
);
await call("clean-loan", alice, collection, "lend", {
  token_id: first.id,
  borrower_id: bob.accountId,
  method: "set_price",
  args: { price: "7" },
  max_deposit: "0",
  expires_at_ms: String(Date.now() + 86400000),
});
let current = await view(collection, "get_writ", { token_id: first.id });
const price = nearToYocto("0.3").toString();
await call("clean-list", alice, collection, "list", {
  token_id: first.id,
  price,
  expected_nonce: current.nonce,
});
current = await view(collection, "get_writ", { token_id: first.id });
const cleanAttempt = await request("clean-attempt");
const clean = await call(
  "clean-buy",
  bob,
  collection,
  "buy",
  {
    token_id: first.id,
    expected_nonce: current.nonce,
    expected_template_hash: first.templateHash,
    maximum_price: price,
    pins: [{ id: "minimum_balance", value: nearToYocto("0.3").toString() }],
    client_attempt_id: cleanAttempt,
  },
  (BigInt(price) + BigInt(config.purchase_storage_deposit)).toString(),
);
assert.equal(clean.value, true);
const oldAction = await call(
  "clean-old-holder-rejected",
  alice,
  collection,
  "execute",
  {
    token_id: first.id,
    target_method: "set_price",
    args: { price: "99" },
    deposit: "0",
  },
  "0",
  true,
);
assert(oldAction.status.Failure);
await call("clean-new-holder-action", bob, collection, "execute", {
  token_id: first.id,
  target_method: "set_price",
  args: { price: "8" },
  deposit: "0",
});
await call("clean-withdraw-income", bob, collection, "withdraw_fees", {
  token_id: first.id,
  amount: nearToYocto("0.2").toString(),
});
await call("clean-proceeds", alice, collection, "withdraw_credit", {
  amount: price,
});
current = await view(collection, "get_writ", { token_id: first.id });
await call("clean-relist", bob, collection, "list", {
  token_id: first.id,
  price: nearToYocto("0.4").toString(),
  expected_nonce: current.nonce,
});
const second = await mint("proposed", await practice("proposed"));
await wrap("proposed", second);
await call("hidden-successor", alice, collection, "execute", {
  token_id: second.id,
  target_method: "own_propose_owner",
  args: { account_id: alice.accountId },
  deposit: "0",
});
current = await view(collection, "get_writ", { token_id: second.id });
await call("proposed-list", alice, collection, "list", {
  token_id: second.id,
  price,
  expected_nonce: current.nonce,
});
current = await view(collection, "get_writ", { token_id: second.id });
const refusedAttempt = await request("refused-attempt");
const refused = await call(
  "proposed-buy-refused",
  bob,
  collection,
  "buy",
  {
    token_id: second.id,
    expected_nonce: current.nonce,
    expected_template_hash: second.templateHash,
    maximum_price: price,
    pins: [],
    client_attempt_id: refusedAttempt,
  },
  (BigInt(price) + BigInt(config.purchase_storage_deposit)).toString(),
);
assert.equal(refused.value, false);
await call("proposed-refund", bob, collection, "claim_refund", {
  token_id: second.id,
  buyer_id: bob.accountId,
  client_attempt_id: refusedAttempt,
});
const seat = await mint("dao", dao.accountId, "dao-council");
const bond = (await view(dao, "get_policy")).proposal_bond;
const add = await call(
  "dao-membership-proposal",
  alice,
  dao,
  "add_proposal",
  {
    proposal: {
      description: "Keyless executor holds the transferable seat",
      kind: { AddMemberToRole: { member_id: seat.executor, role: "council" } },
    },
  },
  bond,
);
const membershipProposal = await view(dao, "get_proposal", { id: add.value });
if (membershipProposal.status === "Approved")
  await step("dao-membership-approved", async () => ({
    recoveredFromFinalizedView: true,
    proposalId: add.value,
    status: "Approved",
    note: "No transaction hash invented for an interrupted submission.",
  }));
else
  await call("dao-membership-approved", alice, dao, "act_proposal", {
    id: add.value,
    action: "VoteApprove",
  });
assert.equal(
  (
    await call("dao-confirm-role", alice, collection, "confirm_wrap", {
      token_id: seat.id,
    })
  ).value,
  true,
);
await call(
  "dao-nft-transfer",
  alice,
  collection,
  "nft_transfer",
  { token_id: seat.id, receiver_id: bob.accountId },
  "1",
);
const poll = await call(
  "dao-vote-proposal",
  alice,
  dao,
  "add_proposal",
  {
    proposal: {
      description: "The new NFT holder votes through the same executor",
      kind: "Vote",
    },
  },
  bond,
);
await call("dao-new-holder-vote", bob, collection, "execute", {
  token_id: seat.id,
  target_method: "act_proposal",
  args: { id: poll.value, action: "VoteApprove" },
  deposit: "0",
});
const executor = await provider.viewAccount({ accountId: first.executor });
const keys = await provider.sendJsonRpc("query", {
  request_type: "view_access_key_list",
  account_id: first.executor,
  finality: "final",
});
assert.deepEqual(keys.keys, []);
assert.equal(executor.code_hash, config.executor_code_hash);
await mkdir(new URL("deployments/", root), { recursive: true });
const deployment = {
  network: "testnet",
  generatedAt: new Date().toISOString(),
  collection: collection.accountId,
  dao: dao.accountId,
  abiVersion: config.abi_version,
  executorCodeHash: config.executor_code_hash,
  templateHashes: config.template_hashes,
  collectionCodeHash: (
    await provider.viewAccount({ accountId: collection.accountId })
  ).code_hash,
  writs: { clean: first.id, proposed: second.id, dao: seat.id },
  purchases: {
    clean: {
      mock: false,
      writId: first.id,
      attemptId: cleanAttempt,
      buyerId: bob.accountId,
      hash: clean.hash,
    },
    proposed: {
      mock: false,
      writId: second.id,
      attemptId: refusedAttempt,
      buyerId: bob.accountId,
      hash: refused.hash,
    },
  },
  purchaseStorageDeposit: config.purchase_storage_deposit,
  upgradeAuthority:
    "Collection full-access deployment key retained locally. Testnet prototype; not immutable or audited.",
  transactions: journal.steps,
};
await writeFile(
  new URL("deployments/testnet.json", root),
  JSON.stringify(deployment, null, 2) + "\n",
);
await writeFile(
  new URL("src/content/evidence.json", root),
  JSON.stringify(
    {
      clean: clean.hash,
      proposed: refused.hash,
      pending: null,
      lent: clean.hash,
    },
    null,
    2,
  ) + "\n",
);
await writeFile(
  new URL(".env.local", root),
  `VITE_NEAR_RPC_URL=https://test.rpc.fastnear.com\nVITE_WRIT_CONTRACT=${collection.accountId}\nVITE_WRIT_ABI_VERSION=${config.abi_version}\nVITE_EXECUTOR_CODE_HASH=${config.executor_code_hash}\nVITE_OWNER_TEMPLATE_HASH=${config.template_hashes["contract-owner"]}\nVITE_DAO_TEMPLATE_HASH=${config.template_hashes["dao-council"]}\n`,
);
console.log(
  `Live deployment ready: ${collection.accountId}. Credentials were not exported to frontend files.`,
);
