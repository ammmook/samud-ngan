// การเชื่อมต่อ Neon: Postgres (pooled) และ object storage (bucket "assets")
// ค่าทั้งหมดมาจาก env ที่ `neon deploy` ดึงลง .env.local (รันเซิร์ฟเวอร์ด้วย node --env-file=.env.local)
import pg from 'pg';
import { Files } from 'files-sdk';
import { neon } from 'files-sdk/neon';

export const BUCKET = 'assets';

// DATABASE_URL เป็นแบบ pooled ใช้กับคำสั่งทั่วไป
export const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 5 });

// AWS_* ถูกอ่านจาก env อัตโนมัติ ส่งแค่ชื่อ bucket
export const files = new Files({ adapter: neon({ bucket: BUCKET }) });
