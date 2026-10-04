/**
 * gasClient.ts — Puente HTTP al GAS Web App de un tenant. Calza EXACTO con el contrato de
 * `LucaLib.mcpAction` (gas/shared/mcp-runtime.js): POST a `<webAppUrl>?mcp=1` con body JSON
 * `{ op, secret, args, nonce }`; la respuesta es `{ ok, ... }`.
 *
 * ÚNICO acoplamiento con el backend: si cambia el contrato de mcpAction, cambia aquí.
 */
import { hmacBase64, timingSafeEqual } from './crypto';

function withMcpParam(url: string): string {
  return url + (url.indexOf('?') > -1 ? '&' : '?') + 'mcp=1';
}

async function post(webAppUrl: string, body: unknown): Promise<any> {
  const res = await fetch(withMcpParam(webAppUrl), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    redirect: 'follow' // GAS /exec responde con 302 → contenido; fetch lo sigue
  });
  const text = await res.text();
  let json: any;
  try { json = JSON.parse(text); } catch { throw new Error('Respuesta no-JSON del backend GAS.'); }
  return json;
}

/** Ejecuta una op de tool. Lanza si `ok:false`. Devuelve el objeto `{ ok, ... }`. */
export async function callGas(
  webAppUrl: string, secret: string, op: string, args: Record<string, unknown> = {}
): Promise<any> {
  const json = await post(webAppUrl, { op, secret, args });
  if (!json || json.ok !== true) throw new Error(String((json && json.error) || 'error del backend'));
  return json;
}

/**
 * Challenge-response del enrollment: prueba que `webAppUrl` realmente posee `secret`
 * (anti-spoof: no puedes registrar el /exec de otra persona). El nonce se firma en GAS
 * con el secreto GUARDADO allí; aquí verificamos con el secreto recibido en /enroll.
 */
export async function verifyDeployment(webAppUrl: string, secret: string): Promise<boolean> {
  const nonce = crypto.randomUUID();
  const json = await post(webAppUrl, { op: 'challenge', nonce });
  if (!json || json.ok !== true || typeof json.sig !== 'string') return false;
  const expected = await hmacBase64(nonce, secret);
  return timingSafeEqual(expected, json.sig);
}
