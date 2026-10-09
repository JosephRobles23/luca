/**
 * Respaldo sin conexión (ADR-011): el service worker la sirve desde la caché cuando no hay red y aún no hay una copia
 * de esa página en el dispositivo. Estática y sin JavaScript necesario: "Reintentar" es un enlace.
 */
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Sin conexión", robots: { index: false, follow: false } };

export default function SinConexion() {
  return (
    <main className="grid min-h-dvh place-items-center bg-canvas px-4 py-10">
      <section className="card grid max-w-[420px] justify-items-start gap-3" data-testid="offline-fallback">
        <h1 className="page-title">Sin conexión</h1>
        <p className="text-[15px] text-body">
          No hay internet y en este dispositivo aún no hay datos guardados de esta página. Cuando abras Luca con conexión,
          quedará una copia de tus últimos datos para verlos sin internet.
        </p>
        <a className="btn primary" href="/app">Reintentar</a>
      </section>
    </main>
  );
}
