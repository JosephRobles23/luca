/**
 * crypto.test.mjs — HMAC del challenge y código de pairing (src/crypto.ts). Sin dependencias.
 * La firma debe casar byte a byte con Utilities.computeHmacSha256Signature + base64Encode de GAS
 * (tests/mcp-runtime.test.mjs comprueba el otro lado con node:crypto).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import nodeCrypto from 'node:crypto';
import { hmacBase64, timingSafeEqual, pairingCode } from '../src/crypto.ts';

test('hmacBase64 coincide con createHmac(sha256).digest(base64)', async () => {
  const expected = nodeCrypto.createHmac('sha256', 'S3CRET-de-prueba').update('nonce-123').digest('base64');
  assert.equal(await hmacBase64('nonce-123', 'S3CRET-de-prueba'), expected);
  assert.notEqual(await hmacBase64('nonce-124', 'S3CRET-de-prueba'), expected);
  assert.notEqual(await hmacBase64('nonce-123', 'otro'), expected);
  // UTF-8 (ñ) en clave y mensaje
  assert.equal(await hmacBase64('señal', 'contraseña'), nodeCrypto.createHmac('sha256', 'contraseña').update('señal').digest('base64'));
});

test('timingSafeEqual', () => {
  assert.equal(timingSafeEqual('abc', 'abc'), true);
  assert.equal(timingSafeEqual('abc', 'abd'), false);
  assert.equal(timingSafeEqual('abc', 'ab'), false);
  assert.equal(timingSafeEqual('', ''), true);
});

test('pairingCode: 8 caracteres sin ambigüedades, aleatorio', () => {
  const codes = new Set();
  for (let i = 0; i < 200; i++) {
    const c = pairingCode();
    assert.match(c, /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{8}$/);
    codes.add(c);
  }
  assert.ok(codes.size > 190);
});
