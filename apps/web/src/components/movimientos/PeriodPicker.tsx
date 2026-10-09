"use client";

/**
 * Selector de periodo de Movimientos (DESIGN.md §Components · Selector de periodo). El botón dice qué se ve
 * ("Todos los meses", "Octubre 2026", "15 sep – 4 oct 2026") y abre un panel anclado con "Todos los meses", los
 * meses por año (solo los que tienen movimientos) y "Personalizado": calendario por días donde dos toques marcan
 * el rango (con ratón) o, en táctil, dos `<input type="date">` nativos para que el teléfono use su calendario.
 */
import { useCallback, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MESES_ES } from "@/lib/ledger";
import { DIAS_SEMANA, addMonths, monthMatrix, monthsByYear, periodLabel, rangeLabel, shortMonth } from "@/lib/periodo";
import { monthTitle } from "@/lib/resumen";
import { useCoarsePointer } from "../Dropdown";
import { IconCalendario, IconChevron } from "../icons";
import { useAnchoredPanel } from "../popover";

type Period = { mes: string; desde: string; hasta: string };
type Props = {
  value: Period;
  /** Meses con movimientos ("YYYY-MM"). */
  months: string[];
  /** Días con movimientos ("YYYY-MM-DD"): punto bajo el número en el calendario. */
  days: Set<string>;
  today: string;
  onChange: (p: Partial<Period>) => void;
};

const fullDay = (ymd: string) => `${Number(ymd.slice(8, 10))} ${shortMonth(ymd.slice(0, 7))} ${ymd.slice(0, 4)}`;

