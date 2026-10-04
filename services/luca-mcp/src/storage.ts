/** storage.ts — Adapter D1 (aislado para poder portar a Firestore/otro en Cloud Run). */
import type { Env } from './env';

export interface Tenant { id: string; webAppUrl: string; secret: string; }

// --- Pairings pendientes (creados en /enroll, consumidos en /authorize) ---

export async function createPairing(
  env: Env, code: string, webAppUrl: string, secret: string, ttlMs: number
): Promise<void> {
  await env.DB.prepare(
    'INSERT INTO pairings (code, web_app_url, secret, expires_at) VALUES (?, ?, ?, ?)'
  ).bind(code, webAppUrl, secret, Date.now() + ttlMs).run();
}

/** Consume (un-solo-uso) un pairing válido: lo borra y devuelve sus datos, o null si no sirve. */
export async function consumePairing(
  env: Env, code: string
): Promise<{ webAppUrl: string; secret: string } | null> {
  const row = await env.DB.prepare(
    'SELECT web_app_url, secret, expires_at FROM pairings WHERE code = ?'
  ).bind(code).first<{ web_app_url: string; secret: string; expires_at: number }>();
  if (row) await env.DB.prepare('DELETE FROM pairings WHERE code = ?').bind(code).run();
  if (!row || row.expires_at < Date.now()) return null;
  return { webAppUrl: row.web_app_url, secret: row.secret };
}

// --- Tenants (emparejados) ---

export async function createTenant(
  env: Env, id: string, webAppUrl: string, secret: string
): Promise<void> {
  await env.DB.prepare(
    'INSERT OR REPLACE INTO tenants (id, web_app_url, secret, created_at) VALUES (?, ?, ?, ?)'
  ).bind(id, webAppUrl, secret, Date.now()).run();
}

export async function getTenant(env: Env, id: string): Promise<Tenant | null> {
  const row = await env.DB.prepare(
    'SELECT id, web_app_url, secret FROM tenants WHERE id = ?'
  ).bind(id).first<{ id: string; web_app_url: string; secret: string }>();
  return row ? { id: row.id, webAppUrl: row.web_app_url, secret: row.secret } : null;
}

export async function deleteTenant(env: Env, id: string): Promise<void> {
  await env.DB.prepare('DELETE FROM tenants WHERE id = ?').bind(id).run();
}
