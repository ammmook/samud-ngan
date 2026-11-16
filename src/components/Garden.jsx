import { useMemo, useState } from 'react';
import { Button } from '../ds.js';
import Plant from './Plant.jsx';
import { M_FULL, WD_SHORT, addMonths, pd, r1 } from '../lib/dates.js';
import { STAGE_LABEL, dominantCat, hoursByDate, plantStage } from '../lib/stats.js';

const LEGEND = [
  { stage: 1, hint: 'ไม่ถึง 2 ชม.' },
  { stage: 2, hint: '2 ถึง 4 ชม.' },
  { stage: 3, hint: '4 ถึง 6 ชม.' },
  { stage: 4, hint: '6 ชม. ขึ้นไป' },
];

/* สวนงาน: ทุกวันที่จดงานคือหนึ่งต้นไม้ ยิ่งจดชั่วโมงมากต้นยิ่งโต สีตามหมวดที่ใช้เวลามากสุดของวันนั้น */
export default function Garden({ events, today }) {
  const [month, setMonth] = useState(() => today.slice(0, 7) + '-01');
  const isCurrent = month.slice(0, 7) === today.slice(0, 7);

  const g = useMemo(() => {
    const ym = month.slice(0, 7), by = {};
    const inMonth = events.filter((e) => e.date.slice(0, 7) === ym);
    inMonth.forEach((e) => { (by[e.date] = by[e.date] || []).push(e); });
    const hoursBy = hoursByDate(inMonth);
    const first = pd(month), dim = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
    const days = Array.from({ length: dim }, (_, i) => {
      const date = ym + '-' + String(i + 1).padStart(2, '0'), h = hoursBy[date] || 0;
      return { date, n: i + 1, hours: r1(h), stage: plantStage(h), cat: by[date] ? dominantCat(by[date]) : 'meadow' };
    });
    const planted = days.filter((d) => d.stage > 0);
    return {
      lead: first.getDay(), days, planted: planted.length, big: days.filter((d) => d.stage === 4).length,
      hours: r1(planted.reduce((s, d) => s + d.hours, 0)),
      title: M_FULL[first.getMonth()] + ' ' + (first.getFullYear() + 543),
    };
  }, [events, month]);

  let order = 0;
  return (
    <section className="panel garden" aria-labelledby="garden-h">
      <div className="garden__head">
        <div>
          <h2 className="panel__title" id="garden-h">สวนงาน {g.title}</h2>
          <p className="sub">
            {g.planted
              ? `ปลูกแล้ว ${g.planted} ต้น รวม ${g.hours} ชม.${g.big ? ` เป็นต้นใหญ่ ${g.big} ต้น` : ''}`
              : isCurrent ? 'จดงานวันนี้เพื่อปลูกต้นแรกของเดือน' : 'เดือนนี้ไม่มีบันทึก สวนจึงยังว่างอยู่'}
          </p>
        </div>
        <div className="garden__nav">
          <Button variant="ghost" size="sm" iconOnly icon="left" aria-label="เดือนก่อนหน้า" onClick={() => setMonth(addMonths(month, -1))} />
          <Button variant="ghost" size="sm" iconOnly icon="right" aria-label="เดือนถัดไป" disabled={isCurrent} onClick={() => setMonth(addMonths(month, 1))} />
        </div>
      </div>

      <div className="garden__beds" key={month} role="list" aria-label={'ต้นไม้ของ' + g.title}>
        {WD_SHORT.map((w) => <span key={w} className="garden__wd" aria-hidden="true">{w}</span>)}
        {Array.from({ length: g.lead }, (_, i) => <span key={'b' + i} aria-hidden="true" />)}
        {g.days.map((d) => (
          <div key={d.date} role="listitem" className={'bed' + (d.date === today ? ' bed--today' : '') + (d.date > today ? ' bed--future' : '')}>
            <Plant stage={d.stage} cat={d.cat} delay={d.stage ? order++ * 22 : 0} />
            <span className="bed__n">{d.n}</span>
            <span className="sr-only">{d.stage ? `${STAGE_LABEL[d.stage]} ${d.hours} ชั่วโมง` : 'ไม่มีบันทึก'}</span>
          </div>
        ))}
      </div>

      <ul className="garden__legend" aria-label="ขนาดต้นไม้ตามชั่วโมง">
        {LEGEND.map((l) => (
          <li key={l.stage}><Plant stage={l.stage} cat="meadow" size={26} /><span>{STAGE_LABEL[l.stage]}<small>{l.hint}</small></span></li>
        ))}
      </ul>
    </section>
  );
}
