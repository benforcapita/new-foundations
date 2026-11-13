import { defineConfig, devices } from "@playwright/test";

const port = 4173;
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: process.env.CI !== undefined,
  retries: 0,
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  webServer: [{
    command: "pnpm --filter @nf/api exec tsx src/index.ts",
    url: "http://127.0.0.1:3001/healthz",
    reuseExistingServer: process.env.CI === undefined,
    timeout: 120_000,
  }, {
    command: `pnpm preview --host 127.0.0.1 --port ${port}`,
    url: baseURL,
    reuseExistingServer: process.env.CI === undefined,
    timeout: 120_000,
  }],
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
