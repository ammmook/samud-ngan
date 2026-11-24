/* ส่งออกรายงานเป็นไฟล์ Word (.docx) รูปแบบ "บันทึกการปฏิบัติงาน" ฟอนต์ TH Sarabun PSK */
import { addDays, evHours, M_FULL, pd, r1, sortEv } from './dates.js';

const FONT = 'TH Sarabun PSK';
const SZ = 32; // half-points = 16pt
const W = [7567, 850, 850, 1200]; // รวม 10467 = กว้างหน้า A4 ลบขอบ 720 สองข้าง

const thLong = (s) => { const d = pd(s); return d.getDate() + ' ' + M_FULL[d.getMonth()] + ' ' + (d.getFullYear() + 543); };
const mondayOf = (s) => addDays(s, -((pd(s).getDay() + 6) % 7));

/* ปริมาณงาน: น้อยกว่า 1 ชม. แสดงเป็นนาที */
export function qty(hours) {
  if (hours > 0 && hours < 1) return { n: String(Math.round(hours * 60)), unit: 'นาที' };
  return { n: String(r1(hours)), unit: 'ชั่วโมง' };
}

/* จัดกลุ่ม สัปดาห์ -> วัน -> รายการ */
export function groupWeeks(rows) {
  const sorted = [...rows].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : sortEv(a, b)));
  const weeks = [];
  for (const e of sorted) {
    const m = mondayOf(e.date);
    let w = weeks[weeks.length - 1];
    if (!w || w.monday !== m) { w = { monday: m, days: [] }; weeks.push(w); }
    let d = w.days[w.days.length - 1];
    if (!d || d.date !== e.date) { d = { date: e.date, items: [] }; w.days.push(d); }
    d.items.push(e);
  }
  return weeks;
}

export function titleFor(range) {
  const a = pd(range.from), b = pd(range.to);
  if (a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth()) return 'บันทึกการปฏิบัติงาน ประจำเดือน ' + M_FULL[a.getMonth()] + ' ' + (a.getFullYear() + 543);
  return 'บันทึกการปฏิบัติงาน ตั้งแต่วันที่ ' + thLong(range.from) + ' ถึง ' + thLong(range.to);
}

