import { WritClient } from "../../../sdk/index";
import {
  deploymentConfig,
  type DeploymentConfig,
} from "../../chain/deployment";
export function integrationClient(
  deployment: DeploymentConfig = deploymentConfig(),
) {
  return new WritClient({
    rpcUrl: deployment.rpcUrl,
    network: deployment.network,
    collection: deployment.collection,
    collectionCodeHash: deployment.collectionCodeHash,
    executorCodeHash: deployment.executorCodeHash,
    templateHashes: Object.fromEntries(
      Object.entries(deployment.templateHashes).filter(([, hash]) => hash),
    ),
  });
}
