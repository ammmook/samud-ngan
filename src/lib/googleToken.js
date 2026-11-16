const ISSUERS = ['accounts.google.com', 'https://accounts.google.com'];

/* อ่านข้อมูลจาก ID token ของ Google และตรวจ aud / iss / exp ฝั่งไคลเอนต์
   หมายเหตุ: การตรวจลายเซ็นต้องทำที่เซิร์ฟเวอร์ ตรงนี้ใช้แสดงชื่อและแยกบันทึกในเครื่องเท่านั้น ไม่ใช่การรักษาความปลอดภัย */
export function readGoogleToken(token, clientId, nowMs = Date.now()) {
  const b64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
  const p = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))));
  if (!clientId || p.aud !== clientId || !ISSUERS.includes(p.iss) || !(p.exp * 1000 > nowMs) || !p.sub) throw new Error('token ไม่ถูกต้อง');
  return {
    sub: String(p.sub),
    name: p.name || p.email || 'ผู้ใช้ Google',
    email: p.email,
    picture: typeof p.picture === 'string' && p.picture.startsWith('https://') ? p.picture : undefined,
  };
}
