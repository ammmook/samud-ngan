import { useEffect, useRef, useState } from 'react';
import { Button, Icon } from '../ds.js';
import { readGoogleToken } from '../lib/googleToken.js';

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
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

export default function Login({ onGoogle, onGuest }) {
  const btn = useRef(null);
  const onGoogleRef = useRef(onGoogle);
  onGoogleRef.current = onGoogle;
  const [msg, setMsg] = useState('');

  useEffect(() => {
    if (!CLIENT_ID) return undefined;
    const fail = () => setMsg('ลงชื่อเข้าใช้ด้วย Google ไม่สำเร็จ ลองอีกครั้ง หรือเข้าใช้แบบผู้เยี่ยมชมไปก่อน');
    const init = () => {
      if (!window.google || !btn.current) return;
      window.google.accounts.id.initialize({
        client_id: CLIENT_ID,
        callback: (res) => { try { onGoogleRef.current(readGoogleToken(res.credential, CLIENT_ID)); } catch (e) { fail(); } },
      });
      window.google.accounts.id.renderButton(btn.current, { theme: 'outline', size: 'large', shape: 'pill', text: 'signin_with', locale: 'th', width: 320 });
    };
    let script = document.getElementById('gsi-client');
    if (window.google) init();
    else {
      if (!script) {
        script = document.createElement('script');
        script.id = 'gsi-client'; script.src = 'https://accounts.google.com/gsi/client'; script.async = true;
        document.head.appendChild(script);
      }
      script.addEventListener('load', init);
      script.addEventListener('error', fail);
    }
    return () => { if (script) { script.removeEventListener('load', init); script.removeEventListener('error', fail); } };
  }, []);

  return (
    <div className="login">
      <main className="login__card">
        <div className="login__brand">
          <div className="brand"><Icon name="leaf" size={28} />สมุดงาน</div>
          <p>จดงานวันละนิด</p>
        </div>
        <div className="login__body">
          <h1 className="login__title">เข้าใช้สมุดงาน</h1>
          <p className="login__lead">ลงชื่อเข้าใช้ เพื่อแยกบันทึกของคุณจากคนอื่นที่ใช้เครื่องเดียวกัน</p>

          {CLIENT_ID ? (
            <div className="login__gbox" ref={btn} />
          ) : (
            <button type="button" className="gbtn" onClick={() => setMsg('ยังลงชื่อเข้าใช้ด้วย Google ไม่ได้ในตอนนี้ เข้าใช้แบบผู้เยี่ยมชมไปก่อนได้เลย')}>
              <GoogleG />ลงชื่อเข้าใช้ด้วย Google
            </button>
          )}
          {msg && <p className="field__err" role="alert">{msg}</p>}

          <div className="login__or" aria-hidden="true"><span>หรือ</span></div>

          <Button variant="ghost" onClick={onGuest}>เข้าใช้แบบผู้เยี่ยมชม</Button>
          <p className="login__note">แบบผู้เยี่ยมชม บันทึกเก็บในเครื่องนี้เท่านั้น</p>
        </div>
      </main>
    </div>
  );
}
