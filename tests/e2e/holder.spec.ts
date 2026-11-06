import { test, expect } from "@playwright/test";
test("holder lends exact arguments, lists, unlists and ends the loan", async ({
  page,
}) => {
  await page.goto("/writ/12?mock=1");
  await page.getByLabel("Example viewer").selectOption("ada.testnet");
  await page
    .getByRole("button", { name: "Lend a method", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Borrower account").fill("sam.testnet");
  await dialog.getByLabel("Expiry in UTC").fill("2099-01-01T12:00");
  await dialog
    .getByRole("button", { name: "Lend a method", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole("button", { name: "End loan" })).toBeVisible();
  await page
    .getByRole("button", { name: "List for sale", exact: true })
    .click();
  await page.getByLabel("Asking price in NEAR").fill("18.75");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "List for sale", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Use the role" }),
  ).toBeDisabled();
  await expect(page.getByRole("button", { name: "End loan" })).toBeDisabled();
  await page.getByRole("button", { name: "Take off sale" }).click();
  await page.getByRole("button", { name: "End loan" }).click();
  await expect(page.getByText("No active loans.")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Unwrap", exact: true }),
  ).toBeEnabled();
});
test("only current borrower gets the scoped action UI", async ({ page }) => {
  await page.goto("/writ/21?mock=1");
  await page.getByLabel("Example viewer").selectOption("sam.testnet");
  await page.getByRole("button", { name: "Use your loaned method" }).click();
  await expect(page.getByLabel("Exact JSON arguments")).toHaveValue(
    '{\n  "price": "1"\n}',
  );
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Use the role", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Your holder actions" }),
  ).toHaveCount(0);
});

test("a direct transfer moves holder actions without opening a sale", async ({
  page,
}) => {
  await page.goto("/writ/12?mock=1");
  await page.getByLabel("Example viewer").selectOption("ada.testnet");
  await page
    .getByRole("button", { name: "Transfer the Writ", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Receiving account").fill("ben.testnet");
  await dialog.getByRole("checkbox").check();
  await dialog
    .getByRole("button", { name: "Transfer the Writ", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Your holder actions" }),
  ).toHaveCount(0);
  await page.getByLabel("Example viewer").selectOption("ben.testnet");
  await expect(
    page.getByRole("heading", { name: "Your holder actions" }),
  ).toBeVisible();
  await expect(page.getByText("No active loans.")).toBeVisible();
});

test("internal account recipient is rejected without losing NFT ownership", async ({
  page,
}) => {
  await page.goto("/writ/12?mock=1");
  await page.getByLabel("Example viewer").selectOption("ada.testnet");
  await page
    .getByRole("button", { name: "Transfer the Writ", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Receiving account").fill("w12.writ-demo.testnet");
  await dialog.getByRole("checkbox").check();
  await dialog
    .getByRole("button", { name: "Transfer the Writ", exact: true })
    .click();
  await expect(dialog.getByRole("alert")).toContainText(
    "Writ infrastructure cannot receive",
  );
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Your holder actions" }),
  ).toBeVisible();
});
