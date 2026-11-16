import { useEffect, useMemo, useRef } from 'react';
import { EventCard } from '../ds.js';
import { WD_SHORT, layoutDay, longDate, minStr, pad, pd, toMin } from '../lib/dates.js';
import { dropZoneProps } from '../lib/dnd.js';
import { useNowMinute } from '../lib/hooks.js';

/* เส้นเวลาปัจจุบัน อัปเดตเองทุกครึ่งนาที ไม่ทำให้ทั้งตารางต้อง render ใหม่ */
function NowLine({ hh }) {
  const nowMin = useNowMinute();
  return <div className="tg__now" style={{ top: nowMin * hh / 60 }}><span className="sn-now" /></div>;
}

function Column({ date, hh, evs, today, dropDate, setDropDate, onDrop, onNew, onOpen, startDrag, dragRef, dragId, eventsById }) {
  const items = useMemo(() => layoutDay(evs), [evs]);

  const onColDrop = (e) => {
    e.preventDefault();
    const dr = dragRef.current; if (!dr) return;
    const ev = eventsById[dr.id]; if (!ev) return;
    const dur = toMin(ev.end) - toMin(ev.start);
    const y = e.clientY - e.currentTarget.getBoundingClientRect().top - dr.grabY;
    let m = Math.round(y / hh * 60 / 15) * 15;
    m = Math.max(0, Math.min(m, 24 * 60 - dur));
    if (Math.abs(m - toMin(ev.start)) < 15) m = toMin(ev.start);
    onDrop(date, minStr(m));
  };

  return (
    <div
      className={'tg__col' + (dropDate === date ? ' tg__col--drop' : '')}
      onClick={(e) => {
        if (e.target !== e.currentTarget) return;
        const y = e.clientY - e.currentTarget.getBoundingClientRect().top;
        const s = Math.min(Math.floor(y / hh), 23) * 60;
        onNew(date, minStr(s), minStr(Math.min(s + 60, 23 * 60 + 59)));
      }}
      {...dropZoneProps(date, dropDate, setDropDate)}
      onDrop={onColDrop}
    >
      {items.map((it) => {
        const ev = it.e, top = it.a * hh / 60, height = Math.max(24, (it.b - it.a) * hh / 60 - 2);
        const tier = height < 70 ? 'tight' : height < 150 ? 'compact' : 'full';
        const w = 100 / it.lanes;
        return (
          <EventCard
            key={ev.id} cat={ev.cat} title={ev.title} start={ev.start} end={ev.end} note={ev.note}
            photos={ev.photos.map((x) => x.src)} photoCount={ev.photos.length}
            compact={tier !== 'full'} draggable dragging={dragId === ev.id} className={'ev ev--' + tier}
            onClick={(e) => { e.stopPropagation(); onOpen(ev); }}
            cardProps={{
              style: { top: top + 1, height, left: `calc(${it.lane * w}% + 3px)`, width: `calc(${w}% - 6px)` },
              title: `${ev.title} ${ev.start}–${ev.end}`,
              onDragStart: (e) => {
                const r = e.currentTarget.getBoundingClientRect();
                try { e.dataTransfer.setDragImage(e.currentTarget, e.clientX - r.left, e.clientY - r.top); } catch (x) { /* ไม่เป็นไร */ }
                startDrag(e, ev, e.clientY - r.top);
              },
              onKeyDown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(ev); } },
            }}
          />
        );
      })}
      {date === today && <NowLine hh={hh} />}
    </div>
  );
}

export default function TimeGrid({ days, byDate, none, today, onDay, ...rest }) {
  const hh = days.length > 1 ? 64 : 96;
  const scroller = useRef(null);

  useEffect(() => {
    const el = scroller.current; if (!el) return;
    let earliest = 24 * 60;
    days.forEach((d) => (byDate[d] || []).forEach((e) => { earliest = Math.min(earliest, toMin(e.start)); }));
    const focus = earliest < 24 * 60 ? earliest / 60 : 8;
    el.scrollTop = Math.max(0, (Math.min(focus, 18) - 1) * hh);
    // เลื่อนครั้งเดียวตอนเปิดมุมมอง
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hours = Array.from({ length: 23 }, (_, i) => i + 1);
  return (
    <div className="tg" style={{ '--hh': hh + 'px', '--n': days.length }}>
      <div className="tg__scroll" ref={scroller}>
        <div className="tg__inner" style={{ '--minw': days.length > 1 ? '760px' : '0px' }}>
          <div className="tg__head">
            <div />
            {days.map((date) => {
              const d = pd(date);
              return (
                <button key={date} type="button" className={'tg__hd' + (date === today ? ' is-today' : '')} onClick={() => onDay(date)} aria-label={'เปิด' + longDate(date)}>
                  <span className="tg__hd-day">{WD_SHORT[d.getDay()]}</span>
                  <span className="tg__hd-num">{d.getDate()}</span>
                </button>
              );
            })}
          </div>
          <div className="tg__body">
            <div className="tg__gutter">{hours.map((h) => <span key={h} className="tg__hour" style={{ top: h * hh }}>{pad(h)}:00</span>)}</div>
            {days.map((date) => (
              <Column key={date} date={date} hh={hh} evs={byDate[date] || none} today={today} {...rest} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
