// ตรวจ JWT (EdDSA) ของ Neon Auth ด้วย JWKS ใช้ร่วมกันทั้งเซิร์ฟเวอร์ local และ Vercel
import { createRemoteJWKSet, jwtVerify } from 'jose';

const { NEON_AUTH_BASE_URL, NEON_AUTH_JWKS_URL } = process.env;
if (!NEON_AUTH_BASE_URL || !NEON_AUTH_JWKS_URL) throw new Error('ไม่พบ NEON_AUTH_BASE_URL / NEON_AUTH_JWKS_URL (รัน neon deploy)');

const jwks = createRemoteJWKSet(new URL(NEON_AUTH_JWKS_URL));
const origin = new URL(NEON_AUTH_BASE_URL).origin; // iss และ aud ของ token คือ origin ของ Auth URL
export const verifyToken = async (token) => (await jwtVerify(token, jwks, { issuer: origin, audience: origin, algorithms: ['EdDSA'] })).payload;
