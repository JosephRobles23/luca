/**
 * `GoogleClient` en memoria para `LUCA_MOCK=1` (desarrollo y e2e sin Google).
 * El estado vive en `localStorage` del navegador para sobrevivir recargas; se resembra con
 * `?mock=<escenario>` en la URL o borrando `luca.mock.*`.
 *
 * Escenarios: `full` (Sheet autorizada con iPhone + IA), `webapp` (Web App publicada, sin iPhone ni IA),
 * `authorized` (sin conexiones), `empty` (sin Sheet: onboarding desde cero; el Picker ofrece la plantilla o una
 * Sheet antigua). `?mock=iphone-test` no resiembra: programa una "prueba" del iPhone (ver `scheduleMockIphoneTest`).
 */
import { GoogleApiError, type CellWrite, type GoogleClient, type LedgerFile, type PickerOptions } from "./google-types.ts";
import { buildAuthorizedSheet, buildFreshSheet, buildFullSheet, buildWebAppSheet, type MockSheet } from "./fixtures.ts";
import { planKeyValueUpsert } from "./sheets-ops.ts";
import { isoLima } from "./ledger.ts";

export type MockScenario = "full" | "webapp" | "authorized" | "empty";
const SCENARIOS: MockScenario[] = ["full", "webapp", "authorized", "empty"];
const WRITES_KEY = "luca.mock.scriptWrites";
type ScriptWrite = { due: number; values: Record<string, string> };

/**
 * Simula escrituras del Apps Script en `Ajustes` (telemetría que la web solo lee): se aplican en la primera lectura
 * de `Ajustes` posterior a `due`. Lo usan el asistente en modo mock y los e2e.
 */
export function queueMockScriptWrite(values: Record<string, string>, delayMs = 0) {
  try {
    const q = JSON.parse(localStorage.getItem(WRITES_KEY) ?? "[]") as ScriptWrite[];
    q.push({ due: Date.now() + delayMs, values });
    localStorage.setItem(WRITES_KEY, JSON.stringify(q));
  } catch { /* sin storage */ }
}

/** Simula que la prueba manual del atajo "Luca – Captura Yape" llegó al script: `lastTestAt` nuevo + dispositivo, pasados `delayMs`. */
export function scheduleMockIphoneTest(delayMs = 3000) {
  queueMockScriptWrite({ "conexiones.iphone.lastTestAt": isoLima(new Date()), "conexiones.iphone.device": "iPhone de Nombre", "conexiones.iphone.schemaVersion": "1", "conexiones.iphone": "1" }, delayMs);
}

type MockFile = LedgerFile & { tagged: boolean; pickable: boolean; simulateAuthorize?: boolean; ledgerReads?: number };
type Store = { scenario: MockScenario; files: MockFile[]; sheets: Record<string, MockSheet> };

const KEY = "luca.mock.store";
const SCENARIO_KEY = "luca.mock.scenario";
const LATENCY = 120;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const url = (id: string) => `https://docs.google.com/spreadsheets/d/${id}/edit`;

function seed(scenario: MockScenario): Store {
  const now = new Date();
  const modifiedTime = now.toISOString();
  const template: MockFile = { id: "tpl-luca", name: "Luca — Plantilla", modifiedTime, webViewLink: url("tpl-luca"), tagged: false, pickable: true };
  if (scenario === "empty") {
    return {
      scenario,
      files: [template, { id: "sheet-antigua", name: "Luca Ledger — Nombre (anterior)", modifiedTime, webViewLink: url("sheet-antigua"), tagged: false, pickable: true }],
      sheets: { "tpl-luca": buildFreshSheet(), "sheet-antigua": buildAuthorizedSheet(now) },
    };
  }
  const main: MockFile = { id: "sheet-mock-1", name: "Luca Ledger — Nombre Apellido", modifiedTime, webViewLink: url("sheet-mock-1"), tagged: true, pickable: true };
  const sheet = scenario === "full" ? buildFullSheet(now) : scenario === "webapp" ? buildWebAppSheet(now) : buildAuthorizedSheet(now);
  return { scenario, files: [template, main], sheets: { "tpl-luca": buildFreshSheet(), "sheet-mock-1": sheet } };
}

