"use client";

/**
 * Desplegable de un valor (DESIGN.md §Components · Desplegable). Con puntero táctil es un `<select>` nativo, así el
 * teléfono usa su propio selector (en iPhone, el de iOS). Con ratón es un botón que abre un menú de la app: punto de
 * color por opción, ✓ en la elegida, ↑ ↓ Inicio Fin, letra para saltar, Enter elige, Esc cierra. El menú es un
 * panel anclado (`useAnchoredPanel`: portal, se abre hacia donde cabe). Ambos llevan `data-value` y el mismo `data-testid` en el control.
 */
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { useAnchoredPanel } from "./popover";
import { createPortal } from "react-dom";
import { IconChevron } from "./icons";

export type DropdownOption = { value: string; label: string; color?: string };

type Props = {
  value: string;
  options: DropdownOption[];
  onChange: (value: string) => void;
  ariaLabel?: string;
  /** Texto cuando `value` no está entre las opciones (p. ej. "+8 más"); en el select nativo es la opción vacía. */
  placeholder?: string;
  /** Encabezado del menú (solo con ratón). */
  header?: string;
  /** Contenido del botón; por defecto, la etiqueta elegida o el placeholder. */
  children?: ReactNode;
  id?: string;
  testId?: string;
  disabled?: boolean;
  /** Clases del control (botón o select). */
  className?: string;
  /** Clases del contenedor (p. ej. `w-full`). */
  wrapClassName?: string;
};

const coarseQuery = "(pointer: coarse)";
const subscribe = (cb: () => void) => { const m = matchMedia(coarseQuery); m.addEventListener("change", cb); return () => m.removeEventListener("change", cb); };
/** true en pantallas táctiles; en el servidor, false (el menú de la app) hasta hidratar. */
export const useCoarsePointer = () => useSyncExternalStore(subscribe, () => matchMedia(coarseQuery).matches, () => false);

export default function Dropdown({ value, options, onChange, ariaLabel, placeholder, header, children, id, testId, disabled, className = "", wrapClassName = "" }: Props) {
  const coarse = useCoarsePointer();
  const current = options.find((o) => o.value === value);
  const caret = <IconChevron dir="down" size={14} className="dd-caret" aria-hidden />;

  if (coarse) {
    return (
      <span className={`dd ${wrapClassName}`}>
        <select id={id} className={`${className} dd-native`} aria-label={ariaLabel} data-testid={testId} data-value={value} value={current ? value : ""}
          disabled={disabled} onChange={(e) => onChange(e.target.value)}>
          {!current && <option value="">{placeholder ?? ""}</option>}
          {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        {caret}
      </span>
    );
  }
  return <Menu {...{ value, options, onChange, ariaLabel, placeholder, header, children, id, testId, disabled, className, wrapClassName, current, caret }} />;
}

function Menu({ value, options, onChange, ariaLabel, placeholder, header, children, id, testId, disabled, className, wrapClassName, current, caret }:
  Props & { current?: DropdownOption; caret: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const wrap = useRef<HTMLSpanElement>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const listId = useId();
  const typed = useRef({ s: "", t: 0 });

  const close = useCallback((focus = true) => { setOpen(false); if (focus) btn.current?.focus(); }, []);
  const closeOutside = useCallback(() => close(false), [close]);
  const { pos, style } = useAnchoredPanel(open, btn, list, closeOutside);
  const choose = (i: number) => { const o = options[i]; if (!o) return; close(); if (o.value !== value) onChange(o.value); };
  const openAt = (i?: number) => { setActive(i ?? Math.max(0, options.findIndex((o) => o.value === value))); setOpen(true); };

  useLayoutEffect(() => { if (open) list.current?.focus({ preventScroll: true }); }, [open]);
  useEffect(() => { if (open) list.current?.querySelector<HTMLElement>(`[data-i="${active}"]`)?.scrollIntoView({ block: "nearest" }); }, [open, active]);

  function onListKey(e: React.KeyboardEvent) {
    const last = options.length - 1;
    const go = (i: number) => { e.preventDefault(); setActive(i); };
    if (e.key === "ArrowDown") go(active >= last ? 0 : active + 1);
    else if (e.key === "ArrowUp") go(active <= 0 ? last : active - 1);
    else if (e.key === "Home") go(0);
    else if (e.key === "End") go(last);
    else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); choose(active); }
    else if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); close(); }
    else if (e.key === "Tab") close(false);
    else if (e.key.length === 1) {
      // Letra para saltar: acumula lo tecleado en 0,7 s y busca desde la opción siguiente.
      const now = Date.now();
      typed.current = { s: (now - typed.current.t < 700 ? typed.current.s : "") + e.key.toLowerCase(), t: now };
      const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");
      const q = norm(typed.current.s);
      const order = [...options.keys()].map((k) => (k + active + (q.length === 1 ? 1 : 0)) % options.length);
      const hit = order.find((k) => norm(options[k].label).startsWith(q));
      if (hit !== undefined) setActive(hit);
    }
  }

  return (
    <span ref={wrap} className={`dd ${wrapClassName}`}>
      <button ref={btn} type="button" id={id} className={`${className} dd-trigger`} aria-label={ariaLabel} aria-haspopup="listbox" aria-expanded={open}
        aria-controls={open ? listId : undefined} data-testid={testId} data-value={value} disabled={disabled}
        onClick={() => (open ? close() : openAt())}
        onKeyDown={(e) => { if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); openAt(); } }}>
        {children ?? (current ? current.label : placeholder)}
        {caret}
      </button>
      {open && createPortal(
        <div ref={list} id={listId} role="listbox" tabIndex={-1} aria-label={ariaLabel} aria-activedescendant={`${listId}-${active}`}
          className={`dd-menu ${pos?.up ? "up" : ""}`} onKeyDown={onListKey}
          style={{ ...style, minWidth: Math.max(pos?.minWidth ?? 0, 220) }}>
          {header && <div className="dd-head" aria-hidden>{header}</div>}
          {options.map((o, i) => (
            <div key={o.value} id={`${listId}-${i}`} data-i={i} data-value={o.value} role="option" aria-selected={o.value === value}
              className={`dd-opt ${i === active ? "active" : ""}`} onPointerMove={() => setActive(i)} onClick={() => choose(i)}>
              {o.color && <i className="sw" style={{ background: o.color }} aria-hidden />}
              <span className="min-w-0 flex-1 truncate">{o.label}</span>
              {o.value === value && <span className="dd-check" aria-hidden>✓</span>}
            </div>
          ))}
          <div className="dd-keys" aria-hidden><span><kbd>↑</kbd><kbd>↓</kbd> moverse</span><span><kbd>↵</kbd> elegir</span><span><kbd>esc</kbd> cerrar</span></div>
        </div>,
        document.body,
      )}
    </span>
  );
}
