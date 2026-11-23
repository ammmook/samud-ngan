import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button, CATS, Segmented } from '../ds.js';
import { DateField } from './TimeFields.jsx';
import { addDays, addMonths, evHours, r1, sortEv, thDate, weekStart } from '../lib/dates.js';
import { eventsToCsv, rangeTotals } from '../lib/stats.js';

const RANGES = [
  { value: 'week', label: 'สัปดาห์นี้' },
  { value: 'month', label: 'เดือนนี้' },
  { value: 'prev', label: 'เดือนก่อน' },
  { value: 'custom', label: 'กำหนดเอง' },
];

function rangeFor(kind, today, custom) {
  if (kind === 'week') { const w = weekStart(today); return { from: w, to: addDays(w, 6) }; }
  if (kind === 'month') return { from: today.slice(0, 7) + '-01', to: addDays(addMonths(today.slice(0, 7) + '-01', 1), -1) };
  if (kind === 'prev') { const f = addMonths(today.slice(0, 7) + '-01', -1); return { from: f, to: addDays(addMonths(f, 1), -1) }; }
  return custom;
}

/* หน้ารายงานสำหรับพิมพ์ ซ่อนบนจอ แสดงเฉพาะตอนสั่งพิมพ์ (ดู features.css) */
function PrintSheet({ who, range, totals, rows }) {
  const cats = Object.keys(totals.cat).sort((a, b) => totals.cat[b] - totals.cat[a]);
  return createPortal(
    <div className="print-sheet">
      <h1>รายงานการทำงาน</h1>
      <p>{who ? who + ' ' : ''}ช่วง {thDate(range.from)} ถึง {thDate(range.to)}</p>
      <p>รวม {totals.hours} ชั่วโมง ใน {totals.days} วัน {totals.entries} บันทึก</p>
      <h2>แยกตามหมวด</h2>
      <table>
        <thead><tr><th>หมวด</th><th>ชั่วโมง</th></tr></thead>
        <tbody>{cats.map((k) => <tr key={k}><td>{CATS[k]}</td><td>{r1(totals.cat[k])}</td></tr>)}</tbody>
      </table>
      <h2>รายการทั้งหมด</h2>
      <table>
        <thead><tr><th>วันที่</th><th>เวลา</th><th>หมวด</th><th>งาน</th><th>ชม.</th></tr></thead>
        <tbody>
          {rows.map((e) => (
            <tr key={e.id}>
              <td>{thDate(e.date)}</td><td>{e.start}–{e.end}</td><td>{CATS[e.cat]}</td>
              <td>{e.title}{e.note ? <small>{e.note}</small> : null}</td><td>{r1(evHours(e))}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>,
    document.body,
  );
}

export default function ReportDialog({ events, today, who, onClose, notify }) {
  const [kind, setKind] = useState('month');
  const [custom, setCustom] = useState({ from: today.slice(0, 7) + '-01', to: today });
  const box = useRef(null);

  useEffect(() => {
    const prev = document.activeElement;
    document.body.style.overflow = 'hidden';
    if (box.current) { const f = box.current.querySelector('button'); if (f) f.focus(); }
    return () => { document.body.style.overflow = ''; if (prev && prev.focus) prev.focus(); };
  }, []);

  const range = rangeFor(kind, today, custom);
  const bad = !range.from || !range.to || range.from > range.to;
  const rows = useMemo(
    () => (bad ? [] : events.filter((e) => e.date >= range.from && e.date <= range.to).sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : sortEv(a, b)))),
    [events, range.from, range.to, bad],
  );
  const totals = useMemo(() => rangeTotals(rows, range.from || '', range.to || ''), [rows, range.from, range.to]);
  const cats = Object.keys(totals.cat).sort((a, b) => totals.cat[b] - totals.cat[a]);
  const ready = !bad && rows.length > 0;

  const download = () => {
    const blob = new Blob([eventsToCsv(rows, CATS)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = `samut-ngan_${range.from}_${range.to}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    notify('ดาวน์โหลดไฟล์ CSV แล้ว');
  };

  const downloadWord = async () => {
    try {
      const { buildWordBlob } = await import('../lib/wordReport.js');
      const blob = await buildWordBlob({ who, range, rows });
      const url = URL.createObjectURL(blob), a = document.createElement('a');
      a.href = url; a.download = `บันทึกการปฏิบัติงาน_${range.from}_${range.to}.docx`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      notify('ดาวน์โหลดไฟล์ Word แล้ว');
    } catch { notify('สร้างไฟล์ Word ไม่สำเร็จ ลองใหม่อีกครั้ง'); }
  };

  const onKey = (e) => {
    if (e.key === 'Escape') { e.stopPropagation(); onClose(); return; }
    if (e.key === 'Tab' && box.current) {
      const f = Array.prototype.filter.call(box.current.querySelectorAll('button:not([disabled]), select, [tabindex="0"]'), (x) => x.offsetParent !== null);
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  };

  return (
    <div className="scrim" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="dlg dlg--report sn-cat--honey" role="dialog" aria-modal="true" aria-labelledby="rep-title" ref={box} onKeyDown={onKey}>
        <div className="dlg__head">
          <div>
            <h2 className="dlg__title" id="rep-title">ส่งออกรายงาน</h2>
            <p className="dlg__sub">เลือกช่วงเวลา แล้วดาวน์โหลดเป็นไฟล์ Word, CSV หรือพิมพ์</p>
          </div>
          <Button variant="ghost" size="sm" iconOnly icon="x" aria-label="ปิดหน้าต่าง" onClick={onClose} />
        </div>

        <div className="dlg__body">
          <div className="dlg__col dlg__wide">
            <Segmented options={RANGES} value={kind} onChange={setKind} aria-label="ช่วงเวลาของรายงาน" />
            {kind === 'custom' && (
              <div className="rep__custom">
                <div className="field"><span className="field__label">ตั้งแต่</span><DateField id="rep-from" value={custom.from} invalid={bad} onChange={(v) => setCustom((c) => ({ ...c, from: v }))} /></div>
                <div className="field"><span className="field__label">ถึง</span><DateField id="rep-to" value={custom.to} invalid={bad} onChange={(v) => setCustom((c) => ({ ...c, to: v }))} /></div>
              </div>
            )}
            {bad
              ? <p className="field__err" role="alert">วันที่เริ่มต้องไม่เกินวันที่จบ เลือกช่วงใหม่</p>
              : <p className="rep__range">{thDate(range.from)} ถึง {thDate(range.to)}</p>}

            {ready ? (
              <div className="rep__sum" aria-live="polite">
                <p className="rep__total"><b className="sn-num">{totals.hours}</b> ชม. ใน {totals.days} วัน {totals.entries} บันทึก</p>
                <ul className="share__list">
                  {cats.map((k) => (
                    <li key={k} className={'sn-cat--' + k}>
                      <span className="share__dot" aria-hidden="true" /><span className="share__name">{CATS[k]}</span>
                      <span className="share__val">{r1(totals.cat[k])} ชม.</span><span className="share__pct">{Math.round((totals.cat[k] / (totals.hours || 1)) * 100)}%</span>
                    </li>
                  ))}
                </ul>
                <p className="sub">ไฟล์และหน้าพิมพ์มีรายการงานทุกบันทึกในช่วงนี้ พร้อมเวลาและรายละเอียด</p>
              </div>
            ) : !bad && <p className="sub" role="status">ช่วงนี้ยังไม่มีบันทึก เลือกช่วงอื่นเพื่อส่งออก</p>}
          </div>
        </div>

        <div className="dlg__foot">
          <span className="spacer" />
          <Button variant="soft" disabled={!ready} onClick={download}>ดาวน์โหลด CSV</Button>
          <Button variant="soft" disabled={!ready} onClick={downloadWord}>ส่งออก Word</Button>
          <Button variant="primary" disabled={!ready} onClick={() => window.print()}>พิมพ์รายงาน</Button>
        </div>
      </div>
      {ready && <PrintSheet who={who} range={range} totals={totals} rows={rows} />}
    </div>
  );
}
