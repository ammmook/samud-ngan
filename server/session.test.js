import { describe, expect, it } from 'vitest';
import { cookieValue, readSession, signSession } from './session.js';

const S = 'x'.repeat(40);

describe('session', () => {
  it('ลงนามแล้วอ่านกลับได้', () => {
    expect(readSession(S, signSession(S, 7, 1_000), 2_000)).toBe(7);
  });
  it('ปฏิเสธเมื่อหมดอายุ ลายเซ็นผิด secret ผิด หรือถูกแก้', () => {
    const t = signSession(S, 7, 1_000);
    expect(readSession(S, t, 1_000 + 31 * 24 * 3600 * 1000)).toBeNull();
    expect(readSession(S, t.slice(0, -2) + 'xx', 2_000)).toBeNull();
    expect(readSession('y'.repeat(40), t, 2_000)).toBeNull();
    const [d, sig] = t.split('.');
    const forged = Buffer.from(JSON.stringify({ uid: 8, exp: 9e9 })).toString('base64url');
    expect(readSession(S, forged + '.' + sig, 2_000)).toBeNull();
    expect(d).toBeTruthy();
    expect(readSession(S, 'junk', 2_000)).toBeNull();
    expect(readSession(S, undefined, 2_000)).toBeNull();
  });
  it('อ่านค่า cookie', () => {
    expect(cookieValue('a=1; sn_session=abc%3D; b=2', 'sn_session')).toBe('abc=');
    expect(cookieValue('a=1', 'sn_session')).toBeNull();
  });
});
