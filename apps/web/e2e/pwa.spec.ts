import { test, expect, type Page } from "@playwright/test";
import { login, toast, waitForDashboard } from "./helpers";

// App instalable y copia local de solo lectura (ADR-011). El service worker solo se registra en producción; aquí se
// prueba la copia en IndexedDB con el mock, que con `luca.mock.offline=1` falla como `fetch` sin red.

const snapshotSaved = (page: Page) => page.evaluate(() => new Promise<boolean>((resolve) => {
  const req = indexedDB.open("luca");
  req.onupgradeneeded = () => req.result.createObjectStore("snapshots", { keyPath: "email" });
  req.onsuccess = () => {
    const db = req.result;
    if (!db.objectStoreNames.contains("snapshots")) { db.close(); return resolve(false); }
    const get = db.transaction("snapshots").objectStore("snapshots").getAll();
    get.onsuccess = () => {
      const all = get.result as { data: { ajustes: Record<string, string>; txs: unknown[] } }[];
      db.close();
      resolve(all.length === 1 && all[0].data.txs.length > 0 && !("conexiones.iphone.token" in all[0].data.ajustes));
    };
  };
  req.onerror = () => resolve(false);
}));

test.describe("Copia local sin conexión", () => {
  test("sin red muestra la copia en solo lectura y vuelve sola al reconectar", async ({ page }) => {
    await login(page);
    await waitForDashboard(page);
    await expect.poll(() => snapshotSaved(page)).toBe(true); // sin el token del iPhone

    await page.evaluate(() => localStorage.setItem("luca.mock.offline", "1"));
    await page.reload();
    await expect(page.getByTestId("offline-notice")).toContainText("Sin conexión");
    await expect(page.getByTestId("kpi-expense")).toBeVisible();

    // Escribir está bloqueado: el chip no guarda nada.
    await page.goto("/app/movimientos?q=LA%20LUCHA");
    const row = page.getByTestId("movs-list").locator("li").first();
    await row.getByRole("button", { name: "Ver detalle" }).click();
    await row.getByRole("group", { name: /^Categoría de/ }).getByRole("button").first().click();
    await expect(toast(page)).toContainText("Sin conexión: no se puede guardar ahora");

    await page.evaluate(() => { localStorage.removeItem("luca.mock.offline"); dispatchEvent(new Event("online")); });
    await expect(page.getByTestId("offline-notice")).toHaveCount(0);
  });

  test("cerrar sesión borra la copia del dispositivo", async ({ page }) => {
    await login(page);
    await waitForDashboard(page);
    await expect.poll(() => snapshotSaved(page)).toBe(true);
    await page.getByRole("button", { name: "Salir" }).click();
    await expect(page).toHaveURL(/\/$/);
    expect(await snapshotSaved(page)).toBe(false);
  });
});

test.describe("Instalar la app (Ajustes)", () => {
  test("en un navegador de escritorio sin diálogo explica dónde instalarla; con el diálogo, ofrece el botón", async ({ page }) => {
    await login(page);
    await page.goto("/app/ajustes");
    const card = page.getByTestId("install-card");
    await expect(card).toHaveAttribute("data-mode", "unsupported");
    await expect(card.getByTestId("install-unsupported")).toBeVisible();
    // El navegador ofrece su diálogo (Chrome/Edge/Android): aparece "Instalar app" y lo abre.
    await page.evaluate(() => {
      const e = Object.assign(new Event("beforeinstallprompt", { cancelable: true }), {
        prompt: async () => { (window as unknown as { __prompted: boolean }).__prompted = true; },
        userChoice: Promise.resolve({ outcome: "dismissed" }),
      });
      dispatchEvent(e);
    });
    await card.getByTestId("install-button").click();
    expect(await page.evaluate(() => (window as unknown as { __prompted?: boolean }).__prompted)).toBe(true);
  });
});

test.describe("Instalar la app en iPhone", () => {
  test.use({ userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1" });
  test("muestra los pasos de Compartir → Añadir a pantalla de inicio", async ({ page }) => {
    await login(page);
    await page.goto("/app/ajustes");
    await expect(page.getByTestId("install-card")).toHaveAttribute("data-mode", "ios");
    await expect(page.getByTestId("install-ios-steps")).toContainText("Añadir a pantalla de inicio");
  });
});
