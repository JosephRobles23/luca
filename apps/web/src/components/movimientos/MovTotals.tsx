"use client";

/**
 * Banda de totales de Movimientos (DESIGN.md §Layout · Movimientos): suma de lo que estás viendo. Gastos con barras
 * por día del mes filtrado (sin Vivienda), ingresos, recibido por Yape y "Por categorizar", que filtra al tocarlo.
 */
import { fmtPEN, MESES_ES } from "@/lib/ledger";
import type { FilterTotals } from "@/lib/movimientos";
import { CountUp } from "../motion";

const num = (n: number) => n.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

type Props = {
  totals: FilterTotals;
  bars: { day: number; amount: number; future: boolean }[];
  barsMonth: string;
  pending: number;
  pendingOn: boolean;
  onPending: () => void;
  className?: string;
};

export default function MovTotals({ totals, bars, barsMonth, pending, pendingOn, onPending, className = "" }: Props) {
  const max = Math.max(1, ...bars.map((b) => b.amount));
  const hot = Math.max(...bars.map((b) => b.amount));
  const mes = MESES_ES[Number(barsMonth.slice(5, 7)) - 1];
  return (
    <section className={`card grid overflow-hidden !p-0 sm:grid-cols-3 lg:grid-cols-[minmax(0,1.7fr)_repeat(3,minmax(0,1fr))] ${className}`} aria-label="Totales del filtro" data-testid="movs-totals">
      <div className="grid content-start gap-2.5 px-[18px] py-4 sm:col-span-3 lg:col-span-1">
        <span className="eyebrow">Gastos filtrados</span>
        <div className="flex flex-wrap items-baseline justify-between gap-x-3.5 gap-y-1">
          <div className="num whitespace-nowrap text-[clamp(28px,3.6vw,38px)] font-medium leading-[1.1] tracking-[-0.045em]" data-testid="movs-total-expense">
            <span className="cur">S/</span> <CountUp value={totals.expense} format={num} ms={450} />
          </div>
          <span className="text-[12px] text-muted">{totals.expenseCount ? `${totals.expenseCount} ${totals.expenseCount === 1 ? "gasto" : "gastos"} · promedio ${fmtPEN(totals.expense / totals.expenseCount)}` : "Sin gastos en este filtro"}</span>
        </div>
        <div className="grid gap-1">
          <div className="flex h-11 items-end gap-[3px]" role="img" aria-label={`Gasto por día de ${mes}, sin vivienda`} data-testid="movs-bars">
            {bars.map((b) => (
              <span key={b.day} title={b.future || !b.amount ? undefined : `${b.day} ${mes}: ${fmtPEN(b.amount)}`}
                className={`min-w-[2px] flex-1 rounded-t-[3px] rounded-b-[1px] ${b.amount && !b.future ? "bg-primary" : "bg-strong"}`}
                style={{ height: b.amount && !b.future ? `${Math.max(8, (b.amount / max) * 100)}%` : "3px", opacity: b.future ? 0.5 : b.amount && b.amount !== hot ? 0.5 : 1 }} />
            ))}
          </div>
          <div className="num flex justify-between text-[10.5px] text-muted"><span>1</span><span>Por día · {mes} · sin vivienda</span><span>{bars.length}</span></div>
        </div>
      </div>
      <Stat label="Ingresos" tone="text-success" value={totals.income} sub={totals.incomeCount ? `${totals.incomeCount} ${totals.incomeCount === 1 ? "abono" : "abonos"}` : "Sin ingresos"} testId="movs-total-income" />
      <Stat label="Recibido por Yape" value={totals.yape} sub="No cuenta como ingreso" testId="movs-total-yape" />
      <button type="button" onClick={onPending} aria-pressed={pendingOn} title="Ver solo los que faltan categorizar" data-testid="movs-pending-toggle"
        className="grid content-start gap-1 border-t border-line px-[18px] py-4 text-left transition-colors hover:bg-sunken aria-pressed:bg-sunken aria-pressed:shadow-[inset_0_-2px_0_var(--primary)] sm:border-l lg:border-t-0">
        <span className="eyebrow">Por categorizar</span>
        <span className="num text-[20px] font-medium tracking-[-0.03em] text-warning">{pending}</span>
        <span className="text-[12px] text-muted">{pendingOn ? "Toca para ver todos" : "Toca para revisarlos →"}</span>
      </button>
    </section>
  );
}

function Stat({ label, value, sub, tone = "", testId }: { label: string; value: number; sub: string; tone?: string; testId: string }) {
  return (
    <div className="grid content-start gap-1 border-t border-line px-[18px] py-4 sm:[&:nth-child(3)]:border-l lg:border-l lg:border-t-0" data-testid={testId}>
      <span className="eyebrow">{label}</span>
      <span className={`num whitespace-nowrap text-[20px] font-medium tracking-[-0.03em] ${tone}`}><CountUp value={value} format={num} ms={450} /></span>
      <span className="text-[12px] text-muted">{sub}</span>
    </div>
  );
}
