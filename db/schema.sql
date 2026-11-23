-- สมุดงาน: สคีมา PostgreSQL (3 ตาราง)
-- ตอนนี้แอปเก็บทุกอย่างในเบราว์เซอร์ (IndexedDB/localStorage) ไฟล์นี้คือแบบสำหรับย้ายขึ้นฐานข้อมูลจริง
-- โหมดผู้เยี่ยมชม (guest) ยังเก็บในเครื่องเหมือนเดิม ไม่เข้าตารางเหล่านี้

-- ---------- up ----------

CREATE TABLE users (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  auth_id     text        NOT NULL UNIQUE,            -- sub ของ JWT จาก Neon Auth (neon_auth.user.id)
  email       text        NOT NULL,
  name        text        NOT NULL DEFAULT '',
  full_name   text        NOT NULL DEFAULT '' CHECK (length(full_name) <= 100),   -- ชื่อ-สกุลที่ใส่ในไฟล์ Word (ต่างจาก name ที่มาจาก Google)
  supervisor  text        NOT NULL DEFAULT '' CHECK (length(supervisor) <= 100),  -- ชื่อหัวหน้า ใส่ช่องผู้ตรวจสอบ
  supervisor_title text   NOT NULL DEFAULT '' CHECK (length(supervisor_title) <= 100),  -- ตำแหน่งของหัวหน้า ใส่ช่องตำแหน่งใต้ผู้ตรวจสอบ
  daily_goal  smallint    NOT NULL DEFAULT 6 CHECK (daily_goal BETWEEN 1 AND 12),  -- sn-goal
  templates   jsonb       NOT NULL DEFAULT '[]'
              CHECK (jsonb_typeof(templates) = 'array' AND jsonb_array_length(templates) <= 12),
              -- แม่แบบ [{id,title,cat,start,end,note}] ไม่เกิน 12 อัน อ่านทีเดียวทั้งชุด ไม่เคยค้นรายฟิลด์
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX users_email_key ON users (lower(email));

-- หมวดกลาง: ไม่ผูกกับผู้ใช้ ทุกคนอ่านชุดเดียวกัน (1 หมวด : หลายบันทึก)
-- เพิ่มหมวดใหม่ด้วยการ INSERT ตรงๆ ผู้ใช้เลือกใช้หมวดไหน ก็เก็บ id หมวดนั้นไว้ที่ entries.cat ของบันทึกนั้น
CREATE TABLE categories (
  id       text     PRIMARY KEY CHECK (length(id) BETWEEN 1 AND 64),
  label    text     NOT NULL CHECK (length(btrim(label)) BETWEEN 1 AND 40),
  palette  text     NOT NULL DEFAULT 'meadow' CHECK (palette IN ('meadow','sky','honey','orange','teal','blossom','lilac')),  -- ชุดสีที่ธีมมีให้
  position smallint NOT NULL DEFAULT 0
);
INSERT INTO categories (id, label, palette, position) VALUES
  ('meadow','งานหลัก','meadow',0), ('sky','ประชุม','sky',1), ('honey','ลงพื้นที่','honey',2),
  ('blossom','งานสร้างสรรค์','blossom',3), ('lilac','เรียนรู้','lilac',4), ('repair','งานซ่อม','orange',6);

CREATE TABLE entries (
  id          text        PRIMARY KEY CHECK (length(id) BETWEEN 1 AND 64),  -- uuid ที่ไคลเอนต์สร้าง (ใช้ upsert ตอนซิงก์)
  user_id     bigint      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  entry_date  date        NOT NULL,
  start_time  time        NOT NULL,
  end_time    time        NOT NULL,
  cat         text        NOT NULL DEFAULT 'meadow',
  title       text        NOT NULL CHECK (length(btrim(title)) > 0),
  note        text        NOT NULL DEFAULT '',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CHECK (end_time > start_time),
  -- ลบหมวดที่ยังมีบันทึกใช้อยู่ไม่ได้ ต้องย้ายบันทึกไปหมวดอื่นก่อน
  FOREIGN KEY (cat) REFERENCES categories (id) ON DELETE RESTRICT
);
CREATE INDEX entries_cat_idx ON entries (cat);  -- ให้ FK ตรวจตอนลบหมวดได้เร็ว
-- มุมมองเดือน/สัปดาห์/วัน, เป้ารายวัน, streak, สวน, รายงาน: ล้วนเป็น "ของ user ช่วงวันที่ เรียงตามเวลา"
CREATE INDEX entries_user_date_idx ON entries (user_id, entry_date, start_time);

CREATE TABLE entry_photos (
  id          text         PRIMARY KEY CHECK (length(id) BETWEEN 1 AND 64),
  entry_id    text         NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
  position    smallint     NOT NULL DEFAULT 0,
  storage_key text         NOT NULL UNIQUE,   -- คีย์ไฟล์ใน Neon object storage เช่น u/{user_id}/{uuid}.jpg (ไฟล์จริงไม่อยู่ใน DB)
  content_type text        NOT NULL DEFAULT 'image/jpeg',
  size_bytes  integer      NOT NULL CHECK (size_bytes > 0),
  created_at  timestamptz  NOT NULL DEFAULT now()
);
CREATE INDEX entry_photos_entry_idx ON entry_photos (entry_id, position);  -- รูปของบันทึกหนึ่งอัน เรียงตามลำดับ

-- updated_at ต้องอัปเดตเองตอนแก้ไข (DEFAULT now() ทำงานแค่ตอน insert)
CREATE FUNCTION set_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END $$;
CREATE TRIGGER entries_updated BEFORE UPDATE ON entries
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------- down ----------
-- DROP TRIGGER entries_updated ON entries;
-- DROP FUNCTION set_updated_at();
-- DROP TABLE entry_photos;   -- ลบรูปทั้งหมด ย้อนกลับไม่ได้
-- DROP TABLE entries;        -- ลบบันทึกทั้งหมด ย้อนกลับไม่ได้
-- DROP TABLE categories;
-- DROP TABLE users;
