import { test, expect } from "@playwright/test";
import { SHOTS, login, useScenario, waitForDashboard } from "./helpers";

test.describe("Onboarding por fases (sin Sheet)", () => {
  test("Copiar a mi Drive → Elegir mi copia → la autorización se detecta sola → conexiones → omitir", async ({ page }) => {
    await useScenario(page, "empty");
    await login(page);
    const step1 = page.getByTestId("onboarding-step1");
    await expect(step1).toBeVisible();
    await expect(step1.locator("ol[aria-label='Progreso del onboarding'] li[aria-current='step']")).toContainText("1. Tu copia");
    // La copia la hace el usuario con la página nativa de Google (ADR-009).
    await expect(step1.getByTestId("copy-template")).toHaveAttribute("href", /docs\.google\.com\/spreadsheets\/d\/[^/]+\/copy\?authuser=[^&]+%40/);
    await expect(step1.getByTestId("copy-account")).toContainText("@");
    await expect(step1.getByTestId("copy-template")).toHaveAttribute("target", "_blank");
    await page.screenshot({ path: `${SHOTS}/06-onboarding-1.png`, fullPage: true });

    // Abrir la copia no debe sacarnos de la app; luego se resalta "Elegir mi copia".
    await step1.getByTestId("copy-template").evaluate((a: HTMLAnchorElement) => a.addEventListener("click", (e) => e.preventDefault()));
    await step1.getByTestId("copy-template").click();
    await expect(step1.getByTestId("copy-template")).toContainText("Copiar otra vez");
    await step1.getByTestId("pick-copy").click(); // Picker mockeado → "Copia de Luca Template" sin autorizar

    const step2 = page.getByTestId("onboarding-step2");
    await expect(step2).toBeVisible();
    await expect(step2.getByRole("link", { name: /Abrir mi copia y autorizar/ })).toHaveAttribute("href", /docs\.google\.com\/spreadsheets\/d\/sheet-copia-usuario/);
    await expect(step2.getByTestId("auth-waiting")).toBeVisible();
    await expect(page.getByTestId("empty-ledger")).toBeVisible(); // sin Movimientos todavía
    await page.screenshot({ path: `${SHOTS}/07-onboarding-2.png`, fullPage: true });

    // Sin pulsar nada: la comprobación periódica detecta la autorización (el mock autoriza en la 2.ª lectura).
    await expect(page.getByTestId("kpi-expense")).toBeVisible({ timeout: 20_000 });
    const step4 = page.getByTestId("onboarding-step4");
    await expect(step4).toBeVisible({ timeout: 20_000 });
    await expect(step4).toContainText("Web App sin publicar");
    await page.screenshot({ path: `${SHOTS}/08-onboarding-3.png`, fullPage: true });

    await step4.getByRole("button", { name: "Omitir por ahora" }).click();
    await expect(step4).toHaveCount(0);
    await page.reload();
    await waitForDashboard(page);
    await expect(page.getByTestId("onboarding-step4")).toHaveCount(0); // la omisión persiste
    await page.goto("/app/conexiones");
    await page.getByRole("button", { name: "Retomar la guía" }).click();
    await page.goto("/app");
    await expect(page.getByTestId("onboarding-step4")).toBeVisible();
  });

  test("Otras formas: 'Crear mi Sheet' copia la plantilla desde el selector y 'Comprobar ahora' detecta la autorización", async ({ page }) => {
    await useScenario(page, "empty");
    await login(page);
    const step1 = page.getByTestId("onboarding-step1");
    await step1.getByText("Otras formas de empezar").click();
    await expect(step1.getByTestId("template-folder-link")).toHaveAttribute("href", /drive\.google\.com\/drive\/folders\//);
    await step1.getByRole("button", { name: "Crear mi Sheet" }).click(); // Picker mockeado → plantilla → copia
    const step2 = page.getByTestId("onboarding-step2");
    await expect(step2).toBeVisible();
    await step2.getByRole("button", { name: /Comprobar ahora/ }).click();
    await waitForDashboard(page);
    await expect(page.getByTestId("onboarding-step4")).toBeVisible();
  });

  test("'Ya tengo una' conecta una Sheet existente y entra directo al dashboard", async ({ page }) => {
    await useScenario(page, "empty");
    await login(page);
    const step1 = page.getByTestId("onboarding-step1");
    await step1.getByText("Otras formas de empezar").click();
    await step1.getByRole("button", { name: "Ya tengo una" }).click();
    await waitForDashboard(page);
    await expect(page.getByTestId("onboarding-step1")).toHaveCount(0);
    await expect(page.getByTestId("onboarding-step2")).toHaveCount(0);
    await expect(page.getByTestId("onboarding-step4")).toBeVisible(); // autorizada pero sin conexiones
  });

  test("Cambiar Sheet vuelve al paso 1 sin perder la sesión", async ({ page }) => {
    await login(page);
    await waitForDashboard(page);
    await page.goto("/app/ajustes");
    await page.getByRole("button", { name: "Cambiar Sheet" }).click();
    await expect(page.getByTestId("onboarding-step1")).toBeVisible();
    await expect(page.getByTestId("mock-banner")).toBeVisible();
  });
});
