/** Estado del onboarding por fases (ADR-009, sustituye ADR-006 §3). Lógica pura. */

export type OnboardingInput = {
  hasFile: boolean;
  authorized: boolean;
  /** `Ajustes.import.status === "running"`: la primera importación sigue en curso */
  importRunning?: boolean;
  /** el usuario pulsó "Seguir al panel" durante la importación */
  importDismissed?: boolean;
  /** `Ajustes.conexiones.execUrl` válido o alguna conexión activa */
  connectionsActive: boolean;
  /** el usuario pulsó "Omitir por ahora" */
  connectionsSkipped: boolean;
};

export type OnboardingStep = 1 | 2 | 3 | 4 | null;

/** Fase pendiente (1..4) o null si el onboarding está completo. La 3 solo aparece mientras se importa. */
export function currentStep(i: OnboardingInput): OnboardingStep {
  if (!i.hasFile) return 1;
  if (!i.authorized) return 2;
  if (i.importRunning && !i.importDismissed) return 3;
  if (!i.connectionsActive && !i.connectionsSkipped) return 4;
  return null;
}

export const STEP_TITLES: Record<1 | 2 | 3 | 4, string> = { 1: "Tu copia", 2: "Autorizar", 3: "Importación", 4: "Conexiones" };
export const STEP_OPTIONAL = 4;

/** Página nativa de Google "¿Hacer una copia?" de la plantilla: la copia la hace el propio usuario, en su Drive. */
export const templateCopyUrl = (templateId: string) => `https://docs.google.com/spreadsheets/d/${encodeURIComponent(templateId)}/copy`;

/** Búsqueda del selector para encontrar la copia ("Copia de Luca Template" / "Copy of Luca Template"). */
export const COPY_QUERY = "Luca Template";

/** Cada cuánto se vuelve a leer la Sheet mientras se espera la autorización o la importación. */
export const POLL_MS = 6000;
