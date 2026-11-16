import { addDays, evHours, pd, r1, toMin } from './dates.js';

/* ฟังก์ชันคำนวณล้วนๆ สำหรับหน้าสรุป สวนงาน เป้ารายวัน ค้นหา และส่งออกรายงาน */

/* ชั่วโมงรวมต่อวัน { 'YYYY-MM-DD': ชั่วโมง } */
export function hoursByDate(events) {
  const by = {};
  events.forEach((e) => { by[e.date] = (by[e.date] || 0) + evHours(e); });
  return by;
}

/* จดต่อเนื่องกี่วัน: วันนี้ที่ยังไม่ได้จดไม่ทำให้สายขาด เสาร์-อาทิตย์ที่ไม่ได้จดข้ามได้ ไม่นับและไม่ขาด */
export function streakOf(by, today) {
  const keys = Object.keys(by).filter((k) => by[k] > 0).sort();
  if (!keys.length) return 0;
  const oldest = keys[0];
  let n = 0, d = today, first = true;
  while (d >= oldest) {
    const wd = pd(d).getDay();
    if ((by[d] || 0) > 0) n += 1;
    else if (!first && wd !== 0 && wd !== 6) break;
    first = false;
    d = addDays(d, -1);
  }
  return n;
}

/* ระยะต้นไม้ตามชั่วโมงในวันนั้น: 0 ไม่มี, 1 งอก, 2 ต้นอ่อน, 3 ต้นไม้, 4 ต้นใหญ่ */
export function plantStage(hours) {
  if (!(hours > 0)) return 0;
  if (hours < 2) return 1;
  if (hours < 4) return 2;
  if (hours < 6) return 3;
  return 4;
}
export const STAGE_LABEL = ['ยังไม่มี', 'งอก', 'ต้นอ่อน', 'ต้นไม้', 'ต้นใหญ่'];

/* หมวดที่ใช้เวลามากสุดของรายการชุดหนึ่ง */
export function dominantCat(events) {
  const c = {};
  events.forEach((e) => { c[e.cat] = (c[e.cat] || 0) + evHours(e); });
  return Object.keys(c).sort((a, b) => c[b] - c[a])[0] || 'meadow';
}

/* ระดับสีของวันในปฏิทินใบไม้ 0 ถึง 4 */
export function heatLevel(hours) {
  if (!(hours > 0)) return 0;
  if (hours < 2) return 1;
  if (hours < 4) return 2;
  if (hours < 6) return 3;
  return 4;
}

/* รวมชั่วโมงและหมวดในช่วงวันที่ (รวมปลายทั้งสองข้าง) */
export function rangeTotals(events, from, to) {
  let hours = 0, entries = 0;
  const days = {}, cat = {};
  events.forEach((e) => {
    if (e.date < from || e.date > to) return;
    const h = evHours(e);
    hours += h; entries += 1; days[e.date] = 1;
    cat[e.cat] = (cat[e.cat] || 0) + h;
  });
  return { hours: r1(hours), entries, days: Object.keys(days).length, cat };
}

/* กรองตามคำค้นและหมวด คำค้นหาในหัวข้อและรายละเอียด ไม่สนตัวพิมพ์ใหญ่เล็ก */
export function filterEvents(events, q, cats) {
  const needle = (q || '').trim().toLowerCase();
  if (!needle && !(cats && cats.length)) return events;
  return events.filter((e) => {
    if (cats && cats.length && !cats.includes(e.cat)) return false;
    if (!needle) return true;
    return (e.title + ' ' + (e.note || '')).toLowerCase().includes(needle);
  });
}

/* สายจดต่อเนื่องที่ยาวที่สุดตลอดเวลา (กติกาวันหยุดเหมือน streakOf) */
export function longestStreak(by) {
  const keys = Object.keys(by).filter((k) => by[k] > 0).sort();
  if (!keys.length) return 0;
  let run = 0, best = 0;
  for (let d = keys[0]; d <= keys[keys.length - 1]; d = addDays(d, 1)) {
    if (by[d] > 0) { run += 1; if (run > best) best = run; }
    else { const w = pd(d).getDay(); if (w !== 0 && w !== 6) run = 0; }
  }
  return best;
}

/* ชั่วโมงที่ลงไว้ในแต่ละชั่วโมงของวัน (0 ถึง 23) ภายในช่วงวันที่ */
export function hourBuckets(events, from, to) {
  const b = new Array(24).fill(0);
  events.forEach((e) => {
    if (e.date < from || e.date > to) return;
    const a = toMin(e.start), z = toMin(e.end);
    if (!(z > a)) return;
    for (let h = Math.floor(a / 60); h * 60 < z && h < 24; h++) {
      b[h] += (Math.min(z, h * 60 + 60) - Math.max(a, h * 60)) / 60;
    }
  });
  return b;
}

/* หน้าต่างต่อเนื่อง span ชั่วโมงที่รวมได้มากสุด คืนชั่วโมงเริ่มต้น */
export function bestWindow(buckets, span = 2) {
  let best = -1, at = 0;
  for (let h = 0; h + span <= 24; h++) {
    let s = 0;
    for (let k = 0; k < span; k++) s += buckets[h + k];
    if (s > best) { best = s; at = h; }
  }
  return best > 0 ? { start: at, end: at + span, hours: r1(best) } : null;
}

/* ชั่วโมงเฉลี่ยต่อวันของแต่ละวันในสัปดาห์ (เฉพาะวันที่มีบันทึก) index 0 = อาทิตย์ */
export function weekdayAverages(by) {
  const sum = new Array(7).fill(0), n = new Array(7).fill(0);
  Object.keys(by).forEach((d) => {
    if (!(by[d] > 0)) return;
    const w = pd(d).getDay();
    sum[w] += by[d]; n[w] += 1;
  });
  return sum.map((s, i) => (n[i] ? r1(s / n[i]) : 0));
}

/* CSV: กันสูตรใน Excel ด้วยการนำหน้าเซลล์ที่ขึ้นต้นด้วย = + - @ ด้วยเครื่องหมาย ' */
const csvCell = (v) => {
  let s = String(v == null ? '' : v);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return '"' + s.replace(/"/g, '""') + '"';
};

export function eventsToCsv(events, catLabels = {}) {
  const rows = events.slice().sort((a, b) => (a.date + a.start < b.date + b.start ? -1 : 1));
  const head = ['วันที่', 'เริ่ม', 'จบ', 'ชั่วโมง', 'หมวด', 'หัวข้อ', 'รายละเอียด'];
  const lines = [head.map(csvCell).join(',')].concat(
    rows.map((e) => [e.date, e.start, e.end, r1(evHours(e)), catLabels[e.cat] || e.cat, e.title, e.note || ''].map(csvCell).join(',')),
  );
  return '﻿' + lines.join('\r\n');
}
