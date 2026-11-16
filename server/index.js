// เริ่มเซิร์ฟเวอร์จริง: ตรวจ JWT (EdDSA) ของ Neon Auth ด้วย JWKS
// ต้องมี env: DATABASE_URL, AWS_*, NEON_AUTH_BASE_URL, NEON_AUTH_JWKS_URL (ทั้งหมดมาจาก `neon deploy`)
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { files, pool } from './neon.js';
import { createApp } from './app.js';

const { NEON_AUTH_BASE_URL, NEON_AUTH_JWKS_URL } = process.env;
if (!NEON_AUTH_BASE_URL || !NEON_AUTH_JWKS_URL) throw new Error('ไม่พบ NEON_AUTH_BASE_URL / NEON_AUTH_JWKS_URL (รัน neon deploy)');

const jwks = createRemoteJWKSet(new URL(NEON_AUTH_JWKS_URL));
const origin = new URL(NEON_AUTH_BASE_URL).origin; // iss และ aud ของ token คือ origin ของ Auth URL
const verifyToken = async (token) => (await jwtVerify(token, jwks, { issuer: origin, audience: origin, algorithms: ['EdDSA'] })).payload;

const port = Number(process.env.PORT) || 8787;
createApp({
  pool, files, verifyToken,
  distDir: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../dist'),
}).listen(port, () => console.log('api on :' + port));
