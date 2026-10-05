"use client";

/**
 * Demo del mosaico "Movimientos que llegan solos": cada pocos segundos llega un correo del banco, entra un
 * movimiento arriba de la lista y, tras un instante "leyendo", recibe su categoría con el color de la paleta.
 * Datos ficticios. Solo corre en pantalla; con movimiento reducido muestra la lista ya categorizada.
 */
import { useEffect, useRef, useState } from "react";
import { catColor } from "@/lib/categorias";
import CategoryIcon from "@/components/CategoryIcon";
import s from "./portada.module.css";

type Move = { who: string; cat: string; amount: string; sub?: string; src: "BCP" | "Yape" };

const POOL: Move[] = [
  { who: "WONG", cat: "Supermercado", amount: "−S/ 86.40", src: "BCP" },
  { who: "UBER *TRIP", cat: "Transporte", amount: "−S/ 14.90", src: "BCP" },
  { who: "SPOTIFY", cat: "Suscripciones", amount: "−$ 5.99", sub: "≈ S/ 21.50", src: "BCP" },
  { who: "Yape a Ana P*", cat: "Transferencias", amount: "−S/ 25.00", src: "Yape" },
  { who: "RAPPI", cat: "Comidas fuera", amount: "−S/ 38.70", src: "BCP" },
  { who: "LUZ DEL SUR", cat: "Servicios", amount: "−S/ 112.30", src: "BCP" },
  { who: "INKAFARMA", cat: "Salud", amount: "−S/ 23.10", src: "BCP" },
  { who: "CINEPLANET", cat: "Ocio", amount: "−S/ 32.00", src: "BCP" },
];
const SHOWN = 6;
const STEP_MS = 2400;
const READ_MS = 900;

type Row = Move & { key: number; read: boolean };
const initial = (): Row[] => POOL.slice(0, SHOWN).map((m, i) => ({ ...m, key: i, read: true }));
const reduced = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

export function MovesFeed() {
  const [rows, setRows] = useState<Row[]>(initial);
  const [ping, setPing] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (reduced()) return;
    const el = box.current;
    let next = SHOWN, timer: ReturnType<typeof setInterval> | null = null;
    const timeouts: ReturnType<typeof setTimeout>[] = [];
    const tick = () => {
      const m = POOL[next % POOL.length], key = next++;
      setPing(true);
      timeouts.push(setTimeout(() => setPing(false), 700));
      setRows((r) => [{ ...m, key, read: false }, ...r].slice(0, SHOWN));
      timeouts.push(setTimeout(() => setRows((r) => r.map((x) => (x.key === key ? { ...x, read: true } : x))), READ_MS));
    };
    const start = () => { if (!timer) { tick(); timer = setInterval(tick, STEP_MS); } };
    const stop = () => { if (timer) clearInterval(timer); timer = null; };
    if (!el || typeof IntersectionObserver === "undefined") { start(); return () => { stop(); timeouts.forEach(clearTimeout); }; }
    const io = new IntersectionObserver(([e]) => (e.isIntersecting ? start() : stop()), { threshold: 0.3 });
    io.observe(el);
    return () => { io.disconnect(); stop(); timeouts.forEach(clearTimeout); };
  }, []);

  return (
    <div ref={box} className={s.feed} role="img" aria-label="Ejemplo: movimientos que llegan del correo del banco y se categorizan solos">
      <div className={s.feedHead} aria-hidden>
        <span className={`${s.feedMail} ${ping ? s.feedPing : ""}`}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></svg>
          Correo del banco
        </span>
        <span className={s.feedArrow} />
        <span className="text-[11.5px] text-muted">tu Sheet · Movimientos</span>
      </div>
      <ul className={s.feedList} aria-hidden>
        {rows.map((r) => (
          <li key={r.key} className={s.feedRow}>
            <span className={s.feedAvatar} style={{ background: r.read ? catColor(r.cat) : "var(--strong)" }}>{r.read ? <CategoryIcon categoria={r.cat} size={17} className="pop" /> : <span className={s.feedDots}><i /><i /><i /></span>}</span>
            <span className="min-w-0">
              <span className="block truncate font-medium text-ink">{r.who}</span>
              <span className="mt-0.5 flex items-center gap-1.5">
                {r.read
                  ? <span className={s.feedCat}><i style={{ background: catColor(r.cat) }} />{r.cat}</span>
                  : <span className={s.feedReading}>Leyendo…</span>}
                <span className="tag">{r.src}</span>
              </span>
            </span>
            <span className="num whitespace-nowrap text-right text-ink">{r.amount}{r.sub && <span className="block text-[11px] text-muted">{r.sub}</span>}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
