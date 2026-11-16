import { useEffect, useMemo, useState } from 'react';
import { Button, EmptyState, Segmented } from '../ds.js';
import DayGoal from '../components/DayGoal.jsx';
import EventDialog from '../components/EventDialog.jsx';
import FindBar from '../components/FindBar.jsx';
import MonthView from '../components/MonthView.jsx';
import TimeGrid from '../components/TimeGrid.jsx';
import { Q_PHONE } from '../lib/breakpoints.js';
import { M_FULL, M_SHORT, addDays, addMonths, ds, longDate, pd, uid, weekStart } from '../lib/dates.js';
import { useMedia } from '../lib/hooks.js';
import { pref, setPref } from '../lib/storage.js';
import { useDragMove } from '../lib/useDragMove.js';
import { copyDay } from '../lib/repeat.js';
import { filterEvents, hoursByDate, streakOf } from '../lib/stats.js';
import { addTemplate, loadTemplates, saveTemplates } from '../lib/templates.js';
import { useEventEditor } from '../lib/useEventEditor.js';

const VIEWS = [{ value: 'month', label: 'เดือน' }, { value: 'week', label: 'สัปดาห์' }, { value: 'day', label: 'วัน' }];

function rangeOf(view, cursor) {
  if (view === 'day') return { from: cursor, to: cursor };
  if (view === 'week') { const w = weekStart(cursor); return { from: w, to: addDays(w, 6) }; }
  const c = pd(cursor);
  return { from: ds(new Date(c.getFullYear(), c.getMonth(), 1)), to: ds(new Date(c.getFullYear(), c.getMonth() + 1, 0)) };
}

function titleOf(view, cursor, range) {
  if (view === 'month') { const c = pd(cursor); return { title: M_FULL[c.getMonth()] + ' ' + (c.getFullYear() + 543), unit: 'เดือน' }; }
  if (view === 'week') {
    const a = pd(range.from), b = pd(range.to), yr = b.getFullYear() + 543;
    const title = a.getMonth() === b.getMonth()
      ? `${a.getDate()}–${b.getDate()} ${M_SHORT[b.getMonth()]} ${yr}`
      : `${a.getDate()} ${M_SHORT[a.getMonth()]} – ${b.getDate()} ${M_SHORT[b.getMonth()]} ${yr}`;
    return { title, unit: 'สัปดาห์' };
  }
  return { title: longDate(cursor), unit: 'วัน' };
}

