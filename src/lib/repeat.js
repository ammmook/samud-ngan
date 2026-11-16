import { addDays, pd } from './dates.js';

export const REPEAT_KINDS = [
  { value: 'none', label: 'ไม่ทำซ้ำ' },
  { value: 'daily', label: 'ทุกวัน' },
  { value: 'weekdays', label: 'ทุกวันจันทร์ถึงศุกร์' },
  { value: 'weekly', label: 'ทุกสัปดาห์' },
];
export const MAX_REPEAT = 52;

/* วันที่ของบันทึกที่ทำซ้ำ รวมวันแรกเป็นครั้งที่ 1 */
export function repeatDates(start, kind, count) {
  const n = Math.max(1, Math.min(MAX_REPEAT, Math.floor(count) || 1));
  const out = [start];
  let d = start;
  while (out.length < n && kind !== 'none') {
    if (kind === 'weekly') d = addDays(d, 7);
    else {
      d = addDays(d, 1);
      if (kind === 'weekdays') { const w = pd(d).getDay(); if (w === 0 || w === 6) continue; }
    }
    out.push(d);
  }
  return out;
}

/* สำเนาบันทึกไปวันอื่น ไม่เอารูปมาด้วย */
export const cloneTo = (ev, date, makeId) => ({ ...ev, id: makeId(), date, photos: [] });

/* ทำซ้ำบันทึกทั้งวันของ from ไปที่ to ข้ามบันทึกที่ในวัน to มีหัวข้อและเวลาเริ่มเหมือนกันอยู่แล้ว */
export function copyDay(events, from, to, makeId) {
  const have = new Set(events.filter((e) => e.date === to).map((e) => e.title + '|' + e.start));
  const src = events.filter((e) => e.date === from);
  const fresh = src.filter((e) => !have.has(e.title + '|' + e.start)).map((e) => cloneTo(e, to, makeId));
  return { fresh, skipped: src.length - fresh.length, total: src.length };
}
