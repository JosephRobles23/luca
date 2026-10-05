"use client";

/**
 * Sección "Dentro de tu Sheet": maqueta interactiva de Google Sheets con la UI real de Luca reconstruida en código
 * (gas/shared/Sidebar.html y DialogDashboard.html): menú Luca, panel lateral con pestañas Estado · IA · iPhone · MCP
 * y Dashboard con Resumen · Categorías · Tendencias · Movimientos. Datos ficticios; nada se guarda.
 * Alturas fijas: navegar no cambia el tamaño de la sección.
 */
import { useEffect, useState, type ReactNode } from "react";
import CategoryIcon from "@/components/CategoryIcon";
import { IconActualizar, IconAjustes, IconCerrar, IconCopiar, IconExterno, IconIA, IconIphone } from "@/components/icons";
import { catColor } from "@/lib/categorias";
import { SectionHead } from "./DataPath";
import s from "./portada.module.css";

// ---------- datos de ejemplo (coherentes entre sí: octubre suma S/ 1,084.83, 36 % de septiembre) ----------
const ROWS: [string, string, string, string, string?][] = [
  ["05/10", "WONG", "−86.40", "Supermercado"],
  ["05/10", "Ana P*", "+35.00", "", "transfer_in"],
  ["04/10", "LUZ DEL SUR", "−112.30", "Servicios"],
  ["04/10", "RAPPI", "−38.70", "Comidas fuera"],
  ["03/10", "INKAFARMA", "−23.10", "Salud"],
  ["03/10", "CLARO PERU", "−89.90", "Servicios"],
  ["02/10", "CINEPLANET", "−32.00", "Ocio"],
  ["02/10", "PLAZA VEA", "−150.69", "Supermercado"],
  ["01/10", "CA012 AVIACION", "−53.30", ""],
  ["01/10", "SHIMAYA RAMEN", "−61.20", "Comidas fuera"],
];
const CATS: [string, number, number][] = [
  ["Supermercado", 390.1, 36], ["Servicios", 281.4, 26], ["Comidas fuera", 152.3, 14], ["Salud", 153.43, 14], ["Ocio", 64, 6], ["Otros", 43.6, 4],
];
const TOP: [string, string, string, string][] = [["PLAZA VEA", "Supermercado", "S/ 150.69", "1 movimiento"], ["LUZ DEL SUR", "Servicios", "S/ 112.30", "1 movimiento"], ["SHIMAYA RAMEN", "Comidas fuera", "S/ 61.20", "1 movimiento"]];
const MONTHS: [string, number][] = [["May", 2610], ["Jun", 2380], ["Jul", 2590], ["Ago", 2310], ["Sep", 3013], ["Oct", 1084.83]];
const soles = (n: number) => "S/ " + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

type SideTab = "estado" | "ia" | "iphone" | "mcp";
type DashTab = "resumen" | "categorias" | "tendencias" | "movimientos";

