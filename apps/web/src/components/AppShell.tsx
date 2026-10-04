"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import type { ClientConfig } from "@/lib/google-client";
import { versionStatus } from "@/lib/ajustes";
import { LedgerProvider, useLedger } from "./LedgerProvider";
import { ToastProvider } from "./Toast";
import { Step1Sheet, Step2Authorize, Step3Connections, useOnboardingStep } from "./Onboarding";
import { Notice } from "./ui";
import ThemeToggle from "./ThemeToggle";

type Props = {
  cfg: ClientConfig & { templateId: string; libVersion: string };
  user: { name: string; email: string; image: string };
  signOutAction: () => Promise<void>;
  children: ReactNode;
};

const NAV = [
  { href: "/app", label: "Resumen" },
  { href: "/app/movimientos", label: "Movimientos" },
  { href: "/app/agregar", label: "Agregar" },
  { href: "/app/conexiones", label: "Conexiones" },
  { href: "/app/ajustes", label: "Ajustes" },
];

export default function AppShell(p: Props) {
  return (
    <ToastProvider>
      <LedgerProvider cfg={p.cfg} user={p.user} signOutAction={p.signOutAction}>
        <Shell signOutAction={p.signOutAction}>{p.children}</Shell>
      </LedgerProvider>
    </ToastProvider>
  );
}

function Shell({ children, signOutAction }: { children: ReactNode; signOutAction: () => Promise<void> }) {
  const { state, user, refresh, refreshing, sessionExpired, libVersion, mode } = useLedger();
  const step = useOnboardingStep();
  const path = usePathname();
  const ready = state.phase === "ready";

  return (
    <div className="mx-auto max-w-[1320px] px-4 py-5">
      <a href="#contenido" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-2 focus:z-50 btn">Ir al contenido</a>
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Link href="/app" className="text-lg font-extrabold tracking-tight" aria-label="Luca, inicio">luca<span className="text-accent">.</span></Link>
        <nav aria-label="Secciones" className="order-3 -mx-4 w-[calc(100%+2rem)] overflow-x-auto px-4 sm:order-none sm:mx-0 sm:w-auto sm:px-0">
          <ul className="flex gap-1 whitespace-nowrap">
            {NAV.map((n) => {
              const on = n.href === "/app" ? path === "/app" : path.startsWith(n.href);
              return (
                <li key={n.href}>
                  <Link href={n.href} aria-current={on ? "page" : undefined}
                    className={`inline-block rounded-lg px-3 py-2 text-sm ${on ? "bg-panel-2 font-semibold text-text" : "text-muted hover:text-text"}`}>{n.label}</Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <div className="flex flex-wrap items-center gap-2">
          {ready && <button className="btn" onClick={refresh} disabled={refreshing} aria-label="Volver a leer la Sheet">{refreshing ? "Actualizando…" : "Actualizar"}</button>}
          <ThemeToggle />
          <span className="pill hidden sm:inline-flex" title={user.email}>{user.email}</span>
          <form action={signOutAction}><button className="btn" type="submit">Salir</button></form>
        </div>
      </header>

      {mode === "mock" && <p className="mb-3 text-center text-[11px] text-muted" data-testid="mock-banner">Modo de prueba (LUCA_MOCK): datos sintéticos en tu navegador, sin Google.</p>}

      {sessionExpired && (
        <div className="mb-4">
          <Notice kind="warn" action={<form action={signOutAction}><button className="btn primary" type="submit">Volver a entrar</button></form>}>
            Tu sesión con Google caducó o el permiso fue revocado. Vuelve a entrar para seguir.
          </Notice>
        </div>
      )}

      <main id="contenido">
        {state.phase === "loading" && <p className="text-muted" role="status">Buscando tu Sheet de Luca en tu Drive…</p>}
        {state.phase === "nofile" && <Step1Sheet />}
        {ready && (
          <>
            {step === 2 && <Step2Authorize />}
            {step === 3 && <Step3Connections />}
            {state.error && <div className="mb-4"><Notice kind="warn">No pude leer la hoja: {state.error}</Notice></div>}
            <VersionNotice libVersion={libVersion} />
            {children}
          </>
        )}
      </main>
    </div>
  );
}

function VersionNotice({ libVersion }: { libVersion: string }) {
  const { state } = useLedger();
  if (state.phase !== "ready") return null;
  const v = versionStatus(state.data.ajustes, libVersion);
  if (!v.outdated) return null;
  const url = state.file.webViewLink ?? `https://docs.google.com/spreadsheets/d/${state.file.id}/edit`;
  return (
    <div className="mb-4" data-testid="version-notice">
      <Notice kind="info" action={<a className="btn" href={url} target="_blank" rel="noreferrer">Abrir mi Sheet ↗</a>}>
        Hay una versión nueva de Luca (v{v.latest}; tu copia usa v{v.current}). En tu Sheet: <b>Extensiones → Apps Script → Bibliotecas → LucaLib → versión {v.latest} → Guardar</b>.
      </Notice>
    </div>
  );
}
