import { useEffect, useRef, useState } from 'react';
import { Icon, Toast } from './ds.js';
import Leaves from './components/Leaves.jsx';
import Sidebar from './components/Sidebar.jsx';
import CalendarPage from './pages/CalendarPage.jsx';
import Login from './pages/Login.jsx';
import SummaryPage from './pages/SummaryPage.jsx';
import { ds } from './lib/dates.js';
import { useToday } from './lib/hooks.js';
import { clearUserData, demoData, loadEvents, pref, saveEvents, setPref } from './lib/storage.js';
import { createSyncer, deleteAccountData, loadProfile, loadRemote, mergePhotoUrls, putMe, saveProfile, setTokenProvider } from './lib/remote.js';
import DeleteAccountDialog from './components/DeleteAccountDialog.jsx';
import ProfileDialog from './components/ProfileDialog.jsx';
import { currentUser, forgetToken, getToken, signInWithGoogle, signOutAuth } from './lib/auth.js';
import { saveTemplates } from './lib/templates.js';
import { loadCategories } from './lib/categories.js';

const RETRY_MS = 5000;
// ลิงก์รูปจากเซิร์ฟเวอร์อายุ 1 ชั่วโมง ขอใหม่ก่อนหมด (เช็กทุก 5 นาทีและตอนกลับมาที่แท็บ เพราะ timer หยุดตอนเครื่องหลับ)
const URL_REFRESH_MS = 40 * 60 * 1000, URL_CHECK_MS = 5 * 60 * 1000;

