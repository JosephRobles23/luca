/**
 * Sheet de fixtures SINTÉTICOS para el modo mock (`LUCA_MOCK=1`) y los e2e. Mismo estilo que
 * `tests/fixtures/emails.mjs`: nombres y números ficticios; 3 meses de movimientos relativos a hoy
 * (PEN/USD, pendientes, `transfer_in`, `internal_transfer`, flags) y las pestañas `Ajustes`,
 * `Categorías` y `Comercios` como las escribe LucaLib. Determinista: sin Math.random.
 */
import { LEDGER_HEADERS, lastMonths, isoLima } from "./ledger.ts";
import { DEFAULT_CATEGORIAS } from "./ajustes.ts";
import { COMERCIOS_HEADERS, merchantKey } from "./sheets-ops.ts";

export type MockSheet = Record<string, string[][]>;

type Seed = {
  d: number; h?: number; tipo?: string; monto: number; moneda?: string; tc?: string; comercio?: string; contraparte?: string;
  categoria?: string; origen?: string; canal?: string; fuente?: string; medio?: string; flags?: string; asunto?: string;
};

/** Patrón mensual: se repite en los 3 meses con pequeñas variaciones de monto. */
const MONTHLY: Seed[] = [
  { d: 1, h: 9, tipo: "income", monto: 6500, comercio: "Sueldo", categoria: "Ingreso", origen: "user", fuente: "manual", medio: "manual" },
  { d: 1, h: 10, monto: 1300, comercio: "Alquiler Dpto", categoria: "Vivienda", origen: "user", fuente: "manual", medio: "manual" },
  { d: 2, h: 21, monto: 186.4, comercio: "PLAZA VEA SAN BORJA", categoria: "Supermercado", origen: "cache", fuente: "bcp_email", medio: "Tarjeta de Débito ****1816", asunto: "Realizaste un consumo con tu Tarjeta de Débito BCP" },
  { d: 3, h: 13, monto: 42.9, comercio: "RAPPI", categoria: "Comidas fuera", origen: "cache", fuente: "bcp_email", medio: "Tarjeta de Débito ****1816", asunto: "Realizaste un consumo con tu Tarjeta de Débito BCP" },
  { d: 3, h: 7, monto: 3.86, moneda: "USD", tc: "3.409", comercio: "APPLE.COM/BILL", categoria: "Suscripciones", origen: "rule", fuente: "bcp_email", medio: "Tarjeta de Débito ****1816", asunto: "Realizaste un consumo con tu Tarjeta de Débito BCP" },
  { d: 5, h: 20, monto: 10, comercio: "Metropolitano y Corredores", categoria: "Transporte", origen: "rule", canal: "yape_service", fuente: "yape_email", medio: "Yape", asunto: "Confirmación de Pago" },
  { d: 6, h: 2, monto: 25, contraparte: "Carlos Roj*", canal: "yape_p2p", fuente: "yape_email", medio: "Yape", asunto: "Confirmación de Yapeo" },
  { d: 8, h: 9, tipo: "transfer_in", monto: 120, contraparte: "María Qui*", canal: "yape_push", fuente: "yape_push", medio: "Yape", asunto: "Yape! María Qui* te envió un pago" },
  { d: 10, h: 14, tipo: "internal_transfer", monto: 500, comercio: "", contraparte: "", fuente: "bcp_email", medio: "Cuenta ****4455", asunto: "Realizaste una transferencia entre tus cuentas", flags: "" },
  { d: 11, h: 19, monto: 32.5, comercio: "LA LUCHA SANGUCHERIA", fuente: "bcp_email", medio: "Tarjeta de Débito ****1816", asunto: "Realizaste un consumo con tu Tarjeta de Débito BCP" },
  { d: 12, h: 11, monto: 6.5, contraparte: "Bodega Don Lucho", canal: "yape_p2p", fuente: "yape_push", medio: "Yape", asunto: "Confirmación de Yapeo", flags: "possible_yape_duplicate" },
  { d: 14, h: 8, monto: 89, comercio: "Luz del Sur", categoria: "Servicios", origen: "rule", canal: "yape_service", fuente: "yape_email", medio: "Yape", asunto: "Confirmación de Pago" },
  { d: 15, h: 13, monto: 15, comercio: "Menú El Rincón", categoria: "Comidas fuera", origen: "user", fuente: "manual", medio: "manual", asunto: "menú del almuerzo" },
  { d: 17, h: 22, monto: 55, contraparte: "Ana Luc*", canal: "yape_p2p", fuente: "yape_email", medio: "Yape", asunto: "Confirmación de Yapeo" },
  { d: 18, h: 10, tipo: "transfer_in", monto: 35, contraparte: "Juan Pér*", canal: "yape_push", fuente: "yape_push", medio: "Yape", asunto: "Yape! Juan Pér* te envió un pago" },
  { d: 20, h: 9, monto: 20, comercio: "Recarga Claro", categoria: "Servicios", origen: "rule", canal: "yape_topup", fuente: "yape_email", medio: "Yape", asunto: "Confirmación de Recarga" },
];

