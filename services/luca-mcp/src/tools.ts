/**
 * tools.ts — Tools MCP de Luca v0. Cada una resuelve el tenant desde los props del token OAuth
 * (getMcpAuthContext) y proxea al Web App /exec de ESE usuario vía gasClient:
 *
 *   tool(args) → proxy(env, op, args) → callGas(execUrl, secret, op, args) → LucaLib.mcpAction
 *
 * El tenantId sale SIEMPRE del token (server-side), nunca de los args del modelo → evita el
 * confused-deputy. Las agregaciones, el dedupe y la validación de negocio corren en el Apps
 * Script del usuario (ADR-001): aquí no se procesa ni se registra ningún movimiento.
 */
import { McpServer } from '@modelcontextprotocol/server';
import { getMcpAuthContext } from 'agents/mcp/server';
import type { Env } from './env';
import { getTenant } from './storage';
import { callGas } from './gasClient';
import { toolShapes, toolDescriptions, toolTitles, toolAnnotations, TOOL_NAMES, type ToolName } from './schemas';

export const SERVER_INFO = { name: 'luca', version: '0.1.0' } as const;

async function resolveTenant(env: Env) {
  const auth = getMcpAuthContext();
  const tenantId = auth?.props?.tenantId as string | undefined;
  if (!tenantId) throw new Error('No autenticado: reconecta el conector de Luca.');
  const tenant = await getTenant(env, tenantId);
  if (!tenant) throw new Error('Conexión no encontrada: vuelve a conectar desde tu hoja de Luca.');
  return tenant;
}

/** Envuelve el resultado como content JSON (el cliente MCP lo parsea/razona). */
function jsonContent(data: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(data) }] };
}

/** Una tool = una op de GAS con el mismo nombre y los mismos args. */
async function proxy(env: Env, op: ToolName, args: Record<string, unknown>) {
  const t = await resolveTenant(env);
  return jsonContent(await callGas(t.webAppUrl, t.secret, op, args));
}

export function buildServer(env: Env): McpServer {
  const server = new McpServer(SERVER_INFO);
  for (const name of TOOL_NAMES) {
    server.registerTool(name, {
      title: toolTitles[name],
      description: toolDescriptions[name],
      inputSchema: toolShapes[name],
      annotations: { title: toolTitles[name], ...toolAnnotations[name] }
    }, async (args: Record<string, unknown>) => proxy(env, name, args ?? {}));
  }
  return server;
}
