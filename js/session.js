// Scoring steps on a session object, shared by the main app and the Lite
// page. Each function changes the session in place; the caller saves it.

import { isEndOpen, plannedArrows, POSITIONS } from './scoring.js?v=17';

// Every end is open until the archer taps End done, so ends can have any
// number of arrows (arrowsPerEnd 0).
export function newSession({ date, notes = '', distanceM, targetCm, position, lite = false }) {
  return {
    id: (crypto.randomUUID && crypto.randomUUID()) || `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    date,
    notes,
    arrowsPerEnd: 0,
    distanceM,
    targetCm,
    position,
    lite,
    ends: [],
    endPositions: [],
    endNotes: [],
    endOpen: false,
    completed: false,
    createdAt: new Date().toISOString(),
  };
}

// The end being filled in, or null if the next arrow starts a new end.
export function currentEnd(session) {
  return isEndOpen(session) ? session.ends[session.ends.length - 1] : null;
}

// Position for new ends: the session's current choice, defaulting to top.
export function currentPosition(session) {
  return POSITIONS.includes(session.position) ? session.position : 'top';
}

export function addArrow(session, value) {
  let cur = currentEnd(session);
  if (cur) cur.push(value);
  else {
    session.ends.push((cur = [value]));
    session.endPositions = session.endPositions || [];
    session.endPositions[session.ends.length - 1] = currentPosition(session);
  }
  // With a planned count, the end closes by itself once it's reached;
  // otherwise it stays open until "End done".
  const planned = plannedArrows(session);
  session.endOpen = !(planned && cur.length >= planned);
}

export function undoArrow(session) {
  const last = session.ends[session.ends.length - 1];
  if (!last) return;
  last.pop();
  // Undo reopens the end it came from, so the archer can re-score that arrow.
  if (last.length) session.endOpen = true;
  else {
    session.ends.pop();
    if (session.endPositions) session.endPositions.length = Math.min(session.endPositions.length, session.ends.length);
    // A note on the removed end stays put for the next end shot in its place.
    if (session.endNotes) session.endNotes.length = Math.min(session.endNotes.length, session.ends.length + 1);
    session.endOpen = false;
  }
}

export function deleteEnd(session, index) {
  if (index === session.ends.length - 1) session.endOpen = false;
  session.ends.splice(index, 1);
  if (session.endPositions) session.endPositions.splice(index, 1);
  if (session.endNotes) session.endNotes.splice(index, 1);
}

export function closeEnd(session) {
  session.endOpen = false;
}

// Index of the end a new note belongs to: the end being shot, or the next
// one if no end is open.
export function noteIndex(session) {
  return currentEnd(session) ? session.ends.length - 1 : session.ends.length;
}

export function endNote(session, index) {
  return (session.endNotes && session.endNotes[index]) || '';
}

// Set (or clear, with an empty string) the note on one end.
export function setEndNote(session, index, text) {
  session.endNotes = session.endNotes || [];
  while (session.endNotes.length < index) session.endNotes.push('');
  session.endNotes[index] = text;
  while (session.endNotes.length && !session.endNotes[session.endNotes.length - 1]) session.endNotes.pop();
}

export function setSessionNotes(session, text) {
  session.notes = text;
}

// Switch between the top and bottom target. Applies to the end being shot
// (if one is open) and every end after it.
export function setPosition(session, pos) {
  session.position = pos;
  if (currentEnd(session)) {
    session.endPositions = session.endPositions || [];
    session.endPositions[session.ends.length - 1] = pos;
  }
}

// Sessions started when ends had a fixed arrow count switch to variable
// ends when they're opened again. Returns true if anything changed.
export function makeVariable(session) {
  if (!plannedArrows(session)) return false;
  session.endOpen = isEndOpen(session);
  session.arrowsPerEnd = 0;
  return true;
}