/** Extras solo en algunos meses para que las barras no sean planas. */
const EXTRAS: Record<number, Seed[]> = {
  0: [
    { d: 21, h: 12, monto: 150, comercio: "ZARA JOCKEY PLAZA", fuente: "bcp_email", medio: "Tarjeta de Débito ****1816", asunto: "Realizaste un consumo con tu Tarjeta de Débito BCP", flags: "date_from_header" },
    { d: 22, h: 19, monto: 8, contraparte: "Pedro Cas*", canal: "yape_p2p", fuente: "yape_push", medio: "Yape", asunto: "Confirmación de Yapeo" },
  ],
  1: [
    { d: 23, h: 15, monto: 420, comercio: "CLINICA INTERNACIONAL", categoria: "Salud", origen: "llm", fuente: "bcp_email", medio: "Tarjeta de Débito ****1816", asunto: "Realizaste un consumo con tu Tarjeta de Débito BCP" },
    { d: 24, h: 9, monto: 60, moneda: "USD", comercio: "UDEMY", categoria: "Educación", origen: "llm", fuente: "bcp_email", medio: "Tarjeta de Débito ****1816", asunto: "Realizaste un consumo con tu Tarjeta de Débito BCP" },
    { d: 25, h: 21, monto: 310, comercio: "TOTTUS", categoria: "Supermercado", origen: "cache", fuente: "bcp_email", medio: "Tarjeta de Débito ****1816", asunto: "Realizaste un consumo con tu Tarjeta de Débito BCP" },
  ],
  2: [
    { d: 26, h: 18, monto: 95, comercio: "PARDOS CHICKEN", categoria: "Comidas fuera", origen: "cache", fuente: "bcp_email", medio: "Tarjeta de Débito ****1816", asunto: "Realizaste un consumo con tu Tarjeta de Débito BCP" },
  ],
};

const pad = (n: number) => String(n).padStart(2, "0");

export const MOCK_EXEC_URL = "https://script.google.com/macros/s/AKfycbxMOCKmockMOCK/exec";
export const MOCK_TOKEN = "0f1e2d3c-4b5a-4697-8877-66554433aabb";

/** Movimientos como filas de `Movimientos` (con encabezado). */
export function buildMovimientos(now = new Date()): string[][] {
  const months = lastMonths(isoLima(now).slice(0, 7), 3); // [M-2, M-1, M]
  const today = isoLima(now).slice(0, 10);
  const rows: string[][] = [[...LEDGER_HEADERS]];
  let op = 176400;
  const todayDay = Number(today.slice(8, 10));
  months.forEach((m, mi) => {
    const seeds = [...MONTHLY, ...(EXTRAS[2 - mi] ?? [])];
    seeds.forEach((s, si) => {
      // En el mes en curso los días se comprimen entre el 1 y hoy: así siempre hay datos del mes, sin fechas futuras.
      const day = mi === 2 ? Math.max(1, Math.min(todayDay, Math.round(1 + ((s.d - 1) * (todayDay - 1)) / 27))) : s.d;
      const fecha = `${m}-${pad(day)}T${pad(s.h ?? 12)}:${pad((si * 7) % 60)}:00-05:00`;
      if (fecha.slice(0, 10) > today) return; // nada en el futuro
      const monto = Math.round((s.monto * (1 + ((mi - 1) * 0.04))) * 100) / 100;
      const fuente = s.fuente ?? "bcp_email";
      op++;
      const id = fuente === "manual" ? `manual:00000000-0000-4000-8000-${String(op).padStart(12, "0")}`
        : fuente === "yape_push" ? `push:${m}${pad(s.d)}-${op}`
        : fuente.startsWith("yape") ? `yape:${op}` : `bcp:${op}`;
      const r: Record<string, string> = {
        id, fecha, tipo: s.tipo ?? "expense", monto: String(monto), moneda: s.moneda ?? "PEN", tipo_cambio: s.tc ?? "",
        comercio: s.comercio ?? "", contraparte: s.contraparte ?? "",
        contraparte_key: s.contraparte ? `${s.contraparte}|${String(100 + ((op * 7) % 900))}` : "",
        categoria: s.categoria ?? "", categoria_origen: s.categoria ? (s.origen ?? "rule") : "",
        medio: s.medio ?? "", canal: s.canal ?? "", fuente, operacion: fuente === "manual" ? "" : String(op),
        gmail_id: fuente.endsWith("_email") ? `m-${op}` : "", flags: s.flags ?? "", asunto: s.asunto ?? "",
        creado_en: fecha,
      };
      rows.push(LEDGER_HEADERS.map((h) => r[h] ?? ""));
    });
  });
  return rows;
}

