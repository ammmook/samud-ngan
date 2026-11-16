import { pref, setPref } from './storage.js';
import { uid } from './dates.js';

const MAX_TEMPLATES = 12;
const key = (k) => 'sn-tpl:' + k;

export function loadTemplates(storeKey) {
  try {
    const v = JSON.parse(pref(key(storeKey), '[]'));
    return Array.isArray(v) ? v.filter((t) => t && t.id && t.title) : [];
  } catch (e) { return []; }
}
export function saveTemplates(storeKey, list) { setPref(key(storeKey), JSON.stringify(list)); }

/* แม่แบบเก็บแค่ หัวข้อ หมวด เวลา และรายละเอียด ชื่อหัวข้อซ้ำกับของเดิมจะอัปเดตทับ */
export function addTemplate(list, d) {
  const t = { id: uid(), title: d.title.trim(), cat: d.cat, start: d.start, end: d.end, note: (d.note || '').trim() };
  const rest = list.filter((x) => x.title !== t.title);
  return rest.concat(t).slice(-MAX_TEMPLATES);
}
