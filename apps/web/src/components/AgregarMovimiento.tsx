"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { todayLima } from "@/lib/ledger";
import { validateManual, type ManualInput } from "@/lib/sheets-ops";
import { useLedger } from "./LedgerProvider";
import { Field, Select } from "./ui";

export default function AgregarMovimiento() {
  const { state, addManual } = useLedger();
  const router = useRouter();
  const [tipo, setTipo] = useState<"expense" | "income">("expense");
  const [monto, setMonto] = useState("");
  const [moneda, setMoneda] = useState<"PEN" | "USD">("PEN");
  const [fecha, setFecha] = useState(todayLima());
  const [quien, setQuien] = useState<"comercio" | "contraparte">("comercio");
  const [nombre, setNombre] = useState("");
  const [categoria, setCategoria] = useState("");
  const [nota, setNota] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  if (state.phase !== "ready") return null;
  const categorias = state.data.categorias;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const input: ManualInput = {
      monto: parseFloat(monto.replace(",", ".")), moneda, fecha, tipo,
      comercio: quien === "comercio" ? nombre.trim() : "", contraparte: quien === "contraparte" ? nombre.trim() : "",
      categoria: categoria || (tipo === "income" ? "Ingreso" : ""), nota: nota.trim(),
    };
    const errs = validateManual(input);
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    const ok = await addManual(input);
    setBusy(false);
    if (ok) router.push("/app/movimientos?fuente=manual");
  }

  return (
    <form className="card mx-auto grid max-w-lg gap-4" onSubmit={submit} noValidate data-testid="manual-form">
      <h1 className="label !mb-0">Agregar movimiento</h1>
      <p className="text-sm text-muted">Para lo que no llega por correo: efectivo, yapeos pequeños enviados, ingresos. Se guarda en tu Sheet con fuente <b className="text-text">manual</b>.</p>

      <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Tipo">
        {(["expense", "income"] as const).map((t) => (
          <button key={t} type="button" role="radio" aria-checked={tipo === t} onClick={() => { setTipo(t); if (t === "income" && !categoria) setCategoria("Ingreso"); if (t === "expense" && categoria === "Ingreso") setCategoria(""); }}
            className={`btn ${tipo === t ? "border-accent text-accent-2" : ""}`}>{t === "expense" ? "Gasto" : "Ingreso"}</button>
        ))}
      </div>

      <div className="grid grid-cols-[1fr_110px] gap-3">
        <Field label="Monto" htmlFor="m-monto" error={errors.monto}>
          <input id="m-monto" className="input text-2xl" inputMode="decimal" placeholder="0.00" value={monto} onChange={(e) => setMonto(e.target.value)} autoFocus />
        </Field>
        <Field label="Moneda" htmlFor="m-moneda" error={errors.moneda}>
          <Select id="m-moneda" value={moneda} onChange={(e) => setMoneda(e.target.value as "PEN" | "USD")}>
            <option value="PEN">S/ PEN</option><option value="USD">$ USD</option>
          </Select>
        </Field>
      </div>

      <Field label="Fecha" htmlFor="m-fecha" error={errors.fecha}>
        <input id="m-fecha" type="date" className="input" value={fecha} max={todayLima()} onChange={(e) => setFecha(e.target.value)} />
      </Field>

      <div className="grid gap-2">
        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Comercio o persona">
          <button type="button" role="radio" aria-checked={quien === "comercio"} className={`btn !py-1.5 text-xs ${quien === "comercio" ? "border-accent text-accent-2" : ""}`} onClick={() => setQuien("comercio")}>Comercio</button>
          <button type="button" role="radio" aria-checked={quien === "contraparte"} className={`btn !py-1.5 text-xs ${quien === "contraparte" ? "border-accent text-accent-2" : ""}`} onClick={() => setQuien("contraparte")}>Persona (P2P)</button>
        </div>
        <Field label={quien === "comercio" ? "Comercio" : "Persona"} htmlFor="m-nombre" error={errors.comercio} hint={quien === "comercio" ? "Si le pones categoría, Luca la recordará para este comercio." : "Nombre como aparece en Yape."}>
          <input id="m-nombre" className="input" placeholder={quien === "comercio" ? "ej. Menú El Rincón" : "ej. Carlos R."} value={nombre} onChange={(e) => setNombre(e.target.value)} />
        </Field>
      </div>

      <Field label="Categoría" htmlFor="m-cat">
        <Select id="m-cat" value={categoria} onChange={(e) => setCategoria(e.target.value)}>
          <option value="">Por categorizar</option>
          {categorias.map((c) => <option key={c} value={c}>{c}</option>)}
        </Select>
      </Field>

      <Field label="Nota (opcional)" htmlFor="m-nota">
        <input id="m-nota" className="input" placeholder="ej. menú del almuerzo" value={nota} onChange={(e) => setNota(e.target.value)} />
      </Field>

      <div className="flex flex-wrap gap-3">
        <button type="submit" className="btn primary" disabled={busy || !state.data.hasMovimientos}>{busy ? "Guardando…" : "Agregar"}</button>
        <Link className="btn" href="/app">Cancelar</Link>
      </div>
      {!state.data.hasMovimientos && <p className="text-xs text-warn">Tu Sheet aún no tiene la pestaña Movimientos: autorízala primero.</p>}
    </form>
  );
}
