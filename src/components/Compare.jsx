import { useMemo } from 'react';
import { CATS } from '../ds.js';
import { WD_FULL, addDays, addMonths, pd, r1, weekStart } from '../lib/dates.js';
import { rangeTotals } from '../lib/stats.js';

function delta(a, b, unit) {
  if (!a && !b) return 'ยังไม่มีข้อมูลให้เทียบ';
  const d = r1(a - b);
  if (d === 0) return 'เท่ากับ' + unit + 'ก่อน';
  const pct = b > 0 ? ` (${Math.round(Math.abs(d / b) * 100)}%)` : '';
  return `${d > 0 ? 'มากกว่า' : 'น้อยกว่า'}${unit}ก่อน ${Math.abs(d)} ชม.${pct}`;
}

function Pair({ title, hint, nowLabel, prevLabel, a, b, unit }) {
  const max = Math.max(a, b, 0.1);
  return (
    <div className="cmp">
      <div className="cmp__head"><h3 className="cmp__title">{title}</h3><span className="cmp__hint">{hint}</span></div>
      <div className="cmp__row"><span className="cmp__lbl">{nowLabel}</span><span className="cmp__track"><span className="cmp__bar cmp__bar--now" style={{ width: (a / max) * 100 + '%' }} /></span><span className="cmp__val">{a} ชม.</span></div>
      <div className="cmp__row"><span className="cmp__lbl">{prevLabel}</span><span className="cmp__track"><span className="cmp__bar" style={{ width: (b / max) * 100 + '%' }} /></span><span className="cmp__val">{b} ชม.</span></div>
      <p className="cmp__delta">{delta(a, b, unit)}</p>
    </div>
  );
}

/* เทียบช่วงนี้กับช่วงก่อน นับถึงวันเดียวกันของช่วง เพื่อไม่ให้เทียบเดือนที่ยังไม่จบกับเดือนที่จบแล้ว */
export default function Compare({ events, today }) {
  const c = useMemo(() => {
    const ws = weekStart(today), elapsed = Math.round((pd(today) - pd(ws)) / 864e5);
    const pws = addDays(ws, -7);
    const ms = today.slice(0, 7) + '-01', pms = addMonths(ms, -1), pmEnd = addMonths(today, -1);
    return {
      wk: rangeTotals(events, ws, today).hours, pwk: rangeTotals(events, pws, addDays(pws, elapsed)).hours,
      mo: rangeTotals(events, ms, today).hours, pmo: rangeTotals(events, pms, pmEnd).hours,
      wd: WD_FULL[pd(today).getDay()], dom: pd(today).getDate(),
    };
  }, [events, today]);
  const cat = useMemo(() => rangeTotals(events, today.slice(0, 7) + '-01', today.slice(0, 7) + '-31'), [events, today]);
  const catKeys = Object.keys(cat.cat).sort((x, y) => cat.cat[y] - cat.cat[x]);
  const total = catKeys.reduce((s, k) => s + cat.cat[k], 0);

  return (
    <>
      <section className="panel" aria-labelledby="cmp-h">
        <h2 className="panel__title" id="cmp-h">เทียบกับช่วงก่อน</h2>
        <Pair title="สัปดาห์" hint={`นับถึงวัน${c.wd}เหมือนกัน`} nowLabel="สัปดาห์นี้" prevLabel="สัปดาห์ก่อน" a={c.wk} b={c.pwk} unit="สัปดาห์" />
        <Pair title="เดือน" hint={`นับถึงวันที่ ${c.dom} เหมือนกัน`} nowLabel="เดือนนี้" prevLabel="เดือนก่อน" a={c.mo} b={c.pmo} unit="เดือน" />
      </section>

      <section className="panel" aria-labelledby="share-h">
        <h2 className="panel__title" id="share-h">เวลาแบ่งตามหมวด เดือนนี้</h2>
        {total > 0 ? (
          <>
            <div className="share__bar" role="img" aria-label={catKeys.map((k) => `${CATS[k]} ${r1(cat.cat[k])} ชั่วโมง`).join(' ')}>
              {catKeys.map((k) => <span key={k} className={'sn-cat--' + k} style={{ flexGrow: cat.cat[k] }} />)}
            </div>
            <ul className="share__list">
              {catKeys.map((k) => (
                <li key={k} className={'sn-cat--' + k}>
                  <span className="share__dot" aria-hidden="true" />
                  <span className="share__name">{CATS[k]}</span>
                  <span className="share__val">{r1(cat.cat[k])} ชม.</span>
                  <span className="share__pct">{Math.round((cat.cat[k] / total) * 100)}%</span>
                </li>
              ))}
            </ul>
          </>
        ) : <p className="sub">เดือนนี้ยังไม่มีบันทึก จดงานแล้วสัดส่วนจะขึ้นที่นี่</p>}
      </section>
    </>
  );
}
