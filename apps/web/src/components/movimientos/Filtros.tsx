"use client";

/**
 * Filtros de Movimientos (DESIGN.md §Layout · Movimientos): buscador, chips de tipo con contadores,
 * "Más filtros" desplegable (mes, fuente, categoría) y los filtros activos como chips descartables.
 */
import { useId, useState } from "react";
import { monthLabel } from "@/lib/ledger";
import { PENDING, TIPO_CHIPS, activeFilterChips, moreFiltersCount, type Filters } from "@/lib/movimientos";
import { IconAjustes, IconBuscar, IconCerrar, IconChevron } from "../icons";
import { Field, SRC_LABEL, Select } from "../ui";

type Props = {
  f: Filters;
  setF: (patch: Partial<Filters>) => void;
  counts: Record<string, number>;
  months: string[];
  fuentes: string[];
  categorias: string[];
};

export default function Filtros({ f, setF, counts, months, fuentes, categorias }: Props) {
  const more = moreFiltersCount(f);
  const [open, setOpen] = useState(more > 0);
  const panel = useId();
  const active = activeFilterChips(f, SRC_LABEL);

  return (
    <form className="grid gap-3" onSubmit={(e) => e.preventDefault()} role="search" aria-label="Filtrar movimientos">
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex h-[42px] min-w-0 flex-1 basis-[220px] items-center gap-2.5 rounded-xl border border-line bg-card px-3 text-muted transition-[border-color,box-shadow] focus-within:border-primary focus-within:shadow-[0_0_0_3px_color-mix(in_srgb,var(--primary)_18%,transparent)]">
          <IconBuscar />
          <span className="sr-only">Buscar</span>
          <input id="f-q" type="search" className="h-full min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-muted"
            placeholder="Comercio, persona, asunto…" value={f.q} style={{ outline: "none" }} onChange={(e) => setF({ q: e.target.value })} data-testid="filter-q" />
        </label>
        <button type="button" className="btn" aria-expanded={open} aria-controls={panel} onClick={() => setOpen((o) => !o)}>
          <IconAjustes />Más filtros
          {more > 0 && <span className="num grid h-5 min-w-5 place-items-center rounded-full bg-strong px-1.5 text-[11px] text-ink">{more}</span>}
          <IconChevron dir={open ? "up" : "down"} size={16} />
        </button>
      </div>

      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Tipo de movimiento" data-testid="filter-tipo">
        {TIPO_CHIPS.map((c) => (
          <button key={c.value || "all"} type="button" className="chip" aria-pressed={f.tipo === c.value} data-value={c.value} onClick={() => setF({ tipo: c.value })}>
            {c.label}<span className={`num text-[12px] ${f.tipo === c.value ? "opacity-70" : "text-muted"}`}>{counts[c.value] ?? 0}</span>
          </button>
        ))}
      </div>

      <div id={panel} className="expand" data-open={open} inert={!open}>
        <div>
          <div className="grid gap-3 pt-1 sm:grid-cols-3">
            <Field label="Mes" htmlFor="f-mes">
              <Select id="f-mes" value={f.mes} onChange={(e) => setF({ mes: e.target.value })}>
                <option value="">Todos</option>
                {months.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
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
                <option value={PENDING}>Por categorizar</option>
                {categorias.map((c) => <option key={c} value={c}>{c}</option>)}
              </Select>
            </Field>
          </div>
        </div>
      </div>

      {active.length > 0 && (
        <ul className="flex flex-wrap items-center gap-1.5" aria-label="Filtros activos">
          {active.map((c) => (
            <li key={c.key}>
              <button type="button" className="chip bg-sunken" onClick={() => setF({ [c.key]: "" })} aria-label={`Quitar filtro ${c.label}`}>
                {c.label}<IconCerrar size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </form>
  );
}
