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
      connector.on("wallet:signIn", () => {
        localStorage.setItem("writ-wallet-connected", "1");
        window.dispatchEvent(new Event("writ:wallet"));
      });
      connector.on("wallet:signOut", () => {
        localStorage.removeItem("writ-wallet-connected");
        window.dispatchEvent(new Event("writ:wallet"));
      });
      return connector;
    },
  ));
}
export async function walletSession() {
  if (
    !connectorPromise &&
    localStorage.getItem("writ-wallet-connected") !== "1"
  )
    return null;
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
    const { JsonRpcProvider } = await import("near-api-js");
    const rpc = new JsonRpcProvider({
      url: import.meta.env.VITE_NEAR_RPC_URL || "https://test.rpc.fastnear.com",
    });
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
  }
}