function Workspace({ user, onSignOut, onDeleteAccount }) {
  const today = useToday();
  const [page, setPage] = useState(() => (pref('sn-page', 'calendar') === 'summary' ? 'summary' : 'calendar'));
  const [events, setEvents] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [toast, setToast] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editProfile, setEditProfile] = useState(false);
  const [person, setPerson] = useState(() => ({ fullName: pref('sn-fullname', ''), supervisor: pref('sn-supervisor', ''), supervisorTitle: pref('sn-supervisor-title', '') }));
  const savePerson = async (p) => {
    if (!user.guest) await saveProfile(p);
    setPref('sn-fullname', p.fullName); setPref('sn-supervisor', p.supervisor); setPref('sn-supervisor-title', p.supervisorTitle);
    setPerson(p); setEditProfile(false); notify('บันทึกโปรไฟล์แล้ว');
  };
  const [saveFailed, setSaveFailed] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [loadTick, setLoadTick] = useState(0); // เพิ่มค่าเพื่อให้ effect โหลดทำงานซ้ำ
  const [saveTick, setSaveTick] = useState(0); // เพิ่มค่าเพื่อให้ effect บันทึกส่งซ้ำ
  const [cursor, setCursor] = useState(() => ds(new Date()));
  const [goal, setGoalState] = useState(() => { const g = Number(pref('sn-goal', '6')); return g >= 1 && g <= 12 ? g : 6; });
  const setGoal = (g) => { setGoalState(g); setPref('sn-goal', String(g)); if (!user.guest) putMe({ goal: g }); };
  const toastTimer = useRef(null);
  const [, setCatsLoaded] = useState(0); // ให้หน้าวาดใหม่เมื่อหมวดจากเซิร์ฟเวอร์มาถึง (CATS ถูกเติมค่า)
  useEffect(() => { loadCategories().then(() => setCatsLoaded((n) => n + 1)).catch(() => {}); }, []);
  const storeKey = user.guest ? 'events' : 'events:' + user.sub;
  const syncer = useRef(null);

  useEffect(() => {
    let live = true, retry = null;
    const done = (list) => { if (live) { setEvents(list); setLoaded(true); setLoadFailed(false); } };
    if (user.guest) {
      loadEvents(storeKey).then((list) => done(!list.length && location.hash === '#demo' ? demoData(ds(new Date())) : list));
    } else {
      // ผู้ใช้ Google: บันทึกอยู่ที่เซิร์ฟเวอร์ ถ้ายังว่างและมีของเดิมในเครื่องนี้ ให้นำขึ้นไปครั้งเดียว
      syncer.current = createSyncer();
      loadRemote().then(async (list) => {
        syncer.current.init(list);
        if (!list.length) list = await loadEvents(storeKey);
        done(list);
      }).catch(() => {
        if (!live) return;
        setLoadFailed(true); setLoaded(false);
        retry = setTimeout(() => setLoadTick((t) => t + 1), RETRY_MS); // ลองโหลดใหม่เอง
      });
    }
    return () => { live = false; clearTimeout(retry); };
  }, [storeKey, user.guest, loadTick]);
  useEffect(() => {
    if (!loaded) return undefined;
    let live = true, retry = null;
    const save = user.guest ? saveEvents(events, storeKey) : syncer.current.push(events);
    save.then((ok) => {
      if (!live) return;
      setSaveFailed(!ok);
      if (!ok && !user.guest) retry = setTimeout(() => setSaveTick((t) => t + 1), RETRY_MS); // ส่งส่วนที่ค้างซ้ำเอง
    });
    return () => { live = false; clearTimeout(retry); };
  }, [events, loaded, storeKey, user.guest, saveTick]);
  useEffect(() => { setPref('sn-page', page); }, [page]);
  useEffect(() => {
    if (user.guest || !loaded) return undefined;
    let last = Date.now(), busy = false;
    const check = () => {
      if (busy || document.hidden || Date.now() - last < URL_REFRESH_MS) return;
      busy = true;
      loadRemote().then((fresh) => { last = Date.now(); setEvents((list) => mergePhotoUrls(list, fresh)); }).catch(() => {}).finally(() => { busy = false; });
    };
    const t = setInterval(check, URL_CHECK_MS);
    document.addEventListener('visibilitychange', check);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', check); };
  }, [user.guest, loaded]);

  const notify = (msg, undo) => {
    clearTimeout(toastTimer.current);
    const id = Math.random();
    setToast({ id, msg, undo });
    toastTimer.current = setTimeout(() => setToast((t) => (t && t.id === id ? null : t)), undo ? 7000 : 3500);
  };

  return (
    <div className="app">
      <Leaves />
      <Sidebar page={page} onPage={setPage} user={user} onSignOut={onSignOut} onDeleteAccount={() => setConfirmDelete(true)} onProfile={() => setEditProfile(true)} displayName={person.fullName} />
      <main className="main">
        {(saveFailed || loadFailed) && (
          <div className="banner" role="alert">
            <Icon name="note" size={20} />
            <span>{user.guest ? 'เก็บบันทึกลงเครื่องไม่ได้ อาจเพราะพื้นที่เต็ม ลองลบรูปที่ไม่ใช้ หรือเปิดแอปในหน้าต่างปกติ ไม่ใช่โหมดส่วนตัว' : loadFailed ? 'โหลดบันทึกจากเซิร์ฟเวอร์ไม่ได้ ตรวจอินเทอร์เน็ตหรือว่าเซิร์ฟเวอร์ (npm run dev) ยังรันอยู่ ระบบจะลองใหม่ทุก 5 วินาที' : 'บันทึกขึ้นเซิร์ฟเวอร์ไม่สำเร็จ ระบบจะลองส่งใหม่ทุก 5 วินาที'}</span>
          </div>
        )}
        {page === 'calendar'
          ? <CalendarPage cursor={cursor} setCursor={setCursor} events={events} setEvents={setEvents} today={today} notify={notify} loaded={loaded} goal={goal} onGoal={setGoal} storeKey={storeKey} />
          : <SummaryPage events={events} today={today} notify={notify} who={person.fullName || (user.guest ? '' : user.name)} supervisor={person.supervisor} supervisorTitle={person.supervisorTitle} />}
      </main>
      {editProfile && <ProfileDialog person={person} onClose={() => setEditProfile(false)} onSave={savePerson} />}
      {confirmDelete && <DeleteAccountDialog onClose={() => setConfirmDelete(false)} onConfirm={onDeleteAccount} />}
      {toast && (
        <div className="toastwrap">
          <Toast key={toast.id} action={toast.undo ? 'เลิกทำ' : undefined} onAction={() => { toast.undo(); setToast(null); }}>{toast.msg}</Toast>
        </div>
      )}
    </div>
  );
}

