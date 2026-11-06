import { Account, JsonRpcProvider, KeyPair, KeyPairSigner } from "near-api-js";
import { mkdir, readFile, writeFile } from "node:fs/promises";
export const provider = new JsonRpcProvider({
  url: process.env.WRIT_TESTNET_RPC || "https://test.rpc.fastnear.com",
});
const releaseName = process.env.WRIT_TESTNET_RELEASE || "deployment";
if (!/^[a-z0-9-]{1,48}$/.test(releaseName))
  throw new Error("Invalid testnet release label.");
export const deploymentDirectory = new URL(
  `../.local/${releaseName}/`,
  import.meta.url,
);
const folder = deploymentDirectory;
export async function testnetAccounts() {
  const network = await provider.sendJsonRpc("status", []);
  if (network.chain_id !== "testnet")
    throw new Error(
      "Testnet deployment refused: RPC is not NEAR testnet. No accounts or transactions were created.",
    );
  await mkdir(folder, { recursive: true });
  const filename = new URL("accounts.json", folder);
  let saved;
  try {
    saved = JSON.parse(await readFile(filename, "utf8"));
  } catch (e) {
    if (e.code !== "ENOENT") throw e;
    const suffix = Date.now().toString(36);
    saved = {};
    for (const role of ["collection", "alice", "bob", "target", "dao"]) {
      const key = KeyPair.fromRandom("ed25519");
      saved[role] = {
        accountId: `writ-${role}-${suffix}.testnet`,
        publicKey: key.getPublicKey().toString(),
        privateKey: key.toString(),
      };
    }
    await writeFile(filename, JSON.stringify(saved, null, 2), { mode: 0o600 });
  }
  const result = {};
  for (const [role, credentials] of Object.entries(saved)) {
    let exists = true;
    try {
      await provider.viewAccount({ accountId: credentials.accountId });
    } catch (e) {
      if (
        e.message?.includes("does not exist") ||
        e.type === "AccountDoesNotExist"
      )
        exists = false;
      else throw e;
    }
    if (!exists) {
      const response = await fetch("https://helper.testnet.near.org/account", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          newAccountId: credentials.accountId,
          newAccountPublicKey: credentials.publicKey,
        }),
        signal: AbortSignal.timeout(30000),
      });
      if (!response.ok)
        throw new Error(
          `Testnet faucet refused ${role}: HTTP ${response.status}. Keys remain in the ignored local release directory.`,
        );
      await provider.viewAccount({ accountId: credentials.accountId });
    }
    result[role] = new Account(
      credentials.accountId,
      provider,
      new KeyPairSigner(KeyPair.fromString(credentials.privateKey)),
    );
    console.log(`Testnet account ready: ${credentials.accountId}`);
  }
  return result;
}
if (process.argv.includes("--fund")) await testnetAccounts();
