import { storage } from './storage.js?v=17';
import {
  ARROW_VALUES, endTotal, sessionStats, ringClass, fmt, isEndOpen,
  TARGET_SIZES_CM, DISTANCES_M, DEFAULT_SETUP, sessionSetup, setupKey, setupLabel,
  POSITIONS, POSITION_LABELS, endPosition, positionStats,
} from './scoring.js?v=17';
import { renderLineChart } from './chart.js?v=17';
import { initTheme } from './theme.js?v=17';
import { initShareDialog, openShare } from './share.js?v=17';
import * as S from './session.js?v=17';
import { tallyRows } from './tally.js?v=17';

const $ = (sel) => document.querySelector(sel);
const SLOTS_SHOWN = 12; // arrow boxes reserved for the current end

let active = null; // the session currently being scored
let progressSetup = null; // setup key shown on the Progress tab
let progressPosition = 'all'; // 'all' (combined), 'top' or 'bottom' on the Progress tab

// ---------- helpers ----------

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function longDate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function chip(value) {
  return `<span class="chip ${ringClass(value)}">${value}</span>`;
}

function statTiles(items) {
  return items.map(([label, value]) => `<div class="stat"><span class="stat-value">${value}</span><span class="stat-label">${label}</span></div>`).join('');
}

function positionBadge(pos) {
  return pos ? `<span class="pos-badge pos-${pos}" title="${POSITION_LABELS[pos]}">${POSITION_LABELS[pos][0]}</span>` : '';
}

async function persist() {
  active = await storage.saveSession(active);
}

// ---------- views ----------

function showView(name) {
  document.querySelectorAll('.tab').forEach((t) => t.setAttribute('aria-selected', String(t.dataset.view === name)));
  $('#view-practice').hidden = name !== 'practice';
  $('#view-history').hidden = name !== 'history';
  if (name === 'history') renderHistory();
  else renderPractice();
}

function renderPractice() {
  $('#start-form').hidden = !!active;
  $('#active-session').hidden = !active;
  if (!active) {
    $('#start-form').date.value = todayISO();
    prefillSetup();
    return;
  }

  $('#session-title').textContent = longDate(active.date);
  $('#session-notes').textContent = [setupLabel(sessionSetup(active)), active.notes].filter(Boolean).join(' · ');
  $('#session-note-btn').textContent = active.notes ? 'Edit session notes' : '＋ Session notes';

  const st = sessionStats(active);
  $('#live-stats').innerHTML = statTiles([
    ['Avg / arrow', fmt(st.avgArrow)],
    ['Avg / end', fmt(st.avgEnd, 1)],
    ['Total', st.total],
    ['Arrows', st.arrows],
    ['Ends', st.ends],
    ['10s (X)', `${st.tens} (${st.xs})`],
  ]);

  // Current end slots: always at least 12, so the keypad stays in place.
  const cur = S.currentEnd(active) || [];
  const endNo = S.currentEnd(active) ? active.ends.length : active.ends.length + 1;
  $('#end-number').textContent = `End ${endNo}`;
  const curNote = S.endNote(active, S.noteIndex(active));
  $('#current-note').hidden = !curNote;
  $('#current-note').textContent = curNote ? `📝 ${curNote}` : '';
  $('#end-note-btn').textContent = curNote ? 'Edit end note' : '＋ End note';
  $('#end-running').textContent = cur.length ? `${cur.length} arrow${cur.length === 1 ? '' : 's'} · ${endTotal(cur)} so far` : '';
  document.querySelectorAll('#position-toggle [data-position]').forEach((b) =>
    b.setAttribute('aria-checked', String(b.dataset.position === S.currentPosition(active))));
  $('#current-end').innerHTML = Array.from({ length: cur.length <= SLOTS_SHOWN ? SLOTS_SHOWN : cur.length + 1 }, (_, i) =>
    cur[i] ? `<span class="slot filled ${ringClass(cur[i])}">${cur[i]}</span>` : `<span class="slot${i === cur.length ? ' next' : ''}"></span>`
  ).join('');

  $('#undo-btn').disabled = active.ends.length === 0;
  $('#end-done-btn').disabled = cur.length === 0;

  // Ends table, newest first.
  let running = 0;
  const openIndex = isEndOpen(active) ? active.ends.length - 1 : -1;
  const rows = active.ends.map((end, i) => {
    running += endTotal(end);
    const note = S.endNote(active, i);
    const noteRow = note
      ? `<tr class="note-row"><td></td><td colspan="5"><button type="button" class="note-chip" data-edit-note="${i}">📝 ${escapeHtml(note)}</button></td></tr>`
      : '';
    return `${noteRow}<tr class="${i === openIndex ? 'partial' : ''}${note ? ' has-note' : ''}">
      <td>${i + 1}${positionBadge(endPosition(active, i))}</td>
      <td class="chips">${end.map(chip).join('')}</td>
      <td class="num score-col">${endTotal(end)}</td>
      <td class="num score-col">${fmt(endTotal(end) / end.length)}</td>
      <td class="num muted score-col">${running}</td>
      <td class="end-actions"><button class="icon-btn note-btn" data-edit-note="${i}" aria-label="Note on end ${i + 1}">✎</button><button class="icon-btn" data-delete-end="${i}" aria-label="Delete end ${i + 1}">✕</button></td>
    </tr>`;
  });
  $('#ends-body').innerHTML = rows.reverse().join('');
  $('#ends-empty').hidden = active.ends.length > 0;

  renderTally();
  renderEndChart(st);
}

