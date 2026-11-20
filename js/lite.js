// Archery Pro Lite: the archer enters raw scores end by end and never sees
// a total, average or graph (the tally is folded away until tapped). Sessions are kept separately from the
// main app and sent to the coach as plain text (or a data file the coach can
// import into the main app).

import { createLocalStorage } from './storage.js?v=17';
import {
  ARROW_VALUES, ringClass, isEndOpen, TARGET_SIZES_CM, DISTANCES_M,
  DEFAULT_SETUP, sessionSetup, setupLabel, POSITIONS, POSITION_LABELS, endPosition,
} from './scoring.js?v=17';
import * as S from './session.js?v=17';
import { tallyRows } from './tally.js?v=17';
import { initTheme } from './theme.js?v=17';
import { initShareDialog, openShare } from './share.js?v=17';

const storage = createLocalStorage('archeryProLite');
const $ = (sel) => document.querySelector(sel);
const SLOTS_SHOWN = 12; // arrow boxes reserved for the current end

let active = null;

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

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

function share(session) {
  openShare(session, longDate(session.date));
}

// ---------- rendering ----------

async function render() {
  $('#start-form').hidden = !!active;
  $('#active-session').hidden = !active;
  if (!active) return renderStart();

  $('#past-card').hidden = true;
  $('#session-title').textContent = longDate(active.date);
  $('#session-notes').textContent = [setupLabel(sessionSetup(active)), active.notes].filter(Boolean).join(' · ');

  const cur = S.currentEnd(active) || [];
  $('#end-number').textContent = `End ${S.currentEnd(active) ? active.ends.length : active.ends.length + 1}`;
  $('#end-count').textContent = cur.length ? plural(cur.length, 'arrow') : '';
  document.querySelectorAll('#position-toggle [data-position]').forEach((b) =>
    b.setAttribute('aria-checked', String(b.dataset.position === S.currentPosition(active))));

  $('#current-end').innerHTML = Array.from({ length: cur.length <= SLOTS_SHOWN ? SLOTS_SHOWN : cur.length + 1 }, (_, i) =>
    cur[i] ? `<span class="slot filled ${ringClass(cur[i])}">${cur[i]}</span>` : `<span class="slot${i === cur.length ? ' next' : ''}"></span>`
  ).join('');
  $('#undo-btn').disabled = active.ends.length === 0;
  $('#end-done-btn').disabled = cur.length === 0;

  // Raw arrows only, newest end first.
  const openIndex = isEndOpen(active) ? active.ends.length - 1 : -1;
  $('#ends-body').innerHTML = active.ends.map((end, i) => {
    const pos = endPosition(active, i);
    return `<tr class="${i === openIndex ? 'partial' : ''}">
      <td>${i + 1}${pos ? `<span class="pos-badge" title="${POSITION_LABELS[pos]}">${POSITION_LABELS[pos][0]}</span>` : ''}</td>
      <td class="chips">${end.map((v) => `<span class="chip ${ringClass(v)}">${v}</span>`).join('')}</td>
      <td><button class="icon-btn" data-delete-end="${i}" aria-label="Delete end ${i + 1}">✕</button></td>
    </tr>`;
  }).reverse().join('');
  $('#ends-empty').hidden = active.ends.length > 0;

  // Tally stays folded away unless the archer opens it.
  const total = active.ends.flat().length;
  $('#tally-total').textContent = total ? plural(total, 'arrow') : '';
  $('#tally').innerHTML = tallyRows(active);
}

async function renderStart() {
  const form = $('#start-form');
  form.date.value = todayISO();
  const sessions = (await storage.listSessions()).filter((s) => s.ends.some((e) => e.length));
  const last = sessions[sessions.length - 1];
  const setup = last ? sessionSetup(last) : DEFAULT_SETUP;
  form.distanceM.value = String(setup.distanceM);
  form.targetCm.value = String(setup.targetCm);
  form.position.value = POSITIONS.includes(last?.position) ? last.position : 'top';

  $('#past-card').hidden = sessions.length === 0;
  $('#session-list').innerHTML = sessions.slice().reverse().map((s) => {
    const ends = s.ends.filter((e) => e.length);
    return `<li class="session-item">
      <div class="session-main">
        <strong>${longDate(s.date)}</strong>
        <span class="muted">${setupLabel(sessionSetup(s))}${s.notes ? ` · ${escapeHtml(s.notes)}` : ''} · ${plural(ends.length, 'end')} · ${plural(ends.flat().length, 'arrow')}</span>
      </div>
      <div class="session-actions">
        <button class="secondary small" data-share="${s.id}">Send to coach</button>
        <button class="icon-btn" data-delete-session="${s.id}" aria-label="Delete session">✕</button>
      </div>
    </li>`;
  }).join('');
}

