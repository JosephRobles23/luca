"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { ClientConfig } from "@/lib/google-client";
import { LedgerProvider, useLedger } from "./LedgerProvider";
import { ToastProvider } from "./Toast";
import { Step1Sheet, Step2Authorize, Step3Connections, useOnboardingStep } from "./Onboarding";
import { Notice } from "./ui";
import VersionNotice from "./VersionNotice";
import ThemeToggle from "./ThemeToggle";
import { IconActualizar, IconAjustes, IconBuscar, IconConexiones, IconExterno, IconLista, IconMas, IconResumen, IconSalir } from "./icons";

type Props = {
  cfg: ClientConfig & { templateId: string; templateFolderId: string; libVersion: string };
  user: { name: string; email: string; image: string };
  signOutAction: () => Promise<void>;
  children: ReactNode;
};

const NAV = [
  { href: "/app", label: "Resumen", Icon: IconResumen },
  { href: "/app/movimientos", label: "Movimientos", Icon: IconLista },
  { href: "/app/agregar", label: "Agregar", Icon: IconMas },
  { href: "/app/conexiones", label: "Conexiones", Icon: IconConexiones },
  { href: "/app/ajustes", label: "Ajustes", Icon: IconAjustes },
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

const isOn = (href: string, path: string) => (href === "/app" ? path === "/app" : path.startsWith(href));

function Brand({ className = "" }: { className?: string }) {
  return (
    <Link href="/app" className={`inline-flex items-center gap-2.5 text-[17px] font-semibold tracking-tight ${className}`} aria-label="Luca, inicio">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/icon-192.png" alt="" width={30} height={30} className="rounded-lg border border-line" />
      <span>luca<span className="text-primary">.</span></span>
    </Link>
  );
}

function Shell({ children, signOutAction }: { children: ReactNode; signOutAction: () => Promise<void> }) {
  const { state, user, refresh, refreshing, sessionExpired, mode } = useLedger();
  const step = useOnboardingStep();
  const path = usePathname();
  const ready = state.phase === "ready";
  const pending = useMemo(() => (state.phase === "ready" ? state.data.txs.filter((t) => t.tipo === "expense" && !t.categoria).length : 0), [state]);
  const sheetUrl = state.phase === "ready" ? state.file.webViewLink ?? `https://docs.google.com/spreadsheets/d/${state.file.id}/edit` : "";

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[236px_minmax(0,1fr)]">
      <a href="#contenido" className="btn sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-2 focus:z-50">Ir al contenido</a>

      <aside className="sticky top-0 hidden h-screen flex-col gap-1 border-r border-line px-3.5 py-5 lg:flex" aria-label="Navegación principal">
        <Brand className="mb-4 px-2" />
        <nav aria-label="Secciones">
          <ul className="grid gap-1">
            {NAV.map(({ href, label, Icon }) => {
              const on = isOn(href, path);
              return (
                <li key={href}>
                  <Link href={href} aria-current={on ? "page" : undefined}
                    className={`flex items-center gap-3 rounded-[10px] border px-2.5 py-2 text-sm font-medium transition-colors ${on ? "border-[var(--nav-on-line)] bg-[var(--nav-on-bg)] text-[var(--nav-on-fg)]" : "border-transparent text-body hover:bg-strong hover:text-ink"}`}>
                    <Icon />{label}
                    {href === "/app/movimientos" && pending > 0 && <span className="num ml-auto grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1.5 text-[11px] text-white" aria-label={`${pending} por categorizar`}>{pending}</span>}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <div className="flex-1" />
        {sheetUrl && <a className="flex items-center gap-3 rounded-[10px] px-2.5 py-2 text-sm font-medium text-body hover:bg-strong hover:text-ink" href={sheetUrl} target="_blank" rel="noreferrer"><IconExterno />Abrir mi Sheet</a>}
        <div className="mt-1 flex items-center gap-2.5 rounded-xl border border-line bg-card p-2.5 text-[13px]">
          {user.image
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={user.image} alt="" width={30} height={30} className="rounded-full" referrerPolicy="no-referrer" />
            : <span className="grid h-[30px] w-[30px] flex-none place-items-center rounded-full bg-primary-soft font-semibold text-primary">{(user.name || user.email || "?")[0].toUpperCase()}</span>}
          <div className="min-w-0 flex-1">
            <b className="block truncate font-semibold">{user.name || "Tu cuenta"}</b>
            <small className="block truncate text-muted" title={user.email}>{user.email}</small>
          </div>
          <form action={signOutAction}><button className="btn ghost sm" type="submit" title="Cerrar sesión"><IconSalir size={16} /><span>Salir</span></button></form>
        </div>
      </aside>

      <div className="min-w-0">
        <div className="mx-auto grid w-full max-w-[1180px] content-start gap-4 px-4 pb-28 pt-5 sm:px-6 lg:px-8 lg:pb-12 lg:pt-7">
          <TopBar ready={ready} refresh={refresh} refreshing={refreshing} />

          {mode === "mock" && <p className="text-center text-[11px] text-muted" data-testid="mock-banner">Modo de prueba (LUCA_MOCK): datos sintéticos en tu navegador, sin Google.</p>}

          {sessionExpired && (
            <Notice kind="warn" action={<form action={signOutAction}><button className="btn primary" type="submit">Volver a entrar</button></form>}>
              Tu sesión con Google caducó o el permiso fue revocado. Vuelve a entrar para seguir.
            </Notice>
          )}

          <main id="contenido" className="grid min-w-0 content-start gap-4">
            {state.phase === "loading" && <LoadingSkeleton />}
            {state.phase === "nofile" && <Step1Sheet />}
            {ready && (
              <>
                {step === 2 && <Step2Authorize />}
                {step === 3 && <Step3Connections />}
                {state.error && <Notice kind="warn">No pude leer la hoja: {state.error}</Notice>}
                {/* En el Resumen el aviso va debajo del saludo (lo pinta Dashboard). */}
                {path !== "/app" && <VersionNotice />}
                {children}
              </>
            )}
          </main>
        </div>
      </div>

      <TabBar path={path} pending={pending} />
    </div>
  );
}

function TopBar({ ready, refresh, refreshing }: { ready: boolean; refresh: () => Promise<void>; refreshing: boolean }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement as HTMLElement | null;
      if (e.key !== "/" || e.metaKey || e.ctrlKey || el?.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el?.tagName ?? "")) return;
      e.preventDefault(); input.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Brand className="lg:hidden" />
      {ready && (
        <form role="search" className="order-3 flex min-w-[200px] flex-1 basis-full items-center gap-2.5 rounded-xl border border-line bg-card px-3 text-muted transition-[border-color,box-shadow] focus-within:border-primary focus-within:shadow-[0_0_0_3px_color-mix(in_srgb,var(--primary)_18%,transparent)] sm:order-none sm:basis-auto"
          onSubmit={(e) => { e.preventDefault(); const v = q.trim(); router.push(`/app/movimientos${v ? `?q=${encodeURIComponent(v)}` : ""}`); }}>
          <IconBuscar />
          <label htmlFor="buscar-global" className="sr-only">Buscar movimientos</label>
          <input id="buscar-global" ref={input} type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar comercio, persona o categoría"
            className="h-[42px] min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-muted" />
          <kbd className="hidden sm:inline">/</kbd>
        </form>
      )}
      <div className="ml-auto flex items-center gap-2 sm:ml-0">
        {ready && <button className="btn icon sm:w-auto sm:px-4" onClick={refresh} disabled={refreshing} aria-label="Volver a leer la Sheet" title="Volver a leer la Sheet">
          <IconActualizar className={refreshing ? "animate-spin" : ""} /><span className="hidden sm:inline">{refreshing ? "Actualizando…" : "Actualizar"}</span>
        </button>}
        <ThemeToggle />
        {ready && <Link className="btn primary hidden lg:inline-flex" href="/app/agregar" aria-label="Agregar movimiento"><IconMas />Agregar</Link>}
      </div>
    </div>
  );
}

function TabBar({ path, pending }: { path: string; pending: number }) {
  return (
    <nav aria-label="Secciones" className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-[color-mix(in_srgb,var(--card)_92%,transparent)] px-1.5 pb-[calc(6px+env(safe-area-inset-bottom,0px))] pt-1.5 backdrop-blur-[14px] lg:hidden">
      <ul className="grid grid-cols-5 items-end">
        {NAV.map(({ href, label, Icon }) => {
          const on = isOn(href, path);
          if (href === "/app/agregar") return (
            <li key={href} className="grid justify-items-center">
              <Link href={href} aria-current={on ? "page" : undefined} className="-mt-5 grid justify-items-center gap-1 text-[11px] font-medium text-body">
                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-primary-strong text-white shadow-[var(--halo)] transition-transform active:scale-95"><Icon size={22} /></span>
                {label}
              </Link>
            </li>
          );
          return (
            <li key={href}>
              <Link href={href} aria-current={on ? "page" : undefined} className={`relative grid justify-items-center gap-1 rounded-[10px] px-0.5 py-1.5 text-[11px] font-medium ${on ? "text-primary" : "text-muted"}`}>
                <Icon size={20} />{label}
                {href === "/app/movimientos" && pending > 0 && <span className="num absolute left-[calc(50%+6px)] top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] text-white" aria-hidden>{pending}</span>}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function LoadingSkeleton() {
  return (
    <div className="grid gap-4" role="status" aria-label="Buscando tu Sheet de Luca en tu Drive…">
      <div className="skeleton h-8 w-56" />
      <div className="grid gap-4 md:grid-cols-[1.5fr_1fr]"><div className="skeleton h-56 rounded-2xl" /><div className="skeleton h-56 rounded-2xl" /></div>
      <div className="skeleton h-72 rounded-2xl" />
      <p className="text-sm text-muted">Buscando tu Sheet de Luca en tu Drive…</p>
    </div>
  );
}
