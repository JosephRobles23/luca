"use client";

/**
 * Movimientos (DESIGN.md §Layout · Movimientos): título + selector de periodo → banda de totales de lo filtrado (gastos con barras
 * por día, ingresos, Yape, por categorizar) → buscador, chips de tipo y "Más filtros" → lista con orden (recientes o
 * mayor monto), agrupada por día, con la búsqueda resaltada, detalle desplegable por fila y "Mostrar más".
 */
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState, type CSSProperties } from "react";
import { fmtPEN, todayLima } from "@/lib/ledger";
import { groupByDay, scanFreshness } from "@/lib/dias";
import {
  EMPTY_FILTERS, PAGE_SIZE, PENDING, applyFilters, barsMonth, countByTipo, countLabel, dailyBars, filterTotals, filtersToQuery, fuentesOf,
  hasFilters, monthsOf, parseFilters, setPeriod, sortTxs, type Filters, type Sort,
} from "@/lib/movimientos";
import MovTotals from "./movimientos/MovTotals";
import { useLedger } from "./LedgerProvider";
import { useFirstView } from "./motion";
import { IconMas } from "./icons";
import Filtros from "./movimientos/Filtros";
import MovRow from "./movimientos/MovRow";
import PeriodPicker from "./movimientos/PeriodPicker";

/** Filas que entran escalonadas en la primera vista (el resto aparece sin animar). */
const RISE_ROWS = 12;

/**
 * Query strings que escribimos nosotros con `router.replace`. Cuando la URL cambia a una que no está aquí
 * (p. ej. el buscador global del topbar empuja `?q=`), los filtros se vuelven a leer de la URL.
 */
const written = new Set<string>();

export default function Movimientos() {
  return <Suspense fallback={null}><MovimientosInner /></Suspense>;
}

