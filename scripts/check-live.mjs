import { readFile, writeFile, mkdir } from "node:fs/promises";
import { chromium } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import assert from "node:assert/strict";
const origin = process.env.WRIT_PREVIEW_ORIGIN || "http://127.0.0.1:4173";
const deployment = JSON.parse(
  await readFile("deployments/testnet.json", "utf8"),
);
const browser = await chromium.launch();
const report = {
  at: new Date().toISOString(),
  collection: deployment.collection,
  routes: [],
  errors: [],
};
await mkdir(".local/live-browser", { recursive: true });
try {
  const context = await browser.newContext({ reducedMotion: "reduce" });
  const page = await context.newPage();
  page.on("pageerror", (e) => report.errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") report.errors.push(m.text());
  });
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
    for (const route of [
      "/",
      "/market",
      `/writ/${deployment.writs.clean}`,
      `/writ/${deployment.writs.proposed}`,
      `/writ/${deployment.writs.dao}`,
      "/wrap",
    ]) {
      const response = await page.goto(origin + route);
      assert.equal(response.status(), 200);
      await page.getByRole("heading", { level: 1 }).waitFor();
      if (route.startsWith("/writ/")) {
        await page.getByRole("table").waitFor({ timeout: 60000 });
        await page
          .getByRole("button", { name: "Read again", exact: true })
          .waitFor();
      }
      if (route === "/market")
        await page.getByText("Inspect Writ 0001").waitFor({ timeout: 60000 });
      assert(
        !(
          await page.locator('.errorText,[role="alert"]').allTextContents()
        ).some((t) => t.trim()),
        `Live error on ${route}`,
      );
      const violations = (await new AxeBuilder({ page }).analyze()).violations;
      assert.equal(
        violations.length,
        0,
        JSON.stringify(
          violations.map((v) => ({
            id: v.id,
            nodes: v.nodes.map((n) => n.target),
          })),
        ),
      );
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth + 1,
      );
      assert.equal(overflow, false, `Overflow on ${route} at ${width}`);
      report.routes.push({
        route,
        width,
        status: 200,
        axeViolations: violations.length,
        overflow,
      });
    }
    await page.goto(`${origin}/writ/${deployment.writs.clean}`);
    await page.getByRole("table").waitFor({ timeout: 60000 });
    await page.screenshot({
      path: `.local/live-browser/clean-${width}.png`,
      fullPage: true,
    });
  }
  await page.goto(`${origin}/writ/${deployment.writs.proposed}`);
  await page.getByRole("table").waitFor({ timeout: 60000 });
  assert(
    (await page.getByRole("table").innerText()).includes("Fail"),
    "The pending successor must fail its live condition.",
  );
  await page
    .getByRole("button", { name: "Connect wallet", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "Choose your wallet." })
    .waitFor({ timeout: 30000 });
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  assert.equal(report.errors.length, 0, report.errors.join("\n"));
  const manifest=JSON.parse(await readFile('dist/.vite/manifest.json','utf8'));
  const states=await page.evaluate(async({file,purchases})=>{const {createTestnetAdapter}=await import('/'+file);const adapter=createTestnetAdapter();return Promise.all([adapter.getPurchase(purchases.clean),adapter.getPurchase(purchases.proposed)]);},{file:manifest['src/chain/testnetAdapter.ts'].file,purchases:deployment.purchases});
  assert.equal(states[0].status,'settled');assert.equal(states[0].sellerPayment,'credited');assert.equal(states[1].status,'refused');assert.equal(states[1].refundStatus,'paid');
  report.purchaseReadback={clean:states[0].status,refused:states[1].status,refund:states[1].refundStatus};
  await writeFile(
    ".local/live-browser/report.json",
    JSON.stringify(report, null, 2),
  );
  console.log(
    `Live production browser passed ${report.routes.length} route/viewport checks; real RPC data and wallet manifest, no wallet signatures.`,
  );
} finally {
  await browser.close();
}