// ---------- actions ----------

async function update(step, ...args) {
  step(active, ...args);
  active = await storage.saveSession(active);
  render();
}

async function startSession(form) {
  active = S.newSession({
    date: form.date.value || todayISO(),
    notes: form.notes.value.trim(),
    distanceM: Number(form.distanceM.value),
    targetCm: Number(form.targetCm.value),
    position: form.position.value,
    lite: true,
  });
  active = await storage.saveSession(active);
  await storage.setActiveSessionId(active.id);
  $('#tally-card').open = false;
  form.notes.value = '';
  render();
}

// Finishing saves the session and goes straight to sending it.
async function finishSession() {
  const done = active;
  if (!done.ends.length) {
    if (!confirm('No arrows scored. Discard this session?')) return;
    await storage.deleteSession(done.id);
  } else {
    done.completed = true;
    done.endOpen = false;
    await storage.saveSession(done);
  }
  await storage.setActiveSessionId(null);
  active = null;
  await render();
  if (done.ends.length) share(done);
}

// ---------- wiring ----------

async function init() {
  initTheme($('#theme-toggle'));
  initShareDialog();

  const form = $('#start-form');
  form.distanceM.innerHTML = DISTANCES_M.map((d) => `<option value="${d}">${d} m</option>`).join('');
  form.targetCm.innerHTML = TARGET_SIZES_CM.map((t) => `<option value="${t}">${t} cm</option>`).join('');
  $('#keypad').innerHTML = ARROW_VALUES.map(
    (v) => `<button class="key ${ringClass(v)}" data-arrow="${v}" aria-label="${v === 'M' ? 'Miss' : v === 'X' ? 'X (inner 10)' : v}">${v}</button>`
  ).join('');

  const activeId = await storage.getActiveSessionId();
  if (activeId) active = await storage.getSession(activeId);
  if (active && S.makeVariable(active)) active = await storage.saveSession(active);

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    startSession(form);
  });
  $('#keypad').addEventListener('click', (e) => {
    const v = e.target.closest('[data-arrow]')?.dataset.arrow;
    if (v) {
      update(S.addArrow, v);
      if (navigator.vibrate) navigator.vibrate(10);
    }
  });
  $('#undo-btn').addEventListener('click', () => update(S.undoArrow));
  $('#end-done-btn').addEventListener('click', () => S.currentEnd(active) && update(S.closeEnd));
  $('#position-toggle').addEventListener('click', (e) => {
    const pos = e.target.closest('[data-position]')?.dataset.position;
    if (pos) update(S.setPosition, pos);
  });
  $('#finish-btn').addEventListener('click', finishSession);
  $('#ends-body').addEventListener('click', (e) => {
    const i = e.target.closest('[data-delete-end]')?.dataset.deleteEnd;
    if (i !== undefined && confirm(`Delete end ${Number(i) + 1}?`)) update(S.deleteEnd, Number(i));
  });
  $('#session-list').addEventListener('click', async (e) => {
    const shareId = e.target.closest('[data-share]')?.dataset.share;
    const delId = e.target.closest('[data-delete-session]')?.dataset.deleteSession;
    if (shareId) {
      const s = await storage.getSession(shareId);
      if (s) share(s);
    }
    if (delId && confirm('Delete this session? This cannot be undone.')) {
      await storage.deleteSession(delId);
      render();
    }
  });

  // Keyboard scoring: digits, 0 for 10, x, m, Enter to finish the end,
  // Backspace to undo.
  document.addEventListener('keydown', (e) => {
    if (!active || $('#share-dialog').open || e.target.matches('input, select, textarea')) return;
    const k = e.key.toLowerCase();
    const value = k === 'x' ? 'X' : k === 'm' ? 'M' : k === '0' ? '10' : /^[1-9]$/.test(k) ? k : null;
    if (value) update(S.addArrow, value);
    else if (k === 'backspace') update(S.undoArrow);
    else if (k === 'enter') S.currentEnd(active) && update(S.closeEnd);
    else return;
    e.preventDefault();
  });

  render();
}

init();
