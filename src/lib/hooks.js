import { useEffect, useState } from 'react';
import { ds } from './dates.js';

export function useMedia(q) {
  const [v, set] = useState(() => window.matchMedia(q).matches);
  useEffect(() => {
    const m = window.matchMedia(q), f = () => set(m.matches);
    m.addEventListener('change', f);
    return () => m.removeEventListener('change', f);
  }, [q]);
  return v;
}

/* วันนี้ (YYYY-MM-DD) เปลี่ยนค่าเฉพาะตอนข้ามเที่ยงคืน จึงไม่ทำให้ทั้งแอป render ใหม่ทุกครึ่งนาที */
export function useToday() {
  const [today, setToday] = useState(() => ds(new Date()));
  useEffect(() => {
    const i = setInterval(() => setToday(ds(new Date())), 30000);
    return () => clearInterval(i);
  }, []);
  return today;
}

const minuteOfDay = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); };

/* นาทีของวันตอนนี้ (0 ถึง 1439) ใช้เฉพาะเส้นเวลาปัจจุบัน */
export function useNowMinute() {
  const [m, setM] = useState(minuteOfDay);
  useEffect(() => {
    const i = setInterval(() => setM(minuteOfDay()), 30000);
    return () => clearInterval(i);
  }, []);
  return m;
}
