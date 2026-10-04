"use client";

/**
 * Estado compartido de /app: la Sheet del usuario (Drive) y sus pestañas, más todas las acciones de
 * lectura/escritura. Los componentes de página solo presentan; la lógica pura vive en `lib/*`.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { GoogleApiError, RANGES, TABS, getGoogleClient, type ClientConfig, type GoogleClient, type LedgerFile } from "@/lib/google-client";
import { isoLima, rowsToTxs, type Tx } from "@/lib/ledger";
import { parseAjustes, parseCategorias, usdRate, type Ajustes } from "@/lib/ajustes";
import { buildManualRow, merchantKey, planMarkTransfer, planMerchantUpsert, planRecategorize, planRowFields, type ManualInput } from "@/lib/sheets-ops";
import { useToast } from "./Toast";

export type LedgerData = {
  rows: string[][];
  txs: Tx[];
  ajustes: Ajustes;
  categorias: string[];
  comerciosRows: string[][];
  hasMovimientos: boolean;
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
  sessionExpired: boolean;
  connectionsSkipped: boolean;
  templateId: string;
  libVersion: string;
  signOutAction: () => Promise<void>;
  crearSheet: () => Promise<void>;
  elegirExistente: () => Promise<void>;
  refresh: () => Promise<void>;
  cambiarSheet: () => void;
  skipConnections: (skip: boolean) => void;
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
const ls = {
  get: (k: string) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* sin storage */ } },
  del: (k: string) => { try { localStorage.removeItem(k); } catch { /* sin storage */ } },
};

type Props = {
  cfg: ClientConfig & { templateId: string; libVersion: string };
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
    const [aj, cat, com] = await Promise.all([optional(RANGES.settings), optional(RANGES.categories), optional(RANGES.merchants)]);
    const ajustes = parseAjustes(aj);
    return { rows, txs: rowsToTxs(rows), ajustes, categorias: parseCategorias(cat), comerciosRows: com, hasMovimientos, usdRate: usdRate(ajustes), loadedAt: Date.now() };
  }, []);

  const loadLedger = useCallback(async (file: LedgerFile) => {
    try {
      const data = await loadData(file.id);
      ls.set(LS_SHEET, file.id);
      setSkipped(ls.get(LS_SKIP) === file.id);
      setState({ phase: "ready", file, data });
    } catch (e) {
      if (e instanceof GoogleApiError && e.needsReauth) { setSessionExpired(true); return; }
      setState((s) => (s.phase === "ready" && s.file.id === file.id)
        ? { ...s, error: (e as Error).message }
        : { phase: "ready", file, data: { rows: [], txs: [], ajustes: {}, categorias: parseCategorias([]), comerciosRows: [], hasMovimientos: false, usdRate: usdRate({}), loadedAt: Date.now() }, error: (e as Error).message });
    }
  }, [loadData]);

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
        else setState({ phase: "nofile", error: (e as Error).message });
      }
    })();
    return () => { alive = false; };
  }, [loadLedger]);

  const crearSheet = useCallback(async () => {
    setState({ phase: "nofile", busy: "Elige la plantilla de Luca en el selector…" });
    try {
      // Elegir la plantilla en el Picker la mete en alcance de drive.file (validado en S1).
      const picked = await client().pickSpreadsheet({ title: 'Elige "Luca — Plantilla" para crear tu copia' });
      if (!picked) return setState({ phase: "nofile" });
      setState({ phase: "nofile", busy: "Creando tu Sheet…" });
      const file = await client().copyTemplate(picked.id, `Luca Ledger — ${user.name || user.email}`);
      await loadLedger(file);
      toast("Tu Sheet está creada. Ahora autorízala desde el menú Luca.");
    } catch (e) {
      setState({ phase: "nofile", error: (e as Error).message });
    }
  }, [loadLedger, toast, user.email, user.name]);

  const elegirExistente = useCallback(async () => {
    setState({ phase: "nofile", busy: "Elige tu Sheet de Luca…" });
    try {
      const picked = await client().pickSpreadsheet({ title: "Elige tu Sheet de Luca" });
      if (!picked) return setState({ phase: "nofile" });
      const file = await client().tagAsLedger(picked.id);
      await loadLedger(file);
      toast(`Conectada: ${file.name}`);
    } catch (e) {
      setState({ phase: "nofile", error: (e as Error).message });
    }
  }, [loadLedger, toast]);

  const refresh = useCallback(async () => {
    if (state.phase !== "ready") return;
    setRefreshing(true);
    try { await loadLedger(state.file); } finally { setRefreshing(false); }
  }, [state, loadLedger]);

  const cambiarSheet = useCallback(() => {
    ls.del(LS_SHEET);
    setState({ phase: "nofile" });
  }, []);

  const skipConnections = useCallback((skip: boolean) => {
    if (state.phase !== "ready") return;
    if (skip) ls.set(LS_SKIP, state.file.id); else ls.del(LS_SKIP);
    setSkipped(skip);
  }, [state]);

  /** Ejecuta una escritura, recarga y avisa. Devuelve true si fue bien. */
  const write = useCallback(async (label: string, fn: (fileId: string, data: LedgerData) => Promise<void>, okMsg: string): Promise<boolean> => {
    if (state.phase !== "ready") return false;
    try {
      await fn(state.file.id, state.data);
      const data = await loadData(state.file.id);
      setState({ phase: "ready", file: state.file, data });
      toast(okMsg);
      return true;
    } catch (e) {
      fail(e, label);
      return false;
    }
  }, [state, loadData, toast, fail]);

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
    state, mode: cfg.mode, user, refreshing, sessionExpired, connectionsSkipped, templateId: cfg.templateId, libVersion: cfg.libVersion, signOutAction,
    crearSheet, elegirExistente, refresh, cambiarSheet, skipConnections, recategorize, markTransfer, addManual, saveAjustes,
  }), [state, cfg.mode, cfg.templateId, cfg.libVersion, user, refreshing, sessionExpired, connectionsSkipped, signOutAction, crearSheet, elegirExistente, refresh, cambiarSheet, skipConnections, recategorize, markTransfer, addManual, saveAjustes]);

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}
