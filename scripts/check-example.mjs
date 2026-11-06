import { chromium } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import assert from "node:assert/strict";
import { mkdir, writeFile, unlink, readFile } from "node:fs/promises";
const origin = process.env.WRIT_EXAMPLE_ORIGIN || "http://127.0.0.1:5174";
const deployment = JSON.parse(
  await readFile("deployments/testnet.json", "utf8"),
);
await mkdir(".local/external-browser", { recursive: true });
const browser = await chromium.launch();
try {
  const context = await browser.newContext();
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(origin);
  await page
    .getByLabel("Writ token ID")
    .fill(deployment.profiles["collection-admin"].id);
  await page.getByRole("button", { name: "Inspect authority and NFT" }).click();
  await page
    .getByRole("status")
    .filter({ hasText: "Artwork hash verified" })
    .waitFor({ timeout: 60000 });
  assert(
    await page
      .locator("#art")
      .evaluate((img) => img.complete && img.naturalWidth === 1000),
  );
  assert(
    await page
      .getByRole("button", { name: "Approve command in wallet" })
      .isDisabled(),
    "Disconnected viewer must not get an enabled signing control.",
  );
  const violations = (await new AxeBuilder({ page }).analyze()).violations;
  assert.equal(
    violations.length,
    0,
    JSON.stringify(violations.map((v) => v.id)),
  );
  assert.deepEqual(errors, []);
  const probe = `.local/writ-example-access-probe-${process.pid}.txt`;
  await writeFile(probe, "Public security probe. No credentials.");
  try {
    const path = process.cwd().replaceAll("\\", "/") + "/" + probe;
    assert.equal(
      (await context.request.get(`${origin}/@fs/${path}`)).status(),
      403,
    );
  } finally {
    await unlink(probe);
  }
  await page.screenshot({
    path: ".local/external-browser/read.png",
    fullPage: true,
  });
  const report = {
    at: new Date().toISOString(),
    origin,
    collection: deployment.collection,
    tokenId: deployment.profiles["collection-admin"].id,
    independentApplication: true,
    liveRpc: true,
    artworkHashVerified: true,
    disconnectedSigningDisabled: true,
    localCredentialPathDenied: true,
    axeViolations: 0,
    errors,
    walletSignatures: false,
  };
  await writeFile(
    ".local/external-browser/report.json",
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report));
} finally {
  await browser.close();
}