function renderTally() {
  const total = active.ends.flat().length;
  $('#tally-total').textContent = `${total} arrow${total === 1 ? '' : 's'}`;
  $('#tally').innerHTML = tallyRows(active);
}

// End-by-end chart for the open session: average arrow score of each
// finished end, with the session's running average as a guide line.
function renderEndChart(st) {
  const finished = isEndOpen(active) ? active.ends.slice(0, -1) : active.ends;
  const points = finished.map((end, i) => {
    const pos = endPosition(active, i);
    return { end: i + 1, value: endTotal(end) / end.length, label: pos ? POSITION_LABELS[pos] : '', note: S.endNote(active, i) };
  });
  $('#end-chart-card').hidden = points.length === 0;
  if (!points.length || $('#view-practice').hidden) return;
  renderLineChart($('#end-chart'), points, {
    xLabel: (p) => `End ${p.end}`,
    unit: `avg/arrow`,
    reference: st.avgArrow !== null && points.length > 1 ? { value: st.avgArrow, label: `Session avg ${fmt(st.avgArrow)}` } : null,
    ariaLabel: 'Average arrow score for each end in this session',
  });
}

async function renderHistory() {
  const allSessions = (await storage.listSessions()).filter((s) => s.ends.some((e) => e.length));
  const allWithStats = allSessions.map((s) => ({ s, st: sessionStats(s), setup: sessionSetup(s) }));

  // One setup at a time on the chart and stats: averages from different
  // distances and target sizes aren't comparable.
  const setups = new Map();
  for (const { setup } of allWithStats) {
    const key = setupKey(setup);
    setups.set(key, { setup, count: (setups.get(key)?.count || 0) + 1 });
  }
  const latest = allWithStats[allWithStats.length - 1];
  if (!setups.has(progressSetup)) progressSetup = latest ? setupKey(latest.setup) : null;
  const ordered = [...setups.entries()].sort(([, a], [, b]) =>
    a.setup.distanceM - b.setup.distanceM || a.setup.targetCm - b.setup.targetCm);
  $('#setup-filter').hidden = setups.size === 0;
  $('#setup-filter').innerHTML = ordered
    .map(([key, { setup, count }]) => `<button class="setup-chip" role="radio" aria-checked="${key === progressSetup}" data-setup="${key}">
      ${setupLabel(setup)} <span class="count">${count}</span></button>`)
    .join('');
  $('#chart-setup').textContent = progressSetup
    ? `${setupLabel(setups.get(progressSetup).setup)} · ${POSITION_LABELS[progressPosition]}`
    : '';
  $('#position-filter').hidden = setups.size === 0;
  document.querySelectorAll('#position-filter [data-filter-position]').forEach((b) =>
    b.setAttribute('aria-checked', String(b.dataset.filterPosition === progressPosition)));

  // Within the setup, keep only the ends shot at the chosen position; a
  // session with none of those ends drops out of the chart.
  const withStats = allWithStats
    .filter(({ setup }) => setupKey(setup) === progressSetup)
    .map((row) => ({ ...row, st: positionStats(row.s, progressPosition) }))
    .filter(({ st }) => st.arrows > 0);
  const sessions = withStats.map(({ s }) => s);

  const allArrows = withStats.reduce((n, { st }) => n + st.arrows, 0);
  const allTotal = withStats.reduce((n, { st }) => n + st.total, 0);
  const best = withStats.reduce((b, { st }) => (st.avgArrow !== null && (b === null || st.avgArrow > b) ? st.avgArrow : b), null);
  $('#overall-stats').innerHTML = statTiles([
    ['Sessions', sessions.length],
    ['Arrows shot', allArrows],
    ['Overall avg', fmt(allArrows ? allTotal / allArrows : null)],
    ['Best session', fmt(best)],
  ]);

  renderLineChart(
    $('#chart'),
    withStats.map(({ s, st }) => ({ date: s.date, value: st.avgArrow, note: sessionNoteSummary(s) })),
    {
      emptyText: progressPosition === 'all'
        ? 'Finish a session to see your progress here.'
        : `No ${POSITION_LABELS[progressPosition].toLowerCase()} target ends recorded for this setup yet.`,
    }
  );

  $('#sessions-empty').hidden = allSessions.length > 0;
  $('#session-list').innerHTML = allWithStats
    .slice()
    .reverse()
    .map(({ s, st, setup }) => `<li class="session-item">
      <div class="session-main">
        <strong>${longDate(s.date)}</strong>${s.id === active?.id ? ' <span class="badge">in progress</span>' : ''}
        <span class="muted">${setupLabel(setup)} · ${st.ends} end${st.ends === 1 ? '' : 's'} · ${st.arrows} arrows</span>
        ${noteLines(s)}
      </div>
      <div class="session-score">
        <span class="stat-value">${fmt(st.avgArrow)}</span>
        <span class="muted">${st.total} pts · ${st.tens} 10s</span>
      </div>
      <div class="session-actions">
        <span class="row">
          <button class="secondary small" data-resume="${s.id}">${s.id === active?.id ? 'Continue' : 'Open'}</button>
          <button class="secondary small" data-share="${s.id}">Share</button>
        </span>
        <button class="icon-btn" data-delete-session="${s.id}" aria-label="Delete session">✕</button>
      </div>
    </li>`)
    .join('');
}

