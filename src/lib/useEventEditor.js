import { useState } from 'react';
import { minStr, uid } from './dates.js';

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
    setEditor({ isNew: true, draft: { id: uid(), date: date || defaultDate, start: s, end: e, title: '', cat: 'meadow', note: '', photos: [] } });
  };
  const openEvent = (ev) => setEditor({ isNew: false, draft: JSON.parse(JSON.stringify(ev)) });
  const close = () => setEditor(null);

  const save = (dr) => {
    const exists = events.some((e) => e.id === dr.id);
    setEvents((prev) => (exists ? prev.map((e) => (e.id === dr.id ? dr : e)) : prev.concat(dr)));
    setEditor(null);
    if (onSaved) onSaved(dr);
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
