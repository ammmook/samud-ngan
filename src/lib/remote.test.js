import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSyncer, setTokenProvider, UNDO_GRACE_MS } from './remote.js';

const DATA_URL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
const SERVER_URL = 'https://files.test/u/1/x.png';

const ev = (over = {}) => ({ id: 'e1', date: '2026-11-16', start: '09:00', end: '10:00', cat: 'meadow', title: 'ประชุม', note: '', photos: [], ...over });

let calls, failNext;
// ขอบนอกที่ mock คือเครือข่าย (fetch) ตัวซิงก์ทำงานจริง
beforeEach(() => {
  calls = []; failNext = null;
  setTokenProvider(async () => 'tok');
  vi.stubGlobal('fetch', vi.fn(async (url, opt = {}) => {
    if (String(url).startsWith('data:')) return { blob: async () => new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' }) };
    const body = opt.body && typeof opt.body === 'string' ? JSON.parse(opt.body) : opt.body;
    calls.push({ url, method: opt.method, body, auth: opt.headers && opt.headers.authorization });
    if (failNext && failNext.test(url)) { const f = failNext; failNext = null; return { ok: false, status: 500, json: async () => ({ error: f.msg || 'fail' }) }; }
    return { ok: true, status: 200, json: async () => ({ ok: true }) };
  }));
});
afterEach(() => vi.unstubAllGlobals());

const syncCalls = () => calls.filter((c) => c.url === '/api/sync');

describe('createSyncer', () => {
  it('sends a bearer token on every request', async () => {
    const s = createSyncer(); s.init([]);
    await s.push([ev()]);
    expect(calls.every((c) => c.auth === 'Bearer tok')).toBe(true);
  });

  it('sends only new events and skips ones the server already has', async () => {
    const s = createSyncer(); s.init([ev()]);
    await s.push([ev(), ev({ id: 'e2' })]);
    const sent = syncCalls().flatMap((c) => c.body.upserts.map((u) => u.id));
    expect(sent).toEqual(['e2']);
  });

  it('makes no sync call when nothing changed', async () => {
    const s = createSyncer(); s.init([ev()]);
    expect(await s.push([ev()])).toBe(true);
    expect(calls).toHaveLength(0);
  });

  describe('deleting an event', () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it('waits out the undo window before telling the server', async () => {
      const s = createSyncer(); s.init([ev(), ev({ id: 'e2' })]);
      await s.push([ev()]);
      expect(calls).toHaveLength(0);
    });

    it('sends the delete on its own once the undo window has passed', async () => {
      const s = createSyncer(); s.init([ev(), ev({ id: 'e2' })]);
      await s.push([ev()]);
      await vi.advanceTimersByTimeAsync(UNDO_GRACE_MS + 100);
      expect(syncCalls()[0].body.deletes).toEqual(['e2']);
    });

    it('never deletes on the server when the user undoes within the window, so photos survive', async () => {
      const withPhoto = ev({ id: 'e2', photos: [{ id: 'p1', src: SERVER_URL }] });
      const s = createSyncer(); s.init([ev(), withPhoto]);
      await s.push([ev()]);
      await vi.advanceTimersByTimeAsync(UNDO_GRACE_MS / 2);
      await s.push([ev(), withPhoto]);
      await vi.advanceTimersByTimeAsync(UNDO_GRACE_MS * 2);
      expect(calls.filter((c) => c.body && c.body.deletes && c.body.deletes.length)).toHaveLength(0);
    });
  });

  it('uploads a new photo after the event exists and then links it', async () => {
    const s = createSyncer(); s.init([]);
    await s.push([ev({ photos: [{ id: 'p1', src: DATA_URL }] })]);
    const order = calls.map((c) => (c.url === '/api/sync' ? 'sync' : 'photo'));
    expect(order).toEqual(['sync', 'photo', 'sync']);
    expect(syncCalls()[1].body.upserts[0].photoIds).toEqual(['p1']);
  });

  it('does not re-upload a photo that came from the server', async () => {
    const s = createSyncer(); s.init([ev({ photos: [{ id: 'p1', src: SERVER_URL }] })]);
    await s.push([ev({ photos: [{ id: 'p1', src: SERVER_URL }], title: 'แก้หัวข้อ' })]);
    expect(calls.some((c) => c.url.startsWith('/api/photos'))).toBe(false);
  });

  it('returns false and retries the same change on the next push when the server fails', async () => {
    const s = createSyncer(); s.init([]);
    failNext = /sync/;
    expect(await s.push([ev()])).toBe(false);
    expect(await s.push([ev()])).toBe(true);
    expect(syncCalls().at(-1).body.upserts.map((u) => u.id)).toEqual(['e1']);
  });

  it('keeps pushes in order when two are started back to back', async () => {
    const s = createSyncer(); s.init([]);
    const a = s.push([ev()]);
    const b = s.push([ev(), ev({ id: 'e2' })]);
    await Promise.all([a, b]);
    const sent = syncCalls().flatMap((c) => c.body.upserts.map((u) => u.id));
    expect(sent).toEqual(['e1', 'e2']);
  });

  it('sends a rename of an event even when only the note changed', async () => {
    const s = createSyncer(); s.init([ev()]);
    await s.push([ev({ note: 'เพิ่มโน้ต' })]);
    expect(syncCalls()[0].body.upserts[0].note).toBe('เพิ่มโน้ต');
  });

  it('splits a large first import into batches the server accepts', async () => {
    const MAX_PER_SYNC = 200;
    const many = Array.from({ length: 450 }, (_, i) => ev({ id: 'e' + i }));
    const s = createSyncer(); s.init([]);
    await s.push(many);
    expect(syncCalls().every((c) => c.body.upserts.length <= MAX_PER_SYNC)).toBe(true);
  });
});
