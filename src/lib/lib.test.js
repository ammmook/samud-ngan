import { Buffer } from 'node:buffer';
import { describe, expect, it } from 'vitest';
import { addDays, addMonths, evHours, layoutDay, minStr, toMin, weekStart } from './dates.js';
import { readGoogleToken } from './googleToken.js';

describe('dates', () => {
  it('addMonths clamps to the last day of a shorter month', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonths('2028-01-31', 1)).toBe('2028-02-29');
    expect(addMonths('2026-03-31', -1)).toBe('2026-02-28');
    expect(addMonths('2026-12-15', 1)).toBe('2027-01-15');
  });
  it('addDays crosses month and year boundaries', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });
  it('weekStart returns the Sunday', () => {
    expect(weekStart('2026-11-15')).toBe('2026-11-15'); // อาทิตย์
    expect(weekStart('2026-11-18')).toBe('2026-11-15');
    expect(weekStart('2026-11-21')).toBe('2026-11-15');
  });
  it('toMin / minStr round-trip and evHours', () => {
    expect(toMin('09:30')).toBe(570);
    expect(minStr(570)).toBe('09:30');
    expect(evHours({ start: '09:00', end: '12:30' })).toBe(3.5);
    expect(evHours({ start: '12:00', end: '09:00' })).toBe(0);
  });
});

describe('layoutDay', () => {
  const ev = (id, start, end) => ({ id, start, end });
  it('keeps sequential events in one lane', () => {
    const out = layoutDay([ev('a', '09:00', '10:00'), ev('b', '10:00', '11:00')]);
    expect(out.map((x) => [x.lane, x.lanes])).toEqual([[0, 1], [0, 1]]);
  });
  it('puts overlapping events in separate lanes', () => {
    const out = layoutDay([ev('a', '09:00', '11:00'), ev('b', '10:00', '12:00'), ev('c', '10:30', '11:30')]);
    expect(Math.max(...out.map((x) => x.lanes))).toBe(3);
    expect(new Set(out.map((x) => x.lane)).size).toBe(3);
  });
  it('does not widen later non-overlapping events', () => {
    const out = layoutDay([ev('a', '09:00', '11:00'), ev('b', '10:00', '12:00'), ev('c', '13:00', '14:00')]);
    expect(out.find((x) => x.e.id === 'c').lanes).toBe(1);
  });
});

describe('readGoogleToken', () => {
  const jwt = (p) => 'x.' + Buffer.from(JSON.stringify(p)).toString('base64url') + '.y';
  const ok = { aud: 'cid', iss: 'https://accounts.google.com', exp: 2000, sub: '1', name: 'สมชาย', email: 'a@b.c', picture: 'https://x/y.png' };
  it('accepts a valid token', () => {
    expect(readGoogleToken(jwt(ok), 'cid', 1_000_000).name).toBe('สมชาย');
  });
  it('rejects wrong audience, issuer, expired token, or missing client id', () => {
    expect(() => readGoogleToken(jwt({ ...ok, aud: 'other' }), 'cid', 1_000_000)).toThrow();
    expect(() => readGoogleToken(jwt({ ...ok, iss: 'evil.example' }), 'cid', 1_000_000)).toThrow();
    expect(() => readGoogleToken(jwt(ok), 'cid', 3_000_000)).toThrow();
    expect(() => readGoogleToken(jwt(ok), '', 1_000_000)).toThrow();
  });
  it('drops non-https picture urls', () => {
    expect(readGoogleToken(jwt({ ...ok, picture: 'javascript:alert(1)' }), 'cid', 1_000_000).picture).toBeUndefined();
  });
});

import { bestWindow, eventsToCsv, filterEvents, hourBuckets, longestStreak, plantStage, rangeTotals, streakOf, weekdayAverages } from './stats.js';

import { copyDay, repeatDates } from './repeat.js';

describe('repeat and copy', () => {
  it('repeatDates handles daily, weekdays, weekly and caps the count', () => {
    expect(repeatDates('2026-11-16', 'weekly', 3)).toEqual(['2026-11-16', '2026-11-23', '2026-11-30']);
    expect(repeatDates('2026-11-13', 'weekdays', 3)).toEqual(['2026-11-13', '2026-11-16', '2026-11-17']); // ศ. แล้วข้ามส-อา
    expect(repeatDates('2026-11-16', 'daily', 2)).toEqual(['2026-11-16', '2026-11-17']);
    expect(repeatDates('2026-11-16', 'none', 5)).toEqual(['2026-11-16']);
    expect(repeatDates('2026-11-16', 'daily', 999).length).toBe(52);
  });
  it('copyDay copies without photos and skips entries already on the target day', () => {
    let n = 0; const id = () => 'n' + n++;
    const list = [
      { id: 'a', date: '2026-11-15', start: '09:00', end: '10:00', title: 'ประชุม', cat: 'sky', note: '', photos: [{ id: 'p', src: 'x' }] },
      { id: 'b', date: '2026-11-15', start: '13:00', end: '14:00', title: 'เขียนรายงาน', cat: 'meadow', note: '', photos: [] },
      { id: 'c', date: '2026-11-16', start: '09:00', end: '10:00', title: 'ประชุม', cat: 'sky', note: '', photos: [] },
    ];
    const r = copyDay(list, '2026-11-15', '2026-11-16', id);
    expect(r).toMatchObject({ skipped: 1, total: 2 });
    expect(r.fresh).toHaveLength(1);
    expect(r.fresh[0]).toMatchObject({ title: 'เขียนรายงาน', date: '2026-11-16', photos: [] });
    expect(r.fresh[0].id).not.toBe('b');
  });
});

