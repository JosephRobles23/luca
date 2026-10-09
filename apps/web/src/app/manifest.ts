import type { MetadataRoute } from "next";
import { SITE } from "@/lib/seo";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: SITE.name,
    short_name: SITE.name,
    description: SITE.description,
    lang: SITE.lang,
    // App instalable (ADR-011): `id` estable aunque cambie `start_url`; el tema coincide con `viewport.themeColor`.
    id: "/app",
    start_url: "/app",
    scope: "/",
    display: "standalone",
    background_color: "#f4efe8",
    theme_color: "#f4efe8",
    categories: ["finance"],
    shortcuts: [
      { name: "Agregar gasto", short_name: "Agregar", url: "/app/agregar", icons: [{ src: "/icon-192.png", sizes: "192x192" }] },
      { name: "Movimientos", url: "/app/movimientos", icons: [{ src: "/icon-192.png", sizes: "192x192" }] },
    ],
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
