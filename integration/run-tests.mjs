import { spawn } from "node:child_process";
import { readFile, writeFile, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
const run = crypto.randomUUID();
const child = spawn(
  process.execPath,
  ["--test", "--test-concurrency=1", "tests/*.test.mjs"],
  {
    cwd: new URL("./", import.meta.url),
    env: { ...process.env, WRIT_EVIDENCE_RUN: run },
    stdio: "inherit",
  },
);
const code = await new Promise((resolve) => child.on("close", resolve));
if (code !== 0) process.exit(code || 1);
const folder = new URL(`./results/${run}/`, import.meta.url);
const records = [];
for (const filename of await readdir(folder))
  records.push(
    ...JSON.parse(await readFile(new URL(filename, folder), "utf8")),
  );
const methods = {};
for (const r of records) {
  const old = methods[r.method] ?? {
    calls: 0,
    maxGasBurnt: "0",
    maxReceiptCount: 0,
  };
  old.calls++;
  if (BigInt(r.gasBurnt) > BigInt(old.maxGasBurnt))
    old.maxGasBurnt = r.gasBurnt;
  old.maxReceiptCount = Math.max(old.maxReceiptCount, r.receiptCount);
  methods[r.method] = old;
}
const binaries = {};
for (const id of ["executor", "collection", "owner-fixture", "adversary"]) {
  const b = await readFile(new URL(`../artifacts/${id}.wasm`, import.meta.url));
  binaries[id] = {
    bytes: b.length,
    sha256: createHash("sha256").update(b).digest("hex"),
  };
}
await writeFile(
  new URL("../docs/contract-verification.json", import.meta.url),
  JSON.stringify(
    {
      network: "local sandbox",
      sandboxVersion: "2.14.0",
      generatedAt: new Date().toISOString(),
      testFiles: (await readdir(new URL("./tests/", import.meta.url))).filter(
        (n) => n.endsWith(".test.mjs"),
      ),
      binaries,
      methods,
      transactionsRecorded: records.length,
      scope:
        "Actual Wasm and receipt tests. Gas includes transaction plus all receipts, including refunds. These are local observations, not a mainnet audit or competitor benchmark.",
    },
    null,
    2,
  ) + "\n",
);
console.log(
  `Saved actual sandbox measurements for ${records.length} transactions to docs/contract-verification.json.`,
);
