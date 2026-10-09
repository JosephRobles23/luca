/**
 * Contrato del acceso a Google desde el navegador (tipos, error y pestañas). Sin dependencias.
 */
export const LUCA_APP_PROP = { key: "luca", value: "ledger" } as const;

export type LedgerFile = { id: string; name: string; modifiedTime: string; webViewLink?: string };
export type CellWrite = { range: string; values: string[][] };
/**
 * `parentId`: abre el selector dentro de esa carpeta (la carpeta "LUCA" con la plantilla).
 * `query`: búsqueda inicial. `ownedByMe`: solo archivos del usuario. `intent`: para qué se abre (lo usa el mock
 * para simular la copia hecha con "Copiar a mi Drive"; el Picker real lo ignora).
 */
export type PickerOptions = { title: string; parentId?: string; query?: string; ownedByMe?: boolean; intent?: "copia" };

export class GoogleApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "GoogleApiError";
    this.status = status;
  }
  /** 401/403: sesión caducada o permiso revocado → volver a entrar. */
  get needsReauth() { return this.status === 401 || this.status === 403; }
  /** 400 "Unable to parse range": la pestaña no existe todavía. */
  get missingRange() { return this.status === 400 && /Unable to parse range/i.test(this.message); }
}

export interface GoogleClient {
  readonly mode: "google" | "mock";
  findLedgerFiles(): Promise<LedgerFile[]>;
  copyTemplate(templateId: string, name: string): Promise<LedgerFile>;
  tagAsLedger(fileId: string): Promise<LedgerFile>;
  pickSpreadsheet(o: PickerOptions): Promise<{ id: string; name: string } | null>;
  /** Matriz de strings; lanza GoogleApiError(400, "Unable to parse range…") si la pestaña no existe. */
  readRange(sheetId: string, range: string): Promise<string[][]>;
  /** `values:batchUpdate` con RAW. */
  updateCells(sheetId: string, writes: CellWrite[]): Promise<void>;
  /** `values:append` al final de la pestaña. */
  appendRows(sheetId: string, tab: string, rows: string[][]): Promise<void>;
  /** Upsert key/value en una pestaña de 2 columnas (p. ej. `Ajustes`). */
  upsertKeyValue(sheetId: string, tab: string, updates: Record<string, string>): Promise<void>;
}

/** Rango que lee la web de cada pestaña. */
export const TABS = { ledger: "Movimientos", settings: "Ajustes", categories: "Categorías", merchants: "Comercios", fx: "_TipoCambio" } as const;
export const RANGES = {
  ledger: `${TABS.ledger}!A:S`,
  settings: `${TABS.settings}!A:B`,
  categories: `${TABS.categories}!A:A`,
  merchants: `${TABS.merchants}!A:F`,
  fx: `${TABS.fx}!A:F`,
} as const;
