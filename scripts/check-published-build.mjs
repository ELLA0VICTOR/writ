// Verify a clean static deployment using public source configuration, without .env.local.
import { build, preview } from "vite";
import { chromium } from "@playwright/test";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { resolve, sep } from "node:path";
import assert from "node:assert/strict";
const workspace = resolve(".");
const output = resolve(".local/public-build");
assert(
  output.startsWith(workspace + sep),
  "Build output must remain in the workspace.",
);
const envDir = resolve(".local/public-build-env");
await mkdir(envDir, { recursive: true });
await build({ envDir, build: { outDir: output, emptyOutDir: true } });
const server = await preview({
  envDir,
  build: { outDir: output },
  preview: { host: "127.0.0.1", port: 4176, strictPort: true },
});
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("http://127.0.0.1:4176/writ/4");
  await page
    .getByText("SHA-256 media hash verified", { exact: true })
    .waitFor({ timeout: 60000 });
  await page
    .getByRole("button", { name: "Download authority evidence", exact: true })
    .waitFor();
  assert.deepEqual(errors, []);
  const release = JSON.parse(
    await readFile("src/content/deployment.json", "utf8"),
  );
  const report = {
    at: new Date().toISOString(),
    collection: release.collection,
    environmentFilesLoaded: false,
    livePublicConfiguration: true,
    artworkHashVerified: true,
    errors,
    scope:
      "Fresh static build with an empty env directory; actual testnet reads and NFT media verification. No wallet keys or wallet signatures.",
  };
  await writeFile(
    "docs/published-build-verification.json",
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(JSON.stringify(report));
} finally {
  await browser.close();
  await new Promise((r) => server.httpServer.close(r));
}
