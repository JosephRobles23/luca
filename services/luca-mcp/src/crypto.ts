/** HMAC-SHA256 → base64 estándar. Debe casar byte-a-byte con el lado GAS:
 *  Utilities.base64Encode(Utilities.computeHmacSha256Signature(nonce, secret)). */
export async function hmacBase64(message: string, key: string): Promise<string> {
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    'raw', enc.encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', cryptoKey, enc.encode(message));
  let bin = '';
  const bytes = new Uint8Array(sig);
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

/** Comparación en tiempo constante (evita timing oracle al verificar el challenge). */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Código de pairing legible: 8 caracteres sin ambigüedades. */
export function pairingCode(): string {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const buf = new Uint8Array(8);
  crypto.getRandomValues(buf);
  let out = '';
  for (let i = 0; i < buf.length; i++) out += alphabet[buf[i] % alphabet.length];
  return out;
}
