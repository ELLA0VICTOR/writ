import { NearConnector } from "@hot-labs/near-connect";
import { WritClient } from "../../sdk/index";
const element = <T extends HTMLElement>(id: string) =>
  document.getElementById(id) as T;
const message = (text: string) => {
  element("message").textContent = text;
};
const deployment = await fetch("/deployment.json").then((r) => {
  if (!r.ok) throw new Error("Run npm run example:prepare first.");
  return r.json();
});
if (deployment.network !== "mainnet" && deployment.network !== "testnet")
  throw new Error("Choose a mainnet or testnet public deployment manifest.");
const network: "mainnet" | "testnet" = deployment.network;
const connector = new NearConnector({ network, autoConnect: false });
element("network").textContent = `Separate application · NEAR ${network}`;
const client = new WritClient({
  rpcUrl:
    deployment.rpcUrl ||
    (network === "mainnet"
      ? "https://free.rpc.fastnear.com"
      : "https://test.rpc.fastnear.com"),
  network,
  collection: deployment.collection,
  collectionCodeHash: deployment.collectionCodeHash,
  executorCodeHash: deployment.executorCodeHash,
  templateHashes: deployment.templateHashes,
});
let actor = "";
let actions: {
  method: string;
  label: string;
  args: Record<string, unknown>;
}[] = [];
const run = (f: () => Promise<void>) =>
  void f().catch((e) =>
    message(e instanceof Error ? e.message : "Request failed."),
  );
const select = element<HTMLSelectElement>("wallet");
void connector.whenManifestLoaded
  .then(() => {
    select.replaceChildren();
    for (const wallet of connector.availableWallets.filter(
      (w) =>
        w.manifest.features[network] &&
        w.manifest.features.signAndSendTransaction,
    )) {
      const option = document.createElement("option");
      option.value = wallet.manifest.id;
      option.textContent = wallet.manifest.name;
      select.append(option);
    }
    element<HTMLButtonElement>("connect").disabled =
      select.options.length === 0;
  })
  .catch(() =>
    message("Wallet discovery is unavailable. Public inspection still works."),
  );
element("connect").onclick = () =>
  run(async () => {
    const wallet = await connector.connect({ walletId: select.value });
    actor = (await wallet.getAccounts())[0]?.accountId ?? "";
    element("account").textContent = actor || "No account selected.";
    element<HTMLButtonElement>("disconnect").disabled = !actor;
    element<HTMLButtonElement>("send").disabled = !actor || !actions.length;
    message("Connected. Inspect your Writ before sending a command.");
  });
element("disconnect").onclick = () =>
  run(async () => {
    await (await connector.wallet()).signOut();
    actor = "";
    element("account").textContent = "No wallet connected.";
    element<HTMLButtonElement>("send").disabled = true;
    element<HTMLButtonElement>("disconnect").disabled = true;
  });
element("inspect").onclick = () =>
  run(async () => {
    element<HTMLButtonElement>("send").disabled = true;
    message("Reading finalized contract state…");
    const id = element<HTMLInputElement>("token").value;
    const report = await client.inspect(id, true);
    element("evidence").textContent = JSON.stringify(
      report,
      (key, value) =>
        key === "media"
          ? "[Artwork displayed above; its SHA-256 hash was verified.]"
          : value,
      2,
    );
    const image = element<HTMLImageElement>("art");
    image.src = report.nft!.metadata.media;
    image.hidden = false;
    actions = report.template.actions;
    const methods = element<HTMLSelectElement>("method");
    methods.replaceChildren();
    for (const a of actions) {
      const option = document.createElement("option");
      option.value = a.method;
      option.textContent = a.label;
      methods.append(option);
    }
    element<HTMLTextAreaElement>("args").value = JSON.stringify(
      actions[0]?.args ?? {},
      null,
      2,
    );
    element<HTMLButtonElement>("send").disabled = !actor;
    message(
      `Current holder: ${report.writ.owner}. Artwork hash verified. Permission is checked again before signing.`,
    );
  });
element<HTMLSelectElement>("method").onchange = () => {
  element<HTMLTextAreaElement>("args").value = JSON.stringify(
    actions.find((a) => a.method === element<HTMLSelectElement>("method").value)
      ?.args ?? {},
    null,
    2,
  );
};
element<HTMLButtonElement>("inspect").disabled = false;
element("command").onsubmit = (e) => {
  e.preventDefault();
  run(async () => {
    if (!actor) throw new Error("Connect your own wallet first.");
    const transaction = await client.buildAction({
      tokenId: element<HTMLInputElement>("token").value,
      actor,
      method: element<HTMLSelectElement>("method").value,
      args: JSON.parse(element<HTMLTextAreaElement>("args").value),
    });
    message("Review the command in your wallet.");
    const result = await (
      await connector.wallet()
    ).signAndSendTransaction(transaction);
    message("Confirming the command outcome on NEAR…");
    const confirmed = await client.confirmAction(
      result.transaction.hash,
      actor,
      transaction,
    );
    element("evidence").textContent = JSON.stringify(confirmed, null, 2);
    message(
      `Command completed on NEAR ${network}. Transaction: ${confirmed.hash}`,
    );
  });
};
