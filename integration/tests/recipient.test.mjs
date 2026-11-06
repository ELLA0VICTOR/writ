import { test } from "node:test";
import assert from "node:assert/strict";
import { startChain } from "../harness.mjs";

test(
  "internal keyless accounts cannot receive a Writ and strand its authority",
  { timeout: 120000 },
  async () => {
    const c = await startChain();
    try {
      const alice = await c.account("alice"),
        bob = await c.account("bob"),
        collection = await c.deploy("writ", "collection", "new", {}),
        target = await c.deploy("target", "owner-fixture", "new", {
          owner_id: alice.accountId,
        });
      const w = await c.mint(alice, collection, target);
      for (const receiver of [
        collection.accountId,
        w.executor,
        `p1.${collection.accountId}`,
        `nested.w99.${collection.accountId}`,
      ]) {
        await assert.rejects(
          () =>
            c.call(
              alice,
              collection,
              "nft_transfer",
              { token_id: w.id, receiver_id: receiver },
              "1",
            ),
          /infrastructure|Collection cannot hold/,
        );
        await assert.rejects(
          () =>
            c.call(
              alice,
              collection,
              "nft_transfer_call",
              { token_id: w.id, receiver_id: receiver, msg: "accept" },
              "1",
            ),
          /infrastructure|Collection cannot hold/,
        );
        assert.equal(
          (await c.view(collection, "nft_token", { token_id: w.id })).owner_id,
          alice.accountId,
        );
      }
      await c.call(
        alice,
        collection,
        "nft_transfer",
        { token_id: w.id, receiver_id: bob.accountId },
        "1",
      );
      assert.equal(
        (await c.view(collection, "nft_token", { token_id: w.id })).owner_id,
        bob.accountId,
      );
    } finally {
      await c.close();
    }
  },
);
