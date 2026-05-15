/**
 * questionHistory — Cross-game question rotation via localStorage.
 * Stores recently used question IDs so consecutive games avoid repeating them.
 * Max size: 50 IDs. Oldest entries are evicted when the cap is reached.
 */

const HISTORY_KEY = 'kronox_question_history_v1';
const MAX_HISTORY = 50;

/** Returns the current recent-question ID array from localStorage. */
export function loadRecentHistory() {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) {
    return [];
  }
}

/** Appends new IDs to history, capping at MAX_HISTORY. */
export function appendToHistory(ids) {
  if (!ids || ids.length === 0) return;
  try {
    const current = loadRecentHistory();
    const combined = [...current, ...ids];
    // Keep only the most recent MAX_HISTORY entries
    const trimmed = combined.slice(-MAX_HISTORY);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(trimmed));
  } catch (_) {
    // localStorage unavailable — silently skip
  }
}

/** Clears the history (e.g. for testing). */
export function clearRecentHistory() {
  try { localStorage.removeItem(HISTORY_KEY); } catch (_) {}
}