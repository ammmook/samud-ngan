import { beforeEach, describe, expect, it, vi } from 'vitest';

const getSession = vi.fn();
vi.mock('@neon/auth', () => ({ createAuthClient: () => ({ getSession, signIn: { social: vi.fn() }, signOut: vi.fn(async () => {}) }) }));

const { getToken, forgetToken, currentUser } = await import('./auth.js');

const SECONDS_PER_MINUTE = 60;
// JWT จำลอง: header.payload.signature (ฝั่งหน้าเว็บอ่านแค่ exp ไม่ตรวจลายเซ็น การตรวจลายเซ็นเป็นหน้าที่เซิร์ฟเวอร์)
const jwt = (expSec) => 'h.' + btoa(JSON.stringify({ exp: expSec })).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_') + '.s';
const nowSec = () => Math.floor(Date.now() / 1000);
const sessionWith = (token) => ({ data: { session: { token }, user: { id: 'u1', name: 'สมชาย', email: 'a@b.c', image: 'https://x/y.png' } }, error: null });

beforeEach(() => { forgetToken(); getSession.mockReset(); });

describe('getToken', () => {
  it('returns the jwt that the sdk places on session.token', async () => {
    const t = jwt(nowSec() + 15 * SECONDS_PER_MINUTE);
    getSession.mockResolvedValue(sessionWith(t));
    expect(await getToken()).toBe(t);
  });

  it('reuses the cached token while it is still valid', async () => {
    getSession.mockResolvedValue(sessionWith(jwt(nowSec() + 15 * SECONDS_PER_MINUTE)));
    await getToken(); await getToken();
    expect(getSession).toHaveBeenCalledTimes(1);
  });

  it('asks again when the cached token is about to expire', async () => {
    getSession.mockResolvedValue(sessionWith(jwt(nowSec() + 10)));
    await getToken(); await getToken();
    expect(getSession).toHaveBeenCalledTimes(2);
  });

  it('throws 401 when there is no session', async () => {
    getSession.mockResolvedValue({ data: null, error: null });
    await expect(getToken()).rejects.toMatchObject({ status: 401 });
  });

  it('throws 401 when session.token is an opaque string and not a jwt', async () => {
    getSession.mockResolvedValue(sessionWith('opaque-session-token'));
    await expect(getToken()).rejects.toMatchObject({ status: 401 });
  });
});

describe('currentUser', () => {
  it('returns null when signed out', async () => {
    getSession.mockResolvedValue({ data: null });
    expect(await currentUser()).toBeNull();
  });
  it('keeps https avatars and drops other schemes', async () => {
    getSession.mockResolvedValue({ data: { user: { id: 'u1', email: 'a@b.c', image: 'javascript:alert(1)' } } });
    expect((await currentUser()).picture).toBeUndefined();
  });
  it('falls back to the email when the name is missing', async () => {
    getSession.mockResolvedValue({ data: { user: { id: 'u1', email: 'a@b.c', name: '' } } });
    expect((await currentUser()).name).toBe('a@b.c');
  });
});
