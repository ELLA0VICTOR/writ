import published from "../content/deployment.json";
/** Public release identities. Explicit env configuration replaces, rather than mixes with, a release. */
export function deploymentConfig() {
  const explicit = import.meta.env.VITE_WRIT_CONTRACT !== undefined;
  return {
    collection: explicit
      ? import.meta.env.VITE_WRIT_CONTRACT || ""
      : published.collection,
    abiVersion: explicit
      ? import.meta.env.VITE_WRIT_ABI_VERSION || ""
      : published.abiVersion,
    collectionCodeHash: explicit
      ? import.meta.env.VITE_COLLECTION_CODE_HASH || ""
      : published.collectionCodeHash,
    executorCodeHash: explicit
      ? import.meta.env.VITE_EXECUTOR_CODE_HASH || ""
      : published.executorCodeHash,
    rpcUrl:
      import.meta.env.VITE_NEAR_RPC_URL || "https://test.rpc.fastnear.com",
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
      : (published.templateHashes as Record<string, string>),
  };
}
