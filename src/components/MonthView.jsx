import { DayCell } from '../ds.js';
import { WD_SHORT, addDays, ds, pd, sortEv, weekStart } from '../lib/dates.js';
import { dropZoneProps } from '../lib/dnd.js';

export default function MonthView({ cursor, today, byDate, eventsById, dropDate, setDropDate, startDrag, onDrop, onOpen, onNew, onDay, mobile }) {
  const cur = pd(cursor), first = new Date(cur.getFullYear(), cur.getMonth(), 1);
  const dim = new Date(cur.getFullYear(), cur.getMonth() + 1, 0).getDate();
  const weeks = Math.ceil((first.getDay() + dim) / 7), start = weekStart(ds(first));
  const cells = Array.from({ length: weeks * 7 }, (_, i) => addDays(start, i));

  return (
    <div className="month">
      {WD_SHORT.map((w) => <div key={w} className="month__wd">{w}</div>)}
      {cells.map((date) => {
        const evs = (byDate[date] || []).slice().sort(sortEv);
        const handler = (e) => {
          if (e.type !== 'click') { onDay(date); return; }
          const pip = e.target.closest('.sn-pip');
          if (pip) {
            const idx = Array.prototype.indexOf.call(e.currentTarget.querySelectorAll('.sn-pip'), pip);
            if (evs[idx]) onOpen(evs[idx]);
            return;
          }
          if (e.target.closest('.sn-day__more') || e.target.closest('.sn-day__head') || (mobile && evs.length)) { onDay(date); return; }
          onNew(date);
        };
        return (
          <DayCell
            key={date}
            day={pd(date).getDate()}
            plainDay
            today={date === today}
            outside={pd(date).getMonth() !== cur.getMonth()}
            events={evs.map((e) => ({ id: e.id, cat: e.cat, title: e.title }))}
            dropTarget={dropDate === date}
            onClick={handler}
            {...dropZoneProps(date, dropDate, setDropDate)}
            onDrop={(e) => { e.preventDefault(); onDrop(date, null); }}
            onEventDragStart={(e, ev) => startDrag(e, eventsById[ev.id], 0)}
            // ไม่ตั้ง aria-label ทับเนื้อหา เพื่อให้ตัวอ่านหน้าจออ่านชื่องานในช่องได้
            cellProps={{ 'data-date': date }}
          />
        );
      })}
    </div>
  );
}
