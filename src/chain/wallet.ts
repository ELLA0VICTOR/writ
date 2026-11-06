import type { NearConnector } from "@hot-labs/near-connect";
import { ChainError } from "./errors";
let connectorPromise: Promise<NearConnector> | undefined;
export function getConnector(): Promise<NearConnector> {
  return (connectorPromise ??= import("@hot-labs/near-connect").then(
    ({ NearConnector }) => {
      const connector = new NearConnector({
        network: "testnet",
        autoConnect: false,
      });
      connector.on("wallet:signIn", () =>
        window.dispatchEvent(new Event("writ:wallet")),
      );
      connector.on("wallet:signOut", () =>
        window.dispatchEvent(new Event("writ:wallet")),
      );
      return connector;
    },
  ));
}
export async function walletSession() {
  if (!connectorPromise) return null;
  try {
    const { accounts } = await (await getConnector()).getConnectedWallet();
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
) {
  const connector = await getConnector();
  try {
    const wallet = await connector.wallet();
    const result = await wallet.signAndSendTransaction({
      receiverId,
      actions: [
        {
          type: "FunctionCall",
          params: { methodName, args, gas: "250000000000000", deposit },
        },
      ],
    });
    if (typeof result.status === "object" && "Failure" in result.status)
      throw new ChainError(
        "invalid_input",
        "The transaction failed on chain. Review its receipts before trying again.",
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
  }
}
