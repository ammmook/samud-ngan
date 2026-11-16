import { useMemo } from 'react';
import { CATS } from '../ds.js';
import { WD_FULL, addDays, pad, r1 } from '../lib/dates.js';
import { bestWindow, hourBuckets, hoursByDate, weekdayAverages } from '../lib/stats.js';

const DAYS = 90;
const MIN_DAYS = 3;

/* ช่วงเวลาที่ลงเวลางานมากที่สุด ดึงจากบันทึกเดิมใน 90 วันที่ผ่านมา ไม่ต้องกรอกเพิ่ม */
export default function BestHours({ events, today }) {
  const a = useMemo(() => {
    const from = addDays(today, -(DAYS - 1));
    const recent = events.filter((e) => e.date >= from && e.date <= today);
    const by = hoursByDate(recent), days = Object.keys(by).filter((d) => by[d] > 0).length;
    if (days < MIN_DAYS) return { days };
    const b = hourBuckets(recent, from, today), win = bestWindow(b, 2);
    const lit = b.map((v, i) => (v > 0 ? i : -1)).filter((i) => i >= 0);
    const lo = Math.min(6, lit[0]), hi = Math.max(21, lit[lit.length - 1]);
    const inWin = {};
    Object.keys(CATS).forEach((k) => {
      const kb = hourBuckets(recent.filter((e) => e.cat === k), from, today);
      inWin[k] = kb[win.start] + kb[win.start + 1];
    });
    const topCat = Object.keys(inWin).sort((x, y) => inWin[y] - inWin[x])[0];
    const avg = weekdayAverages(by);
    const bestDay = avg.indexOf(Math.max(...avg));
    return { days, b, win, lo, hi, topCat, bestDay, bestAvg: avg[bestDay], max: Math.max(...b) };
  }, [events, today]);

  return (
    <section className="panel hours" aria-labelledby="hours-h">
      <div>
        <h2 className="panel__title" id="hours-h">ช่วงเวลาที่ลงงานเยอะสุด</h2>
        <p className="sub">จากบันทึกใน {DAYS} วันที่ผ่านมา</p>
      </div>
      {!a.b ? (
        <p className="sub">ต้องมีบันทึกอย่างน้อย {MIN_DAYS} วัน ตอนนี้มี {a.days} วัน จดเพิ่มอีกหน่อยแล้วจะเห็นว่าคุณทำงานเยอะช่วงไหน</p>
      ) : (
        <div className="hours__body">
          <div className="hours__chart" role="img" aria-label={`ชั่วโมงงานแยกตามชั่วโมงของวัน ช่วงที่เยอะสุดคือ ${pad(a.win.start)}:00 ถึง ${pad(a.win.end)}:00`}>
            {Array.from({ length: a.hi - a.lo + 1 }, (_, i) => {
              const h = a.lo + i, on = h >= a.win.start && h < a.win.end;
              return (
                <div key={h} className={'hcol' + (on ? ' is-on' : '')}>
                  <span className="hcol__bar" style={{ height: Math.max(a.b[h] ? 4 : 0, (a.b[h] / a.max) * 100) + '%', '--i': i }} title={`${pad(h)}:00 รวม ${r1(a.b[h])} ชม.`} />
                  <span className="hcol__h">{pad(h)}</span>
                </div>
              );
            })}
          </div>
          <ul className="hours__notes">
            <li><b>{pad(a.win.start)}:00 ถึง {pad(a.win.end)}:00</b><span>ช่วงที่ลงงานเยอะสุด รวม {a.win.hours} ชม.</span></li>
            <li><b>{CATS[a.topCat]}</b><span>งานหมวดที่อยู่ในช่วงนั้นมากสุด</span></li>
            <li><b>วัน{WD_FULL[a.bestDay]}</b><span>เฉลี่ย {a.bestAvg} ชม. ต่อวันที่จด มากสุดในสัปดาห์</span></li>
          </ul>
        </div>
      )}
    </section>
  );
}

