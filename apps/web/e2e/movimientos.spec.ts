import { test, expect } from "@playwright/test";
import { SHOTS, login, waitForDashboard, toast, pick, expectCategory } from "./helpers";

test.describe("Movimientos y alta manual", () => {
  test("filtros por tipo, categoría y texto", async ({ page }) => {
    await login(page);
    await waitForDashboard(page);
    await page.goto("/app/movimientos");
    await expect(page.getByTestId("movs-list").locator("li").first()).toBeVisible();
    const all = Number((await page.getByTestId("movs-count").innerText()).split(" ")[0]);
    expect(all).toBeGreaterThanOrEqual(40);

    // Los chips de tipo muestran cuántos verías al elegirlos.
    const tipo = page.getByTestId("filter-tipo");
    await expect(tipo.getByRole("button", { name: /^Todos/ })).toHaveAttribute("aria-pressed", "true");
    await expect(tipo.getByRole("button", { name: /^Todos/ })).toContainText(String(all));
    await tipo.getByRole("button", { name: /^Recibido por Yape/ }).click();
    await expect(tipo.getByRole("button", { name: /^Recibido por Yape/ })).toHaveAttribute("aria-pressed", "true");
    await expect(page).toHaveURL(/tipo=transfer_in/);
    const received = Number((await page.getByTestId("movs-count").innerText()).split(" ")[0]);
    expect(received).toBeGreaterThan(0);
    expect(received).toBeLessThan(all);
    await expect(page.getByTestId("movs-list")).toContainText("Recibido por Yape");

    await tipo.getByRole("button", { name: /^Todos/ }).click();
    await expect(page).not.toHaveURL(/tipo=/);
    await page.getByRole("button", { name: "Más filtros" }).click();
    await pick(page, page.getByTestId("filter-categoria"), "__pending__");
    await expect(page).toHaveURL(/categoria=__pending__/);
    await expect(page.getByRole("list", { name: "Filtros activos" })).toContainText("Por categorizar");
    await tipo.getByRole("button", { name: /^Gastos/ }).click();
    const list = page.getByTestId("movs-list");
    await expect(list.locator("li").first()).toBeVisible();
    await expect(list.locator("li").first()).toContainText("Por categorizar");
    // El detalle de un pendiente abre la categorización con "+N más" sin elegir.
    await list.locator("li").first().getByRole("button", { name: "Ver detalle" }).click();
    const more = list.locator("li").first().locator('[data-testid^="cat-"]');
    await expect(more).toBeVisible();
    await expect(more).toHaveAttribute("data-value", "");
    await expect(more).toContainText(/^\+\d+ más/);

    await pick(page, page.getByTestId("filter-categoria"), "");
    await tipo.getByRole("button", { name: /^Todos/ }).click();
    await page.getByTestId("filter-q").fill("plaza vea");
    await expect(list.locator("li").first()).toContainText("PLAZA VEA");
    await expect(page).toHaveURL(/q=plaza/);

    // El buscador global del topbar llega con ?q= aunque ya estemos en Movimientos.
    const global = page.getByRole("searchbox", { name: "Buscar movimientos" });
    await global.fill("udemy");
    await global.press("Enter");
    await expect(page.getByTestId("filter-q")).toHaveValue("udemy");
    await expect(list.locator("li").first()).toContainText("UDEMY");

    // Sin resultados: frase + acción para limpiar.
    await page.getByTestId("filter-q").fill("zzz-nada");
    await expect(page.getByText("Nada que mostrar con estos filtros.")).toBeVisible();
    await page.getByRole("button", { name: "Limpiar filtros", exact: true }).click();
    await expect(page.getByTestId("filter-q")).toHaveValue("");
    await expect(list.locator("li").first()).toBeVisible();
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
    await rows.first().getByRole("button", { name: "Ver detalle" }).click();
    const more = rows.first().locator('[data-testid^="cat-"]');
    const chosen = await pick(page, more);
    await expect(toast(page)).toContainText(`Categoría guardada: ${chosen}`);
    await expectCategory(rows.first(), chosen);
    // Aprendido en la pestaña Comercios del mock (misma lógica que la Sheet real).
    const learned = await page.evaluate(() => {
      const store = JSON.parse(localStorage.getItem("luca.mock.store")!);
      const sheet = Object.values(store.sheets).find((s: unknown) => (s as Record<string, string[][]>).Comercios) as Record<string, string[][]>;
      return sheet.Comercios.find((r) => r[0] === "la lucha sangucheria");
    });
    expect(learned).toBeTruthy();
    expect(learned![2]).toBe(chosen);
    expect(learned![3]).toBe("user");
  });

  test("marcar como transferencia: P2P → categoría Transferencias; consumo → internal_transfer", async ({ page }) => {
    await login(page);
    await waitForDashboard(page);
    await page.goto("/app/movimientos?q=Ana%20Luc");
    const p2p = page.getByTestId("movs-list").locator("li").first();
    await expect(p2p).toBeVisible();
    await p2p.getByRole("button", { name: "Ver detalle" }).click();
    // Con una persona, Transferencias es uno de los chips rápidos (sin abrir "+N más").
    const chipTransfer = p2p.getByRole("group", { name: /^Categoría de/ }).getByRole("button", { name: "Transferencias", exact: true });
    await expect(chipTransfer).toHaveAttribute("aria-pressed", "false");
    await p2p.getByRole("button", { name: "Marcar como transferencia" }).click();
    await expect(toast(page)).toContainText("Transferencias");
    await expect(chipTransfer).toHaveAttribute("aria-pressed", "true");

    await page.goto("/app/movimientos?q=ZARA");
    const card = page.getByTestId("movs-list").locator("li").first();
    await expect(card).toBeVisible();
    await card.getByRole("button", { name: "Ver detalle" }).click();
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
    await expect(page.getByTestId("manual-form")).toContainText("Indica el comercio o la persona");
    await expect(page.getByLabel("Monto")).toBeFocused();

    await page.getByLabel("Monto").fill("12,50");
    await page.getByLabel("Comercio", { exact: true }).fill("Chifa Lung Fung");
    // Una categoría fuera de los chips, desde "+N más".
    const cat = await pick(page, page.getByTestId("manual-form").getByRole("button", { name: /^Más categorías/ }));
    await expect(page.getByTestId("manual-form")).toContainText(`Se guardará como ${cat}.`);
    await page.getByLabel("Nota (opcional)").fill("cena e2e");
    await page.screenshot({ path: `${SHOTS}/05-agregar.png`, fullPage: true });
    await page.getByRole("button", { name: "Agregar", exact: true }).click();
    await expect(toast(page)).toContainText("Movimiento agregado");
    await expect(page).toHaveURL(/fuente=manual/);
    const row = page.getByTestId("movs-list").locator("li", { hasText: "Chifa Lung Fung" });
    await expect(row).toBeVisible();
    await expect(row).toContainText("S/ 12.50");
    await expect(row).toContainText(cat);
    await row.getByRole("button", { name: "Ver detalle" }).click();
    await expect(row).toContainText(/manual:[0-9a-f-]{36}/);
    await expect(row).toContainText("cena e2e");
  });
});

