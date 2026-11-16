// session cookie แบบไร้สถานะ: base64url(JSON {uid, exp}) + "." + HMAC-SHA256
import { createHmac, timingSafeEqual } from 'node:crypto';

export const COOKIE = 'sn_session';
export const MAX_AGE_S = 30 * 24 * 3600;

const mac = (secret, data) => createHmac('sha256', secret).update(data).digest('base64url');

export function signSession(secret, uid, nowMs = Date.now()) {
  const data = Buffer.from(JSON.stringify({ uid, exp: Math.floor(nowMs / 1000) + MAX_AGE_S })).toString('base64url');
  return data + '.' + mac(secret, data);
}

/* คืน uid หรือ null ถ้าลายเซ็นผิด/หมดอายุ/รูปแบบผิด */
export function readSession(secret, token, nowMs = Date.now()) {
  if (typeof token !== 'string') return null;
  const [data, sig, extra] = token.split('.');
  if (!data || !sig || extra !== undefined) return null;
  const want = Buffer.from(mac(secret, data)), got = Buffer.from(sig);
  if (want.length !== got.length || !timingSafeEqual(want, got)) return null;
  try {
    const p = JSON.parse(Buffer.from(data, 'base64url').toString());
    return Number.isInteger(p.uid) && p.exp * 1000 > nowMs ? p.uid : null;
  } catch { return null; }
}

export function cookieValue(header, name) {
  for (const part of (header || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim());
  }
  return null;
}

export const setCookie = (token, secure) =>
  `${COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${MAX_AGE_S}${secure ? '; Secure' : ''}`;
export const clearCookie = (secure) => `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure ? '; Secure' : ''}`;
