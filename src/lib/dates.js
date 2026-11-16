export const WD_FULL = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];
export const WD_SHORT = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'];
export const M_FULL = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
export const M_SHORT = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

export const pad = (n) => String(n).padStart(2, '0');
export const ds = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
export const pd = (s) => { const p = s.split('-').map(Number); return new Date(p[0], p[1] - 1, p[2]); };
export const addDays = (s, n) => { const d = pd(s); d.setDate(d.getDate() + n); return ds(d); };
export const addMonths = (s, n) => {
  const d = pd(s), day = d.getDate();
  d.setDate(1); d.setMonth(d.getMonth() + n);
  d.setDate(Math.min(day, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()));
  return ds(d);
};
export const weekStart = (s) => addDays(s, -pd(s).getDay());
export const toMin = (t) => { const p = String(t || '').split(':'); return p.length < 2 ? NaN : (+p[0]) * 60 + (+p[1]); };
export const minStr = (m) => pad(Math.floor(m / 60)) + ':' + pad(m % 60);
export const evHours = (e) => Math.max(0, (toMin(e.end) - toMin(e.start)) / 60);
export const r1 = (n) => Math.round(n * 10) / 10;
export const longDate = (s) => { const d = pd(s); return 'วัน' + WD_FULL[d.getDay()] + 'ที่ ' + d.getDate() + ' ' + M_FULL[d.getMonth()] + ' ' + (d.getFullYear() + 543); };
export const midDate = (s) => { const d = pd(s); return 'วัน' + WD_FULL[d.getDay()] + 'ที่ ' + d.getDate() + ' ' + M_SHORT[d.getMonth()]; };
export const uid = () => (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : 'id' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
export const thDate = (s) => { const d = pd(s); return d.getDate() + ' ' + M_SHORT[d.getMonth()] + ' ' + (d.getFullYear() + 543); };
export const sortEv =(a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0);

/* จัดช่วงเวลาที่ซ้อนกันให้อยู่คนละเลน */
export function layoutDay(evs) {
  const items = evs.map((e) => ({ e, a: toMin(e.start), b: toMin(e.end) })).sort((x, y) => x.a - y.a || y.b - x.b);
  const out = [];
  let cluster = [], end = -1;
  const flush = () => {
    if (!cluster.length) return;
    const lanes = [];
    cluster.forEach((it) => {
      let l = lanes.findIndex((le) => le <= it.a);
      if (l < 0) { l = lanes.length; lanes.push(it.b); } else lanes[l] = it.b;
      it.lane = l;
    });
    cluster.forEach((it) => { it.lanes = lanes.length; out.push(it); });
    cluster = [];
  };
  items.forEach((it) => {
    if (it.a >= end) { flush(); end = it.b; } else end = Math.max(end, it.b);
    cluster.push(it);
  });
  flush();
  return out;
}
