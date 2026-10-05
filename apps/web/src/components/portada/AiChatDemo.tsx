"use client";

/**
 * Demo del mosaico "Pregúntale a tu IA": una conversación que se escribe sola, alternando Claude y ChatGPT.
 * Pregunta → llamada a la herramienta MCP de Luca (`category_breakdown`, nombre real del Worker) → respuesta
 * que llega palabra a palabra con el desglose. Datos ficticios. Solo corre en pantalla; con movimiento
 * reducido muestra la conversación terminada, sin bucle.
 */
import { useEffect, useRef, useState } from "react";
import s from "./portada.module.css";

type App = "claude" | "chatgpt";
const QUESTION = "¿Cuánto gasté en suscripciones este mes?";
const ANSWER = "Este mes llevas S/ 48.20 en suscripciones, en 3 cobros:".split(" ");
const ITEMS: [string, string][] = [["Música", "S/ 18.90"], ["Streaming", "S/ 24.90"], ["Nube", "S/ 4.40"]];
const FULL = { typed: QUESTION.length, sent: true, tool: 2, words: ANSWER.length, items: ITEMS.length };
const EMPTY = { typed: 0, sent: false, tool: 0, words: 0, items: 0 };
type Step = typeof FULL;

/** Marca de Claude simplificada: destello de rayos. */
function ClaudeMark({ size = 18 }: { size?: number }) {
  const rays = Array.from({ length: 12 }, (_, i) => {
    const a = (i * 30 * Math.PI) / 180, r = i % 2 ? 7.2 : 10;
    return <line key={i} x1={12 + Math.cos(a) * 2.2} y1={12 + Math.sin(a) * 2.2} x2={12 + Math.cos(a) * r} y2={12 + Math.sin(a) * r} />;
  });
  return <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden stroke="#d97757" strokeWidth="2.4" strokeLinecap="round">{rays}</svg>;
}

/** Marca de ChatGPT simplificada: roseta de seis pétalos. */
function ChatGptMark({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.6">
      {[0, 60, 120, 180, 240, 300].map((r) => <rect key={r} x="9.2" y="3" width="5.6" height="11" rx="2.8" transform={`rotate(${r} 12 12)`} />)}
    </svg>
  );
}

const reduced = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

export function AiChatDemo() {
  const [app, setApp] = useState<App>("claude");
  const [st, setSt] = useState<Step>(FULL);
  const [fading, setFading] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (reduced()) return;
    const el = box.current;
    let timers: ReturnType<typeof setTimeout>[] = [];
    let visible = false, running = false, cur: App = "claude";
    const at = (ms: number, fn: () => void) => timers.push(setTimeout(fn, ms));
    const clear = () => { timers.forEach(clearTimeout); timers = []; };

    const cycle = () => {
      running = true;
      let t = 0;
      at(t, () => { setFading(false); setSt(EMPTY); });
      t += 500;
      for (let c = 1; c <= QUESTION.length; c++) at(t += 38, () => setSt((x) => ({ ...x, typed: c })));
      at(t += 350, () => setSt((x) => ({ ...x, sent: true })));
      at(t += 450, () => setSt((x) => ({ ...x, tool: 1 })));
      at(t += 1300, () => setSt((x) => ({ ...x, tool: 2 })));
      for (let w = 1; w <= ANSWER.length; w++) at(t += 70, () => setSt((x) => ({ ...x, words: w })));
      for (let n = 1; n <= ITEMS.length; n++) at(t += 260, () => setSt((x) => ({ ...x, items: n })));
      at(t += 3600, () => setFading(true));
      at(t += 350, () => {
        cur = cur === "claude" ? "chatgpt" : "claude";
        setApp(cur);
        if (visible) cycle(); else running = false;
      });
    };

    if (!el || typeof IntersectionObserver === "undefined") { cycle(); return clear; }
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      if (visible && !running) cycle();
    }, { threshold: 0.35 });
    io.observe(el);
    return () => { io.disconnect(); clear(); };
  }, []);

  const claude = app === "claude";
  return (
    <div ref={box} className={`${s.ai} ${claude ? s.aiClaude : s.aiGpt} ${fading ? s.aiFade : ""}`} aria-label={`Ejemplo de conversación con ${claude ? "Claude" : "ChatGPT"} usando Luca`} role="img">
      <div className={s.aiBar}>
        <span className={s.aiLogo}>{claude ? <ClaudeMark /> : <ChatGptMark />}</span>
        <b className="text-[13px] font-semibold">{claude ? "Claude" : "ChatGPT"}</b>
        <span className={s.aiConn}><i />luca conectado</span>
      </div>

      <div className={s.aiBody} aria-hidden>
        {st.sent && <div className={s.aiUser}>{QUESTION}</div>}
        {st.tool > 0 && (
          <div className={s.aiTool} data-done={st.tool === 2}>
            {st.tool === 1 ? <span className={s.aiSpin} /> : <span className={s.aiOk}>✓</span>}
            <span className="num">{st.tool === 1 ? "Usando" : "Usó"} luca · category_breakdown</span>
          </div>
        )}
        {st.words > 0 && (
          <div className={s.aiAnswer}>
            <p>{ANSWER.slice(0, st.words).map((w, i) => <span key={i} className={s.aiWord}>{w.startsWith("S/") || w === "48.20" ? <b>{w}</b> : w} </span>)}</p>
            {st.items > 0 && (
              <ul>
                {ITEMS.slice(0, st.items).map(([k, v]) => <li key={k} className={s.aiItem}><span>{k}</span><span className="num">{v}</span></li>)}
              </ul>
            )}
          </div>
        )}
      </div>

      <div className={s.aiComposer} aria-hidden>
        <span className={s.aiInput}>{!st.sent && st.typed > 0 ? <>{QUESTION.slice(0, st.typed)}<i className={s.aiCaret} /></> : <span className="text-muted">{claude ? "Responde a Claude…" : "Pregunta lo que quieras"}</span>}</span>
        <span className={s.aiSend} data-on={!st.sent && st.typed > 0}>↑</span>
      </div>
    </div>
  );
}
