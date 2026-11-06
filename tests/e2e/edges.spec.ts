import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
async function prepare(
  page: import("@playwright/test").Page,
  scenario: string,
) {
  await page.goto("/writ/7?mock=1");
  await page.getByLabel("Example viewer").selectOption("ben.testnet");
  await page.getByText("Example purchase controls", { exact: true }).click();
  await page.getByLabel("Purchase scenario").selectOption(scenario);
  await page.getByRole("button", { name: "Buy with conditions" }).click();
}
for (const width of [390, 1440]) {
  test(`purchase dialogs are accessible at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
    await prepare(page, "proposed");
    await expect(
      page.getByRole("button", { name: "Pay 40 NEAR and check" }),
    ).toBeEnabled();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.screenshot({
      path: `docs/screenshots/buy-pins-${width}.png`,
      fullPage: true,
    });
    await page.getByRole("button", { name: "Pay 40 NEAR and check" }).click();
    await expect(
      page.getByRole("heading", {
        name: "Your 40 NEAR refund is ready to withdraw.",
      }),
    ).toBeVisible();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.screenshot({
      path: `docs/screenshots/buy-refused-${width}.png`,
      fullPage: true,
    });
  });
  test(`settled receipt at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
    await prepare(page, "clean");
    await page.getByRole("button", { name: "Pay 40 NEAR and check" }).click();
    await expect(
      page.getByRole("heading", { name: "Writ 0007 is yours." }),
    ).toBeVisible();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.screenshot({
      path: `docs/screenshots/buy-settled-${width}.png`,
      fullPage: true,
    });
  });
}
test("wallet rejection retains entered conditions", async ({ page }) => {
  await prepare(page, "rejected");
  await page
    .getByRole("checkbox", { name: "Minimum executor balance" })
    .check();
  await page
    .getByRole("textbox", { name: "Minimum executor balance" })
    .fill("2.75");
  await page.getByRole("button", { name: "Pay 40 NEAR and check" }).click();
  await expect(
    page.getByText(
      "You declined the example wallet request. Your conditions have been kept.",
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("textbox", { name: "Minimum executor balance" }),
  ).toHaveValue("2.75");
});
test("changed version blocks payment until the record is reviewed", async ({
  page,
}) => {
  await prepare(page, "changed");
  await page.getByRole("button", { name: "Pay 40 NEAR and check" }).click();
  await expect(
    page.getByRole("button", { name: "Review the new state" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Pay 40 NEAR and check" }),
  ).toBeDisabled();
});
test("insufficient funds stops the signature request", async ({ page }) => {
  await prepare(page, "insufficient");
  await expect(
    page.getByText(
      "Your available balance does not cover this purchase and the fee buffer. No signing request will be sent.",
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Pay 40 NEAR and check" }),
  ).toBeDisabled();
});
test("stuck purchase is released before a refund is offered", async ({
  page,
}) => {
  await prepare(page, "stuck");
  await page.getByRole("button", { name: "Pay 40 NEAR and check" }).click();
  await expect(
    page.getByRole("heading", { name: "The callback passed its deadline." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Release this purchase" }).click();
  await expect(
    page.getByRole("button", { name: "Withdraw refund" }),
  ).toBeVisible();
  await expect(
    page.getByText("The purchase was released. The Writ did not change hands."),
  ).toBeVisible();
});
test("unknown outcome never offers a second payment", async ({ page }) => {
  await prepare(page, "unknown");
  await page.getByRole("button", { name: "Pay 40 NEAR and check" }).click();
  await expect(
    page.getByRole("button", { name: "Check this purchase again" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Pay 40 NEAR and check" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page.getByRole("button", { name: "Buy with conditions" }).click();
  await expect(
    page.getByRole("button", { name: "Check this purchase again" }),
  ).toBeVisible();
});
for (const route of ["/", "/app", "/market", "/writ/7", "/wrap"])
  test(`unconfigured testnet route ${route} stays honest`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    await page.goto(route);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    if (route === "/market" || route === "/writ/7")
      await expect(
        page.getByText("The contracts are being connected."),
      ).toBeVisible();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    expect(errors).toEqual([]);
  });
