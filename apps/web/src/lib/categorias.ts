/**
 * Presentación de categorías: color estable por categoría, las más usadas (chips de categorización rápida)
 * y sugerencia por comercio o persona ya categorizados. Lógica pura, sin React (DESIGN.md §Colors).
 */
import { txLabel, type Tx } from "./ledger.ts";

/** Variables CSS de los pasteles de categoría (globals.css). */
export const CAT_PALETTE = ["--cat-peach", "--cat-mint", "--cat-blue", "--cat-lavender", "--cat-gold", "--cat-rose", "--cat-sand", "--cat-teal"] as const;

/** Color fijo para la taxonomía por defecto (DEFAULT_CATEGORIAS); las demás caen al hash. */
const FIXED: Record<string, (typeof CAT_PALETTE)[number]> = {
  Vivienda: "--cat-sand", Supermercado: "--cat-mint", "Comidas fuera": "--cat-peach", Transporte: "--cat-teal",
  Servicios: "--cat-gold", Suscripciones: "--cat-lavender", Salud: "--cat-rose", "Educación": "--cat-blue",
  Ropa: "--cat-rose", Ocio: "--cat-peach", Transferencias: "--cat-blue", Otros: "--cat-sand", Ingreso: "--cat-mint",
};

const hash = (s: string) => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h); };

/** Nombre de la variable CSS del color de una categoría ("" o "Sin categoría" → --cat-none). */
export function catVar(categoria: string): string {
  if (!categoria || categoria === "Sin categoría") return "--cat-none";
  return FIXED[categoria] ?? CAT_PALETTE[hash(categoria) % CAT_PALETTE.length];
}

/** `var(--cat-…)` listo para `style`. */
export const catColor = (categoria: string) => `var(${catVar(categoria)})`;

/** Inicial para el avatar de un movimiento. */
export function txInitial(tx: Tx): string {
  if (tx.tipo === "internal_transfer") return "⇄";
  const s = txLabel(tx).replace(/^[^A-Za-zÁÉÍÓÚÑáéíóúñ0-9]+/, "");
  return (s[0] ?? "·").toUpperCase();
}

/**
 * Las `n` categorías más usadas en los movimientos categorizados (gastos e ingresos), en orden de uso.
 * Solo incluye categorías vigentes; si faltan, completa con las primeras de la lista del usuario.
 */
export function topCategories(txs: Tx[], categorias: string[], n = 4): string[] {
  const valid = new Set(categorias);
  const count = new Map<string, number>();
  txs.forEach((t) => { if (t.categoria && valid.has(t.categoria) && t.categoria !== "Ingreso") count.set(t.categoria, (count.get(t.categoria) ?? 0) + 1); });
  const ranked = Array.from(count).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([c]) => c);
  for (const c of categorias) { if (ranked.length >= n) break; if (c !== "Ingreso" && !ranked.includes(c)) ranked.push(c); }
  return ranked.slice(0, n);
}

/** Movimiento con una persona (Yape P2P, transferencia): contraparte sin comercio. */
export const isPersonTx = (tx: Tx) => !tx.comercio && !!(tx.contraparte || tx.contraparteKey);

/**
 * Chips de categorización rápida: las `n` más usadas, con la sugerencia por comercio/persona delante y, si la
 * contraparte es una persona, Transferencias (si sigue en la lista del usuario). El resto va en "+N más".
 */
export function quickCategories(txs: Tx[], categorias: string[], ctx: { persona?: boolean; suggestion?: string | null }, n = 4): string[] {
  let top = topCategories(txs, categorias, n);
  const lead = (c: string) => { if (!top.includes(c)) top = [c, ...top.slice(0, n - 1)]; };
  if (ctx.persona && categorias.includes("Transferencias")) lead("Transferencias");
  if (ctx.suggestion) lead(ctx.suggestion);
  return top;
}

