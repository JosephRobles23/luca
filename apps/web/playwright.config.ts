import { defineConfig, devices } from "@playwright/test";

/**
 * E2E en modo mock: arranca `next dev` con LUCA_MOCK=1 (sesión falsa + Google en memoria).
 * `npm run e2e` · `npm run e2e:ui` · capturas en e2e/screenshots/.
 */
const PORT = Number(process.env.E2E_PORT ?? 3100);

export default defineConfig({
  testDir: "./e2e",
  testMatch: /.*\.spec\.ts/,
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : [["list"]],
  outputDir: "./test-results",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    colorScheme: "dark",
    // Sin animaciones: las cifras que cuentan (useCountUp) y las entradas quedan en su estado final al instante.
    reducedMotion: "reduce",
    locale: "es-PE",
    timezoneId: "America/Lima",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 860 } } },
    { name: "mobile", use: { ...devices["Pixel 7"], viewport: { width: 360, height: 760 }, deviceScaleFactor: 1 }, testMatch: /mobile\.spec\.ts/ },
  ],
  webServer: {
    command: `npx next dev -p ${PORT}`,
    url: `http://localhost:${PORT}/privacidad`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      LUCA_MOCK: "1",
      AUTH_SECRET: "e2e-secret-not-used-in-mock",
      AUTH_GOOGLE_ID: "mock",
      AUTH_GOOGLE_SECRET: "mock",
      NEXT_PUBLIC_LUCA_LIB_VERSION: process.env.NEXT_PUBLIC_LUCA_LIB_VERSION ?? "5",
      NEXT_PUBLIC_TEMPLATE_SHEET_ID: "tpl-luca",
    },
  },
});
