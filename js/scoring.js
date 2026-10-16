// Indoor 10-ring scoring. X counts as 10 (and is tracked separately for
// tie-breaks); M is a miss worth 0.

export const ARROW_VALUES = ['X', '10', '9', '8', '7', '6', '5', '4', '3', '2', '1', 'M'];

export function arrowScore(value) {
  if (value === 'X') return 10;
  if (value === 'M') return 0;
  return Number(value);
}

export function endTotal(end) {
  return end.reduce((sum, a) => sum + arrowScore(a), 0);
}

// Whether the last end is still being shot. Sessions saved before ends could
// vary in length have no `endOpen` flag, so fall back to the fixed count.
export function isEndOpen(session) {
  const last = session.ends[session.ends.length - 1];
  if (!last || !last.length) return false;
  if (typeof session.endOpen === 'boolean') return session.endOpen;
  return last.length < session.arrowsPerEnd;
}

// Planned arrows per end, or 0 when the archer ends each end by hand.
export function plannedArrows(session) {
  return Number(session.arrowsPerEnd) || 0;
}

export function sessionStats(session) {
  const arrows = session.ends.flat();
  const total = arrows.reduce((sum, a) => sum + arrowScore(a), 0);
  const completeEnds = isEndOpen(session) ? session.ends.slice(0, -1) : session.ends;
  return {
    ends: completeEnds.length,
    arrows: arrows.length,
    total,
    avgArrow: arrows.length ? total / arrows.length : null,
    avgEnd: completeEnds.length ? completeEnds.reduce((s, e) => s + endTotal(e), 0) / completeEnds.length : null,
    xs: arrows.filter((a) => a === 'X').length,
    tens: arrows.filter((a) => a === 'X' || a === '10').length,
    misses: arrows.filter((a) => a === 'M').length,
  };
}

// Target face ring colour for an arrow value, used for the keypad and chips.
export function ringClass(value) {
  if (value === 'X' || value === '10' || value === '9') return 'ring-gold';
  if (value === '8' || value === '7') return 'ring-red';
  if (value === '6' || value === '5') return 'ring-blue';
  if (value === '4' || value === '3') return 'ring-black';
  if (value === '2' || value === '1') return 'ring-white';
  return 'ring-miss';
}

export function fmt(n, digits = 2) {
  return n === null || n === undefined ? '–' : n.toFixed(digits);
}

// Competition setups. Sessions saved before setups existed count as the
// indoor 18m / 40cm round.
export const TARGET_SIZES_CM = [40, 60, 80, 120];
export const DISTANCES_M = [18, 30, 60, 72];
export const DEFAULT_SETUP = { distanceM: 18, targetCm: 40 };

export function sessionSetup(session) {
  return {
    distanceM: Number(session.distanceM) || DEFAULT_SETUP.distanceM,
    targetCm: Number(session.targetCm) || DEFAULT_SETUP.targetCm,
  };
}

export function setupKey(setup) {
  return `${setup.distanceM}m-${setup.targetCm}cm`;
}

export function setupLabel(setup) {
  return `${setup.distanceM}m · ${setup.targetCm}cm`;
}
