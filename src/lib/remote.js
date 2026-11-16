// ติดต่อ API ของเซิร์ฟเวอร์ (บันทึกใน Neon Postgres, รูปใน Neon object storage)
// ซิงก์แบบส่งเฉพาะส่วนที่เปลี่ยน: เทียบรายการปัจจุบันกับที่เซิร์ฟเวอร์รู้ล่าสุด

export async function api(path, opt = {}) {
  const res = await fetch('/api' + path, { ...opt, headers: { ...(opt.headers || {}), authorization: 'Bearer ' + await tokenProvider() } });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(body.error || 'คำขอไม่สำเร็จ'), { status: res.status });
  return body;
}
/* ฟังก์ชันขอ JWT ของ Neon Auth (ตั้งจาก App เพื่อให้ไฟล์นี้ทดสอบนอกเบราว์เซอร์ได้) */
let tokenProvider = async () => { throw new Error('ยังไม่ได้ตั้ง token provider'); };
export const setTokenProvider = (fn) => { tokenProvider = fn; };
const jsonOpt = (method, body) => ({ method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

export const loadProfile = () => api('/auth/me');
export const putMe = (patch) => api('/me', jsonOpt('PUT', patch)).catch(() => {});
export const loadRemote = () => api('/events');

const BATCH = 100;
export const UNDO_GRACE_MS = 8000; // มากกว่าเวลาที่ปุ่ม "เลิกทำ" แสดงอยู่ (7 วินาที)
const onServer = (src) => !String(src).startsWith('data:');
const photoIds = (e) => (e.photos || []).map((p) => p.id);
const sig = (e) => JSON.stringify([e.date, e.start, e.end, e.cat, e.title, e.note || '', photoIds(e)]);

/* ตัวซิงก์: init(list) ตั้งฐานจากข้อมูลที่โหลดมา, push(list) ส่งส่วนต่าง คืน true เมื่อสำเร็จ */
export function createSyncer() {
  const known = new Map();      // id บันทึก -> sig ที่เซิร์ฟเวอร์มีอยู่
  const uploaded = new Set();   // id รูปที่อยู่บนเซิร์ฟเวอร์แล้ว
  const missingSince = new Map(); // id บันทึกที่หายไปจากรายการ -> เวลาที่เริ่มหาย
  let chain = Promise.resolve(true), latest = [], timer = null;

  async function run() {
    const list = latest;
    const ids = new Set(list.map((e) => e.id));
    // ลบบนเซิร์ฟเวอร์เมื่อผ่านช่วงเลิกทำแล้วเท่านั้น: การลบบันทึกลบไฟล์รูปใน bucket ด้วย
    // ถ้าส่งลบทันที ผู้ใช้กด "เลิกทำ" แล้วรูปจะหายถาวร
    const now = Date.now();
    for (const id of [...missingSince.keys()]) if (ids.has(id)) missingSince.delete(id);
    const gone = [...known.keys()].filter((id) => !ids.has(id));
    for (const id of gone) if (!missingSince.has(id)) missingSince.set(id, now);
    const deletes = gone.filter((id) => now - missingSince.get(id) >= UNDO_GRACE_MS);
    if (gone.length > deletes.length && !timer) {
      timer = setTimeout(() => { timer = null; push(latest); }, UNDO_GRACE_MS + 50);
    }
    const changed = list.filter((e) => known.get(e.id) !== sig(e));
    if (!deletes.length && !changed.length) return true; // ไม่มีส่วนต่าง ไม่ต้องเรียกเซิร์ฟเวอร์
    const fresh = []; // [photo, entryId] ที่ต้องอัปโหลด
    const upserts = changed.map((e) => {
      const have = (e.photos || []).filter((p) => uploaded.has(p.id));
      for (const p of e.photos || []) if (!uploaded.has(p.id) && !onServer(p.src)) fresh.push([p, e.id]);
      return { id: e.id, date: e.date, start: e.start, end: e.end, cat: e.cat, title: e.title, note: e.note || '', photoIds: have.map((p) => p.id) };
    });
    for (let i = 0; i < Math.max(upserts.length, 1); i += BATCH) {
      await api('/sync', jsonOpt('POST', { upserts: upserts.slice(i, i + BATCH), deletes: i === 0 ? deletes : [] }));
    }
    for (const id of deletes) { known.delete(id); missingSince.delete(id); }
    for (const [p, entryId] of fresh) {
      const blob = await (await fetch(p.src)).blob();
      await api(`/photos/${encodeURIComponent(p.id)}?entry=${encodeURIComponent(entryId)}`, { method: 'PUT', headers: { 'content-type': blob.type || 'image/jpeg' }, body: blob });
      uploaded.add(p.id);
    }
    // รูปที่เพิ่งอัปโหลดต้องผูกกับบันทึก: ส่งอีกรอบเมื่อมีรูปใหม่
    if (fresh.length) {
      const again = changed.filter((e) => (e.photos || []).some((p) => uploaded.has(p.id))).map((e) => ({
        id: e.id, date: e.date, start: e.start, end: e.end, cat: e.cat, title: e.title, note: e.note || '',
        photoIds: (e.photos || []).filter((p) => uploaded.has(p.id)).map((p) => p.id),
      }));
      for (let i = 0; i < again.length; i += BATCH) await api('/sync', jsonOpt('POST', { upserts: again.slice(i, i + BATCH), deletes: [] }));
    }
    for (const e of changed) known.set(e.id, sig(e));
    return true;
  }

  function push(list) {
    latest = list;
    chain = chain.catch(() => {}).then(() => run()).catch(() => false);
    return chain;
  }
  function init(list) {
    known.clear(); uploaded.clear(); missingSince.clear();
    for (const e of list) { known.set(e.id, sig(e)); for (const p of e.photos || []) uploaded.add(p.id); }
    latest = list;
  }
  return { init, push };
}
