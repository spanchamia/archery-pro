// Storage layer for Archery Pro.
//
// Everything the app persists goes through this module. Today it is backed by
// the browser's localStorage. To move to a backend database later, write a new
// adapter with the same async methods (e.g. one that calls a REST API) and
// export it as `storage` instead. The rest of the app does not need to change.

const SESSIONS_KEY = 'archeryPro.sessions.v1';
const ACTIVE_KEY = 'archeryPro.activeSessionId';

function readAll() {
  try {
    const raw = localStorage.getItem(SESSIONS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAll(sessions) {
  localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
}

const localStorageAdapter = {
  async listSessions() {
    return readAll().sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt));
  },

  async getSession(id) {
    return readAll().find((s) => s.id === id) || null;
  },

  async saveSession(session) {
    const sessions = readAll();
    const updated = { ...session, updatedAt: new Date().toISOString() };
    const i = sessions.findIndex((s) => s.id === session.id);
    if (i === -1) sessions.push(updated);
    else sessions[i] = updated;
    writeAll(sessions);
    return updated;
  },

  async deleteSession(id) {
    writeAll(readAll().filter((s) => s.id !== id));
    if ((await this.getActiveSessionId()) === id) await this.setActiveSessionId(null);
  },

  async getActiveSessionId() {
    try {
      return localStorage.getItem(ACTIVE_KEY);
    } catch {
      return null;
    }
  },

  async setActiveSessionId(id) {
    if (id) localStorage.setItem(ACTIVE_KEY, id);
    else localStorage.removeItem(ACTIVE_KEY);
  },

  // Backup / restore as plain JSON so data can be moved between browsers
  // or migrated into a database later.
  async exportAll() {
    return { app: 'archery-pro', version: 1, exportedAt: new Date().toISOString(), sessions: readAll() };
  },

  async importAll(data) {
    const incoming = Array.isArray(data) ? data : data && data.sessions;
    if (!Array.isArray(incoming)) throw new Error('File does not contain any sessions.');
    const byId = new Map(readAll().map((s) => [s.id, s]));
    for (const s of incoming) {
      if (s && s.id && s.date && Array.isArray(s.ends)) byId.set(s.id, s);
    }
    writeAll([...byId.values()]);
    return incoming.length;
  },
};

export const storage = localStorageAdapter;
