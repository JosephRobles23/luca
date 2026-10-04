-- schema.sql — D1 de luca-mcp.  Aplicar con: npm run db:init
--
-- Modelo: cada tenant (un usuario de Luca) = un Web App /exec + su secreto por tenant.
-- El `sheetId` NO se guarda ni viaja: es implícito en la web_app_url → aislamiento.
-- Aquí no hay transacciones, tokens de Google ni claves de usuarios (ADR-001, CLAUDE.md).

-- Tenants ya emparejados. El token OAuth del provider lleva props.tenantId; las tools
-- resuelven {web_app_url, secret} por ese id (nunca desde input del modelo).
CREATE TABLE IF NOT EXISTS tenants (
  id           TEXT PRIMARY KEY,          -- uuid del tenant (va en props del token)
  web_app_url  TEXT NOT NULL,             -- /exec del usuario
  secret       TEXT NOT NULL,             -- secreto por tenant (Worker↔GAS)
  created_at   INTEGER NOT NULL           -- epoch ms
);

-- Pairings pendientes: creados por /enroll (tras el challenge HMAC), consumidos en /authorize.
-- Un solo uso + TTL 10 min.
CREATE TABLE IF NOT EXISTS pairings (
  code         TEXT PRIMARY KEY,          -- código de 8 caracteres que el usuario pega en /authorize
  web_app_url  TEXT NOT NULL,
  secret       TEXT NOT NULL,
  expires_at   INTEGER NOT NULL           -- epoch ms; rechazar si < now
);

CREATE INDEX IF NOT EXISTS idx_pairings_expires ON pairings(expires_at);
