import { test, expect } from "@playwright/test";
import { SHOTS, login, waitForDashboard } from "./helpers";

test.describe("Resumen: gráficos interactivos", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await waitForDashboard(page);
  });

  test("banda de indicadores: variación al mismo día y minicurvas de 6 meses", async ({ page }) => {
    const band = page.getByTestId("kpi-band");
    await expect(band).toBeVisible();
    await expect(page.getByTestId("kpi-delta")).toContainText(/% vs |igual que/);
    for (const id of ["kpi-income", "kpi-net", "kpi-yape"]) {
      await expect(page.getByTestId(id).locator("svg path").first()).toBeAttached();
      await expect(page.getByTestId(id).getByRole("img", { name: /últimos 6 meses: S\/ / })).toBeVisible();
    }
  });

  test("ritmo del mes: acumulado + diario, leyenda que oculta series, datos de apoyo y tooltip compartido", async ({ page }) => {
    const card = page.getByTestId("pace-card");
    await expect(card.getByTestId("pace-cumulative").locator("svg path").first()).toBeAttached();
    await expect(card.getByTestId("pace-daily").locator("svg path").first()).toBeAttached();
    await expect(card.getByTestId("pace-facts")).toContainText("Promedio diario sin alquiler");
    await expect(card.getByTestId("pace-facts")).toContainText(/Proyección a fin de mes|Total del mes cerrado/);

    const series = card.getByRole("group", { name: "Series del acumulado" });
    const prev = series.getByRole("button", { name: "Mes anterior" });
    await expect(prev).toHaveAttribute("aria-pressed", "true");
    await prev.click();
    await expect(prev).toHaveAttribute("aria-pressed", "false");
    await prev.click();
    await expect(prev).toHaveAttribute("aria-pressed", "true");

    // Pasar el puntero por el acumulado abre el tooltip con el día y los valores.
    const cum = card.getByTestId("pace-cumulative");
    await cum.scrollIntoViewIfNeeded();
    const box = (await cum.boundingBox())!;
    await page.mouse.move(box.x + box.width * 0.12, box.y + box.height / 2, { steps: 5 });
    const tip = cum.locator("div", { hasText: "Este mes" }).filter({ hasText: "S/ " }).first();
    await expect(tip).toBeVisible();
    await expect(tip).toContainText(/^\d+ de /);
    await page.screenshot({ path: `${SHOTS}/19-resumen-graficos.png`, fullPage: true });
  });

  test("perfil de gasto: S/ ↔ % del mes y siempre queda una serie visible", async ({ page }) => {
    const card = page.getByTestId("radar-card");
    await expect(card.getByTestId("radar-chart").locator("svg path").first()).toBeAttached();
    await expect(card.getByTestId("radar-sub")).toContainText("Soles por categoría");
    await card.getByRole("button", { name: "% del mes" }).click();
    await expect(card.getByRole("button", { name: "% del mes" })).toHaveAttribute("aria-pressed", "true");
    await expect(card.getByTestId("radar-sub")).toContainText("Porcentaje del gasto");
    await expect(card.getByTestId("radar-chart")).toHaveAttribute("aria-label", / %/);

    const legend = card.getByRole("group", { name: "Series del radar" });
    await legend.getByRole("button", { name: "Mes anterior" }).click();
    await legend.getByRole("button", { name: "Promedio 3 meses" }).click();
    await legend.getByRole("button", { name: "Este mes" }).click(); // la última no se puede ocultar
    await expect(legend.getByRole("button", { name: "Este mes" })).toHaveAttribute("aria-pressed", "true");
    await expect(legend.getByRole("button", { name: "Mes anterior" })).toHaveAttribute("aria-pressed", "false");
  });

  test("en qué se fue: elegir una categoría filtra los movimientos del mes", async ({ page }) => {
    const card = page.getByTestId("category-card");
    await expect(card.getByTestId("category-donut").locator("svg path").first()).toBeAttached();
    const first = card.getByRole("list", { name: "Categorías del mes" }).getByRole("button").first();
    const name = (await first.locator("span.truncate").innerText()).trim();
    await first.click();
    await expect(first).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByTestId("movements-category")).toContainText(name);
    const rows = page.getByTestId("dashboard-movements").locator("li");
    await expect(rows.first()).toBeVisible();
    const n = await rows.count();
    for (let i = 0; i < n; i++) await expect(rows.nth(i)).toContainText(name === "Sin categoría" ? "Por categorizar" : name);
    await expect(card.getByRole("link", { name: "Ver en Movimientos" })).toHaveAttribute("href", /categoria=/);
    // El chip de la lista quita el filtro.
    await page.getByTestId("movements-category").click();
    await expect(page.getByTestId("movements-category")).toHaveCount(0);
    await expect(first).toHaveAttribute("aria-pressed", "false");
  });

  test("los gráficos se redibujan con los colores del tema", async ({ page }) => {
    const cum = page.getByTestId("pace-cumulative");
    await expect(cum.locator('path[stroke="#3987e5"]').first()).toBeAttached(); // azul del mes anterior en oscuro
    await page.getByTestId("theme-toggle").click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    await expect(cum.locator('path[stroke="#2a78d6"]').first()).toBeAttached(); // y en claro
    await page.screenshot({ path: `${SHOTS}/20-resumen-claro.png`, fullPage: true });
  });
});