function scenarioFromUrl(): MockScenario | null {
  if (typeof window === "undefined") return null;
  const v = new URLSearchParams(window.location.search).get("mock");
  if (v === "iphone-test") scheduleMockIphoneTest();
  return v && (SCENARIOS as string[]).includes(v) ? (v as MockScenario) : null;
}

export class GoogleMockClient implements GoogleClient {
  readonly mode = "mock" as const;
  private store: Store;

  constructor() {
    const fromUrl = scenarioFromUrl();
    let wanted: MockScenario = "full";
    try { wanted = (fromUrl ?? (localStorage.getItem(SCENARIO_KEY) as MockScenario | null) ?? "full"); } catch { /* sin storage */ }
    if (!SCENARIOS.includes(wanted)) wanted = "full";
    let saved: Store | null = null;
    try { const raw = localStorage.getItem(KEY); saved = raw ? (JSON.parse(raw) as Store) : null; } catch { saved = null; }
    if (fromUrl || !saved || saved.scenario !== wanted) {
      this.store = seed(wanted);
      try { localStorage.removeItem("luca.sheetId"); localStorage.removeItem("luca.onboarding.skipConnections"); } catch { /* sin storage */ }
    } else this.store = saved;
    try { localStorage.setItem(SCENARIO_KEY, wanted); } catch { /* sin storage */ }
    this.save();
  }

