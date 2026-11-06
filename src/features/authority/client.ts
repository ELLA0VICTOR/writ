import { WritClient } from "../../../sdk/index";
import { deploymentConfig } from "../../chain/deployment";
export function integrationClient() {
  const deployment = deploymentConfig();
  return new WritClient({
    rpcUrl: deployment.rpcUrl,
    network: "testnet",
    collection: deployment.collection,
    collectionCodeHash: deployment.collectionCodeHash,
    executorCodeHash: deployment.executorCodeHash,
    templateHashes: Object.fromEntries(
      Object.entries(deployment.templateHashes).filter(([, hash]) => hash),
    ),
  });
}
