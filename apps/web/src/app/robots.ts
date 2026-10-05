import type { MetadataRoute } from "next";
import { SITE } from "@/lib/seo";

// Portada y páginas legales abiertas a buscadores y asistentes de IA; el panel y la API no se indexan.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/app", "/api/"] }],
    sitemap: `${SITE.url}/sitemap.xml`,
    host: SITE.url,
  };
}
