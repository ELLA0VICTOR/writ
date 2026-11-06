import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
const routes = ["/", "/app", "/market", "/writ/7", "/wrap", "/__gallery"];
for (const viewport of [
  { width: 1440, height: 900 },
  { width: 390, height: 844 },
])
  for (const route of routes)
    test(`${route} is accessible at ${viewport.width}px`, async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("console", (message) => {
        if (message.type() === "error") errors.push(message.text());
      });
      await page.setViewportSize(viewport);
      await page.goto(`${route}?mock=1`);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      if (route === "/market")
        await expect(
          page.getByRole("link", { name: /Inspect Writ 0007/ }),
        ).toBeVisible();
      if (route === "/writ/7")
        await expect(page.getByRole("table")).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
      expect(errors).toEqual([]);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true);
      const name =
        route === "/"
          ? "landing"
          : route.replaceAll("/", "-").replace(/^-/, "");
      await page.screenshot({
        path: `docs/screenshots/${name}-${viewport.width}.png`,
        fullPage: true,
        animations: "disabled",
      });
    });
