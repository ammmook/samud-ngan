// หัวความปลอดภัยและตัวจำกัดอัตราคำขอ ใช้ร่วมกันทั้งเซิร์ฟเวอร์ local และ Vercel Function
// หมายเหตุ: ค่า CSP ต้องตรงกับ headers ใน vercel.json (มีเทสต์เทียบให้) เพราะไฟล์หน้าเว็บบน Vercel
// ถูกเสิร์ฟจาก CDN ไม่ผ่านโค้ดนี้

// โฮสต์ของ Neon ผูกกับ region (c-4 / ap-southeast-1) ถ้าย้าย region ต้องแก้ตรงนี้และ vercel.json
const NEON_AUTH = 'https://*.neonauth.c-4.ap-southeast-1.aws.neon.tech';
const NEON_STORAGE = 'https://*.storage.c-4.ap-southeast-1.aws.neon.tech';

export const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com", // 'unsafe-inline': categories.js สร้าง <style> ตอนรัน
  "font-src 'self' https://fonts.gstatic.com",
  `img-src 'self' data: blob: https://*.googleusercontent.com ${NEON_STORAGE}`,
  `connect-src 'self' data: blob: ${NEON_AUTH}`, // data:/blob: เพราะตัวซิงก์ fetch รูปที่ยังไม่อัปโหลด
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "object-src 'none'",
  "form-action 'self'",
].join('; ');

export const SECURITY_HEADERS = {
  'content-security-policy': CSP,
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'x-frame-options': 'DENY',
};

/* ตัวจำกัดอัตราแบบหน้าต่างเวลา เก็บในหน่วยความจำของโปรเซสนี้เท่านั้น
   บน Vercel แต่ละ instance นับแยกกัน จึงเป็นเพียงด่านแรก ตัวจริงให้ตั้ง Vercel Firewall rate limit */
export function createRateLimiter({ windowMs = 60_000, max = 120, now = Date.now } = {}) {
  const hits = new Map(); // key -> { start, n }
  return (key) => {
    const t = now();
    if (hits.size > 10_000) for (const [k, v] of hits) if (t - v.start >= windowMs) hits.delete(k);
    let h = hits.get(key);
    if (!h || t - h.start >= windowMs) { h = { start: t, n: 0 }; hits.set(key, h); }
    h.n += 1;
    return h.n > max ? Math.max(1, Math.ceil((h.start + windowMs - t) / 1000)) : 0; // 0 = ผ่าน, ไม่งั้นคืนวินาทีที่ต้องรอ
  };
}

/* ไอพีผู้เรียก: เชื่อ x-forwarded-for เฉพาะเมื่อรันหลัง proxy ที่เชื่อถือได้ (Vercel) ไม่งั้นปลอมหลบลิมิตได้ */
export function clientIp(req, trustProxy) {
  if (trustProxy) {
    const xff = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
    if (xff) return xff;
  }
  return (req.socket && req.socket.remoteAddress) || 'unknown';
}
