import { test } from "node:test";
import assert from "node:assert/strict";
import { startChain } from "../harness.mjs";

test(
  "lending, conditional sales, segregated refunds, funding and verified retirement",
  { timeout: 240000 },
  async () => {
    const c = await startChain();
    try {
      const alice = await c.account("alice"),
        bob = await c.account("bob"),
        borrower = await c.account("borrower");
      const col = await c.deploy("writ", "collection", "new", {});
      const target = await c.deploy("target", "owner-fixture", "new", {
        owner_id: alice.accountId,
      });
      let w = await c.mint(alice, col, target);
      const refresh = async () =>
        (w = await c.view(col, "get_writ", { token_id: w.id }));
      await c.call(
        alice,
        target,
        "own_propose_owner",
        { account_id: w.executor },
        "1",
      );
      await c.call(alice, col, "wrap_step", { token_id: w.id, step: 1 });
      const action = {
        token_id: w.id,
        target_method: "set_price",
        args: { price: "21" },
        deposit: "0",
      };
      const block = await c.provider.sendJsonRpc("block", {
        finality: "final",
      });
      const expiry = String(
        Number(BigInt(block.header.timestamp_nanosec) / 1000000n) + 3600000,
      );
      const loan = await c.call(alice, col, "lend", {
        token_id: w.id,
        borrower_id: borrower.accountId,
        method: "set_price",
        args: { price: "21" },
        max_deposit: "0",
        expires_at_ms: expiry,
      });
      assert.equal(await c.call(borrower, col, "execute", action), true);
      await assert.rejects(() =>
        c.call(borrower, col, "execute", { ...action, args: { price: "22" } }),
      );
      await assert.rejects(() =>
        c.call(borrower, col, "execute", {
          ...action,
          target_method: "own_propose_owner",
          args: { account_id: borrower.accountId },
        }),
      );
      await assert.rejects(() =>
        c.call(borrower, col, "execute", { ...action, deposit: "1" }),
      );
      await c.call(alice, col, "end_loan", { token_id: w.id, loan_id: loan });
      await assert.rejects(() => c.call(borrower, col, "execute", action));
      const finalLoan = await c.call(alice, col, "lend", {
        token_id: w.id,
        borrower_id: borrower.accountId,
        method: "set_price",
        args: { price: "21" },
        max_deposit: "0",
        expires_at_ms: expiry,
      });
      await c.call(
        alice,
        col,
        "fund_executor",
        { token_id: w.id },
        c.nearToYocto("1").toString(),
      );
      const available = await c.view(w.executor, "get_balance");
      assert(BigInt(available) > BigInt(c.nearToYocto("1")));
      await c.call(alice, col, "withdraw_fees", {
        token_id: w.id,
        amount: c.nearToYocto("0.2").toString(),
      });
      await refresh();
      const price = c.nearToYocto("2").toString();
      await c.call(alice, col, "list", {
        token_id: w.id,
        price,
        expected_nonce: w.nonce,
      });
      await refresh();
      await assert.rejects(() => c.call(alice, col, "execute", action));
      await assert.rejects(() =>
        c.call(
          alice,
          col,
          "nft_transfer",
          { token_id: w.id, receiver_id: bob.accountId },
          "1",
        ),
      );
      const config = await c.view(col, "get_frontend_config");
      const amount = (
        BigInt(price) + BigInt(config.purchase_storage_deposit)
      ).toString();
      const buy = {
        token_id: w.id,
        expected_nonce: w.nonce,
        expected_template_hash: w.templateHash,
        maximum_price: price,
        pins: [
          { id: "minimum_balance", value: c.nearToYocto("99").toString() },
        ],
        client_attempt_id: crypto.randomUUID(),
      };
      assert.equal(await c.call(bob, col, "buy", buy, amount), false);
      const lookup = {
        token_id: w.id,
        buyer_id: bob.accountId,
        client_attempt_id: buy.client_attempt_id,
      };
      let p = await c.view(col, "get_purchase", lookup);
      assert.equal(p.status, "refused");
      assert.equal(p.refundStatus, "claimable");
      assert(
        p.checks.some((x) => x.id === "minimum_balance" && x.result === "fail"),
      );
      assert.equal(
        await c.view(col, "get_credit", { account_id: bob.accountId }),
        "0",
      );
      await assert.rejects(() => c.call(alice, col, "claim_refund", lookup));
      assert.equal(await c.call(bob, col, "claim_refund", lookup), true);
      assert.equal(
        (await c.view(col, "get_purchase", lookup)).refundStatus,
        "paid",
      );
      await assert.rejects(() => c.call(bob, col, "claim_refund", lookup));
      await assert.rejects(() => c.call(bob, col, "buy", buy, amount));
      // The next attempt is a distinct payment, not a retry of the refused one.
      const success = {
        ...buy,
        pins: [],
        client_attempt_id: crypto.randomUUID(),
      };
      assert.equal(await c.call(bob, col, "buy", success, amount), true);
      p = await c.view(col, "get_purchase", {
        ...lookup,
        client_attempt_id: success.client_attempt_id,
      });
      assert.equal(p.status, "settled");
      assert.equal(p.sellerPayment, "credited");
      assert.deepEqual(p.endedLoanIds, [finalLoan]);
      assert.equal(
        await c.view(col, "get_credit", { account_id: alice.accountId }),
        price,
      );
      await c.call(alice, col, "withdraw_credit", { amount: price });
      assert.equal(
        await c.view(col, "get_credit", { account_id: alice.accountId }),
        "0",
      );
      await assert.rejects(() =>
        c.call(alice, col, "withdraw_credit", { amount: price }),
      );
      await assert.rejects(() => c.call(alice, col, "execute", action));
      await assert.rejects(() => c.call(borrower, col, "execute", action));
      await assert.rejects(() =>
        c.call(alice, col, "on_checks", { key: "forged" }),
      );
      await assert.rejects(() =>
        c.call(alice, col, "on_credit", { operation_id: 1 }),
      );
      assert.equal(await c.call(bob, col, "execute", action), true);
      // A receiver with no nft_on_transfer method must resolve back to Bob.
      assert.equal(
        await c.call(
          bob,
          col,
          "nft_transfer_call",
          {
            token_id: w.id,
            receiver_id: borrower.accountId,
            msg: "",
            memo: null,
            approval_id: null,
          },
          "1",
        ),
        false,
      );
      await refresh();
      assert.equal(w.owner, bob.accountId);
      assert.equal(w.pendingCalls, 0);
      assert.equal(
        await c.call(bob, col, "begin_unwrap", { token_id: w.id }),
        true,
      );
      assert.equal(
        await c.call(bob, col, "finish_unwrap", { token_id: w.id }),
        false,
      );
      await assert.rejects(() =>
        c.call(
          bob,
          col,
          "nft_transfer",
          { token_id: w.id, receiver_id: alice.accountId },
          "1",
        ),
      );
      await c.call(bob, target, "own_accept_owner", {}, "1");
      assert.equal(
        await c.call(bob, col, "finish_unwrap", { token_id: w.id }),
        true,
      );
      assert.equal(await c.view(col, "nft_token", { token_id: w.id }), null);
      assert.equal(await c.view(target, "own_get_owner"), bob.accountId);
      const retired = await c.view(col, "get_retired_writs", {
        owner_id: bob.accountId,
      });
      assert.equal(retired.length, 1);
      await assert.rejects(() =>
        c.call(alice, col, "withdraw_retired_funds", {
          token_id: w.id,
          amount: "1",
        }),
      );
      const remaining = await c.view(w.executor, "get_balance");
      assert.equal(
        await c.call(bob, col, "withdraw_retired_funds", {
          token_id: w.id,
          amount: remaining,
        }),
        true,
      );
      console.log(
        "Confirmed: scoped lending/revocation; sale pause; refusal/refund without double claims; seller credit; transfer-call rollback; verified retirement and residual-fund recovery.",
      );
    } finally {
      await c.close();
    }
  },
);

