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
  // Asistente Conectar iPhone (pensado para abrirse en el teléfono): pasos 1 a 3 sin desbordes.
  await page.goto("/app/conexiones/iphone?paso=3");
  await expect(page.getByTestId("iphone-wizard")).toHaveAttribute("data-step", "3");
  await expect(page.getByTestId("copy-token-value")).toContainText("…");
  expect(await overflow()).toBeLessThanOrEqual(0);
  await page.screenshot({ path: `${SHOTS}/18-mobile-iphone-paso3.png`, fullPage: true });
  await page.goto("/app/conexiones/iphone?paso=2");
  await expect(page.getByTestId("wiz-qr").locator("svg")).toBeVisible();
  expect(await overflow()).toBeLessThanOrEqual(0);
});

// Aviso de instalar (ADR-011): solo en teléfonos y cuando el navegador ofrece instalarla; la X lo oculta para siempre.
test("aviso de instalar la app en el Resumen", async ({ page }, info) => {
  test.skip(info.project.name !== "mobile", "el aviso es solo para pantallas táctiles");
  await login(page);
  await waitForDashboard(page);
  await expect(page.getByTestId("install-notice")).toHaveCount(0); // sin diálogo del navegador ni iPhone
  await page.evaluate(() => dispatchEvent(Object.assign(new Event("beforeinstallprompt", { cancelable: true }), {
    prompt: async () => {}, userChoice: Promise.resolve({ outcome: "dismissed" }),
  })));
  const notice = page.getByTestId("install-notice");
  await expect(notice).toContainText("Lleva Luca en tu celular");
  await expect(notice.getByRole("button", { name: "Instalar" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
  await notice.getByRole("button", { name: "Ocultar este aviso" }).click();
  await expect(notice).toHaveCount(0);
  await page.reload();
  await waitForDashboard(page);
  await expect(page.getByTestId("install-notice")).toHaveCount(0);
});
