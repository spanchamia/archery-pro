// Tally marks for every score value in a session, drawn in gates of five.
// Shared by the main app and the Lite page.

import { ARROW_VALUES, ringClass } from './scoring.js?v=17';

function tallyMarks(n) {
  const stroke = (x) => `<line x1="${x}" y1="3" x2="${x}" y2="21"/>`;
  const group = (count) => {
    const lines = Array.from({ length: Math.min(count, 4) }, (_, i) => stroke(4 + i * 6)).join('');
    const gate = count === 5 ? '<line x1="0" y1="18" x2="26" y2="6"/>' : '';
    return `<svg class="tally-group" viewBox="0 0 26 24" width="26" height="24" aria-hidden="true">${lines}${gate}</svg>`;
  };
  const groups = [];
  for (let left = n; left > 0; left -= 5) groups.push(group(Math.min(left, 5)));
  return groups.join('');
}

// Rows for the tally card, lowest score first: M, 1, 2 … 10, X.
export function tallyRows(session) {
  const counts = Object.fromEntries(ARROW_VALUES.map((v) => [v, 0]));
  for (const a of session.ends.flat()) counts[a] += 1;
  return [...ARROW_VALUES].reverse().map((v) => `<div class="tally-row${counts[v] ? '' : ' zero'}">
      <span class="chip ${ringClass(v)}">${v}</span>
      <span class="tally-marks" aria-label="${counts[v]} × ${v === 'M' ? 'miss' : v}">${tallyMarks(counts[v])}</span>
      <span class="tally-count">${counts[v]}</span>
    </div>`).join('');
}
