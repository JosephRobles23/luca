import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // No generar AGENTS.md/CLAUDE.md dentro de apps/web: las guías del repo viven en la raíz.
  agentRules: false,
};

export default nextConfig;
