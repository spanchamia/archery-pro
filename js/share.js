// Plain-text export of a session's raw scores for sending to a coach, and the
// share dialog both pages use to send it.

import { POSITION_LABELS, endPosition, sessionSetup } from './scoring.js?v=16';

export function rawScoresText(session, dateLabel) {
  const { distanceM, targetCm } = sessionSetup(session);
  const lines = [
    'Archery Pro practice scores',
    `Date: ${dateLabel}`,
    `Distance: ${distanceM} m`,
    `Target size: ${targetCm} cm`,
  ];
  if (session.notes) lines.push(`Notes: ${session.notes}`);
  if (session.lite || session.blind) lines.push('Scored without seeing running scores (Archery Pro Lite)');
  lines.push('');

  const ends = session.ends.filter((e) => e.length);
  session.ends.forEach((end, i) => {
    if (!end.length) return;
    const pos = endPosition(session, i);
    lines.push(`End ${i + 1}${pos ? ` (${POSITION_LABELS[pos]})` : ''}: ${end.join(', ')}`);
  });
  const arrows = ends.reduce((n, e) => n + e.length, 0);
  lines.push('', `${arrows} arrow${arrows === 1 ? '' : 's'} in ${ends.length} end${ends.length === 1 ? '' : 's'}`);
  return lines.join('\n');
}

function baseFilename(session) {
  const { distanceM, targetCm } = sessionSetup(session);
  return `archery-scores-${session.date}-${distanceM}m-${targetCm}cm`;
}

function download(content, type, filename) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([content], { type }));
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// ---------- share dialog ----------

const $ = (sel) => document.querySelector(sel);
let shareSession = null;

export function initShareDialog() {
  $('#share-native').addEventListener('click', async () => {
    try {
      await navigator.share({ title: `Archery scores ${shareSession.date}`, text: $('#share-text').value });
    } catch {
      // Cancelled, or sharing isn't available; the other buttons still work.
    }
  });
  $('#share-download').addEventListener('click', () =>
    download(`${$('#share-text').value}\n`, 'text/plain', `${baseFilename(shareSession)}.txt`));
  // Same format as the main app's "Export backup", so it can be loaded there
  // with "Import backup" to see averages and graphs.
  $('#share-json')?.addEventListener('click', () =>
    download(
      JSON.stringify({ app: 'archery-pro', version: 1, exportedAt: new Date().toISOString(), sessions: [shareSession] }, null, 2),
      'application/json',
      `${baseFilename(shareSession)}.json`
    ));
  $('#share-copy').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText($('#share-text').value);
    } catch {
      $('#share-text').select();
      document.execCommand('copy');
    }
    $('#share-copy').textContent = 'Copied ✓';
  });
  $('#share-close').addEventListener('click', () => $('#share-dialog').close());
}

export function openShare(session, dateLabel) {
  shareSession = session;
  const text = rawScoresText(session, dateLabel);
  $('#share-text').value = text;
  $('#share-email').href = `mailto:?subject=${encodeURIComponent(`Archery scores ${session.date}`)}&body=${encodeURIComponent(text)}`;
  $('#share-native').hidden = !navigator.share;
  $('#share-copy').textContent = 'Copy';
  $('#share-dialog').showModal();
}
