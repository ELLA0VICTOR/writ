import type { NearConnector } from "@hot-labs/near-connect";
import { ChainError } from "./errors";
import {
  deploymentConfig,
  type DeploymentConfig,
  type NearNetwork,
} from "./deployment";
const connectors = new Map<NearNetwork, Promise<NearConnector>>();
let pendingRequests = 0;
export const walletRequestPending = () => pendingRequests > 0;
function busy(delta: number) {
  pendingRequests += delta;
  window.dispatchEvent(new Event("writ:wallet-request"));
}
function sessionKey(config: DeploymentConfig) {
  return `writ-wallet-connected:${config.network}:${config.collection}`;
}
export function rememberWallet(config: DeploymentConfig, connected: boolean) {
  if (connected) localStorage.setItem(sessionKey(config), "1");
  else localStorage.removeItem(sessionKey(config));
  window.dispatchEvent(new Event("writ:wallet"));
}
export function getConnector(
  network: NearNetwork = "testnet",
): Promise<NearConnector> {
  let pending = connectors.get(network);
  if (pending) return pending;
  pending = import("@hot-labs/near-connect").then(({ NearConnector }) => {
    const connector = new NearConnector({
      network,
      autoConnect: false,
      storage: {
        get: async (key) =>
          localStorage.getItem(`writ-connector:${network}:${key}`),
        set: async (key, value) => {
          localStorage.setItem(`writ-connector:${network}:${key}`, value);
        },
        remove: async (key) => {
          localStorage.removeItem(`writ-connector:${network}:${key}`);
        },
      },
    });
    connector.on("wallet:signIn", () => {
      window.dispatchEvent(new Event("writ:wallet"));
    });
    connector.on("wallet:signOut", () => {
      window.dispatchEvent(new Event("writ:wallet"));
    });
    return connector;
  });
  connectors.set(network, pending);
  return pending;
}
export async function walletSession(
  config: DeploymentConfig = deploymentConfig(),
) {
  if (localStorage.getItem(sessionKey(config)) !== "1") return null;
  try {
    const { accounts } = await (
      await getConnector(config.network)
    ).getConnectedWallet();
    return accounts[0] ? { accountId: accounts[0].accountId } : null;
  } catch {
    return null;
  }
}
export async function walletCall(
  receiverId: string,
  methodName: string,
  args: object,
  deposit = "0",
  config: DeploymentConfig = deploymentConfig(),
  isActive: () => boolean = () => true,
) {
  if (pendingRequests)
    throw new ChainError("busy", "Finish the pending wallet request first.");
  busy(1);
  try {
    const { JsonRpcProvider } = await import("near-api-js");
    const rpc = new JsonRpcProvider({ url: config.rpcUrl });
    const status = await rpc.sendJsonRpc("status", []);
    if (status.chain_id !== config.network)
      throw new ChainError(
        "not_configured",
        "The RPC network differs from the selected network. Nothing was signed.",
      );
    const connector = await getConnector(config.network);
    const wallet = await connector.wallet();
    if (!isActive())
      throw new ChainError(
        "not_configured",
        "The network or deployment changed. Review the action again. Nothing was signed.",
      );
    const submitted = await wallet.signAndSendTransaction({
      receiverId,
      actions: [
        {
          type: "FunctionCall",
          params: { methodName, args, gas: "250000000000000", deposit },
        },
      ],
    });
    // A wallet may return after inclusion. Confirm the receipt chain before reporting completion.
    const result = await rpc.sendJsonRpc<typeof submitted>("tx", {
      tx_hash: submitted.transaction.hash,
      sender_account_id: submitted.transaction.signer_id,
      wait_until: "FINAL",
    });
    if (typeof result.status === "object" && "Failure" in result.status)
      throw new ChainError(
        "invalid_input",
        "The transaction failed on chain. Review its receipts before trying again.",
      );
    if (
      typeof result.status === "object" &&
      "SuccessValue" in result.status &&
      result.status.SuccessValue === "ZmFsc2U=" &&
      [
        "execute",
        "wrap_step",
        "confirm_wrap",
        "begin_unwrap",
        "finish_unwrap",
        "withdraw_fees",
        "withdraw_retired_funds",
        "withdraw_credit",
        "claim_refund",
      ].includes(methodName)
    )
      throw new ChainError(
        "invalid_input",
        "The contract reported that this action did not complete. Inspect the role and ledger before retrying.",
      );
    return { hash: result.transaction.hash, mock: false };
  } catch (error) {
    if (error instanceof ChainError) throw error;
    if (error instanceof Error && /reject|denied|cancel/i.test(error.message))
      throw new ChainError(
        "wallet_rejected",
        "You declined the wallet request. Your conditions have been kept.",
      );
    throw new ChainError(
      "outcome_unknown",
      "The wallet request did not return a confirmed outcome. Check your wallet activity before submitting again.",
    );
  } finally {
    busy(-1);
  }
}
