// Capped faucet funding for expanded testnet examples. Never uses mainnet or user funds.
import {
  Account,
  KeyPair,
  KeyPairSigner,
  actions,
  nearToYocto,
} from "near-api-js";
import { readFile, writeFile } from "node:fs/promises";
import {
  provider,
  testnetAccounts,
  deploymentDirectory,
} from "./testnet-accounts.mjs";
if (!process.env.WRIT_TESTNET_RELEASE)
  throw new Error(
    "Set an explicit testnet release label before allocating demo funds.",
  );
const { alice } = await testnetAccounts(); // Includes an explicit RPC testnet chain-ID check.
const file = new URL("demo-faucet-funding.json", deploymentDirectory);
let state;
try {
  state = JSON.parse(await readFile(file, "utf8"));
} catch (e) {
  if (e.code !== "ENOENT") throw e;
  state = { recipient: alice.accountId, accounts: [] };
}
if (state.recipient !== alice.accountId)
  throw new Error("Funding recipient changed. Inspect the local release.");
const save = () =>
  writeFile(file, JSON.stringify(state, null, 2), { mode: 0o600 });
for (let i = 0; i < 3; i++) {
  if (!state.accounts[i]) {
    const key = KeyPair.fromRandom("ed25519");
    state.accounts.push({
      accountId: `writ-fund${i + 1}-${Date.now().toString(36)}.testnet`,
      publicKey: key.getPublicKey().toString(),
      privateKey: key.toString(),
    });
    await save();
  }
  const entry = state.accounts[i];
  if (entry.hash || entry.observedSpent) continue;
  let accountState;
  try {
    accountState = await provider.viewAccount({ accountId: entry.accountId });
  } catch (e) {
    if (
      !e.message?.includes("does not exist") &&
      e.type !== "AccountDoesNotExist"
    )
      throw e;
    const response = await fetch("https://helper.testnet.near.org/account", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        newAccountId: entry.accountId,
        newAccountPublicKey: entry.publicKey,
      }),
      signal: AbortSignal.timeout(30000),
    });
    if (!response.ok)
      throw new Error(
        `Testnet faucet declined funding account ${i + 1}: HTTP ${response.status}. No retry or alternate faucet was used.`,
      );
    accountState = await provider.viewAccount({ accountId: entry.accountId });
  }
  if (BigInt(accountState.amount) < nearToYocto("0.3")) {
    entry.observedSpent = true;
    await save();
    continue;
  }
  const amount = nearToYocto("9.8");
  if (BigInt(accountState.amount) < amount + nearToYocto("0.1"))
    throw new Error("Faucet allocation differs from the capped funding plan.");
  const signer = new Account(
    entry.accountId,
    provider,
    new KeyPairSigner(KeyPair.fromString(entry.privateKey)),
  );
  const result = await signer.signAndSendTransaction({
    receiverId: alice.accountId,
    actions: [actions.transfer(amount)],
    waitUntil: "FINAL",
  });
  entry.hash = result.transaction.hash;
  await save();
  console.log(
    `Testnet-only faucet contribution ${i + 1}/3 confirmed: ${entry.hash}`,
  );
}
