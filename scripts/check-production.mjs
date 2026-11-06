import { readFile, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { chromium } from "@playwright/test";
const origin = "http://127.0.0.1:4173";
const manifest = JSON.parse(await readFile("dist/.vite/manifest.json", "utf8"));
assert(
  !Object.keys(manifest).some((key) => key.includes("/Gallery/")),
  "Development gallery was included in production.",
);
const browser = await chromium.launch();
const errors = [];
const report = {
  date: "2026-11-06",
  routes: [],
  publicDocuments: [],
  rpc: null,
  errors,
};
try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  for (const route of ["/", "/app", "/market", "/writ/7", "/wrap"]) {
    const response = await page.goto(`${origin}${route}?mock=1`);
    assert.equal(response.status(), 200);
    await page.getByRole("heading", { level: 1 }).waitFor();
    if (route === "/writ/7") await page.getByRole("table").waitFor();
    report.routes.push({ route, status: response.status() });
  }
  await page.goto(`${origin}/writ/7?mock=1`);
  await page.getByLabel("Example viewer").selectOption("ben.testnet");
  await page.getByRole("button", { name: "Buy with conditions" }).click();
  await page.getByRole("button", { name: "Pay 40 NEAR and check" }).click();
  await page.getByRole("heading", { name: "Writ 0007 is yours." }).waitFor();
  await page.goto(origin);
  await page
    .getByRole("button", { name: "Connect wallet", exact: true })
    .click();
  await page.getByRole("heading", { name: "Choose your wallet." }).waitFor();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  const apiFile = manifest["node_modules/near-api-js/lib/index.js"].file;
  report.rpc = await page.evaluate(async (file) => {
    const { JsonRpcProvider } = await import("/" + file);
    const provider = new JsonRpcProvider({
      url: "https://test.rpc.fastnear.com",
    });
    const status = await provider.sendJsonRpc("status", []);
    return { chainId: status.chain_id };
  }, apiFile);
  assert.equal(report.rpc.chainId, "testnet");
  for (const path of [
    "/docs/README.md",
    "/docs/THREAT_MODEL.md",
    "/docs/AI_USE.md",
    "/docs/INTEGRATION_GUIDE.md",
    "/docs/wallet-verification.json",
    "/docs/published-build-verification.json",
    "/sdk/writ.js",
    "/fonts/licenses/public-sans/LICENSE",
    "/fonts/licenses/courier-prime/LICENSE",
  ]) {
    const response = await context.request.get(origin + path);
    assert.equal(response.status(), 200);
    assert(!(await response.text()).includes("<!doctype html>"));
    report.publicDocuments.push({ path, status: 200 });
  }
  assert.deepEqual(errors, []);
  report.productionPurchase = "settled in mock mode";
  report.walletPicker = "real manifest loaded; cancelled without signing";
  report.developmentGallery = "excluded";
  await writeFile(
    "docs/production-verification.json",
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser.close();
}
