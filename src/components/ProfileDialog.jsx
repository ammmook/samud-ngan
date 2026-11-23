import { useEffect, useRef, useState } from 'react';
import { Button } from '../ds.js';

/* จัดการโปรไฟล์: ชื่อ-สกุลของเรากับชื่อหัวหน้า ใช้ในไฟล์ Word (ชื่อใต้ "ผู้ส่งมอบ" และ "ผู้ตรวจสอบ") */
export default function ProfileDialog({ person, onSave, onClose }) {
  const [fullName, setFullName] = useState(person.fullName);
  const [supervisor, setSupervisor] = useState(person.supervisor);
  const [supervisorTitle, setSupervisorTitle] = useState(person.supervisorTitle || '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const box = useRef(null);

  useEffect(() => {
    const prev = document.activeElement;
    const i = box.current && box.current.querySelector('input'); if (i) i.focus();
    return () => { if (prev && prev.focus) prev.focus(); };
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setErr(''); setBusy(true);
    try { await onSave({ fullName: fullName.trim(), supervisor: supervisor.trim(), supervisorTitle: supervisorTitle.trim() }); } catch (x) { setBusy(false); setErr('บันทึกไม่สำเร็จ ลองอีกครั้ง (' + (x.message || 'ไม่ทราบสาเหตุ') + ')'); }
  };
  const onKey = (e) => { if (e.key === 'Escape' && !busy) { e.stopPropagation(); onClose(); } };

  return (
    <div className="scrim" onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}>
      <form className="dlg dlg--confirm" role="dialog" aria-modal="true" aria-labelledby="prof-title" ref={box} onKeyDown={onKey} onSubmit={submit}>
        <div className="dlg__head"><h2 className="dlg__title" id="prof-title">จัดการโปรไฟล์</h2></div>
        <div className="dlg__body">
          <div className="field dlg__wide">
            <label className="field__label" htmlFor="prof-name">ชื่อ-สกุล</label>
            <input id="prof-name" type="text" maxLength={100} autoComplete="name" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="เช่น นางสาวสมหญิง ใจดี" />
          </div>
          <div className="field dlg__wide">
            <label className="field__label" htmlFor="prof-sup">ชื่อหัวหน้า</label>
            <input id="prof-sup" type="text" maxLength={100} value={supervisor} onChange={(e) => setSupervisor(e.target.value)} placeholder="เช่น นายสมชาย ใจดี" />
          </div>
          <div className="field dlg__wide">
            <label className="field__label" htmlFor="prof-sup-title">ตำแหน่งของหัวหน้า</label>
            <input id="prof-sup-title" type="text" maxLength={100} value={supervisorTitle} onChange={(e) => setSupervisorTitle(e.target.value)} placeholder="เช่น ผู้อำนวยการกอง" />
          </div>
          {err && <p className="field__err dlg__wide" role="alert">{err}</p>}
        </div>
        <div className="dlg__foot">
          <span className="spacer" />
          <Button variant="ghost" onClick={onClose} disabled={busy}>ยกเลิก</Button>
          <Button variant="primary" type="submit" disabled={busy}>{busy ? 'กำลังบันทึก…' : 'บันทึก'}</Button>
        </div>
      </form>
    </div>
  );
}
