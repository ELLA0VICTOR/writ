import { chromium } from "@playwright/test";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
await page.goto("http://127.0.0.1:5173/wrap?mock=1");
await page.waitForTimeout(300);
console.log(
  "Layout:",
  await page.evaluate(() => ({
    width: innerWidth,
    scroll: document.documentElement.scrollWidth,
    overflow: [...document.querySelectorAll("main *")]
      .filter((el) => el.getBoundingClientRect().right > innerWidth + 1)
      .slice(0, 8)
      .map((el) => ({
        tag: el.tagName,
        class: el.className,
        width: el.getBoundingClientRect().width,
      })),
  })),
);
await page.setViewportSize({ width: 1440, height: 900 });
await page.goto("http://127.0.0.1:5173/?mock=1");
await page.evaluate(() => document.fonts.ready);
await page.screenshot({ path: "docs/screenshots/landing-viewport-1440.png" });
const errors = [];
page.on("console", (msg) => {
  if (msg.type() === "error") errors.push(msg.text());
});
page.on("pageerror", (err) => errors.push(err.message));
const rpcResult = await page.evaluate(async () => {
  const { JsonRpcProvider } =
    await import("/node_modules/.vite/deps/near-api-js.js");
  const provider = new JsonRpcProvider({ url: "https://rpc.testnet.near.org" });
  try {
    const response = await provider.sendJsonRpc("status", []);
    return { ok: true, chainId: response.chain_id };
  } catch (error) {
    return { ok: false, message: error.message };
  }
});
console.log("Browser RPC:", rpcResult, "Console errors:", errors);
await browser.close();
