import { Icon } from '../ds.js';

/* ใบไม้ร่วงลงมาช้าๆ วนไม่จบ อยู่หลังเนื้อหา คลิกทะลุได้ และปิดเมื่อผู้ใช้ตั้งลดการเคลื่อนไหว */
const LEAVES = Array.from({ length: 14 }, (_, i) => ({
  left: (i * 37 + 9) % 96,
  size: 16 + ((i * 7) % 5) * 4,
  fall: 14 + ((i * 5) % 9) * 2,
  sway: 4 + ((i * 3) % 4),
  drift: 24 + ((i * 11) % 5) * 12,
  delay: -((i * 4.3) % 22),
}));

export default function Leaves() {
  return (
    <div className="leaves leaves--icon" aria-hidden="true">
      {LEAVES.map((l, i) => (
        <span key={i} className="leaf" style={{ left: l.left + '%', animationDuration: l.fall + 's', animationDelay: l.delay + 's' }}>
          <span className="leaf__sway" style={{ '--drift': l.drift + 'px', animationDuration: l.sway + 's' }}>
            <Icon name="leaf" size={l.size} />
          </span>
        </span>
      ))}
    </div>
  );
}
