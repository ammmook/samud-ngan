// API ของสมุดงาน: ลงชื่อเข้าใช้ Google (ตรวจ ID token ที่เซิร์ฟเวอร์) + บันทึกใน Postgres + รูปใน Neon object storage
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { clearCookie, cookieValue, COOKIE, readSession, setCookie, signSession } from './session.js';

const CATS = ['meadow', 'sky', 'honey', 'blossom', 'lilac'];
const MAX_PHOTO = 5 * 1024 * 1024, MAX_JSON = 2 * 1024 * 1024, MAX_PHOTOS_PER_ENTRY = 20;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/, DATE = /^\d{4}-\d{2}-\d{2}$/;
const PHOTO_EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json', '.png': 'image/png', '.ico': 'image/x-icon' };

class HttpError extends Error { constructor(code, msg) { super(msg); this.code = code; } }
const bad = (msg) => new HttpError(400, msg);

async function readBody(req, limit) {
  const chunks = []; let n = 0;
  for await (const c of req) { n += c.length; if (n > limit) throw new HttpError(413, 'ไฟล์ใหญ่เกินไป'); chunks.push(c); }
  return Buffer.concat(chunks);
}
const readJson = async (req) => { try { return JSON.parse((await readBody(req, MAX_JSON)).toString() || '{}'); } catch (e) { if (e instanceof HttpError) throw e; throw bad('JSON ไม่ถูกต้อง'); } };

const str = (v, max, name) => { if (typeof v !== 'string' || v.length > max) throw bad(name + ' ไม่ถูกต้อง'); return v; };
function checkEvent(e) {
  if (!e || typeof e !== 'object') throw bad('บันทึกไม่ถูกต้อง');
  const id = str(e.id, 64, 'id'); if (!id) throw bad('id ว่าง');
  if (!DATE.test(e.date) || !TIME.test(e.start) || !TIME.test(e.end)) throw bad('วันหรือเวลาไม่ถูกต้อง');
  if (e.end <= e.start) throw bad('เวลาจบต้องหลังเวลาเริ่ม');
  const title = str(e.title, 200, 'หัวข้อ').trim(); if (!title) throw bad('หัวข้อว่าง');
  const photoIds = Array.isArray(e.photoIds) ? e.photoIds : [];
  if (photoIds.length > MAX_PHOTOS_PER_ENTRY) throw bad('รูปมากเกินไป');
  return { id, date: e.date, start: e.start, end: e.end, cat: CATS.includes(e.cat) ? e.cat : 'meadow', title, note: str(e.note ?? '', 5000, 'รายละเอียด'), photoIds: photoIds.map((p) => str(p, 64, 'รูป')) };
}

