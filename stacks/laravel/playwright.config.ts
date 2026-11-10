import { defineConfig, devices } from "@playwright/test";

// Playwright for Laravel. The server starts automatically (php artisan serve); tests ALWAYS hit localhost.
// Vite assets must be built (verify.mjs runs `npm run build` before e2e),
// or run `npm run dev` yourself when testing manually.
// One-time install: npm i -D @playwright/test  then  npx playwright install chromium
const PORT = Number(process.env.E2E_PORT ?? 8000);
const baseURL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false, // one shared local database: run serially so data doesn't collide
  workers: 1,
  forbidOnly: true,
  retries: 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    command: `php artisan serve --host=127.0.0.1 --port=${PORT}`,
    url: baseURL,
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
