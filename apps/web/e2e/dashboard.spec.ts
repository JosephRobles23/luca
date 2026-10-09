import { test, expect } from "@playwright/test";
import { SHOTS, login, waitForDashboard, money, toast, pick, expectCategory } from "./helpers";

test.describe("Landing → entrar → dashboard", () => {
  test("la landing presenta propuesta, pasos, privacidad y legales", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Tus gastos de BCP y Yape");
    await expect(page.getByRole("heading", { name: "Todo pasa dentro de tu cuenta de Google." })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Mira cómo funciona, de principio a fin." })).toBeVisible();
    await expect(page.getByRole("button", { name: /Reproducir: Luca en 2 minutos/ })).toBeVisible();
    await expect(page.getByRole("list", { name: "Capítulos del video" }).getByRole("link")).toHaveCount(5);
    await expect(page.getByRole("link", { name: "Política de privacidad" })).toHaveAttribute("href", "/privacidad");
    await expect(page.getByRole("link", { name: "Términos de uso" })).toHaveAttribute("href", "/terminos");
    await page.screenshot({ path: `${SHOTS}/01-landing.png`, fullPage: true });
  });

  test("entrar muestra el dashboard con KPIs coherentes", async ({ page }) => {
    await login(page);
    await waitForDashboard(page);
    const income = money(await page.getByTestId("kpi-income").getByTestId("kpi-value").innerText());
    const expense = money(await page.getByTestId("kpi-expense").getByTestId("kpi-value").innerText());
    const net = money(await page.getByTestId("kpi-net").getByTestId("kpi-value").innerText());
    const yape = money(await page.getByTestId("kpi-yape").getByTestId("kpi-value").innerText());
    expect(income).toBeGreaterThan(0);
    expect(expense).toBeGreaterThan(0);
    expect(Math.abs(income - expense - net)).toBeLessThan(0.02);
    expect(yape).toBeGreaterThan(0); // transfer_in aparte, no infla ingresos
    await expect(page.getByTestId("kpi-yape")).toContainText("no cuenta como ingreso");
    // Aviso de versión: la copia (v4) es anterior a la publicada (v5 en el webServer de Playwright).
    await expect(page.getByTestId("version-notice")).toContainText("disponible");
    await expect(page.getByTestId("dashboard-movements").locator("li").first()).toBeVisible();
    // Chips de filtro: "Por categorizar" deja solo pendientes y su contador coincide con las filas.
    const chip = page.getByRole("group", { name: "Filtrar movimientos" }).getByRole("button", { name: /^Por categorizar/ });
    const n = Number((await chip.innerText()).replace(/\D/g, ""));
    await chip.click();
    await expect(chip).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByTestId("dashboard-movements").locator("li")).toHaveCount(Math.min(n, 30));
    await expect(page.getByTestId("dashboard-movements")).not.toContainText("Recibido por Yape");
    await page.screenshot({ path: `${SHOTS}/02-dashboard.png`, fullPage: true });
  });

  test("el selector de mes cambia los KPIs y las barras son clicables", async ({ page }) => {
    await login(page);
    await waitForDashboard(page);
    const before = await page.getByTestId("kpi-expense").getByTestId("kpi-value").innerText();
    const select = page.getByTestId("month-select");
    await select.click();
    const opts = page.getByRole("listbox", { name: "Elegir mes" }).getByRole("option");
    await expect(opts.first()).toBeVisible();
    const options = await opts.allInnerTexts();
    const values = await opts.evaluateAll((els) => els.map((el) => el.getAttribute("data-value")!));
    expect(options.length).toBeGreaterThanOrEqual(3);
    await opts.nth(1).click();
    await expect(page.getByTestId("kpi-expense").getByTestId("kpi-value")).not.toHaveText(before);
    // El título de la lista usa el nombre largo en minúsculas ("Movimientos de septiembre").
    await expect(page.locator("h2", { hasText: /^Movimientos de / })).toContainText(options[1].split(" ")[0].toLowerCase());
    // ‹ › y las flechas del teclado recorren los meses; las barras de 6 meses también eligen mes.
    await page.getByRole("button", { name: /^Mes siguiente/ }).click();
    await expect(select).toHaveAttribute("data-value", values[0]);
    await select.focus();
    await page.keyboard.press("ArrowLeft");
    await expect(page.getByTestId("kpi-expense").getByTestId("kpi-value")).not.toHaveText(before);
    await page.keyboard.press("ArrowRight");
    await expect(page.getByTestId("kpi-expense").getByTestId("kpi-value")).toHaveText(before);
    const bars = page.getByRole("button", { name: /^Ver .+: S\/ / });
    await expect(bars).toHaveCount(6);
    // La ventana de 6 meses termina en el mes elegido: tras el clic, ese mes pasa a ser la última barra.
    const picked = (await bars.nth(4).getAttribute("aria-label"))!.replace(/:.*/, "");
    await bars.nth(4).click();
    await expect(bars.last()).toHaveAttribute("aria-pressed", "true");
    await expect(bars.last()).toHaveAttribute("aria-label", new RegExp(`^${picked}:`));
    await expect(page.getByTestId("kpi-expense").getByTestId("kpi-value")).not.toHaveText(before);
  });

  test("recategorizar desde 'Por categorizar' se refleja en el dashboard y en Movimientos", async ({ page }) => {
    await login(page);
    await waitForDashboard(page);
    const pending = page.getByTestId("pending-card");
    await expect(pending).toBeVisible();
    const countBefore = Number((await pending.locator("h2").innerText()).replace(/\D/g, ""));
    const firstMore = pending.locator('[data-testid^="cat-"]').first();
    const testId = await firstMore.getAttribute("data-testid");
    const txId = testId!.replace(/^cat-/, "");
    const chosen = await pick(page, firstMore);
    await expect(toast(page)).toContainText(`Categoría guardada: ${chosen}`);
    await expect(pending.locator("h2")).toContainText(String(countBefore - 1));
    // La fila guardada se queda un momento en el Resumen (confirmación + colapso): esperar a estar en Movimientos.
    await page.getByRole("link", { name: "Movimientos" }).click();
    await expect(page).toHaveURL(/\/app\/movimientos/);
    // En Movimientos la categoría vive en el detalle desplegable de la fila.
    await page.getByTestId(`mov-${txId}`).getByRole("button", { name: "Ver detalle" }).click();
    await expectCategory(page.getByTestId(`mov-${txId}`), chosen);
    // Y sobrevive a una recarga completa (el mock persiste en localStorage igual que la Sheet real).
    await page.reload();
    await page.getByTestId(`mov-${txId}`).getByRole("button", { name: "Ver detalle" }).click();
    await expectCategory(page.getByTestId(`mov-${txId}`), chosen);
    await expect(page.getByTestId(`mov-${txId}`)).toContainText("origen: user");
  });

  test("tema claro/oscuro y cierre de sesión", async ({ page }) => {
    await login(page);
    await waitForDashboard(page);
    await page.getByTestId("theme-toggle").click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    await page.screenshot({ path: `${SHOTS}/03-dashboard-light.png`, fullPage: true });
    await page.getByTestId("theme-toggle").click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await page.getByRole("button", { name: "Salir" }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByTestId("cta-entrar")).toBeVisible();
    // Sin sesión, /app redirige a la landing.
    await page.goto("/app");
    await expect(page).toHaveURL(/\/$/);
  });
});
