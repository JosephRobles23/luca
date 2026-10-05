/** Mosaico "Qué hace". Ejemplos con datos ficticios. */
import type { CSSProperties, ReactNode } from "react";
import { IconIA, IconIphone, IconLista, IconSheet } from "@/components/icons";
import { catColor } from "@/lib/categorias";
import { SectionHead } from "./DataPath";
import { GlyphTag } from "./glyphs";
import { Reveal } from "./Reveal";
import s from "./portada.module.css";

function Tile({ className, icon, title, children, extra }: { className: string; icon: ReactNode; title: string; children: ReactNode; extra?: ReactNode }) {
  return (
    <div className={`card ${s.tile} ${className}`}>
      <span className={s.tileIcon}>{icon}</span>
      <h3 className="text-[17px] font-semibold tracking-[-0.2px]">{title}</h3>
      <p className="text-[14.5px] text-body">{children}</p>
      {extra}
    </div>
  );
}

const i = (n: number) => ({ "--i": n }) as CSSProperties;

export function Features() {
  return (
    <section id="que-hace" aria-labelledby="que-h" className="scroll-mt-24 pt-20 sm:pt-[88px]">
      <SectionHead eyebrow="Qué hace" id="que-h" title="Lo que hacías en Excel cada fin de mes, hecho solo." />
      <Reveal className={`${s.bento} mt-9`}>
        <Tile className={s.bA} icon={<IconLista size={18} />} title="Movimientos que llegan solos"
          extra={
            <ul className="mt-1.5 grid gap-2 text-[13.5px]" aria-label="Ejemplo de movimientos">
              {[["APP STORE", "−$ 3.86", "≈ S/ 13.32"], ["Yape a Juan P*", "−S/ 20.00", ""], ["CLOUD HOSTING", "−S/ 17.08", ""]].map(([w, a, p], n) => (
                <li key={w} className="rise sunken flex justify-between gap-3 rounded-[10px] px-3 py-2.5" style={i(n * 2 + 2)}>
                  <span className="min-w-0 truncate">{w}</span>
                  <span className="num whitespace-nowrap">{a} {p && <span className="cur">{p}</span>}</span>
                </li>
              ))}
            </ul>
          }>
          Consumos con tarjeta, transferencias y yapeos, con el comercio y la moneda original. Los dólares se convierten a soles con tu tipo de cambio.
        </Tile>

        <Tile className={s.bB} icon={<IconIA size={18} />} title="Pregúntale a tu IA"
          extra={
            <div className="mt-1.5 grid gap-2 text-[13.5px]" aria-label="Ejemplo de conversación">
              <div className={`${s.ask} ${s.chatAsk}`}>¿Cuánto gasté en suscripciones este mes?</div>
              <div className={`${s.typing} ${s.chatTyping}`} aria-hidden><i /><i /><i /></div>
              <div className={`${s.answer} ${s.chatAnswer}`}><b className="num font-medium text-ink">S/ 48.20</b> en 3 cobros: música, streaming y almacenamiento en la nube.</div>
            </div>
          }>
          Conecta Claude o ChatGPT por MCP y consulta en lenguaje natural.
        </Tile>

        <Tile className={s.bC} icon={<GlyphTag size={18} />} title="Categoriza con un toque"
          extra={
            <div className="mt-1 flex flex-wrap gap-1.5" aria-hidden>
              {["Supermercado", "Transporte", "Comidas fuera"].map((c, n) => (
                <span key={c} className={`chip ${n === 2 ? "on pop" : ""}`} style={n === 2 ? { animationDelay: "600ms" } : undefined}>
                  <i className="sw" style={{ background: catColor(c) }} />{c}
                </span>
              ))}
            </div>
          }>
          Lo que no reconoce queda en &quot;Por categorizar&quot;. Eliges y aprende del comercio.
        </Tile>
        <Tile className={s.bD} icon={<IconIphone size={18} />} title="Yapeos del iPhone">
          Un atajo registra lo que recibes por Yape, directo de tu teléfono a tu script.
        </Tile>
        <Tile className={s.bE} icon={<IconSheet size={18} />} title="Tu Sheet, tus reglas">
          Ábrela, edítala, expórtala o bórrala cuando quieras. Es un archivo tuyo.
        </Tile>
      </Reveal>
    </section>
  );
}