function MovimientosInner() {
  const { state } = useLedger();
  const params = useSearchParams();
  const router = useRouter();
  const first = useFirstView("movimientos");

  // Los filtros viven en estado local (fuente de verdad mientras la página está montada) y se reflejan en la
  // URL con un pequeño retraso para que los enlaces del Resumen y las recargas los conserven.
  const [f, setFState] = useState<Filters>(() => parseFilters(params));
  const [sort, setSort] = useState<Sort>("fecha");
  const [page, setPage] = useState(1);
  const setF = (patch: Partial<Filters>) => { setFState((prev) => ({ ...prev, ...patch })); setPage(1); };
  const clear = () => { setFState(EMPTY_FILTERS); setPage(1); };
  const [now] = useState(() => Date.now());

  // Cambio de URL que no hicimos nosotros (buscador global, enlace del Resumen): manda la URL.
  const search = params.toString();
  const [seen, setSeen] = useState(search);
  if (search !== seen) {
    setSeen(search);
    if (!written.has(search) && search !== filtersToQuery(f)) setFState(parseFilters(params));
  }

  useEffect(() => {
    const next = filtersToQuery(f);
    if (next === window.location.search.replace(/^\?/, "")) return;
    const t = setTimeout(() => {
      written.add(next);
      if (written.size > 50) written.delete(written.values().next().value as string);
      router.replace(`/app/movimientos${next ? `?${next}` : ""}`, { scroll: false });
    }, 200);
    return () => clearTimeout(t);
  }, [f, router]);

  const txs = useMemo(() => (state.phase === "ready" ? state.data.txs : []), [state]);
  const usdRate = state.phase === "ready" ? state.data.usdRate : 3.5;
  const categorias = state.phase === "ready" ? state.data.categorias : [];
  const months = useMemo(() => monthsOf(txs), [txs]);
  const txDays = useMemo(() => new Set(txs.map((t) => t.fecha.slice(0, 10))), [txs]);
  const fuentes = useMemo(() => fuentesOf(txs), [txs]);
  const list = useMemo(() => applyFilters(txs, f), [txs, f]);
  const counts = useMemo(() => countByTipo(txs, f), [txs, f]);
  const today = todayLima();
  const totals = useMemo(() => filterTotals(list, usdRate), [list, usdRate]);
  const bMonth = barsMonth(f, today);
  const bars = useMemo(() => dailyBars(list, bMonth, today, usdRate), [list, bMonth, today, usdRate]);
  const pending = useMemo(() => applyFilters(txs, { ...f, categoria: PENDING, tipo: "expense" }).length, [txs, f]);
  const sorted = useMemo(() => sortTxs(list, sort, usdRate), [list, sort, usdRate]);
  const shown = sorted.slice(0, page * PAGE_SIZE);
  const groups = useMemo(() => (sort === "fecha" ? groupByDay(shown, today, usdRate) : null), [shown, sort, today, usdRate]);

  if (state.phase !== "ready") return null;
  if (!state.data.hasMovimientos) {
    return (
      <section className="card mx-auto grid max-w-[560px] gap-3">
        <h1 className="page-title">Movimientos</h1>
        <p className="text-sm text-body">Tu Sheet aún no tiene la pestaña Movimientos: autorízala primero (paso 2 del Resumen).</p>
        <Link className="btn primary w-fit" href="/app">Ir al Resumen</Link>
      </section>
    );
  }

  const filtered = hasFilters(f);
  const pendingOn = f.categoria === PENDING;
  const ajustes = state.data.ajustes;
  let row = 0;
  const renderRow = (t: (typeof shown)[number]) => {
    const i = row++;
    const rise = first && i < RISE_ROWS;
    return <MovRow key={t.id} t={t} usdRate={usdRate} highlight={f.q} className={rise ? "rise" : undefined} style={rise ? ({ "--i": i } as CSSProperties) : undefined} />;
  };

  return (
    <div className="grid gap-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="page-title">Movimientos</h1>
          <p className="mt-1 text-sm text-muted"><span className="num">{txs.length}</span> en tu Sheet · {scanFreshness(ajustes["scan.lastRunAt"], now)}</p>
        </div>
        <div className="flex items-center gap-2">
          <PeriodPicker value={f} months={months} days={txDays} today={today} onChange={(p) => setF(setPeriod(p))} />
          <Link className="btn primary icon flex-none sm:w-auto sm:px-4 lg:hidden" href="/app/agregar" aria-label="Agregar movimiento"><IconMas /><span className="hidden sm:inline">Agregar</span></Link>
        </div>
      </header>

      <MovTotals totals={totals} bars={bars} barsMonth={bMonth} pending={pending} pendingOn={pendingOn}
        onPending={() => setF(pendingOn ? { categoria: "" } : { categoria: PENDING, tipo: "expense" })} />

      <Filtros f={f} setF={setF} counts={counts} fuentes={fuentes} categorias={categorias} onClear={clear} />

      {!list.length ? (
        <section className="card grid justify-items-start gap-3 py-8" data-testid="movs-empty">
          <p className="text-[15px] text-body">{filtered ? "Nada que mostrar con estos filtros." : "Aún no hay movimientos. Llegarán solos cuando tu script lea el correo."}</p>
          {filtered
            ? <button type="button" className="btn sm" onClick={clear}>Limpiar filtros</button>
            : <Link className="btn sm" href="/app/agregar">Agregar uno a mano</Link>}
        </section>
      ) : (
        <div className="card px-2 pb-2 pt-1 sm:px-3" data-testid="movs-list" role="region" aria-label={countLabel(list.length)}>
          <div className="flex flex-wrap items-center justify-between gap-2.5 px-2 pb-1 pt-2.5">
            <p className="text-[13px] text-muted" data-testid="movs-count">
              <b className="num font-semibold text-ink">{list.length}</b> {list.length === 1 ? "movimiento" : "movimientos"} · gastos <span className="num text-ink">{fmtPEN(totals.expense)}</span>
              {shown.length < list.length && <> · mostrando <span className="num">{shown.length}</span></>}
            </p>
            <div className="segmented" role="group" aria-label="Orden">
              <button type="button" aria-pressed={sort === "fecha"} onClick={() => { setSort("fecha"); setPage(1); }}>Recientes</button>
              <button type="button" aria-pressed={sort === "monto"} onClick={() => { setSort("monto"); setPage(1); }}>Mayor monto</button>
            </div>
          </div>
          {groups ? groups.map((g) => (
            <section key={g.day} aria-label={g.label}>
              <h2 className="sticky top-0 z-[1] flex items-center justify-between gap-3 border-b border-line-soft bg-card px-3 pb-2 pt-3.5 text-[11px] font-semibold uppercase tracking-[.88px] text-muted">
                <span>{g.label}</span>
                {g.expense > 0 && <span className="num text-[12px] font-medium normal-case tracking-normal">−{fmtPEN(g.expense)}</span>}
              </h2>
              <ul className="grid gap-0.5 py-1.5">{g.txs.map(renderRow)}</ul>
            </section>
          )) : (
            <ul className="grid gap-0.5 py-1.5" aria-label="Ordenados por monto">{shown.map(renderRow)}</ul>
          )}
          {shown.length < list.length && (
            <div className="flex justify-center pb-2 pt-3">
              <button type="button" className="btn" onClick={() => setPage((p) => p + 1)} data-testid="movs-more">Mostrar más</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
