#!/usr/bin/env node
// Decodifica un ID token (JWT) en local sin verificar firma. Uso:
//   node spikes/s4-decode-jwt.mjs "<token>"
// No pegues tokens en sitios web.
const token = process.argv[2];
if (!token || token.split('.').length !== 3) {
  console.error('Uso: node spikes/s4-decode-jwt.mjs "<jwt>"');
  process.exit(1);
}
const b64 = (s) => Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
const [h, p] = token.split('.');
const header = JSON.parse(b64(h));
const payload = JSON.parse(b64(p));
const fmt = (t) => (t ? new Date(t * 1000).toISOString() : '-');
console.log('header :', header);
console.log('payload:', payload);
console.log('\nresumen S4');
console.log('  iss      :', payload.iss);
console.log('  aud      :', payload.aud, '   <- debe ser constante por copia y distinto entre copias');
console.log('  sub      :', payload.sub, '   <- id de la cuenta del usuario');
console.log('  email    :', payload.email, payload.email_verified ? '(verificado)' : '');
console.log('  iat/exp  :', fmt(payload.iat), '→', fmt(payload.exp), `(${payload.exp - payload.iat}s)`);
