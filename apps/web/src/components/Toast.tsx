"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";

type Toast = { id: number; kind: "ok" | "error" | "info"; text: string };
type Api = { toast: (text: string, kind?: Toast["kind"]) => void };

const Ctx = createContext<Api>({ toast: () => {} });
export const useToast = () => useContext(Ctx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const seq = useRef(0);
  const toast = useCallback((text: string, kind: Toast["kind"] = "ok") => {
    const id = ++seq.current;
    setItems((xs) => [...xs, { id, kind, text }]);
    setTimeout(() => setItems((xs) => xs.filter((t) => t.id !== id)), kind === "error" ? 8000 : 3500);
  }, []);
  const api = useMemo(() => ({ toast }), [toast]);
  return (
    <Ctx.Provider value={api}>
      {children}
      <div className="fixed bottom-4 left-1/2 z-50 flex w-[min(92vw,420px)] -translate-x-1/2 flex-col gap-2" aria-live="polite" aria-atomic="false">
        {items.map((t) => (
          <div key={t.id} role="status" data-testid="toast" data-kind={t.kind}
            className={`card flex items-start gap-2 py-3 text-sm shadow-lg ${t.kind === "error" ? "border-warn" : t.kind === "ok" ? "border-ok" : ""}`}>
            <i className={`dot mt-1.5 flex-none ${t.kind === "error" ? "warn" : t.kind === "info" ? "off" : ""}`} />
            <span className="flex-1">{t.text}</span>
            <button className="text-muted hover:text-text" aria-label="Cerrar aviso" onClick={() => setItems((xs) => xs.filter((x) => x.id !== t.id))}>×</button>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
