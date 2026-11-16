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

function Workspace({ user, onSignOut }) {
  const today = useToday();
  const [page, setPage] = useState(() => (pref('sn-page', 'calendar') === 'summary' ? 'summary' : 'calendar'));
  const [events, setEvents] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [toast, setToast] = useState(null);
  const [saveFailed, setSaveFailed] = useState(false);
  const [cursor, setCursor] = useState(() => ds(new Date()));
  const [goal, setGoalState] = useState(() => { const g = Number(pref('sn-goal', '6')); return g >= 1 && g <= 12 ? g : 6; });
  const setGoal = (g) => { setGoalState(g); setPref('sn-goal', String(g)); };
  const toastTimer = useRef(null);
  const storeKey = user.guest ? 'events' : 'events:' + user.sub;

  useEffect(() => {
    loadEvents(storeKey).then((list) => {
      if (!list.length && user.guest && location.hash === '#demo') list = demoData(ds(new Date()));
      setEvents(list); setLoaded(true);
    });
  }, [storeKey, user.guest]);
  useEffect(() => {
    if (!loaded) return;
    let live = true;
    saveEvents(events, storeKey).then((ok) => { if (live) setSaveFailed(!ok); });
    return () => { live = false; };
  }, [events, loaded, storeKey]);
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
            <span>เก็บบันทึกลงเครื่องไม่ได้ อาจเพราะพื้นที่เต็ม ลองลบรูปที่ไม่ใช้ หรือเปิดแอปในหน้าต่างปกติ ไม่ใช่โหมดส่วนตัว</span>
          </div>
        )}
        {page === 'calendar'
          ? <CalendarPage cursor={cursor} setCursor={setCursor} events={events} setEvents={setEvents} today={today} notify={notify} loaded={loaded} goal={goal} onGoal={setGoal} />
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
  const [user, setUser] = useState(() => { try { return JSON.parse(pref('sn-user', 'null')); } catch (e) { return null; } });
  const signIn = (u) => { setPref('sn-user', JSON.stringify(u)); setUser(u); };
  const signOut = () => {
    setPref('sn-user', 'null'); setUser(null);
    try { window.google && window.google.accounts.id.disableAutoSelect(); } catch (e) { /* ไม่เป็นไร */ }
  };
  if (!user) {
    return <Login onGuest={() => signIn({ guest: true })} onGoogle={(p) => signIn({ sub: p.sub, name: p.name || p.email, email: p.email, picture: p.picture })} />;
  }
  return <Workspace key={user.guest ? 'guest' : user.sub} user={user} onSignOut={signOut} />;
}
