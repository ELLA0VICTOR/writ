import { readFile, writeFile } from "node:fs/promises";
import { gzipSync } from "node:zlib";
const manifest = JSON.parse(
  await readFile(
    new URL("../dist/.vite/manifest.json", import.meta.url),
    "utf8",
  ),
);
const entry = Object.keys(manifest).find((key) => manifest[key].isEntry);
const initial = new Set();
function visit(key) {
  if (initial.has(key)) return;
  initial.add(key);
  for (const dependency of manifest[key]?.imports ?? []) visit(dependency);
}
visit(entry);
const landingFiles = new Set(
  [...initial]
    .map((key) => manifest[key]?.file)
    .filter((file) => file?.endsWith(".js")),
);
const appFiles = new Set(
  Object.values(manifest)
    .map((chunk) => chunk.file)
    .filter((file) => file.endsWith(".js")),
);
async function size(files) {
  let total = 0;
  for (const file of files)
    total += gzipSync(
      await readFile(new URL(`../dist/${file}`, import.meta.url)),
    ).length;
  return total;
}
const landing = await size(landingFiles);
const app = await size(appFiles);
const result = {
  landing: {
    gzipBytes: landing,
    budgetBytes: 120000,
    files: [...landingFiles],
  },
  app: {
    gzipBytes: app,
    budgetBytes: 250000,
    measurement:
      "Conservative sum of every emitted production JS chunk, including wallet, RPC and embedded SVG fonts.",
  },
};
console.log(JSON.stringify(result, null, 2));
await writeFile(
  new URL("../dist/bundle-report.json", import.meta.url),
  JSON.stringify(result, null, 2),
);
if (landing > 120000 || app > 250000)
  throw new Error("JavaScript budget exceeded.");
