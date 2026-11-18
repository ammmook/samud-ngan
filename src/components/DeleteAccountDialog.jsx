import { useEffect, useRef, useState } from 'react';
import { Button } from '../ds.js';

/* ยืนยันลบข้อมูลทั้งหมดของบัญชี: ลบแล้วกู้คืนไม่ได้ จึงไม่ปิดเองและแสดงผลลัพธ์ที่เซิร์ฟเวอร์ตอบ */
export default function DeleteAccountDialog({ onConfirm, onClose }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const box = useRef(null);

  useEffect(() => {
    const prev = document.activeElement;
    const b = box.current && box.current.querySelector("button"); if (b) b.focus();
    return () => { if (prev && prev.focus) prev.focus(); };
  }, []);

  const go = async () => {
    setErr(''); setBusy(true);
    try { await onConfirm(); } catch (e) { setBusy(false); setErr('ลบไม่สำเร็จ ลองอีกครั้ง (' + (e.message || 'ไม่ทราบสาเหตุ') + ')'); }
  };
  const onKey = (e) => { if (e.key === 'Escape' && !busy) { e.stopPropagation(); onClose(); } };

  return (
    <div className="scrim" onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}>
      <div className="dlg dlg--confirm" role="alertdialog" aria-modal="true" aria-labelledby="del-title" aria-describedby="del-desc" ref={box} onKeyDown={onKey}>
        <div className="dlg__head"><h2 className="dlg__title" id="del-title">ลบบัญชีและข้อมูลทั้งหมด</h2></div>
        <div className="dlg__body">
          <p id="del-desc" className="dlg__wide">บันทึก รูป แม่แบบ และเป้าหมายของคุณจะถูกลบจากเซิร์ฟเวอร์ถาวร กู้คืนไม่ได้ ควรดาวน์โหลดรายงาน CSV เก็บไว้ก่อนถ้าต้องการ</p>
          {err && <p className="field__err dlg__wide" role="alert">{err}</p>}
        </div>
        <div className="dlg__foot">
          <span className="spacer" />
          <Button variant="ghost" onClick={onClose} disabled={busy}>ยกเลิก</Button>
          <Button variant="primary" className="btn-danger" onClick={go} disabled={busy}>{busy ? 'กำลังลบ…' : 'ลบถาวร'}</Button>
        </div>
      </div>
    </div>
  );
}
