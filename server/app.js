// API ของสมุดงาน: ตรวจ JWT จาก Neon Auth (Bearer) + บันทึกใน Postgres + รูปใน Neon object storage
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { SECURITY_HEADERS, clientIp, createRateLimiter } from './security.js';

// ลิงก์รูปต้องอยู่ได้นานกว่าช่วงที่เปิดแอปค้างไว้ ไม่งั้นรูปในหน้าเดิมจะพังหลังครบเวลา
// ลิงก์รูปเป็น bearer URL: ใครได้ลิงก์ก็ดูได้จนหมดอายุ จึงให้สั้น แล้วให้หน้าเว็บขอลิงก์ใหม่เป็นระยะ (ดู App.jsx)
const PHOTO_URL_TTL_S = 3600;
// Vercel Function รับ body ได้ไม่เกิน 4.5MB จึงตั้งเพดานรูปต่ำกว่านั้น (หน้าเว็บย่อรูปเหลือ ~1MB อยู่แล้ว)
const MAX_PHOTO = 4 * 1024 * 1024, MAX_JSON = 2 * 1024 * 1024, MAX_PHOTOS_PER_ENTRY = 20;
const MAX_USER_PHOTO_BYTES = 200 * 1024 * 1024; // โควตารูปรวมต่อผู้ใช้
const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
/* ดูชนิดไฟล์จากไบต์แรก ไม่เชื่อ Content-Type ที่ client ส่งมา */
const sniffImage = (b) => {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b.length >= 8 && b.subarray(0, 8).equals(PNG_SIG)) return 'image/png';
  if (b.length >= 12 && b.toString('latin1', 0, 4) === 'RIFF' && b.toString('latin1', 8, 12) === 'WEBP') return 'image/webp';
  return null;
};
// เวลาจบรับ 24:00 ได้ เพราะการลากบันทึกไปท้ายวันในตารางเวลาให้ค่านี้ (Postgres ชนิด time รับ 24:00)
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/, END_TIME = /^(([01]\d|2[0-3]):[0-5]\d|24:00)$/, DATE = /^\d{4}-\d{2}-\d{2}$/;
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
  if (!DATE.test(e.date) || !TIME.test(e.start) || !END_TIME.test(e.end)) throw bad('วันหรือเวลาไม่ถูกต้อง');
  if (e.end <= e.start) throw bad('เวลาจบต้องหลังเวลาเริ่ม');
  const title = str(e.title, 200, 'หัวข้อ').trim(); if (!title) throw bad('หัวข้อว่าง');
  const photoIds = Array.isArray(e.photoIds) ? e.photoIds : [];
  if (photoIds.length > MAX_PHOTOS_PER_ENTRY) throw bad('รูปมากเกินไป');
  return { id, date: e.date, start: e.start, end: e.end, cat: typeof e.cat === 'string' && e.cat && e.cat.length <= 64 ? e.cat : 'meadow', title, note: str(e.note ?? '', 5000, 'รายละเอียด'), photoIds: photoIds.map((p) => str(p, 64, 'รูป')) };
}