export function SheetSection() {
  const [side, setSide] = useState<SideTab>("estado");
  const [sideOpen, setSideOpen] = useState(true);
  const [dashOpen, setDashOpen] = useState(true);
  const [dash, setDash] = useState<DashTab>("resumen");
  const [menu, setMenu] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 2600); return () => clearTimeout(t); }, [toast]);

  return (
    <section id="en-tu-sheet" aria-labelledby="sheet-h" className="scroll-mt-24 pt-20 sm:pt-[88px]">
      <SectionHead eyebrow="Dentro de tu Google Sheets" id="sheet-h" title="Y si prefieres la hoja, Luca también vive ahí.">
        El menú <b className="font-semibold text-ink">Luca</b> de tu Sheet abre un panel con el estado del escaneo y tus conexiones, y un dashboard
        con resumen, categorías, tendencias y movimientos, sin salir de la hoja. <span className="text-muted">Pruébalo: es navegable.</span>
      </SectionHead>

      <div className={`${s.sx} mt-9`}>
        <div className={s.sxWin}>
          <div className={s.sxTop}>
            <span className={s.gsIcon} aria-hidden />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-medium">Luca Ledger — Tu nombre</span>
              <span className={s.sxMenu}>
                {["Archivo", "Editar", "Ver", "Insertar", "Formato", "Datos", "Extensiones"].map((m) => <span key={m} className={s.sxMenuItem}>{m}</span>)}
                <span className="relative">
                  <button type="button" className={s.sxMenuLuca} aria-haspopup="menu" aria-expanded={menu} onClick={() => setMenu((m) => !m)}>Luca</button>
                  {menu && (
                    <span role="menu" className={s.sxDrop}>
                      <button role="menuitem" type="button" onClick={() => { setMenu(false); setToast("Escaneando tu Gmail… 2 movimientos nuevos"); }}><IconActualizar size={15} />Autorizar / Escanear ahora</button>
                      <button role="menuitem" type="button" onClick={() => { setMenu(false); setDashOpen(true); }}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden><path d="M3 3v16a2 2 0 0 0 2 2h16M18 17V9M13 17V5M8 17v-3" /></svg>Dashboard</button>
                      <button role="menuitem" type="button" onClick={() => { setMenu(false); setSideOpen(true); }}><IconAjustes size={15} />Configuración</button>
                    </span>
                  )}
                </span>
              </span>
            </span>
          </div>

          <div className={s.sxBody} data-side={sideOpen}>
            <div className={s.sxGrid} aria-label="Pestaña Movimientos de ejemplo">
              <div className={`${s.sxRow} ${s.sxHead}`}><span /><span>fecha</span><span>comercio</span><span>monto</span><span>categoria</span></div>
              {ROWS.map(([f, w, m, c, tipo], k) => (
                <div key={k} className={s.sxRow}>
                  <span className={s.sxNum}>{k + 2}</span><span>{f}</span><span className="truncate">{w}</span>
                  <span className={`num ${m.startsWith("+") ? "text-[#1a7a59]" : ""}`}>{m}</span>
                  <span><i className={s.sxChip} style={{ background: c ? catColor(c) : "#e9e3da" }}><CategoryIcon categoria={c} tipo={tipo} size={12} />{c || (tipo ? "Recibido" : "Por categorizar")}</i></span>
                </div>
              ))}
              {!dashOpen && <button type="button" className={`btn sm ${s.sxReopen}`} onClick={() => setDashOpen(true)}>Abrir Dashboard</button>}
            </div>

            {sideOpen && <Sidebar tab={side} setTab={setSide} onClose={() => setSideOpen(false)} onDashboard={() => setDashOpen(true)} onToast={setToast} />}

            {dashOpen && (
              <div className={s.sxDialog} role="dialog" aria-label="Luca — Dashboard (ejemplo)">
                <Dashboard tab={dash} setTab={setDash} onClose={() => setDashOpen(false)} />
              </div>
            )}
            {!sideOpen && <button type="button" className={`btn sm ${s.sxReopenSide}`} onClick={() => setSideOpen(true)}>Abrir panel</button>}
            {toast && <div className={s.sxToast} role="status">{toast}</div>}
          </div>
        </div>
      </div>

      <ul className="mt-6 grid gap-3 text-[14px] text-body sm:grid-cols-3" aria-label="Qué hay en la Sheet">
        <li className="card !p-4"><b className="block text-[15px] font-semibold text-ink">Panel lateral</b>Escanea ahora y revisa si tu Gmail, la IA, el iPhone y el MCP están listos.</li>
        <li className="card !p-4"><b className="block text-[15px] font-semibold text-ink">Dashboard</b>Resumen, categorías, tendencias y movimientos del mes en un diálogo.</li>
        <li className="card !p-4"><b className="block text-[15px] font-semibold text-ink">Hojas con estilo</b>Encabezados, filas alternas y colores e iconos por categoría, iguales a la web.</li>
      </ul>
    </section>
  );
}