setTokenProvider(getToken);

export default function App() {
  // ผู้เยี่ยมชม (ดูแบบไม่ลงชื่อ) จำไว้ในเครื่อง ส่วนผู้ใช้ Google ถาม Neon Auth ว่ามี session ไหม
  const [user, setUser] = useState(() => {
    let oldGuest = false; // รุ่นก่อนเก็บผู้ใช้ไว้ที่ sn-user
    try { oldGuest = !!(JSON.parse(pref('sn-user', 'null')) || {}).guest; } catch (e) { /* ไม่เป็นไร */ }
    return pref('sn-guest', '') === '1' || oldGuest ? { guest: true } : undefined;
  });
  const [authError, setAuthError] = useState('');
  useEffect(() => {
    if (user !== undefined) return;
    (async () => {
      const u = await currentUser();
      if (!u) return null;
      // เป้ากับแม่แบบอยู่ที่เซิร์ฟเวอร์ นำลงที่เก็บในเครื่องเพื่อให้ส่วนที่เหลือของแอปอ่านได้เหมือนเดิม
      let p;
      try { p = await loadProfile(); } catch (e) {
        setAuthError('ลงชื่อเข้าใช้กับ Google สำเร็จแล้ว แต่เชื่อมต่อเซิร์ฟเวอร์ของแอปไม่ได้ (' + e.message + ') ตรวจว่ารัน npm run dev หรือ npm run api อยู่ แล้วโหลดหน้านี้ใหม่');
        return null;
      }
      setPref('sn-goal', String(p.goal)); setPref('sn-fullname', p.fullName || ''); setPref('sn-supervisor', p.supervisor || ''); setPref('sn-supervisor-title', p.supervisorTitle || '');
      saveTemplates('events:' + u.id, p.templates || [], { remote: false });
      return { sub: u.id, name: u.name, email: u.email, picture: u.picture };
    })().then(setUser).catch((e) => { setAuthError('ตรวจสอบการลงชื่อเข้าใช้ไม่สำเร็จ: ' + e.message); setUser(null); });
  }, [user]);

  const signInGuest = () => { setPref('sn-guest', '1'); setUser({ guest: true }); };
  const signOut = () => {
    const sub = user && user.sub;
    setPref('sn-guest', ''); setPref('sn-user', 'null'); setUser(null);
    if (sub) { setPref('sn-fullname', ''); setPref('sn-supervisor', ''); setPref('sn-supervisor-title', ''); } // ไม่ทิ้งชื่อไว้ให้คนถัดไปที่ใช้เครื่องเดียวกัน
    forgetToken(); signOutAuth();
    clearUserData(sub); // ไม่ทิ้งแม่แบบและสำเนาบันทึกของผู้ใช้ไว้ให้คนถัดไปที่ใช้เครื่องเดียวกัน
  };
  // ลบที่เซิร์ฟเวอร์ให้สำเร็จก่อน (ถ้าล้มจะโยน error ให้หน้าต่างยืนยันแสดง) แล้วค่อยออกจากระบบ
  const deleteAccount = async () => { await deleteAccountData(); signOut(); };
  if (user === undefined) return null;
  if (!user) return <Login onGuest={signInGuest} onGoogle={signInWithGoogle} notice={authError} />;
  return <Workspace key={user.guest ? 'guest' : user.sub} user={user} onSignOut={signOut} onDeleteAccount={deleteAccount} />;
}
