import published from "../content/deployment.json";

export type NearNetwork = "testnet" | "mainnet";
export interface DeploymentConfig {
  network: NearNetwork;
  collection: string;
  abiVersion: string;
  collectionCodeHash: string;
  executorCodeHash: string;
  rpcUrl: string;
  templateHashes: Record<string, string>;
  examples?: Record<string, string>;
}
export const rpcUrls: Record<NearNetwork, string> = {
  testnet: "https://test.rpc.fastnear.com",
  mainnet: "https://free.rpc.fastnear.com",
};
export function transactionUrl(network: NearNetwork, hash: string) {
  return `https://${network === "testnet" ? "testnet." : ""}nearblocks.io/txns/${encodeURIComponent(hash)}`;
}
/** Same reviewed bytecode on either network; this does not imply a mainnet deployment exists. */
export function releaseConfig(
  network: NearNetwork,
  collection = "",
): DeploymentConfig {
  return {
    network,
    collection,
    abiVersion: published.abiVersion,
    collectionCodeHash: published.collectionCodeHash,
    executorCodeHash: published.executorCodeHash,
    templateHashes: { ...published.templateHashes },
    rpcUrl: rpcUrls[network],
  };
}
/** Explicit legacy environment configuration replaces the public testnet release. */
export function deploymentConfig(): DeploymentConfig {
  const explicit = import.meta.env.VITE_WRIT_CONTRACT !== undefined;
  return {
    ...releaseConfig(
      "testnet",
      explicit
        ? import.meta.env.VITE_WRIT_CONTRACT || ""
        : published.collection,
    ),
    abiVersion: explicit
      ? import.meta.env.VITE_WRIT_ABI_VERSION || ""
      : published.abiVersion,
    collectionCodeHash: explicit
      ? import.meta.env.VITE_COLLECTION_CODE_HASH || ""
      : published.collectionCodeHash,
    executorCodeHash: explicit
      ? import.meta.env.VITE_EXECUTOR_CODE_HASH || ""
      : published.executorCodeHash,
    rpcUrl: import.meta.env.VITE_NEAR_RPC_URL || rpcUrls.testnet,
    templateHashes: explicit
      ? {
          "contract-owner": import.meta.env.VITE_OWNER_TEMPLATE_HASH || "",
          "dao-council": import.meta.env.VITE_DAO_TEMPLATE_HASH || "",
          "collection-admin":
            import.meta.env.VITE_COLLECTION_TEMPLATE_HASH || "",
          "token-issuer": import.meta.env.VITE_ISSUER_TEMPLATE_HASH || "",
          "treasury-controller":
            import.meta.env.VITE_TREASURY_TEMPLATE_HASH || "",
        }
      : { ...published.templateHashes },
    ...(!explicit ? { examples: { ...published.examples } } : {}),
  };
}
/** Parse only public fields. An imported manifest cannot replace the reviewed release hashes. */
export function parseDeployment(
  value: unknown,
  allowEmpty = false,
): DeploymentConfig {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Import a public Writ deployment manifest.");
  const v = value as Record<string, unknown>;
  if (v.network !== "mainnet" && v.network !== "testnet")
    throw new Error("Choose mainnet or testnet.");
  const config = releaseConfig(v.network);
  if (allowEmpty && v.collection === "") return config;
  if (
    typeof v.collection !== "string" ||
    !/^[a-z0-9]+(?:[._-][a-z0-9]+)*$/.test(v.collection) ||
    v.collection.length < 2 ||
    v.collection.length > 41
  )
    throw new Error(
      "Enter a valid Writ collection account (2–41 characters, leaving room for executor subaccounts).",
    );
  if (
    v.network === "mainnet" &&
    (v.collection.endsWith(".testnet") || v.collection === "testnet")
  )
    throw new Error("A testnet collection cannot be used on mainnet.");
  config.collection = v.collection;
  if (v.rpcUrl !== undefined) {
    if (typeof v.rpcUrl !== "string")
      throw new Error("Enter a public HTTPS RPC URL.");
    const url = new URL(v.rpcUrl);
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.hash ||
      url.search
    )
      throw new Error(
        "Use a public HTTPS RPC URL without credentials or query parameters.",
      );
    config.rpcUrl = url.href;
  }
  for (const key of [
    "abiVersion",
    "collectionCodeHash",
    "executorCodeHash",
  ] as const)
    if (v[key] !== undefined && v[key] !== config[key])
      throw new Error(
        "This manifest uses a different Writ release. A reviewed client update is required.",
      );
  if (v.templateHashes !== undefined) {
    if (
      !v.templateHashes ||
      typeof v.templateHashes !== "object" ||
      Array.isArray(v.templateHashes)
    )
      throw new Error("Invalid template hashes.");
    const hashes = v.templateHashes as Record<string, unknown>;
    if (
      Object.keys(hashes).length !==
        Object.keys(config.templateHashes).length ||
      Object.entries(config.templateHashes).some(
        ([id, hash]) => hashes[id] !== hash,
      )
    )
      throw new Error(
        "Template hashes do not match this reviewed Writ release.",
      );
  }
  return config;
}
const storageKey = "writ-public-deployment-v1";
export function loadDeployment(): DeploymentConfig {
  try {
    const stored = localStorage.getItem(storageKey);
    if (stored) return parseDeployment(JSON.parse(stored), true);
  } catch {
    /* Invalid or unavailable storage never selects an unverified network. */
  }
  return deploymentConfig();
}
export function saveDeployment(config: DeploymentConfig | null) {
  if (config)
    localStorage.setItem(
      storageKey,
      JSON.stringify(parseDeployment(config, true)),
    );
  else localStorage.removeItem(storageKey);
}
export function deploymentKey(config: DeploymentConfig) {
  return `${config.network}:${config.collection}:${config.rpcUrl}`;
}
export function purchaseKey(
  mode: "mock" | NearNetwork,
  collection: string,
  id: string,
) {
  return `writ-purchase:${mode}:${collection}:${id}`;
}
