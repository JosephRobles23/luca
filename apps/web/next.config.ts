import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // No generar AGENTS.md/CLAUDE.md dentro de apps/web: las guías del repo viven en la raíz.
  agentRules: false,
  // El service worker (ADR-011) se revalida en cada visita para que una versión nueva llegue enseguida.
  async headers() {
    return [{
      source: "/sw.js",
      headers: [
        { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
        { key: "Content-Type", value: "application/javascript; charset=utf-8" },
      ],
    }];
  },
};

export default nextConfig;