// Session notes plus each end note, for the Progress chart tooltip.
function sessionNoteSummary(s) {
  const ends = (s.endNotes || []).map((n, i) => (n && s.ends[i]?.length ? `End ${i + 1}: ${n}` : '')).filter(Boolean);
  return [s.notes, ...ends].filter(Boolean).join(' · ');
}

function noteLines(s) {
  const lines = [];
  if (s.notes) lines.push(`<span class="session-note">📝 ${escapeHtml(s.notes)}</span>`);
  (s.endNotes || []).forEach((n, i) => {
    if (n && s.ends[i]?.length) lines.push(`<span class="session-note"><span class="muted">End ${i + 1}:</span> ${escapeHtml(n)}</span>`);
  });
  return lines.join('');
}

// ---------- actions ----------

// Apply a scoring step from session.js to the open session, then save and redraw.
async function update(step, ...args) {
  step(active, ...args);
  await persist();
  renderPractice();
}

async function addArrow(value) {
  await update(S.addArrow, value);
  if (navigator.vibrate) navigator.vibrate(10);
}

const undo = () => update(S.undoArrow);
const setPosition = (pos) => update(S.setPosition, pos);

async function endDone() {
  if (S.currentEnd(active)) await update(S.closeEnd);
}

async function deleteEnd(index) {
  if (confirm(`Delete end ${index + 1}?`)) await update(S.deleteEnd, index);
}

