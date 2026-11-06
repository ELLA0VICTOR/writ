import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    watch:{ignored:['**/.local/**','**/artifacts/**','**/integration/results/**']},
    fs: {
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
  build: { manifest: true },
});
