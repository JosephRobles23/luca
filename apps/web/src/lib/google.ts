/**
 * Llamadas a Google desde el NAVEGADOR con el token del usuario (scope drive.file).
 * Nada de esto pasa por nuestro servidor (ADR-006). Implementa `GoogleClient`.
 *
 * Errores: 401/403 → `GoogleApiError.needsReauth` (la UI pide volver a entrar);
 * 429/503 → reintento con backoff exponencial; el resto sube con el mensaje de Google.
 */
import { GoogleApiError, LUCA_APP_PROP, type CellWrite, type GoogleClient, type LedgerFile, type PickerOptions } from "./google-types.ts";
import { backoffDelay, planKeyValueUpsert } from "./sheets-ops.ts";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const RETRIES = 4;

async function gapi<T>(token: string, url: string, init: RequestInit = {}): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, {
      ...init,
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(init.headers ?? {}) },
    });
    const text = await res.text();
    let body: unknown = text;
    try { body = JSON.parse(text); } catch { /* texto plano */ }
    if (res.ok) return body as T;
    if ((res.status === 429 || res.status === 503) && attempt < RETRIES) {
      const retryAfter = Number(res.headers.get("Retry-After"));
      await sleep(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : backoffDelay(attempt));
      continue;
    }
    const msg = (body as { error?: { message?: string } })?.error?.message ?? text;
    throw new GoogleApiError(res.status, msg || `HTTP ${res.status}`);
  }
}

const enc = encodeURIComponent;
const DRIVE = "https://www.googleapis.com/drive/v3/files";
const SHEETS = "https://sheets.googleapis.com/v4/spreadsheets";
const FILE_FIELDS = "id,name,modifiedTime,webViewLink";

export class GoogleRealClient implements GoogleClient {
  readonly mode = "google" as const;
  constructor(private token: string, private picker: { apiKey: string; appId: string }) {}

  /** Busca las Sheets de Luca a las que la app tiene acceso (creadas por nosotros o elegidas en el Picker). */
  async findLedgerFiles(): Promise<LedgerFile[]> {
    const q = `appProperties has { key='${LUCA_APP_PROP.key}' and value='${LUCA_APP_PROP.value}' } and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false`;
    const url = `${DRIVE}?q=${enc(q)}&fields=${enc(`files(${FILE_FIELDS})`)}&orderBy=modifiedTime desc&pageSize=10`;
    const res = await gapi<{ files: LedgerFile[] }>(this.token, url);
    return res.files ?? [];
  }

  /** Copia la plantilla (que ya debe estar en alcance: elegida con el Picker) y la marca como ledger de Luca. */
  copyTemplate(templateId: string, name: string): Promise<LedgerFile> {
    return gapi<LedgerFile>(this.token, `${DRIVE}/${enc(templateId)}/copy?fields=${enc(FILE_FIELDS)}`, {
      method: "POST",
      body: JSON.stringify({ name, appProperties: { [LUCA_APP_PROP.key]: LUCA_APP_PROP.value } }),
    });
  }

  /** Marca una Sheet existente (elegida en el Picker) como ledger de Luca. */
  tagAsLedger(fileId: string): Promise<LedgerFile> {
    return gapi<LedgerFile>(this.token, `${DRIVE}/${enc(fileId)}?fields=${enc(FILE_FIELDS)}`, {
      method: "PATCH",
      body: JSON.stringify({ appProperties: { [LUCA_APP_PROP.key]: LUCA_APP_PROP.value } }),
    });
  }

  /** Lee un rango como matriz de strings. */
  async readRange(sheetId: string, range: string): Promise<string[][]> {
    const url = `${SHEETS}/${enc(sheetId)}/values/${enc(range)}?valueRenderOption=UNFORMATTED_VALUE&dateTimeRenderOption=FORMATTED_STRING`;
    const res = await gapi<{ values?: unknown[][] }>(this.token, url);
    return (res.values ?? []).map((r) => r.map((c) => (c == null ? "" : String(c))));
  }

