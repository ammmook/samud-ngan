/* @ds-bundle: {"format":4,"namespace":"SamutNgan","components":[{"name":"Icon"},{"name":"Button"},{"name":"Segmented"},{"name":"CategoryTag"},{"name":"HourRing"},{"name":"DayCell"},{"name":"EventCard"},{"name":"TimeRange"},{"name":"PhotoStrip"},{"name":"StatTile"},{"name":"WeekBars"},{"name":"EmptyState"},{"name":"Toast"}]} */
(function () {
  var React = window.React, h = React.createElement;
  var CATS = { meadow: 'งานหลัก', sky: 'ประชุม', honey: 'ลงพื้นที่', blossom: 'งานสร้างสรรค์', lilac: 'เรียนรู้' };
  function cx() { return Array.prototype.filter.call(arguments, Boolean).join(' '); }
  function toMin(t) { var p = String(t || '').split(':'); return p.length < 2 ? NaN : (+p[0]) * 60 + (+p[1]); }
  function formatDuration(start, end) {
    var m = toMin(end) - toMin(start);
    if (!(m > 0)) return '';
    var hh = Math.floor(m / 60), mm = m % 60;
    return (hh ? hh + ' ชม.' : '') + (hh && mm ? ' ' : '') + (mm ? mm + ' นาที' : '');
  }

  var ICONS = {
    plus: ['M12 5v14M5 12h14'],
    left: ['M15 6l-6 6 6 6'],
    right: ['M9 6l6 6-6 6'],
    image: ['M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z', 'M4 16l4.5-4.5 4 4 3-3L20 17', 'M9 9.5h.01'],
    clock: ['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z', 'M12 7v5l3 2'],
    grip: ['M9 6h.01M9 12h.01M9 18h.01M15 6h.01M15 12h.01M15 18h.01'],
    check: ['M5 12.5l4.5 4.5L19 7.5'],
    x: ['M6 6l12 12M18 6L6 18'],
    calendar: ['M5 6h14a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1z', 'M4 10h16', 'M8 3v4M16 3v4'],
    chart: ['M5 20V10M12 20V4M19 20v-7'],
    note: ['M6 4h9l3 3v13H6z', 'M9 12h6M9 16h4'],
    leaf: ['M5 19c0-8 5-14 15-14 0 10-6 15-14 15', 'M5 19l8-8'],
    trash: ['M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13'],
    pencil: ['M4 20l1-4L16.5 4.5a2 2 0 0 1 3 3L8 19l-4 1z', 'M14.5 6.5l3 3']
  };

  function Icon(p) {
    var size = p.size || 20, d = ICONS[p.name] || [];
    return h('svg', { className: cx('sn-icon', p.className), width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: p.name === 'grip' ? 2.8 : 1.75, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': p.title ? undefined : 'true', role: p.title ? 'img' : undefined, 'aria-label': p.title },
      d.map(function (x, i) { return h('path', { key: i, d: x }); }));
  }

  function Button(p) {
    var variant = p.variant || 'primary', size = p.size || 'md';
    return h('button', { type: p.type || 'button', className: cx('sn-btn', 'sn-btn--' + variant, 'sn-btn--' + size, p.iconOnly && 'sn-btn--icon', p.className), disabled: p.disabled, onClick: p.onClick, 'aria-label': p['aria-label'] },
      p.icon ? h(Icon, { name: p.icon, size: 18 }) : null, p.children);
  }

  function Segmented(p) {
    var opts = p.options || [], idx = Math.max(0, opts.findIndex(function (o) { return o.value === p.value; }));
    return h('div', { className: 'sn-seg', role: 'radiogroup', 'aria-label': p['aria-label'] || 'มุมมอง' },
      h('span', { className: 'sn-seg__thumb', 'aria-hidden': 'true', style: { width: 'calc((100% - 8px) / ' + opts.length + ')', transform: 'translateX(' + idx * 100 + '%)' } }),
      opts.map(function (o) {
        return h('button', { key: o.value, type: 'button', role: 'radio', 'aria-checked': o.value === p.value, className: 'sn-seg__opt', onClick: function () { p.onChange && p.onChange(o.value); } }, o.label);
      }));
  }

  function CategoryTag(p) {
    return h('span', { className: cx('sn-tag', 'sn-cat--' + p.cat, p.className) }, h('span', { className: 'sn-tag__dot', 'aria-hidden': 'true' }), p.label || CATS[p.cat]);
  }

  function HourRing(p) {
    var size = p.size || 32, sw = p.strokeWidth || 3;
    if (p.plain) return h('span', { className: cx('sn-ring', p.className) }, h('span', { className: 'sn-ring__label' }, p.children));
    var r = (size - sw) / 2, c = 2 * Math.PI * r;
    var pct = Math.max(0, Math.min(1, (p.hours || 0) / (p.goal || 8)));
    return h('span', { className: cx('sn-ring', p.className), style: { width: size, height: size }, role: 'img', 'aria-label': (p.hours || 0) + ' ชั่วโมง จากเป้า ' + (p.goal || 8) },
      h('svg', { width: size, height: size, viewBox: '0 0 ' + size + ' ' + size, 'aria-hidden': 'true' },
        h('circle', { className: 'sn-ring__track', cx: size / 2, cy: size / 2, r: r, strokeWidth: sw }),
        pct > 0 ? h('circle', { className: 'sn-ring__fill', cx: size / 2, cy: size / 2, r: r, strokeWidth: sw, strokeDasharray: c, strokeDashoffset: c * (1 - pct) }) : null),
      h('span', { className: 'sn-ring__label' }, p.children));
  }

  function DayCell(p) {
    var evs = p.events || [], shown = evs.slice(0, 2), more = evs.length - shown.length;
    return h('div', Object.assign({ role: 'button', tabIndex: 0, className: cx('sn-day', 'sn-root', p.outside && 'sn-day--outside', p.today && 'sn-day--today', p.selected && 'sn-day--selected', p.dropTarget && 'sn-day--drop', p.className), onClick: p.onClick, onKeyDown: function (e) { if ((e.key === 'Enter' || e.key === ' ') && p.onClick) { e.preventDefault(); p.onClick(e); } }, onDragOver: p.onDragOver, onDragLeave: p.onDragLeave, onDrop: p.onDrop }, p.cellProps || {}),
      h('div', { className: 'sn-day__head' },
        h(HourRing, { hours: p.hours, size: 32, plain: p.plainDay }, p.day),
        p.hours ? h('span', { className: 'sn-day__hours' }, p.hours + ' ชม.') : null),
      shown.map(function (ev) {
        return h('div', { key: ev.id, className: cx('sn-pip', 'sn-cat--' + ev.cat), draggable: !!p.onEventDragStart, onDragStart: function (e) { p.onEventDragStart && p.onEventDragStart(e, ev); } },
          h('span', { className: 'sn-pip__dot', 'aria-hidden': 'true' }), h('span', { className: 'sn-pip__text' }, ev.title));
      }),
      more > 0 ? h('span', { className: 'sn-day__more' }, 'อีก ' + more + ' รายการ') : null);
  }

  function EventCard(p) {
    var thumbs = (p.photos || []).slice(0, 3), total = p.photoCount != null ? p.photoCount : (p.photos || []).length;
    var dur = formatDuration(p.start, p.end);
    return h('article', Object.assign({ className: cx('sn-card', 'sn-root', 'sn-cat--' + p.cat, p.dragging && 'sn-card--dragging', p.compact && 'sn-card--compact', p.className), draggable: p.draggable, tabIndex: 0, onClick: p.onClick }, p.cardProps || {}),
      h('div', { className: 'sn-card__top' },
        h('span', null, p.start + '–' + p.end, dur ? ' · ' + dur : ''),
        h(Icon, { name: 'grip', size: 18, className: 'sn-card__grip' })),
      h('h3', { className: 'sn-card__title' }, p.title),
      p.note ? h('p', { className: 'sn-card__note' }, p.note) : null,
      h('div', { className: 'sn-card__foot' },
        h(CategoryTag, { cat: p.cat }),
        total > 0 ? h('span', { style: { display: 'inline-flex', alignItems: 'center', gap: 6, marginLeft: 'auto' } },
          thumbs.length ? h('span', { className: 'sn-card__thumbs' }, thumbs.map(function (s, i) { return h('img', { key: i, className: 'sn-card__thumb', src: s, alt: '' }); })) : h(Icon, { name: 'image', size: 16 }),
          total + ' รูป') : null));
  }

  function TimeRange(p) {
    var bad = p.start && p.end && !(toMin(p.end) > toMin(p.start));
    function field(label, key, val) {
      return h('label', { className: 'sn-time__field' }, label,
        h('input', { type: 'time', value: val || '', 'aria-invalid': bad && key === 'end' ? 'true' : undefined, onChange: function (e) { var n = { start: p.start, end: p.end }; n[key] = e.target.value; p.onChange && p.onChange(n); } }));
    }
    return h('div', { className: 'sn-time sn-root' },
      h('div', { className: 'sn-time__row' }, field('เริ่ม', 'start', p.start), h('span', { className: 'sn-time__sep', 'aria-hidden': 'true' }, '–'), field('จบ', 'end', p.end),
        !bad && formatDuration(p.start, p.end) ? h('span', { className: 'sn-time__sum' }, 'รวม ' + formatDuration(p.start, p.end)) : null),
      bad ? h('div', { className: 'sn-time__err', role: 'alert' }, 'เวลาจบต้องอยู่หลังเวลาเริ่ม ลองปรับเวลาจบ') : null);
  }

  function PhotoStrip(p) {
    var photos = p.photos || [], full = p.max && photos.length >= p.max;
    var input = React.useRef(null);
    return h('div', { className: 'sn-photos sn-root' },
      photos.map(function (ph) {
        return h('div', { key: ph.id, className: 'sn-photo' }, h('img', { src: ph.src, alt: ph.alt || '' }),
          h('button', { type: 'button', className: 'sn-photo__rm', 'aria-label': 'ลบรูป', onClick: function () { p.onRemove && p.onRemove(ph.id); } }, h(Icon, { name: 'x', size: 16 })));
      }),
      full ? null : h('button', { type: 'button', className: 'sn-photo__add', onClick: function () { input.current && input.current.click(); } }, h(Icon, { name: 'image', size: 22 }), photos.length ? 'เพิ่มอีก' : 'เพิ่มรูป'),
      h('input', { ref: input, type: 'file', accept: 'image/*', multiple: true, hidden: true, onChange: function (e) { p.onAdd && p.onAdd(Array.prototype.slice.call(e.target.files)); e.target.value = ''; } }));
  }

  function StatTile(p) {
    return h('div', { className: 'sn-stat sn-root' },
      h('span', { className: 'sn-stat__label' }, p.label),
      h('span', null, h('span', { className: 'sn-stat__value' }, p.value), p.unit ? h('span', { className: 'sn-stat__unit' }, p.unit) : null),
      p.hint ? h('span', { className: 'sn-stat__hint' }, p.hint) : null,
      p.children);
  }

  function WeekBars(p) {
    var data = p.data || [], max = Math.max(p.goal || 8, Math.max.apply(null, data.map(function (d) { return d.hours; }).concat([1])));
    return h('div', { className: 'sn-bars sn-root', role: 'img', 'aria-label': 'ชั่วโมงทำงานรายวัน: ' + data.map(function (d) { return d.label + ' ' + d.hours; }).join(', ') },
      data.map(function (d, i) {
        return h('div', { key: d.label, className: cx('sn-bar', d.today && 'sn-bar--today') },
          h('span', { className: 'sn-bar__val' }, d.hours || '–'),
          h('div', { className: 'sn-bar__col', style: { height: Math.max(4, Math.round(d.hours / max * 96)) + 'px', animationDelay: i * 60 + 'ms' } }),
          h('span', { className: 'sn-bar__day' }, d.label));
      }));
  }

  function EmptyState(p) {
    return h('div', { className: 'sn-empty sn-root' },
      h('span', { className: 'sn-empty__art' }, h(Icon, { name: 'leaf', size: 56 })),
      h('h3', { className: 'sn-empty__title' }, p.title), p.body ? h('p', { className: 'sn-empty__body' }, p.body) : null, p.action || null);
  }

  function Toast(p) {
    return h('div', { className: 'sn-toast sn-root', role: 'status' }, h('span', null, p.children),
      p.action ? h('button', { type: 'button', className: 'sn-toast__act', onClick: p.onAction }, p.action) : null);
  }

  window.SamutNgan = { Icon: Icon, Button: Button, Segmented: Segmented, CategoryTag: CategoryTag, HourRing: HourRing, DayCell: DayCell, EventCard: EventCard, TimeRange: TimeRange, PhotoStrip: PhotoStrip, StatTile: StatTile, WeekBars: WeekBars, EmptyState: EmptyState, Toast: Toast, CATS: CATS, formatDuration: formatDuration };
})();
