/**
 * Lectura pura de `Ajustes` (key/value que escribe el Apps Script) y de `Categorías`.
 * Claves según ADR-003 §Limitaciones, ADR-005 y ADR-006 §4.
 */
import { DEFAULT_USD_RATE } from "./ledger.ts";

export type Ajustes = Record<string, string>;

export function parseAjustes(rows: string[][]): Ajustes {
  const out: Ajustes = {};
  rows.forEach((r, i) => {
    const k = (r[0] ?? "").trim();
    if (!k || (i === 0 && /^(key|clave)$/i.test(k))) return;
    out[k] = (r[1] ?? "").trim();
  });
  return out;
}

/** Taxonomía inicial (ADR-004 §5) si la pestaña `Categorías` no existe aún. */
export const DEFAULT_CATEGORIAS = [
  "Vivienda", "Supermercado", "Comidas fuera", "Transporte", "Servicios", "Suscripciones", "Salud",
  "Educación", "Ropa", "Ocio", "Transferencias", "Retiro de Agente", "Otros", "Ingreso",
];

/** Columna A de `Categorías` (ignora un posible encabezado); taxonomía por defecto si está vacía. */
export function parseCategorias(rows: string[][]): string[] {
  const names = rows.map((r) => (r[0] ?? "").trim()).filter(Boolean);
  if (names.length && /^(nombre|categor[ií]a|name)$/i.test(names[0])) names.shift();
  const uniq = Array.from(new Set(names));
  return uniq.length ? uniq : DEFAULT_CATEGORIAS;
}

export function usdRate(a: Ajustes): number {
  const n = parseFloat((a["fx.usd_pen"] ?? "").replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_USD_RATE;
}

const truthy = (v: string | undefined) => !!v && !/^(0|false|off|no|)$/i.test(v.trim());

export type VersionStatus = { current: string; latest: string; outdated: boolean };

/** `Ajustes.luca.version` (lo escribe la copia del usuario) frente a la última publicada (`NEXT_PUBLIC_LUCA_LIB_VERSION`). */
export function versionStatus(a: Ajustes, latest: string): VersionStatus {
  const current = a["luca.version"] ?? "";
  const n = (s: string) => parseFloat(s) || 0;
  return { current, latest, outdated: !!latest && !!current && n(latest) > n(current) };
}

export const daysSince = (iso: string | undefined, now: number): number | null => {
  if (!iso) return null;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? Math.floor((now - t) / 86400000) : null;
};

export type IphoneStatus = {
  connected: boolean;
  device: string;
  lastEventAt: string;
  eventsCount: number;
  lastError: string;
  lastTestAt: string;
  schemaVersion: string;
  silentDays: number | null;
  /** conectado pero sin eventos ni pruebas en más de 7 días (ADR-003) */
  silent: boolean;
  /** la URL /exec actual difiere de la que usa el atajo → reimportar */
  execUrlChanged: boolean;
};

export function iphoneStatus(a: Ajustes, now = Date.now()): IphoneStatus {
  const device = a["conexiones.iphone.device"] ?? "";
  const connected = truthy(a["conexiones.iphone"]) || !!device;
  const lastEventAt = a["conexiones.iphone.lastEventAt"] ?? "";
  const lastTestAt = a["conexiones.iphone.lastTestAt"] ?? "";
  const silentDays = daysSince(lastEventAt, now);
  // "Sin señales" cuenta desde lo último que llegó, sea yapeo o prueba: recién conectado (solo prueba) no es silencio.
  const lastSignal = [lastEventAt, lastTestAt].filter(Boolean).sort().pop();
  const signalDays = daysSince(lastSignal, now);
  const execUrl = a["conexiones.execUrl"] ?? "";
  const shortcutUrl = a["conexiones.iphone.execUrl"] ?? "";
  return {
    connected, device, lastEventAt,
    eventsCount: parseInt(a["conexiones.iphone.eventsCount"] ?? "0", 10) || 0,
    lastError: a["conexiones.iphone.lastError"] ?? "",
    lastTestAt,
    schemaVersion: a["conexiones.iphone.schemaVersion"] ?? "",
    silentDays,
    silent: connected && (signalDays == null || signalDays > 7),
    execUrlChanged: connected && !!execUrl && !!shortcutUrl && execUrl !== shortcutUrl,
  };
}

export type McpStatus = { connected: boolean; client: string; connectedAt: string; lastCallAt: string; callsCount: number; workerUrl: string };

export function mcpStatus(a: Ajustes): McpStatus {
  const connectedAt = a["conexiones.mcp.connectedAt"] ?? "";
  return {
    connected: truthy(a["conexiones.mcp"]) || !!connectedAt || !!a["conexiones.mcp.tenantId"],
    client: a["conexiones.mcp.client"] ?? "",
    connectedAt,
    lastCallAt: a["conexiones.mcp.lastCallAt"] ?? "",
    callsCount: parseInt(a["conexiones.mcp.callsCount"] ?? "0", 10) || 0,
    workerUrl: a["conexiones.workerUrl"] || "https://mcp.lucaa.lat",
  };
}

export type ConnectionsStatus = { execUrl: string; webAppReady: boolean; iphone: IphoneStatus; mcp: McpStatus };

export function connectionsStatus(a: Ajustes, now = Date.now()): ConnectionsStatus {
  const execUrl = a["conexiones.execUrl"] ?? "";
  return { execUrl, webAppReady: /^https:\/\/script\.google\.com\/.+\/exec/.test(execUrl), iphone: iphoneStatus(a, now), mcp: mcpStatus(a) };
}

/** Paso 2 (Autorizar) se da por hecho cuando el script ya escribió algo: existe `Movimientos` o `luca.version`. */
export function isAuthorized(a: Ajustes, hasMovimientosTab: boolean): boolean {
  return hasMovimientosTab || !!a["luca.version"];
}

export type ImportStatus = { since: string; status: string; running: boolean; done: boolean };
export function importStatus(a: Ajustes): ImportStatus {
  const status = a["import.status"] ?? "";
  return { since: a["import.since"] ?? "", status, running: status === "running", done: status === "done" };
}

export const apiKeyConfigured = (a: Ajustes) => truthy(a["llm.apiKey.configured"]) || truthy(a["llm.configured"]);
