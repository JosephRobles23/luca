# luca-mcp (pendiente)

Servidor MCP remoto en Cloudflare Workers. Será un **fork casi literal** de
`/home/user/Projects/CoS-Agent/services/vera-mcp` (OAuth 2.1 con `workers-oauth-provider`, D1 para
tenants/pairings, KV para estado OAuth, `createMcpHandler`), con estos cambios:

- Tools de Luca: `get_summary`, `category_breakdown`, `top_merchants`, `list_transactions`,
  `search_wiki`, `budget_status`, `add_expense`, `propose_import` / `commit_import`, `recategorize`.
- Endpoint `/pair`: canje de código (generado por la web) → verifica `ScriptApp.getIdentityToken()`
  (anclando `aud`+`sub`, validado en S4) → devuelve `{tenantId, secret, llmKey?, config}` al GAS.
- Endpoint `/events` para el iPhone (si S7 pasa).
- Acceso a datos: Opción A (Worker → `/exec` del usuario), ver `docs/architecture/adr-001-acceso-mcp-a-datos.md`.

Se crea cuando el ledger y el parser estén estables (siguiente hito).
