import { Sandbox, GenesisAccount } from "near-sandbox";
import {
  Account,
  JsonRpcProvider,
  KeyPair,
  KeyPairSigner,
  nearToYocto,
  actions,
} from "near-api-js";
import { readFile, mkdir, writeFile } from "node:fs/promises";

export async function startChain() {
  const trace = [];
  const key = KeyPair.fromRandom("ed25519");
  const genesis = new GenesisAccount(
    "writroot",
    key.getPublicKey().toString(),
    key.toString(),
    nearToYocto("100000"),
  );
  const sandbox = await Sandbox.start({
    config: { additionalAccounts: [genesis] },
  });
  const provider = new JsonRpcProvider({ url: sandbox.rpcUrl });
  const root = new Account("writroot", provider, new KeyPairSigner(key));
  async function account(prefix, balance = "100") {
    const nextKey = KeyPair.fromRandom("ed25519");
    await root.createSubAccount({
      accountOrPrefix: prefix,
      publicKey: nextKey.getPublicKey(),
      nearToTransfer: nearToYocto(balance),
    });
    return new Account(
      `${prefix}.writroot`,
      provider,
      new KeyPairSigner(nextKey),
    );
  }
  async function deploy(prefix, artifact, init, args) {
    const result = await account(prefix);
    const code = new Uint8Array(
      await readFile(new URL(`../artifacts/${artifact}.wasm`, import.meta.url)),
    );
    await result.signAndSendTransaction({
      receiverId: result.accountId,
      actions: [
        actions.deployContract(code),
        actions.functionCall(init, args, 80_000_000_000_000n, 0n),
      ],
      waitUntil: "FINAL",
    });
    return result;
  }
  function record(method, result) {
    if (!result?.transaction) return;
    const outcomes = [result.transaction_outcome, ...result.receipts_outcome];
    trace.push({
      method,
      transactionHash: result.transaction.hash,
      signer: result.transaction.signer_id,
      receiver: result.transaction.receiver_id,
      status: result.status,
      gasBurnt: outcomes
        .reduce((n, o) => n + BigInt(o.outcome.gas_burnt), 0n)
        .toString(),
      tokensBurnt: outcomes
        .reduce((n, o) => n + BigInt(o.outcome.tokens_burnt), 0n)
        .toString(),
      receiptCount: result.receipts_outcome.length,
      receiptIds: result.receipts_outcome.map((o) => o.id),
    });
  }
  const call = async (signer, contract, method, args = {}, deposit = "0") => {
    try {
      const result = await signer.callFunctionRaw({
        contractId:
          typeof contract === "string" ? contract : contract.accountId,
        methodName: method,
        args,
        deposit: BigInt(deposit),
        gas: 300_000_000_000_000n,
        waitUntil: "FINAL",
      });
      record(method, result);
      const value = result.status?.SuccessValue;
      return value
        ? JSON.parse(Buffer.from(value, "base64").toString("utf8"))
        : null;
    } catch (e) {
      record(method, e.transactionResult);
      throw e;
    }
  };
  const raw = (signer, contract, method, args = {}, deposit = "0") =>
    signer.callFunctionRaw({
      contractId: typeof contract === "string" ? contract : contract.accountId,
      methodName: method,
      args,
      deposit: BigInt(deposit),
      gas: 300_000_000_000_000n,
      waitUntil: "FINAL",
    });
  const view = (contract, method, args = {}) =>
    provider.callFunction({
      contractId: typeof contract === "string" ? contract : contract.accountId,
      method,
      args,
    });
  async function mint(
    owner,
    collection,
    target,
    template = "contract-owner",
    clientId = crypto.randomUUID(),
  ) {
    const quote = await view(collection, "get_mint_quote", {
      template_id: template,
      target: typeof target === "string" ? target : target.accountId,
    });
    await call(
      owner,
      collection,
      "mint",
      {
        template_id: template,
        target: typeof target === "string" ? target : target.accountId,
        client_request_id: clientId,
      },
      quote.deposit,
    );
    const minted = await view(collection, "get_mint_result", {
      owner_id: owner.accountId,
      client_request_id: clientId,
    });
    if (minted.status !== "ready")
      throw new Error(`Mint did not complete: ${minted.status}`);
    return await view(collection, "get_writ", { token_id: minted.tokenId });
  }
  return {
    sandbox,
    provider,
    root,
    account,
    deploy,
    call,
    raw,
    view,
    mint,
    nearToYocto,
    async close() {
      const dir = new URL(
        `./results/${process.env.WRIT_EVIDENCE_RUN || "local"}/`,
        import.meta.url,
      );
      await mkdir(dir, { recursive: true });
      await writeFile(
        new URL(`${crypto.randomUUID()}.json`, dir),
        JSON.stringify(trace, null, 2),
      );
      await sandbox.tearDown();
    },
  };
}
