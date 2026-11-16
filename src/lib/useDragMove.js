import { useEffect, useRef, useState } from 'react';
import { midDate, minStr, toMin } from './dates.js';

/* ลากบันทึกไปวางวันหรือช่วงเวลาอื่น พร้อมเลิกทำ */
export function useDragMove({ events, setEvents, notify }) {
  const [dropDate, setDropDate] = useState(null);
  const [dragId, setDragId] = useState(null);
  const dragRef = useRef(null);
  const eventsRef = useRef(events);
  eventsRef.current = events;

  useEffect(() => {
    const clear = () => { setDragId(null); setDropDate(null); dragRef.current = null; };
    document.addEventListener('dragend', clear);
    return () => document.removeEventListener('dragend', clear);
  }, []);

  const startDrag = (e, ev, grabY) => {
    dragRef.current = { id: ev.id, grabY };
    e.dataTransfer.effectAllowed = 'move';
    try { e.dataTransfer.setData('text/plain', ev.id); } catch (x) { /* ไม่เป็นไร */ }
    setTimeout(() => setDragId(ev.id), 0);
  };

  const dropOn = (date, start) => {
    const dr = dragRef.current;
    setDropDate(null);
    if (!dr) return;
    const ev = eventsRef.current.find((x) => x.id === dr.id);
    if (!ev) return;
    const ns = start || ev.start, ne = minStr(toMin(ns) + (toMin(ev.end) - toMin(ev.start)));
    const sameDate = date === ev.date, sameTime = ns === ev.start;
    if (sameDate && sameTime) return;
    const prev = { date: ev.date, start: ev.start, end: ev.end };
    setEvents((list) => list.map((x) => (x.id === ev.id ? { ...x, date, start: ns, end: ne } : x)));
    const msg = sameDate ? `ย้ายเวลาเป็น ${ns}–${ne} แล้ว` : `ย้ายไป${midDate(date)}${sameTime ? '' : ` เวลา ${ns}–${ne}`} แล้ว`;
    notify(msg, () => setEvents((list) => list.map((x) => (x.id === ev.id ? { ...x, ...prev } : x))));
  };

  return { dragRef, dragId, dropDate, setDropDate, startDrag, dropOn };
}
