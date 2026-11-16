import { useMemo, useRef, useState } from 'react';
import { Button, CATS, CategoryTag } from '../ds.js';
import { M_SHORT, WD_SHORT, pd } from '../lib/dates.js';

const SHOW = 30;

const shortDate = (s) => {
  const d = pd(s), yr = d.getFullYear();
  return `${WD_SHORT[d.getDay()]} ${d.getDate()} ${M_SHORT[d.getMonth()]}${yr !== new Date().getFullYear() ? ' ' + (yr + 543) : ''}`;
};

/* ค้นหาบันทึกและกรองตามหมวด ผลค้นหาอยู่ในรายการใต้ช่อง กดแล้วเปิดบันทึกนั้น */
export default function FindBar({ q, setQ, cats, toggleCat, clear, matches, onPick }) {
  const [open, setOpen] = useState(false);
  const box = useRef(null);
  const list = useMemo(
    () => (q.trim() ? matches.slice().sort((a, b) => (a.date + a.start < b.date + b.start ? 1 : -1)) : []),
    [matches, q],
  );
  const active = q.trim() || cats.length;

  const leave = (e) => { if (!box.current || !box.current.contains(e.relatedTarget)) setOpen(false); };

  return (
    <div className="find">
      <div className="find__box" ref={box} onBlur={leave} onKeyDown={(e) => { if (e.key === 'Escape') setOpen(false); }}>
        <input
          type="search" className="find__input" value={q} placeholder="ค้นหาหัวข้อหรือรายละเอียด" aria-label="ค้นหาบันทึก"
          autoComplete="off" onFocus={() => setOpen(true)} onChange={(e) => { setQ(e.target.value); setOpen(true); }}
        />
        {open && q.trim() && (
          <div className="find__list" role="region" aria-label="ผลการค้นหา" aria-live="polite">
            {list.length === 0 && <p className="find__none">ไม่พบบันทึกที่มีคำว่า “{q.trim()}”{cats.length ? ' ในหมวดที่เลือก' : ''}</p>}
            {list.slice(0, SHOW).map((e) => (
              <button key={e.id} type="button" className={'find__row sn-cat--' + e.cat} onClick={() => { setOpen(false); onPick(e); }}>
                <span className="find__date">{shortDate(e.date)}</span>
                <span className="find__title">{e.title}</span>
                <span className="find__time">{e.start}–{e.end}</span>
              </button>
            ))}
            {list.length > SHOW && <p className="find__none">แสดง {SHOW} จาก {list.length} รายการ พิมพ์คำให้เจาะจงขึ้นเพื่อดูที่เหลือ</p>}
          </div>
        )}
      </div>
      <div className="find__cats" role="group" aria-label="กรองตามหมวด">
        {Object.keys(CATS).map((k) => (
          <button key={k} type="button" className="find__cat" aria-pressed={cats.includes(k)} onClick={() => toggleCat(k)}>
            <CategoryTag cat={k} />
          </button>
        ))}
        {active ? <Button variant="ghost" size="sm" onClick={clear}>ล้างตัวกรอง</Button> : null}
      </div>
    </div>
  );
}
