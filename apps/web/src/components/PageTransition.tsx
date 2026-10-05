"use client";

/**
 * Transición entre páginas del panel (DESIGN.md §Motion): la página sale con un desvanecido y la nueva entra
 * subiendo 8px. Va en cada page.tsx, no en el layout: los layouts persisten y no disparan enter/exit.
 */
import { ViewTransition, type ReactNode } from "react";

export default function PageTransition({ children }: { children: ReactNode }) {
  return <ViewTransition enter="page" exit="page" default="none">{children}</ViewTransition>;
}
