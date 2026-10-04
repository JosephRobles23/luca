import { test, expect } from "@playwright/test";
import { SHOTS, login, useScenario, waitForDashboard } from "./helpers";

test.describe("Onboarding en 3 pasos (sin Sheet)", () => {
  test("Crear mi Sheet → paso 2 → 'Ya autoricé' → paso 3 → omitir", async ({ page }) => {
    await useScenario(page, "empty");
    await login(page);
    const step1 = page.getByTestId("onboarding-step1");
    await expect(step1).toBeVisible();
    await expect(step1.locator("li[aria-current='step']")).toContainText("1. Tu Sheet");
    await page.screenshot({ path: `${SHOTS}/06-onboarding-1.png`, fullPage: true });

    await step1.getByRole("button", { name: "Crear mi Sheet" }).click(); // Picker mockeado → plantilla → copia
    const step2 = page.getByTestId("onboarding-step2");
    await expect(step2).toBeVisible();
    await expect(step2.getByRole("link", { name: /Abrir mi Sheet y autorizar/ })).toHaveAttribute("href", /docs\.google\.com\/spreadsheets\/d\/sheet-copia/);
    await expect(page.getByTestId("empty-ledger")).toBeVisible(); // sin Movimientos todavía
    await page.screenshot({ path: `${SHOTS}/07-onboarding-2.png`, fullPage: true });

    await step2.getByRole("button", { name: /Ya autoricé/ }).click(); // el mock simula la autorización + importación
    await waitForDashboard(page);
    const step3 = page.getByTestId("onboarding-step3");
    await expect(step3).toBeVisible();
    await expect(step3).toContainText("Web App sin publicar");
    await page.screenshot({ path: `${SHOTS}/08-onboarding-3.png`, fullPage: true });

    await step3.getByRole("button", { name: "Omitir por ahora" }).click();
    await expect(step3).toHaveCount(0);
    await page.reload();
    await waitForDashboard(page);
    await expect(page.getByTestId("onboarding-step3")).toHaveCount(0); // la omisión persiste
    await page.goto("/app/conexiones");
    await page.getByRole("button", { name: "Retomar la guía" }).click();
    await page.goto("/app");
    await expect(page.getByTestId("onboarding-step3")).toBeVisible();
  });

  test("'Ya tengo una' conecta una Sheet existente y entra directo al dashboard", async ({ page }) => {
    await useScenario(page, "empty");
    await login(page);
    await page.getByTestId("onboarding-step1").getByRole("button", { name: "Ya tengo una" }).click();
    await waitForDashboard(page);
    await expect(page.getByTestId("onboarding-step1")).toHaveCount(0);
    await expect(page.getByTestId("onboarding-step2")).toHaveCount(0);
    await expect(page.getByTestId("onboarding-step3")).toBeVisible(); // autorizada pero sin conexiones
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
