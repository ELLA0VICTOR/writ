import { chromium } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
const browser = await chromium.launch();
try {
  const context = await browser.newContext();
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
    await page.goto("http://127.0.0.1:5173/");
    await page
      .getByRole("button", { name: "Connect wallet", exact: true })
      .click();
    await page
      .getByRole("heading", { name: "Choose your wallet." })
      .waitFor({ timeout: 30000 });
    const violations = (await new AxeBuilder({ page }).analyze()).violations;
    console.log(
      JSON.stringify({
        width,
        violations: violations.map((v) => v.id),
        choices: await page
          .getByRole("dialog")
          .getByRole("button")
          .allTextContents(),
        errors,
      }),
    );
    if (violations.length || errors.length)
      throw new Error("Wallet picker verification failed.");
    await page.screenshot({
      path: `docs/screenshots/wallet-selector-${width}.png`,
    });
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
  }
} finally {
  await browser.close();
}
