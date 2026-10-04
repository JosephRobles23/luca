import Link from "next/link";
import type { ReactNode } from "react";

export default function LegalLayout({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <Link href="/" className="text-lg font-extrabold tracking-tight">luca<span className="text-accent">.</span></Link>
      <h1 className="mt-8 text-3xl font-extrabold tracking-tight">{title}</h1>
      <p className="mt-1 text-xs text-muted">Última actualización: {updated}</p>
      <article className="prose-luca mt-8">{children}</article>
    </main>
  );
}
