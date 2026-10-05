"use client";

/**
 * Pausa las animaciones CSS de su contenido hasta que entra en la vista (una sola vez), para que el camino
 * de los datos o el chat de ejemplo se animen cuando el visitante llega a ellos y no al cargar la página.
 * Con movimiento reducido la pausa no aplica (ver portada.module.css): todo aparece en su estado final.
 */
import { useEffect, useRef, useState, type ReactNode } from "react";
import s from "./portada.module.css";

export function Reveal({ children, className = "", as: Tag = "div" }: { children: ReactNode; className?: string; as?: "div" | "section" | "ol" }) {
  const ref = useRef<HTMLElement>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) { setInView(true); io.disconnect(); }
    }, { rootMargin: "0px 0px -15% 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <Tag ref={ref as never} className={`${s.reveal} ${className}`} data-inview={inView ? "true" : "false"}>
      {children}
    </Tag>
  );
}
