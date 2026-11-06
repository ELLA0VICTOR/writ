import { test } from "node:test";
import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { startChain } from "../harness.mjs";

test(
  "maximum retained Unicode history plus eight large loans stays funded and can settle",
  { timeout: 300000 },
  async () => {
    const c = await startChain();
    try {
      const alice = await c.account("a".repeat(55)),
        bob = await c.account("b".repeat(55));
      const collection = await c.deploy("writ", "collection", "new", {}),
        target = await c.deploy("target", "owner-fixture", "new", {
          owner_id: alice.accountId,
        });
      const before = (
        await c.provider.viewAccount({ accountId: collection.accountId })
      ).storage_usage;
      const quote = await c.view(collection, "get_mint_quote", {
        template_id: "contract-owner",
        target: target.accountId,
      });
      const w = await c.mint(alice, collection, target);
      await c.call(
        alice,
        target,
        "own_propose_owner",
        { account_id: w.executor },
        "1",
      );
      await c.call(alice, collection, "wrap_step", { token_id: w.id, step: 1 });
      const memo = "\u{1F680}".repeat(160);
      for (let i = 0; i < 64; i++)
        await c.call(
          i % 2 === 0 ? alice : bob,
          collection,
          "nft_transfer",
          {
            token_id: w.id,
            receiver_id: i % 2 === 0 ? bob.accountId : alice.accountId,
            memo,
          },
          "1",
        );
      const block = await c.provider.viewBlock({ finality: "final" });
      const expiry = String(
        Number(BigInt(block.header.timestamp_nanosec) / 1000000n) + 86400000,
      );
      const args = { price: "1", padding: "x".repeat(4065) };
      assert(Buffer.byteLength(JSON.stringify(args)) <= 4096);
      for (let i = 0; i < 8; i++)
        await c.call(alice, collection, "lend", {
          token_id: w.id,
          borrower_id: bob.accountId,
          method: "set_price",
          args,
          max_deposit: "0",
          expires_at_ms: expiry,
        });
      await assert.rejects(
        () =>
          c.call(alice, collection, "lend", {
            token_id: w.id,
            borrower_id: bob.accountId,
            method: "set_price",
            args,
            max_deposit: "0",
            expires_at_ms: expiry,
          }),
        /Loan limit/,
      );
      const atCapacity = (
        await c.provider.viewAccount({ accountId: collection.accountId })
      ).storage_usage;
      const allocated = BigInt(quote.storageDeposit) / 10000000000000000000n;
      assert(
        BigInt(atCapacity - before) <= allocated,
        "Mint storage allocation must cover the exercised capacity",
      );
      let state = await c.view(collection, "get_writ", { token_id: w.id });
      const price = c.nearToYocto("1").toString();
      await c.call(alice, collection, "list", {
        token_id: w.id,
        price,
        expected_nonce: state.nonce,
      });
      state = await c.view(collection, "get_writ", { token_id: w.id });
      const config = await c.view(collection, "get_frontend_config");
      const beforePurchase = (
        await c.provider.viewAccount({ accountId: collection.accountId })
      ).storage_usage;
      const common = {
        token_id: w.id,
        expected_nonce: state.nonce,
        expected_template_hash: state.templateHash,
        maximum_price: price,
      };
      const attached = (
        BigInt(price) + BigInt(config.purchase_storage_deposit)
      ).toString();
      assert.equal(
        await c.call(
          bob,
          collection,
          "buy",
          {
            ...common,
            pins: [
              { id: "minimum_balance", value: c.nearToYocto("99").toString() },
            ],
            client_attempt_id: crypto.randomUUID(),
          },
          attached,
        ),
        false,
      );
      const afterRefusal = (
        await c.provider.viewAccount({ accountId: collection.accountId })
      ).storage_usage;
      assert(
        BigInt(Math.max(0, afterRefusal - beforePurchase)) *
          10000000000000000000n <=
          BigInt(config.purchase_storage_deposit),
      );
      const attempt = crypto.randomUUID();
      assert.equal(
        await c.call(
          bob,
          collection,
          "buy",
          { ...common, pins: [], client_attempt_id: attempt },
          attached,
        ),
        true,
      );
      const purchase = await c.view(collection, "get_purchase", {
        token_id: w.id,
        buyer_id: bob.accountId,
        client_attempt_id: attempt,
      });
      assert.equal(purchase.endedLoanIds.length, 8);
      state = await c.view(collection, "get_writ", { token_id: w.id });
      assert.equal(state.owner, bob.accountId);
      assert.deepEqual(state.loans, []);
      assert.equal(state.pendingCalls, 0);
      const report = {
        generatedAt: new Date().toISOString(),
        collectionTemplateHash: state.templateHash,
        collectionCodeHash: (
          await c.provider.viewAccount({ accountId: collection.accountId })
        ).code_hash,
        historyEntries: 64,
        utf8BytesPerTransferMemo: Buffer.byteLength(memo),
        accountIdBytes: alice.accountId.length,
        loanCount: 8,
        argumentBytesPerLoan: Buffer.byteLength(JSON.stringify(args)),
        allocatedTokenStorageBytes: allocated.toString(),
        observedCollectionStorageIncreaseBytes: atCapacity - before,
        observedRefusedPurchaseNetStorageIncreaseBytes:
          afterRefusal - beforePurchase,
        maximumCapacityPurchaseSettled: true,
        scope:
          "Actual sandbox capacity scenario, not an exhaustive mathematical bound on every possible state.",
      };
      await writeFile(
        new URL("../../docs/storage-verification.json", import.meta.url),
        JSON.stringify(report, null, 2) + "\n",
      );
      console.log(
        `Capacity: ${atCapacity - before} bytes funded by ${allocated} allocated bytes; sale settled at configured callback gas.`,
      );
    } finally {
      await c.close();
    }
  },
);