  private save() { try { localStorage.setItem(KEY, JSON.stringify(this.store)); } catch { /* sin storage */ } }
  private file(id: string): MockFile {
    const f = this.store.files.find((x) => x.id === id);
    if (!f) throw new GoogleApiError(404, `File not found: ${id}`);
    return f;
  }
  private strip(f: MockFile): LedgerFile { return { id: f.id, name: f.name, modifiedTime: f.modifiedTime, webViewLink: f.webViewLink }; }
  private tab(range: string): { tab: string; cols: [number, number] | null } {
    const m = /^'?([^'!]+)'?!([A-Z]+)(\d*)(?::([A-Z]+)(\d*))?$/.exec(range);
    if (!m) return { tab: range, cols: null };
    const idx = (s: string) => s.split("").reduce((n, ch) => n * 26 + (ch.charCodeAt(0) - 64), 0) - 1;
    return { tab: m[1], cols: [idx(m[2]), m[4] ? idx(m[4]) : idx(m[2])] };
  }

  async findLedgerFiles(): Promise<LedgerFile[]> {
    await sleep(LATENCY);
    return this.store.files.filter((f) => f.tagged).map((f) => this.strip(f));
  }

  async copyTemplate(templateId: string, name: string): Promise<LedgerFile> {
    await sleep(LATENCY * 3);
    this.file(templateId);
    const id = `sheet-copia-${this.store.files.length}`;
    const f: MockFile = { id, name, modifiedTime: new Date().toISOString(), webViewLink: url(id), tagged: true, pickable: true, simulateAuthorize: true, ledgerReads: 0 };
    this.store.files.push(f);
    this.store.sheets[id] = buildFreshSheet();
    this.save();
    return this.strip(f);
  }

  async tagAsLedger(fileId: string): Promise<LedgerFile> {
    await sleep(LATENCY);
    const f = this.file(fileId);
    f.tagged = true;
    this.save();
    return this.strip(f);
  }

  /** Picker simulado: la plantilla si el título la pide; si no, la primera Sheet elegible que no sea la plantilla. */
  async pickSpreadsheet(o: PickerOptions): Promise<{ id: string; name: string } | null> {
    await sleep(LATENCY * 2);
    const wantsTemplate = /plantilla/i.test(o.title);
    const f = this.store.files.find((x) => x.pickable && (wantsTemplate ? x.id === "tpl-luca" : x.id !== "tpl-luca" && !x.tagged))
      ?? this.store.files.find((x) => x.pickable && !wantsTemplate && x.id !== "tpl-luca");
    return f ? { id: f.id, name: f.name } : null;
  }

  async readRange(sheetId: string, range: string): Promise<string[][]> {
    await sleep(LATENCY);
    const f = this.file(sheetId);
    const { tab, cols } = this.tab(range);
    const sheet = this.store.sheets[sheetId] ?? (this.store.sheets[sheetId] = {});
    if (!sheet[tab] && tab === "Movimientos" && f.simulateAuthorize) {
      // Simula al usuario autorizando en el Sheet: la 2.ª lectura (tras "Ya autoricé → Actualizar") ya trae datos.
      f.ledgerReads = (f.ledgerReads ?? 0) + 1;
      if (f.ledgerReads >= 2) { Object.assign(sheet, buildAuthorizedSheet()); f.simulateAuthorize = false; }
      this.save();
    }
    if (tab === "Ajustes" && sheet[tab]) this.applyScriptWrites(sheet[tab]);
    const rows = sheet[tab];
    if (!rows) throw new GoogleApiError(400, `Unable to parse range: ${range}`);
    if (!cols) return rows.map((r) => [...r]);
    return rows.map((r) => r.slice(cols[0], cols[1] + 1));
  }

  /** Aplica las escrituras "del script" ya vencidas (`queueMockScriptWrite`) sobre las filas de `Ajustes`. */
  private applyScriptWrites(rows: string[][]) {
    let q: ScriptWrite[] = [];
    try { q = JSON.parse(localStorage.getItem(WRITES_KEY) ?? "[]") as ScriptWrite[]; } catch { return; }
    const now = Date.now();
    const due = q.filter((w) => w.due <= now);
    if (!due.length) return;
    for (const w of due) for (const [k, v] of Object.entries(w.values)) {
      const r = rows.find((x) => x[0] === k);
      if (r) r[1] = v; else rows.push([k, v]);
    }
    try { localStorage.setItem(WRITES_KEY, JSON.stringify(q.filter((w) => w.due > now))); } catch { /* sin storage */ }
    this.save();
  }

  async updateCells(sheetId: string, writes: CellWrite[]): Promise<void> {
    await sleep(LATENCY);
    const sheet = this.store.sheets[sheetId] ?? (this.store.sheets[sheetId] = {});
    for (const w of writes) {
      const m = /^'?([^'!]+)'?!([A-Z]+)(\d+)/.exec(w.range);
      if (!m) throw new GoogleApiError(400, `Unable to parse range: ${w.range}`);
      const rows = sheet[m[1]];
      if (!rows) throw new GoogleApiError(400, `Unable to parse range: ${w.range}`);
      const col = this.tab(w.range).cols![0];
      const row0 = Number(m[3]) - 1;
      w.values.forEach((vals, dr) => {
        while (rows.length <= row0 + dr) rows.push([]);
        vals.forEach((v, dc) => { const r = rows[row0 + dr]; while (r.length <= col + dc) r.push(""); r[col + dc] = v; });
      });
    }
    this.save();
  }

  async appendRows(sheetId: string, tab: string, rows: string[][]): Promise<void> {
    await sleep(LATENCY);
    const sheet = this.store.sheets[sheetId] ?? (this.store.sheets[sheetId] = {});
    (sheet[tab] ?? (sheet[tab] = [])).push(...rows.map((r) => [...r]));
    this.save();
  }

  async upsertKeyValue(sheetId: string, tab: string, updates: Record<string, string>): Promise<void> {
    const sheet = this.store.sheets[sheetId] ?? (this.store.sheets[sheetId] = {});
    const rows = sheet[tab] ?? (sheet[tab] = [["key", "value"]]);
    const plan = planKeyValueUpsert(tab, rows, updates);
    await this.updateCells(sheetId, plan.updates);
    await this.appendRows(sheetId, tab, plan.appends);
  }
}
