import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '../ds.js';
import { M_SHORT, addDays, pd, r1, thDate } from '../lib/dates.js';
import { heatLevel, hoursByDate, longestStreak } from '../lib/stats.js';

const ROW_LABELS = { 1: 'จ.', 3: 'พ.', 5: 'ศ.' };

/* ปฏิทินทั้งปี: หนึ่งวันคือหนึ่งใบไม้ ยิ่งจดชั่วโมงมากใบยิ่งเข้ม */
export default function LeafHeatmap({ events, today }) {
  const [year, setYear] = useState(() => Number(today.slice(0, 4)));
  const [picked, setPicked] = useState(null);
  const scroller = useRef(null);

  const by = useMemo(() => hoursByDate(events), [events]);
  const years = useMemo(() => {
    const ys = events.map((e) => Number(e.date.slice(0, 4))).concat(Number(today.slice(0, 4)));
    return { min: Math.min(...ys), max: Math.max(...ys) };
  }, [events, today]);

  const y = useMemo(() => {
    const jan1 = year + '-01-01', dec31 = year + '-12-31';
    const start = addDays(jan1, -pd(jan1).getDay());
    const weeks = Math.ceil((pd(jan1).getDay() + (pd(dec31) - pd(jan1)) / 864e5 + 1) / 7);
    const cells = [], labels = [];
    let hours = 0, days = 0;
    for (let i = 0; i < weeks * 7; i++) {
      const date = addDays(start, i), inYear = date.slice(0, 4) === String(year), h = inYear ? by[date] || 0 : 0;
      if (inYear && h > 0) { hours += h; days += 1; }
      if (inYear && date.slice(8) === '01') labels.push({ col: Math.floor(i / 7) + 1, text: M_SHORT[pd(date).getMonth()] });
      cells.push({ date, inYear, h, level: heatLevel(h) });
    }
    const yearBy = {};
    Object.keys(by).forEach((d) => { if (d.slice(0, 4) === String(year)) yearBy[d] = by[d]; });
    return { cells, labels, weeks, hours: r1(hours), days, best: longestStreak(yearBy) };
  }, [by, year]);

  useEffect(() => {
    const el = scroller.current; if (!el) return undefined;
    const id = requestAnimationFrame(() => { el.scrollLeft = String(year) === today.slice(0, 4) ? el.scrollWidth : 0; });
    return () => cancelAnimationFrame(id);
  }, [year, today]);

  const pick = (e) => {
    const c = e.target.closest('[data-date]');
    if (c) setPicked(c.getAttribute('data-date'));
  };
  const note = picked && picked.slice(0, 4) === String(year)
    ? `${thDate(picked)}: ${by[picked] ? r1(by[picked]) + ' ชม.' : 'ไม่มีบันทึก'}`
    : y.days ? `ปีนี้จดแล้ว ${y.days} วัน รวม ${y.hours} ชม. สายต่อเนื่องยาวสุด ${y.best} วัน` : 'ปีนี้ยังไม่มีบันทึก';

  return (
    <section className="panel heat" aria-labelledby="heat-h">
      <div className="garden__head">
        <div>
          <h2 className="panel__title" id="heat-h">ปฏิทินใบไม้ ปี {year + 543}</h2>
          <p className="sub" aria-live="polite">{note}</p>
        </div>
        <div className="garden__nav">
          <Button variant="ghost" size="sm" iconOnly icon="left" aria-label="ปีก่อนหน้า" disabled={year <= years.min} onClick={() => { setYear(year - 1); setPicked(null); }} />
          <Button variant="ghost" size="sm" iconOnly icon="right" aria-label="ปีถัดไป" disabled={year >= years.max} onClick={() => { setYear(year + 1); setPicked(null); }} />
        </div>
      </div>

      <div className="heat__wrap">
        <div className="heat__rows" aria-hidden="true">
          {[0, 1, 2, 3, 4, 5, 6].map((r) => <span key={r}>{ROW_LABELS[r] || ''}</span>)}
        </div>
        <div className="heat__scroll" ref={scroller}>
          <div className="heat__months" aria-hidden="true" style={{ gridTemplateColumns: `repeat(${y.weeks}, var(--cell))` }}>
            {y.labels.map((l) => <span key={l.col} style={{ gridColumn: l.col }}>{l.text}</span>)}
          </div>
          <div className="heat__grid" role="img" aria-label={`ปฏิทินใบไม้ปี ${year + 543} จดแล้ว ${y.days} วัน รวม ${y.hours} ชั่วโมง`} onClick={pick} style={{ gridTemplateColumns: `repeat(${y.weeks}, var(--cell))` }}>
            {y.cells.map((c) => (c.inYear
              ? <span key={c.date} data-date={c.date} className={'leafcell lv' + c.level + (c.date === today ? ' is-today' : '') + (c.date === picked ? ' is-picked' : '')} title={`${thDate(c.date)}: ${c.h ? r1(c.h) + ' ชม.' : 'ไม่มีบันทึก'}`} />
              : <span key={c.date} aria-hidden="true" />))}
          </div>
        </div>
      </div>

      <div className="heat__legend" aria-hidden="true">
        <span>น้อย</span>
        {[0, 1, 2, 3, 4].map((l) => <span key={l} className={'leafcell lv' + l} />)}
        <span>มาก</span>
      </div>
    </section>
  );
}