test.describe("Movimientos: totales, orden, búsqueda y exportación", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await waitForDashboard(page);
    await page.goto("/app/movimientos");
    await expect(page.getByTestId("movs-list").locator("li").first()).toBeVisible();
  });

  test("la banda suma lo filtrado y 'Por categorizar' filtra los pendientes", async ({ page }) => {
    const totals = page.getByTestId("movs-totals");
    await expect(totals.getByTestId("movs-bars").locator("span")).not.toHaveCount(0);
    // El total de gastos de la banda es el mismo que el del encabezado de la lista.
    const head = await page.getByTestId("movs-count").innerText();
    const expense = (await totals.getByTestId("movs-total-expense").innerText()).replace(/\s+/g, " ").trim();
    expect(head.replace(/\s+/g, " ")).toContain(expense);
    await page.getByTestId("filter-tipo").getByRole("button", { name: /^Ingresos/ }).click();
    await expect(totals.getByTestId("movs-total-expense")).toContainText("0.00");

    await page.getByTestId("filter-tipo").getByRole("button", { name: /^Todos/ }).click();
    const toggle = page.getByTestId("movs-pending-toggle");
    const pending = Number((await toggle.locator(".num").innerText()).trim());
    expect(pending).toBeGreaterThan(0);
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-pressed", "true");
    await expect(page).toHaveURL(/categoria=__pending__/);
    await expect(page.getByTestId("movs-count")).toContainText(new RegExp(`^${pending} `));
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-pressed", "false");
    await expect(page).not.toHaveURL(/categoria=/);
  });

  test("ordenar por mayor monto deja la lista sin días y de mayor a menor", async ({ page }) => {
    const list = page.getByTestId("movs-list");
    await expect(list.locator("section h2").first()).toBeVisible();
    await page.getByRole("group", { name: "Orden" }).getByRole("button", { name: "Mayor monto" }).click();
    await expect(list.locator("section h2")).toHaveCount(0);
    const amounts = await list.locator("li > button .num").evaluateAll((els) =>
      els.slice(0, 6).map((e) => Number((e.textContent ?? "").replace(/[^\d.]/g, ""))));
    expect(amounts.length).toBeGreaterThan(2);
    // Montos de la lista (en su moneda): los primeros en soles van de mayor a menor.
    expect(amounts[0]).toBeGreaterThanOrEqual(amounts[2]);
    await page.getByRole("group", { name: "Orden" }).getByRole("button", { name: "Recientes" }).click();
    await expect(list.locator("section h2").first()).toBeVisible();
  });

  test("la búsqueda se resalta y 'Limpiar todo' quita todos los filtros", async ({ page }) => {
    await page.getByTestId("filter-q").fill("plaza");
    const list = page.getByTestId("movs-list");
    await expect(list.locator("mark").first()).toHaveText(/plaza/i);
    await page.getByTestId("filter-tipo").getByRole("button", { name: /^Gastos/ }).click();
    await expect(page.getByRole("list", { name: "Filtros activos" }).getByRole("listitem")).toHaveCount(2);
    await page.getByRole("button", { name: "Borrar búsqueda" }).click();
    await expect(page.getByTestId("filter-q")).toHaveValue("");
    await page.getByTestId("filter-q").fill("plaza");
    await page.getByRole("button", { name: "Limpiar todo" }).click();
    await expect(page.getByTestId("filter-q")).toHaveValue("");
    await expect(page.getByRole("list", { name: "Filtros activos" })).toHaveCount(0);
    await expect(page.getByTestId("filter-tipo").getByRole("button", { name: /^Todos/ })).toHaveAttribute("aria-pressed", "true");
  });

  test("'Mostrar más' pagina de 40 en 40", async ({ page }) => {
    const all = Number((await page.getByTestId("movs-count").innerText()).split(" ")[0]);
    const rows = page.getByTestId("movs-list").locator("li[data-testid^='mov-']");
    if (all <= 40) {
      await expect(rows).toHaveCount(all);
      await expect(page.getByTestId("movs-more")).toHaveCount(0);
      return;
    }
    await expect(rows).toHaveCount(40);
    await expect(page.getByTestId("movs-count")).toContainText("mostrando 40");
    await page.getByTestId("movs-more").click();
    await expect(rows).toHaveCount(Math.min(80, all));
  });

  test("CSV descarga lo filtrado con encabezado", async ({ page }) => {
    await page.getByTestId("filter-q").fill("plaza vea");
    await expect(page.getByTestId("movs-list").locator("li").first()).toContainText("PLAZA VEA");
    const n = Number((await page.getByTestId("movs-count").innerText()).split(" ")[0]);
    const [download] = await Promise.all([page.waitForEvent("download"), page.getByTestId("movs-csv").click()]);
    expect(download.suggestedFilename()).toMatch(/^luca-movimientos.*\.csv$/);
    const text = (await (await download.createReadStream()).toArray()).map(String).join("").replace(/^﻿/, "");
    const lines = text.split("\n");
    expect(lines[0]).toBe('"id","fecha","tipo","comercio","contraparte","categoria","moneda","monto","monto_pen","fuente","medio"');
    expect(lines.length - 1).toBe(n);
    expect(lines.slice(1).every((l) => /PLAZA VEA/i.test(l))).toBe(true);
    await expect(toast(page)).toContainText("exportados a CSV");
    await page.screenshot({ path: `${SHOTS}/21-movimientos-v2.png`, fullPage: true });
  });
});
