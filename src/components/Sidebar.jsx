import { useEffect, useRef, useState } from 'react';
import { Icon, Button } from '../ds.js';

const PAGES = [
  { id: 'calendar', label: 'ปฏิทิน', icon: 'calendar' },
  { id: 'summary', label: 'สรุป', icon: 'chart' },
];

function Avatar({ user, name }) {
  const initial = (name || '?').trim().charAt(0).toUpperCase();
  return <span className="who__av" aria-hidden="true">{user.picture ? <img src={user.picture} alt="" referrerPolicy="no-referrer" /> : initial}</span>;
}

/* เมนูบัญชีบนแถบบนสุด: กดรูปแล้วเห็นชื่อกับปุ่มออกจากระบบ ไม่ออกทันที */
function AccountMenu({ user, name, outLabel, onSignOut, onDelete }) {
  const [open, setOpen] = useState(false);
  const box = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const away = (e) => { if (box.current && !box.current.contains(e.target)) setOpen(false); };
    const esc = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', away);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', away); document.removeEventListener('keydown', esc); };
  }, [open]);

  return (
    <div className="acct" ref={box}>
      <button type="button" className="topbar__acct" aria-haspopup="true" aria-expanded={open} aria-label={'บัญชี ' + name} onClick={() => setOpen((o) => !o)}>
        <Avatar user={user} name={name} />
      </button>
      {open && (
        <div className="acct__menu" role="group" aria-label="บัญชี">
          <p className="acct__name">{name}</p>
          {user.email && <p className="acct__mail">{user.email}</p>}
          <Button variant="soft" size="sm" onClick={onSignOut}>{outLabel}</Button>
          {onDelete && <Button variant="ghost" size="sm" onClick={() => { setOpen(false); onDelete(); }}>ลบบัญชีและข้อมูล</Button>}
        </div>
      )}
    </div>
  );
}

export default function Sidebar({ page, onPage, user, onSignOut, onDeleteAccount }) {
  const onDelete = user.guest ? undefined : onDeleteAccount;
  const name = user.guest ? 'ผู้เยี่ยมชม' : user.name;
  const outLabel = user.guest ? 'เข้าสู่ระบบ' : 'ออกจากระบบ';
  return (
    <>
      {/* เดสก์ท็อป: แถบข้าง */}
      <aside className="side">
        <div className="side__brand">
          <div className="brand"><Icon name="leaf" size={26} />สมุดงาน</div>
          <p className="side__tag">จดงานวันละนิด</p>
        </div>
        <nav className="nav" aria-label="หน้าจอ">
          {PAGES.map((p) => (
            <button key={p.id} type="button" className={'nav__item' + (page === p.id ? ' is-on' : '')} aria-current={page === p.id ? 'page' : undefined} onClick={() => onPage(p.id)}>
              <Icon name={p.icon} size={20} />{p.label}
            </button>
          ))}
        </nav>
        <div className="side__foot">
          <div className="who">
            <Avatar user={user} name={name} />
            <span className="who__name">{name}</span>
          </div>
          <Button variant="ghost" size="sm" onClick={onSignOut}>{outLabel}</Button>
          {onDelete && <Button variant="ghost" size="sm" className="btn-danger-text" onClick={onDelete}>ลบบัญชีและข้อมูล</Button>}
        </div>
      </aside>

      {/* ไม่ใช่เดสก์ท็อป: แถบเมนูบนสุด */}
      <header className="topbar">
        <span className="topbar__brand"><Icon name="leaf" size={22} />สมุดงาน</span>
        <nav className="topbar__nav" aria-label="หน้าจอ">
          {PAGES.map((p) => (
            <button key={p.id} type="button" className={'topbar__item' + (page === p.id ? ' is-on' : '')} aria-current={page === p.id ? 'page' : undefined} onClick={() => onPage(p.id)}>
              {p.label}
            </button>
          ))}
        </nav>
        <AccountMenu user={user} name={name} outLabel={outLabel} onSignOut={onSignOut} onDelete={onDelete} />
      </header>
    </>
  );
}
