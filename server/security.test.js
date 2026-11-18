import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from './app.js';
import { CSP, SECURITY_HEADERS, clientIp, createRateLimiter } from './security.js';

const deps = (over = {}) => ({
  pool: { query: vi.fn(async () => ({ rowCount: 0, rows: [] })), connect: vi.fn() },
  files: {}, verifyToken: vi.fn(async () => { throw new Error('no'); }), ...over,
});

let server, base, tmp;
const start = async (over) => { server = createApp(deps(over)); await new Promise((r) => server.listen(0, r)); base = 'http://localhost:' + server.address().port; };
beforeEach(() => { tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sn-')); });
afterEach(async () => { if (server) await new Promise((r) => server.close(r)); server = null; fs.rmSync(tmp, { recursive: true, force: true }); });

// fetch ปรับ path ให้ไม่ถูก normalize (%2F ต้องส่งไปตรงๆ)
const raw = (p) => fetch(base + p, { redirect: 'manual' });

describe('security headers', () => {
  it('sends security headers on api responses', async () => {
    await start();
    const r = await raw('/api/categories');
    for (const [k, v] of Object.entries(SECURITY_HEADERS)) expect(r.headers.get(k)).toBe(v);
  });
  it('sends security headers on static files', async () => {
    fs.mkdirSync(path.join(tmp, 'dist')); fs.writeFileSync(path.join(tmp, 'dist', 'index.html'), '<p>hi</p>');
    await start({ distDir: path.join(tmp, 'dist') });
    const r = await raw('/');
    expect(r.status).toBe(200);
    expect(r.headers.get('content-security-policy')).toBe(CSP);
  });
  it('keeps vercel.json headers identical to the ones the server sends', () => {
    const v = JSON.parse(fs.readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));
    const h = Object.fromEntries(v.headers[0].headers.map((x) => [x.key.toLowerCase(), x.value]));
    for (const [k, val] of Object.entries(SECURITY_HEADERS)) expect(h[k]).toBe(val);
    expect(h['strict-transport-security']).toBeTruthy();
  });
  it('forbids inline scripts and framing', () => {
    expect(CSP).toMatch(/script-src 'self'(;|$)/);
    expect(CSP).toContain("frame-ancestors 'none'");
  });
});

describe('static file serving', () => {
  beforeEach(async () => {
    fs.mkdirSync(path.join(tmp, 'dist')); fs.mkdirSync(path.join(tmp, 'dist-old'));
    fs.writeFileSync(path.join(tmp, 'dist', 'index.html'), 'INDEX');
    fs.writeFileSync(path.join(tmp, 'dist-old', 'secret.txt'), 'SECRET');
    fs.writeFileSync(path.join(tmp, 'outside.txt'), 'OUTSIDE');
    await start({ distDir: path.join(tmp, 'dist') });
  });
  it('serves index.html for unknown spa paths', async () => {
    expect(await (await raw('/some/page')).text()).toBe('INDEX');
  });
  it('does not serve a sibling folder whose name starts with the dist folder name', async () => {
    const r = await raw('/..%2Fdist-old%2Fsecret.txt');
    expect(await r.text()).not.toContain('SECRET');
  });
  it('does not serve files above the dist folder', async () => {
    const r = await raw('/..%2Foutside.txt');
    expect(await r.text()).not.toContain('OUTSIDE');
  });
  it('does not crash on a malformed percent escape', async () => {
    const r = await raw('/%E0%A4%A');
    expect(r.status).toBeLessThan(500);
  });
});

describe('error responses', () => {
  it('does not leak postgres error text', async () => {
    const pool = { query: vi.fn(async () => { throw Object.assign(new Error('violates check constraint "entries_check" on table "entries"'), { code: '23514' }); }), connect: vi.fn() };
    await start({ pool });
    const r = await raw('/api/categories');
    const body = await r.json();
    expect(r.status).toBe(400);
    expect(JSON.stringify(body)).not.toMatch(/entries|constraint/);
  });
  it('maps a unique violation to 409 instead of 500', async () => {
    const pool = { query: vi.fn(async () => { throw Object.assign(new Error('duplicate key value violates unique constraint "users_email_key"'), { code: '23505' }); }), connect: vi.fn() };
    await start({ pool });
    const r = await raw('/api/categories');
    expect(r.status).toBe(409);
    expect(JSON.stringify(await r.json())).not.toMatch(/users_email_key/);
  });
});

describe('health and categories', () => {
  it('answers /api/health without touching the database', async () => {
    const d = deps(); await start(d);
    const r = await raw('/api/health');
    expect(await r.json()).toEqual({ ok: true });
    expect(d.pool.query).not.toHaveBeenCalled();
  });
  it('lets categories be cached briefly', async () => {
    await start();
    expect((await raw('/api/categories')).headers.get('cache-control')).toMatch(/s-maxage=300/);
  });
});

describe('rate limiting', () => {
  it('returns 429 with retry-after once the limit is exceeded', async () => {
    await start({ rateLimit: { max: 3 } });
    const codes = [];
    for (let i = 0; i < 5; i++) codes.push((await raw('/api/categories')).status);
    expect(codes).toEqual([200, 200, 200, 429, 429]);
    const r = await raw('/api/categories');
    expect(Number(r.headers.get('retry-after'))).toBeGreaterThan(0);
  });
  it('does not rate limit the health check', async () => {
    await start({ rateLimit: { max: 1 } });
    for (let i = 0; i < 4; i++) expect((await raw('/api/health')).status).toBe(200);
  });
  it('limiter resets after the window passes', () => {
    let t = 0;
    const lim = createRateLimiter({ windowMs: 1000, max: 2, now: () => t });
    expect([lim('a'), lim('a'), lim('a')].map(Boolean)).toEqual([false, false, true]);
    expect(lim('b')).toBe(0);
    t = 1000;
    expect(lim('a')).toBe(0);
  });
  it('trusts x-forwarded-for only behind a trusted proxy', () => {
    const req = { headers: { 'x-forwarded-for': '1.2.3.4, 9.9.9.9' }, socket: { remoteAddress: '10.0.0.1' } };
    expect(clientIp(req, true)).toBe('1.2.3.4');
    expect(clientIp(req, false)).toBe('10.0.0.1');
  });
});
