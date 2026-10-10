import { storage } from './storage.js';
import { ARROW_VALUES, endTotal, sessionStats, ringClass, fmt } from './scoring.js';
import { renderLineChart } from './chart.js';
import { initTheme } from './theme.js';

const $ = (sel) => document.querySelector(sel);

let active = null; // the session currently being scored

// ---------- helpers ----------

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function longDate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

function newId() {
  return (crypto.randomUUID && crypto.randomUUID()) || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
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

// The end being filled in: the last end if it isn't full yet.
function currentEnd() {
  const last = active.ends[active.ends.length - 1];
  return last && last.length < active.arrowsPerEnd ? last : null;
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
    return;
  }

  $('#session-title').textContent = longDate(active.date);
  $('#session-notes').textContent = active.notes || `${active.arrowsPerEnd} arrows per end`;

  const st = sessionStats(active);
  $('#live-stats').innerHTML = statTiles([
    ['Avg / arrow', fmt(st.avgArrow)],
    ['Avg / end', fmt(st.avgEnd, 1)],
    ['Total', st.total],
    ['Ends', st.ends],
    ['10s (X)', `${st.tens} (${st.xs})`],
  ]);

  // Current end slots.
  const cur = currentEnd() || [];
  const endNo = currentEnd() ? active.ends.length : active.ends.length + 1;
  $('#end-number').textContent = `End ${endNo}`;
  $('#end-running').textContent = cur.length ? `${endTotal(cur)} so far` : '';
  $('#current-end').innerHTML = Array.from({ length: active.arrowsPerEnd }, (_, i) =>
    cur[i] ? `<span class="slot filled ${ringClass(cur[i])}">${cur[i]}</span>` : `<span class="slot${i === cur.length ? ' next' : ''}"></span>`
  ).join('');

  $('#undo-btn').disabled = active.ends.length === 0;

  // Ends table, newest first.
  let running = 0;
  const rows = active.ends.map((end, i) => {
    running += endTotal(end);
    return `<tr class="${end.length < active.arrowsPerEnd ? 'partial' : ''}">
      <td>${i + 1}</td>
      <td class="chips">${end.map(chip).join('')}</td>
      <td class="num">${endTotal(end)}</td>
      <td class="num muted">${running}</td>
      <td><button class="icon-btn" data-delete-end="${i}" aria-label="Delete end ${i + 1}">✕</button></td>
    </tr>`;
  });
  $('#ends-body').innerHTML = rows.reverse().join('');
  $('#ends-empty').hidden = active.ends.length > 0;
}

async function renderHistory() {
  const sessions = (await storage.listSessions()).filter((s) => s.ends.some((e) => e.length));
  const withStats = sessions.map((s) => ({ s, st: sessionStats(s) }));

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
    withStats.map(({ s, st }) => ({ date: s.date, value: st.avgArrow, label: s.notes || '' }))
  );

  $('#sessions-empty').hidden = sessions.length > 0;
  $('#session-list').innerHTML = withStats
    .slice()
    .reverse()
    .map(({ s, st }) => `<li class="session-item">
      <div class="session-main">
        <strong>${longDate(s.date)}</strong>${s.id === active?.id ? ' <span class="badge">in progress</span>' : ''}
        <span class="muted">${s.notes ? `${escapeHtml(s.notes)} · ` : ''}${st.ends} ends · ${st.arrows} arrows</span>
      </div>
      <div class="session-score">
        <span class="stat-value">${fmt(st.avgArrow)}</span>
        <span class="muted">${st.total} pts · ${st.tens} 10s</span>
      </div>
      <div class="session-actions">
        <button class="secondary small" data-resume="${s.id}">${s.id === active?.id ? 'Continue' : 'Open'}</button>
        <button class="icon-btn" data-delete-session="${s.id}" aria-label="Delete session">✕</button>
      </div>
    </li>`)
    .join('');
}

// ---------- actions ----------

async function addArrow(value) {
  const cur = currentEnd();
  if (cur) cur.push(value);
  else active.ends.push([value]);
  await persist();
  renderPractice();
  if (navigator.vibrate) navigator.vibrate(10);
}

async function undo() {
  const last = active.ends[active.ends.length - 1];
  if (!last) return;
  last.pop();
  if (!last.length) active.ends.pop();
  await persist();
  renderPractice();
}

async function deleteEnd(index) {
  if (!confirm(`Delete end ${index + 1}?`)) return;
  active.ends.splice(index, 1);
  await persist();
  renderPractice();
}

async function finishSession() {
  const cur = currentEnd();
  if (cur && !confirm(`End ${active.ends.length} only has ${cur.length} of ${active.arrowsPerEnd} arrows. Finish anyway?`)) return;
  if (!active.ends.length) {
    if (!confirm('No arrows scored. Discard this session?')) return;
    await storage.deleteSession(active.id);
  } else {
    active.completed = true;
    await persist();
  }
  await storage.setActiveSessionId(null);
  active = null;
  showView('history');
}

async function startSession(form) {
  const now = new Date().toISOString();
  active = {
    id: newId(),
    date: form.date.value || todayISO(),
    notes: form.notes.value.trim(),
    arrowsPerEnd: Number(form.arrowsPerEnd.value) || 3,
    ends: [],
    completed: false,
    createdAt: now,
  };
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

function buildKeypad() {
  $('#keypad').innerHTML = ARROW_VALUES.map(
    (v) => `<button class="key ${ringClass(v)}" data-arrow="${v}" aria-label="${v === 'M' ? 'Miss' : v === 'X' ? 'X (inner 10)' : v}">${v}</button>`
  ).join('');
}

async function init() {
  initTheme($('#theme-toggle'));
  buildKeypad();

  const activeId = await storage.getActiveSessionId();
  if (activeId) active = await storage.getSession(activeId);

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
  $('#finish-btn').addEventListener('click', finishSession);
  $('#ends-body').addEventListener('click', (e) => {
    const i = e.target.closest('[data-delete-end]')?.dataset.deleteEnd;
    if (i !== undefined) deleteEnd(Number(i));
  });
  $('#session-list').addEventListener('click', (e) => {
    const resume = e.target.closest('[data-resume]')?.dataset.resume;
    const del = e.target.closest('[data-delete-session]')?.dataset.deleteSession;
    if (resume) resumeSession(resume);
    if (del) deleteSession(del);
  });
  $('#export-btn').addEventListener('click', exportData);
  $('#import-input').addEventListener('change', (e) => {
    if (e.target.files[0]) importData(e.target.files[0]);
    e.target.value = '';
  });

  // Keyboard scoring on desktop: digits, 0 for 10, x, m, backspace to undo.
  document.addEventListener('keydown', (e) => {
    if (!active || $('#view-practice').hidden || e.target.matches('input, select, textarea')) return;
    const k = e.key.toLowerCase();
    if (k === 'x') addArrow('X');
    else if (k === 'm') addArrow('M');
    else if (k === '0') addArrow('10');
    else if (/^[1-9]$/.test(k)) addArrow(k);
    else if (k === 'backspace') undo();
  });

  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => !$('#view-history').hidden && renderHistory(), 150);
  });

  showView('practice');
}

init();
