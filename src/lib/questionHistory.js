/**
 * questionHistory — Cross-game question rotation via localStorage.
 * Stores recently shown question IDs so consecutive games prefer broader
 * exposure. The public API remains ID-array compatible, while the stored
 * shape now preserves timestamp/count signals for soft Solo deck weighting.
 */

const HISTORY_KEY = 'kronox_question_history_v1';
const HISTORY_VERSION = 2;
const MAX_RECENT_IDS = 320;
const MAX_HISTORY_EVENTS = 900;
const MAX_HISTORY_AGE_MS = 45 * 24 * 60 * 60 * 1000;

function normalizeQuestionId(value) {
  const id = String(value ?? '').trim();
  return id || null;
}

function normalizeTimestamp(value, fallback) {
  const numeric = Number(value);
  if (Number.isFinite(numeric) && numeric > 0) return numeric;
  const parsed = Date.parse(String(value || ''));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function trimEvents(events, now = Date.now()) {
  const cutoff = now - MAX_HISTORY_AGE_MS;
  return (events || [])
    .map((entry) => {
      const id = normalizeQuestionId(entry?.id ?? entry?.questionId ?? entry);
      if (!id) return null;
      return {
        id,
        shownAt: normalizeTimestamp(entry?.shownAt ?? entry?.shown_at, now),
      };
    })
    .filter((entry) => entry && entry.shownAt >= cutoff)
    .slice(-MAX_HISTORY_EVENTS);
}

function parseHistoryEvents(raw, now = Date.now()) {
  if (!raw) return [];
  const parsed = JSON.parse(raw);
  if (Array.isArray(parsed)) {
    const start = Math.max(0, now - parsed.length * 1000);
    return trimEvents(parsed.map((id, index) => ({ id, shownAt: start + index * 1000 })), now);
  }
  if (parsed && typeof parsed === 'object') {
    const events = Array.isArray(parsed.events)
      ? parsed.events
      : (Array.isArray(parsed.entries) ? parsed.entries : []);
    return trimEvents(events, now);
  }
  return [];
}

function readHistoryEvents() {
  try {
    return parseHistoryEvents(localStorage.getItem(HISTORY_KEY));
  } catch (_) {
    return [];
  }
}

function writeHistoryEvents(events) {
  try {
    const now = Date.now();
    localStorage.setItem(HISTORY_KEY, JSON.stringify({
      version: HISTORY_VERSION,
      updatedAt: now,
      events: trimEvents(events, now),
    }));
  } catch (_) {
    // localStorage unavailable/full — silently skip. Gameplay must continue.
  }
}

/** Returns the current recent-question ID array from localStorage. */
export function loadRecentHistory() {
  const events = readHistoryEvents();
  const seen = new Set();
  const recent = [];
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const id = events[index]?.id;
    if (!id || seen.has(id)) continue;
    seen.add(id);
    recent.push(id);
    if (recent.length >= MAX_RECENT_IDS) break;
  }
  return recent;
}

/** Returns count/recency signals for soft Solo exposure cooldown scoring. */
export function loadRecentQuestionExposureStats() {
  const events = readHistoryEvents();
  const stats = {};
  let recentRank = 0;
  const ranked = new Set();
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index];
    const id = normalizeQuestionId(event?.id);
    if (!id) continue;
    if (!stats[id]) {
      stats[id] = {
        questionId: id,
        shownCount: 0,
        lastShownAt: 0,
        recentRank: null,
        source: 'local_recent_history',
      };
    }
    stats[id].shownCount += 1;
    stats[id].lastShownAt = Math.max(stats[id].lastShownAt, Number(event.shownAt) || 0);
    if (!ranked.has(id)) {
      ranked.add(id);
      stats[id].recentRank = recentRank;
      recentRank += 1;
    }
  }
  return stats;
}

/** Appends new IDs to history, capping by count and age. */
export function appendToHistory(ids, options = {}) {
  if (!ids) return;
  const values = (Array.isArray(ids) || ids instanceof Set) ? Array.from(ids) : [ids];
  if (values.length === 0) return;
  const shownAt = normalizeTimestamp(options.shownAt ?? options.shown_at, Date.now());
  const additions = values
    .map((id, index) => {
      const normalized = normalizeQuestionId(id);
      return normalized ? { id: normalized, shownAt: shownAt + index } : null;
    })
    .filter(Boolean);
  if (!additions.length) return;
  writeHistoryEvents([...readHistoryEvents(), ...additions]);
}

/** Clears the history (e.g. for testing). */
export function clearRecentHistory() {
  try { localStorage.removeItem(HISTORY_KEY); } catch (_) {}
}

export const questionHistoryContract = Object.freeze({
  storageKey: HISTORY_KEY,
  version: HISTORY_VERSION,
  maxRecentIds: MAX_RECENT_IDS,
  maxHistoryEvents: MAX_HISTORY_EVENTS,
  maxHistoryAgeDays: Math.round(MAX_HISTORY_AGE_MS / (24 * 60 * 60 * 1000)),
  softCooldownOnly: true,
});
