import { useEffect, useRef, useState } from 'react';
import { Button, CATS, CategoryTag, Icon, PhotoStrip, formatDuration } from '../ds.js';
import { DateField, TimeRange24 } from './TimeFields.jsx';
import { longDate, toMin, uid } from '../lib/dates.js';
import PhotoGallery from './PhotoGallery.jsx';
import { shrink } from '../lib/storage.js';
import { MAX_REPEAT, REPEAT_KINDS } from '../lib/repeat.js';

const MAX_PHOTOS = 12;
const COUNTS = [2, 3, 4, 5, 6, 8, 10, 12, 26, MAX_REPEAT];

export default function EventDialog({ draft, isNew, templates = [], onSaveTemplate, onDeleteTemplate, onSave, onDelete, onClose }) {
  const [d, setD] = useState(draft);
  const [tried, setTried] = useState(false);
  const [photoMsg, setPhotoMsg] = useState('');
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [editing, setEditing] = useState(isNew); /* บันทึกเดิมเปิดมาแบบดูอย่างเดียว จนกว่าจะกดแก้ไข */
  const init = useRef(JSON.stringify(draft));
  const box = useRef(null);
  const titleRef = useRef(null);
  const dirty = JSON.stringify(d) !== init.current;

  useEffect(() => {
    const prev = document.activeElement;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; if (prev && prev.focus) prev.focus(); };
  }, []);

  useEffect(() => {
    if (editing && titleRef.current) titleRef.current.focus();
    else if (!editing && box.current) { const b = box.current.querySelector('.dlg__foot .sn-btn--primary'); if (b) b.focus(); }
  }, [editing]);

  /* ปิดหน้าต่าง: ถ้ามีการแก้ค้างอยู่ ถามก่อนทิ้ง */
  const requestClose = () => { if (dirty) setConfirmDiscard('close'); else onClose(); };
  /* ยกเลิกการแก้: บันทึกเดิมกลับไปโหมดดู บันทึกใหม่ปิดหน้าต่าง */
  const leaveEdit = () => { setD(JSON.parse(init.current)); setTried(false); setPhotoMsg(''); setConfirmDiscard(false); setEditing(false); };
  const cancelEdit = () => { if (isNew) requestClose(); else if (dirty) setConfirmDiscard('back'); else leaveEdit(); };

  const set = (k, v) => setD((o) => ({ ...o, [k]: v }));
  const applyTemplate = (t) => setD((o) => ({ ...o, title: t.title, cat: t.cat, start: t.start, end: t.end, note: t.note || '' }));
  const setRepeat = (patch) => setD((o) => ({ ...o, repeat: { ...o.repeat, ...patch } }));
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
    if (e.key === 'Escape') { e.stopPropagation(); if (confirmDiscard) setConfirmDiscard(false); else if (editing) cancelEdit(); else onClose(); return; }
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
              <h2 className="dlg__title" id="dlg-title">{isNew ? 'เพิ่มบันทึก' : editing ? 'แก้ไขบันทึก' : 'ดูบันทึก'}</h2>
              <p className="dlg__sub">{d.date ? longDate(d.date) : 'ยังไม่ได้เลือกวันที่'}</p>
            </div>
            <Button variant="ghost" size="sm" iconOnly icon="x" aria-label="ปิดหน้าต่าง" onClick={editing ? requestClose : onClose} />
          </div>

          {!editing ? (
            <div className="dlg__body dlg__body--view">
              <div className="dlg__col vw">
                <h3 className="vw__title">{d.title}</h3>
                <div className="vw__meta">
                  <CategoryTag cat={d.cat} />
                  <span className="vw__time"><Icon name="clock" size={16} />{d.start}–{d.end} น.{formatDuration(d.start, d.end) ? ` (${formatDuration(d.start, d.end)})` : ''}</span>
                </div>
                <div className="vw__note">
                  <span className="field__label">รายละเอียด</span>
                  {d.note ? <p className="vw__text">{d.note}</p> : <p className="vw__none">ไม่ได้จดรายละเอียดไว้</p>}
                </div>
              </div>
              <div className="dlg__col vw vw--photos">
                <span className="field__label">รูป{d.photos.length ? <span className="field__opt">{d.photos.length} รูป</span> : null}</span>
                <PhotoGallery photos={d.photos} />
              </div>
            </div>
          ) : (
          <div className="dlg__body">
            {isNew && templates.length > 0 && (
              <div className="field dlg__wide">
                <span className="field__label" id="f-tpl">เริ่มจากแม่แบบ<span className="field__opt">กดเพื่อกรอกให้ทั้งฟอร์ม</span></span>
                <div className="tpls" role="group" aria-labelledby="f-tpl">
                  {templates.map((t) => (
                    <span key={t.id} className={'tpl sn-cat--' + t.cat}>
                      <button type="button" className="tpl__use" onClick={() => applyTemplate(t)}>
                        <span className="tpl__dot" aria-hidden="true" />{t.title}<small>{t.start}–{t.end}</small>
                      </button>
                      <button type="button" className="tpl__del" aria-label={'ลบแม่แบบ ' + t.title} onClick={() => onDeleteTemplate(t)}><Icon name="x" size={14} /></button>
                    </span>
                  ))}
                </div>
              </div>
            )}
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
              {isNew && d.repeat && (
                <div className="field">
                  <span className="field__label" id="f-rep">ทำซ้ำ</span>
                  <div className="rep__row">
                    <select className="sel" aria-labelledby="f-rep" value={d.repeat.kind} onChange={(e) => setRepeat({ kind: e.target.value })}>
                      {REPEAT_KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
                    </select>
                    {d.repeat.kind !== 'none' && (
                      <label className="rep__count">
                        <select className="sel" aria-label="จำนวนครั้งที่ทำซ้ำ รวมครั้งแรก" value={d.repeat.count} onChange={(e) => setRepeat({ count: Number(e.target.value) })}>
                          {COUNTS.map((n) => <option key={n} value={n}>{n}</option>)}
                        </select>
                        ครั้ง
                      </label>
                    )}
                  </div>
                  {d.repeat.kind !== 'none' && <span className="field__hint">สร้างบันทึกแยกให้ทุกครั้งตั้งแต่วันที่เลือก ไม่ติดรูป แก้หรือลบทีละวันได้</span>}
                </div>
              )}
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
          )}

          {confirmDiscard ? (
            <div className="dlg__foot" role="alertdialog" aria-label="ยืนยันการทิ้งการแก้ไข">
              <span className="dlg__ask">ทิ้งการแก้ไขที่ยังไม่ได้บันทึกไหม</span>
              <span className="spacer" />
              <Button variant="ghost" onClick={isNew || confirmDiscard === 'close' ? onClose : leaveEdit}>ทิ้งการแก้ไข</Button>
              <Button variant="primary" onClick={() => setConfirmDiscard(false)}>กลับไปแก้ต่อ</Button>
            </div>
          ) : !editing ? (
            <div className="dlg__foot">
              <Button variant="ghost" icon="trash" onClick={onDelete}>ลบบันทึก</Button>
              <span className="spacer" />
              <Button variant="ghost" onClick={onClose}>ปิด</Button>
              <Button variant="primary" icon="pencil" onClick={() => setEditing(true)}>แก้ไข</Button>
            </div>
          ) : (
            <div className="dlg__foot">
              {!isNew && <Button variant="ghost" icon="trash" onClick={onDelete}>ลบบันทึก</Button>}
              <Button variant="ghost" disabled={!d.title.trim()} onClick={() => onSaveTemplate(d)}>เก็บเป็นแม่แบบ</Button>
              <span className="spacer" />
              <Button variant="ghost" onClick={cancelEdit}>ยกเลิก</Button>
              <Button type="submit" variant="primary" icon="check">บันทึกงาน</Button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