export default function PeriodPicker({ value, months, days, today, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"meses" | "rango">("meses");
  const btn = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const titleId = useId();

  const close = useCallback((focus = true) => { setOpen(false); if (focus) btn.current?.focus(); }, []);
  const closeOutside = useCallback(() => close(false), [close]);
  const { style } = useAnchoredPanel(open, btn, panel, closeOutside);
  const apply = (p: Partial<Period>) => { onChange(p); close(); };
  const custom = !!(value.desde || value.hasta);
  // Al abrir o cambiar de vista, el foco va a lo elegido (o al primer control) dentro del panel.
  useLayoutEffect(() => {
    if (!open || !panel.current) return;
    (panel.current.querySelector<HTMLElement>('[aria-pressed="true"]:not(:disabled)') ?? panel.current.querySelector<HTMLElement>("button:not(:disabled), input"))?.focus({ preventScroll: true });
  }, [open, view]);

  return (
    <>
      <button ref={btn} type="button" className="btn dd-trigger" aria-haspopup="dialog" aria-expanded={open} data-testid="period-picker"
        onClick={() => { if (open) return close(); setView(custom ? "rango" : "meses"); setOpen(true); }}>
        <IconCalendario />
        <span className="max-w-[44vw] truncate sm:max-w-none">{periodLabel(value)}</span>
        <IconChevron dir="down" size={14} className="dd-caret" />
      </button>
      {open && createPortal(
        <div ref={panel} role="dialog" aria-labelledby={titleId} className="dd-menu period" style={style} data-testid="period-panel"
          onKeyDown={(e) => { if (e.key === "Escape") { e.stopPropagation(); close(); } }}>
          <h2 id={titleId} className="sr-only">Elegir periodo</h2>
          {view === "meses"
            ? <MonthsView value={value} months={months} today={today} onPick={apply} onCustom={() => setView("rango")} />
            : <RangeView value={value} days={days} today={today} onApply={apply} onBack={() => setView("meses")} />}
        </div>,
        document.body,
      )}
    </>
  );
}

function MonthsView({ value, months, today, onPick, onCustom }: { value: Period; months: string[]; today: string; onPick: (p: Partial<Period>) => void; onCustom: () => void }) {
  const has = new Set(months);
  const all = !value.mes && !value.desde && !value.hasta;
  const years = monthsByYear(months.length ? months : [today.slice(0, 7)]);
  return (
    <div className="grid gap-1">
      <button type="button" className={`dd-opt ${all ? "active" : ""}`} aria-pressed={all} onClick={() => onPick({ mes: "", desde: "", hasta: "" })}>
        <span className="flex-1">Todos los meses</span>{all && <span className="dd-check" aria-hidden>✓</span>}
      </button>
      {years.map(({ year }) => (
        <div key={year} className="grid gap-1">
          <div className="dd-head">{year}</div>
          <div className="grid grid-cols-4 gap-1" role="group" aria-label={`Meses de ${year}`}>
            {MESES_ES.map((name, i) => {
              const m = `${year}-${String(i + 1).padStart(2, "0")}`;
              const on = value.mes === m;
              return (
                <button key={m} type="button" className="cal-cell month" aria-pressed={on} disabled={!has.has(m)}
                  aria-label={monthTitle(m)} title={has.has(m) ? undefined : "Sin movimientos"} onClick={() => onPick({ mes: m })}>{name}</button>
              );
            })}
          </div>
        </div>
      ))}
      <button type="button" className="dd-opt mt-1 border-t border-line-soft pt-2" onClick={onCustom} data-testid="period-custom">
        <IconCalendario size={16} /><span className="flex-1">Personalizado…</span><IconChevron dir="right" size={14} className="text-muted" />
      </button>
    </div>
  );
}

function RangeView({ value, days, today, onApply, onBack }: { value: Period; days: Set<string>; today: string; onApply: (p: Partial<Period>) => void; onBack: () => void }) {
  const coarse = useCoarsePointer();
  const [desde, setDesde] = useState(value.desde);
  const [hasta, setHasta] = useState(value.hasta);
  const [hover, setHover] = useState("");
  const [month, setMonth] = useState((value.hasta || value.desde || (value.mes ? `${value.mes}-01` : today)).slice(0, 7));

  // Primer toque: inicio. Segundo: fin (si es anterior al inicio, se intercambian). Un tercero empieza de nuevo.
  const tap = (d: string) => {
    if (!desde || hasta) { setDesde(d); setHasta(""); return; }
    if (d < desde) { setHasta(desde); setDesde(d); } else setHasta(d);
  };
  const end = hasta || (desde && hover >= desde ? hover : "");
  const label = desde || hasta ? rangeLabel(desde || hasta, hasta || desde) : coarse ? "Elige las fechas" : "Elige el primer día";

  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between gap-2">
        <button type="button" className="btn ghost sm -ml-1.5 gap-1 px-2" onClick={onBack}><IconChevron dir="left" size={14} />Periodos</button>
        {!coarse && (
          <div className="flex items-center gap-0.5">
            <button type="button" className="btn ghost sm icon w-8" aria-label="Mes anterior" onClick={() => setMonth(addMonths(month, -1))}><IconChevron dir="left" size={16} /></button>
            <span className="min-w-[118px] text-center text-[13.5px] font-medium text-ink" aria-live="polite">{monthTitle(month)}</span>
            <button type="button" className="btn ghost sm icon w-8" aria-label="Mes siguiente" disabled={month >= today.slice(0, 7)} onClick={() => setMonth(addMonths(month, 1))}><IconChevron dir="right" size={16} /></button>
          </div>
        )}
      </div>

      {coarse ? (
        <div className="grid grid-cols-2 gap-2">
          <label className="field grid gap-1"><span className="text-[12.5px] text-body">Desde</span>
            <input type="date" className="input" value={desde} max={hasta || today} onChange={(e) => setDesde(e.target.value)} data-testid="period-desde" /></label>
          <label className="field grid gap-1"><span className="text-[12.5px] text-body">Hasta</span>
            <input type="date" className="input" value={hasta} min={desde || undefined} max={today} onChange={(e) => setHasta(e.target.value)} data-testid="period-hasta" /></label>
        </div>
      ) : (
        <div role="grid" aria-label={`Días de ${monthTitle(month)}`} onPointerLeave={() => setHover("")}>
          <div role="row" className="grid grid-cols-7 gap-0.5 pb-1">
            {DIAS_SEMANA.map((d) => <span key={d} role="columnheader" className="text-center text-[11px] font-medium text-muted">{d}</span>)}
          </div>
          {monthMatrix(month).map((week, i) => (
            <div key={i} role="row" className="grid grid-cols-7 gap-0.5">
              {week.map((d, j) => {
                if (!d) return <span key={j} role="gridcell" />;
                const edge = d === desde || d === end;
                const inside = !!desde && !!end && d > desde && d < end;
                return (
                  <span key={d} role="gridcell">
                    <button type="button" className={`cal-cell day ${inside ? "inside" : ""} ${d === today ? "today" : ""}`} aria-pressed={edge}
                      disabled={d > today} aria-label={fullDay(d)} onClick={() => tap(d)} onPointerEnter={() => setHover(d)} data-day={d}>
                      {Number(d.slice(8, 10))}{days.has(d) && <i className="cal-dot" aria-hidden />}
                    </button>
                  </span>
                );
              })}
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between gap-3 border-t border-line-soft pt-2">
        <span className="min-w-0 truncate text-[12.5px] text-body" aria-live="polite" data-testid="period-range-label">{label}</span>
        <button type="button" className="btn primary sm flex-none" disabled={!desde && !hasta} data-testid="period-apply"
          onClick={() => onApply({ mes: "", desde: desde || hasta, hasta: hasta || desde })}>Aplicar</button>
      </div>
    </div>
  );
}
