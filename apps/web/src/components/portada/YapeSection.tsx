"use client";

/**
 * Sección "Desde tu iPhone": Yape notifica un yapeo recibido → la automatización de Atajos lo envía a tu script
 * (Web App, con tu token) → aparece en tu Sheet como "Recibido por Yape". Animación en bucle con datos ficticios;
 * solo corre en pantalla y con movimiento reducido queda en el estado final. Flujo real: docs/guides/como-funciona-iphone.md.
 */
import { useEffect, useRef, useState } from "react";
import { IconIphone } from "@/components/icons";
import { SectionHead } from "./DataPath";
import s from "./portada.module.css";

const SENDERS: [string, string][] = [["Ana P.", "36.40"], ["Carlos R.", "8.50"], ["María Q.", "120.00"]];
const STEPS = [
  ["Yape te avisa", "Llega la notificación de siempre: «Ana P. te envió S/ 36.40»."],
  ["Tu atajo la reenvía", "Una automatización de Atajos (iOS 27) manda ese texto por HTTPS a tu script, con tu llave."],
  ["Queda en tu Sheet", "Tu script la lee, descarta duplicados y la anota como «Recibido por Yape», aparte de tus ingresos."],
];

const reduced = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

export function YapeSection() {
  // fase: 0 pantalla bloqueada · 1 notificación · 2 atajo corriendo · 3 enviado + paquete en camino · 4 fila en la Sheet
  const [phase, setPhase] = useState(4);
  const [n, setN] = useState(0);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (reduced()) return;
    const el = box.current;
    let timers: ReturnType<typeof setTimeout>[] = [];
    let visible = false, running = false, i = 0;
    const at = (ms: number, fn: () => void) => timers.push(setTimeout(fn, ms));
    const cycle = () => {
      running = true;
      setN(i % SENDERS.length); setPhase(0);
      at(700, () => setPhase(1));
      at(2000, () => setPhase(2));
      at(3300, () => setPhase(3));
      at(4300, () => setPhase(4));
      at(7600, () => { i++; if (visible) cycle(); else running = false; });
    };
    if (!el || typeof IntersectionObserver === "undefined") { cycle(); return () => timers.forEach(clearTimeout); }
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible && !running) cycle(); }, { threshold: 0.35 });
    io.observe(el);
    return () => { io.disconnect(); timers.forEach(clearTimeout); timers = []; };
  }, []);

  const [who, amount] = SENDERS[n];
  return (
    <section id="iphone" aria-labelledby="iphone-h" className="scroll-mt-24 pt-20 sm:pt-[88px]">
      <SectionHead eyebrow="Desde tu iPhone" id="iphone-h" title="Los yapeos que recibes, también.">
        Yape no envía correo por los yapeos que recibes ni por los menores a S/ 10. Un atajo de tu iPhone reenvía esa notificación a tu script
        y queda en tu Sheet. Opcional, y sin pasar por Luca.
      </SectionHead>

      <div className={`${s.yape} mt-9`}>
        <ol className="grid content-start gap-3">
          {STEPS.map(([t, d], k) => (
            <li key={t} className={`card ${s.yapeStep}`} data-on={phase >= [1, 2, 4][k]}>
              <span className={s.yapeNum}>{k + 1}</span>
              <span><b className="block text-[15.5px] font-semibold">{t}</b><span className="text-[14px] text-body">{d}</span></span>
            </li>
          ))}
          <li className="flex flex-wrap gap-2 pt-1 text-[12.5px] text-muted">
            <span className="pill">Solo iPhone</span><span className="pill">No cuenta como ingreso</span><span className="pill">Luca no ve el evento</span>
          </li>
        </ol>

        <div ref={box} className={s.yapeStage} role="img" aria-label={`Ejemplo: ${who} te yapea S/ ${amount}, el atajo lo envía a tu script y aparece en tu Sheet`}>
          <div className={s.phone} aria-hidden>
            <div className={s.phoneIsland} />
            <div className={s.phoneTime}><span>9:41</span><small>domingo, 5 de octubre</small></div>
            <div className={s.notif} data-show={phase >= 1}>
              <span className={s.notifIcon}>Y</span>
              <span className="min-w-0">
                <span className="flex justify-between gap-2 text-[11px] text-[#6b6b6b]"><b className="font-semibold text-[#1d1a17]">Yape</b>ahora</span>
                <span className="block truncate text-[12px] font-semibold text-[#1d1a17]">Confirmación de pago</span>
                <span className="block truncate text-[12px] text-[#3a3a3a]">{who} te envió S/ {amount}</span>
              </span>
            </div>
            <div className={s.shortcut} data-show={phase >= 2} data-done={phase >= 3}>
              {phase >= 3 ? <span className={s.shortcutOk}>✓</span> : <span className={s.shortcutSpin} />}
              <span>{phase >= 3 ? "Enviado a tu script" : "Luca – Captura Yape"}</span>
            </div>
          </div>

          <div className={s.wire} data-run={phase === 3} aria-hidden><i /></div>

          <div className={`card ${s.sheetMini}`} aria-hidden>
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="text-[12.5px] font-semibold">Movimientos</span>
              <span className="inline-flex items-center gap-1.5 text-[11px] text-muted"><IconIphone size={13} />tu Sheet</span>
            </div>
            <div className={s.sheetRow} data-new={phase >= 4} key={`${n}-${phase >= 4}`}>
              <span className="truncate font-medium">{phase >= 4 ? `${who.replace(".", "")}*` : "—"}</span>
              <span className="text-muted">{phase >= 4 ? "Recibido por Yape" : ""}</span>
              <span className="num text-success">{phase >= 4 ? `+S/ ${amount}` : ""}</span>
            </div>
            {[["RAPPI", "Comidas fuera", "−S/ 38.70"], ["WONG", "Supermercado", "−S/ 86.40"], ["UBER *TRIP", "Transporte", "−S/ 14.90"]].map(([a, b, c]) => (
              <div key={a} className={s.sheetRow}><span className="truncate">{a}</span><span className="text-muted">{b}</span><span className="num">{c}</span></div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
