import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { startChain } from "../harness.mjs";

for (const profile of [
  "collection-admin",
  "token-issuer",
  "treasury-controller",
]) {
  test(
    `verified ${profile}: external effect, delegation policy, handover, direct old-wallet rejection and unwrap`,
    { timeout: 180000 },
    async () => {
      const c = await startChain();
      try {
        const alice = await c.account("alice");
        const bob = await c.account("bob");
        const guest = await c.account("guest");
        const collection = await c.deploy("writ", "collection", "new", {});
        const request = crypto.randomUUID();
        const quote = await c.view(collection, "get_practice_quote", {
          template_id: profile,
        });
        assert.equal(
          await c.call(
            alice,
            collection,
            "create_practice_target",
            { client_request_id: request, template_id: profile },
            quote.deposit,
          ),
          true,
        );
        const { target } = await c.view(collection, "get_practice_target", {
          owner_id: alice.accountId,
          client_request_id: request,
        });
        assert.equal(await c.view(target, "get_integration_profile"), profile);
        const w = await c.mint(alice, collection, target, profile);
        assert.equal(w.roleConfirmed, false);
        await assert.rejects(() =>
          c.call(alice, collection, "list", {
            token_id: w.id,
            price: "100",
            expected_nonce: w.nonce,
          }),
        );
        await c.call(
          alice,
          target,
          "own_propose_owner",
          { account_id: w.executor },
          "1",
        );
        assert.equal(
          await c.call(alice, collection, "wrap_step", {
            token_id: w.id,
            step: 1,
          }),
          true,
        );
        assert.equal(
          await c.call(alice, collection, "confirm_wrap", { token_id: w.id }),
          true,
        );
        const template = await c.view(collection, "get_template", {
          template_id: profile,
        });
        const method = template.actions[0].method;
        let args;
        if (profile === "collection-admin")
          args = {
            token_id: "collectible-1",
            receiver_id: guest.accountId,
            title: "Published through Writ",
          };
        if (profile === "token-issuer")
          args = { receiver_id: guest.accountId, amount: "25" };
        if (profile === "treasury-controller") {
          await c.call(
            guest,
            target,
            "fund_treasury",
            {},
            c.nearToYocto("1").toString(),
          );
          args = {
            receiver_id: guest.accountId,
            amount: c.nearToYocto("0.1").toString(),
          };
        }
        const action = {
          token_id: w.id,
          target_method: method,
          args,
          deposit: "0",
        };
        await assert.rejects(() => c.call(alice, target, method, args));
        assert.equal(await c.call(alice, collection, "execute", action), true);
        if (profile === "collection-admin") {
          assert.equal(
            (await c.view(target, "nft_token", { token_id: args.token_id }))
              .owner_id,
            guest.accountId,
          );
          assert.equal(
            (await c.view(target, "nft_token", { token_id: args.token_id }))
              .metadata.title,
            args.title,
          );
          assert.equal(
            await c.view(target, "nft_supply_for_owner", {
              account_id: guest.accountId,
            }),
            "1",
          );
          const loanArgs = { ...args, token_id: "borrower-publication" };
          await c.call(alice, collection, "lend", {
            token_id: w.id,
            borrower_id: guest.accountId,
            method,
            args: loanArgs,
            max_deposit: "0",
            expires_at_ms: String(Date.now() + 3600000),
          });
          assert.equal(
            await c.call(guest, collection, "execute", {
              ...action,
              args: loanArgs,
            }),
            true,
          );
          assert.equal(
            await c.call(guest, collection, "execute", {
              ...action,
              args: loanArgs,
            }),
            false,
            "duplicate collectible cannot be issued twice",
          );
        } else {
          await assert.rejects(() =>
            c.call(alice, collection, "lend", {
              token_id: w.id,
              borrower_id: guest.accountId,
              method,
              args,
              max_deposit: "0",
              expires_at_ms: String(Date.now() + 3600000),
            }),
          );
        }
        if (profile === "token-issuer")
          assert.equal(
            await c.view(target, "ft_balance_of", {
              account_id: guest.accountId,
            }),
            "25",
          );
        if (profile === "treasury-controller")
          assert(BigInt(await c.view(target, "treasury_available")) > 0n);
        const nft = await c.view(collection, "nft_token", { token_id: w.id });
        const media = Buffer.from(nft.metadata.media.split(",")[1], "base64");
        assert.equal(
          nft.metadata.media_hash,
          createHash("sha256").update(media).digest("base64"),
        );
        assert(media.toString().includes(template.roleTitle.split("\n")[0]));
        await c.call(
          alice,
          collection,
          "nft_transfer",
          { token_id: w.id, receiver_id: bob.accountId },
          "1",
        );
        await assert.rejects(() => c.call(alice, target, method, args));
        await assert.rejects(() =>
          c.call(alice, collection, "execute", action),
        );
        const nextArgs =
          profile === "collection-admin"
            ? { ...args, token_id: "ben-publication" }
            : args;
        assert.equal(
          await c.call(bob, collection, "execute", {
            ...action,
            args: nextArgs,
          }),
          true,
        );
        assert.equal(
          (await c.view(collection, "get_writ", { token_id: w.id })).loans
            .length,
          0,
        );
        assert.equal(
          await c.call(bob, collection, "begin_unwrap", { token_id: w.id }),
          true,
        );
        await c.call(bob, target, "own_accept_owner", {}, "1");
        assert.equal(
          await c.call(bob, collection, "finish_unwrap", { token_id: w.id }),
          true,
        );
        assert.equal(await c.view(target, "own_get_owner"), bob.accountId);
        assert.equal(
          await c.view(collection, "nft_token", { token_id: w.id }),
          null,
        );
        await c.call(
          bob,
          target,
          method,
          profile === "collection-admin"
            ? { ...args, token_id: "direct-ben" }
            : args,
        );
      } finally {
        await c.close();
      }
    },
  );
}

test(
  "profile checks refuse an incompatible target, including conditional purchase",
  { timeout: 180000 },
  async () => {
    const c = await startChain();
    try {
      const alice = await c.account("alice");
      const bob = await c.account("bob");
      const target = await c.deploy("target", "owner-fixture", "new", {
        owner_id: alice.accountId,
      });
      const collection = await c.deploy("writ", "collection", "new", {});
      const w = await c.mint(alice, collection, target, "token-issuer");
      await c.call(
        alice,
        target,
        "own_propose_owner",
        { account_id: w.executor },
        "1",
      );
      await c.call(alice, collection, "wrap_step", { token_id: w.id, step: 1 });
      assert.equal(
        await c.call(alice, collection, "confirm_wrap", { token_id: w.id }),
        false,
      );
      const current = await c.view(collection, "get_writ", { token_id: w.id });
      assert.equal(current.roleConfirmed, false);
      await assert.rejects(() =>
        c.call(alice, collection, "list", {
          token_id: w.id,
          price: "100",
          expected_nonce: current.nonce,
        }),
      );
      const standard = await c.mint(alice, collection, target);
      // Bob cannot manufacture authority just by creating a controller for a target.
      const fake = await c.mint(bob, collection, target);
      assert.equal(
        await c.call(bob, collection, "confirm_wrap", { token_id: fake.id }),
        false,
      );
      assert.equal(
        await c.call(bob, collection, "execute", {
          token_id: fake.id,
          target_method: "set_price",
          args: { price: "999" },
          deposit: "0",
        }),
        false,
      );
      assert.notEqual(standard.executor, w.executor);
    } finally {
      await c.close();
    }
  },
);
