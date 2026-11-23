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
  // ฐานข้อมูลที่สร้างไว้ก่อนมีโปรไฟล์: เพิ่มคอลัมน์ (รันซ้ำได้)
  await client.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS full_name text NOT NULL DEFAULT '' CHECK (length(full_name) <= 100), ADD COLUMN IF NOT EXISTS supervisor text NOT NULL DEFAULT '' CHECK (length(supervisor) <= 100), ADD COLUMN IF NOT EXISTS supervisor_title text NOT NULL DEFAULT '' CHECK (length(supervisor_title) <= 100)");
  const t = await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY 1");
  console.log('tables:', t.rows.map((r) => r.table_name).join(', '));
} finally {
  await client.end();
}
