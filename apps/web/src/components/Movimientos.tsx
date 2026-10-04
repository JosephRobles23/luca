"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";

type Filters = { tipo: string; fuente: string; categoria: string; q: string; mes: string };
import { filterTxs, fmtMoney, fmtPEN, monthLabel, monthOf, toBase, txLabel, type Tx } from "@/lib/ledger";
import { planMarkTransfer } from "@/lib/sheets-ops";
import { useLedger } from "./LedgerProvider";
import CategorySelect from "./CategorySelect";
import { Field, Select, SRC_LABEL, TIPO_LABEL, fmtDateTime } from "./ui";

export default function Movimientos() {
  return <Suspense fallback={null}><MovimientosInner /></Suspense>;
}

function MovimientosInner() {
  const { state } = useLedger();
  const params = useSearchParams();
  const router = useRouter();
  // Los filtros viven en estado local (fuente de verdad mientras la página está montada) y se reflejan en la
  // URL con un pequeño retraso para que los enlaces del dashboard y las recargas los conserven.
  const [f, setFState] = useState<Filters>(() => ({ tipo: params.get("tipo") ?? "", fuente: params.get("fuente") ?? "", categoria: params.get("categoria") ?? "", q: params.get("q") ?? "", mes: params.get("mes") ?? "" }));
  const setF = (patch: Partial<Filters>) => setFState((prev) => ({ ...prev, ...patch }));
  const clear = () => setFState({ tipo: "", fuente: "", categoria: "", q: "", mes: "" });
  useEffect(() => {
    const p = new URLSearchParams();
    (Object.keys(f) as (keyof Filters)[]).forEach((k) => { if (f[k]) p.set(k, f[k]); });
    const next = p.toString();
    if (next === window.location.search.replace(/^\?/, "")) return;
    const t = setTimeout(() => router.replace(`/app/movimientos${next ? `?${next}` : ""}`, { scroll: false }), 200);
    return () => clearTimeout(t);
  }, [f, router]);

  const txs = useMemo(() => (state.phase === "ready" ? state.data.txs : []), [state]);
  const usdRate = state.phase === "ready" ? state.data.usdRate : 3.5;
  const categorias = state.phase === "ready" ? state.data.categorias : [];
  const months = useMemo(() => Array.from(new Set(txs.map((t) => monthOf(t.fecha)))).sort().reverse(), [txs]);
  const fuentes = useMemo(() => Array.from(new Set(txs.map((t) => t.fuente).filter(Boolean))).sort(), [txs]);
  const list = useMemo(() => {
    const base = f.mes ? txs.filter((t) => monthOf(t.fecha) === f.mes) : txs;
    return filterTxs(base, f).sort((a, b) => (a.fecha < b.fecha ? 1 : -1));
  }, [txs, f]);
  const total = useMemo(() => Math.round(list.filter((t) => t.tipo === "expense").reduce((s, t) => s + toBase(t, usdRate), 0) * 100) / 100, [list, usdRate]);

  if (state.phase !== "ready") return null;
  if (!state.data.hasMovimientos) return <section className="card"><p className="text-sm text-muted">Tu Sheet aún no tiene la pestaña Movimientos: autorízala primero (paso 2).</p></section>;

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="label !mb-0">Movimientos</h1>
        <Link className="btn" href="/app/agregar">+ Agregar</Link>
      </div>

      <form className="card grid gap-3 sm:grid-cols-2 lg:grid-cols-5" onSubmit={(e) => e.preventDefault()} aria-label="Filtros">
        <Field label="Buscar" htmlFor="f-q">
          <input id="f-q" className="input" placeholder="comercio, persona, asunto…" value={f.q} onChange={(e) => setF({ q: e.target.value })} data-testid="filter-q" />
        </Field>
        <Field label="Mes" htmlFor="f-mes">
          <Select id="f-mes" value={f.mes} onChange={(e) => setF({ mes: e.target.value })}>
            <option value="">Todos</option>
            {months.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
          </Select>
        </Field>
        <Field label="Tipo" htmlFor="f-tipo">
          <Select id="f-tipo" value={f.tipo} onChange={(e) => setF({ tipo: e.target.value })} data-testid="filter-tipo">
            <option value="">Todos</option>
            {Object.entries(TIPO_LABEL).filter(([k]) => k !== "rejected").map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </Select>
        </Field>
        <Field label="Fuente" htmlFor="f-fuente">
          <Select id="f-fuente" value={f.fuente} onChange={(e) => setF({ fuente: e.target.value })}>
            <option value="">Todas</option>
            {fuentes.map((s) => <option key={s} value={s}>{SRC_LABEL[s] ?? s}</option>)}
          </Select>
        </Field>
        <Field label="Categoría" htmlFor="f-cat">
          <Select id="f-cat" value={f.categoria} onChange={(e) => setF({ categoria: e.target.value })} data-testid="filter-categoria">
            <option value="">Todas</option>
            <option value="__pending__">Por categorizar</option>
            {categorias.map((c) => <option key={c} value={c}>{c}</option>)}
          </Select>
        </Field>
      </form>

      <p className="text-xs text-muted" data-testid="movs-count">{list.length} {list.length === 1 ? "movimiento" : "movimientos"} · gastos {fmtPEN(total)}{(f.q || f.tipo || f.fuente || f.categoria || f.mes) ? <> · <button type="button" className="underline" onClick={clear}>limpiar filtros</button></> : null}</p>

      {!list.length && <section className="card"><p className="text-sm text-muted">Nada que mostrar con estos filtros.</p></section>}

      <ul className="grid gap-2" data-testid="movs-list">
        {list.map((t) => <Row key={t.id} t={t} usdRate={usdRate} />)}
      </ul>
    </div>
  );
}

function Row({ t, usdRate }: { t: Tx; usdRate: number }) {
  const { markTransfer } = useLedger();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const dim = t.tipo === "internal_transfer";
  const sign = t.tipo === "income" || t.tipo === "transfer_in" ? "+ " : dim ? "" : "− ";
  const transfer = planMarkTransfer(t);
  const canTransfer = t.tipo === "expense" && !(transfer.kind === "category" && t.categoria === "Transferencias");
  return (
    <li className={`card grid gap-2 py-3 ${dim ? "opacity-70" : ""}`} data-testid={`mov-${t.id}`}>
      <div className="grid grid-cols-[1fr_auto] items-start gap-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold">{txLabel(t)}</div>
          <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-muted">
            {fmtDateTime(t.fecha)} · {TIPO_LABEL[t.tipo] ?? t.tipo}
            <span className="src">{SRC_LABEL[t.fuente] ?? t.fuente}</span>
            {t.flags.map((fl) => <span key={fl} className="src !text-warn" title="flag">{fl}</span>)}
          </div>
        </div>
        <div className="text-right">
          <div className={`text-sm font-semibold tabular-nums ${t.tipo === "income" ? "text-ok" : ""}`}>{sign}{fmtMoney(t.monto, t.moneda)}</div>
          {t.moneda === "USD" && <div className="text-[11px] text-muted tabular-nums">≈ {fmtPEN(toBase(t, usdRate))} · TC {t.tipoCambio ?? usdRate}{t.tipoCambio ? "" : " (Ajustes)"}</div>}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {t.tipo === "expense" || t.tipo === "income" ? <div className="min-w-[180px] flex-1 sm:flex-none"><CategorySelect tx={t} compact /></div> : <span className="text-xs text-muted">{dim ? "No cuenta en tus KPIs" : "Yapeo recibido · no cuenta como ingreso"}</span>}
        {canTransfer && (
          <button type="button" className="btn !py-1 text-xs" disabled={busy} data-testid={`transfer-${t.id}`}
            title={transfer.kind === "category" ? "Lo categoriza como Transferencias y lo aprende para esta persona" : "Lo marca como movimiento entre tus cuentas: sale de los gastos"}
            onClick={async () => { setBusy(true); try { await markTransfer(t); } finally { setBusy(false); } }}>
            {busy ? "Guardando…" : "Marcar como transferencia"}
          </button>
        )}
        <button type="button" className="btn !py-1 text-xs" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-controls={`det-${t.id}`}>{open ? "Ocultar detalle" : "Ver detalle"}</button>
      </div>
      {open && (
        <dl id={`det-${t.id}`} className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 border-t border-border pt-2 text-xs">
          <Dt k="Id" v={t.id} /><Dt k="Fecha" v={t.fecha} /><Dt k="Fuente" v={`${SRC_LABEL[t.fuente] ?? t.fuente}${t.canal ? ` · canal ${t.canal}` : ""}`} />
          <Dt k="Medio" v={t.medio} /><Dt k="Asunto" v={t.asunto} /><Dt k="Comercio" v={t.comercio} /><Dt k="Contraparte" v={t.contraparte ? `${t.contraparte}${t.contraparteKey ? ` (${t.contraparteKey})` : ""}` : ""} />
          <Dt k="Categoría" v={t.categoria ? `${t.categoria} (origen: ${t.categoriaOrigen || "—"})` : "por categorizar"} />
          <Dt k="Tipo de cambio" v={t.tipoCambio ? String(t.tipoCambio) : ""} /><Dt k="Operación" v={t.operacion} /><Dt k="Gmail id" v={t.gmailId} /><Dt k="Flags" v={t.flags.join(", ")} /><Dt k="Creado" v={t.creadoEn} />
        </dl>
      )}
    </li>
  );
}

function Dt({ k, v }: { k: string; v: string }) {
  if (!v) return null;
  return <><dt className="text-muted">{k}</dt><dd className="break-all">{v}</dd></>;
}