  async updateCells(sheetId: string, writes: CellWrite[]): Promise<void> {
    if (!writes.length) return;
    await gapi(this.token, `${SHEETS}/${enc(sheetId)}/values:batchUpdate`, {
      method: "POST",
      body: JSON.stringify({ valueInputOption: "RAW", data: writes.map((w) => ({ range: w.range, majorDimension: "ROWS", values: w.values })) }),
    });
  }

  async appendRows(sheetId: string, tab: string, rows: string[][]): Promise<void> {
    if (!rows.length) return;
    const range = `'${tab.replace(/'/g, "''")}'!A1`;
    await gapi(this.token, `${SHEETS}/${enc(sheetId)}/values/${enc(range)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`, {
      method: "POST",
      body: JSON.stringify({ range, majorDimension: "ROWS", values: rows }),
    });
  }

  /** Upsert en una pestaña key/value: celdas existentes por batchUpdate, claves nuevas por append. Crea el encabezado si la pestaña está vacía. */
  async upsertKeyValue(sheetId: string, tab: string, updates: Record<string, string>): Promise<void> {
    let rows: string[][] = [];
    try { rows = await this.readRange(sheetId, `${tab}!A:B`); } catch (e) {
      if (!(e instanceof GoogleApiError && e.missingRange)) throw e;
      await this.addTab(sheetId, tab);
    }
    const plan = planKeyValueUpsert(tab, rows, updates);
    const appends = rows.length ? plan.appends : [["key", "value"], ...plan.appends];
    await this.updateCells(sheetId, plan.updates);
    await this.appendRows(sheetId, tab, appends);
  }

  private async addTab(sheetId: string, title: string): Promise<void> {
    await gapi(this.token, `${SHEETS}/${enc(sheetId)}:batchUpdate`, {
      method: "POST",
      body: JSON.stringify({ requests: [{ addSheet: { properties: { title } } }] }),
    });
  }

  /** Abre el Picker de Sheets y devuelve el archivo elegido (o null si cancela). Elegirlo lo mete en alcance de drive.file. */
  async pickSpreadsheet(o: PickerOptions): Promise<{ id: string; name: string } | null> {
    if (!this.picker.apiKey || !this.picker.appId) {
      throw new Error("Falta configurar NEXT_PUBLIC_GOOGLE_PICKER_KEY / NEXT_PUBLIC_GOOGLE_APP_ID");
    }
    await loadPicker();
    const g = window.google;
    const token = this.token, picker = this.picker;
    return new Promise((resolve) => {
      const view = new g.picker.DocsView(g.picker.ViewId.SPREADSHEETS).setIncludeFolders(false).setMode(g.picker.DocsViewMode.LIST);
      if (o.parentId) view.setParent(o.parentId);
      new g.picker.PickerBuilder()
        .setTitle(o.title)
        .setAppId(picker.appId)
        .setOAuthToken(token)
        .setDeveloperKey(picker.apiKey)
        .addView(view)
        .setCallback((data: { action: string; docs?: { id: string; name: string }[] }) => {
          if (data.action === g.picker.Action.PICKED && data.docs?.[0]) resolve({ id: data.docs[0].id, name: data.docs[0].name });
          else if (data.action === g.picker.Action.CANCEL) resolve(null);
        })
        .build()
        .setVisible(true);
    });
  }
}

// --- Google Picker (carga perezosa del script) ---

declare global {
  interface Window { gapi?: any; google?: any } // eslint-disable-line @typescript-eslint/no-explicit-any
}

let pickerLoading: Promise<void> | null = null;
export function loadPicker(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("solo en navegador"));
  if (window.google?.picker) return Promise.resolve();
  if (!pickerLoading) {
    pickerLoading = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = "https://apis.google.com/js/api.js";
      s.onload = () => window.gapi.load("picker", { callback: resolve, onerror: reject });
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }
  return pickerLoading;
}
