// Plain-text export of a session's raw scores, for sending to a coach.

import { POSITION_LABELS, endPosition, sessionSetup } from './scoring.js?v=12';

export function rawScoresText(session, dateLabel) {
  const { distanceM, targetCm } = sessionSetup(session);
  const lines = [
    'Archery Pro practice scores',
    `Date: ${dateLabel}`,
    `Distance: ${distanceM} m`,
    `Target size: ${targetCm} cm`,
  ];
  if (session.notes) lines.push(`Notes: ${session.notes}`);
  if (session.blind) lines.push('Shot in blind mode (no running scores shown)');
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

export function rawScoresFilename(session) {
  const { distanceM, targetCm } = sessionSetup(session);
  return `archery-scores-${session.date}-${distanceM}m-${targetCm}cm.txt`;
}