test(
  "a pending successor owner refuses a sale without paying the seller",
  { timeout: 120000 },
  async () => {
    const c = await startChain();
    try {
      const a = await c.account("alice"),
        b = await c.account("bob");
      const col = await c.deploy("writ", "collection", "new", {}),
        target = await c.deploy("target", "owner-fixture", "new", {
          owner_id: a.accountId,
        });
      let w = await c.mint(a, col, target);
      await c.call(
        a,
        target,
        "own_propose_owner",
        { account_id: w.executor },
        "1",
      );
      await c.call(a, col, "wrap_step", { token_id: w.id, step: 1 });
      await c.call(a, col, "execute", {
        token_id: w.id,
        target_method: "own_propose_owner",
        args: { account_id: a.accountId },
        deposit: "0",
      });
      w = await c.view(col, "get_writ", { token_id: w.id });
      const price = c.nearToYocto("1").toString();
      await c.call(a, col, "list", {
        token_id: w.id,
        price,
        expected_nonce: w.nonce,
      });
      w = await c.view(col, "get_writ", { token_id: w.id });
      const config = await c.view(col, "get_frontend_config");
      const attempt = crypto.randomUUID();
      assert.equal(
        await c.call(
          b,
          col,
          "buy",
          {
            token_id: w.id,
            expected_nonce: w.nonce,
            expected_template_hash: w.templateHash,
            maximum_price: price,
            pins: [],
            client_attempt_id: attempt,
          },
          (BigInt(price) + BigInt(config.purchase_storage_deposit)).toString(),
        ),
        false,
      );
      const p = await c.view(col, "get_purchase", {
        token_id: w.id,
        buyer_id: b.accountId,
        client_attempt_id: attempt,
      });
      assert.equal(p.status, "refused");
      assert(p.checks.some((x) => x.id === "proposed" && x.result === "fail"));
      assert.equal(
        await c.view(col, "get_credit", { account_id: a.accountId }),
        "0",
      );
    } finally {
      await c.close();
    }
  },
);
