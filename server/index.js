// เริ่มเซิร์ฟเวอร์จริง: ตรวจ Google ID token ด้วย google-auth-library
// ต้องมี env: DATABASE_URL, AWS_* (จาก neon deploy), VITE_GOOGLE_CLIENT_ID, SESSION_SECRET
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { OAuth2Client } from 'google-auth-library';
import { files, pool } from './neon.js';
import { createApp } from './app.js';

const clientId = process.env.VITE_GOOGLE_CLIENT_ID;
const google = new OAuth2Client();
// ไม่มี client id: ลงชื่อด้วย Google ไม่ได้ (ทุกคำขอ login ถูกปฏิเสธ) แต่ส่วนอื่นของ API ยังรันได้
const verifyGoogle = async (credential) => {
  if (!clientId) throw new Error('ยังไม่ได้ตั้ง VITE_GOOGLE_CLIENT_ID');
  const ticket = await google.verifyIdToken({ idToken: credential, audience: clientId });
  return ticket.getPayload();
};

const port = Number(process.env.PORT) || 8787;
createApp({
  pool, files, verifyGoogle,
  sessionSecret: process.env.SESSION_SECRET,
  distDir: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../dist'),
}).listen(port, () => console.log('api on :' + port + (clientId ? '' : ' (ยังไม่มี VITE_GOOGLE_CLIENT_ID)')));
