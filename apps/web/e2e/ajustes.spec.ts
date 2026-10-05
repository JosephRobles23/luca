import { test, expect } from "@playwright/test";
import { SHOTS, login, useScenario, waitForDashboard, toast } from "./helpers";

test.describe("Ajustes, Conexiones y páginas legales", () => {
  test("ajustes guardan en la Sheet (tipo de cambio) y la importación escribe import.since/status", async ({ page }) => {
    await login(page);
    await waitForDashboard(page);
    await page.getByRole("link", { name: "Ajustes" }).click();
    const fx = page.getByTestId("a-fx");
    await expect(fx).toHaveValue("3.55");
    await fx.fill("3.80");
    await page.getByTestId("ajustes-form").getByRole("button", { name: "Guardar" }).click();
    await expect(toast(page)).toContainText("Ajustes guardados");
    await page.reload();
    await expect(page.getByTestId("a-fx")).toHaveValue("3.80");

    // El nuevo tipo de cambio se usa para mostrar los USD sin tipo_cambio propio.
    await page.goto("/app/movimientos?q=UDEMY");
    await expect(page.getByTestId("movs-list").locator("li").first()).toContainText("TC 3.8 (Ajustes)");

    await page.goto("/app/ajustes");
    await expect(page.getByText("API key:")).toContainText("falta");
    await page.getByTestId("a-since").fill("2026-01-01");
    await page.getByTestId("import-form").getByRole("button", { name: "Importar desde esa fecha" }).click();
    await expect(toast(page)).toContainText("Importación pedida");
    await expect(page.getByTestId("import-form")).toContainText("Importación en curso");
    await expect(page.getByTestId("import-form").getByRole("button", { name: "Ya hay una importación en curso" })).toBeDisabled();
    await page.screenshot({ path: `${SHOTS}/09-ajustes.png`, fullPage: true });

    const written = await page.evaluate(() => {
      const store = JSON.parse(localStorage.getItem("luca.mock.store")!);
      const rows: string[][] = store.sheets["sheet-mock-1"].Ajustes;
      return Object.fromEntries(rows.map((r) => [r[0], r[1]]));
    });
    expect(written["fx.usd_pen"]).toBe("3.80");
    expect(written["import.since"]).toBe("2026-01-01");
    expect(written["import.status"]).toBe("running");

    await expect(page.getByTestId("sheet-card").getByRole("link", { name: /Abrir mi Sheet/ })).toHaveAttribute("href", /docs\.google\.com\/spreadsheets\/d\/sheet-mock-1/);
    await page.getByRole("button", { name: "Cerrar sesión" }).click();
    await expect(page).toHaveURL(/\/$/);
  });

  test("conexiones muestra iPhone e IA conectados con telemetría; sin conexiones muestra la guía", async ({ page }) => {
    await login(page);
    await waitForDashboard(page);
    await page.getByRole("link", { name: "Conexiones" }).click();
    await expect(page.getByTestId("card-webapp")).toContainText("publicada");
    await expect(page.getByTestId("card-iphone")).toContainText("conectado");
    await expect(page.getByTestId("card-iphone")).toContainText("Eventos");
    await expect(page.getByTestId("card-iphone")).toContainText("37");
    await expect(page.getByTestId("card-mcp")).toContainText("Claude");
    await expect(page.getByTestId("card-mcp")).toContainText("58");
    await expect(page.getByTestId("card-mcp")).toContainText("https://mcp.lucaa.lat");
    await page.screenshot({ path: `${SHOTS}/10-conexiones.png`, fullPage: true });

    await useScenario(page, "authorized");
    await page.goto("/app/conexiones");
    await expect(page.getByTestId("card-webapp")).toContainText("sin publicar");
    await expect(page.getByTestId("card-webapp")).toContainText("Nueva implementación");
    await expect(page.getByTestId("card-iphone")).toContainText("no configurado");
    await expect(page.getByTestId("card-mcp")).toContainText("no configurada");
    await expect(page.getByTestId("card-iphone").getByTestId("iphone-configurar")).toHaveAttribute("href", "/app/conexiones/iphone");
  });

  test("páginas legales en español, persona natural, gratuito y arquitectura literal", async ({ page }) => {
    await page.goto("/privacidad");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Política de privacidad");
    await expect(page.locator("article")).toContainText("persona natural");
    await expect(page.locator("article")).toContainText("Luca no tiene base de datos");
    await expect(page.locator("article")).toContainText("Nunca pasan por infraestructura de Luca");
    await expect(page.locator("article")).toContainText("gavynenita@gmail.com");
    await page.screenshot({ path: `${SHOTS}/11-privacidad.png`, fullPage: true });

    await page.getByRole("link", { name: "Términos de uso" }).click();
    await expect(page).toHaveURL(/\/terminos$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Términos de uso");
    await expect(page.locator("article")).toContainText("gratuita, sin anuncios y sin fines comerciales");
    await page.getByRole("link", { name: "Inicio" }).click();
    await expect(page).toHaveURL(/\/$/);
  });
});
