import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 45000,
  expect: { timeout: 10000 },
  fullyParallel: true,
  workers: 2,
  use: {
    baseURL: "http://127.0.0.1:5181",
    trace: "retain-on-failure",
    reducedMotion: "reduce",
  },
  webServer: {
    command: "npm run dev -- --host 127.0.0.1 --port 5181 --strictPort",
    url: "http://127.0.0.1:5181",
    reuseExistingServer: false,
    env: { VITE_WRIT_CONTRACT: "" },
  },
  reporter: [["list"], ["html", { open: "never" }]],
});
