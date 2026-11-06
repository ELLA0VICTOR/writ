import { readFile, mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
const root = new URL("../", import.meta.url);
const entry = JSON.parse(
  await readFile(new URL("docs/vendor-provenance.json", root), "utf8"),
).sputnikdao2;
const file = new URL("artifacts/vendor/sputnikdao2.wasm", root);
let bytes;
try {
  bytes = await readFile(file);
} catch (e) {
  if (e.code !== "ENOENT") throw e;
  const r = await fetch(entry.source);
  if (!r.ok) throw new Error(`Vendor download HTTP ${r.status}`);
  bytes = Buffer.from(await r.arrayBuffer());
}
if (
  bytes.length !== entry.size ||
  createHash("sha256").update(bytes).digest("hex") !== entry.sha256
)
  throw new Error("Sputnik artifact does not match pinned provenance.");
await mkdir(new URL("artifacts/vendor/", root), { recursive: true });
await writeFile(file, bytes);
console.log("Verified the pinned, unmodified Sputnik DAO Wasm.");
