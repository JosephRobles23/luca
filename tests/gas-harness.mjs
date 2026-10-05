/**
 * gas-harness.mjs — Carga los runtimes de gas/shared/ en un contexto vm de Node con los globales
 * de Apps Script mockeados. Adaptado de CoS-Agent (tests/gas-harness.mjs).
 *
 * Los runtimes usan namespace global (var/function): al ejecutarlos con vm.runInContext quedan
 * como propiedades del sandbox (h.api).
 *
 *   const h = makeHarness({ spreadsheets: { SID: { Movimientos: [...] } }, gmailMessages: [...] });
 *   h.api.parseEmail(email);
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SHARED = path.join(HERE, '..', 'gas', 'shared');

export const RUNTIME_FILES = [
  'sheets-runtime.js',
  'settings-runtime.js',
  'estilo-hojas-runtime.js',
  'secrets-runtime.js',
  'iphone-runtime.js',
  'llm-runtime.js',
  'email-parsers-runtime.js',
  'push-parsers-runtime.js',
  'categorize-runtime.js',
  'llm-extract-runtime.js',
  'ledger-runtime.js',
  'mime-runtime.js',
  'gmail-scan-runtime.js',
  'webapp-runtime.js',
  'ui-runtime.js',
  'mcp-runtime.js'
];

let sheetIdSeq = 1;

function makeRange(data, row, col, nr, nc, est) {
  const reg = (op, arg) => { if (est) est.ops.push({ op, row, col, nr, nc, arg }); return range; };
  const range = {
    getValues() {
      const out = [];
      for (let r = 0; r < nr; r++) {
        const rowArr = [];
        const src = data[row - 1 + r] || [];
        for (let c = 0; c < nc; c++) { const v = src[col - 1 + c]; rowArr.push(v === undefined ? '' : v); }
        out.push(rowArr);
      }
      return out;
    },
    getValue() { return range.getValues()[0][0]; },
    setValue(v) { if (!data[row - 1]) data[row - 1] = []; data[row - 1][col - 1] = v; return range; },
    setValues(values) {
      for (let r = 0; r < values.length; r++) {
        if (!data[row - 1 + r]) data[row - 1 + r] = [];
        for (let c = 0; c < values[r].length; c++) data[row - 1 + r][col - 1 + c] = values[r][c];
      }
      return range;
    },
    setNumberFormat: (f) => reg('numberFormat', f),
    setFontWeight: (w) => reg('fontWeight', w),
    setBackground: (c) => reg('background', c),
    setFontFamily: (f) => reg('fontFamily', f),
    setFontColor: (c) => reg('fontColor', c),
    setVerticalAlignment: (a) => reg('vAlign', a),
    setHorizontalAlignment: (a) => reg('hAlign', a),
    setWrapStrategy: (w) => reg('wrap', w),
    setBorder: (...a) => reg('border', a),
    shiftColumnGroupDepth: (d) => { for (let c = col; c < col + nc; c++) est.groups[c] = (est.groups[c] || 0) + d; return range; },
    applyRowBanding: (theme) => {
      const b = { theme, row, col, nr, nc, colors: {}, remove: () => { est.bandings.splice(est.bandings.indexOf(b), 1); } };
      b.setHeaderRowColor = (c) => { b.colors.header = c; return b; };
      b.setFirstRowColor = (c) => { b.colors.first = c; return b; };
      b.setSecondRowColor = (c) => { b.colors.second = c; return b; };
      est.bandings.push(b);
      return b;
    }
  };
  return range;
}

function makeSheet(name, data) {
  const id = sheetIdSeq++;
  let _name = name;
  const numRows = () => data.length;
  const numCols = () => data.reduce((m, r) => Math.max(m, (r && r.length) || 0), 0);
  // Estilo aplicado (estilo-hojas-runtime.js), para que los tests lo inspeccionen.
  const est = { ops: [], widths: {}, groups: {}, collapsed: [], bandings: [], rules: [], tabColor: null, rowHeights: {}, hiddenGridlines: false, frozenRows: 0 };
  return {
    _estilo: est,
    _data: data,
    getName: () => _name,
    setName: (n) => { _name = n; },
    getSheetId: () => id,
    getLastRow: () => numRows(),
    getLastColumn: () => numCols(),
    getMaxRows: () => Math.max(numRows(), 2),
    getRange: (row, col, nr = 1, nc = 1) => makeRange(data, row, col, nr, nc, est),
    getDataRange: () => makeRange(data, 1, 1, Math.max(numRows(), 1), Math.max(numCols(), 1), est),
    setFrozenRows: (n) => { est.frozenRows = n; },
    setRowHeight: (r, px) => { est.rowHeights[r] = px; },
    setColumnWidth: (c, px) => { est.widths[c] = px; },
    setHiddenGridlines: (v) => { est.hiddenGridlines = v; },
    setTabColor: (c) => { est.tabColor = c; },
    getBandings: () => est.bandings.slice(),
    setConditionalFormatRules: (rules) => { est.rules = rules.slice(); },
    getConditionalFormatRules: () => est.rules.slice(),
    getColumnGroupDepth: (c) => est.groups[c] || 0,
    getColumnGroup: (c, depth) => ({ collapse: () => { est.collapsed.push(c); } }),
    clearContents: () => { data.length = 0; }
  };
}

function makeSpreadsheet(id, tabs) {
  const sheets = Object.keys(tabs).map((name) => makeSheet(name, tabs[name]));
  return {
    getId: () => id,
    getSheetByName: (n) => sheets.find((s) => s.getName() === n) || null,
    getSheets: () => sheets.slice(),
    insertSheet: (name) => { const s = makeSheet(name, []); sheets.push(s); return s; },
    getSpreadsheetTimeZone: () => 'America/Lima'
  };
}

/** Mock del servicio avanzado Gmail: recibe mensajes en formato de la API (format=full). */
function makeGmailMock(messages = []) {
  const calls = { list: [], get: [] };
  return {
    _calls: calls,
    _messages: messages,
    Users: {
      Messages: {
        list: (userId, params = {}) => {
          calls.list.push(params);
          const page = parseInt(params.pageToken || '0', 10);
          const size = params.maxResults || 100;
          const slice = messages.slice(page, page + size);
          const res = { messages: slice.map((m) => ({ id: m.id, threadId: m.threadId || m.id })) };
          if (page + size < messages.length) res.nextPageToken = String(page + size);
          return res;
        },
        get: (userId, id, params = {}) => {
          calls.get.push(id);
          const m = messages.find((x) => x.id === id);
          if (!m) throw new Error('Gmail mock: mensaje no encontrado ' + id);
          // format=raw: devuelve solo { id, internalDate, raw } como la API real.
          if (params.format === 'raw') return { id: m.id, threadId: m.threadId, internalDate: m.internalDate, raw: m.raw || '' };
          return m;
        }
      }
    }
  };
}

