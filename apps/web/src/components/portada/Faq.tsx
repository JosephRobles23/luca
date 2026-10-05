"use client";

/** Acordeón de preguntas. El texto viene de `FAQ` (lib/seo.ts), la misma fuente del JSON-LD. */
import { useId, useState } from "react";
import { IconChevron } from "@/components/icons";
import s from "./portada.module.css";

export function Faq({ items }: { items: ReadonlyArray<readonly [string, string]> }) {
  const [open, setOpen] = useState<Set<number>>(() => new Set([0]));
  const base = useId();
  const toggle = (n: number) => setOpen((prev) => { const next = new Set(prev); if (next.has(n)) next.delete(n); else next.add(n); return next; });
  return (
    <div className="mt-8 border-t border-line">
      {items.map(([q, a], n) => {
        const isOpen = open.has(n);
        return (
          <div key={q} className={s.faqItem}>
            <h3>
              <button type="button" className={s.faqBtn} aria-expanded={isOpen} aria-controls={`${base}-${n}`} id={`${base}-q${n}`} onClick={() => toggle(n)}>
                {q}<IconChevron size={18} className={s.chev} />
              </button>
            </h3>
            <div className="expand" data-open={isOpen} inert={!isOpen} id={`${base}-${n}`} role="region" aria-labelledby={`${base}-q${n}`}>
              <div><p className="max-w-[68ch] pb-5 text-body">{a}</p></div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
