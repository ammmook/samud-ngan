/* ต้นไม้วาดด้วย SVG สีตามหมวดงาน (ผ่านตัวแปร --c-solid และ --c-fill ของ .sn-cat--*)
   ระยะ 0 ดินเปล่า, 1 งอก, 2 ต้นอ่อน, 3 ต้นไม้, 4 ต้นใหญ่ */
export default function Plant({ stage, cat, size = 44, delay = 0 }) {
  const h = Math.round((size * 56) / 48);
  return (
    <svg className={'plant sn-cat--' + cat + (stage ? ' plant--grow' : ' plant--empty')} style={{ '--d': delay + 'ms' }} width={size} height={h} viewBox="0 0 48 56" aria-hidden="true">
      <ellipse className="plant__soil" cx="24" cy="54.5" rx="15" ry="2" />
      {stage === 1 && (
        <g>
          <path className="plant__stem" d="M24 54V43" strokeWidth="2.5" />
          <ellipse className="plant__leaf" cx="19" cy="42" rx="6" ry="3.2" transform="rotate(-30 19 42)" />
          <ellipse className="plant__leaf" cx="29" cy="40" rx="6" ry="3.2" transform="rotate(30 29 40)" />
        </g>
      )}
      {stage === 2 && (
        <g>
          <path className="plant__stem" d="M24 54V28" strokeWidth="3" />
          <ellipse className="plant__leaf" cx="16.5" cy="42" rx="7" ry="3.6" transform="rotate(-28 16.5 42)" />
          <ellipse className="plant__leaf" cx="31.5" cy="38" rx="7" ry="3.6" transform="rotate(28 31.5 38)" />
          <ellipse className="plant__leaf" cx="17.5" cy="32" rx="6.5" ry="3.4" transform="rotate(-32 17.5 32)" />
          <ellipse className="plant__leaf" cx="30.5" cy="29" rx="6.5" ry="3.4" transform="rotate(32 30.5 29)" />
          <ellipse className="plant__leaf" cx="24" cy="23" rx="4" ry="6.5" />
        </g>
      )}
      {stage === 3 && (
        <g>
          <rect className="plant__trunk" x="22" y="36" width="4" height="18" rx="2" />
          <circle className="plant__leaf" cx="24" cy="27" r="13" />
          <circle className="plant__light" cx="19" cy="22" r="5" />
        </g>
      )}
      {stage === 4 && (
        <g>
          <rect className="plant__trunk" x="21" y="32" width="6" height="22" rx="2.5" />
          <circle className="plant__leaf" cx="13" cy="29" r="9" />
          <circle className="plant__leaf" cx="35" cy="29" r="9" />
          <circle className="plant__leaf" cx="24" cy="19" r="12" />
          <circle className="plant__leaf" cx="24" cy="30" r="10" />
          <circle className="plant__light" cx="19" cy="15" r="5" />
          <circle className="plant__fruit" cx="17" cy="24" r="2" />
          <circle className="plant__fruit" cx="30" cy="22" r="2" />
          <circle className="plant__fruit" cx="12" cy="32" r="2" />
          <circle className="plant__fruit" cx="35" cy="33" r="2" />
          <circle className="plant__fruit" cx="25" cy="34" r="2" />
        </g>
      )}
    </svg>
  );
}
