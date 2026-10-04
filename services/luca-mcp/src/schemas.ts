/**
 * schemas.ts — Módulo PURO (solo zod): formas de entrada de las tools v0 y helpers de validación.
 * Sin dependencias de Workers ni de `agents`, para poder testearlo con `node --test`.
 *
 * Cada tool del Worker se mapea 1:1 a una op de `mcpAction` (gas/shared/mcp-runtime.js). La
 * validación de negocio (dedupe, categorías, moneda) vive en GAS; aquí solo se da forma a lo que
 * el modelo envía para que llegue limpio.
 */
import { z } from 'zod';

/** "YYYY-MM" */
export const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
/** "YYYY-MM-DD" */
export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
/** "YYYY-MM-DD" o ISO 8601 con hora (con o sin offset). */
export const DATE_OR_ISO_RE = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2})?([+-]\d{2}:\d{2}|Z)?)?$/;

export const TIPOS = ['expense', 'income', 'transfer_in', 'internal_transfer'] as const;
export const MONEDAS = ['PEN', 'USD'] as const;

export const DEFAULT_LIST_LIMIT = 50;
export const MAX_LIST_LIMIT = 200;
export const MAX_TOP_MERCHANTS = 50;

const month = z.string().regex(MONTH_RE, 'Formato YYYY-MM');

/** Zod *raw shapes* (objetos de campos), como espera `registerTool({ inputSchema })`. */
export const toolShapes = {
  get_summary: { month },
  category_breakdown: { month },
  top_merchants: { month, limit: z.number().int().positive().max(MAX_TOP_MERCHANTS).optional() },
  list_transactions: {
    month: month.optional(),
    from: z.string().regex(DATE_RE, 'Formato YYYY-MM-DD').optional(),
    to: z.string().regex(DATE_RE, 'Formato YYYY-MM-DD').optional(),
    tipo: z.enum(TIPOS).optional(),
    categoria: z.string().min(1).optional(),
    texto: z.string().min(1).optional(),
    limit: z.number().int().positive().max(MAX_LIST_LIMIT).optional()
  },
  budget_status: { month },
  add_expense: {
    monto: z.number().positive(),
    moneda: z.enum(MONEDAS).optional(),
    fecha: z.string().regex(DATE_OR_ISO_RE, 'Formato YYYY-MM-DD o ISO 8601'),
    comercio: z.string().min(1).optional(),
    contraparte: z.string().min(1).optional(),
    categoria: z.string().min(1).optional(),
    nota: z.string().optional(),
    force: z.boolean().optional()
  }
} as const;

export type ToolName = keyof typeof toolShapes;
export const TOOL_NAMES = Object.keys(toolShapes) as ToolName[];

/** Objetos zod completos (para validar en tests o fuera del McpServer). */
export const toolSchemas = Object.fromEntries(
  TOOL_NAMES.map((n) => [n, z.object(toolShapes[n])])
) as { [K in ToolName]: z.ZodObject<(typeof toolShapes)[K]> };

/** Descripciones que ve el modelo. Separadas para poder revisarlas sin tocar el wiring. */
export const toolDescriptions: Record<ToolName, string> = {
  get_summary: 'Resumen de un mes (YYYY-MM): gastos, ingresos, recibido por Yape (aparte, no es ingreso), neto, ' +
    'gasto por categoría, top comercios, últimos 6 meses y cuántos movimientos faltan categorizar. Montos en PEN ' +
    '(USD convertido con el tipo de cambio del correo o el de Ajustes).',
  category_breakdown: 'Gasto de un mes (YYYY-MM) por categoría: monto, porcentaje y nº de movimientos. "Sin categoría" agrupa lo pendiente.',
  top_merchants: 'Comercios/contrapartes donde más se gastó en un mes (YYYY-MM), ordenados por monto. limit por defecto 10.',
  list_transactions: 'Lista movimientos filtrando por mes (YYYY-MM) o rango from/to (YYYY-MM-DD), tipo, categoría o texto libre ' +
    '(comercio, contraparte, categoría). Más recientes primero; limit por defecto 50, máximo 200.',
  budget_status: 'Estado del presupuesto del mes. En v0 responde {available:false}: los presupuestos llegan en v1.',
  add_expense: 'Registra un gasto manual en la hoja del usuario. monto > 0, moneda PEN (defecto) o USD, fecha YYYY-MM-DD o ISO con hora. ' +
    'Si ya existe un movimiento con el mismo monto, moneda y minuto (o día si no diste hora) devuelve {duplicate:true, similar} ' +
    'sin escribir; confirma con el usuario y reenvía con force:true para registrarlo igual. Pide confirmación antes de llamar.'
};

/** URL de Web App de Apps Script (/exec). Misma regla que usa /enroll. */
export function isExecUrl(url: string): boolean {
  return /^https:\/\/script\.google\.com\/[^?#]*\/exec$/i.test(String(url || ''));
}
