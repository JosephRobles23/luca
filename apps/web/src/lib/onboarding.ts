/** Estado del onboarding en 3 pasos (ADR-006 §3). Lógica pura. */

export type OnboardingInput = {
  hasFile: boolean;
  authorized: boolean;
  /** `Ajustes.conexiones.execUrl` válido o alguna conexión activa */
  connectionsActive: boolean;
  /** el usuario pulsó "Omitir por ahora" */
  connectionsSkipped: boolean;
};

export type OnboardingStep = 1 | 2 | 3 | null;

/** Paso pendiente (1..3) o null si el onboarding está completo. */
export function currentStep(i: OnboardingInput): OnboardingStep {
  if (!i.hasFile) return 1;
  if (!i.authorized) return 2;
  if (!i.connectionsActive && !i.connectionsSkipped) return 3;
  return null;
}

export const STEP_TITLES: Record<1 | 2 | 3, string> = { 1: "Tu Sheet", 2: "Autorizar", 3: "Activar conexiones" };
