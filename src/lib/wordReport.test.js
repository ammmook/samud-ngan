import { describe, expect, it } from 'vitest';
import { strFromU8, unzipSync } from 'fflate';
import { buildWordBlob, groupWeeks, qty, titleFor } from './wordReport.js';

const ev = (id, date, start, end, title, note = '') => ({ id, date, start, end, title, note });
const rows = [
  ev(1, '2026-11-02', '09:00', '17:00', 'เรียนรู้ระบบงาน'),
  ev(2, '2026-11-03', '09:00', '13:00', 'ถ่ายรูปประชาสัมพันธ์', 'โน้ตลับ'),
  ev(3, '2026-11-03', '13:00', '13:15', 'รับหนังสือ'),
  ev(4, '2026-11-12', '09:00', '10:30', 'ประชุมคณะกรรมการ'),
];
const range = { from: '2026-11-01', to: '2026-11-30' };

describe('wordReport helpers', () => {
  it('qty uses minutes under an hour, hours otherwise', () => {
    expect(qty(0.25)).toEqual({ n: '15', unit: 'นาที' });
    expect(qty(1.5)).toEqual({ n: '1.5', unit: 'ชั่วโมง' });
    expect(qty(8)).toEqual({ n: '8', unit: 'ชั่วโมง' });
  });
  it('groupWeeks groups by Monday-week then day, in order', () => {
    const w = groupWeeks([...rows].reverse());
    expect(w).toHaveLength(2);
    expect(w[0].days.map((d) => d.date)).toEqual(['2026-11-02', '2026-11-03']);
    expect(w[0].days[1].items.map((e) => e.id)).toEqual([2, 3]);
    expect(w[1].days[0].date).toBe('2026-11-12');
  });
  it('titleFor names the month or the range', () => {
    expect(titleFor(range)).toBe('บันทึกการปฏิบัติงาน ประจำเดือน พฤศจิกายน 2569');
    expect(titleFor({ from: '2026-10-20', to: '2026-11-05' })).toContain('ตั้งแต่วันที่ 20 ตุลาคม 2569 ถึง 5 พฤศจิกายน 2569');
  });
});

describe('buildWordBlob', () => {
  it('produces a docx that uses only TH Sarabun PSK and the right content', async () => {
    const blob = await buildWordBlob({ who: 'นางสาวทดสอบ ระบบ', range, rows });
    const files = unzipSync(new Uint8Array(await blob.arrayBuffer()));
    const doc = strFromU8(files['word/document.xml']);
    const styles = strFromU8(files['word/styles.xml']);

    const fonts = new Set([...(doc + styles).matchAll(/w:(?:ascii|hAnsi|cs|eastAsia)="([^"]+)"/g)].map((m) => m[1]));
    expect([...fonts]).toEqual(['TH Sarabun PSK']);
    expect(doc).toContain('w:sz w:val="32"');

    expect(doc).toContain('บันทึกการปฏิบัติงาน ประจำเดือน พฤศจิกายน 2569');
    expect(doc).toContain('นางสาวทดสอบ ระบบ');
    expect(doc).toContain('สัปดาห์ที่ 2');
    expect(doc).toContain('วันที่ 12 พฤศจิกายน 2569');
    expect(doc).toContain('นาที');
    expect(doc).not.toContain('โน้ตลับ'); // หมายเหตุเว้นว่าง
    expect(doc).toContain('w:val="dashed"');
  });

  it('puts the supervisor name under the reviewer line', async () => {
    const blob = await buildWordBlob({ who: 'นางสาวทดสอบ ระบบ', job: 'งานสารบรรณ', workGroup: 'กลุ่มงานบริหาร', supervisor: 'นายหัวหน้า ใจดี', supervisorTitle: 'ผู้อำนวยการกอง', range, rows });
    const doc = strFromU8(unzipSync(new Uint8Array(await blob.arrayBuffer()))['word/document.xml']);
    expect(doc).toContain('งาน งานสารบรรณ');
    expect(doc).toContain('กลุ่มงาน กลุ่มงานบริหาร');
    expect(doc).toContain('(นายหัวหน้า ใจดี)');
    expect(doc.indexOf('ผู้ส่งมอบ')).toBeLessThan(doc.indexOf('ผู้ตรวจสอบ')); // ผู้ส่งมอบอยู่ซ้าย
    expect(doc).toContain('ตำแหน่ง ผู้อำนวยการกอง');
  });
});
