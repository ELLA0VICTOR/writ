import { copyFile, mkdir } from "node:fs/promises";
await mkdir(new URL("../public/docs", import.meta.url), { recursive: true });
for (const name of [
  "THREAT_MODEL.md",
  "AI_USE.md",
  "BRIEF_RESOLUTIONS.md",
  "contract-integration.md",
  "NFT_MEDIA.md",
  "contract-verification.json",
  "vendor-provenance.json",
])
  await copyFile(
    new URL(`../docs/${name}`, import.meta.url),
    new URL(`../public/docs/${name}`, import.meta.url),
  );
try {
  await copyFile(
    new URL("../deployments/testnet.json", import.meta.url),
    new URL("../public/docs/testnet-deployment.json", import.meta.url),
  );
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}
await copyFile(
  new URL("../README.md", import.meta.url),
  new URL("../public/docs/README.md", import.meta.url),
);
for (const font of ["public-sans", "courier-prime"]) {
  await mkdir(new URL(`../public/fonts/licenses/${font}`, import.meta.url), {
    recursive: true,
  });
  await copyFile(
    new URL(`../node_modules/@fontsource/${font}/LICENSE`, import.meta.url),
    new URL(`../public/fonts/licenses/${font}/LICENSE`, import.meta.url),
  );
}
