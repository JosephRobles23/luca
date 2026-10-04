/**
 * auth.ts — defaultHandler del OAuthProvider: rutas que NO son /mcp.
 *
 *  POST /enroll     — llamado por LucaLib (sidebar "Conectar con tu IA"): {webAppUrl, secret}.
 *                     Verifica por challenge HMAC que ese /exec posee el secreto y crea un código
 *                     de pairing (8 caracteres, un solo uso, 10 min).
 *  GET  /authorize  — página donde el usuario pega el código (paso de identidad del OAuth).
 *  POST /authorize  — consume el código → crea el tenant → completa la autorización con
 *                     props={tenantId}. El provider maneja /token y /register.
 *  GET  /meta       — { lucaLibVersion, minShortcutSchema } desde variables de entorno, para que
 *                     la web y el sidebar detecten copias desactualizadas.
 *
 * No hay /events (ADR-003) ni ningún endpoint que reciba datos del ledger.
 */
import type { Env } from './env';
import { verifyDeployment } from './gasClient';
import { createPairing, consumePairing, createTenant } from './storage';
import { pairingCode } from './crypto';
import { isExecUrl } from './schemas';

export const PAIRING_TTL_MS = 10 * 60 * 1000; // 10 min

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });
}

function html(body: string, status = 200): Response {
  return new Response(body, { status, headers: { 'content-type': 'text/html; charset=utf-8' } });
}

export function metaPayload(env: Pick<Env, 'LUCA_LIB_VERSION' | 'MIN_SHORTCUT_SCHEMA'>) {
  return {
    lucaLibVersion: String(env.LUCA_LIB_VERSION || ''),
    minShortcutSchema: String(env.MIN_SHORTCUT_SCHEMA || '1')
  };
}

function authorizePage(message = ''): string {
  return `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Conectar Luca</title>
<body style="font-family:system-ui;max-width:28rem;margin:4rem auto;padding:0 1rem;color:#1d1a17">
<h1 style="font-weight:600">Conectar Luca</h1>
<p>Abre tu hoja de Luca → menú <b>Luca → Configuración → Conectar con tu IA</b> y pega aquí el código de 8 caracteres.</p>
<p style="color:#8b857c;font-size:.9rem">Tus movimientos no pasan por aquí: tu IA hablará con el Apps Script de tu propia cuenta de Google.</p>
${message ? `<p style="color:#b91c1c">${message}</p>` : ''}
<form method="POST">
  <input name="code" autofocus autocomplete="off" placeholder="CÓDIGO" maxlength="8"
    style="font-size:1.2rem;letter-spacing:.2em;padding:.6rem;width:100%;box-sizing:border-box;text-transform:uppercase">
  <button style="margin-top:1rem;padding:.6rem 1.2rem;font-size:1rem;background:#d9623b;color:#fff;border:0;border-radius:6px">Conectar</button>
</form></body>`;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // --- Meta (público, sin datos de usuarios) ---
    if (url.pathname === '/meta' && request.method === 'GET') {
      return json(metaPayload(env));
    }

    // --- Enrollment (LucaLib → Worker) ---
    if (url.pathname === '/enroll' && request.method === 'POST') {
      let body: { webAppUrl?: string; secret?: string };
      try { body = await request.json(); } catch { return json({ ok: false, error: 'bad-request' }, 400); }
      const webAppUrl = String(body.webAppUrl || '');
      const secret = String(body.secret || '');
      if (!isExecUrl(webAppUrl) || !secret) {
        return json({ ok: false, error: 'invalid-params' }, 400);
      }
      const ok = await verifyDeployment(webAppUrl, secret).catch(() => false);
      if (!ok) return json({ ok: false, error: 'challenge-failed' }, 400);
      const code = pairingCode();
      await createPairing(env, code, webAppUrl, secret, PAIRING_TTL_MS);
      return json({ ok: true, code, expiresInSeconds: PAIRING_TTL_MS / 1000 });
    }

    // --- OAuth authorize: página del código de pairing ---
    if (url.pathname === '/authorize') {
      if (request.method === 'GET') return html(authorizePage());

      if (request.method === 'POST') {
        const form = await request.formData();
        const code = String(form.get('code') || '').trim().toUpperCase();
        const pairing = code ? await consumePairing(env, code) : null;
        if (!pairing) return html(authorizePage('Código inválido o vencido. Genera uno nuevo desde tu hoja de Luca.'), 400);

        const tenantId = crypto.randomUUID();
        await createTenant(env, tenantId, pairing.webAppUrl, pairing.secret);

        // Completa el flujo OAuth atando props={tenantId} al token que el provider emitirá.
        const authReq = await env.OAUTH_PROVIDER.parseAuthRequest(request);
        const { redirectTo } = await env.OAUTH_PROVIDER.completeAuthorization({
          request: authReq,
          userId: tenantId,
          metadata: {},
          scope: authReq.scope,
          props: { tenantId }
        });
        return Response.redirect(redirectTo, 302);
      }
    }

    return new Response('Not found', { status: 404 });
  }
};
