import { useEffect, useRef, useState } from 'react';
import { Icon, Toast } from './ds.js';
import Leaves from './components/Leaves.jsx';
import Sidebar from './components/Sidebar.jsx';
import CalendarPage from './pages/CalendarPage.jsx';
import Login from './pages/Login.jsx';
import SummaryPage from './pages/SummaryPage.jsx';
import { ds } from './lib/dates.js';
import { useToday } from './lib/hooks.js';
import { demoData, loadEvents, pref, saveEvents, setPref } from './lib/storage.js';
import { createSyncer, googleSignIn, loadRemote, putMe, signOutRemote, whoAmI } from './lib/remote.js';
import { saveTemplates } from './lib/templates.js';

function Workspace({ user, onSignOut }) {
  const today = useToday();
  const [page, setPage] = useState(() => (pref('sn-page', 'calendar') === 'summary' ? 'summary' : 'calendar'));
  const [events, setEvents] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [toast, setToast] = useState(null);
  const [saveFailed, setSaveFailed] = useState(false);
  const [cursor, setCursor] = useState(() => ds(new Date()));
  const [goal, setGoalState] = useState(() => { const g = Number(pref('sn-goal', '6')); return g >= 1 && g <= 12 ? g : 6; });
  const setGoal = (g) => { setGoalState(g); setPref('sn-goal', String(g)); if (!user.guest) putMe({ goal: g }); };
  const toastTimer = useRef(null);
  const storeKey = user.guest ? 'events' : 'events:' + user.sub;
  const syncer = useRef(null);

  useEffect(() => {
    let live = true;
    const done = (list) => { if (live) { setEvents(list); setLoaded(true); } };
    if (user.guest) {
      loadEvents(storeKey).then((list) => done(!list.length && location.hash === '#demo' ? demoData(ds(new Date())) : list));
    } else {
      // ผู้ใช้ Google: บันทึกอยู่ที่เซิร์ฟเวอร์ ถ้ายังว่างและมีของเดิมในเครื่องนี้ ให้นำขึ้นไปครั้งเดียว
      syncer.current = createSyncer();
      loadRemote().then(async (list) => {
        syncer.current.init(list);
        if (!list.length) list = await loadEvents(storeKey);
        done(list);
      }).catch(() => { if (live) { setSaveFailed(true); setLoaded(false); } });
    }
    return () => { live = false; };
  }, [storeKey, user.guest]);
  useEffect(() => {
    if (!loaded) return undefined;
    let live = true;
    const save = user.guest ? saveEvents(events, storeKey) : syncer.current.push(events);
    save.then((ok) => { if (live) setSaveFailed(!ok); });
    return () => { live = false; };
  }, [events, loaded, storeKey, user.guest]);
  useEffect(() => { setPref('sn-page', page); }, [page]);

  const notify = (msg, undo) => {
    clearTimeout(toastTimer.current);
    const id = Math.random();
    setToast({ id, msg, undo });
    toastTimer.current = setTimeout(() => setToast((t) => (t && t.id === id ? null : t)), undo ? 7000 : 3500);
  };

  return (
    <div className="app">
      <Leaves />
      <Sidebar page={page} onPage={setPage} user={user} onSignOut={onSignOut} />
      <main className="main">
        {saveFailed && (
          <div className="banner" role="alert">
            <Icon name="note" size={20} />
            <span>{user.guest ? 'เก็บบันทึกลงเครื่องไม่ได้ อาจเพราะพื้นที่เต็ม ลองลบรูปที่ไม่ใช้ หรือเปิดแอปในหน้าต่างปกติ ไม่ใช่โหมดส่วนตัว' : 'บันทึกขึ้นเซิร์ฟเวอร์ไม่สำเร็จ ตรวจอินเทอร์เน็ตแล้วลองแก้ไขอีกครั้ง ระบบจะส่งใหม่ให้เอง'}</span>
          </div>
        )}
        {page === 'calendar'
          ? <CalendarPage cursor={cursor} setCursor={setCursor} events={events} setEvents={setEvents} today={today} notify={notify} loaded={loaded} goal={goal} onGoal={setGoal} storeKey={storeKey} />
          : <SummaryPage events={events} today={today} notify={notify} who={user.guest ? '' : user.name} />}
      </main>
      {toast && (
        <div className="toastwrap">
          <Toast key={toast.id} action={toast.undo ? 'เลิกทำ' : undefined} onAction={() => { toast.undo(); setToast(null); }}>{toast.msg}</Toast>
        </div>
      )}
    </div>
  );
}

export default function App() {
  // ผู้เยี่ยมชมจำไว้ในเครื่อง ส่วนผู้ใช้ Google ถามเซิร์ฟเวอร์จาก session cookie
  const [user, setUser] = useState(() => {
    let oldGuest = false; // รุ่นก่อนเก็บผู้ใช้ไว้ที่ sn-user
    try { oldGuest = !!(JSON.parse(pref('sn-user', 'null')) || {}).guest; } catch (e) { /* ไม่เป็นไร */ }
    return pref('sn-guest', '') === '1' || oldGuest ? { guest: true } : undefined;
  });
  useEffect(() => {
    if (user !== undefined) return;
    whoAmI().then((p) => setUser(hydrate(p))).catch(() => setUser(null));
  }, [user]);

  // นำเป้ากับแม่แบบจากเซิร์ฟเวอร์ลงที่เก็บในเครื่อง เพื่อให้ส่วนที่เหลือของแอปอ่านได้เหมือนเดิม
  function hydrate(p) {
    setPref('sn-goal', String(p.goal));
    saveTemplates('events:' + p.sub, p.templates || [], { remote: false });
    return { sub: p.sub, name: p.name, email: p.email, picture: p.picture };
  }
  const signInGoogle = async (credential) => setUser(hydrate(await googleSignIn(credential)));
  const signInGuest = () => { setPref('sn-guest', '1'); setUser({ guest: true }); };
  const signOut = () => {
    setPref('sn-guest', ''); setPref('sn-user', 'null'); setUser(null);
    signOutRemote();
    try { window.google && window.google.accounts.id.disableAutoSelect(); } catch (e) { /* ไม่เป็นไร */ }
  };
  if (user === undefined) return null;
  if (!user) return <Login onGuest={signInGuest} onGoogle={signInGoogle} />;
  return <Workspace key={user.guest ? 'guest' : user.sub} user={user} onSignOut={signOut} />;
}
