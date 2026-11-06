import { test, expect } from "@playwright/test";
for (const name of [
  "NFT collection administrator",
  "Token issuance controller",
  "Treasury controller",
]) {
  test(`wrap ${name} and display its own capabilities`, async ({ page }) => {
    await page.goto("/wrap?mock=1");
    await page.getByLabel("Example viewer").selectOption("ada.testnet");
    await page.getByRole("radio", { name: new RegExp(name) }).check();
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await page.getByLabel("Contract account").fill("compatible.testnet");
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
    await page.getByRole("link", { name: "Open your Writ" }).click();
    await expect(
      page.getByRole("heading", { name: "What this NFT controls." }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", {
        name: "Fund external application",
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "List for sale", exact: true }),
    ).toBeEnabled();
    if (name !== "NFT collection administrator")
      await expect(
        page.getByRole("button", { name: "Lend a method", exact: true }),
      ).toHaveCount(0);
  });
}
test("DAO example needs an explicit simulated governance grant before confirmation", async ({
  page,
}) => {
  await page.goto("/wrap?mock=1");
  await page.getByLabel("Example viewer").selectOption("ada.testnet");
  await page.getByRole("radio", { name: /DAO council seat/ }).check();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByLabel("Contract account").fill("council.testnet");
  await page.getByRole("button", { name: "Read current holder" }).click();
  await page.getByRole("button", { name: "Continue to mint" }).click();
  await page
    .getByRole("button", { name: "Mint your Writ", exact: true })
    .click();
  await page.getByRole("button", { name: "Continue to handover" }).click();
  await expect(
    page.getByText(/DAO must approve adding the executor/),
  ).toBeVisible();
  await page
    .getByRole("button", {
      name: "Simulate DAO approval (example)",
      exact: true,
    })
    .click();
  await page.getByRole("button", { name: "Check the handover" }).click();
  await page.getByRole("button", { name: "Run the checks" }).click();
  await expect(
    page.getByRole("heading", { name: "The declared checks pass." }),
  ).toBeVisible();
});
