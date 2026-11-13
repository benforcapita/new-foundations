import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.NF_E2E_WEB_PORT ?? 4174);
const apiPort = Number(process.env.NF_E2E_API_PORT ?? 3002);
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
    command: `PORT=${apiPort} pnpm --filter @nf/api exec tsx src/index.ts`,
    url: `http://127.0.0.1:${apiPort}/healthz`,
    reuseExistingServer: false,
    timeout: 120_000,
  }, {
    command: `NF_TEST_API_PORT=${apiPort} pnpm preview --host 127.0.0.1 --port ${port}`,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 120_000,
  }],
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
