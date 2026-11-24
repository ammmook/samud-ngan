# สมุดงาน (samut-ngan)

แอปบันทึกงานรายวัน ภาษาไทย มีหน้าปฏิทิน (เดือน/สัปดาห์/วัน) หน้าสรุป (สถิติ, สวน, heatmap) เป้ารายวัน แม่แบบ รูปแนบ และส่งออกรายงานเป็นไฟล์ Word (.docx) รูปแบบ "บันทึกการปฏิบัติงาน" ฟอนต์ TH Sarabun PSK

## Stack
- Frontend: React 18 + Vite (`src/`) CSS ธรรมดา (`src/app.css`, `src/features.css`) design tokens/คอมโพเนนต์พื้นฐานใน `src/design-system/` (เรียกผ่าน `src/ds.js`: Button, Segmented, Icon, Toast, CATS ฯลฯ)
- Backend: Node http เขียนเอง ไม่ใช้ framework — routes ทั้งหมดอยู่ที่ `server/app.js`, `server/index.js` รันในเครื่อง, `api/index.js` สำหรับ Vercel (`vercel.json`), `server/security.js` เก็บ security headers/rate limit
- ฐานข้อมูล: Neon Postgres (`db/schema.sql`), รูปเก็บใน Neon object storage (ในฐานข้อมูลเก็บแค่ `storage_key`), ล็อกอินด้วย Neon Auth (Google) ตรวจ JWT ที่ฝั่งเซิร์ฟเวอร์ด้วย `jose`
- Word: ไลบรารี `docx` โหลดแบบ lazy ตอนกดส่งออกเท่านั้น
- โหมดผู้เยี่ยมชม (guest): เก็บทุกอย่างในเครื่อง (IndexedDB/localStorage) ไม่เรียกเซิร์ฟเวอร์ ยกเว้นโหลดหมวดหมู่

## คำสั่ง
- `npm run dev` รัน API (`npm run api`) กับ web (`vite --port 5175`) พร้อมกัน env อยู่ใน `.env.local` (ดู `.env.example`)
- `npm test` (vitest), `npm run lint` (eslint), `npm run build`
- `npm run db:migrate` รัน `db/schema.sql` เมื่อยังไม่มีตาราง แล้วรัน `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` สำหรับคอลัมน์ที่เพิ่มภายหลัง (รันซ้ำได้ ไม่แตะข้อมูลเดิม) ใช้ `DATABASE_URL_UNPOOLED`

## โครงสร้างสำคัญ
- `src/App.jsx` — ตรวจ auth, สลับ guest/Google, `Workspace` (โหลดและซิงก์บันทึก, toast, state โปรไฟล์ `person`), ลงชื่อออก/ลบบัญชี
- `src/pages/` — `CalendarPage`, `SummaryPage` (ส่งชื่อผู้ใช้/หัวหน้าต่อให้ `ReportDialog`), `Login`
- `src/components/` — `Sidebar` (แถบข้างบนเดสก์ท็อป + แถบบนพร้อม `AccountMenu` บนจอเล็ก), dialog ต่างๆ: `ReportDialog` (ส่งออก Word), `ProfileDialog` (จัดการโปรไฟล์), `DeleteAccountDialog`, `EventDialog`
- `src/lib/remote.js` — เรียก API (`loadProfile`, `putMe`, `saveProfile`, `deleteAccountData`) และตัวซิงก์ที่ส่งเฉพาะส่วนต่าง (มีช่วงเลิกทำ 8 วินาทีก่อนลบจริง)
- `src/lib/storage.js` — `pref/setPref` (localStorage ที่ไม่ throw), IndexedDB ของบันทึก, `clearUserData`
- `src/lib/wordReport.js` — `buildWordBlob({ who, supervisor, supervisorTitle, range, rows })` สร้าง .docx; จัดกลุ่ม สัปดาห์ → วัน → รายการ
- `server/app.js` — routes: `GET /api/auth/me`, `PUT /api/me`, `DELETE /api/me`, `GET /api/events`, `POST /api/sync`, `PUT /api/photos/:id`, `GET /api/categories`
- `server/app.test.js`, `src/lib/*.test.js` — เทสต์ (mock `pg` ไม่ต้องมีฐานข้อมูลจริง)

## โปรไฟล์ (จัดการโปรไฟล์) และการส่งออก Word
ผู้ใช้เปิดจากเมนูบัญชี → "จัดการโปรไฟล์" (`ProfileDialog`) กรอก 6 ช่อง ทุกช่องไม่เกิน 100 ตัวอักษร ปล่อยว่างได้:

