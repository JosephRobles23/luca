"use client";

/**
 * Formulario de cierre de sesión (ADR-011): antes de llamar al server action borra la copia local y las páginas
 * guardadas en el dispositivo, para que la siguiente persona que use el navegador no vea nada.
 */
import { useRef, type ReactNode } from "react";
import { clearLocalData } from "@/lib/offline-store";

export default function SignOutForm({ action, className, children }: { action: () => Promise<void>; className?: string; children: ReactNode }) {
  const cleared = useRef(false);
  return (
    <form action={action} className={className} onSubmit={(e) => {
      if (cleared.current) return;
      e.preventDefault();
      const form = e.currentTarget;
      void clearLocalData().finally(() => { cleared.current = true; form.requestSubmit(); });
    }}>
      {children}
    </form>
  );
}
