/** "El camino de tus datos": Correo → tu script → tu Sheet → tu navegador, con un punto que lo recorre. */
import type { CSSProperties, ReactNode } from "react";
import { IconCorreo } from "@/components/icons";
import { GlyphBrowser, GlyphScript, GlyphTable } from "./glyphs";
import { Reveal } from "./Reveal";
import s from "./portada.module.css";

const STEPS: { key: string; title: string; text: string; icon: ReactNode; mine?: boolean }[] = [
  { key: "Gmail", title: "Correo del banco", text: "BCP y Yape te avisan de cada consumo, como siempre.", icon: <IconCorreo size={22} /> },
  { key: "Tu script", title: "Lo lee y lo ordena", text: "Una copia de Apps Script en tu Drive revisa el correo cada 15 minutos.", icon: <GlyphScript size={22} />, mine: true },
  { key: "Tu Sheet", title: "Lo guarda", text: "Monto, comercio, fecha y categoría quedan en una hoja de cálculo tuya.", icon: <GlyphTable size={22} />, mine: true },
  { key: "Tu navegador", title: "Te lo muestra", text: "lucaa.lat lee la Sheet desde tu navegador, con tu sesión.", icon: <GlyphBrowser size={22} /> },
];

export function DataPath() {
  return (
    <section id="camino" aria-labelledby="camino-h" className="scroll-mt-24 pt-20 sm:pt-[88px]">
      <SectionHead eyebrow="El camino de tus datos" id="camino-h" title="Todo pasa dentro de tu cuenta de Google.">
        Así llega un consumo de tu tarjeta hasta tu pantalla. Cada paso corre con tus permisos.
      </SectionHead>
      <Reveal className="mt-9">
        <ol className={s.path}>
          {STEPS.map((st, k) => (
            <li key={st.key} className={`${s.step} ${st.mine ? s.mine : ""}`} style={{ "--k": k } as CSSProperties}>
              <span className={s.bubble}>{st.icon}</span>
              <div className="grid gap-1">
                <span className={s.key}>{st.key}</span>
                <h3 className="text-base font-semibold">{st.title}</h3>
                <p className="text-[13.5px] text-body">{st.text}</p>
              </div>
              {k < STEPS.length - 1 && <span className={s.link} aria-hidden><span className={s.dot} /></span>}
            </li>
          ))}
        </ol>
      </Reveal>
      <p className="mt-8 flex items-start gap-2.5 text-sm text-body sm:items-center">
        <span className={s.notOnPath} aria-hidden>×</span>
        <span><b className="font-semibold text-ink">Luca no está en este camino.</b> No hay servidor que guarde tus transacciones ni base de datos que se pueda filtrar.</span>
      </p>
    </section>
  );
}

export function SectionHead({ eyebrow, id, title, children }: { eyebrow: string; id: string; title: string; children?: ReactNode }) {
  return (
    <div className="grid max-w-[640px] gap-2.5">
      <span className="eyebrow">{eyebrow}</span>
      <h2 id={id} className="text-[clamp(28px,4vw,42px)] font-medium leading-[1.08] tracking-[-0.03em] text-balance">{title}</h2>
      {children && <p className="text-base text-body">{children}</p>}
    </div>
  );
}
