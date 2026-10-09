"use client";

/**
 * Estado compartido de /app: la Sheet del usuario (Drive) y sus pestañas, más todas las acciones de
 * lectura/escritura. Los componentes de página solo presentan; la lógica pura vive en `lib/*`.
 * Copia local (ADR-011): cada lectura correcta se guarda en el dispositivo sin secretos; si la red falla, se muestra
 * esa copia en solo lectura (`offlineSince`) y se recarga sola al volver la conexión.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { GoogleApiError, RANGES, TABS, getGoogleClient, type ClientConfig, type GoogleClient, type LedgerFile, type PickerOptions } from "@/lib/google-client";
import { isoLima, rowsToTxs, type Tx } from "@/lib/ledger";
import { parseAjustes, parseCategorias, type Ajustes } from "@/lib/ajustes";
import { applyFx, fxContext, parseTipoCambio, type FxRow } from "@/lib/fx";
import { buildManualRow, merchantKey, planMarkTransfer, planMerchantUpsert, planRecategorize, planRowFields, type ManualInput } from "@/lib/sheets-ops";
import { isNetworkError, sanitizeData, usableSnapshot, type Snapshot } from "@/lib/offline";
import { loadSnapshot, saveSnapshot } from "@/lib/offline-store";
import { useToast } from "./Toast";
import { postToSw } from "./Pwa";

export type LedgerData = {
  rows: string[][];
  txs: Tx[];
  ajustes: Ajustes;
  categorias: string[];
  comerciosRows: string[][];
  hasMovimientos: boolean;
  /** `_TipoCambio` de la copia (ADR-012); vacía si el script aún no la creó. */
  fx?: FxRow[];
  /** USD→PEN de respaldo: manual, último dato del BCRP o `fx.usd_pen`. */
  usdRate: number;
  loadedAt: number;
};

export type LedgerState =
  | { phase: "loading" }
  | { phase: "nofile"; busy?: string; error?: string }
  | { phase: "ready"; file: LedgerFile; data: LedgerData; error?: string };

export type LedgerApi = {
  state: LedgerState;
  mode: "google" | "mock";
  user: { name: string; email: string; image: string };
  refreshing: boolean;
  /** Sin conexión: hora de la copia que se muestra (solo lectura); `null` con conexión. */
  offlineSince: number | null;
  sessionExpired: boolean;
  connectionsSkipped: boolean;
  importDismissed: boolean;
  templateId: string;
  templateFolderId: string;
  libVersion: string;
  signOutAction: () => Promise<void>;
  crearSheet: () => Promise<void>;
  elegirExistente: () => Promise<void>;
  refresh: () => Promise<void>;
  /** Relee solo `Ajustes` (telemetría), sin tocar el ledger: para sondeos ligeros. */
  refreshAjustes: () => Promise<Ajustes | null>;
  cambiarSheet: () => void;
  skipConnections: (skip: boolean) => void;
  dismissImport: () => void;
  elegirCopia: () => Promise<void>;
  recategorize: (tx: Tx, categoria: string) => Promise<boolean>;
  markTransfer: (tx: Tx) => Promise<boolean>;
  addManual: (input: ManualInput) => Promise<boolean>;
  saveAjustes: (updates: Record<string, string>, okMsg?: string) => Promise<boolean>;
};

const Ctx = createContext<LedgerApi | null>(null);
export function useLedger(): LedgerApi {
  const v = useContext(Ctx);
  if (!v) throw new Error("useLedger fuera de LedgerProvider");
  return v;
}

const LS_SHEET = "luca.sheetId";
const LS_SKIP = "luca.onboarding.skipConnections";
const LS_IMPORT = "luca.onboarding.importDismissed";
const ls = {
  get: (k: string) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* sin storage */ } },
  del: (k: string) => { try { localStorage.removeItem(k); } catch { /* sin storage */ } },
};

type Props = {
  cfg: ClientConfig & { templateId: string; templateFolderId: string; libVersion: string };
  user: { name: string; email: string; image: string };
  signOutAction: () => Promise<void>;
  children: ReactNode;
};

