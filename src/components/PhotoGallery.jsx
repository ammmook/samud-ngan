import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '../ds.js';

/* ดูรูปของบันทึก: รูปใหญ่ปรับตามความกว้างจอ + แถบรูปย่อ + กดขยายเต็มจอ (ไม่ตัดรูป ไม่ล้นจอ) */
export default function PhotoGallery({ photos }) {
  const [i, setI] = useState(0);
  const [full, setFull] = useState(false);
  const n = photos.length;
  const cur = Math.min(i, n - 1);
  const go = (d) => setI((x) => (Math.min(x, n - 1) + d + n) % n);
  const opener = useRef(null);

  if (!n) return <p className="pg__empty">บันทึกนี้ยังไม่มีรูป กดปุ่มแก้ไขเพื่อเพิ่มรูป</p>;

  return (
    <div className="pg">
      <div className="pg__stage">
        <button type="button" className="pg__main" ref={opener} aria-label={`ขยายรูปที่ ${cur + 1} จาก ${n}`} onClick={() => setFull(true)}>
          <img src={photos[cur].src} alt={`รูปที่ ${cur + 1} ของบันทึก`} />
        </button>
        {n > 1 && (
          <>
            <button type="button" className="pg__nav pg__nav--prev" aria-label="รูปก่อนหน้า" onClick={() => go(-1)}><Icon name="left" size={20} /></button>
            <button type="button" className="pg__nav pg__nav--next" aria-label="รูปถัดไป" onClick={() => go(1)}><Icon name="right" size={20} /></button>
          </>
        )}
        <span className="pg__count" aria-live="polite">{cur + 1} / {n}</span>
      </div>
      {n > 1 && (
        <div className="pg__thumbs" role="group" aria-label="เลือกรูป">
          {photos.map((p, k) => (
            <button key={p.id} type="button" className="pg__thumb" aria-label={`ดูรูปที่ ${k + 1}`} aria-current={k === cur ? 'true' : undefined} onClick={() => setI(k)}>
              <img src={p.src} alt="" loading="lazy" />
            </button>
          ))}
        </div>
      )}
      {full && <Lightbox photos={photos} index={cur} onIndex={setI} onClose={() => { setFull(false); if (opener.current) opener.current.focus(); }} />}
    </div>
  );
}

function Lightbox({ photos, index, onIndex, onClose }) {
  const n = photos.length;
  const closeBtn = useRef(null);
  const go = (d) => onIndex((index + d + n) % n);

  useEffect(() => { if (closeBtn.current) closeBtn.current.focus(); }, []);

  /* กันไม่ให้คีย์ลามไปถึงหน้าต่างบันทึกด้านล่าง */
  const onKey = (e) => {
    e.stopPropagation();
    if (e.key === 'Escape') onClose();
    else if (e.key === 'ArrowLeft' && n > 1) go(-1);
    else if (e.key === 'ArrowRight' && n > 1) go(1);
    else if (e.key === 'Tab') {
      const f = Array.prototype.slice.call(e.currentTarget.querySelectorAll('button'));
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  };

  return createPortal(
    <div className="lb" role="dialog" aria-modal="true" aria-label={`รูปที่ ${index + 1} จาก ${n}`} onKeyDown={onKey}
      onMouseDown={(e) => { if (e.target === e.currentTarget || e.target.classList.contains('lb__fig')) onClose(); }}>
      <button type="button" className="lb__btn lb__close" ref={closeBtn} aria-label="ปิดรูป" onClick={onClose}><Icon name="x" size={22} /></button>
      <figure className="lb__fig">
        <img src={photos[index].src} alt={`รูปที่ ${index + 1} ของบันทึก`} />
      </figure>
      {n > 1 && (
        <>
          <button type="button" className="lb__btn lb__prev" aria-label="รูปก่อนหน้า" onClick={() => go(-1)}><Icon name="left" size={24} /></button>
          <button type="button" className="lb__btn lb__next" aria-label="รูปถัดไป" onClick={() => go(1)}><Icon name="right" size={24} /></button>
        </>
      )}
      <span className="lb__count">{index + 1} / {n}</span>
    </div>,
    document.body
  );
}