| ช่อง | state (`person`) | คอลัมน์ `users` | localStorage (guest) | ไปอยู่ตรงไหนในไฟล์ Word |
|---|---|---|---|---|
| ชื่อ-สกุล | `fullName` | `full_name` | `sn-fullname` | บรรทัดหัวไฟล์ "ชื่อ-สกุล …" และในวงเล็บใต้ "ผู้ส่งมอบ" (ซ้าย) |
| งาน | `job` | `job` | `sn-job` | บรรทัดหัวไฟล์เดียวกัน ต่อจากชื่อ-สกุล: "งาน …" |
| กลุ่มงาน | `workGroup` | `work_group` | `sn-workgroup` | บรรทัดหัวไฟล์เดียวกัน: "กลุ่มงาน …" |
| ชื่อหัวหน้า | `supervisor` | `supervisor` | `sn-supervisor` | ในวงเล็บใต้ "ผู้ตรวจสอบ" (ขวา) |
| ตำแหน่งของหัวหน้า | `supervisorTitle` | `supervisor_title` | `sn-supervisor-title` | บรรทัด "ตำแหน่ง…" ใต้ผู้ตรวจสอบ |

กติกา:
- รูปแบบไฟล์ Word อิงแบบฟอร์ม "บันทึกการปฏิบัติงาน 2 หน้า": หัวกระดาษ 2 บรรทัด (ชื่อเดือน / ชื่อ-สกุล งาน กลุ่มงาน), ตารางงานที่รับผิดชอบ/ปริมาณงาน/หมายเหตุ, ท้ายตารางผู้ส่งมอบอยู่ซ้าย ผู้ตรวจสอบอยู่ขวา (บรรทัดตำแหน่งใต้ผู้ตรวจสอบเป็นส่วนที่เพิ่มเอง)
- ช่องที่ว่างใน Word แสดงเป็นเส้นประให้เขียนมือ ยกเว้นชื่อ-สกุลที่ถอยไปใช้ชื่อจากบัญชี Google (`user.name`) ถ้าไม่ได้กรอก (guest ไม่มีชื่อเลยก็ไม่ขึ้น)
- ชื่อ-สกุลที่กรอกจะแสดงแทนชื่อ Google ที่แถบข้าง/เมนูบัญชีด้วย (`displayName`)
- ผู้ใช้ Google: `saveProfile` → `PUT /api/me` (server ตรวจ string และ trim ยาวเกิน 100 → 400) แล้วค่อยเก็บลง localStorage; ถ้าเซิร์ฟเวอร์ล้ม dialog แสดงข้อผิดพลาดและไม่ปิด
- ตอน login `loadProfile` นำค่าจากเซิร์ฟเวอร์ลง localStorage เพื่อให้ส่วนอื่นอ่านผ่าน `pref` ได้
- ตอนออกจากระบบของผู้ใช้ Google ล้างทุกคีย์ของโปรไฟล์ เพื่อไม่ทิ้งชื่อไว้ให้คนถัดไปบนเครื่องเดียวกัน (guest ไม่ล้างเพราะเป็นข้อมูลของเครื่องนั้นเอง)
- เพิ่มฟิลด์โปรไฟล์ใหม่ต้องแก้ครบ: `db/schema.sql`, `ALTER` ใน `server/migrate.js`, ตาราง `profile()` และ `PUT /api/me` ใน `server/app.js` (รายการ `[key, column, label]`), `App.jsx` (`person`, `savePerson`, ตอน login, ตอนออกจากระบบ), `ProfileDialog`, props ผ่าน `SummaryPage` → `ReportDialog` → `buildWordBlob`, และเทสต์

## ข้อตกลง
- ข้อความ UI และคอมเมนต์เป็นภาษาไทย คงสไตล์เดิม (คอมเมนต์อธิบายเหตุผล ไม่ใช่อธิบายโค้ดตรงๆ)
- แก้ schema ต้องเพิ่มทั้งใน `db/schema.sql` (สำหรับฐานใหม่) และ `ALTER ... IF NOT EXISTS` ใน `server/migrate.js` (สำหรับฐานเดิม ซึ่ง migrate จะข้ามการรัน schema ถ้ามีตาราง `users` แล้ว) แล้วรัน `npm run db:migrate`
- ข้อมูลส่วนตัวห้ามไปอยู่ใน URL/query string; ลบบัญชีต้องลบแถว `users` (cascade ไป entries/photos) และลบไฟล์รูปหลัง commit
- การเรียก API ที่ต้องแจ้งผู้ใช้เมื่อล้ม (ลบบัญชี, บันทึกโปรไฟล์) ต้องไม่กลืน error ต่างจาก `putMe` ที่กลืนเงียบ
- Dialog ใช้รูปแบบเดิม: `scrim` + `dlg`, โฟกัสช่องแรกตอนเปิด, Esc ปิด, คืนโฟกัสตอนปิด
- ตั้งไฟล์เทสต์ข้างไฟล์เดิม (`*.test.js`) และรัน `npm test` + `npm run lint` ก่อนจบงาน
- `.env.local` เป็นความลับ ห้าม commit; `dist/` เป็นผลลัพธ์ build