export function buildAjustes(o: { version?: string; iphone?: boolean; mcp?: boolean; execUrl?: string } = {}, now = new Date()): string[][] {
  const ago = (days: number) => isoLima(new Date(now.getTime() - days * 86400000));
  const rows: string[][] = [
    ["key", "value"],
    ["gmail.senders", "notificaciones@notificacionesbcp.com.pe, notificaciones@yape.pe"],
    ["gmail.batch", "40"],
    ["gmail.cursor", String(Math.floor(now.getTime() / 1000) - 900)],
    ["fx.usd_pen", "3.55"],
    ["llm.provider", "gemini"],
    ["llm.model", "gemini-2.5-flash"],
    ["import.since", ""],
    ["import.status", ""],
    ["scan.lastRunAt", ago(0.01)],
    ["scan.lastStats", JSON.stringify({ listed: 12, tx: 3, ignored: 9, unknown: 0 })],
  ];
  if (o.version !== "") rows.push(["luca.version", o.version ?? "4"]);
  const execUrl = o.execUrl ?? (o.iphone || o.mcp ? MOCK_EXEC_URL : "");
  rows.push(["conexiones.execUrl", execUrl]);
  if (o.iphone) {
    rows.push(
      ["conexiones.iphone", "1"],
      ["conexiones.iphone.token", MOCK_TOKEN],
      ["conexiones.iphone.device", "iPhone de Nombre"],
      ["conexiones.iphone.lastEventAt", ago(0.003)],
      ["conexiones.iphone.eventsCount", "37"],
      ["conexiones.iphone.lastError", ""],
      ["conexiones.iphone.lastTestAt", ago(12)],
      ["conexiones.iphone.schemaVersion", "1"],
      ["conexiones.iphone.execUrl", execUrl],
    );
  }
  if (o.mcp) {
    rows.push(
      ["conexiones.mcp", "1"],
      ["conexiones.mcp.client", "Claude"],
      ["conexiones.mcp.connectedAt", ago(20)],
      ["conexiones.mcp.lastCallAt", ago(1.2)],
      ["conexiones.mcp.callsCount", "58"],
    );
  }
  return rows;
}

export function buildCategorias(): string[][] {
  return [["nombre"], ...DEFAULT_CATEGORIAS.map((c) => [c])];
}

export function buildComercios(movs: string[][], now = new Date()): string[][] {
  const h = movs[0];
  const col = (n: string) => h.indexOf(n);
  const seen = new Map<string, string[]>();
  movs.slice(1).forEach((r) => {
    const name = r[col("comercio")];
    const cat = r[col("categoria")];
    if (!name || !cat || r[col("tipo")] !== "expense") return;
    const key = merchantKey(name);
    const prev = seen.get(key);
    if (prev) prev[4] = String(Number(prev[4]) + 1);
    else seen.set(key, [key, name, cat, r[col("categoria_origen")] || "rule", "1", isoLima(now)]);
  });
  return [[...COMERCIOS_HEADERS], ...seen.values()];
}

/** Sheet completa de un usuario que ya autorizó y conectó iPhone + IA. */
/**
 * `_TipoCambio` como la escribe el script (ADR-012): días hábiles de los últimos ~100 días con una venta que se
 * mueve poco, sin los 2 días más recientes (el BCRP publica con retraso). Determinista.
 */
export function buildTipoCambio(now = new Date()): string[][] {
  const rows: string[][] = [["fecha", "usd_compra", "usd_venta", "eur_venta", "fuente", "leido_en"]];
  for (let i = 100; i >= 2; i--) {
    const ymd = isoLima(new Date(now.getTime() - i * 86400000)).slice(0, 10);
    const dow = new Date(`${ymd}T12:00:00Z`).getUTCDay();
    if (dow === 0 || dow === 6) continue;
    const venta = Math.round((3.42 + 0.03 * Math.sin(i / 6)) * 1000) / 1000;
    rows.push([ymd, (venta - 0.007).toFixed(3), venta.toFixed(3), (venta * 1.12).toFixed(3), "bcrp", isoLima(now)]);
  }
  return rows;
}

export function buildFullSheet(now = new Date()): MockSheet {
  const movs = buildMovimientos(now);
  return { Movimientos: movs, Ajustes: buildAjustes({ iphone: true, mcp: true }, now), Categorías: buildCategorias(), Comercios: buildComercios(movs, now), _TipoCambio: buildTipoCambio(now) };
}

/** Sheet recién copiada de la plantilla: sin `Movimientos` ni `luca.version` (falta Autorizar). */
export function buildFreshSheet(): MockSheet {
  return { Ajustes: [["key", "value"], ["gmail.senders", "notificaciones@notificacionesbcp.com.pe, notificaciones@yape.pe"], ["gmail.batch", "40"]], Categorías: buildCategorias() };
}

/** Sheet autorizada con la Web App publicada pero sin iPhone ni IA (punto de partida del asistente "Conectar iPhone"). */
export function buildWebAppSheet(now = new Date()): MockSheet {
  const movs = buildMovimientos(now);
  return { Movimientos: movs, Ajustes: buildAjustes({ execUrl: MOCK_EXEC_URL }, now), Categorías: buildCategorias(), Comercios: buildComercios(movs, now), _TipoCambio: buildTipoCambio(now) };
}

/** Sheet autorizada pero sin conexiones (paso 3 pendiente). */
export function buildAuthorizedSheet(now = new Date()): MockSheet {
  const movs = buildMovimientos(now);
  return { Movimientos: movs, Ajustes: buildAjustes({}, now), Categorías: buildCategorias(), Comercios: buildComercios(movs, now), _TipoCambio: buildTipoCambio(now) };
}
