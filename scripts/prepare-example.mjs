import { mkdir, copyFile } from "node:fs/promises";
const folder = new URL("../examples/external-app/public/", import.meta.url);
await mkdir(folder, { recursive: true });
await copyFile(
  new URL("../deployments/testnet.json", import.meta.url),
  new URL("deployment.json", folder),
);
console.log(
  "Copied public testnet deployment configuration. No keys or credentials are included.",
);