export async function buildWordBlob({ who, job, workGroup, supervisor, supervisorTitle, range, rows }) {
  const D = await import('docx');
  const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, AlignmentType, VerticalAlign, BorderStyle, TableLayoutType, VerticalMergeType } = D;

  const run = (text, o = {}) => new TextRun({ text, font: { ascii: FONT, hAnsi: FONT, cs: FONT, eastAsia: FONT }, size: o.size || SZ, sizeComplexScript: o.size || SZ, bold: !!o.bold, boldComplexScript: !!o.bold });
  const para = (text, o = {}) => new Paragraph({
    alignment: o.align || AlignmentType.LEFT,
    indent: o.dash ? { left: 700, hanging: 400 } : undefined,
    tabStops: o.dash ? [{ type: 'left', position: 700 }] : undefined,
    spacing: { after: 0, line: 240 },
    children: text === '' || text == null ? [] : [run((o.dash ? '-	' : '') + String(text), o)],
  });
  const hcell = (text, wi, o = {}) => new TableCell({
    borders: { top: solid, bottom: solid, left: solid, right: solid }, width: { size: W[wi], type: WidthType.DXA }, verticalAlign: VerticalAlign.CENTER,
    children: [para(text, { bold: o.bold, align: o.align })],
  });
  const wcell = (text, wi, o = {}) => new TableCell({
    width: { size: W[wi], type: WidthType.DXA },
    verticalAlign: VerticalAlign.CENTER,
    children: [para(text, { bold: o.bold, align: o.align })],
  });

  const center = AlignmentType.CENTER;
  const solid = { style: BorderStyle.SINGLE, size: 4, color: '000000' };
  const trs = [];
  // หัวตาราง 2 แถว (ผสานเซลล์เหมือนตัวอย่าง)
  trs.push(new TableRow({
    tableHeader: true, height: { value: 504, rule: 'atLeast' },
    children: [
      new TableCell({ borders: { top: solid, bottom: solid, left: solid, right: solid }, width: { size: W[0], type: WidthType.DXA }, verticalMerge: VerticalMergeType.RESTART, verticalAlign: VerticalAlign.CENTER, children: [para('งานที่รับผิดชอบ', { bold: true, align: center })] }),
      new TableCell({ borders: { top: solid, bottom: solid, left: solid, right: solid }, width: { size: W[1] + W[2], type: WidthType.DXA }, columnSpan: 2, verticalAlign: VerticalAlign.CENTER, children: [para('ปริมาณงาน', { bold: true, align: center })] }),
      new TableCell({ borders: { top: solid, bottom: solid, left: solid, right: solid }, width: { size: W[3], type: WidthType.DXA }, verticalMerge: VerticalMergeType.RESTART, verticalAlign: VerticalAlign.CENTER, children: [para('หมายเหตุ', { bold: true, align: center })] }),
    ],
  }));
  trs.push(new TableRow({
    tableHeader: true,
    children: [
      new TableCell({ borders: { top: solid, bottom: solid, left: solid, right: solid }, width: { size: W[0], type: WidthType.DXA }, verticalMerge: VerticalMergeType.CONTINUE, children: [para('')] }),
      hcell('จำนวน', 1, { bold: true, align: center }),
      hcell('หน่วย', 2, { bold: true, align: center }),
      new TableCell({ borders: { top: solid, bottom: solid, left: solid, right: solid }, width: { size: W[3], type: WidthType.DXA }, verticalMerge: VerticalMergeType.CONTINUE, children: [para('')] }),
    ],
  }));

  const labelRow = (text, bold, first) => new TableRow({
    cantSplit: true,
    children: [
      new TableCell({ width: { size: W[0], type: WidthType.DXA }, borders: first ? { top: solid } : undefined, children: [para(text, { bold })] }),
      ...[1, 2, 3].map((k) => new TableCell({ width: { size: W[k], type: WidthType.DXA }, borders: first ? { top: solid } : undefined, children: [para('')] })),
    ],
  });

  groupWeeks(rows).forEach((w, i) => {
    trs.push(labelRow('สัปดาห์ที่ ' + (i + 1), true, i === 0));
    for (const d of w.days) {
      trs.push(labelRow('วันที่ ' + thLong(d.date), true));
      for (const e of d.items) {
        const q = qty(evHours(e));
        trs.push(new TableRow({
          cantSplit: true,
          children: [
            new TableCell({ width: { size: W[0], type: WidthType.DXA }, children: [para(e.title, { dash: true })] }),
            wcell(q.n, 1, { align: center }),
            wcell(q.unit, 2, { align: center }),
            new TableCell({ width: { size: W[3], type: WidthType.DXA }, children: [para('')] }),
          ],
        }));
      }
    }
  });

  const none = { style: BorderStyle.NONE, size: 0, color: 'auto' };
  const noB = { top: none, bottom: none, left: none, right: none };
  const half = 5233;
  const sigCell = (lines) => new TableCell({
    width: { size: half, type: WidthType.DXA }, borders: noB,
    children: lines.map((t) => para(t, { align: center, size: 28 })),
  });
  const sig = new Table({
    width: { size: 10467, type: WidthType.DXA }, columnWidths: [half, half], layout: TableLayoutType.FIXED,
    borders: { top: none, bottom: none, left: none, right: none, insideHorizontal: none, insideVertical: none },
    rows: [new TableRow({
      cantSplit: true,
      children: [
        // ซ้าย = ผู้ส่งมอบ, ขวา = ผู้ตรวจสอบ (หัวหน้า) ตามแบบฟอร์ม
        sigCell(['ขอรับรองว่าได้ปฏิบัติงานตามบันทึกข้างต้นจริง', 'ผู้ส่งมอบ........................................................', '(' + (who || '.............................................................') + ')', '']),
        sigCell(['ตรวจสอบแล้ว ถูกต้องตามที่ได้ปฏิบัติจริง', 'ผู้ตรวจสอบ.............................................................', '(' + (supervisor || '.............................................................') + ')', 'ตำแหน่ง ' + (supervisorTitle || '.............................................................')]),
      ],
    })],
  });

  const head = (t) => new Paragraph({ alignment: center, spacing: { after: 0 }, children: [run(t, { bold: true })] });
  const doc = new Document({
    creator: 'สมุดงาน', title: titleFor(range),
    styles: { default: { document: { run: { font: { ascii: FONT, hAnsi: FONT, cs: FONT, eastAsia: FONT }, size: SZ, sizeComplexScript: SZ } } } },
    sections: [{
      properties: { page: { size: { width: 11907, height: 16839 }, margin: { top: 851, bottom: 851, left: 720, right: 720 } } },
      children: [
        head(titleFor(range)),
        // บรรทัดเดียวตามแบบฟอร์ม: ชื่อ-สกุล / งาน / กลุ่มงาน (ที่ว่างเป็นเส้นประให้เขียนมือ)
        head('ชื่อ-สกุล ' + (who || '.............................................') + '    งาน ' + (job || '.........................') + '    กลุ่มงาน ' + (workGroup || '..................................')),
        new Table({
          width: { size: 10467, type: WidthType.DXA }, columnWidths: W, layout: TableLayoutType.FIXED, rows: trs,
          borders: { top: solid, bottom: solid, left: solid, right: solid, insideVertical: solid, insideHorizontal: { style: BorderStyle.DASHED, size: 4, color: '000000' } },
        }),
        para(''),
        sig,
      ],
    }],
  });
  return Packer.toBlob(doc);
}