// One dialog for both kinds of note. target is 'session' or an end index.
let noteTarget = null;

function openNote(target) {
  noteTarget = target;
  const isSession = target === 'session';
  const endNo = isSession ? 0 : target + 1;
  const shot = !isSession && target < active.ends.length;
  $('#note-title').textContent = isSession ? 'Session notes' : `Note on end ${endNo}`;
  $('#note-hint').textContent = isSession
    ? 'What you are working on in this session.'
    : shot ? 'Something you changed or noticed on this end.' : 'Something you are changing from this end on. It is saved with the next end you shoot.';
  $('#note-text').value = isSession ? active.notes || '' : S.endNote(active, target);
  $('#note-dialog').showModal();
  $('#note-text').focus();
}

async function saveNote() {
  const text = $('#note-text').value.trim();
  if (noteTarget === 'session') await update(S.setSessionNotes, text);
  else if (noteTarget !== null) await update(S.setEndNote, noteTarget, text);
  noteTarget = null;
}

async function finishSession() {
  if (!active.ends.length) {
    if (!confirm('No arrows scored. Discard this session?')) return;
    await storage.deleteSession(active.id);
  } else {
    active.completed = true;
    active.endOpen = false;
    progressSetup = setupKey(sessionSetup(active));
    await persist();
  }
  await storage.setActiveSessionId(null);
  active = null;
  showView('history');
}

// Pre-select the setup from the most recent session, since practice usually
// continues on the same round.
async function prefillSetup() {
  const form = $('#start-form');
  const sessions = await storage.listSessions();
  const lastSession = sessions[sessions.length - 1];
  const last = lastSession ? sessionSetup(lastSession) : DEFAULT_SETUP;
  form.distanceM.value = String(last.distanceM);
  form.targetCm.value = String(last.targetCm);
  form.position.value = POSITIONS.includes(lastSession?.position) ? lastSession.position : 'top';
}

async function startSession(form) {
  active = S.newSession({
    date: form.date.value || todayISO(),
    notes: form.notes.value.trim(),
    distanceM: Number(form.distanceM.value),
    targetCm: Number(form.targetCm.value),
    position: form.position.value,
  });
  await persist();
  await storage.setActiveSessionId(active.id);
  form.notes.value = '';
  renderPractice();
}

async function resumeSession(id) {
  if (active && active.id !== id) {
    if (!confirm('Close the session in progress and open this one?')) return;
  }
  active = await storage.getSession(id);
  if (!active) return;
  S.makeVariable(active);
  active.completed = false;
  await persist();
  await storage.setActiveSessionId(id);
  showView('practice');
}

async function deleteSession(id) {
  if (!confirm('Delete this session? This cannot be undone.')) return;
  await storage.deleteSession(id);
  if (active?.id === id) active = null;
  renderHistory();
}

