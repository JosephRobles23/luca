/**
 * Lógica pura del asistente "Conectar iPhone" (`/app/conexiones/iphone`), sobre `Ajustes.conexiones.*`
 * (ADR-003 §Limitaciones). El componente solo presenta.
 */
import type { Ajustes } from "./ajustes.ts";

/** Enlace de iCloud del atajo "Luca – Captura Yape" (ADR-003); `NEXT_PUBLIC_SHORTCUT_URL` lo sobreescribe. */
export const SHORTCUT_URL = "https://www.icloud.com/shortcuts/4466a87c439a40b1a3e193d6777ccd38";

export const WIZARD_STEPS = [
  { n: 1, title: "Tu hoja responde", short: "Hoja" },
  { n: 2, title: "Ábrelo en tu iPhone", short: "iPhone" },
  { n: 3, title: "Instala el atajo", short: "Atajo" },
  { n: 4, title: "Prueba la conexión", short: "Prueba" },
  { n: 5, title: "Activa la automatización", short: "Activar" },
] as const;
export type WizardStep = 1 | 2 | 3 | 4 | 5;

/** Claves de `Ajustes` del canal iPhone. El token lo puede generar la web si falta. */
export const IPHONE_KEYS = {
  execUrl: "conexiones.execUrl",
  token: "conexiones.iphone.token",
  shortcutExecUrl: "conexiones.iphone.execUrl",
  device: "conexiones.iphone.device",
  lastEventAt: "conexiones.iphone.lastEventAt",
  eventsCount: "conexiones.iphone.eventsCount",
  lastTestAt: "conexiones.iphone.lastTestAt",
  lastError: "conexiones.iphone.lastError",
  schemaVersion: "conexiones.iphone.schemaVersion",
} as const;

/** `?paso=` de la URL → paso válido (1 por defecto). */
export function parseStep(v: string | string[] | undefined | null): WizardStep {
  const n = parseInt(Array.isArray(v) ? v[0] : (v ?? ""), 10);
  return n >= 1 && n <= 5 ? (n as WizardStep) : 1;
}

/** Paso inicial: si el iPhone ya está conectado (token + dispositivo), directo al estado final. */
export function initialStep(a: Ajustes, requested: WizardStep): WizardStep {
  if (requested !== 1) return requested;
  return a[IPHONE_KEYS.token] && a[IPHONE_KEYS.device] ? 5 : 1;
}

export const isIOS = (ua: string) => /iPhone|iPad|iPod/i.test(ua) || (/Macintosh/.test(ua) && /Mobile/.test(ua));

export function newToken(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}-${Math.random().toString(16).slice(2)}`;
}

/** `a1b2c3d4-…-9f8e` → `a1b2…9f8e`. */
export function maskToken(t: string): string {
  if (!t) return "";
  return t.length <= 10 ? "••••" : `${t.slice(0, 4)}…${t.slice(-4)}`;
}

/** Escrituras al generar/regenerar el token: fija también la URL que usará el atajo (para detectar cambios luego). */
export function tokenWrites(token: string, execUrl: string): Record<string, string> {
  return { [IPHONE_KEYS.token]: token, [IPHONE_KEYS.shortcutExecUrl]: execUrl };
}

/** "Desconectar": vacía el token y la telemetría del iPhone (Ajustes no borra filas; se dejan en blanco). */
export function disconnectWrites(): Record<string, string> {
  return {
    [IPHONE_KEYS.token]: "", [IPHONE_KEYS.shortcutExecUrl]: "", [IPHONE_KEYS.device]: "", [IPHONE_KEYS.lastEventAt]: "",
    [IPHONE_KEYS.eventsCount]: "", [IPHONE_KEYS.lastTestAt]: "", [IPHONE_KEYS.lastError]: "", [IPHONE_KEYS.schemaVersion]: "",
    "conexiones.iphone": "",
  };
}

export type TestBaseline = { openedAt: number; lastTestAt: string; lastEventAt: string };
export const baselineFrom = (a: Ajustes, openedAt: number): TestBaseline =>
  ({ openedAt, lastTestAt: a[IPHONE_KEYS.lastTestAt] ?? "", lastEventAt: a[IPHONE_KEYS.lastEventAt] ?? "" });

/** Tolerancia entre el reloj del script (hora Lima) y el del navegador. */
const SKEW_MS = 2 * 60_000;

export type TestResult = { kind: "test" | "event"; at: string; device: string } | null;

/**
 * ¿Llegó una señal nueva desde que se abrió el paso 4? Acepta la prueba (`source:test`) o un yapeo real:
 * el valor debe haber cambiado respecto al de apertura y ser posterior a ella (con tolerancia de reloj).
 */
export function detectSignal(a: Ajustes, b: TestBaseline): TestResult {
  const device = a[IPHONE_KEYS.device] ?? "";
  const fresh = (v: string, prev: string) => !!v && v !== prev && (Date.parse(v) || 0) >= b.openedAt - SKEW_MS;
  const t = a[IPHONE_KEYS.lastTestAt] ?? "", e = a[IPHONE_KEYS.lastEventAt] ?? "";
  if (fresh(t, b.lastTestAt)) return { kind: "test", at: t, device };
  if (fresh(e, b.lastEventAt)) return { kind: "event", at: e, device };
  return null;
}

export const secondsSince = (iso: string, now = Date.now()) => Math.max(0, Math.round((now - (Date.parse(iso) || now)) / 1000));
