/** Bindings del Worker (ver wrangler.toml). */
import type { OAuthHelpers } from '@cloudflare/workers-oauth-provider';

export interface Env {
  DB: D1Database;
  OAUTH_KV: KVNamespace;
  /** Versión de LucaLib fijada en el stub de la plantilla; la expone GET /meta. */
  LUCA_LIB_VERSION?: string;
  /** Versión mínima del payload del atajo iOS (ADR-003); la expone GET /meta. */
  MIN_SHORTCUT_SCHEMA?: string;
  /** Inyectado por @cloudflare/workers-oauth-provider en el env del defaultHandler. */
  OAUTH_PROVIDER: OAuthHelpers;
}
