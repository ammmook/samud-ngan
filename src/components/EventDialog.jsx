import { useEffect, useRef, useState } from 'react';
import { Button, CATS, CategoryTag, Icon, PhotoStrip } from '../ds.js';
import { DateField, TimeRange24 } from './TimeFields.jsx';
import { longDate, toMin, uid } from '../lib/dates.js';
import { shrink } from '../lib/storage.js';

const MAX_PHOTOS = 12;

export default function EventDialog({ draft, isNew, onSave, onDelete, onClose }) {
  const [d, setD] = useState(draft);
  const [tried, setTried] = useState(false);
  const [photoMsg, setPhotoMsg] = useState('');
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const init = useRef(JSON.stringify(draft));
  const box = useRef(null);
  const titleRef = useRef(null);
  const dirty = JSON.stringify(d) !== init.current;

  useEffect(() => {
    const prev = document.activeElement;
    if (isNew && titleRef.current) titleRef.current.focus();
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; if (prev && prev.focus) prev.focus(); };
  }, [isNew]);

  /* ปิดหน้าต่าง: ถ้ามีการแก้ค้างอยู่ ถามก่อนทิ้ง */
  const requestClose = () => { if (dirty) setConfirmDiscard(true); else onClose(); };

  const set = (k, v) => setD((o) => ({ ...o, [k]: v }));
  const errTitle = !d.title.trim() ? 'ใส่ชื่องานก่อน แล้วกด "บันทึกงาน" อีกครั้ง' : '';
  const errDate = !d.date ? 'เลือกวันที่ของบันทึก' : '';
  const timeMissing = !d.start || !d.end;
  const timeBad = !timeMissing && !(toMin(d.end) > toMin(d.start));

  const submit = (e) => {
    e.preventDefault();
    setTried(true);
    if (errTitle || errDate || timeMissing || timeBad) {
      const el = box.current && box.current.querySelector(errTitle ? '#f-title' : errDate ? '#f-date' : '.tf select');
      if (el) el.focus();
      return;
    }
    onSave({ ...d, title: d.title.trim(), note: d.note.trim() });
  };

  const onKey = (e) => {
    if (e.key === 'Escape') { e.stopPropagation(); if (confirmDiscard) setConfirmDiscard(false); else requestClose(); return; }
    if (e.key === 'Tab' && box.current) {
      const f = Array.prototype.filter.call(box.current.querySelectorAll('button:not([disabled]), input:not([hidden]):not([disabled]), select, textarea, [tabindex="0"]'), (x) => x.offsetParent !== null);
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  };

  const addPhotos = (files) => {
    const room = Math.max(0, MAX_PHOTOS - d.photos.length);
    const take = files.slice(0, room), skipped = files.length - take.length;
    setPhotoMsg('');
    Promise.all(take.map((f) => shrink(f).then((src) => ({ id: uid(), src })).catch(() => null)))
      .then((list) => {
        const ok = list.filter(Boolean), bad = list.length - ok.length, msg = [];
        if (ok.length) setD((o) => ({ ...o, photos: o.photos.concat(ok).slice(0, MAX_PHOTOS) }));
        if (bad) msg.push(`เปิดรูป ${bad} ไฟล์ไม่ได้ ลองใช้ไฟล์ JPG หรือ PNG`);
        if (skipped) msg.push(`ใส่รูปได้สูงสุด ${MAX_PHOTOS} รูป เลยไม่ได้เพิ่มอีก ${skipped} รูป`);
        setPhotoMsg(msg.join(' '));
      });
  };

  return (
    <div className="scrim" onMouseDown={(e) => { if (e.target === e.currentTarget && !dirty) onClose(); }}>
      <div className={'dlg sn-cat--' + d.cat} role="dialog" aria-modal="true" aria-labelledby="dlg-title" ref={box} onKeyDown={onKey}>
        <form onSubmit={submit} noValidate style={{ display: 'contents' }}>
          <div className="dlg__head">
            <div>
              <h2 className="dlg__title" id="dlg-title">{isNew ? 'เพิ่มบันทึก' : 'แก้ไขบันทึก'}</h2>
              <p className="dlg__sub">{d.date ? longDate(d.date) : 'ยังไม่ได้เลือกวันที่'}</p>
            </div>
            <Button variant="ghost" size="sm" iconOnly icon="x" aria-label="ปิดหน้าต่าง" onClick={requestClose} />
          </div>

          <div className="dlg__body">
            <div className="dlg__col">
              <div className="field">
                <label className="field__label" htmlFor="f-title">หัวข้อ</label>
                <input id="f-title" type="text" ref={titleRef} value={d.title} placeholder="เช่น เขียนรายงานสรุปไตรมาส" maxLength={120} autoComplete="off"
                  aria-invalid={tried && errTitle ? 'true' : undefined} aria-describedby={tried && errTitle ? 'e-title' : undefined}
                  onChange={(e) => set('title', e.target.value)} />
                {tried && errTitle && <span className="field__err" id="e-title" role="alert">{errTitle}</span>}
              </div>
              <div className="field field--grow">
                <label className="field__label" htmlFor="f-note">รายละเอียด<span className="field__opt">ไม่ใส่ก็ได้</span></label>
                <textarea id="f-note" value={d.note} placeholder="จดสิ่งที่ทำ หรือสิ่งที่ต้องทำต่อ" onChange={(e) => set('note', e.target.value)} />
              </div>
            </div>

            <div className="dlg__col">
              <div className="field">
                <span className="field__label" id="f-date-label">วันที่</span>
                <DateField id="f-date" value={d.date} invalid={tried && errDate} onChange={(v) => set('date', v)} />
                {tried && errDate && <span className="field__err" role="alert">{errDate}</span>}
              </div>
              <div className="field">
                <span className="field__label">เวลาทำงาน</span>
                <TimeRange24 start={d.start} end={d.end} onChange={(v) => setD((o) => ({ ...o, ...v }))} />
                {tried && timeMissing && <span className="field__err" role="alert">ใส่เวลาเริ่มและเวลาจบ</span>}
              </div>
              <div className="field">
                <span className="field__label" id="f-cat">หมวด</span>
                <div className="catpick-row" role="radiogroup" aria-labelledby="f-cat">
                  {Object.keys(CATS).map((k) => (
                    <button key={k} type="button" role="radio" aria-checked={d.cat === k} className="catpick" onClick={() => set('cat', k)}>
                      <Icon name="check" size={14} /><CategoryTag cat={k} />
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="field dlg__wide">
              <span className="field__label">รูป
                <span className="field__opt">{d.photos.length ? `${d.photos.length} รูป · เลือกเพิ่มได้หลายรูปพร้อมกัน` : 'เลือกได้หลายรูปพร้อมกัน'}</span>
              </span>
              <PhotoStrip
                photos={d.photos.map((x, i) => ({ id: x.id, src: x.src, alt: `รูปที่ ${i + 1} ของบันทึก` }))}
                max={MAX_PHOTOS}
                onAdd={addPhotos}
                onRemove={(id) => { setPhotoMsg(''); setD((o) => ({ ...o, photos: o.photos.filter((x) => x.id !== id) })); }}
              />
              {photoMsg && <span className="field__err" role="alert">{photoMsg}</span>}
            </div>
          </div>

          {confirmDiscard ? (
            <div className="dlg__foot" role="alertdialog" aria-label="ยืนยันการทิ้งการแก้ไข">
              <span className="dlg__ask">ทิ้งการแก้ไขที่ยังไม่ได้บันทึกไหม</span>
              <span className="spacer" />
              <Button variant="ghost" onClick={onClose}>ทิ้งการแก้ไข</Button>
              <Button variant="primary" onClick={() => setConfirmDiscard(false)}>กลับไปแก้ต่อ</Button>
            </div>
          ) : (
            <div className="dlg__foot">
              {!isNew && <Button variant="ghost" icon="trash" onClick={onDelete}>ลบบันทึก</Button>}
              <span className="spacer" />
              <Button variant="ghost" onClick={requestClose}>ยกเลิก</Button>
              <Button type="submit" variant="primary" icon="check">บันทึกงาน</Button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
