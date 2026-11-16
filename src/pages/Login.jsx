import { useEffect, useState } from 'react';
import { Button, Icon } from '../ds.js';
import Leaves from '../components/Leaves.jsx';
import Plant from '../components/Plant.jsx';
import '../login.css';

function GoogleG() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z" />
      <path fill="#FBBC05" d="M3.97 10.72A5.41 5.41 0 0 1 3.68 9c0-.6.1-1.18.29-1.72V4.95H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.05l3.01-2.33z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58A8.65 8.65 0 0 0 9 0 9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z" />
    </svg>
  );
}

/* สัปดาห์ตัวอย่าง: วงแหวนชั่วโมงเติมทีละวัน ค้าง แล้วว่างลง วนไม่จบ (ตกแต่งอย่างเดียว) */
const WEEK = [['จ', 0.8], ['อ', 1], ['พ', 0.55], ['พฤ', 1], ['ศ', 0.7], ['ส', 0.3], ['อา', 0]];

function WeekRings() {
  return (
    <ol className="lg__week" aria-hidden="true">
      {WEEK.map(([day, pct], i) => (
        <li key={day} className="lg__day" style={{ '--i': i }}>
          <svg width="46" height="46" viewBox="0 0 46 46">
            <circle className="lg__track" cx="23" cy="23" r="18" />
            <circle className="lg__fill" cx="23" cy="23" r="18" pathLength="100" style={{ '--p': 100 - pct * 100 }} />
          </svg>
          <span>{day}</span>
        </li>
      ))}
    </ol>
  );
}

/* ต้นไม้ในโน๊ตโตทีละขั้นแล้วเริ่มใหม่ ถ้าตั้งลดการเคลื่อนไหวจะหยุดที่ต้นใหญ่ */
function GrowingPlant() {
  const [stage, setStage] = useState(1);
  useEffect(() => {
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setStage(4); return undefined; }
    const t = setInterval(() => setStage((s) => (s % 4) + 1), 1900);
    return () => clearInterval(t);
  }, []);
  return <Plant key={stage} stage={stage} cat="meadow" size={64} />;
}

export default function Login({ onGoogle, onGuest, notice }) {
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  // กดแล้วเบราว์เซอร์ไปหน้า Google (Neon Auth) แล้วกลับมาที่หน้านี้พร้อม session
  const google = async () => {
    setMsg(''); setBusy(true);
    try {
      const r = await onGoogle();
      if (r && r.error) throw new Error(r.error.message);
    } catch (e) {
      setBusy(false);
      setMsg('ลงชื่อเข้าใช้ด้วย Google ไม่สำเร็จ ลองอีกครั้ง หรือเข้าดูแบบผู้เยี่ยมชมไปก่อน');
    }
  };

  return (
    <div className="lg">
      <Leaves />
      <section className="lg__stage" aria-label="สมุดงาน">
        <div className="lg__blob lg__blob--a" aria-hidden="true" />
        <div className="lg__blob lg__blob--b" aria-hidden="true" />
        <div className="lg__blob lg__blob--c" aria-hidden="true" />

        <div className="lg__brand"><Icon name="leaf" size={26} />สมุดงาน</div>

        <h2 className="lg__headline">
          <span className="lg__line"><span style={{ '--i': 0 }}>จดงาน</span></span>
          <span className="lg__line"><span style={{ '--i': 1 }}>วันละนิด</span></span>
        </h2>

        <WeekRings />

        <aside className="lg__note" aria-hidden="true">
          <GrowingPlant />
          <div>
            <strong>สวนงาน</strong>
            <p>ทุกวันที่จดคือต้นไม้หนึ่งต้น จดมากต้นยิ่งโต</p>
          </div>
        </aside>
      </section>

      <main className="lg__panel">
        <div className="lg__form">
          <div className="lg__mobilebrand"><Icon name="leaf" size={24} />สมุดงาน</div>
          <h1 className="login__title lg__rise" style={{ '--i': 0 }}>เข้าใช้สมุดงาน</h1>
          <p className="login__lead lg__rise" style={{ '--i': 1 }}>ลงชื่อเข้าใช้ เพื่อแยกบันทึกของคุณจากคนอื่นที่ใช้เครื่องเดียวกัน</p>

          <div className="lg__rise" style={{ '--i': 2 }}>
            <button type="button" className="gbtn lg__g" onClick={google} disabled={busy}>
              <GoogleG />{busy ? 'กำลังไปหน้า Google…' : 'ลงชื่อเข้าใช้ด้วย Google'}
            </button>
          </div>
          {(msg || notice) && <p className="field__err" role="alert">{msg || notice}</p>}

          <div className="login__or lg__rise" style={{ '--i': 3 }} aria-hidden="true"><span>หรือ</span></div>

          <div className="lg__rise" style={{ '--i': 4 }}>
            <Button className="lg__cta" onClick={onGuest}>
              <Icon name="leaf" size={20} className="lg__cta-icon" />เข้าใช้แบบผู้เยี่ยมชม
            </Button>
          </div>
          <p className="login__note lg__rise" style={{ '--i': 5 }}>แบบผู้เยี่ยมชม บันทึกเก็บในเครื่องนี้เท่านั้น</p>
        </div>
      </main>
    </div>
  );
}
