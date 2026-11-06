import { test, expect } from "@playwright/test";
test("purchase illustration in the dev gallery refuses a proposal and clears when changed", async ({
  page,
}) => {
  await page.goto("/__gallery?mock=1");
  await page.getByRole("button", { name: "Run Ben’s purchase" }).click();
  await expect(
    page.getByText("Sale refused. A next owner is still proposed."),
  ).toBeVisible();
  await page.getByRole("radio", { name: "Nothing", exact: false }).check();
  await expect(page.getByText("The receipt tells the story.")).toBeVisible();
  await page.getByRole("button", { name: "Run Ben’s purchase" }).click();
  await expect(
    page.getByText(
      "Sale settled. Ben holds the Writ. Ada has no holder permission.",
    ),
  ).toBeVisible();
});
test("public Writ needs no connected wallet", async ({ page }) => {
  await page.goto("/writ/7?mock=1");
  await expect(
    page.getByRole("heading", { name: "Owner of lanterns-nft." }),
  ).toBeVisible();
  await expect(page.getByRole("table")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Connect wallet", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText(
      "Access keys and the executor code hash are checked by this page, not by the sale.",
    ),
  ).toBeVisible();
});
test("purchase refuses and the example refund can be claimed", async ({
  page,
}) => {
  await page.goto("/writ/7?mock=1");
  await page.getByLabel("Example viewer").selectOption("ben.testnet");
  await page.getByText("Example purchase controls", { exact: true }).click();
  await page.getByLabel("Purchase scenario").selectOption("proposed");
  await page.getByRole("button", { name: "Buy with conditions" }).click();
  await page.getByRole("button", { name: "Pay 40 NEAR and check" }).click();
  await expect(
    page.getByRole("heading", {
      name: "Your 40 NEAR refund is ready to withdraw.",
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Withdraw refund" }).click();
  await expect(
    page.getByRole("heading", { name: "40 NEAR has been returned." }),
  ).toBeVisible();
  await expect(
    page.getByText("Example outcome. No NEAR was sent or returned."),
  ).toBeVisible();
});
test("purchase settles and switches the current holder", async ({ page }) => {
  await page.goto("/writ/7?mock=1");
  await page.getByLabel("Example viewer").selectOption("ben.testnet");
  await page.getByRole("button", { name: "Buy with conditions" }).click();
  await page.getByRole("button", { name: "Pay 40 NEAR and check" }).click();
  await expect(
    page.getByRole("heading", { name: "Writ 0007 is yours." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Open your Writ" }).click();
  await expect(
    page.getByRole("heading", { name: "Your holder actions" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "List for sale", exact: true }),
  ).toBeVisible();
});
test("keyboard focus is contained in a dialog and restored", async ({
  page,
}) => {
  await page.goto("/writ/7?mock=1");
  const open = page.getByRole("button", { name: "Buy with conditions" });
  await open.click();
  await expect(page.getByRole("dialog")).toBeVisible();
  for (let i = 0; i < 16; i++) {
    await page.keyboard.press("Tab");
    expect(
      await page.evaluate(() =>
        Boolean(document.activeElement?.closest("dialog")),
      ),
    ).toBe(true);
  }
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(open).toBeFocused();
});
test("wrap wizard mints, hands over and verifies the example role", async ({
  page,
}) => {
  await page.goto("/wrap?mock=1");
  await page.getByLabel("Example viewer").selectOption("ada.testnet");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByLabel("Contract account").fill("lanterns-nft.testnet");
  await page.getByRole("button", { name: "Read current holder" }).click();
  await page.getByRole("button", { name: "Continue to mint" }).click();
  await page
    .getByRole("button", { name: "Mint your Writ", exact: true })
    .click();
  await page.getByRole("button", { name: "Continue to handover" }).click();
  await page.getByRole("button", { name: "Propose executor" }).click();
  await page.getByRole("button", { name: "Accept from executor" }).click();
  await page.getByRole("button", { name: "Check the handover" }).click();
  await page.getByRole("button", { name: "Run the checks" }).click();
  await expect(
    page.getByRole("heading", { name: "The declared checks pass." }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Open your Writ" }),
  ).toBeVisible();
});
