// Vercel Function: รับทุกคำขอ /api/* แล้วส่งต่อให้ตัวจัดการเดียวกับเซิร์ฟเวอร์ local (server/app.js)
import { files, pool } from '../server/neon.js';
import { createHandler } from '../server/app.js';
import { verifyToken } from '../server/auth.js';

export default createHandler({ pool, files, verifyToken });
