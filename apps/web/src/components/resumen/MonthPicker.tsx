"use client";

/**
 * Selector de mes ‹ mes › (DESIGN.md §Components · Selector de mes): flechas entre los meses disponibles,
 * el mes abre la lista completa (select nativo, `data-testid=month-select`) y ← → cambian de mes con el foco dentro.
 */
import { monthTitle, stepMonth } from "@/lib/resumen";
import { IconChevron } from "../icons";

export default function MonthPicker({ months, month, onChange }: { months: string[]; month: string; onChange: (m: string) => void }) {
  const prev = stepMonth(months, month, -1);
  const next = stepMonth(months, month, 1);
  const arrow = "grid h-10 w-10 place-items-center rounded-[9px] text-body transition-colors hover:bg-raised hover:text-ink disabled:cursor-default disabled:opacity-35 disabled:hover:bg-transparent";
  return (
    <div role="group" aria-label="Mes" className="inline-flex items-center gap-0.5 rounded-xl bg-strong p-[3px]"
      onKeyDown={(e) => {
        const to = e.key === "ArrowLeft" ? prev : e.key === "ArrowRight" ? next : undefined;
        if (to === undefined) return;
        e.preventDefault();
        if (to) onChange(to);
      }}>
      <button type="button" className={arrow} disabled={!prev} onClick={() => prev && onChange(prev)} aria-label={prev ? `Mes anterior: ${monthTitle(prev)}` : "No hay meses anteriores"}>
        <IconChevron dir="left" />
      </button>
      <span className="relative">
        <select data-testid="month-select" aria-label="Elegir mes" value={month} onChange={(e) => onChange(e.target.value)}
          className="min-h-10 cursor-pointer appearance-none rounded-[9px] bg-raised py-0 pl-3 pr-8 text-[13.5px] font-medium text-ink shadow-[0_1px_2px_rgba(0,0,0,.08)]">
          {months.map((m) => <option key={m} value={m}>{monthTitle(m)}</option>)}
        </select>
        <IconChevron dir="down" size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted" />
      </span>
      <button type="button" className={arrow} disabled={!next} onClick={() => next && onChange(next)} aria-label={next ? `Mes siguiente: ${monthTitle(next)}` : "No hay meses siguientes"}>
        <IconChevron dir="right" />
      </button>
    </div>
  );
}
