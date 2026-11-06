import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";
export default defineConfig({
  root: fileURLToPath(new URL("./", import.meta.url)),
  server: {
    host: "127.0.0.1",
    port: 5174,
    strictPort: true,
    watch:{ignored:['**/.local/**','**/artifacts/**','**/integration/results/**']},
    fs: {
      allow: [fileURLToPath(new URL("../../", import.meta.url))],
      deny: [
        ".env",
        ".env.*",
        "*.{crt,pem,key}",
        "**/.git/**",
        "**/.local/**",
        "**/.near-credentials/**",
        "**/credentials/**",
        "**/secrets/**",
      ],
    },
  },
  build: { outDir: "dist", emptyOutDir: true },
});
