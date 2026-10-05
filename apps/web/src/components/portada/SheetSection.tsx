/**
 * Sección "Dentro de tu Sheet": el menú Luca de la hoja abre el panel lateral (estado y conexiones) y el
 * Dashboard (resumen, categorías, tendencias y movimientos). Las imágenes son capturas de la UI real
 * (gas/shared/Sidebar.html y DialogDashboard.html) renderizada con datos sintéticos por
 * scripts/build-previews.mjs → docs/html/preview-sidebar.html.
 */
import Image from "next/image";
import { catColor } from "@/lib/categorias";
import { SectionHead } from "./DataPath";
import { Reveal } from "./Reveal";
import s from "./portada.module.css";

const ROWS: [string, string, string, string][] = [
  ["05/10", "WONG", "−86.40", "Supermercado"],
  ["05/10", "Ana P*", "+36.40", "Recibido por Yape"],
  ["04/10", "LUZ DEL SUR", "−112.30", "Servicios"],
  ["04/10", "RAPPI", "−38.70", "Comidas fuera"],
  ["03/10", "UBER *TRIP", "−14.90", "Transporte"],
  ["03/10", "SPOTIFY", "−5.99", "Suscripciones"],
  ["02/10", "INKAFARMA", "−23.10", "Salud"],
  ["02/10", "CINEPLANET", "−32.00", "Ocio"],
  ["01/10", "PLAZA VEA", "−150.69", "Supermercado"],
];
const MENU = ["Archivo", "Editar", "Ver", "Insertar", "Formato", "Datos", "Herramientas", "Extensiones"];

export function SheetSection() {
  return (
    <section id="en-tu-sheet" aria-labelledby="sheet-h" className="scroll-mt-24 pt-20 sm:pt-[88px]">
      <SectionHead eyebrow="Dentro de tu Google Sheets" id="sheet-h" title="Y si prefieres la hoja, Luca también vive ahí.">
        El menú <b className="font-semibold text-ink">Luca</b> de tu Sheet abre un panel con el estado del escaneo y tus conexiones, y un dashboard
        con resumen, categorías, tendencias y movimientos, sin salir de la hoja.
      </SectionHead>

      <Reveal className={`${s.gs} mt-9`}>
        <div className={s.gsWin} role="img" aria-label="Ejemplo: tu Sheet de Luca con el panel lateral abierto y el Dashboard encima">
          <div className={s.gsTop} aria-hidden>
            <span className={s.gsIcon} />
            <span className="min-w-0">
              <span className="block truncate text-[13px] font-medium text-[#1f1f1f]">Luca Ledger — Tu nombre</span>
              <span className={s.gsMenu}>{MENU.map((m) => <span key={m}>{m}</span>)}<span className={s.gsMenuOn}>Luca</span></span>
            </span>
          </div>
          <div className={s.gsBody} aria-hidden>
            <div className={s.gsGrid}>
              <div className={`${s.gsRow} ${s.gsHead}`}><span>fecha</span><span>comercio</span><span>monto</span><span>categoria</span></div>
              {ROWS.map(([f, w, m, c], k) => (
                <div key={k} className={s.gsRow} style={{ "--i": k } as React.CSSProperties}>
                  <span>{f}</span><span className="truncate">{w}</span><span className="num">{m}</span>
                  <span><i className={s.gsCat} style={{ background: c === "Recibido por Yape" ? "var(--cat-none)" : catColor(c) }}>{c}</i></span>
                </div>
              ))}
            </div>
            <div className={s.gsSide}>
              <Image src="/portada/sheet-sidebar.webp" alt="" width={600} height={1400} sizes="300px" className={s.gsSideImg} />
            </div>
          </div>
        </div>
        <figure className={s.gsDialog}>
          <Image src="/portada/sheet-dashboard.webp" alt="Dashboard de Luca dentro de Google Sheets: gasto del mes con barra de ritmo, en qué se fue, últimos 6 meses y dónde más gastaste" width={1600} height={1105} sizes="(min-width: 960px) 640px, 92vw" />
        </figure>
      </Reveal>

      <ul className="mt-6 grid gap-3 text-[14px] text-body sm:grid-cols-3" aria-label="Qué hay en la Sheet">
        <li className="card !p-4"><b className="block text-[15px] font-semibold text-ink">Panel lateral</b>Escanea ahora, revisa si tu Gmail, la IA, el iPhone y el MCP están listos.</li>
        <li className="card !p-4"><b className="block text-[15px] font-semibold text-ink">Dashboard</b>Resumen, categorías, tendencias y movimientos del mes en un diálogo.</li>
        <li className="card !p-4"><b className="block text-[15px] font-semibold text-ink">Hojas con estilo</b>Encabezados, filas alternas y colores por categoría iguales a la web.</li>
      </ul>
    </section>
  );
}
