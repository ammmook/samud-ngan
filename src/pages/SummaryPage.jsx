import { useMemo, useState } from 'react';
import { Button, CategoryTag, StatTile, WeekBars } from '../ds.js';
import BestHours from '../components/BestHours.jsx';
import Compare from '../components/Compare.jsx';
import Garden from '../components/Garden.jsx';
import LeafHeatmap from '../components/LeafHeatmap.jsx';
import ReportDialog from '../components/ReportDialog.jsx';
import { M_FULL, WD_SHORT, addDays, evHours, pd, r1, weekStart } from '../lib/dates.js';

export default function SummaryPage({ events, today, notify, who }) {
  const [report, setReport] = useState(false);
  const d = useMemo(() => {
    const by = {};
    events.forEach((e) => { by[e.date] = (by[e.date] || 0) + evHours(e); });
    const ws = weekStart(today);
    let wk = 0;
    const bars = WD_SHORT.map((label, i) => {
      const dt = addDays(ws, i); wk += by[dt] || 0;
      return { label, hours: r1(by[dt] || 0), today: dt === today };
    });
    const ym = today.slice(0, 7), days = {}, cat = {};
    events.forEach((e) => { if (e.date.slice(0, 7) === ym) { days[e.date] = 1; cat[e.cat] = (cat[e.cat] || 0) + evHours(e); } });
    const top = Object.keys(cat).sort((a, b) => cat[b] - cat[a])[0];
    const t = pd(today);
    return {
      bars, wk: r1(wk), todayH: r1(by[today] || 0), days: Object.keys(days).length,
      dim: new Date(t.getFullYear(), t.getMonth() + 1, 0).getDate(), top, topH: top ? r1(cat[top]) : 0,
      month: M_FULL[t.getMonth()] + ' ' + (t.getFullYear() + 543),
    };
  }, [events, today]);

  return (
    <>
      <header className="top">
        <div className="top__title">
          <h1 className="ttl">สรุป</h1>
          <p className="sub">ภาพรวมของสัปดาห์นี้และ{d.month}</p>
        </div>
        <Button variant="soft" icon="export" className="top__report" onClick={() => setReport(true)}>ส่งออกรายงาน</Button>
      </header>

      <div className="dash sn-fade">
        <StatTile label="ชั่วโมงสัปดาห์นี้" value={d.wk} unit="ชม." hint={`วันนี้ ${d.todayH} ชม.`} />
        <StatTile label="วันที่บันทึกในเดือนนี้" value={d.days} unit="วัน" hint={`จาก ${d.dim} วันของเดือน`} />
        <StatTile label="หมวดที่ใช้เวลามากสุด" value={d.top ? d.topH : '–'} unit={d.top ? 'ชม.' : ''} hint="เดือนนี้">
          {d.top && <CategoryTag cat={d.top} />}
        </StatTile>
        <div className="panel sn-root">
          <span className="panel__label">ชั่วโมงรายวันของสัปดาห์นี้</span>
          <WeekBars data={d.bars} />
        </div>
      </div>

      <div className="sum">
        <div className="sum__full"><Garden events={events} today={today} /></div>
        <Compare events={events} today={today} />
        <div className="sum__full"><BestHours events={events} today={today} /></div>
        <div className="sum__full"><LeafHeatmap events={events} today={today} /></div>
      </div>

      {report && <ReportDialog events={events} today={today} who={who} notify={notify} onClose={() => setReport(false)} />}
    </>
  );
}