/* verifyToken(jwt) ต้อง throw ถ้า token ไม่ถูกต้อง/หมดอายุ และคืน payload (sub, email, name) เมื่อผ่าน */
/* createHandler คืนฟังก์ชัน (req, res) ใช้ได้ทั้งกับ http.createServer และ Vercel Function */
export function createHandler({ pool, files, verifyToken, distDir, rateLimit = {}, trustProxy = !!process.env.VERCEL }) {
  const limiter = createRateLimiter(rateLimit);
  const root = distDir && path.resolve(distDir);
  const rmFiles = (keys) => Promise.all(keys.map((k) => files.delete(k).catch(() => {})));

  /* ผู้ใช้จาก Neon Auth: token ผ่านแล้วสร้างแถวใน users ครั้งแรกที่เจอ (auth_id = sub ของ token) */
  async function requireUser(req) {
    const m = /^Bearer (\S+)$/.exec(req.headers.authorization || '');
    if (!m) throw new HttpError(401, 'ยังไม่ได้ลงชื่อเข้าใช้');
    let p;
    try { p = await verifyToken(m[1]); } catch { throw new HttpError(401, 'token ไม่ถูกต้องหรือหมดอายุ'); }
    if (!p || !p.sub || !p.email) throw new HttpError(401, 'token ไม่มีข้อมูลผู้ใช้');
    const found = await pool.query('SELECT id FROM users WHERE auth_id=$1', [String(p.sub)]);
    if (found.rowCount) return Number(found.rows[0].id);
    const ins = await pool.query(
      `INSERT INTO users (auth_id, email, name) VALUES ($1,$2,$3)
       ON CONFLICT (auth_id) DO UPDATE SET auth_id = EXCLUDED.auth_id RETURNING id`, [String(p.sub), p.email, p.name || '']);
    return Number(ins.rows[0].id);
  }
  const profile = (u) => ({ goal: u.daily_goal, templates: u.templates, fullName: u.full_name || '', supervisor: u.supervisor || '', supervisorTitle: u.supervisor_title || '', job: u.job || '', workGroup: u.work_group || '' });
  const getUser = async (uid) => {
    const { rows } = await pool.query('SELECT * FROM users WHERE id=$1', [uid]);
    if (!rows.length) throw new HttpError(401, 'ไม่พบบัญชี');
    return rows[0];
  };

  const routes = [
    ['GET', /^\/api\/auth\/me$/, async (req) => [200, profile(await getUser(await requireUser(req)))]],
    ['PUT', /^\/api\/me$/, async (req) => {
      const uid = await requireUser(req), b = await readJson(req);
      if (b.goal !== undefined) {
        if (!Number.isInteger(b.goal) || b.goal < 1 || b.goal > 12) throw bad('เป้าต้องอยู่ระหว่าง 1 ถึง 12');
        await pool.query('UPDATE users SET daily_goal=$2 WHERE id=$1', [uid, b.goal]);
      }
      for (const [k, col, label] of [['fullName', 'full_name', 'ชื่อ-สกุล'], ['supervisor', 'supervisor', 'ชื่อหัวหน้า'], ['supervisorTitle', 'supervisor_title', 'ตำแหน่งหัวหน้า'], ['job', 'job', 'งาน'], ['workGroup', 'work_group', 'กลุ่มงาน']]) {
        if (b[k] === undefined) continue;
        if (typeof b[k] !== 'string' || b[k].trim().length > 100) throw bad(label + 'ต้องไม่เกิน 100 ตัวอักษร');
        await pool.query(`UPDATE users SET ${col}=$2 WHERE id=$1`, [uid, b[k].trim()]);
      }
      if (b.templates !== undefined) {
        if (!Array.isArray(b.templates) || b.templates.length > 12) throw bad('แม่แบบไม่ถูกต้อง');
        const t = b.templates.map((x) => {
          if (!x || !TIME.test(x.start) || !END_TIME.test(x.end)) throw bad('แม่แบบไม่ถูกต้อง');
          return { id: str(x.id, 64, 'id'), title: str(x.title, 200, 'หัวข้อ'), cat: typeof x.cat === 'string' ? x.cat.slice(0, 64) : 'meadow', start: x.start, end: x.end, note: str(x.note ?? '', 5000, 'รายละเอียด') };
        });
        await pool.query('UPDATE users SET templates=$2::jsonb WHERE id=$1', [uid, JSON.stringify(t)]);
      }
      return [200, { ok: true }];
    }],
    // ลบข้อมูลของผู้ใช้ทั้งหมด (บันทึก รูป แม่แบบ แถวผู้ใช้) ไม่ลบตัวตนใน Neon Auth ซึ่งอยู่นอกฐานข้อมูลของแอป
    ['DELETE', /^\/api\/me$/, async (req) => {
      const uid = await requireUser(req);
      let keys;
      const c = await pool.connect();
      try {
        await c.query('BEGIN');
        keys = (await c.query('SELECT p.storage_key FROM entry_photos p JOIN entries e ON e.id=p.entry_id WHERE e.user_id=$1', [uid])).rows.map((r) => r.storage_key);
        await c.query('DELETE FROM users WHERE id=$1', [uid]); // ON DELETE CASCADE ลบ entries และ entry_photos
        await c.query('COMMIT');
      } catch (err) { await c.query('ROLLBACK'); throw err; } finally { c.release(); }
      await rmFiles(keys); // ลบไฟล์หลัง commit เหมือน /api/sync
      return [200, { ok: true, deletedPhotos: keys.length }];
    }],
    // หมวดกลาง อ่านอย่างเดียว (ไม่ผูกผู้ใช้ ไม่มีข้อมูลส่วนตัว) เพิ่มหมวดด้วยการ INSERT ลงตาราง categories
    // ให้ CDN/เบราว์เซอร์แคชสั้นๆ เพราะเรียกได้โดยไม่ต้องลงชื่อเข้าใช้ ลดภาระฐานข้อมูล
    ['GET', /^\/api\/categories$/, async () => {
      const { rows } = await pool.query('SELECT id, label, palette FROM categories ORDER BY position, label');
      return [200, rows, { 'cache-control': 'public, max-age=60, s-maxage=300' }];
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
      for (const e of rows) e.photos = await Promise.all(e.photos.map(async (p) => ({ id: p.id, src: await files.url(p.key, { expiresIn: PHOTO_URL_TTL_S }) })));
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
            `UPDATE entry_photos p SET position = (t.i - 1)::smallint FROM unnest($2::text[]) WITH ORDINALITY AS t(id,i) WHERE p.id=t.id AND p.entry_id=$1`, [e.id, e.photoIds]);
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
      const used = await pool.query('SELECT COALESCE(sum(p.size_bytes),0)::bigint AS n FROM entry_photos p JOIN entries e ON e.id = p.entry_id WHERE e.user_id=$1', [uid]);
      const body = await readBody(req, MAX_PHOTO);
      if (!body.length) throw bad('ไฟล์ว่าง');
      if (Number(used.rows[0]?.n ?? 0) + body.length > MAX_USER_PHOTO_BYTES) throw new HttpError(413, 'พื้นที่เก็บรูปเต็ม ลบรูปเก่าที่ไม่ใช้ก่อน');
      if (sniffImage(body) !== type) return [415, { error: 'ไฟล์ไม่ใช่รูปตามชนิดที่ระบุ' }];
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
    if (!root || !['GET', 'HEAD'].includes(req.method)) return false;
    let f;
    try { f = path.resolve(root, '.' + decodeURIComponent(url.pathname)); } catch { return false; } // % ที่ถอดรหัสไม่ได้
    // ต้องอยู่ใต้ root จริงๆ (เติม path.sep กันโฟลเดอร์พี่น้องที่ชื่อขึ้นต้นเหมือนกัน เช่น dist-old)
    if (f !== root && !f.startsWith(root + path.sep)) return false;
    if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(root, 'index.html');
    if (!fs.existsSync(f)) return false;
    res.writeHead(200, { ...SECURITY_HEADERS, 'content-type': MIME[path.extname(f)] || 'application/octet-stream' });
    if (req.method === 'HEAD') res.end(); else fs.createReadStream(f).pipe(res);
    return true;
  }

  return async (req, res) => {
    const url = new URL(req.url, 'http://x');
    const send = (code, body, extra) => { res.writeHead(code, { ...SECURITY_HEADERS, 'content-type': 'application/json', 'cache-control': 'no-store', ...extra }); res.end(JSON.stringify(body)); };
    try {
      if (!url.pathname.startsWith('/api/')) { if (serveStatic(req, res, url)) return; return send(404, { error: 'not found' }); }
      // /api/health ไม่แตะฐานข้อมูลและไม่คืนข้อมูลภายใน เพื่อไม่ให้คนนอกใช้ยิงฐานข้อมูลได้
      if (url.pathname === '/api/health') return send(200, { ok: true });
      const wait = limiter(clientIp(req, trustProxy));
      if (wait) return send(429, { error: 'คำขอถี่เกินไป ลองใหม่ภายหลัง' }, { 'retry-after': String(wait) });
      for (const [method, re, fn] of routes) {
        const m = req.method === method && url.pathname.match(re);
        if (m) { const [code, body, extra] = await fn(req, m, url, res); return send(code, body, extra); }
      }
      send(404, { error: 'not found' });
    } catch (e) {
      // ข้อความของ Postgres มีชื่อตาราง/constraint จึงไม่ส่งออกไปให้ client
      const invalid = ['23514', '23502', '22007', '22P02', '22001', '23503'].includes(e.code);
      const code = e instanceof HttpError ? e.code : e.code === '23505' ? 409 : invalid ? 400 : 500;
      if (code === 500) console.error(e);
      const msg = e instanceof HttpError ? e.message : code === 409 ? 'ข้อมูลซ้ำกับที่มีอยู่' : invalid ? 'ข้อมูลไม่ถูกต้อง' : 'เซิร์ฟเวอร์ผิดพลาด';
      send(code, { error: msg });
    }
  };
}

export const createApp = (deps) => http.createServer(createHandler(deps));
