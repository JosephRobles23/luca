import { expect, type Locator, type Page } from "@playwright/test";

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

/**
 * Elige en un `Dropdown` (menú de la app con ratón, `<select>` nativo en táctil) la opción `value`, o la primera si
 * se omite. Devuelve el valor elegido; el control lo expone en `data-value`.
 */
export async function pick(page: Page, control: Locator, value?: string): Promise<string> {
  if ((await control.evaluate((el) => el.tagName)) === "SELECT") {
    const v = value ?? (await control.locator("option:not([value=''])").first().getAttribute("value"))!;
    await control.selectOption(v);
    return v;
  }
  await control.click();
  const list = page.getByRole("listbox");
  const opt = value === undefined ? list.getByRole("option").first() : list.locator(`[role=option][data-value="${value}"]`);
  const v = (await opt.getAttribute("data-value"))!;
  await opt.click();
  await expect(list).toBeHidden();
  return v;
}

/** La categoría elegida en una fila: chip marcado o, si no está entre los chips, en "+N más". */
export async function expectCategory(scope: Locator, categoria: string) {
  const chip = scope.getByRole("group", { name: /^Categoría de/ }).getByRole("button", { name: categoria, exact: true, pressed: true });
  await expect(chip.or(scope.locator(`[data-testid^="cat-"][data-value="${categoria}"]`))).toBeVisible();
}
