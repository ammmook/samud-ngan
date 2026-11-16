// รัน db/schema.sql ด้วย connection แบบ direct (ไม่ผ่าน pooler) รันซ้ำได้ ถ้ามีตารางแล้วจะข้าม
import fs from 'node:fs';
import pg from 'pg';

const client = new pg.Client({ connectionString: process.env.DATABASE_URL_UNPOOLED });
await client.connect();
try {
  const { rows } = await client.query("SELECT to_regclass('public.users') AS t");
  if (rows[0].t) {
    console.log('ตารางมีอยู่แล้ว ข้าม migration');
  } else {
    const sql = fs.readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8');
    await client.query(sql);
    console.log('migration สำเร็จ');
  }
  const t = await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY 1");
  console.log('tables:', t.rows.map((r) => r.table_name).join(', '));
} finally {
  await client.end();
}
