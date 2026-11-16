import { useState } from 'react';
import { minStr, uid } from './dates.js';
import { cloneTo, repeatDates } from './repeat.js';

/* เปิด เพิ่ม แก้ ลบ บันทึกผ่านหน้าต่างเดียว */
export function useEventEditor({ events, setEvents, notify, defaultDate, today, onSaved }) {
  const [editor, setEditor] = useState(null);

  const openNew = (date, start, end) => {
    let s = start, e = end;
    if (!s) {
      s = '09:00'; e = '10:00';
      if (date === today) {
        const d = new Date(), nowMin = d.getHours() * 60 + d.getMinutes();
        const h = Math.min(Math.ceil((nowMin + 1) / 60), 22);
        if (h * 60 > 9 * 60) { s = minStr(h * 60); e = minStr(h * 60 + 60); }
      }
    }
    setEditor({ isNew: true, draft: { id: uid(), date: date || defaultDate, start: s, end: e, title: '', cat: 'meadow', note: '', photos: [], repeat: { kind: 'none', count: 4 } } });
  };
  const openEvent = (ev) => setEditor({ isNew: false, draft: JSON.parse(JSON.stringify(ev)) });
  const close = () => setEditor(null);

  const save = (dr) => {
    const { repeat, ...ev } = dr;
    const exists = events.some((e) => e.id === ev.id);
    setEditor(null);
    if (onSaved) onSaved(ev);
    if (!exists && repeat && repeat.kind !== 'none') {
      const dates = repeatDates(ev.date, repeat.kind, repeat.count);
      const list = dates.map((date, i) => (i === 0 ? ev : cloneTo(ev, date, uid)));
      const ids = new Set(list.map((x) => x.id));
      setEvents((prev) => prev.concat(list));
      notify(`บันทึกงานแล้ว และทำซ้ำเพิ่มอีก ${list.length - 1} ครั้ง`, () => setEvents((prev) => prev.filter((x) => !ids.has(x.id))));
      return;
    }
    setEvents((prev) => (exists ? prev.map((e) => (e.id === ev.id ? ev : e)) : prev.concat(ev)));
    notify('บันทึกงานแล้ว');
  };

  const remove = () => {
    const id = editor.draft.id, old = events.find((e) => e.id === id);
    setEditor(null);
    if (!old) return;
    setEvents((prev) => prev.filter((e) => e.id !== id));
    notify('ลบบันทึกแล้ว', () => setEvents((prev) => prev.concat(old)));
  };

  return { editor, openNew, openEvent, close, save, remove };
}
