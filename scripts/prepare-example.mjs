import { mkdir, readFile, writeFile } from "node:fs/promises";
const folder = new URL("../examples/external-app/public/", import.meta.url);
await mkdir(folder, { recursive: true });
const release = JSON.parse(
  await readFile(
    new URL("../src/content/deployment.json", import.meta.url),
    "utf8",
  ),
);
const input = process.env.WRIT_EXAMPLE_DEPLOYMENT
  ? JSON.parse(await readFile(process.env.WRIT_EXAMPLE_DEPLOYMENT, "utf8"))
  : release;
if (
  !["testnet", "mainnet"].includes(input.network) ||
  typeof input.collection !== "string" ||
  !/^[a-z0-9]+(?:[._-][a-z0-9]+)*$/.test(input.collection) ||
  input.collection.length < 2 ||
  input.collection.length > 41
)
  throw new Error(
    "Use a public mainnet or testnet Writ deployment manifest with a valid collection account.",
  );
if (input.network === "mainnet" && input.collection.endsWith(".testnet"))
  throw new Error("Mainnet cannot use a testnet collection.");
for (const key of ["abiVersion", "collectionCodeHash", "executorCodeHash"])
  if (input[key] !== undefined && input[key] !== release[key])
    throw new Error("The example supports this reviewed Writ release only.");
if (
  input.templateHashes &&
  (Object.keys(input.templateHashes).length !==
    Object.keys(release.templateHashes).length ||
    Object.entries(release.templateHashes).some(
      ([id, hash]) => input.templateHashes[id] !== hash,
    ))
)
  throw new Error("Unrecognized role template hashes.");
const rpcUrl =
  input.rpcUrl ||
  (input.network === "mainnet"
    ? "https://free.rpc.fastnear.com"
    : "https://test.rpc.fastnear.com");
const url = new URL(rpcUrl);
if (
  url.protocol !== "https:" ||
  url.username ||
  url.password ||
  url.search ||
  url.hash
)
  throw new Error("Use a public HTTPS RPC URL without secrets.");
await writeFile(
  new URL("deployment.json", folder),
  JSON.stringify(
    {
      network: input.network,
      collection: input.collection,
      rpcUrl,
      abiVersion: release.abiVersion,
      collectionCodeHash: release.collectionCodeHash,
      executorCodeHash: release.executorCodeHash,
      templateHashes: release.templateHashes,
    },
    null,
    2,
  ),
);
console.log(
  `Prepared public ${input.network} deployment configuration. No keys or credentials are included.`,
);
