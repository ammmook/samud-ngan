import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from './app.js';

const HTTP = { OK: 200, BAD_REQUEST: 400, UNAUTHORIZED: 401, NOT_FOUND: 404, UNSUPPORTED_MEDIA: 415 };
const USER_ID = '1';
const GOOD_TOKEN = 'good-token';
const MAX_UPSERTS_PER_SYNC = 200;
const MAX_TEMPLATES = 12;
const GOAL_MIN = 1, GOAL_MAX = 12;

const validEvent = (over = {}) => ({ id: 'e1', date: '2026-11-16', start: '09:00', end: '10:00', cat: 'meadow', title: 'ประชุม', note: '', photoIds: [], ...over });

// ขอบนอกที่ mock: ฐานข้อมูลและ object storage ส่วนโค้ดของแอป (app.js) ทำงานจริง
function fakes() {
  const query = vi.fn(async (sql) => {
    if (/FROM users WHERE auth_id/.test(sql)) return { rowCount: 1, rows: [{ id: USER_ID }] };
    if (/FROM users WHERE id/.test(sql)) return { rowCount: 1, rows: [{ id: USER_ID, daily_goal: 6, templates: [] }] };
    return { rowCount: 0, rows: [] };
  });
  const client = { query: vi.fn(async (sql) => (/RETURNING id/.test(sql) ? { rowCount: 1, rows: [{ id: 'e1' }] } : { rowCount: 0, rows: [] })), release: vi.fn() };
  const pool = { query, connect: vi.fn(async () => client) };
  const files = { upload: vi.fn(), delete: vi.fn(async () => {}), url: vi.fn(async (k) => 'https://files.test/' + k) };
  const verifyToken = vi.fn(async (t) => { if (t !== GOOD_TOKEN) throw new Error('bad token'); return { sub: 'auth-1', email: 'a@test.local', name: 'A' }; });
  return { pool, client, files, verifyToken };
}

let server, base, f;
beforeEach(async () => {
  f = fakes();
  server = createApp({ pool: f.pool, files: f.files, verifyToken: f.verifyToken });
  await new Promise((r) => server.listen(0, r));
  base = 'http://localhost:' + server.address().port;
});
afterEach(() => new Promise((r) => server.close(r)));

const call = (path, { token = GOOD_TOKEN, method = 'GET', body, headers } = {}) => fetch(base + path, {
  method,
  headers: { ...(token ? { authorization: 'Bearer ' + token } : {}), ...(body !== undefined ? { 'content-type': 'application/json' } : {}), ...headers },
  body: body === undefined ? undefined : JSON.stringify(body),
});

describe('authentication', () => {
  it('returns 401 when the request has no bearer token', async () => {
    expect((await call('/api/events', { token: null })).status).toBe(HTTP.UNAUTHORIZED);
  });
  it('returns 401 when the token fails verification', async () => {
    expect((await call('/api/events', { token: 'forged' })).status).toBe(HTTP.UNAUTHORIZED);
  });
  it('returns 401 when the token has no email claim', async () => {
    f.verifyToken.mockResolvedValueOnce({ sub: 'auth-1' });
    expect((await call('/api/events')).status).toBe(HTTP.UNAUTHORIZED);
  });
  it('does not touch the database when the token is rejected', async () => {
    await call('/api/events', { token: 'forged' });
    expect(f.pool.query).not.toHaveBeenCalled();
  });
  it('allows reading categories without a token because they hold no personal data', async () => {
    expect((await call('/api/categories', { token: null })).status).toBe(HTTP.OK);
  });
  it('returns 404 for an unknown api route', async () => {
    expect((await call('/api/nope')).status).toBe(HTTP.NOT_FOUND);
  });
});

