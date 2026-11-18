import { addDays, uid, weekStart } from './dates.js';

export function pref(key, fallback) { try { const v = localStorage.getItem(key); return v == null ? fallback : v; } catch (e) { return fallback; } }
export function setPref(key, val) { try { localStorage.setItem(key, val); } catch (e) { /* ไม่เป็นไร */ } }

const openDb = () => new Promise((res, rej) => {
  const r = indexedDB.open('samut-ngan', 1);
  r.onupgradeneeded = () => r.result.createObjectStore('kv');
  r.onsuccess = () => res(r.result);
  r.onerror = () => rej(r.error);
});
const idbGet = (k) => openDb().then((db) => new Promise((res, rej) => {
  const q = db.transaction('kv').objectStore('kv').get(k);
  q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error);
}));
const idbSet = (k, v) => openDb().then((db) => new Promise((res, rej) => {
  const t = db.transaction('kv', 'readwrite'); t.objectStore('kv').put(v, k);
  t.oncomplete = () => res(); t.onerror = () => rej(t.error);
}));

const idbDel = (k) => openDb().then((db) => new Promise((res, rej) => {
  const t = db.transaction('kv', 'readwrite'); t.objectStore('kv').delete(k);
  t.oncomplete = () => res(); t.onerror = () => rej(t.error);
}));

/* ล้างข้อมูลของผู้ใช้ที่ลงชื่อเข้าใช้ออกจากเครื่องนี้ (แม่แบบมีรายละเอียดงาน, สำเนาบันทึกเก่าใน IndexedDB)
   ไม่แตะข้อมูลโหมดผู้เยี่ยมชมและค่าที่ไม่ใช่ข้อมูลส่วนตัว เช่น มุมมองที่เลือก */
export function clearUserData(sub) {
  if (!sub) return Promise.resolve();
  const key = 'events:' + sub;
  try { localStorage.removeItem('sn-tpl:' + key); localStorage.removeItem('sn-' + key); } catch (e) { /* ไม่เป็นไร */ }
  return idbDel(key).catch(() => {});
}

export function loadEvents(key = 'events') {
  return idbGet(key).then((v) => (Array.isArray(v) ? v : [])).catch(() => {
    try { return JSON.parse(localStorage.getItem('sn-' + key) || '[]'); } catch (e) { return []; }
  });
}
/* คืนค่า true เมื่อเก็บสำเร็จ, false เมื่อเก็บไม่ได้ทั้งสองทาง */
export function saveEvents(list, key = 'events') {
  return idbSet(key, list).then(() => true).catch(() => {
    try { localStorage.setItem('sn-' + key, JSON.stringify(list)); return true; } catch (e) { return false; }
  });
}

/* ลดขนาดรูปก่อนเก็บ */
export function shrink(file) {
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(file), img = new Image();
    img.onload = () => {
      const s = Math.min(1, 1280 / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url); res(c.toDataURL('image/jpeg', 0.8));
    };
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('อ่านรูปไม่ได้')); };
    img.src = url;
  });
}

/* ข้อมูลตัวอย่าง (เปิดด้วย #demo ตอนยังไม่มีข้อมูล) */
function swatch(a, b) {
  const c = document.createElement('canvas'); c.width = 320; c.height = 240;
  const x = c.getContext('2d'), g = x.createLinearGradient(0, 0, 320, 240);
  g.addColorStop(0, a); g.addColorStop(1, b); x.fillStyle = g; x.fillRect(0, 0, 320, 240);
  return c.toDataURL('image/jpeg', 0.7);
}
export function demoData(today) {
  const ws = weekStart(today);
  const e = (off, s, en, cat, title, note, photos) => ({ id: uid(), date: addDays(ws, off), start: s, end: en, cat, title, note: note || '', photos: photos || [] });
  const p1 = swatch('#9CC77A', '#3E7A4A'), p2 = swatch('#E9C46A', '#B07A18'), p3 = swatch('#9EC5E3', '#356C94');
  const ph = (...s) => s.map((src) => ({ id: uid(), src }));
  return [
    e(0, '10:00', '11:00', 'lilac', 'ฟังบรรยายวิเคราะห์ข้อมูล', 'จดสรุปเรื่องการทำความสะอาดข้อมูลไว้ในสมุด'),
    e(1, '09:00', '10:00', 'sky', 'ประชุมทีมประจำสัปดาห์', 'ทบทวนงานที่ค้าง และแบ่งงานรอบใหม่'),
    e(1, '10:30', '12:30', 'meadow', 'เขียนรายงานสรุปไตรมาส', 'ร่างบทที่ 2 และใส่ตารางข้อมูล'),
    e(1, '13:30', '16:00', 'blossom', 'ออกแบบโปสเตอร์กิจกรรม', 'ลองสามแบบ เลือกแบบโทนเขียว', ph(p1, p2)),
    e(2, '08:30', '12:00', 'honey', 'ลงพื้นที่สำรวจหน้างาน', 'ถ่ายรูปจุดที่ต้องซ่อม และจดเลขที่อาคาร', ph(p2, p3, p1, p3)),
    e(2, '14:00', '17:30', 'meadow', 'จัดทำแผนงานเดือนหน้า', ''),
    e(3, '09:30', '10:30', 'sky', 'โทรคุยกับลูกค้า', ''),
    e(3, '11:00', '12:00', 'meadow', 'ตอบอีเมลและเคลียร์งานค้าง', ''),
    e(4, '09:00', '12:00', 'lilac', 'เรียนคอร์สออนไลน์', 'บทที่ 4 ถึง 6'),
    e(4, '13:00', '15:30', 'blossom', 'วาดภาพประกอบรายงาน', ''),
    e(-3, '09:00', '17:00', 'meadow', 'จัดระบบเอกสารโครงการ', 'แยกโฟลเดอร์ตามเดือน'),
    e(-2, '13:00', '15:00', 'sky', 'ประชุมส่งงานกับผู้จัดการ', ''),
    e(-8, '09:00', '16:00', 'honey', 'ลงพื้นที่ตรวจงานโซนเหนือ', ''),
    e(8, '10:00', '11:30', 'sky', 'นัดคุยแผนงานปลายปี', ''),
  ];
}
