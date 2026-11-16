// เริ่มเซิร์ฟเวอร์จริง: ตรวจ JWT (EdDSA) ของ Neon Auth ด้วย JWKS
// ต้องมี env: DATABASE_URL, AWS_*, NEON_AUTH_BASE_URL, NEON_AUTH_JWKS_URL (ทั้งหมดมาจาก `neon deploy`)
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { files, pool } from './neon.js';
import { createApp } from './app.js';
import { verifyToken } from './auth.js';

const port = Number(process.env.PORT) || 8787;
createApp({
  pool, files, verifyToken,
  distDir: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../dist'),
}).listen(port, () => console.log('api on :' + port));