describe('POST /api/sync validation', () => {
  const sync = (upserts, deletes = []) => call('/api/sync', { method: 'POST', body: { upserts, deletes } });

  it('accepts a valid event', async () => {
    expect((await sync([validEvent()])).status).toBe(HTTP.OK);
  });
  it('rejects an event that ends before it starts', async () => {
    expect((await sync([validEvent({ start: '10:00', end: '09:00' })])).status).toBe(HTTP.BAD_REQUEST);
  });
  it('rejects an event that ends exactly when it starts', async () => {
    expect((await sync([validEvent({ start: '09:00', end: '09:00' })])).status).toBe(HTTP.BAD_REQUEST);
  });
  it('rejects an event with a blank title', async () => {
    expect((await sync([validEvent({ title: '   ' })])).status).toBe(HTTP.BAD_REQUEST);
  });
  it('rejects a malformed date', async () => {
    expect((await sync([validEvent({ date: '16/11/2026' })])).status).toBe(HTTP.BAD_REQUEST);
  });
  it('accepts an event that ends at 24:00 because dragging an event to the end of the day produces it', async () => {
    expect((await sync([validEvent({ start: '23:00', end: '24:00' })])).status).toBe(HTTP.OK);
  });
  it('rejects an end time after 24:00', async () => {
    expect((await sync([validEvent({ end: '24:01' })])).status).toBe(HTTP.BAD_REQUEST);
  });
  it('rejects a start time of 24:00', async () => {
    expect((await sync([validEvent({ start: '24:00', end: '24:00' })])).status).toBe(HTTP.BAD_REQUEST);
  });
  it('rejects an event with an id longer than 64 characters', async () => {
    expect((await sync([validEvent({ id: 'x'.repeat(65) })])).status).toBe(HTTP.BAD_REQUEST);
  });
  it('rejects more upserts than one sync may carry', async () => {
    const many = Array.from({ length: MAX_UPSERTS_PER_SYNC + 1 }, (_, i) => validEvent({ id: 'e' + i }));
    expect((await sync(many)).status).toBe(HTTP.BAD_REQUEST);
  });
  it('rejects more than 20 photos on one event', async () => {
    expect((await sync([validEvent({ photoIds: Array.from({ length: 21 }, (_, i) => 'p' + i) })])).status).toBe(HTTP.BAD_REQUEST);
  });
  it('rejects a body that is not valid json', async () => {
    const r = await fetch(base + '/api/sync', { method: 'POST', headers: { authorization: 'Bearer ' + GOOD_TOKEN, 'content-type': 'application/json' }, body: '{oops' });
    expect(r.status).toBe(HTTP.BAD_REQUEST);
  });
  it('rolls the transaction back and rethrows when a statement fails', async () => {
    f.client.query.mockImplementation(async (sql) => { if (/INSERT INTO entries/.test(sql)) throw Object.assign(new Error('boom'), { code: 'XX000' }); return { rowCount: 0, rows: [] }; });
    const r = await sync([validEvent()]);
    expect(r.status).toBe(500);
    expect(f.client.query).toHaveBeenCalledWith('ROLLBACK');
    expect(f.client.release).toHaveBeenCalled();
  });
  it('maps a foreign key violation (unknown category) to 400', async () => {
    f.client.query.mockImplementation(async (sql) => { if (/INSERT INTO entries/.test(sql)) throw Object.assign(new Error('fk'), { code: '23503' }); return { rowCount: 0, rows: [] }; });
    expect((await sync([validEvent({ cat: 'no-such' })])).status).toBe(HTTP.BAD_REQUEST);
  });
  it('deletes bucket files only after the database transaction commits', async () => {
    const order = [];
    f.client.query.mockImplementation(async (sql) => {
      order.push(sql.split(/\s/)[0]);
      if (/storage_key FROM entry_photos p JOIN/.test(sql)) return { rowCount: 1, rows: [{ storage_key: 'u/1/a.png' }] };
      return { rowCount: 0, rows: [] };
    });
    f.files.delete.mockImplementation(async () => { order.push('FILE_DELETE'); });
    await sync([], ['e1']);
    expect(order.indexOf('COMMIT')).toBeLessThan(order.indexOf('FILE_DELETE'));
  });
});

describe('PUT /api/me validation', () => {
  const put = (body) => call('/api/me', { method: 'PUT', body });
  it('rejects a daily goal below the minimum', async () => { expect((await put({ goal: GOAL_MIN - 1 })).status).toBe(HTTP.BAD_REQUEST); });
  it('rejects a daily goal above the maximum', async () => { expect((await put({ goal: GOAL_MAX + 1 })).status).toBe(HTTP.BAD_REQUEST); });
  it('rejects a non-integer daily goal', async () => { expect((await put({ goal: 6.5 })).status).toBe(HTTP.BAD_REQUEST); });
  it('accepts the boundary goals', async () => {
    expect((await put({ goal: GOAL_MIN })).status).toBe(HTTP.OK);
    expect((await put({ goal: GOAL_MAX })).status).toBe(HTTP.OK);
  });
  it('rejects more templates than the limit', async () => {
    const t = Array.from({ length: MAX_TEMPLATES + 1 }, (_, i) => ({ id: 't' + i, title: 'x', cat: 'sky', start: '09:00', end: '10:00', note: '' }));
    expect((await put({ templates: t })).status).toBe(HTTP.BAD_REQUEST);
  });
  it('rejects a template with a malformed time', async () => {
    expect((await put({ templates: [{ id: 't', title: 'x', cat: 'sky', start: '9am', end: '10:00', note: '' }] })).status).toBe(HTTP.BAD_REQUEST);
  });
});

describe('PUT /api/photos/:id', () => {
  it('returns 415 when the content type is not an image', async () => {
    const r = await fetch(base + '/api/photos/p1?entry=e1', { method: 'PUT', headers: { authorization: 'Bearer ' + GOOD_TOKEN, 'content-type': 'text/html' }, body: '<script>' });
    expect(r.status).toBe(HTTP.UNSUPPORTED_MEDIA);
    expect(f.files.upload).not.toHaveBeenCalled();
  });
  it('returns 404 when the entry does not belong to the caller', async () => {
    const r = await fetch(base + '/api/photos/p1?entry=someone-elses', { method: 'PUT', headers: { authorization: 'Bearer ' + GOOD_TOKEN, 'content-type': 'image/png' }, body: new Uint8Array([1, 2, 3]) });
    expect(r.status).toBe(HTTP.NOT_FOUND);
    expect(f.files.upload).not.toHaveBeenCalled();
  });
});
