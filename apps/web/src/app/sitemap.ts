import type { MetadataRoute } from "next";
import { PUBLIC_PATHS, SITE } from "@/lib/seo";

export default function sitemap(): MetadataRoute.Sitemap {
  return PUBLIC_PATHS.map((path) => ({
    url: path === "/" ? SITE.url : `${SITE.url}${path}`,
    changeFrequency: "monthly",
    priority: path === "/" ? 1 : 0.3,
  }));
}
