"use client";

/**
 * Movimientos (DESIGN.md §Layout · Movimientos): título + total filtrado → buscador, chips de tipo y
 * "Más filtros" → lista agrupada por día con detalle desplegable por fila.
 */
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState, type CSSProperties } from "react";
import { fmtPEN, todayLima } from "@/lib/ledger";
import { groupByDay } from "@/lib/dias";
import {
  EMPTY_FILTERS, applyFilters, countByTipo, countLabel, expenseTotal, filtersToQuery, fuentesOf, hasFilters, monthsOf, parseFilters, type Filters,
} from "@/lib/movimientos";
import { useLedger } from "./LedgerProvider";
import { useFirstView } from "./motion";
import { IconMas } from "./icons";
import Filtros from "./movimientos/Filtros";
import MovRow from "./movimientos/MovRow";

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
  const setF = (patch: Partial<Filters>) => setFState((prev) => ({ ...prev, ...patch }));
  const clear = () => setFState(EMPTY_FILTERS);

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
  const fuentes = useMemo(() => fuentesOf(txs), [txs]);
  const list = useMemo(() => applyFilters(txs, f), [txs, f]);
  const counts = useMemo(() => countByTipo(txs, f), [txs, f]);
  const total = useMemo(() => expenseTotal(list, usdRate), [list, usdRate]);
  const groups = useMemo(() => groupByDay(list, todayLima(), usdRate), [list, usdRate]);

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
  let row = 0;

  return (
    <div className="grid gap-5">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="page-title">Movimientos</h1>
          <p className="mt-1 text-sm text-muted" data-testid="movs-count">
            <span className="num text-ink">{list.length}</span> {list.length === 1 ? "movimiento" : "movimientos"} · gastos <span className="num text-ink">{fmtPEN(total)}</span>
            {filtered ? <> · <button type="button" className="underline underline-offset-2 hover:text-ink" onClick={clear}>limpiar filtros</button></> : null}
          </p>
        </div>
        <Link className="btn primary icon flex-none sm:w-auto sm:px-4 lg:hidden" href="/app/agregar" aria-label="Agregar movimiento"><IconMas /><span className="hidden sm:inline">Agregar</span></Link>
      </header>

      <Filtros f={f} setF={setF} counts={counts} months={months} fuentes={fuentes} categorias={categorias} />

      {!list.length ? (
        <section className="card grid justify-items-start gap-3 py-8">
          <p className="text-[15px] text-body">{filtered ? "Nada que mostrar con estos filtros." : "Aún no hay movimientos. Llegarán solos cuando tu script lea el correo."}</p>
          {filtered
            ? <button type="button" className="btn sm" onClick={clear}>Limpiar filtros</button>
            : <Link className="btn sm" href="/app/agregar">Agregar uno a mano</Link>}
        </section>
      ) : (
        <div className="card px-2 py-1 sm:px-3" data-testid="movs-list" role="region" aria-label={countLabel(list.length)}>
          {groups.map((g) => (
            <section key={g.day} aria-label={g.label}>
              <h2 className="sticky top-0 z-[1] flex items-center justify-between gap-3 border-b border-line-soft bg-card px-3 pb-2 pt-3.5 text-[12.5px] font-medium text-muted">
                <span>{g.label}</span>
                {g.expense > 0 && <span className="num">−{fmtPEN(g.expense)}</span>}
              </h2>
              <ul className="grid gap-0.5 py-1.5">
                {g.txs.map((t) => {
                  const i = row++;
                  const rise = first && i < RISE_ROWS;
                  return <MovRow key={t.id} t={t} usdRate={usdRate} className={rise ? "rise" : undefined} style={rise ? ({ "--i": i } as CSSProperties) : undefined} />;
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
