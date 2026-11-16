// Neon Auth (Managed Better Auth): ลงชื่อเข้าใช้ด้วย Google และขอ JWT ไปเรียก API ของเรา
import { createAuthClient } from '@neon/auth';

// ค่า URL ถูกฝังตอน build จาก NEON_AUTH_BASE_URL (ดู vite.config.js) เป็นที่อยู่สาธารณะ ไม่ใช่ความลับ
export const authClient = createAuthClient(import.meta.env.VITE_NEON_AUTH_URL);

export const signInWithGoogle = () => authClient.signIn.social({ provider: 'google', callbackURL: window.location.origin });
export const signOutAuth = () => authClient.signOut().catch(() => {});

/* คืน { name, email, picture, id } ถ้ามี session (รวมกรณีเพิ่งกลับมาจากหน้า Google) ไม่งั้นคืน null */
export async function currentUser() {
  const { data } = await authClient.getSession();
  const u = data && data.user;
  return u ? { id: u.id, name: u.name || u.email, email: u.email, picture: typeof u.image === 'string' && u.image.startsWith('https://') ? u.image : undefined } : null;
}

// JWT อายุ 15 นาที เก็บไว้ใช้ซ้ำจนใกล้หมด
let cached = null;
export async function getToken() {
  const now = Date.now() / 1000;
  if (cached && cached.exp - 30 > now) return cached.token;
  // SDK ของ Neon ฉีด JWT ไว้ที่ session.token ของ getSession() (authClient.token() คืนข้อมูล session ไม่ใช่ { token })
  const { data, error } = await authClient.getSession();
  const token = data && data.session && data.session.token;
  if (error || typeof token !== 'string' || token.split('.').length !== 3) throw Object.assign(new Error('ขอ token ไม่สำเร็จ'), { status: 401 });
  const exp = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).exp;
  cached = { token, exp };
  return cached.token;
}
export const forgetToken = () => { cached = null; };
