import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { IconChevron } from "./icons";
import ThemeToggle from "./ThemeToggle";

/** Páginas legales: cabecera simple, tipografía de lectura e índice lateral en escritorio. */
export default function LegalLayout({ title, updated, sections = [], children }: {
  title: string;
  updated: string;
  /** [id del h2, etiqueta] para el índice lateral */
  sections?: ReadonlyArray<readonly [string, string]>;
  children: ReactNode;
}) {
  return (
    <>
      <header className="sticky top-0 z-30 border-b border-line-soft bg-[color-mix(in_srgb,var(--canvas)_86%,transparent)] backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-3 px-4 sm:px-7">
          <Link href="/" className="inline-flex items-center gap-2.5 text-[17px] font-semibold tracking-[-0.3px] text-ink no-underline">
            <Image src="/icon-192.png" alt="" width={30} height={30} className="rounded-lg border border-line" />
            <span>luca<b className="text-primary">.</b></span>
          </Link>
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <Link href="/" className="btn ghost sm"><IconChevron dir="left" size={16} /> Volver a la portada</Link>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-5xl gap-10 px-4 pb-20 pt-10 sm:px-7 sm:pt-14 lg:grid-cols-[200px_minmax(0,1fr)]">
        {sections.length > 0 && (
          <nav aria-label="En esta página" className="hidden lg:block">
            <div className="sticky top-24">
              <p className="eyebrow mb-3">En esta página</p>
              <ul className="grid gap-0.5 border-l border-line text-[13px]">
                {sections.map(([id, label]) => (
                  <li key={id}><a href={`#${id}`} className="-ml-px block border-l border-transparent py-1.5 pl-3 text-muted no-underline transition-colors hover:border-primary hover:text-ink">{label}</a></li>
                ))}
              </ul>
            </div>
          </nav>
        )}
        <main className={`min-w-0 max-w-[68ch] ${sections.length ? "" : "lg:col-span-2 lg:mx-auto"}`}>
          <p className="eyebrow rise">Legal</p>
          <h1 className="rise mt-2 text-[clamp(30px,4.4vw,44px)] font-medium leading-[1.08] tracking-[-0.03em]" style={{ ["--i" as string]: 1 }}>{title}</h1>
          <p className="rise mt-3" style={{ ["--i" as string]: 2 }}><span className="pill">Última actualización: {updated}</span></p>
          <article className="prose-luca rise mt-8 [&_h2]:scroll-mt-24" style={{ ["--i" as string]: 3 }}>{children}</article>
        </main>
      </div>
    </>
  );
}
