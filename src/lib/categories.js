// หมวดกลางจากตาราง categories: ดึงจากเซิร์ฟเวอร์แล้วใส่ลง CATS (ชื่อหมวด) และสร้างคลาสสีให้หมวดใหม่
// ถ้าดึงไม่ได้ ก็ใช้ 5 หมวดเริ่มต้นที่บันเดิลมีอยู่แล้ว
import { CATS } from '../ds.js';

const PALETTES = ['meadow', 'sky', 'honey', 'orange', 'teal', 'blossom', 'lilac'];
const STYLE_ID = 'sn-cat-palettes';

export function applyCategories(rows) {
  if (!Array.isArray(rows)) return false;
  const css = [];
  for (const r of rows) {
    if (!r || typeof r.id !== 'string' || typeof r.label !== 'string') continue;
    CATS[r.id] = r.label;
    const p = PALETTES.includes(r.palette) ? r.palette : 'meadow';
    // คลาส sn-cat--<id> ของหมวดใหม่ ชี้ไปที่ตัวแปรสีของชุดสีที่เลือก
    css.push(`.sn-cat--${CSS.escape(r.id)}{--c-fill:var(--cat-${p}-fill);--c-ink:var(--cat-${p}-ink);--c-solid:var(--cat-${p}-solid);}`);
  }
  let el = document.getElementById(STYLE_ID);
  if (!el) { el = document.createElement('style'); el.id = STYLE_ID; document.head.appendChild(el); }
  el.textContent = css.join('\n');
  return true;
}

export async function loadCategories() {
  const res = await fetch('/api/categories');
  if (!res.ok) throw new Error('โหลดหมวดไม่สำเร็จ');
  const rows = await res.json();
  applyCategories(rows);
  return rows;
}