export default function CalendarPage({ cursor, setCursor, events, setEvents, today, notify, loaded, goal, onGoal, storeKey }) {
  const [view, setView] = useState(() => { const v = pref('sn-view', 'month'); return VIEWS.some((x) => x.value === v) ? v : 'month'; });
  const mobile = useMedia(Q_PHONE);
  useEffect(() => { setPref('sn-view', view); }, [view]);

  const [q, setQ] = useState('');
  const [cats, setCats] = useState([]);
  const filtering = !!(q.trim() || cats.length);
  const shownEvents = useMemo(() => filterEvents(events, q, cats), [events, q, cats]);
  const toggleCat = (k) => setCats((c) => (c.includes(k) ? c.filter((x) => x !== k) : c.concat(k)));
  const clearFilter = () => { setQ(''); setCats([]); };

  const by = useMemo(() => hoursByDate(events), [events]);
  const todayHours = by[today] || 0;
  const streak = useMemo(() => streakOf(by, today), [by, today]);

  const [templates, setTemplates] = useState(() => loadTemplates(storeKey));
  const putTemplates = (list) => { setTemplates(list); saveTemplates(storeKey, list); };
  const saveTemplate = (d) => { putTemplates(addTemplate(templates, d)); notify(`เก็บ "${d.title.trim()}" เป็นแม่แบบแล้ว`); };
  const deleteTemplate = (t) => {
    const before = templates;
    putTemplates(templates.filter((x) => x.id !== t.id));
    notify('ลบแม่แบบแล้ว', () => putTemplates(before));
  };

  const drag = useDragMove({ events, setEvents, notify });
  const range = useMemo(() => rangeOf(view, cursor), [view, cursor]);

  const editor = useEventEditor({
    events, setEvents, notify, defaultDate: cursor, today,
    onSaved: (dr) => { if (dr.date < range.from || dr.date > range.to) setCursor(dr.date); },
  });

  const byDate = useMemo(() => { const m = {}; shownEvents.forEach((e) => { (m[e.date] = m[e.date] || []).push(e); }); return m; }, [shownEvents]);
  const eventsById = useMemo(() => { const m = {}; events.forEach((e) => { m[e.id] = e; }); return m; }, [events]);
  const none = useMemo(() => [], []);
  const count = useMemo(() => shownEvents.filter((e) => e.date >= range.from && e.date <= range.to).length, [shownEvents, range]);

  /* ทำซ้ำจากเมื่อวาน: ในมุมมองวัน ใช้วันก่อนหน้าของวันที่ดูอยู่ ที่อื่นใช้วันนี้ */
  const target = view === 'day' ? cursor : today;
  const source = addDays(target, -1);
  const sourceCount = useMemo(() => events.filter((e) => e.date === source).length, [events, source]);
  const copyLabel = target === today ? 'ทำซ้ำจากเมื่อวาน' : 'ทำซ้ำจากวันก่อน';
  const copyFromYesterday = () => {
    const r = copyDay(events, source, target, uid);
    if (!r.fresh.length) { notify(r.total ? 'บันทึกของวันก่อนมีอยู่ในวันนี้ครบแล้ว' : 'วันก่อนยังไม่มีบันทึกให้ทำซ้ำ'); return; }
    const ids = new Set(r.fresh.map((x) => x.id));
    setEvents((prev) => prev.concat(r.fresh));
    if (target < range.from || target > range.to) setCursor(target);
    notify(`ทำซ้ำ ${r.fresh.length} บันทึกแล้ว${r.skipped ? ` (ข้าม ${r.skipped} ที่มีอยู่แล้ว)` : ''}`, () => setEvents((prev) => prev.filter((x) => !ids.has(x.id))));
  };

  const { title, unit } = titleOf(view, cursor, range);
  const isCurrent = today >= range.from && today <= range.to;
  const go = (dir) => setCursor(view === 'month' ? addMonths(cursor, dir) : addDays(cursor, view === 'week' ? 7 * dir : dir));
  const goDay = (date) => { setCursor(date); setView('day'); };

  const isEmpty = loaded && count === 0;
  const noMatch = isEmpty && filtering && events.some((e) => e.date >= range.from && e.date <= range.to);
  const days = view === 'day' ? [cursor] : view === 'week' ? Array.from({ length: 7 }, (_, i) => addDays(range.from, i)) : [];
  const emptyTitle = (unit === 'วัน' ? (isCurrent ? 'วันนี้' : 'วันนั้น') : unit + (isCurrent ? 'นี้' : 'นั้น')) + 'ยังไม่มีบันทึก';
  const addVariant = isEmpty ? 'soft' : 'primary';
  const shared = {
    byDate, eventsById, today,
    dropDate: drag.dropDate, setDropDate: drag.setDropDate, startDrag: drag.startDrag, onDrop: drag.dropOn,
    onOpen: editor.openEvent, onNew: editor.openNew, onDay: goDay,
  };

  return (
    <>
      <header className="top">
        <div className="top__title">
          <h1 className="ttl sn-num">{title}</h1>
          <p className="sub">{count ? count + ' บันทึก' + (filtering ? ' ที่ตรงกับตัวกรอง' : '') : 'ยังไม่มีบันทึก'}</p>
        </div>
        <div className="top__nav">
          <Button variant="ghost" size="sm" iconOnly icon="left" aria-label={unit + 'ก่อนหน้า'} onClick={() => go(-1)} />
          <Button variant="ghost" size="sm" iconOnly icon="right" aria-label={unit + 'ถัดไป'} onClick={() => go(1)} />
          <Button variant="soft" size="sm" onClick={() => setCursor(today)}>วันนี้</Button>
        </div>
        <Segmented options={VIEWS} value={view} onChange={setView} aria-label="มุมมองปฏิทิน" />
        <Button className="top__copy" variant="ghost" size="sm" disabled={!sourceCount} onClick={copyFromYesterday}>{copyLabel}</Button>
        <Button className="top__add" variant={addVariant} icon="plus" onClick={() => editor.openNew()}>เพิ่มบันทึก</Button>
      </header>

      <DayGoal hours={todayHours} streak={streak} doneToday={todayHours > 0} goal={goal} onGoal={onGoal} />
      <FindBar q={q} setQ={setQ} cats={cats} toggleCat={toggleCat} clear={clearFilter} matches={shownEvents}
        onPick={(e) => { setCursor(e.date); editor.openEvent(e); }} />

      <div className="viewbox">
        <div className="sn-fade" key={view}>
          <div className={'cal' + (isEmpty ? ' cal--blur' : '')} inert={isEmpty ? '' : undefined} aria-hidden={isEmpty ? 'true' : undefined}>
          {view === 'month'
            ? <MonthView {...shared} cursor={cursor} mobile={mobile} />
            : <TimeGrid {...shared} days={days} none={none} dragRef={drag.dragRef} dragId={drag.dragId} />}
          </div>
        </div>
        {isEmpty && (
          <div className="empty-overlay">
            {noMatch ? (
              <EmptyState title="ไม่มีบันทึกที่ตรงกับตัวกรอง" body={`${unit}นี้มีบันทึกอยู่ แต่ไม่ตรงกับคำค้นหรือหมวดที่เลือก`}
                action={<Button variant="primary" onClick={clearFilter}>ล้างตัวกรอง</Button>} />
            ) : (
              <EmptyState title={emptyTitle} body="กดเพิ่มบันทึกเพื่อจดงานแรก แล้วปฏิทินจะกลับมาชัดเหมือนเดิม"
                action={<Button variant="primary" icon="plus" onClick={() => editor.openNew(view === 'month' && !isCurrent ? range.from : undefined)}>เพิ่มบันทึก</Button>} />
            )}
          </div>
        )}
      </div>

      <Button className="fab" variant={addVariant} icon="plus" onClick={() => editor.openNew()}>เพิ่มบันทึก</Button>

      {editor.editor && (
        <EventDialog key={editor.editor.draft.id} isNew={editor.editor.isNew} draft={editor.editor.draft}
          templates={templates} onSaveTemplate={saveTemplate} onDeleteTemplate={deleteTemplate}
          onSave={editor.save} onDelete={editor.remove} onClose={editor.close} />
      )}
    </>
  );
}
