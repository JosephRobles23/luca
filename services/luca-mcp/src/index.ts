/**
 * index.ts — Entry del Worker luca-mcp. Compone el OAuthProvider (que maneja /authorize, /token,
 * /register y protege /mcp) con el handler MCP stateless (createMcpHandler).
 *
 * Flujo: cliente MCP (Claude/ChatGPT) → OAuth (DCR+PKCE) → /authorize (código de pairing, ver
 * auth.ts) → token con props.tenantId → llamadas a /mcp → tools.ts resuelve el tenant y proxea al
 * Web App /exec del usuario (ADR-001, opción A).
 *
 * Sin /events: el iPhone habla directo con el /exec del usuario (ADR-003).
 */
import { OAuthProvider } from '@cloudflare/workers-oauth-provider';
import { createMcpHandler } from 'agents/mcp/server';
import type { Env } from './env';
import { buildServer } from './tools';
import authHandler from './auth';

/** 24 h (ADR-007 §3): menos refreshes → menos writes de KV en el plan Free compartido. */
export const ACCESS_TOKEN_TTL_SECONDS = 24 * 60 * 60;

export default new OAuthProvider({
  apiRoute: '/mcp',
  // El factory recibe el env por closure; createMcpHandler crea un McpServer fresco por request.
  apiHandler: {
    fetch: (request: Request, env: Env, ctx: ExecutionContext) =>
      createMcpHandler(() => buildServer(env))(request, env, ctx)
  },
  defaultHandler: authHandler,
  authorizeEndpoint: '/authorize',
  tokenEndpoint: '/token',
  clientRegistrationEndpoint: '/register',
  accessTokenTTL: ACCESS_TOKEN_TTL_SECONDS
});