/**
 * Categoría sugerida para un pendiente: la más reciente asignada a otro movimiento del mismo comercio
 * o de la misma persona (`contraparte_key`, si no el nombre). Sin coincidencias → null. Sin LLM (ADR-004).
 */
export function suggestCategory(tx: Tx, txs: Tx[]): string | null {
  const key = (t: Tx) => (t.comercio ? `c:${t.comercio.trim().toLowerCase()}` : t.contraparteKey ? `k:${t.contraparteKey}` : t.contraparte ? `p:${t.contraparte.trim().toLowerCase()}` : "");
  const k = key(tx);
  if (!k) return null;
  const hit = txs.filter((t) => t.id !== tx.id && t.categoria && key(t) === k).sort((a, b) => (a.fecha < b.fecha ? 1 : -1))[0];
  return hit ? hit.categoria : null;
}

/** Icono fijo para la taxonomía por defecto; mismo mapa que ICONO_CATEGORIA_ en gas/shared/_Ui.html. */
const ICON_BY_CAT: Record<string, string> = {
  Vivienda: "casa", Supermercado: "carrito", "Comidas fuera": "cubiertos", Transporte: "bus", Servicios: "rayo",
  Suscripciones: "repetir", Salud: "salud", "Educación": "birrete", Ropa: "camisa", Ocio: "ticket",
  Transferencias: "flechas", Otros: "etiqueta", Ingreso: "billetera", "Sin categoría": "duda",
};

/** Palabras clave (sin acentos, minúsculas) → icono para categorías propias; la primera que coincide gana (ICONO_PALABRAS_). */
const ICON_WORDS: [RegExp, string][] = [
  [/mascota|perro|gato|veterin/, "huella"], [/viaje|vuelo|hotel|vacacion/, "avion"], [/regalo|cumple/, "regalo"],
  [/gym|gimnasio|deporte|fitness/, "pesa"], [/cafe/, "cafe"], [/auto|carro|gasolina|combustible|grifo|peaje|estacionamiento/, "auto"],
  [/banco|comision|interes|prestamo|deuda|tarjeta/, "banco"], [/bebe|hijo|nino|colegio/, "bebe"], [/tecnolog|electron|gadget/, "laptop"],
  [/ahorro|inversion/, "hucha"], [/impuesto|sunat|tramite|multa/, "recibo"], [/seguro/, "escudo"], [/belleza|peluquer|barber|spa/, "tijeras"],
  [/casa|hogar|alquiler|depa/, "casa"], [/comida|restaurant|delivery|almuerzo/, "cubiertos"], [/mercado|bodega|abarrote/, "carrito"],
  [/taxi|uber|movilidad|bus/, "bus"], [/luz|agua|internet|celular|telefon|gas/, "rayo"], [/suscrip|streaming|netflix|spotify/, "repetir"],
  [/salud|farmacia|medic|clinica|doctor/, "salud"], [/curso|estudio|libro|universidad|educa/, "birrete"], [/ropa|zapat|calzado/, "camisa"],
  [/ocio|cine|salida|fiesta|concierto/, "ticket"], [/transfer/, "flechas"], [/sueldo|ingreso|salario/, "billetera"],
];

/**
 * Clave del icono de una categoría o de un movimiento (transferencia propia, yapeo recibido, ingreso sin
 * categoría). Paridad con claveIconoCategoria/iconoCategoria del Dashboard de la Sheet.
 */
export function catIconKey(categoria: string, tipo?: string): string {
  if (tipo === "internal_transfer") return "flechas";
  if (tipo === "transfer_in" && !categoria) return "recibir";
  if (tipo === "income" && !categoria) return "billetera";
  if (!categoria) return "duda";
  if (ICON_BY_CAT[categoria]) return ICON_BY_CAT[categoria];
  const n = categoria.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  return ICON_WORDS.find(([re]) => re.test(n))?.[1] ?? "etiqueta";
}
