"use client";

/**
 * Panel flotante anclado a un botón (Dropdown, selector de periodo): va en un portal con `position: fixed` (las
 * tarjetas con animación u `overflow` lo taparían o recortarían), se abre hacia abajo o hacia arriba según quepa,
 * se alinea a la derecha del botón si se saldría de la ventana, sigue al botón con el scroll, el cambio de tamaño
 * de la ventana o del propio panel, y avisa al tocar fuera.
 */
import { useEffect, useLayoutEffect, useState, type RefObject } from "react";

export type PanelPos = { top: number; left: number; minWidth: number; up: boolean };

export function useAnchoredPanel(open: boolean, anchor: RefObject<HTMLElement | null>, panel: RefObject<HTMLElement | null>, onOutside: () => void) {
  const [measured, setPos] = useState<PanelPos | null>(null);

  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      if (!anchor.current || !panel.current) return;
      const r = anchor.current.getBoundingClientRect();
      const h = panel.current.offsetHeight, w = Math.max(panel.current.offsetWidth, r.width);
      const up = r.bottom + h + 8 > innerHeight && r.top > h + 8;
      const left = Math.max(8, r.left + w > innerWidth - 8 ? r.right - w : r.left);
      setPos({ top: up ? r.top - h - 6 : Math.max(8, r.bottom + 6), left, minWidth: r.width, up });
    };
    place();
    const ro = new ResizeObserver(place);
    if (panel.current) ro.observe(panel.current);
    addEventListener("resize", place);
    addEventListener("scroll", place, true);
    return () => { ro.disconnect(); removeEventListener("resize", place); removeEventListener("scroll", place, true); };
  }, [open, anchor, panel]);

  useEffect(() => {
    if (!open) return;
    const out = (e: PointerEvent) => { const t = e.target as Node; if (!anchor.current?.contains(t) && !panel.current?.contains(t)) onOutside(); };
    document.addEventListener("pointerdown", out);
    return () => document.removeEventListener("pointerdown", out);
  }, [open, anchor, panel, onOutside]);

  // Cerrado no hay posición; al reabrir, el efecto vuelve a medir antes de pintar.
  const pos = open ? measured : null;
  /** Estilo del panel: oculto hasta medirlo. */
  const style = pos ? { top: pos.top, left: pos.left } : { top: 0, left: 0, visibility: "hidden" as const };
  return { pos, style };
}
