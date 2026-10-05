import { test, expect, type Page } from "@playwright/test";
import { SHOTS, login, useScenario, waitForDashboard, toast } from "./helpers";

const EXEC = "https://script.google.com/macros/s/AKfycbxMOCKmockMOCK/exec";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

const readAjustes = (page: Page) => page.evaluate(() => {
  const store = JSON.parse(localStorage.getItem("luca.mock.store")!);
  const rows: string[][] = store.sheets["sheet-mock-1"].Ajustes;
  return Object.fromEntries(rows.map((r) => [r[0], r[1]])) as Record<string, string>;
});
const clipboard = (page: Page) => page.evaluate(() => navigator.clipboard.readText());

test.describe("Asistente Conectar iPhone", () => {
  test.beforeEach(async ({ context }) => { await context.grantPermissions(["clipboard-read", "clipboard-write"]); });

  test("paso 1 sin Web App: instrucciones y 'Ya lo hice → Actualizar' detecta la URL", async ({ page }) => {
    await useScenario(page, "authorized");
    await login(page);
    await waitForDashboard(page);
    await expect(page.getByTestId("onboarding-step4").getByRole("link", { name: "Conectar iPhone" })).toHaveAttribute("href", "/app/conexiones/iphone");
    await page.goto("/app/conexiones");
    await page.getByTestId("card-iphone").getByTestId("iphone-configurar").click();
    await expect(page).toHaveURL(/\/app\/conexiones\/iphone/);
    const wiz = page.getByTestId("iphone-wizard");
    await expect(wiz).toHaveAttribute("data-step", "1");
    await expect(wiz).toContainText("Nueva implementación");
    await expect(wiz).toContainText("Cualquier usuario");
    await expect(page.getByTestId("wiz-next")).toBeDisabled();
    await page.screenshot({ path: `${SHOTS}/14-iphone-paso1-sin-webapp.png`, fullPage: true });

    // El usuario publica la Web App y su script guarda la URL en Ajustes (cola de escrituras "del script" del mock).
    await page.evaluate((url) => localStorage.setItem("luca.mock.scriptWrites", JSON.stringify([{ due: 0, values: { "conexiones.execUrl": url } }])), EXEC);
    await wiz.getByRole("button", { name: /Ya lo hice/ }).click();
    await expect(page.getByTestId("wiz-execurl")).toHaveText(EXEC);
    await expect(page.getByTestId("wiz-next")).toBeEnabled();
  });

  test("flujo completo: QR, token, prompt, prueba recibida, estado final, regenerar y desconectar", async ({ page, baseURL }) => {
    await useScenario(page, "webapp");
    await login(page);
    await waitForDashboard(page);
    await page.goto("/app/conexiones");
    await expect(page.getByTestId("card-iphone")).toContainText("no configurado");
    await page.getByTestId("iphone-configurar").click();
    const wiz = page.getByTestId("iphone-wizard");

    // 1 · la hoja responde
    await expect(wiz).toHaveAttribute("data-step", "1");
    await expect(page.getByTestId("wiz-execurl")).toHaveText(EXEC);
    await page.getByTestId("wiz-next").click();

    // 2 · QR + copiar enlace (en Chrome de escritorio no se salta)
    await expect(wiz).toHaveAttribute("data-step", "2");
    await expect(page).toHaveURL(/paso=2/);
    await expect(page.getByTestId("wiz-qr").locator("svg")).toBeVisible();
    await page.getByTestId("copy-link").click();
    await expect(toast(page)).toContainText("Enlace copiado");
    expect(await clipboard(page)).toBe(`${baseURL}/app/conexiones/iphone?paso=3`);
    await page.screenshot({ path: `${SHOTS}/15-iphone-paso2-qr.png`, fullPage: true });
    await page.getByTestId("wiz-next").click();

    // 3 · token generado por la web y guardado en Ajustes; chips y prompt con URL + token
    await expect(wiz).toHaveAttribute("data-step", "3");
    await expect(toast(page)).toContainText("Token del iPhone generado");
    const aj = await readAjustes(page);
    expect(aj["conexiones.iphone.token"]).toMatch(UUID);
    expect(aj["conexiones.iphone.execUrl"]).toBe(EXEC);
    const token = aj["conexiones.iphone.token"];

    await expect(page.getByTestId("copy-url-value")).toHaveText(`${EXEC}?events=1`);
    await page.getByTestId("copy-url").click();
    expect(await clipboard(page)).toBe(`${EXEC}?events=1`);
    await expect(page.getByTestId("copy-token-value")).toHaveText(`${token.slice(0, 4)}…${token.slice(-4)}`);
    await page.getByTestId("toggle-token").click();
    await expect(page.getByTestId("copy-token-value")).toHaveText(token);
    await page.getByTestId("copy-token").click();
    await expect(toast(page)).toContainText("Token copiado");
    expect(await clipboard(page)).toBe(token);

    await expect(page.getByTestId("install-shortcut")).toHaveCount(0); // NEXT_PUBLIC_SHORTCUT_URL vacío → sin botón de iCloud
    await expect(page.getByTestId("ai-prompt")).toHaveAttribute("open", "");
    const prompt = await page.getByTestId("prompt-text").inputValue();
    expect(prompt).toContain(`${EXEC}?events=1`);
    expect(prompt).toContain(token);
    expect(prompt).toContain("modo prueba");
    await page.getByTestId("copy-prompt").click();
    expect(await clipboard(page)).toBe(prompt);
    await page.screenshot({ path: `${SHOTS}/16-iphone-paso3-atajo.png`, fullPage: true });
    await page.getByTestId("wiz-next").click();

    // 4 · espera la prueba; el mock la "recibe" y el sondeo de Ajustes la detecta
    await expect(wiz).toHaveAttribute("data-step", "4");
    await expect(page.getByTestId("test-waiting")).toContainText("Esperando tu prueba");
    await page.getByTestId("mock-simulate-test").click();
    await expect(page.getByTestId("test-ok")).toContainText("Prueba recibida", { timeout: 15_000 });
    await expect(page.getByTestId("test-ok")).toContainText("desde iPhone de Nombre");

    // 5 · estado final (auto-avance), regenerar token y desconectar
    await expect(wiz).toHaveAttribute("data-step", "5", { timeout: 10_000 });
    const status = page.getByTestId("iphone-final-status");
    await expect(status).toContainText("iPhone de Nombre");
    await expect(status).toContainText("Última prueba");
    await expect(status.getByRole("link", { name: "Ver datos" })).toHaveAttribute("href", "/app");
    await page.screenshot({ path: `${SHOTS}/17-iphone-paso5-estado.png`, fullPage: true });

    page.once("dialog", (d) => d.accept());
    await status.getByRole("button", { name: "Regenerar token" }).click();
    await expect(toast(page)).toContainText("Token nuevo guardado");
    const aj2 = await readAjustes(page);
    expect(aj2["conexiones.iphone.token"]).toMatch(UUID);
    expect(aj2["conexiones.iphone.token"]).not.toBe(token);
    await expect(status).toContainText("vuelve a importar el atajo");
    await status.getByRole("button", { name: "Ir al paso 3" }).click();
    await expect(wiz).toHaveAttribute("data-step", "3");
    await page.getByTestId("toggle-token").click();
    await expect(page.getByTestId("copy-token-value")).toHaveText(aj2["conexiones.iphone.token"]);

    await page.goto("/app/conexiones");
    await expect(page.getByTestId("card-iphone")).toContainText("conectado");
    await expect(page.getByTestId("iphone-configurar")).toHaveAttribute("href", "/app/conexiones/iphone?paso=5");
    await page.getByTestId("iphone-configurar").click();
    await expect(wiz).toHaveAttribute("data-step", "5");
    page.once("dialog", (d) => d.accept());
    await page.getByTestId("iphone-final-status").getByRole("button", { name: "Desconectar" }).click();
    await expect(toast(page)).toContainText("iPhone desconectado");
    await expect(page).toHaveURL(/\/app\/conexiones$/);
    await expect(page.getByTestId("card-iphone")).toContainText("no configurado");
    const aj3 = await readAjustes(page);
    expect(aj3["conexiones.iphone.token"]).toBe("");
    expect(aj3["conexiones.iphone.device"]).toBe("");
  });

  test("?mock=iphone-test programa la prueba y el paso 4 la detecta; aviso de ayuda tras 60 s si no llega", async ({ page }) => {
    await useScenario(page, "webapp");
    await login(page);
    await page.goto("/app/conexiones/iphone?paso=4&mock=iphone-test");
    await expect(page.getByTestId("iphone-wizard")).toHaveAttribute("data-step", "4");
    await expect(page.getByTestId("test-ok")).toBeVisible({ timeout: 15_000 });

    await page.clock.install();
    await page.goto("/app/conexiones/iphone?paso=4");
    await expect(page.getByTestId("test-waiting")).toBeVisible();
    await page.clock.runFor(61_000);
    await expect(page.getByTestId("test-timeout")).toContainText("Luca – Captura Yape");
    await expect(page.getByTestId("test-timeout")).toContainText("token");
    await expect(page.getByTestId("test-timeout")).toContainText("/exec?events=1");
  });

  test("iPhone ya conectado: la tarjeta lleva al estado final con la telemetría", async ({ page }) => {
    await useScenario(page, "full");
    await login(page);
    await page.goto("/app/conexiones/iphone");
    const wiz = page.getByTestId("iphone-wizard");
    await expect(wiz).toHaveAttribute("data-step", "5");
    const status = page.getByTestId("iphone-final-status");
    await expect(status).toContainText("iPhone de Nombre");
    await expect(status).toContainText("37");
    await expect(status).toContainText("0f1e…aabb");
  });
});
