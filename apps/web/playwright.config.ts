import { defineConfig, devices } from "@playwright/test";

/**
 * E2E: drives the real UI against a local stack (anvil + deployed contracts + Envio + bots) through
 * a scripted E2E wallet (wagmi's test connector). The web server must run with NEXT_PUBLIC_E2E_KEY set (scripts/e2e.sh does this);
 * in CI the stack comes from docker-compose and `E2E_BASE_URL` points at it.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 10 * 60_000,
  expect: { timeout: 20_000 },
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : [["list"]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    viewport: { width: 1440, height: 900 },
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } },
    },
  ],
});
