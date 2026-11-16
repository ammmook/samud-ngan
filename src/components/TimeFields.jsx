import { M_FULL, pad, toMin } from '../lib/dates.js';
import { formatDuration } from '../ds.js';

/* ช่องวันที่และเวลาแบบไทย 24 ชั่วโมง ไม่ขึ้นกับภาษาของเบราว์เซอร์ */

function Sel({ label, value, onChange, children, id, invalid }) {
  return (
    <select id={id} className="sel" aria-label={label} aria-invalid={invalid ? 'true' : undefined} value={value} onChange={(e) => onChange(e.target.value)}>
      {children}
    </select>
  );
}

const HOURS = Array.from({ length: 24 }, (_, i) => pad(i));
const BASE_MINUTES = Array.from({ length: 12 }, (_, i) => pad(i * 5));

export function TimeField({ label, value, onChange, invalid }) {
  const [h = '', m = ''] = (value || '').split(':');
  const minutes = m && !BASE_MINUTES.includes(m) ? BASE_MINUTES.concat(m).sort() : BASE_MINUTES;
  return (
    <div className="tf" role="group" aria-label={label}>
      <span className="tf__label" aria-hidden="true">{label}</span>
      <span className="tf__row">
        <Sel label={label + ' ชั่วโมง'} value={h} invalid={invalid} onChange={(v) => onChange(v + ':' + (m || '00'))}>
          {!h && <option value="">--</option>}
          {HOURS.map((x) => <option key={x} value={x}>{x}</option>)}
        </Sel>
        <span aria-hidden="true">:</span>
        <Sel label={label + ' นาที'} value={m} invalid={invalid} onChange={(v) => onChange((h || '09') + ':' + v)}>
          {!m && <option value="">--</option>}
          {minutes.map((x) => <option key={x} value={x}>{x}</option>)}
        </Sel>
      </span>
    </div>
  );
}

export function TimeRange24({ start, end, onChange }) {
  const bad = start && end && !(toMin(end) > toMin(start));
  const dur = !bad ? formatDuration(start, end) : '';
  return (
    <div className="tr">
      <div className="tr__row">
        <TimeField label="เริ่ม" value={start} onChange={(v) => onChange({ start: v, end })} />
        <span className="tr__sep" aria-hidden="true">–</span>
        <TimeField label="จบ" value={end} invalid={bad} onChange={(v) => onChange({ start, end: v })} />
        {dur && <span className="tr__sum">รวม {dur}</span>}
      </div>
      {bad && <div className="field__err" role="alert">เวลาจบต้องอยู่หลังเวลาเริ่ม ลองปรับเวลาจบ</div>}
    </div>
  );
}

export function DateField({ id, value, onChange, invalid }) {
  const now = new Date().getFullYear();
  const [y, mo, d] = (value || '').split('-').map(Number);
  const years = [];
  for (let i = now - 3; i <= now + 5; i++) years.push(i);
  if (y && !years.includes(y)) years.push(y);
  const dim = y && mo ? new Date(y, mo, 0).getDate() : 31;
  const emit = (ny, nm, nd) => {
    const max = new Date(ny, nm, 0).getDate();
    onChange(`${ny}-${pad(nm)}-${pad(Math.min(nd, max))}`);
  };
  return (
    <div className="df" role="group" aria-labelledby="f-date-label">
      <Sel id={id} label="วัน" value={d || ''} invalid={invalid} onChange={(v) => emit(y || now, mo || 1, +v)}>
        {Array.from({ length: dim }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1}</option>)}
      </Sel>
      <Sel label="เดือน" value={mo || ''} invalid={invalid} onChange={(v) => emit(y || now, +v, d || 1)}>
        {M_FULL.map((n, i) => <option key={n} value={i + 1}>{n}</option>)}
      </Sel>
      <Sel label="ปี พ.ศ." value={y || ''} invalid={invalid} onChange={(v) => emit(+v, mo || 1, d || 1)}>
        {years.sort().map((yy) => <option key={yy} value={yy}>{yy + 543}</option>)}
      </Sel>
    </div>
  );
}