// ---------- panel lateral ----------
const TABS: [SideTab, string, ReactNode][] = [
  ["estado", "Estado", <svg key="e" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M22 12h-2.5a2 2 0 0 0-1.9 1.5l-2.4 8.3a.25.25 0 0 1-.5 0L9.2 2.2a.25.25 0 0 0-.5 0l-2.3 8.3A2 2 0 0 1 4.5 12H2" /></svg>],
  ["ia", "IA", <IconIA key="i" size={16} />],
  ["iphone", "iPhone", <IconIphone key="p" size={16} />],
  ["mcp", "MCP", <svg key="m" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M12 22v-5M9 8V2M15 8V2M18 8v5a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4V8Z" /></svg>],
];

function Pill({ children }: { children: ReactNode }) { return <span className={s.sxPill}><i />{children}</span>; }

function Sidebar({ tab, setTab, onClose, onDashboard, onToast }: { tab: SideTab; setTab: (t: SideTab) => void; onClose: () => void; onDashboard: () => void; onToast: (t: string) => void }) {
  const [scanning, setScanning] = useState(false);
  const [prov, setProv] = useState("Gemini");
  const [extract, setExtract] = useState(false);
  const [adv, setAdv] = useState(false);
  const [code, setCode] = useState<string | null>(null);

  const scan = () => { setScanning(true); setTimeout(() => { setScanning(false); onToast("2 movimientos nuevos en tu hoja"); }, 1300); };

  return (
    <aside className={s.sxSide} aria-label="Luca — Configuración (ejemplo)">
      <div className={s.sxSideHead}><span>Luca — Configuración</span><button type="button" className={s.sxClose} aria-label="Cerrar panel" onClick={onClose}><IconCerrar size={16} /></button></div>
      <div className={s.sxSideScroll}>
        <div className={s.sxBrand}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icon-192.png" alt="" width={30} height={30} />
          <span className="min-w-0 flex-1"><b>luca<span className="text-[#d9623b]">.</span></b><small>escaneado hace 8 min</small></span>
          <button type="button" className={s.sxBtnSec} onClick={() => onToast("La Guía abre los pasos de configuración")}>Guía</button>
        </div>
        <div className={s.sxTabs} role="tablist" aria-label="Secciones del panel">
          {TABS.map(([k, l, ico]) => (
            <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>{ico}<span>{l}</span></button>
          ))}
        </div>

        <div key={tab} className={s.sxPanel} role="tabpanel">
          {tab === "estado" && (
            <>
              <h4>Resumen</h4>
              <div className={s.sxCard}>
                <div className="flex items-center justify-between gap-2"><span className="text-[12px] text-[#6f675d]">Movimientos</span><Pill>Al día · hace 8 min</Pill></div>
                <div className="num mt-1 text-[30px] font-medium leading-none">93</div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button type="button" className={s.sxStat} onClick={onDashboard}><small>Por categorizar</small><b>3</b></button>
                  <button type="button" className={s.sxStat} onClick={() => setTab("iphone")}><small>Recibido por Yape</small><b>1</b></button>
                </div>
                <button type="button" className={s.sxBtn} onClick={scan} disabled={scanning}><IconActualizar size={15} className={scanning ? "animate-spin" : ""} />{scanning ? "Escaneando…" : "Escanear Gmail ahora"}</button>
              </div>
              <h4>Conexiones</h4>
              <div className={`${s.sxCard} !p-1`}>
                {([["Gmail", "Escaneo cada 15 min", null], ["IA para categorizar", `${prov.toLowerCase()} · key guardada`, "ia"], ["iPhone", "Conectado · último yapeo hoy", "iphone"], ["Claude / ChatGPT", "Conectado", "mcp"]] as [string, string, SideTab | null][]).map(([t, d, to]) => (
                  <button key={t} type="button" className={s.sxConn} disabled={!to} onClick={() => to && setTab(to)}>
                    <span className="min-w-0 flex-1 text-left"><b className="block truncate">{t}</b><small className="block truncate">{d}</small></span>
                    <Pill>Listo</Pill>{to && <span className="text-[#a09a91]">›</span>}
                  </button>
                ))}
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button type="button" className={s.sxBtnSec} onClick={onDashboard}>Dashboard</button>
                <a className={s.sxBtnSec} href="#top"><IconExterno size={14} />lucaa.lat</a>
              </div>
            </>
          )}

          {tab === "ia" && (
            <>
              <h4>Categorización con IA</h4>
              <div className={s.sxCard}>
                <div className="flex items-center justify-between gap-2"><b className="text-[13px]">Proveedor</b><Pill>Configurada</Pill></div>
                <p className={s.sxLead}>Categoriza comercios nuevos. Solo viajan comercio, monto, moneda y canal.</p>
                <div className={s.sxSeg} role="group" aria-label="Proveedor">
                  {["Gemini", "OpenAI", "Anthropic"].map((p) => <button key={p} type="button" aria-pressed={prov === p} onClick={() => setProv(p)}>{p}</button>)}
                </div>
                <div className={s.sxInput}>••••••••••••••••••••</div>
                <p className={s.sxHint}>Se guarda en tu cuenta de Google, nunca en la hoja.</p>
                <button type="button" className={s.sxBtn} onClick={() => onToast(`Key de ${prov} guardada`)}>Guardar</button>
                <label className={s.sxSwitchRow}>
                  <span><b className="block text-[12.5px]">Extraer con IA los correos que Luca no reconoce</b><small>Envía el texto con nombres y números enmascarados.</small></span>
                  <input type="checkbox" checked={extract} onChange={(e) => setExtract(e.target.checked)} className={s.sxSwitch} />
                </label>
              </div>
            </>
          )}

          {tab === "iphone" && (
            <>
              <h4>Yapeos desde el iPhone</h4>
              <div className={s.sxCard}>
                <div className="flex items-center justify-between gap-2"><b className="text-[13px]">Atajo de iOS</b><Pill>Conectado</Pill></div>
                <p className={s.sxLead}>Los yapeos recibidos no llegan por correo: un atajo los envía directo a esta hoja.</p>
              </div>
              <ol className={s.sxSteps}>
                {["Web App publicada", "Token generado", "Atajo instalado en el iPhone", "Prueba recibida"].map((t) => <li key={t}><span>✓</span>{t}</li>)}
              </ol>
              <div className={s.sxCard}>
                <span className="text-[11px] font-semibold uppercase tracking-[.08em] text-[#6f675d]">Último yapeo</span>
                <div className="mt-1.5 flex items-center justify-between gap-2 text-[13px]"><span>Ana P* · hoy 9:41</span><b className="num text-[#1a7a59]">+S/ 35.00</b></div>
              </div>
            </>
          )}

          {tab === "mcp" && (
            <>
              <h4>Claude o ChatGPT</h4>
              <div className={s.sxCard}>
                <div className="flex items-center justify-between gap-2"><b className="text-[13px]">Conector</b><Pill>Conectado</Pill></div>
                <p className={s.sxLead}>Pregúntale a tu IA por tus gastos. Lee tu hoja a través de tu propio Web App.</p>
                <div className={s.sxInput}><span className="num truncate">https://mcp.lucaa.lat/mcp</span><button type="button" aria-label="Copiar URL" onClick={() => onToast("URL copiada")}><IconCopiar size={14} /></button></div>
                {code && <div className={s.sxCode}><span className="num">{code}</span><small>válido 10 min</small></div>}
                <button type="button" className={s.sxBtn} onClick={() => setCode("K7Q2-M9XD")}>{code ? "Generar otro código" : "Generar código de conexión"}</button>
                <p className={s.sxHint}>En tu IA: añade un conector con esa URL y pega el código cuando lo pida.</p>
              </div>
            </>
          )}
        </div>
      </div>
      <label className={s.sxFoot}>
        <span><b className="block text-[12.5px] font-medium">Modo avanzado</b><small>Versiones, diagnóstico y mantenimiento</small></span>
        <input type="checkbox" checked={adv} onChange={(e) => { setAdv(e.target.checked); if (e.target.checked) onToast("Modo avanzado: versiones y diagnóstico visibles"); }} className={s.sxSwitch} />
      </label>
    </aside>
  );
}

// ---------- dashboard ----------
const DTABS: [DashTab, string][] = [["resumen", "Resumen"], ["categorias", "Categorías"], ["tendencias", "Tendencias"], ["movimientos", "Movimientos"]];

function Dashboard({ tab, setTab, onClose }: { tab: DashTab; setTab: (t: DashTab) => void; onClose: () => void }) {
  return (
    <>
      <div className={s.sxDlgHead}><span>Luca — Dashboard</span><button type="button" className={s.sxClose} aria-label="Cerrar Dashboard" onClick={onClose}><IconCerrar size={16} /></button></div>
      <div className={s.sxDlgBody}>
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div><b className="block text-[19px] font-medium tracking-[-0.02em]">Tus gastos</b><small className="text-[11.5px] text-[#6f675d]">14 gastos en octubre 2026 · día 5 de 31</small></div>
          <span className={s.sxMonth}>‹ <b>Octubre 2026</b> ›</span>
        </div>
        <div className={s.sxDTabs} role="tablist" aria-label="Secciones del Dashboard">
          {DTABS.map(([k, l]) => <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>{l}</button>)}
        </div>
        <div key={tab} className={s.sxPanel} role="tabpanel">
          {tab === "resumen" && <DResumen />}
          {tab === "categorias" && <DCategorias />}
          {tab === "tendencias" && <DTendencias />}
          {tab === "movimientos" && <DMovimientos />}
        </div>
      </div>
    </>
  );
}

const OFFSETS = CATS.map((_, i) => CATS.slice(0, i).reduce((a, [, , p]) => a + p, 0));

function Donut() {
  return (
    <svg viewBox="0 0 120 120" className="h-[104px] w-[104px] flex-none -rotate-90" aria-hidden>
      <circle cx="60" cy="60" r="44" fill="none" stroke="#ebe4d9" strokeWidth="16" />
      {CATS.map(([c, , p], i) => <circle key={c} cx="60" cy="60" r="44" fill="none" stroke={catColor(c)} strokeWidth="16" pathLength={100} strokeDasharray={`${Math.max(0, p - 0.8)} ${100 - p + 0.8}`} strokeDashoffset={-OFFSETS[i]} />)}
    </svg>
  );
}

function DResumen() {
  return (
    <div className="grid gap-2.5 md:grid-cols-[1.35fr_1fr]">
      <div className={s.sxCard}>
        <div className="flex flex-wrap items-center justify-between gap-2"><span className={s.sxEyebrow}>Gasto de octubre</span><Pill>64% menos que septiembre</Pill></div>
        <div className="num mt-2 text-[30px] font-medium leading-none tracking-[-0.03em]"><span className="mr-1 text-[15px] text-[#6f675d]">S/</span>1,084.83</div>
        <div className={s.sxPace}><i className="grow-x" style={{ width: "36%" }} /><b style={{ left: "16%" }} /></div>
        <div className="flex justify-between text-[11px] text-[#6f675d]"><span>36% de lo que gastaste en septiembre</span><span>Día 5 de 31</span></div>
        <div className="mt-2.5 grid grid-cols-3 gap-1.5">
          {[["Ingresos", "4,200.00"], ["Te queda", "3,115.17"], ["Yape", "35.00"]].map(([k, v]) => <div key={k} className={s.sxMini}><small>{k}</small><b className="num">S/ {v}</b></div>)}
        </div>
      </div>
      <div className={s.sxCard}>
        <b className="text-[13px]">En qué se fue</b>
        <div className="mt-2 flex items-center gap-3">
          <Donut />
          <ul className="grid flex-1 gap-1 text-[11.5px]">
            {CATS.slice(0, 5).map(([c, , p]) => <li key={c} className="flex items-center gap-1.5"><i className="size-2 rounded-[3px]" style={{ background: catColor(c) }} /><span className="flex-1 truncate">{c}</span><span className="num text-[#6f675d]">{p}%</span></li>)}
          </ul>
        </div>
      </div>
      <div className={`${s.sxCard} md:col-span-2`}>
        <b className="text-[13px]">Dónde más gastaste</b>
        <div className="mt-1 grid">
          {TOP.map(([w, c, m, n]) => (
            <div key={w} className={s.sxCatRow}>
              <span className={s.sxAvatar} style={{ background: catColor(c) }}><CategoryIcon categoria={c} size={15} /></span>
              <span className="min-w-0"><b className="block truncate text-[12px] font-medium">{w}</b><small className="text-[10.5px] text-[#6f675d]">{n}</small></span>
              <span className="num text-[11.5px] font-medium">{m}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function DCategorias() {
  const max = CATS[0][1];
  return (
    <div className={`${s.sxCard} !p-1.5`}>
      {CATS.map(([c, m, p], i) => (
        <div key={c} className={s.sxCatRow}>
          <span className={s.sxAvatar} style={{ background: catColor(c) }}><CategoryIcon categoria={c} size={15} /></span>
          <span className="min-w-0"><b className="block text-[12.5px] font-medium">{c}</b><span className={s.sxBar}><i className="grow-x" style={{ width: `${(m / max) * 100}%`, background: catColor(c), ["--i" as string]: i }} /></span></span>
          <span className="num text-right text-[12px]"><b className="block font-medium">{soles(m)}</b><small className="text-[#6f675d]">{p}%</small></span>
        </div>
      ))}
    </div>
  );
}

function DTendencias() {
  const max = 3200, H = 120, base = 132, w = 34, gap = 22;
  return (
    <div className={s.sxCard}>
      <div className="flex justify-between text-[12px]"><b className="text-[13px]">Últimos 6 meses</b><span className="text-[#6f675d]">Promedio S/ 2,331</span></div>
      <svg viewBox="0 0 340 152" className="mt-2 w-full" role="img" aria-label="Gasto mensual de mayo a octubre">
        <line x1="0" x2="340" y1={base} y2={base} stroke="#e6ddd1" />
        <line x1="0" x2="340" y1={base - (2331 / max) * H} y2={base - (2331 / max) * H} stroke="#a09a91" strokeDasharray="4 3" />
        {MONTHS.map(([m, v], i) => {
          const h = (v / max) * H, x = 14 + i * (w + gap), last = i === MONTHS.length - 1;
          return (
            <g key={m}>
              <rect x={x} y={base - h} width={w} height={h} rx="5" fill={last ? "#d9623b" : "#ddd3c6"} className="grow-y" style={{ ["--i" as string]: i }} />
              <text x={x + w / 2} y={base - h - 5} textAnchor="middle" fontSize="10" fill={last ? "#d9623b" : "#6f675d"} fontFamily="var(--font-geist-mono)">{v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v}</text>
              <text x={x + w / 2} y={base + 14} textAnchor="middle" fontSize="10.5" fill={last ? "#1d1a17" : "#6f675d"} fontWeight={last ? 600 : 400}>{m}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function DMovimientos() {
  return (
    <div className={`${s.sxCard} !p-1.5`}>
      {ROWS.slice(0, 7).map(([f, w, m, c, tipo]) => (
        <div key={w + f} className={s.sxCatRow}>
          <span className={s.sxAvatar} style={{ background: c ? catColor(c) : "#e9e3da" }}><CategoryIcon categoria={c} tipo={tipo} size={15} /></span>
          <span className="min-w-0"><b className="block truncate text-[12.5px] font-medium">{w}</b><small className="text-[11px] text-[#6f675d]">{f} · {c || (tipo ? "Recibido por Yape" : "Por categorizar")}</small></span>
          <span className={`num text-right text-[12.5px] font-medium ${m.startsWith("+") ? "text-[#1a7a59]" : ""}`}>{m.replace("−", "−S/ ").replace("+", "+S/ ")}</span>
        </div>
      ))}
    </div>
  );
}
