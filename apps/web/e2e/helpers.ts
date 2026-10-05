import { expect, type Page } from "@playwright/test";

export const SHOTS = "e2e/screenshots";

/** Fija el escenario del mock antes de cargar la app (lo lee `GoogleMockClient` desde localStorage). */
export async function useScenario(page: Page, scenario: "full" | "webapp" | "authorized" | "empty") {
  // Solo fija la clave: `GoogleMockClient` resiembra cuando el escenario guardado difiere. Idempotente ante
  // recargas (incluidas las que hace `next dev` al compilar una ruta por primera vez).
  await page.addInitScript((s) => {
    try { localStorage.setItem("luca.mock.scenario", s); } catch { /* sin storage */ }
  }, scenario);
}

/** Landing → Entrar (sesión mock por cookie) → /app cargada. */
export async function login(page: Page) {
  await page.goto("/");
  await page.getByTestId("cta-entrar").click();
  await expect(page).toHaveURL(/\/app$/);
  await expect(page.getByTestId("mock-banner")).toBeVisible();
}

export async function waitForDashboard(page: Page) {
  await expect(page.getByTestId("kpi-expense")).toBeVisible();
}

export const toast = (page: Page) => page.getByTestId("toast").last();

export const money = (s: string) => Number(s.replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", "."));
