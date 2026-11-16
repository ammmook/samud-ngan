import { HourRing } from '../ds.js';
import { r1 } from '../lib/dates.js';

export const GOALS = [2, 3, 4, 5, 6, 7, 8, 9, 10];

/* แถบเป้าของวันนี้ และจำนวนวันที่จดต่อเนื่อง */
export default function DayGoal({ hours, streak, doneToday, goal, onGoal }) {
  const left = Math.max(0, r1(goal - hours));
  const reached = hours >= goal;
  return (
    <section className="goal" aria-label="เป้าและความต่อเนื่อง">
      <div className="goal__block">
        <HourRing hours={hours} goal={goal} size={56} strokeWidth={5}>{r1(hours)}</HourRing>
        <div>
          <p className="goal__main">{reached ? 'ครบเป้าวันนี้แล้ว' : `วันนี้ ${r1(hours)} จาก ${goal} ชม.`}</p>
          <p className="goal__hint">{reached ? `ทำเกินเป้า ${r1(hours - goal)} ชม.` : `เหลืออีก ${left} ชม.`}</p>
        </div>
      </div>
      <div className="goal__block" title="เสาร์-อาทิตย์ที่ไม่ได้จดจะไม่ทำให้สายขาด">
        <span className={'goal__streak' + (streak ? ' is-on' : '')} aria-hidden="true">{streak}</span>
        <div>
          <p className="goal__main">{streak ? `จดต่อเนื่อง ${streak} วัน` : 'ยังไม่มีสายต่อเนื่อง'}</p>
          <p className="goal__hint">
            {doneToday ? 'วันนี้จดแล้ว' : streak ? 'จดวันนี้เพื่อให้สายไม่ขาด' : 'จดงานวันนี้เพื่อเริ่มนับวันแรก'}
          </p>
        </div>
      </div>
      <label className="goal__set">
        <span>เป้าต่อวัน</span>
        <select className="sel" value={goal} onChange={(e) => onGoal(Number(e.target.value))}>
          {GOALS.map((g) => <option key={g} value={g}>{g} ชม.</option>)}
        </select>
      </label>
    </section>
  );
}
