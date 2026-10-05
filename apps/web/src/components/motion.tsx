"use client";

/** Utilidades de movimiento (DESIGN.md §Motion). Todo respeta prefers-reduced-motion. */
import { useLayoutEffect, useRef, useState } from "react";

const reduced = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/**
 * Cuenta desde el valor anterior (0 la primera vez) hasta `value` en `ms`, con ease-out.
 * El estado inicial es `value` en servidor y cliente (sin error de hidratación); el efecto de layout
 * programa el primer cuadro antes del pintado, así que no se ve el valor final antes de contar.
 * Con movimiento reducido salta al valor final.
 */
export function useCountUp(value: number, ms = 600): number {
  const [shown, setShown] = useState(value);
  const from = useRef(0);
  useLayoutEffect(() => {
    const dur = reduced() || !Number.isFinite(value) ? 0 : ms;
    const start = performance.now(), a = Number.isFinite(from.current) ? from.current : 0, b = value;
    let raf = 0;
    const tick = (t: number) => {
      const k = dur ? Math.min(1, (t - start) / dur) : 1;
      const e = 1 - Math.pow(1 - k, 3);
      setShown(a + (b - a) * e);
      if (k < 1) raf = requestAnimationFrame(tick); else from.current = b;
    };
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); from.current = b; };
  }, [value, ms]);
  return shown;
}

/** Número que cuenta hasta su valor, formateado con `format` (p. ej. fmtPEN). */
export function CountUp({ value, format, ms }: { value: number; format: (n: number) => string; ms?: number }) {
  const n = useCountUp(value, ms);
  return <>{format(Math.round(n * 100) / 100)}</>;
}

/**
 * true solo en la primera vista de `key` en esta pestaña: para animar entradas una vez y no en cada
 * navegación (DESIGN.md: "no animar en cada visita lo que ya se vio").
 */
export function useFirstView(key: string): boolean {
  const [first] = useState(() => {
    try { const k = `luca.seen.${key}`; if (sessionStorage.getItem(k)) return false; sessionStorage.setItem(k, "1"); return true; } catch { return true; }
  });
  return first;
}

/** Check que se dibuja (confirmaciones). */
export function DrawCheck({ size = 18, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden className={`pop ${className}`}>
      <circle cx="12" cy="12" r="11" fill="var(--success)" />
      <path d="M7 12.5l3.2 3.2L17 9" fill="none" stroke="var(--card)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" pathLength={100} className="draw" style={{ animationDelay: "120ms" }} />
    </svg>
  );
}
