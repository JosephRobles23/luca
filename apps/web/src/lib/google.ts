/**
 * Llamadas a Google desde el NAVEGADOR con el token del usuario (scope drive.file).
 * Nada de esto pasa por nuestro servidor.
 */

export const LUCA_APP_PROP = { key: "luca", value: "ledger" } as const;

export type LedgerFile = { id: string; name: string; modifiedTime: string; webViewLink?: string };

async function gapi<T>(token: string, url: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(init.headers ?? {}) },
  });
  const text = await res.text();
  let body: unknown = text;
  try { body = JSON.parse(text); } catch { /* texto plano */ }
  if (!res.ok) {
    const msg = (body as { error?: { message?: string } })?.error?.message ?? text;
    throw new GoogleApiError(res.status, msg);
  }
  return body as T;
}

export class GoogleApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

/** Busca las Sheets de Luca a las que la app tiene acceso (creadas por nosotros o elegidas en el Picker). */
export async function findLedgerFiles(token: string): Promise<LedgerFile[]> {
  const q = `appProperties has { key='${LUCA_APP_PROP.key}' and value='${LUCA_APP_PROP.value}' } and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false`;
  const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=${encodeURIComponent("files(id,name,modifiedTime,webViewLink)")}&orderBy=modifiedTime desc&pageSize=10`;
  const res = await gapi<{ files: LedgerFile[] }>(token, url);
  return res.files ?? [];
}

/** Copia la plantilla (que ya debe estar en alcance: elegida con el Picker) y la marca como ledger de Luca. */
export async function copyTemplate(token: string, templateId: string, name: string): Promise<LedgerFile> {
  const url = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(templateId)}/copy?fields=${encodeURIComponent("id,name,modifiedTime,webViewLink")}`;
  return gapi<LedgerFile>(token, url, {
    method: "POST",
    body: JSON.stringify({ name, appProperties: { [LUCA_APP_PROP.key]: LUCA_APP_PROP.value } }),
  });
}

/** Marca una Sheet existente (elegida en el Picker) como ledger de Luca. */
export async function tagAsLedger(token: string, fileId: string): Promise<LedgerFile> {
  const url = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?fields=${encodeURIComponent("id,name,modifiedTime,webViewLink")}`;
  return gapi<LedgerFile>(token, url, {
    method: "PATCH",
    body: JSON.stringify({ appProperties: { [LUCA_APP_PROP.key]: LUCA_APP_PROP.value } }),
  });
}

/** Lee un rango como matriz de strings. */
export async function readRange(token: string, sheetId: string, range: string): Promise<string[][]> {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(sheetId)}/values/${encodeURIComponent(range)}?valueRenderOption=UNFORMATTED_VALUE&dateTimeRenderOption=FORMATTED_STRING`;
  const res = await gapi<{ values?: unknown[][] }>(token, url);
  return (res.values ?? []).map((r) => r.map((c) => (c == null ? "" : String(c))));
}

/** Escribe pares key/value en la pestaña Ajustes (upsert simple: lee, ajusta, reescribe). */
export async function writeAjustes(token: string, sheetId: string, updates: Record<string, string>): Promise<void> {
  const rows = await readRange(token, sheetId, "Ajustes!A:B").catch(() => [["key", "value"]]);
  const map = new Map<string, string>();
  rows.slice(1).forEach(([k, v]) => { if (k) map.set(k, v ?? ""); });
  Object.entries(updates).forEach(([k, v]) => map.set(k, v));
  const values = [["key", "value"], ...Array.from(map.entries())];
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(sheetId)}/values/${encodeURIComponent("Ajustes!A1")}?valueInputOption=RAW`;
  await gapi(token, url, { method: "PUT", body: JSON.stringify({ range: "Ajustes!A1", majorDimension: "ROWS", values }) });
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

export type PickerOptions = { token: string; apiKey: string; appId: string; title: string; viewId?: string };

/** Abre el Picker de Sheets y devuelve el archivo elegido (o null si cancela). Elegirlo lo mete en alcance de drive.file. */
export async function pickSpreadsheet(o: PickerOptions): Promise<{ id: string; name: string } | null> {
  await loadPicker();
  const g = window.google;
  return new Promise((resolve) => {
    const view = new g.picker.DocsView(g.picker.ViewId.SPREADSHEETS).setIncludeFolders(false).setMode(g.picker.DocsViewMode.LIST);
    new g.picker.PickerBuilder()
      .setTitle(o.title)
      .setAppId(o.appId)
      .setOAuthToken(o.token)
      .setDeveloperKey(o.apiKey)
      .addView(view)
      .setCallback((data: { action: string; docs?: { id: string; name: string }[] }) => {
        if (data.action === g.picker.Action.PICKED && data.docs?.[0]) resolve({ id: data.docs[0].id, name: data.docs[0].name });
        else if (data.action === g.picker.Action.CANCEL) resolve(null);
      })
      .build()
      .setVisible(true);
  });
}
