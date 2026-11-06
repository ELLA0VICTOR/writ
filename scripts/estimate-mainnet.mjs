// Read-only planning. Does not load keys, create accounts or send transactions.
import { readFile, writeFile } from "node:fs/promises";
import { JsonRpcProvider } from "near-api-js";
const rpc = new JsonRpcProvider({ url: "https://free.rpc.fastnear.com" });
const status = await rpc.sendJsonRpc("status", []);
if (status.chain_id !== "mainnet")
  throw new Error("Pricing RPC is not mainnet.");
const [protocol, gas] = await Promise.all([
  rpc.sendJsonRpc("EXPERIMENTAL_protocol_config", { finality: "final" }),
  rpc.sendJsonRpc("gas_price", [null]),
]);
const cost = BigInt(protocol.runtime_config.storage_amount_per_byte);
const bytes = {};
for (const id of ["collection", "executor", "owner-fixture"])
  bytes[id] = (
    await readFile(new URL(`../artifacts/${id}.wasm`, import.meta.url))
  ).length;
const near = (x) =>
  `${x / 10n ** 24n}.${(x % 10n ** 24n).toString().padStart(24, "0")}`
    .replace(/0+$/, "")
    .replace(/\.$/, "");
const code = cost * BigInt(bytes.collection);
const mint = cost * BigInt(bytes.executor + 4096 + 131072) + 10n ** 23n;
const practice =
  cost * BigInt(bytes["owner-fixture"] + 4096 + 2048) + 2n * 10n ** 23n;
const record = {
  observedAt: new Date().toISOString(),
  network: "mainnet pricing, planning only",
  storageCostPerByteYocto: cost.toString(),
  gasPriceYoctoPerGas: String(gas.gas_price),
  binaryBytes: bytes,
  collectionCodeStorageFloorNear: near(code),
  oneWritQuotedDepositNear: near(mint),
  optionalPracticeQuotedDepositNear: near(practice),
  codeAndDepositsSubtotalNear: near(code + mint + practice),
  planningBalanceNear: { minimum: 15, maximum: 18 },
  scope:
    "One small release with one Writ and an optional compatible practice target, before final mainnet quotes. Excludes a new Sputnik DAO, additional Writs, market purchase prices and multiple funded demo wallets. Not a spending approval or final bill.",
  storageTreatment:
    "Protocol storage stakes are locked while data remains. Application record allocations are retained and are not automatically refundable. Executor operating reserve is excluded from withdrawals.",
  sources: [
    "https://docs.near.org/protocol/storage/storage-staking",
    "https://free.rpc.fastnear.com",
  ],
};
await writeFile(
  new URL("../docs/mainnet-cost-estimate.json", import.meta.url),
  JSON.stringify(record, null, 2) + "\n",
);
console.log(JSON.stringify(record, null, 2));
