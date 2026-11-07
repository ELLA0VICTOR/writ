import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
import { startChain } from "../harness.mjs";
const source = stripTypeScriptTypes(
  await readFile(new URL("../../sdk/index.ts", import.meta.url), "utf8"),
);
const { WritClient } = await import(
  `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`
);

test(
  "standalone external application: real chain reads, verified artwork, wallet-shaped command and old-holder rejection",
  { timeout: 180000 },
  async () => {
    const c = await startChain();
    try {
      const alice = await c.account("alice");
      const bob = await c.account("bob");
      const collection = await c.deploy("writ", "collection", "new", {});
      const target = await c.deploy("target", "owner-fixture", "new", {
        owner_id: alice.accountId,
      });
      const w = await c.mint(alice, collection, target);
      const config = await c.view(collection, "get_frontend_config");
      const state = await c.provider.viewAccount({
        accountId: collection.accountId,
      });
      const client = new WritClient({
        rpcUrl: c.sandbox.rpcUrl,
        network: "localnet",
        collection: collection.accountId,
        collectionCodeHash: state.code_hash,
        executorCodeHash: config.executor_code_hash,
        templateHashes: config.template_hashes,
      });
      const before = await client.nft(w.id);
      const verified = await client.verifyDeployment();
      assert(verified.hash && /^\d+$/.test(verified.height));
      assert.equal(before.nft.owner_id, alice.accountId);
      assert(before.mediaHashVerified);
      await assert.rejects(
        () =>
          client.buildAction({
            tokenId: w.id,
            actor: alice.accountId,
            method: "set_price",
            args: { price: "3" },
          }),
        /handover/,
      );
      await c.call(
        alice,
        target,
        "own_propose_owner",
        { account_id: w.executor },
        "1",
      );
      await c.call(alice, collection, "wrap_step", { token_id: w.id, step: 1 });
      await c.call(alice, collection, "confirm_wrap", { token_id: w.id });
      const report = await client.inspect(w.id, true);
      assert(!("roleOwner" in report.writ));
      assert(!("accessKeys" in report.writ));
      assert(!("balance" in report.writ));
      assert.equal(report.nft.owner_id, alice.accountId);
      assert.equal(report.executor.keys.length, 0);
      assert.equal(report.collection.keys[0].permission, "FullAccess");
      assert.equal(
        report.target.keys[0].permission,
        "FullAccess",
        "independent target override is disclosed, not hidden",
      );
      const tx = await client.buildAction({
        tokenId: w.id,
        actor: alice.accountId,
        method: "set_price",
        args: { price: "3" },
      });
      const p = tx.actions[0].params;
      assert.equal(
        await c.call(alice, tx.receiverId, p.methodName, p.args, p.deposit),
        true,
      );
      assert.equal(await c.view(target, "get_price"), "3");
      await c.call(
        alice,
        collection,
        "nft_transfer",
        { token_id: w.id, receiver_id: bob.accountId },
        "1",
      );
      await assert.rejects(
        () =>
          client.buildAction({
            tokenId: w.id,
            actor: alice.accountId,
            method: "set_price",
            args: { price: "8" },
          }),
        /no permission/,
      );
      // A stale prepared transaction still cannot bypass the actual contract check.
      await assert.rejects(() =>
        c.call(alice, tx.receiverId, p.methodName, p.args, p.deposit),
      );
      await assert.rejects(() =>
        c.call(alice, target, "set_price", { price: "999" }),
      );
      const next = await client.buildAction({
        tokenId: w.id,
        actor: bob.accountId,
        method: "set_price",
        args: { price: "8" },
      });
      const np = next.actions[0].params;
      assert.equal(
        await c.call(bob, next.receiverId, np.methodName, np.args, np.deposit),
        true,
      );
      assert.equal(await c.view(target, "get_price"), "8");
      const confirmedResult = await c.raw(
        bob,
        next.receiverId,
        np.methodName,
        np.args,
        np.deposit,
      );
      assert.equal(
        (
          await client.confirmAction(
            confirmedResult.transaction.hash,
            bob.accountId,
            next,
          )
        ).success,
        true,
      );
      await assert.rejects(
        () =>
          client.confirmAction(
            confirmedResult.transaction.hash,
            bob.accountId,
            {
              ...next,
              actions: [
                {
                  ...next.actions[0],
                  params: {
                    ...np,
                    args: { ...np.args, args: { price: "unrequested" } },
                  },
                },
              ],
            },
          ),
        /differs/,
      );
      const after = await client.nft(w.id);
      assert.equal(after.nft.owner_id, bob.accountId);
      assert(after.mediaHashVerified);
      assert.notEqual(
        after.nft.metadata.media_hash,
        before.nft.metadata.media_hash,
      );
      const wrong = new WritClient({
        ...client.options,
        collectionCodeHash: "unreviewed-code",
      });
      await assert.rejects(() => wrong.inspect(w.id), /code changed/);
      let reads = 0;
      const resilient = new WritClient({
        ...client.options,
        fetch: (...args) =>
          ++reads === 1
            ? Promise.resolve(new Response(null, { status: 503 }))
            : fetch(...args),
      });
      assert.equal(
        (await resilient.inspect(w.id, true)).nft.owner_id,
        bob.accountId,
      );
    } finally {
      await c.close();
    }
  },
);
