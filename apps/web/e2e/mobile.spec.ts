import { test, expect } from "@playwright/test";
import { SHOTS, login, waitForDashboard } from "./helpers";

// Proyecto "mobile" (360 px): sin scroll horizontal y navegación usable.
test("dashboard y movimientos a 360 px sin desbordes", async ({ page }) => {
  await login(page);
  await waitForDashboard(page);
  const overflow = async () => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(await overflow()).toBeLessThanOrEqual(0);
  await page.screenshot({ path: `${SHOTS}/12-mobile-dashboard.png`, fullPage: true });
  await page.getByRole("link", { name: "Movimientos" }).click();
  await expect(page.getByTestId("movs-list").locator("li").first()).toBeVisible();
  expect(await overflow()).toBeLessThanOrEqual(0);
  await page.getByRole("link", { name: "Agregar", exact: true }).click();
  await expect(page.getByTestId("manual-form")).toBeVisible();
  expect(await overflow()).toBeLessThanOrEqual(0);
  await page.screenshot({ path: `${SHOTS}/13-mobile-agregar.png`, fullPage: true });
});