export function LedgerProvider({ cfg, user, signOutAction, children }: Props) {
  const { toast } = useToast();
  const clientRef = useRef<GoogleClient | null>(null);
  if (!clientRef.current && typeof window !== "undefined") clientRef.current = getGoogleClient(cfg);
  const client = () => clientRef.current!;

  const [state, setState] = useState<LedgerState>({ phase: "loading" });
  const [refreshing, setRefreshing] = useState(false);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [connectionsSkipped, setSkipped] = useState(false);
  const [importDismissed, setImportDismissed] = useState(false);
  const [offlineSince, setOfflineSince] = useState<number | null>(null);
  const stateRef = useRef(state);
  useEffect(() => { stateRef.current = state; }, [state]);

  /** Guarda la lectura correcta en el dispositivo y pide al service worker precargar las páginas principales. */
  const remember = useCallback((file: LedgerFile, data: LedgerData) => {
    setOfflineSince(null);
    void saveSnapshot({ email: user.email, file, data: sanitizeData(data), savedAt: data.loadedAt });
    postToSw({ type: "warm" });
  }, [user.email]);

  /** Sin red: muestra la copia de esta cuenta (y de la hoja elegida). Devuelve false si no hay copia. */
  const fromSnapshot = useCallback(async (): Promise<boolean> => {
    const snap = usableSnapshot(await loadSnapshot<Snapshot<LedgerData, LedgerFile>>(user.email), user.email, ls.get(LS_SHEET));
    if (!snap) return false;
    setSkipped(ls.get(LS_SKIP) === snap.file.id);
    setImportDismissed(ls.get(LS_IMPORT) === snap.file.id);
    setState({ phase: "ready", file: snap.file, data: snap.data });
    setOfflineSince(snap.savedAt);
    return true;
  }, [user.email]);

  const fail = useCallback((e: unknown, prefix?: string) => {
    if (e instanceof GoogleApiError && e.needsReauth) { setSessionExpired(true); return; }
    const msg = e instanceof Error ? e.message : String(e);
    toast(prefix ? `${prefix}: ${msg}` : msg, "error");
  }, [toast]);

  /** Lee las 4 pestañas. `Movimientos` puede no existir aún (falta Autorizar); las demás son opcionales. */
  const loadData = useCallback(async (fileId: string): Promise<LedgerData> => {
    const c = client();
    const optional = async (range: string) => {
      try { return await c.readRange(fileId, range); } catch (e) { if (e instanceof GoogleApiError && e.missingRange) return []; throw e; }
    };
    let rows: string[][] = [], hasMovimientos = true;
    try { rows = await c.readRange(fileId, RANGES.ledger); } catch (e) {
      if (e instanceof GoogleApiError && e.missingRange) hasMovimientos = false; else throw e;
    }
    const [aj, cat, com, tc] = await Promise.all([optional(RANGES.settings), optional(RANGES.categories), optional(RANGES.merchants), optional(RANGES.fx)]);
    const ajustes = parseAjustes(aj);
    const fx = parseTipoCambio(tc);
    const ctx = fxContext(ajustes, fx);
    return { rows, txs: applyFx(rowsToTxs(rows), fx, ctx), ajustes, fx, categorias: parseCategorias(cat), comerciosRows: com, hasMovimientos, usdRate: ctx.respaldo, loadedAt: Date.now() };
  }, []);

  const loadLedger = useCallback(async (file: LedgerFile) => {
    try {
      const data = await loadData(file.id);
      ls.set(LS_SHEET, file.id);
      setSkipped(ls.get(LS_SKIP) === file.id);
      setImportDismissed(ls.get(LS_IMPORT) === file.id);
      setState({ phase: "ready", file, data });
      remember(file, data);
    } catch (e) {
      if (e instanceof GoogleApiError && e.needsReauth) { setSessionExpired(true); return; }
      if (isNetworkError(e, navigator.onLine)) {
        // Ya había datos de esta hoja en pantalla: se quedan, marcados como copia. Si no, la copia del dispositivo.
        const cur = stateRef.current;
        if (cur.phase === "ready" && cur.file.id === file.id && !cur.error) { setOfflineSince((t) => t ?? cur.data.loadedAt); return; }
        if (await fromSnapshot()) return;
      }
      setState((s) => (s.phase === "ready" && s.file.id === file.id)
        ? { ...s, error: (e as Error).message }
        : { phase: "ready", file, data: { rows: [], txs: [], ajustes: {}, categorias: parseCategorias([]), comerciosRows: [], hasMovimientos: false, usdRate: fxContext({}, []).respaldo, loadedAt: Date.now() }, error: (e as Error).message });
    }
  }, [loadData, remember, fromSnapshot]);

  // Al entrar: busca la Sheet de Luca en el Drive del usuario (sin base de datos nuestra).
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const files = await client().findLedgerFiles();
        if (!alive) return;
        const cached = ls.get(LS_SHEET);
        const file = files.find((f) => f.id === cached) ?? files[0];
        if (file) await loadLedger(file);
        else setState({ phase: "nofile" });
      } catch (e) {
        if (!alive) return;
        if (e instanceof GoogleApiError && e.needsReauth) setSessionExpired(true);
        else if (isNetworkError(e, navigator.onLine) && await fromSnapshot()) return;
        else setState({ phase: "nofile", error: (e as Error).message });
      }
    })();
    return () => { alive = false; };
  }, [loadLedger, fromSnapshot]);

  // Al volver la conexión, recarga sola desde la Sheet.
  useEffect(() => {
    if (offlineSince == null) return;
    const back = () => { const cur = stateRef.current; if (cur.phase === "ready") void loadLedger(cur.file); };
    addEventListener("online", back);
    return () => removeEventListener("online", back);
  }, [offlineSince, loadLedger]);

  const crearSheet = useCallback(async () => {
    setState({ phase: "nofile", busy: "Elige la plantilla de Luca en el selector…" });
    try {
      // Elegir la plantilla en el Picker la mete en alcance de drive.file (validado en S1).
      const picked = await client().pickSpreadsheet({ title: 'Elige "Luca Template" para crear tu copia', parentId: cfg.templateFolderId || undefined });
      if (!picked) return setState({ phase: "nofile" });
      setState({ phase: "nofile", busy: "Creando tu Sheet…" });
      const file = await client().copyTemplate(picked.id, `Luca Ledger — ${user.name || user.email}`);
      await loadLedger(file);
      toast("Tu Sheet está creada. Ahora autorízala desde el menú Luca.");
    } catch (e) {
      setState({ phase: "nofile", error: (e as Error).message });
    }
  }, [loadLedger, toast, user.email, user.name, cfg.templateFolderId]);

  const conectarElegida = useCallback(async (busy: string, opts: PickerOptions) => {
    setState({ phase: "nofile", busy });
    try {
      const picked = await client().pickSpreadsheet(opts);
      if (!picked) return setState({ phase: "nofile" });
      const file = await client().tagAsLedger(picked.id);
      await loadLedger(file);
      toast(`Conectada: ${file.name}`);
    } catch (e) {
      setState({ phase: "nofile", error: (e as Error).message });
    }
  }, [loadLedger, toast]);

  const elegirExistente = useCallback(
    () => conectarElegida("Elige tu Sheet de Luca…", { title: "Elige tu Sheet de Luca" }), [conectarElegida]);
  // La copia que el usuario hizo con "Copiar a mi Drive" (ADR-009): elegirla la mete en alcance de drive.file.
  const elegirCopia = useCallback(
    () => conectarElegida("Elige tu copia en el selector…", { title: "Elige tu copia de Luca", ownedByMe: true, intent: "copia" }), [conectarElegida]);

  const refresh = useCallback(async () => {
    if (state.phase !== "ready") return;
    setRefreshing(true);
    try { await loadLedger(state.file); } finally { setRefreshing(false); }
  }, [state, loadLedger]);

  const refreshAjustes = useCallback(async (): Promise<Ajustes | null> => {
    if (state.phase !== "ready") return null;
    try {
      const ajustes = parseAjustes(await client().readRange(state.file.id, RANGES.settings));
      setState((s) => {
        if (s.phase !== "ready") return s;
        const fx = s.data.fx ?? [], ctx = fxContext(ajustes, fx);
        return { ...s, data: { ...s.data, ajustes, txs: applyFx(s.data.txs, fx, ctx), usdRate: ctx.respaldo } };
      });
      return ajustes;
    } catch (e) {
      if (e instanceof GoogleApiError && e.needsReauth) setSessionExpired(true);
      return null;
    }
  }, [state]);

  const cambiarSheet = useCallback(() => {
    ls.del(LS_SHEET);
    setState({ phase: "nofile" });
  }, []);

  const skipConnections = useCallback((skip: boolean) => {
    if (state.phase !== "ready") return;
    if (skip) ls.set(LS_SKIP, state.file.id); else ls.del(LS_SKIP);
    setSkipped(skip);
  }, [state]);

  const dismissImport = useCallback(() => {
    if (state.phase !== "ready") return;
    ls.set(LS_IMPORT, state.file.id);
    setImportDismissed(true);
  }, [state]);

  /** Ejecuta una escritura, recarga y avisa. Devuelve true si fue bien. */
  const write = useCallback(async (label: string, fn: (fileId: string, data: LedgerData) => Promise<void>, okMsg: string): Promise<boolean> => {
    if (state.phase !== "ready") return false;
    if (offlineSince != null) { toast("Sin conexión: no se puede guardar ahora. Vuelve a intentarlo con internet.", "error"); return false; }
    try {
      await fn(state.file.id, state.data);
      const data = await loadData(state.file.id);
      setState({ phase: "ready", file: state.file, data });
      remember(state.file, data);
      toast(okMsg);
      return true;
    } catch (e) {
      fail(e, label);
      return false;
    }
  }, [state, offlineSince, loadData, remember, toast, fail]);

  const recategorize = useCallback((tx: Tx, categoria: string) => write("No pude recategorizar", async (fileId, data) => {
    const plan = planRecategorize(tx, categoria, data.rows, data.comerciosRows, isoLima(new Date()), { ledger: TABS.ledger, merchants: TABS.merchants });
    await client().updateCells(fileId, [...plan.ledger, ...plan.merchants.updates]);
    await client().appendRows(fileId, TABS.merchants, plan.merchants.appends);
  }, categoria ? `Categoría guardada: ${categoria}` : "Categoría quitada"), [write]);

  const markTransfer = useCallback((tx: Tx) => {
    const plan = planMarkTransfer(tx);
    if (plan.kind === "category") return recategorize(tx, plan.categoria);
    return write("No pude marcar la transferencia", async (fileId, data) => {
      await client().updateCells(fileId, planRowFields(TABS.ledger, data.rows, tx.id, { tipo: "internal_transfer", categoria: "", categoria_origen: "user" }));
    }, "Marcado como transferencia entre cuentas: ya no cuenta en tus gastos");
  }, [recategorize, write]);

  const addManual = useCallback((input: ManualInput) => write("No pude agregar el movimiento", async (fileId, data) => {
    const headers = data.rows[0] ?? [];
    if (!headers.includes("id")) throw new Error("La pestaña Movimientos aún no existe: autoriza tu Sheet primero");
    const uuid = typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    await client().appendRows(fileId, TABS.ledger, [buildManualRow(headers, input, uuid, isoLima(new Date()))]);
    if (input.categoria && (input.comercio || input.contraparte)) {
      const name = (input.comercio || input.contraparte)!;
      const plan = planMerchantUpsert(TABS.merchants, data.comerciosRows, { key: merchantKey(name), nombre: name, categoria: input.categoria, now: isoLima(new Date()) });
      await client().updateCells(fileId, plan.updates);
      await client().appendRows(fileId, TABS.merchants, plan.appends);
    }
  }, "Movimiento agregado"), [write]);

  const saveAjustes = useCallback((updates: Record<string, string>, okMsg = "Ajustes guardados en tu Sheet") =>
    write("No pude guardar", (fileId) => client().upsertKeyValue(fileId, TABS.settings, updates), okMsg), [write]);

  const api = useMemo<LedgerApi>(() => ({
    state, mode: cfg.mode, user, refreshing, offlineSince, sessionExpired, connectionsSkipped, importDismissed, templateId: cfg.templateId, templateFolderId: cfg.templateFolderId, libVersion: cfg.libVersion, signOutAction,
    crearSheet, elegirExistente, elegirCopia, refresh, refreshAjustes, cambiarSheet, skipConnections, dismissImport, recategorize, markTransfer, addManual, saveAjustes,
  }), [state, cfg.mode, cfg.templateId, cfg.templateFolderId, cfg.libVersion, user, refreshing, offlineSince, sessionExpired, connectionsSkipped, importDismissed, signOutAction, crearSheet, elegirExistente, elegirCopia, refresh, refreshAjustes, cambiarSheet, skipConnections, dismissImport, recategorize, markTransfer, addManual, saveAjustes]);

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}