function propsStore(init) {
  const map = new Map(Object.entries(init || {}));
  return {
    _map: map,
    getProperty: (k) => (map.has(k) ? map.get(k) : null),
    setProperty: (k, v) => { map.set(k, String(v)); },
    deleteProperty: (k) => { map.delete(k); },
    getProperties: () => Object.fromEntries(map)
  };
}

export function makeHarness(opts = {}) {
  const state = {
    scriptProps: propsStore(opts.scriptProperties),
    userProps: propsStore(opts.userProperties),
    cache: new Map(),
    logs: [],
    fetchCalls: [],
    uiCalls: [],
    alerts: [],
    toasts: [],
    fetch: opts.fetch || (() => { throw new Error('UrlFetchApp.fetch no fue mockeado'); })
  };
  const byId = {};
  Object.keys(opts.spreadsheets || {}).forEach((sid) => { byId[sid] = makeSpreadsheet(sid, opts.spreadsheets[sid]); });
  const gmail = makeGmailMock(opts.gmailMessages || []);
  const now = opts.now || null;

  const sandbox = {
    console,
    Date,
    PropertiesService: {
      getScriptProperties: () => state.scriptProps,
      getUserProperties: () => state.userProps,
      getDocumentProperties: () => state.scriptProps
    },
    CacheService: {
      getScriptCache: () => ({
        get: (k) => (state.cache.has(k) ? state.cache.get(k) : null),
        put: (k, v) => { state.cache.set(k, String(v)); },
        remove: (k) => { state.cache.delete(k); }
      })
    },
    Utilities: {
      sleep: () => {},
      getUuid: (() => { let n = 0; return () => 'uuid-' + (++n); })(),
      computeHmacSha256Signature: (msg, key) => Array.from(crypto.createHmac('sha256', String(key)).update(String(msg)).digest()),
      base64Encode: (data) => Buffer.from(typeof data === 'string' ? Buffer.from(data, 'utf8') : Uint8Array.from(data)).toString('base64'),
      base64Decode: (b64) => Array.from(Buffer.from(String(b64), 'base64')),
      base64DecodeWebSafe: (b64) => Array.from(Buffer.from(String(b64), 'base64url')),
      newBlob: (bytes) => ({ getDataAsString: () => Buffer.from(Uint8Array.from(bytes)).toString('utf8') })
    },
    UrlFetchApp: { fetch: (url, options) => { state.fetchCalls.push({ url, options }); return state.fetch(url, options); } },
    Logger: { log: (...a) => state.logs.push(a) },
    LockService: {
      getScriptLock: () => ({ waitLock: () => {}, releaseLock: () => {} }),
      getUserLock: () => ({ waitLock: () => {}, releaseLock: () => {} })
    },
    ScriptApp: {
      getOAuthToken: () => 'TEST_OAUTH_TOKEN',
      getIdentityToken: () => 'TEST_ID_TOKEN',
      // execUrl: null → simula "sin despliegue del Web App" (getUrl lanza / devuelve null).
      // Por defecto NO hay Web App desplegado (getUrl → ''). opts.execUrl: URL simulada; null: getUrl lanza.
      getService: () => ({ getUrl: () => { if (opts.execUrl === null) throw new Error('sin despliegue'); return opts.execUrl || ''; } })
    },
    ContentService: {
      createTextOutput: (s) => { const out = { _text: String(s ?? ''), getContent: () => out._text, setMimeType() { return out; } }; return out; },
      MimeType: { JSON: 'application/json' }
    },
    Gmail: gmail,
    SpreadsheetApp: {
      openById: (id) => { if (!byId[id]) throw new Error('Spreadsheet no mockeado: ' + id); return byId[id]; },
      getActiveSpreadsheet: () => ({ toast: (...a) => { state.toasts.push(a); } }),
      flush: () => {},
      BorderStyle: { SOLID_MEDIUM: 'SOLID_MEDIUM' },
      BandingTheme: { LIGHT_GREY: 'LIGHT_GREY' },
      WrapStrategy: { CLIP: 'CLIP' },
      newConditionalFormatRule: () => {
        const r = {};
        const b = {
          whenTextEqualTo: (t) => { r.text = t; return b; },
          whenFormulaSatisfied: (f) => { r.formula = f; return b; },
          setBackground: (c) => { r.background = c; return b; },
          setFontColor: (c) => { r.fontColor = c; return b; },
          setRanges: (rs) => { r.ranges = rs; return b; },
          build: () => r
        };
        return b;
      },
      getUi: () => ({
        alert: (...a) => { state.alerts.push(a); },
        showModalDialog: (html, titulo) => { state.uiCalls.push({ kind: 'modal', html, titulo }); },
        showModelessDialog: (html, titulo) => { state.uiCalls.push({ kind: 'modeless', html, titulo }); },
        showSidebar: (html) => { state.uiCalls.push({ kind: 'sidebar', html }); },
        createMenu: () => { const m = { addItem: () => m, addSeparator: () => m, addToUi: () => {} }; return m; },
        ButtonSet: { OK: 'OK' }
      })
    },
    HtmlService: {
      createHtmlOutput: (html) => {
        const out = { _html: String(html ?? ''), getContent: () => out._html,
          setTitle(t) { out._title = t; return out; }, setWidth(w) { out._width = w; return out; }, setHeight(h) { out._height = h; return out; } };
        return out;
      },
      // Lee el .html real de gas/shared (como HtmlService en la librería).
      createHtmlOutputFromFile: (name) => {
        const html = fs.readFileSync(path.join(SHARED, name + '.html'), 'utf8');
        const out = { _file: name, getContent: () => html, setTitle() { return out; }, setWidth() { return out; }, setHeight() { return out; } };
        return out;
      }
    }
  };

  vm.createContext(sandbox);
  for (const f of RUNTIME_FILES) {
    vm.runInContext(fs.readFileSync(path.join(SHARED, f), 'utf8'), sandbox, { filename: f });
  }

  return {
    api: sandbox,
    logs: state.logs,
    fetchCalls: state.fetchCalls,
    uiCalls: state.uiCalls,
    alerts: state.alerts,
    toasts: state.toasts,
    userProps: state.userProps._map,
    gmail,
    getSpreadsheet: (id) => byId[id],
    tab: (id, name) => byId[id].getSheetByName(name)?._data
  };
}

/** CONFIG como la construye el stub (CONFIG_STATIC) + Ajustes del Sheet. */
export const CONFIG_STATIC = {
  sheets: { ledger: 'Movimientos', processed: '_Procesados', merchants: 'Comercios', settings: 'Ajustes' },
  timezone: 'America/Lima'
};
export function configFor(h, sheetId) { return h.api.construirConfig(sheetId, CONFIG_STATIC); }
