import { test, expect } from "@playwright/test";
import { SHOTS, login, waitForDashboard, toast } from "./helpers";

test.describe("Movimientos y alta manual", () => {
  test("filtros por tipo, categoría y texto", async ({ page }) => {
    await login(page);
    await waitForDashboard(page);
    await page.goto("/app/movimientos");
    await expect(page.getByTestId("movs-list").locator("li").first()).toBeVisible();
    const all = Number((await page.getByTestId("movs-count").innerText()).split(" ")[0]);
    expect(all).toBeGreaterThanOrEqual(40);

    await page.getByTestId("filter-tipo").selectOption("transfer_in");
    await expect(page).toHaveURL(/tipo=transfer_in/);
    const received = Number((await page.getByTestId("movs-count").innerText()).split(" ")[0]);
    expect(received).toBeGreaterThan(0);
    expect(received).toBeLessThan(all);
    await expect(page.getByTestId("movs-list")).toContainText("Recibido por Yape");

    await page.getByTestId("filter-tipo").selectOption("");
    await page.getByTestId("filter-categoria").selectOption("__pending__");
    const list = page.getByTestId("movs-list");
    await expect(list.locator("li").first()).toBeVisible();
    for (const sel of await list.locator("select").all()) await expect(sel).toHaveValue("");

    await page.getByTestId("filter-categoria").selectOption("");
    await page.getByTestId("filter-q").fill("plaza vea");
    await expect(list.locator("li").first()).toContainText("PLAZA VEA");
    await page.screenshot({ path: `${SHOTS}/04-movimientos.png`, fullPage: true });
  });

  test("recategorizar inline desde la lista actualiza Comercios (aprendizaje por comercio)", async ({ page }) => {
    await login(page);
    await waitForDashboard(page);
    await page.goto("/app/movimientos?q=LA%20LUCHA");
    const rows = page.getByTestId("movs-list").locator("li");
    await expect(rows.first()).toBeVisible();
    const n = await rows.count();
    expect(n).toBeGreaterThanOrEqual(2); // el mismo comercio aparece en varios meses
    await rows.first().locator("select").selectOption("Comidas fuera");
    await expect(toast(page)).toContainText("Categoría guardada");
    await expect(rows.first().locator("select")).toHaveValue("Comidas fuera");
    // Aprendido en la pestaña Comercios del mock (misma lógica que la Sheet real).
    const learned = await page.evaluate(() => {
      const store = JSON.parse(localStorage.getItem("luca.mock.store")!);
      const sheet = Object.values(store.sheets).find((s: unknown) => (s as Record<string, string[][]>).Comercios) as Record<string, string[][]>;
      return sheet.Comercios.find((r) => r[0] === "la lucha sangucheria");
    });
    expect(learned).toBeTruthy();
    expect(learned![2]).toBe("Comidas fuera");
    expect(learned![3]).toBe("user");
  });

  test("marcar como transferencia: P2P → categoría Transferencias; consumo → internal_transfer", async ({ page }) => {
    await login(page);
    await waitForDashboard(page);
    await page.goto("/app/movimientos?q=Ana%20Luc");
    const p2p = page.getByTestId("movs-list").locator("li").first();
    await expect(p2p).toBeVisible();
    await p2p.getByRole("button", { name: "Marcar como transferencia" }).click();
    await expect(toast(page)).toContainText("Transferencias");
    await expect(p2p.locator("select")).toHaveValue("Transferencias");

    await page.goto("/app/movimientos?q=ZARA");
    const card = page.getByTestId("movs-list").locator("li").first();
    await expect(card).toBeVisible();
    await card.getByRole("button", { name: "Marcar como transferencia" }).click();
    await expect(toast(page)).toContainText("entre cuentas");
    await expect(card).toContainText("Entre cuentas");
    await expect(card.getByRole("button", { name: "Marcar como transferencia" })).toHaveCount(0);
  });

  test("agregar movimiento manual aparece en la lista con fuente manual e id manual:", async ({ page }) => {
    await login(page);
    await waitForDashboard(page);
    await page.getByRole("link", { name: "Agregar", exact: true }).click();
    await expect(page.getByTestId("manual-form")).toBeVisible();
    // Validación antes de escribir nada.
    await page.getByRole("button", { name: "Agregar", exact: true }).click();
    await expect(page.getByRole("alert").first()).toContainText("monto");

    await page.getByLabel("Monto").fill("12,50");
    await page.getByLabel("Comercio", { exact: true }).fill("Chifa Lung Fung");
    await page.getByLabel("Categoría").selectOption("Comidas fuera");
    await page.getByLabel("Nota (opcional)").fill("cena e2e");
    await page.screenshot({ path: `${SHOTS}/05-agregar.png`, fullPage: true });
    await page.getByRole("button", { name: "Agregar", exact: true }).click();
    await expect(toast(page)).toContainText("Movimiento agregado");
    await expect(page).toHaveURL(/fuente=manual/);
    const row = page.getByTestId("movs-list").locator("li", { hasText: "Chifa Lung Fung" });
    await expect(row).toBeVisible();
    await expect(row).toContainText("S/ 12.50");
    await row.getByRole("button", { name: "Ver detalle" }).click();
    await expect(row).toContainText(/manual:[0-9a-f-]{36}/);
    await expect(row).toContainText("cena e2e");
  });
});
