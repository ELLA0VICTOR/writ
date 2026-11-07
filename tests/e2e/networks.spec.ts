import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { readFileSync } from "node:fs";
const release = JSON.parse(
  readFileSync(
    new URL("../../src/content/deployment.json", import.meta.url),
    "utf8",
  ),
);

for (const width of [390, 1440])
  test(`network settings work without a deployment at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    await page.getByRole("button", { name: "Network & deployment" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Network", { exact: true }).selectOption("mainnet");
    await expect(dialog.getByLabel("Writ collection account")).toHaveValue("");
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await dialog
      .getByRole("button", { name: "View mainnet without a deployment" })
      .click();
    await expect(
      page.getByRole("complementary", { name: "Network", exact: true }),
    ).toContainText("NEAR mainnet. Real funds.");
    await expect(
      page.getByText("No Writ deployment connected.", { exact: false }),
    ).toBeVisible();
    await page.reload();
    await expect(
      page.getByRole("complementary", { name: "Network", exact: true }),
    ).toContainText("NEAR mainnet.");
    await page.goto("/");
    await expect(
      page.getByRole("link", {
        name: "Inspect NFT collection administrator example",
      }),
    ).toHaveCount(0);
    await expect(
      page.getByText("NEAR mainnet. Transactions use real NEAR.", {
        exact: false,
      }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Network & deployment" }).click();
    await page
      .getByRole("button", { name: "Restore default testnet demo" })
      .click();
    await expect(
      page.getByRole("complementary", { name: "Network", exact: true }),
    ).toContainText("NEAR testnet prototype.");
  });

test("mainnet deployment verification rejects foreign code, accepts the reviewed release and keeps the selection after reload", async ({
  page,
}) => {
  let wrongCode = true;
  const methods: string[] = [];
  await page.route("https://free.rpc.fastnear.com/**", async (route) => {
    const data = route.request().postDataJSON();
    methods.push(data.method);
    let result: unknown;
    if (data.method === "status") result = { chain_id: "mainnet" };
    else if (data.params.request_type === "view_account")
      result = {
        code_hash: wrongCode ? "foreign" : release.collectionCodeHash,
        block_hash: "final-block",
        block_height: 42,
      };
    else {
      const value =
        data.params.method_name === "get_frontend_config"
          ? {
              abi_version: release.abiVersion,
              executor_code_hash: release.executorCodeHash,
              template_hashes: release.templateHashes,
              purchase_storage_deposit: "50000000000000000000000",
            }
          : { items: [] };
      result = { result: [...new TextEncoder().encode(JSON.stringify(value))] };
    }
    await route.fulfill({ json: { jsonrpc: "2.0", id: data.id, result } });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Network & deployment" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Network", { exact: true }).selectOption("mainnet");
  await dialog.getByLabel("Writ collection account").fill("writ.team.near");
  await dialog.getByRole("button", { name: "Verify deployment" }).click();
  await expect(dialog.getByRole("alert")).toContainText("code changed");
  await expect(
    dialog.getByRole("button", { name: "Use verified deployment" }),
  ).toHaveCount(0);
  wrongCode = false;
  await dialog.getByRole("button", { name: "Verify deployment" }).click();
  await expect(dialog.getByRole("status")).toContainText(
    "Verified NEAR mainnet",
  );
  await dialog.getByRole("button", { name: "Use verified deployment" }).click();
  await expect(
    page.getByRole("complementary", { name: "Network", exact: true }),
  ).toContainText("NEAR mainnet.");
  await expect(dialog).not.toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Network & deployment" }).click();
  await expect(page.getByLabel("Writ collection account")).toHaveValue(
    "writ.team.near",
  );
  expect(
    methods.every((method) => method === "status" || method === "query"),
  ).toBe(true);
});

test("importing a foreign manifest cannot replace the trusted hashes", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Network & deployment" }).click();
  await page
    .getByLabel("Import public deployment JSON")
    .setInputFiles({
      name: "public.json",
      mimeType: "application/json",
      buffer: Buffer.from(
        JSON.stringify({
          ...release,
          network: "mainnet",
          collection: "writ.team.near",
          collectionCodeHash: "foreign",
        }),
      ),
    });
  await expect(page.getByRole("alert")).toContainText("different Writ release");
  await expect(
    page.getByRole("button", { name: "Use verified deployment" }),
  ).toHaveCount(0);
});