async function exportData() {
  const data = await storage.exportAll();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `archery-pro-backup-${todayISO()}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

async function importData(file) {
  try {
    const count = await storage.importAll(JSON.parse(await file.text()));
    alert(`Imported ${count} session(s).`);
    renderHistory();
  } catch (err) {
    alert(`Could not import: ${err.message}`);
  }
}

// ---------- wiring ----------

function buildSetupOptions() {
  const form = $('#start-form');
  form.distanceM.innerHTML = DISTANCES_M.map((d) => `<option value="${d}">${d} m</option>`).join('');
  form.targetCm.innerHTML = TARGET_SIZES_CM.map((t) => `<option value="${t}">${t} cm</option>`).join('');
}

function buildKeypad() {
  $('#keypad').innerHTML = ARROW_VALUES.map(
    (v) => `<button class="key ${ringClass(v)}" data-arrow="${v}" aria-label="${v === 'M' ? 'Miss' : v === 'X' ? 'X (inner 10)' : v}">${v}</button>`
  ).join('');
}

async function init() {
  initTheme($('#theme-toggle'));
  buildKeypad();
  buildSetupOptions();

  const activeId = await storage.getActiveSessionId();
  if (activeId) active = await storage.getSession(activeId);
  if (active && S.makeVariable(active)) await persist();

  document.querySelectorAll('.tab').forEach((t) => t.addEventListener('click', () => showView(t.dataset.view)));
  $('#start-form').addEventListener('submit', (e) => {
    e.preventDefault();
    startSession(e.target);
  });
  $('#keypad').addEventListener('click', (e) => {
    const v = e.target.closest('[data-arrow]')?.dataset.arrow;
    if (v) addArrow(v);
  });
  $('#undo-btn').addEventListener('click', undo);
  $('#end-done-btn').addEventListener('click', endDone);
  $('#finish-btn').addEventListener('click', finishSession);
  initShareDialog();
  $('#end-note-btn').addEventListener('click', () => openNote(S.noteIndex(active)));
  $('#current-note').addEventListener('click', () => openNote(S.noteIndex(active)));
  $('#session-note-btn').addEventListener('click', () => openNote('session'));
  $('#note-cancel').addEventListener('click', () => $('#note-dialog').close());
  $('#note-form').addEventListener('submit', () => saveNote());
  $('#share-btn').addEventListener('click', () => openShare(active, longDate(active.date)));
  $('#position-toggle').addEventListener('click', (e) => {
    const pos = e.target.closest('[data-position]')?.dataset.position;
    if (pos) setPosition(pos);
  });
  $('#position-filter').addEventListener('click', (e) => {
    const pos = e.target.closest('[data-filter-position]')?.dataset.filterPosition;
    if (pos) {
      progressPosition = pos;
      renderHistory();
    }
  });
  $('#ends-body').addEventListener('click', (e) => {
    const i = e.target.closest('[data-delete-end]')?.dataset.deleteEnd;
    const n = e.target.closest('[data-edit-note]')?.dataset.editNote;
    if (i !== undefined) deleteEnd(Number(i));
    if (n !== undefined) openNote(Number(n));
  });
  $('#session-list').addEventListener('click', (e) => {
    const resume = e.target.closest('[data-resume]')?.dataset.resume;
    const del = e.target.closest('[data-delete-session]')?.dataset.deleteSession;
    const share = e.target.closest('[data-share]')?.dataset.share;
    if (share) storage.getSession(share).then((s) => s && openShare(s, longDate(s.date)));
    if (resume) resumeSession(resume);
    if (del) deleteSession(del);
  });
  $('#setup-filter').addEventListener('click', (e) => {
    const key = e.target.closest('[data-setup]')?.dataset.setup;
    if (key) {
      progressSetup = key;
      renderHistory();
    }
  });
  $('#export-btn').addEventListener('click', exportData);
  $('#import-input').addEventListener('change', (e) => {
    if (e.target.files[0]) importData(e.target.files[0]);
    e.target.value = '';
  });

  // Keyboard scoring on desktop: digits, 0 for 10, x, m, Enter to finish
  // the end, Backspace to undo.
  document.addEventListener('keydown', (e) => {
    if (!active || $('#view-practice').hidden || $('#share-dialog').open || $('#note-dialog').open || e.target.matches('input, select, textarea')) return;
    const k = e.key.toLowerCase();
    if (k === 'x') addArrow('X');
    else if (k === 'm') addArrow('M');
    else if (k === '0') addArrow('10');
    else if (/^[1-9]$/.test(k)) addArrow(k);
    else if (k === 'backspace') undo();
    else if (k === 'enter') endDone();
    else return;
    // Stop Enter from also pressing whichever keypad button has focus.
    e.preventDefault();
  });

  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => (!$('#view-history').hidden ? renderHistory() : active && renderPractice()), 150);
  });

  showView('practice');
}

init();