export function createApp({ pool, files, verifyGoogle, sessionSecret, distDir }) {
  if (!sessionSecret || sessionSecret.length < 32) throw new Error('SESSION_SECRET ต้องยาวอย่างน้อย 32 ตัวอักษร');
  const isSecure = (req) => process.env.NODE_ENV === 'production' || req.headers['x-forwarded-proto'] === 'https';
  const rmFiles = (keys) => Promise.all(keys.map((k) => files.delete(k).catch(() => {})));

  async function requireUser(req) {
    const uid = readSession(sessionSecret, cookieValue(req.headers.cookie, COOKIE));
    if (uid == null) throw new HttpError(401, 'ยังไม่ได้ลงชื่อเข้าใช้');
    return uid;
  }
  const profile = (u) => ({ sub: u.google_sub, name: u.name || u.email, email: u.email, picture: u.picture || undefined, goal: u.daily_goal, templates: u.templates });
  const getUser = async (uid) => {
    const { rows } = await pool.query('SELECT * FROM users WHERE id=$1', [uid]);
    if (!rows.length) throw new HttpError(401, 'ไม่พบบัญชี');
    return rows[0];
  };

  const routes = [
    ['POST', /^\/api\/auth\/google$/, async (req, _m, _url, res) => {
      const { credential } = await readJson(req);
      if (typeof credential !== 'string' || credential.length > 4096) throw bad('credential ไม่ถูกต้อง');
      let p;
      try { p = await verifyGoogle(credential); } catch { throw new HttpError(401, 'ยืนยันตัวตนกับ Google ไม่สำเร็จ'); }
      if (!p || !p.sub || !p.email || p.email_verified === false) throw new HttpError(401, 'บัญชี Google ไม่มีอีเมลที่ยืนยันแล้ว');
      const pic = typeof p.picture === 'string' && p.picture.startsWith('https://') ? p.picture : null;
      const { rows } = await pool.query(
        `INSERT INTO users (google_sub, email, name, picture) VALUES ($1,$2,$3,$4)
         ON CONFLICT (google_sub) DO UPDATE SET email=EXCLUDED.email, name=EXCLUDED.name, picture=EXCLUDED.picture RETURNING *`,
        [String(p.sub), p.email, p.name || '', pic]);
      res.setHeader('set-cookie', setCookie(signSession(sessionSecret, Number(rows[0].id)), isSecure(req)));
      return [200, profile(rows[0])];
    }],
    ['POST', /^\/api\/auth\/logout$/, async (req, _m, _url, res) => { res.setHeader('set-cookie', clearCookie(isSecure(req))); return [200, { ok: true }]; }],
    ['GET', /^\/api\/auth\/me$/, async (req) => [200, profile(await getUser(await requireUser(req)))]],
    ['PUT', /^\/api\/me$/, async (req) => {
      const uid = await requireUser(req), b = await readJson(req);
      if (b.goal !== undefined) {
        if (!Number.isInteger(b.goal) || b.goal < 1 || b.goal > 12) throw bad('เป้าต้องอยู่ระหว่าง 1 ถึง 12');
        await pool.query('UPDATE users SET daily_goal=$2 WHERE id=$1', [uid, b.goal]);
      }
      if (b.templates !== undefined) {
        if (!Array.isArray(b.templates) || b.templates.length > 12) throw bad('แม่แบบไม่ถูกต้อง');
        const t = b.templates.map((x) => {
          if (!x || !TIME.test(x.start) || !TIME.test(x.end)) throw bad('แม่แบบไม่ถูกต้อง');
          return { id: str(x.id, 64, 'id'), title: str(x.title, 200, 'หัวข้อ'), cat: CATS.includes(x.cat) ? x.cat : 'meadow', start: x.start, end: x.end, note: str(x.note ?? '', 5000, 'รายละเอียด') };
        });
        await pool.query('UPDATE users SET templates=$2::jsonb WHERE id=$1', [uid, JSON.stringify(t)]);
      }
      return [200, { ok: true }];
    }],
    ['GET', /^\/api\/events$/, async (req) => {
      const uid = await requireUser(req);
      const { rows } = await pool.query(
        `SELECT e.id, e.entry_date::text AS date, to_char(e.start_time,'HH24:MI') AS start, to_char(e.end_time,'HH24:MI') AS "end",
                e.cat, e.title, e.note,
                COALESCE(json_agg(json_build_object('id', p.id, 'key', p.storage_key) ORDER BY p.position) FILTER (WHERE p.id IS NOT NULL), '[]') AS photos
           FROM entries e LEFT JOIN entry_photos p ON p.entry_id = e.id
          WHERE e.user_id = $1 GROUP BY e.id ORDER BY e.entry_date, e.start_time`, [uid]);
      // รูปเป็นลิงก์ presigned ชั่วคราว (ผูกลายเซ็นในเครื่อง ไม่ต้องเรียกเครือข่ายเพิ่ม)
      for (const e of rows) e.photos = await Promise.all(e.photos.map(async (p) => ({ id: p.id, src: await files.url(p.key, { expiresIn: 3600 }) })));
      return [200, rows];
    }],
    ['POST', /^\/api\/sync$/, async (req) => {
      const uid = await requireUser(req), b = await readJson(req);
      const ups = (Array.isArray(b.upserts) ? b.upserts : []).map(checkEvent);
      const dels = (Array.isArray(b.deletes) ? b.deletes : []).map((d) => str(d, 64, 'id'));
      if (ups.length > 200 || dels.length > 500) throw bad('ส่งครั้งละมากเกินไป');
      const orphan = [];
      const c = await pool.connect();
      try {
        await c.query('BEGIN');
        if (dels.length) {
          const k = await c.query(`SELECT p.storage_key FROM entry_photos p JOIN entries e ON e.id=p.entry_id WHERE e.user_id=$1 AND e.id = ANY($2)`, [uid, dels]);
          orphan.push(...k.rows.map((r) => r.storage_key));
          await c.query('DELETE FROM entries WHERE user_id=$1 AND id = ANY($2)', [uid, dels]);
        }
        for (const e of ups) {
          const r = await c.query(
            `INSERT INTO entries (id,user_id,entry_date,start_time,end_time,cat,title,note) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
             ON CONFLICT (id) DO UPDATE SET entry_date=EXCLUDED.entry_date, start_time=EXCLUDED.start_time, end_time=EXCLUDED.end_time,
               cat=EXCLUDED.cat, title=EXCLUDED.title, note=EXCLUDED.note WHERE entries.user_id = EXCLUDED.user_id RETURNING id`,
            [e.id, uid, e.date, e.start, e.end, e.cat, e.title, e.note]);
          if (!r.rowCount) throw new HttpError(409, 'id ซ้ำกับของผู้อื่น');
          const gone = await c.query('DELETE FROM entry_photos WHERE entry_id=$1 AND NOT (id = ANY($2)) RETURNING storage_key', [e.id, e.photoIds]);
          orphan.push(...gone.rows.map((x) => x.storage_key));
          if (e.photoIds.length) await c.query(
            `UPDATE entry_photos p SET position = t.i::smallint FROM unnest($2::text[]) WITH ORDINALITY AS t(id,i) WHERE p.id=t.id AND p.entry_id=$1`, [e.id, e.photoIds]);
        }
        await c.query('COMMIT');
      } catch (err) { await c.query('ROLLBACK'); throw err; } finally { c.release(); }
      await rmFiles(orphan); // ON DELETE CASCADE ลบแค่แถว ไฟล์ใน bucket ต้องลบเอง
      return [200, { ok: true }];
    }],
    ['PUT', /^\/api\/photos\/([\w-]{1,64})$/, async (req, m, url) => {
      const uid = await requireUser(req);
      const type = (req.headers['content-type'] || '').split(';')[0];
      if (!PHOTO_EXT[type]) return [415, { error: 'รองรับเฉพาะ jpeg, png, webp' }];
      const entryId = url.searchParams.get('entry') || '';
      const own = await pool.query('SELECT 1 FROM entries WHERE id=$1 AND user_id=$2', [entryId, uid]);
      if (!own.rowCount) return [404, { error: 'ไม่พบบันทึก' }];
      const have = await pool.query('SELECT 1 FROM entry_photos WHERE id=$1 AND entry_id=$2', [m[1], entryId]);
      if (have.rowCount) return [200, { ok: true, existed: true }];
      const cnt = await pool.query('SELECT count(*)::int n FROM entry_photos WHERE entry_id=$1', [entryId]);
      if (cnt.rows[0].n >= MAX_PHOTOS_PER_ENTRY) throw bad('รูปมากเกินไป');
      const body = await readBody(req, MAX_PHOTO);
      if (!body.length) throw bad('ไฟล์ว่าง');
      const key = `u/${uid}/${randomUUID()}.${PHOTO_EXT[type]}`;
      await files.upload(key, body, { contentType: type });
      try {
        await pool.query(
          `INSERT INTO entry_photos (id, entry_id, position, storage_key, content_type, size_bytes)
           VALUES ($1,$2,$3,$4,$5,$6)`, [m[1], entryId, cnt.rows[0].n, key, type, body.length]);
      } catch (err) { await files.delete(key).catch(() => {}); throw err; }
      return [201, { ok: true }];
    }],
  ];

  function serveStatic(req, res, url) {
    if (!distDir || !['GET', 'HEAD'].includes(req.method)) return false;
    let f = path.join(distDir, path.normalize(decodeURIComponent(url.pathname)));
    if (!f.startsWith(distDir)) return false;
    if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(distDir, 'index.html');
    if (!fs.existsSync(f)) return false;
    res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' });
    fs.createReadStream(f).pipe(res);
    return true;
  }

  return http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://x');
    const send = (code, body) => { res.writeHead(code, { 'content-type': 'application/json', 'cache-control': 'no-store' }); res.end(JSON.stringify(body)); };
    try {
      if (!url.pathname.startsWith('/api/')) { if (serveStatic(req, res, url)) return; return send(404, { error: 'not found' }); }
      // กัน CSRF: คำขอที่แก้ข้อมูลต้องมาจากหน้าเว็บของเราเอง (Origin ตรงกับ Host)
      if (!['GET', 'HEAD'].includes(req.method) && req.headers.origin) {
        let h = ''; try { h = new URL(req.headers.origin).host; } catch { /* ว่าง */ }
        if (h !== req.headers.host) throw new HttpError(403, 'origin ไม่ถูกต้อง');
      }
      if (url.pathname === '/api/health') { const { rows } = await pool.query('SELECT now() AS now'); return send(200, { ok: true, db: rows[0].now }); }
      for (const [method, re, fn] of routes) {
        const m = req.method === method && url.pathname.match(re);
        if (m) { const [code, body] = await fn(req, m, url, res); return send(code, body); }
      }
      send(404, { error: 'not found' });
    } catch (e) {
      const pg = ['23514', '23502', '22007', '22P02', '22001'].includes(e.code);
      const code = e instanceof HttpError ? e.code : pg ? 400 : 500;
      if (code === 500) console.error(e);
      send(code, { error: code === 500 ? 'เซิร์ฟเวอร์ผิดพลาด' : e.message });
    }
  });
}
