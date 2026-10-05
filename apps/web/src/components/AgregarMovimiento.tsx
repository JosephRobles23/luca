"use client";

/**
 * Agregar movimiento (DESIGN.md §Layout · Agregar): formulario centrado (máx. 560px) donde el monto es el
 * protagonista. Escribe una fila `manual:<uuid>` con fuente `manual` en la Sheet del usuario.
 */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useMemo, useState } from "react";
import { todayLima } from "@/lib/ledger";
import { catColor, topCategories } from "@/lib/categorias";
import { validateManual, type ManualInput } from "@/lib/sheets-ops";
import { firstError, parseAmount, quickDates, sanitizeAmountInput } from "@/lib/movimientos";
import { useLedger } from "./LedgerProvider";
import { Field } from "./ui";

type Tipo = "expense" | "income";
type Moneda = "PEN" | "USD";

/** Campo del formulario que enfoca cada error de `validateManual`. */
const FIELD_ID: Record<string, string> = { tipo: "m-tipo", monto: "m-monto", moneda: "m-monto", comercio: "m-nombre", fecha: "m-fecha" };

export default function AgregarMovimiento() {
  const { state, addManual } = useLedger();
  const router = useRouter();
  const [tipo, setTipo] = useState<Tipo>("expense");
  const [monto, setMonto] = useState("");
  const [moneda, setMoneda] = useState<Moneda>("PEN");
  const today = todayLima();
  const [fecha, setFecha] = useState(today);
  const [quien, setQuien] = useState<"comercio" | "contraparte">("comercio");
  const [nombre, setNombre] = useState("");
  const [categoria, setCategoria] = useState("");
  const [nota, setNota] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const catLabel = useId();

  const txs = useMemo(() => (state.phase === "ready" ? state.data.txs : []), [state]);
  const categorias = useMemo(() => (state.phase === "ready" ? state.data.categorias : []), [state]);
  const chips = useMemo(() => {
    if (tipo === "income") return categorias.includes("Ingreso") ? ["Ingreso"] : [];
    return topCategories(txs, categorias, 5);
  }, [tipo, txs, categorias]);

  if (state.phase !== "ready") return null;
  const hasTab = state.data.hasMovimientos;
  const dates = quickDates(today);
  const clearError = (k: string) => { if (errors[k]) setErrors((prev) => { const next = { ...prev }; delete next[k]; return next; }); };

  function pickTipo(t: Tipo) {
    setTipo(t);
    if (t === "income" && !categoria) setCategoria("Ingreso");
    if (t === "expense" && categoria === "Ingreso") setCategoria("");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const input: ManualInput = {
      monto: parseAmount(monto), moneda, fecha, tipo,
      comercio: quien === "comercio" ? nombre.trim() : "", contraparte: quien === "contraparte" ? nombre.trim() : "",
      categoria: categoria || (tipo === "income" ? "Ingreso" : ""), nota: nota.trim(),
    };
    const errs = validateManual(input);
    setErrors(errs);
    const bad = firstError(errs);
    if (bad) { document.getElementById(FIELD_ID[bad] ?? "")?.focus(); return; }
    setBusy(true);
    const ok = await addManual(input);
    setBusy(false);
    if (ok) router.push("/app/movimientos?fuente=manual");
  }

  const cur = moneda === "USD" ? "$" : "S/";
  const otherValue = chips.includes(categoria) ? "" : categoria;

  return (
    <form className="mx-auto grid w-full max-w-[560px] gap-5" onSubmit={submit} noValidate data-testid="manual-form">
      <header className="grid gap-1">
        <h1 className="page-title">Agregar movimiento</h1>
        <p className="text-sm text-muted">Para lo que no llega por correo: efectivo, yapeos enviados, ingresos. Se guarda en tu Sheet con fuente <span className="tag">manual</span>.</p>
      </header>

      {!hasTab && <div className="notice warn" role="alert"><i className="dot warn" aria-hidden />Tu Sheet aún no tiene la pestaña Movimientos: autorízala primero desde el Resumen.</div>}

      <section className="card grid gap-6">
        {/* Monto: el protagonista */}
        <div className="grid gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="segmented" role="radiogroup" aria-label="Tipo" id="m-tipo" tabIndex={-1}>
              {(["expense", "income"] as const).map((t) => (
                <button key={t} type="button" role="radio" aria-checked={tipo === t} onClick={() => pickTipo(t)}>{t === "expense" ? "Gasto" : "Ingreso"}</button>
              ))}
            </div>
            <div className="segmented" role="radiogroup" aria-label="Moneda">
              {(["PEN", "USD"] as const).map((m) => (
                <button key={m} type="button" role="radio" aria-checked={moneda === m} aria-label={m === "PEN" ? "Soles" : "Dólares"} onClick={() => setMoneda(m)}>
                  <span className="num">{m === "PEN" ? "S/" : "$"}</span>
                </button>
              ))}
            </div>
          </div>
          <div>
            <label htmlFor="m-monto" className="eyebrow">Monto</label>
            <div className={`mt-2 flex items-baseline gap-3 border-b-2 pb-2 transition-colors focus-within:border-primary ${errors.monto ? "border-warning" : "border-line"}`}>
              <span className="amount-hero cur select-none" aria-hidden>{cur}</span>
              <input id="m-monto" className="amount-hero w-full min-w-0 bg-transparent text-ink outline-none placeholder:text-muted/50" inputMode="decimal" autoComplete="off"
                placeholder="0.00" value={monto} autoFocus style={{ outline: "none" }} aria-invalid={!!errors.monto} aria-describedby={errors.monto ? "m-monto-err" : undefined}
                onChange={(e) => { setMonto(sanitizeAmountInput(e.target.value)); clearError("monto"); }} />
            </div>
            {errors.monto && <p id="m-monto-err" className="mt-1.5 text-[13px] text-warning" role="alert">{errors.monto}</p>}
            {errors.moneda && <p className="mt-1.5 text-[13px] text-warning" role="alert">{errors.moneda}</p>}
          </div>
        </div>

        {/* Comercio o persona */}
        <div className="grid gap-2.5">
          <div className="segmented w-fit" role="radiogroup" aria-label="Comercio o persona">
            <button type="button" role="radio" aria-checked={quien === "comercio"} onClick={() => setQuien("comercio")}>Comercio</button>
            <button type="button" role="radio" aria-checked={quien === "contraparte"} onClick={() => setQuien("contraparte")}>Persona (P2P)</button>
          </div>
          <Field label={quien === "comercio" ? "Comercio" : "Persona"} htmlFor="m-nombre" error={errors.comercio}
            hint={quien === "comercio" ? "Si le pones categoría, Luca la recordará para este comercio." : "Nombre como aparece en Yape."}>
            <input id="m-nombre" className="input" autoComplete="off" placeholder={quien === "comercio" ? "ej. Menú El Rincón" : "ej. Carlos R."} value={nombre}
              aria-invalid={!!errors.comercio} onChange={(e) => { setNombre(e.target.value); clearError("comercio"); }} />
          </Field>
        </div>

        {/* Fecha */}
        <Field label="Fecha" htmlFor="m-fecha" error={errors.fecha}>
          <div className="flex flex-wrap items-center gap-2">
            <input id="m-fecha" type="date" className="input w-auto min-w-[170px] flex-1 sm:flex-none" value={fecha} max={today}
              aria-invalid={!!errors.fecha} onChange={(e) => { setFecha(e.target.value); clearError("fecha"); }} />
            <button type="button" className="chip" aria-pressed={fecha === dates.hoy} onClick={() => { setFecha(dates.hoy); clearError("fecha"); }}>Hoy</button>
            <button type="button" className="chip" aria-pressed={fecha === dates.ayer} onClick={() => { setFecha(dates.ayer); clearError("fecha"); }}>Ayer</button>
          </div>
        </Field>

        {/* Categoría */}
        <div className="field">
          <span id={catLabel} className="mb-1.5 block text-[13px] font-medium text-body">Categoría</span>
          <div className="flex flex-wrap gap-1.5" role="group" aria-labelledby={catLabel}>
            {chips.map((c) => (
              <button key={c} type="button" className="chip" aria-pressed={categoria === c} onClick={() => setCategoria(categoria === c ? "" : c)}>
                <i className="sw" style={{ background: catColor(c) }} aria-hidden />{c}
              </button>
            ))}
            <select className={`chip appearance-none pr-3 ${otherValue ? "on" : ""}`} aria-label="Otra categoría" value={otherValue} onChange={(e) => setCategoria(e.target.value)}>
              <option value="">{otherValue ? "Por categorizar" : "Otra…"}</option>
              {categorias.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <p className="mt-1.5 text-[12.5px] text-muted">{categoria ? <>Se guardará como <b className="font-medium text-body">{categoria}</b>.</> : "Sin categoría: quedará por categorizar."}</p>
        </div>

        <Field label="Nota (opcional)" htmlFor="m-nota">
          <input id="m-nota" className="input" autoComplete="off" placeholder="ej. menú del almuerzo" value={nota} onChange={(e) => setNota(e.target.value)} />
        </Field>
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className="btn primary lg min-w-[140px]" disabled={busy || !hasTab}>{busy ? "Guardando…" : "Agregar"}</button>
        <Link className="btn ghost lg" href="/app/movimientos">Cancelar</Link>
      </div>
    </form>
  );
}