describe('longestStreak', () => {
  it('finds the longest run, bridging weekends', () => {
    const by = { '2026-11-02': 1, '2026-11-03': 1, '2026-11-05': 1, '2026-11-06': 1, '2026-11-09': 1, '2026-11-10': 1 };
    expect(longestStreak(by)).toBe(4); // พ.5 ศ.6 (ข้ามส-อา) จ.9 อ.10
    expect(longestStreak({})).toBe(0);
  });
});

const ev = (date, start, end, cat = 'meadow', title = 't', note = '') => ({ id: date + start, date, start, end, cat, title, note });

describe('streakOf', () => {
  it('counts consecutive days and keeps a streak alive when today is still empty', () => {
    const by = { '2026-11-12': 2, '2026-11-13': 3 }; // พฤ. ศ.
    expect(streakOf(by, '2026-11-13')).toBe(2);
    expect(streakOf(by, '2026-11-14')).toBe(2); // เสาร์ยังไม่จด
  });
  it('lets an empty weekend pass without breaking or counting', () => {
    const by = { '2026-11-12': 1, '2026-11-13': 1, '2026-11-16': 1 }; // พฤ. ศ. จ.
    expect(streakOf(by, '2026-11-16')).toBe(3);
  });
  it('breaks on an empty weekday', () => {
    const by = { '2026-11-11': 1, '2026-11-13': 1 }; // พุธ แล้วข้ามพฤหัส
    expect(streakOf(by, '2026-11-13')).toBe(1);
  });
  it('is zero with no data or when the last entry is long ago', () => {
    expect(streakOf({}, '2026-11-16')).toBe(0);
    expect(streakOf({ '2026-11-10': 2 }, '2026-11-16')).toBe(0);
  });
});

describe('garden and totals', () => {
  it('maps hours to plant stages', () => {
    expect([0, 0.5, 2, 4, 6, 9].map(plantStage)).toEqual([0, 1, 2, 3, 4, 4]);
  });
  it('rangeTotals sums hours, days and categories inside the range', () => {
    const t = rangeTotals([ev('2026-11-02', '09:00', '11:00'), ev('2026-11-02', '13:00', '14:30', 'sky'), ev('2026-12-01', '09:00', '10:00')], '2026-11-01', '2026-11-30');
    expect(t).toMatchObject({ hours: 3.5, entries: 2, days: 1 });
    expect(t.cat).toEqual({ meadow: 2, sky: 1.5 });
  });
});

describe('filterEvents', () => {
  const list = [ev('2026-11-02', '09:00', '10:00', 'sky', 'ประชุมทีม', 'ทบทวนงาน'), ev('2026-11-03', '09:00', '10:00', 'meadow', 'Write Report', '')];
  it('matches title or note, ignoring case, and combines with categories', () => {
    expect(filterEvents(list, 'report', []).length).toBe(1);
    expect(filterEvents(list, 'ทบทวน', []).length).toBe(1);
    expect(filterEvents(list, '', ['sky']).length).toBe(1);
    expect(filterEvents(list, 'report', ['sky']).length).toBe(0);
    expect(filterEvents(list, '  ', [])).toBe(list);
  });
});

describe('hour-of-day analysis', () => {
  it('splits an event across the hours it covers', () => {
    const b = hourBuckets([ev('2026-11-02', '09:30', '11:15')], '2026-11-01', '2026-11-30');
    expect(b[9]).toBe(0.5); expect(b[10]).toBe(1); expect(b[11]).toBe(0.25);
  });
  it('finds the busiest window, or null with no data', () => {
    const b = hourBuckets([ev('2026-11-02', '09:00', '12:00'), ev('2026-11-03', '10:00', '11:00')], '2026-11-01', '2026-11-30');
    expect(bestWindow(b, 2)).toEqual({ start: 9, end: 11, hours: 3 });
    expect(bestWindow(new Array(24).fill(0))).toBeNull();
  });
  it('averages hours per weekday', () => {
    expect(weekdayAverages({ '2026-11-16': 4, '2026-11-23': 2 })[1]).toBe(3);
  });
});

describe('eventsToCsv', () => {
  it('writes a BOM, quotes cells and neutralises formulas', () => {
    const csv = eventsToCsv([ev('2026-11-02', '09:00', '10:30', 'sky', '=SUM(A1)', 'พูดว่า "สวัสดี"')], { sky: 'ประชุม' });
    expect(csv.startsWith('\ufeff')).toBe(true);
    expect(csv).toContain('"2026-11-02","09:00","10:30","1.5","ประชุม","\'=SUM(A1)","พูดว่า ""สวัสดี"""');
  });
});
