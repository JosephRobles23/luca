"use client";

/**
 * "Captura" del panel en un marco de navegador. Es ilustrativa: datos ficticios, marcados como ejemplo.
 * La cifra cuenta hasta su valor, la barra de ritmo y la de categorías se llenan y las filas entran escalonadas.
 */
import { useEffect, useState } from "react";
import { catColor } from "@/lib/categorias";
import CategoryIcon from "@/components/CategoryIcon";
import s from "./portada.module.css";

/**
 * Como useCountUp (components/motion) pero siempre parte de 0 en el primer render, para que el HTML del
 * servidor y el del cliente coincidan (useCountUp arranca en el valor final con movimiento reducido).
 */
function useCount(value: number, ms: number): number {
  const [n, setN] = useState(0);
  useEffect(() => {
    const dur = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ? 0 : ms;
    const start = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const k = dur ? Math.min(1, (t - start) / dur) : 1;
      setN(value * (1 - Math.pow(1 - k, 3)));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, ms]);
  return n;
}

const fmt = (n: number) => n.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const CATS: [string, number][] = [["Supermercado", 34], ["Comidas fuera", 22], ["Transporte", 14], ["Suscripciones", 11], ["Otros", 19]];
const HOY: { who: string; cat: string; src: "BCP" | "Yape"; amt: string; pen?: string }[] = [
  { who: "MINIMARKET LA ESQUINA", cat: "Supermercado", src: "BCP", amt: "−S/ 42.60" },
  { who: "STREAMING*PLUS", cat: "Suscripciones", src: "BCP", amt: "−$ 9.99", pen: "≈ S/ 34.50" },
  { who: "Yape a Panadería Sol*", cat: "Comidas fuera", src: "Yape", amt: "−S/ 8.50" },
  { who: "TAXI APP", cat: "Transporte", src: "BCP", amt: "−S/ 14.90" },
];

export function PanelShot() {
  const spent = useCount(1286.4, 900);
  const today = useCount(100.5, 900);
  return (
    <figure className={s.shot} aria-label="Ejemplo ilustrativo del panel de Luca, con datos ficticios">
      <div className={s.shotBar} aria-hidden>
        <i /><i /><i />
        <span className={s.shotUrl}>lucaa.lat/app</span>
        <span className="tag ml-auto shrink-0">Ejemplo<span className="hidden sm:inline"> · datos ficticios</span></span>
      </div>
      <div className={s.shotIn}>
        <div className="card grid content-start gap-0">
          <div className="eyebrow">Gastado este mes</div>
          <div className="amount-hero mt-3" style={{ fontSize: "clamp(32px, 4.4vw, 44px)" }}>
            <span className="cur mr-1 align-[.55em] text-[.5em] tracking-normal">S/</span>{fmt(spent)}
          </div>
          <div className="mt-3"><span className="pill bg-success-soft font-semibold text-success">↓ 8 % vs el mes pasado a la fecha</span></div>
          <div className="mt-5 grid gap-2">
            <div className={s.paceBar}>
              <span className={`${s.paceFill} grow-x`} style={{ width: "62%", animationDelay: "250ms", animationDuration: ".9s" }} />
              <span className={`${s.paceMark} pop`} style={{ left: "58%", animationDelay: "900ms" }} />
            </div>
            <div className="flex flex-wrap justify-between gap-x-4 gap-y-1 text-[12.5px] text-muted">
              <span><b className="font-semibold text-ink">62 %</b> de lo del mes pasado</span><span>día 18 de 31</span>
            </div>
          </div>
          <div className="mt-5 hidden sm:block">
            <div className="flex h-3 gap-0.5 overflow-hidden rounded-full">
              {CATS.map(([c, p], i) => (
                <i key={c} className="grow-x block h-full" style={{ width: `${p}%`, background: catColor(c), ["--i" as string]: i + 4 }} />
              ))}
            </div>
            <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[12.5px] text-muted">
              {CATS.map(([c, p]) => (
                <li key={c} className="inline-flex items-center gap-1.5"><i className="block size-2 rounded-[3px]" style={{ background: catColor(c) }} />{c} <span className="num">{p} %</span></li>
              ))}
            </ul>
          </div>
        </div>
        <div className="card">
          <div className="mb-2 flex items-baseline justify-between gap-3">
            <h3 className="card-title">Hoy</h3>
            <span className="num text-[13px] text-muted">S/ {fmt(today)}</span>
          </div>
          <ul className="grid">
            {HOY.map((t, i) => (
              <li key={t.who} className="rise grid grid-cols-[36px_minmax(0,1fr)_auto] items-center gap-3 py-2" style={{ ["--i" as string]: i + 6 }}>
                <span className={s.avatar} style={{ background: catColor(t.cat) }}><CategoryIcon categoria={t.cat} /></span>
                <div className="min-w-0">
                  <div className="truncate text-[14.5px] font-semibold">{t.who}</div>
                  <div className="mt-0.5 flex items-center gap-1.5 text-[12.5px] text-muted">{t.cat} <span className="tag">{t.src}</span></div>
                </div>
                <span className="num whitespace-nowrap text-right text-[14.5px] font-medium">
                  {t.amt}{t.pen && <small className="block text-[11.5px] font-normal text-muted">{t.pen}</small>}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </figure>
  );
}
