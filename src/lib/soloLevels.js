// Codex111 — Solo Level Path data + progress helper.
//
// PURPOSE
//   Single source of truth for:
//     1. The Solo level catalog (level numbers + titles).
//     2. Reading/writing per-user Solo progress.
//     3. Computing star count from mistake count.
//     4. Building the route-state config Game.jsx expects when a level
//        attempt starts.
//
// PERSISTENCE STRATEGY
//   Signed-in users → `User.solo_progress` (via base44.auth.updateMe).
//   Guest users     → localStorage["kx_solo_progress_v1"] fallback.
//   Both sources use the same compact shape:
//
//     { currentLevel: number,
//       levels: {
//         "1": {
//           bestStars, bestScore, bestScoreStars, bestScoreBaseScore,
//           bestScoreTimeBonus, bestMistakes, bestTimeSeconds, attempts,
//           completedAt, lastAttemptAt
//         }
//       },
//       summary: { currentLevel, unlockedLevel, totalSoloScore,
//                  completedLevelCount, totalStars, totalAttempts } }
//
//   We never blindly overwrite — `mergeBetterResult()` keeps the previous
//   best stars if a replay performs worse.
//
//   We intentionally do NOT touch User.hasCompletedTutorial or any other
//   profile field. Only `solo_progress` is read/written.
//
// SCOPE GUARDRAILS
//   - No backend functions added.
//   - Question generation, drag/drop, Timeline, GameLayout untouched.
//   - Online flow, lobby, invites, notifications untouched.

import { base44 } from '@/api/base44Client';
import {
  calculateSoloAttemptResult,
  calculateSoloStars,
  backfillSoloScores,
  getBestSoloLevelResult,
  getEffectiveUnlockedLevel,
  getHighestCompletedLevel,
  getLevelStatus,
  summarizeSoloProgress,
} from './soloProgressHelpers';

const STORAGE_KEY = 'kx_solo_progress_v1';

// ─── Constants surfaced to the rest of the app ─────────────────────────
export const SOLO_CARDS_PER_LEVEL = 10;
export const SOLO_LEVEL_TIME_SECONDS = 120;
export const SOLO_MAX_MISTAKES = 8; // 8+ → fail

// Codex108 — Solo Level Path is now a scrollable vertical adventure map
// with a 5-level "zone" theme rhythm. Catalog expanded to 20 so the player
// sees real upward progression. Easy to expand further: just add entries.
const TOTAL_LEVELS = 20;
const LEVEL_CATALOG = Array.from({ length: TOTAL_LEVELS }, (_, i) => ({
  levelNumber: i + 1,
  title: `Level ${i + 1}`,
}));

export function getSoloLevelCount() {
  return LEVEL_CATALOG.length;
}

// ─── Star calculation ──────────────────────────────────────────────────
/**
 * Maps mistake count to stars. Matches the product brief:
 *   0–1 → 3 stars, 2–4 → 2 stars, 5–7 → 1 star, 8+ → 0 (fail).
 * Also returns `passed` so the caller doesn't need to re-check.
 */
export function computeLevelStars(mistakes) {
  const { stars, passed } = calculateSoloStars(mistakes, SOLO_CARDS_PER_LEVEL, 0);
  return { stars, passed };
}

// ─── Storage helpers ───────────────────────────────────────────────────
function emptyProgress() {
  const progress = { currentLevel: 1, levels: {} };
  return { ...progress, summary: summarizeSoloProgress(progress, TOTAL_LEVELS) };
}

function normalizeProgressShapeWithMeta(raw) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const progress = {
    currentLevel: Math.max(1, Number(raw?.currentLevel) || 1),
    levels: (raw?.levels && typeof raw.levels === 'object') ? raw.levels : {},
  };
  return backfillSoloScores({ ...source, ...progress }, TOTAL_LEVELS);
}

export function normalizeSoloProgress(raw) {
  return normalizeProgressShapeWithMeta(raw).progress;
}

function normalizeProgressShape(raw) {
  return normalizeSoloProgress(raw);
}

function safeReadLocal() {
  if (typeof window === 'undefined') return emptyProgress();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyProgress();
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return emptyProgress();
    return normalizeProgressShape(parsed);
  } catch {
    return emptyProgress();
  }
}

function safeWriteLocal(progress) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizeProgressShape(progress)));
  } catch {
    /* quota or private mode — ignore */
  }
}

/**
 * Reads solo progress for the current user.
 *
 * Strategy (Codex106-24 fix for Bug 2 + Bug 3 — Level 2 not becoming current
 * and stars not showing on Level Path):
 *   - Always also read the localStorage mirror.
 *   - If both server-side `user.solo_progress` and localStorage exist, pick
 *     whichever shows MORE progress. We compare by (currentLevel,
 *     completed-level-count) so a stale server snapshot can't overwrite a
 *     fresh local one written milliseconds earlier by writeSoloProgress.
 *   - This is the safest minimal fix: writes still go to both stores via
 *     writeSoloProgress, reads just prefer the more-advanced of the two.
 *
 * Always returns a fully-shaped object so callers can do `.levels["1"]`
 * without null checks.
 */
export function readSoloProgress(user) {
  const fromLocal = safeReadLocal();
  const fromUser = (user && user.solo_progress && typeof user.solo_progress === 'object')
    ? normalizeProgressShape(user.solo_progress)
    : null;
  if (!fromUser) return fromLocal;
  return normalizeProgressShape(pickMoreAdvanced(fromUser, fromLocal));
}

function sameProgress(a, b) {
  return JSON.stringify(a || null) === JSON.stringify(b || null);
}

export async function ensureSoloProgressBackfill(user) {
  const progress = readSoloProgress(user || null);
  if (!user?.email) {
    safeWriteLocal(progress);
    return progress;
  }

  const userMeta = normalizeProgressShapeWithMeta(user.solo_progress || null);
  const shouldPersist = userMeta.changed || !sameProgress(userMeta.progress, progress);
  if (shouldPersist) {
    await writeSoloProgress(user, progress);
  }
  return progress;
}

function completedCount(p) {
  if (!p || !p.levels) return 0;
  let n = 0;
  for (const k of Object.keys(p.levels)) {
    if (Number(p.levels[k]?.bestStars) > 0) n += 1;
  }
  return n;
}

function pickMoreAdvanced(a, b) {
  const aCur = Number(a?.currentLevel) || 1;
  const bCur = Number(b?.currentLevel) || 1;
  if (aCur !== bCur) return aCur > bCur ? a : b;
  return completedCount(a) >= completedCount(b) ? a : b;
}

/**
 * Writes solo progress for the current user.
 *   - Signed-in → base44.auth.updateMe({ solo_progress }).
 *   - Guest     → localStorage.
 *
 * Errors are swallowed (best-effort) so a write failure never crashes
 * gameplay. The next read will just see the previous best.
 */
export async function writeSoloProgress(user, progress) {
  const normalized = normalizeProgressShape(progress);
  safeWriteLocal(normalized); // mirror locally so guests + flakey network still see it
  if (!user || !user.email) return;
  try {
    await base44.auth.updateMe({ solo_progress: normalized });
  } catch {
    /* ignore — local mirror keeps the UI honest */
  }
}

// ─── Result merge ──────────────────────────────────────────────────────
/**
 * Returns the merged "best ever" entry for a level given a fresh attempt.
 * Rules:
 *   - Stars are monotonic: never decrease.
 *   - When the new attempt has equal-or-higher stars, prefer the lower
 *     mistake count and lower time as tiebreakers (better record).
 *   - Attempts counter always increments.
 */
function mergeBetterResult(previous, fresh) {
  const prev = previous || {};
  const attempts = (Number(prev.attempts) || 0) + 1;
  const now = new Date().toISOString();
  const attempt = calculateSoloAttemptResult({
    mistakes: fresh.mistakes,
    completedCards: fresh.cardsCompleted ?? (fresh.passed ? SOLO_CARDS_PER_LEVEL : 0),
    elapsedSeconds: fresh.timeSeconds,
  });
  const best = getBestSoloLevelResult(prev, {
    ...attempt,
    stars: typeof fresh.stars === 'number' ? fresh.stars : attempt.stars,
    passed: Boolean(fresh.passed),
    baseScore: typeof fresh.baseScore === 'number' ? fresh.baseScore : attempt.baseScore,
    timeBonus: typeof fresh.timeBonus === 'number' ? fresh.timeBonus : attempt.timeBonus,
    levelScore: typeof fresh.levelScore === 'number' ? fresh.levelScore : attempt.levelScore,
  });

  return {
    ...prev,
    bestStars: best.bestStars,
    bestScore: best.bestScore,
    bestScoreStars: best.bestScoreStars,
    bestScoreBaseScore: best.bestScoreBaseScore,
    bestScoreTimeBonus: best.bestScoreTimeBonus,
    bestMistakes: best.bestMistakes,
    bestTimeSeconds: best.bestTimeSeconds,
    attempts,
    completedAt: best.improvedStars ? now : prev.completedAt,
    lastAttemptAt: now,
  };
}

/**
 * Applies a level attempt result to the user's progress and returns the
 * updated progress object. Caller is responsible for persisting it via
 * `writeSoloProgress()`.
 *
 * fresh = { levelNumber, stars, mistakes, timeSeconds, passed,
 *           baseScore, timeBonus, levelScore }
 */
export function applyLevelAttempt(progress, fresh) {
  const next = {
    currentLevel: Number(progress?.currentLevel) || 1,
    levels: { ...(progress?.levels || {}) },
  };
  const key = String(fresh.levelNumber);
  const prevEntry = next.levels[key] || null;
  next.levels[key] = mergeBetterResult(prevEntry, fresh);

  // Codex110 — Always derive the unlock frontier from BOTH signals.
  // The old "only bump on pass" branch left `currentLevel` stale when a
  // server write got dropped or when the user's persisted snapshot was
  // out of sync with their actual completion history. Now we recompute
  // the frontier every time from (previous currentLevel, highest level
  // with bestStars > 0, fresh attempt). Passing Level N → N+1 unlock is
  // guaranteed even if the prior currentLevel was wrong.
  const total = getSoloLevelCount();
  const highestCompleted = getHighestCompletedLevel(next);
  let frontier = Math.max(
    next.currentLevel,
    Math.min(total, highestCompleted + 1),
  );
  if (fresh.passed) {
    frontier = Math.max(frontier, Math.min(total, fresh.levelNumber + 1));
  }
  next.currentLevel = Math.min(total, frontier);
  return {
    ...next,
    summary: summarizeSoloProgress(next, total),
  };
}

// ─── Level list for the Solo screen ────────────────────────────────────
/**
 * Returns the catalog annotated with status/stars/isPlayable using the
 * supplied progress object.
 *
 * Codex110 — All status derivation now goes through the shared helpers
 * in `lib/soloProgressHelpers.js`. The effective unlock frontier is
 *
 *   max(persisted currentLevel, highestCompletedLevel + 1)
 *
 * which means completing Level 8 always implies Level 9 is unlocked,
 * even when the persisted `currentLevel` was wrong (stale server snapshot,
 * partial write, new device with localStorage missing, etc).
 *
 * Status rules:
 *   - bestStars > 0                                  → 'completed'
 *   - levelNumber > effective unlock frontier        → 'locked'
 *   - otherwise                                      → 'current'
 *
 * "Current" can appear on multiple levels in the rare case where the
 * player has unlocked Level N but has NOT completed older replayable
 * levels (e.g. they retried Level 4 and lost stars-monotonic kept
 * bestStars=0). That is OK now — the Solo screen explicitly targets
 * `getCurrentPlayableLevel(progress)` for focus/default-selection, which
 * is always exactly one number.
 */
export function getSoloLevels(progress) {
  const safe = progress || emptyProgress();
  const total = LEVEL_CATALOG.length;
  return LEVEL_CATALOG.map((lvl) => {
    const entry = safe.levels?.[String(lvl.levelNumber)] || null;
    const stars = Math.max(0, Math.min(3, Number(entry?.bestStars) || 0));
    const status = getLevelStatus(lvl.levelNumber, safe, total);
    return {
      levelNumber: lvl.levelNumber,
      title: lvl.title,
      status,
      stars,
      bestScore: typeof entry?.bestScore === 'number' ? entry.bestScore : null,
      bestMistakes: typeof entry?.bestMistakes === 'number' ? entry.bestMistakes : null,
      bestTimeSeconds: typeof entry?.bestTimeSeconds === 'number' ? entry.bestTimeSeconds : null,
      isPlayable: status !== 'locked',
    };
  });
}

// Re-export the unlock helper so callers don't have to import from two
// places. Keeps the public Solo API in one module.
export { getEffectiveUnlockedLevel, getHighestCompletedLevel } from './soloProgressHelpers';

// ─── Game start config ─────────────────────────────────────────────────
/**
 * Builds the route-state config used by Game.jsx to start a Solo level
 * attempt. We reuse the existing shape (playerNames/category/year window/
 * winCardCount) so question generation and game flow stay untouched.
 *
 * The `soloLevel` field is the new piece: Game.jsx reads it to enforce
 * the 120-second total timer and the 8-mistake fail rule. When absent
 * (e.g. legacy paths), Game.jsx behaves exactly as before.
 */
export function buildSoloGameConfigForLevel(level) {
  const levelNumber = level?.levelNumber || 1;
  return {
    playerNames: ['Sen'],
    category: 'karisik',
    yearStart: 1900,
    yearEnd: 2025,
    turnDuration: 0, // no per-question timer — the brief explicitly forbids it
    winCardCount: SOLO_CARDS_PER_LEVEL,
    soloLevel: {
      levelNumber,
      cardCount: SOLO_CARDS_PER_LEVEL,
      totalTimeSeconds: SOLO_LEVEL_TIME_SECONDS,
      maxMistakes: SOLO_MAX_MISTAKES,
    },
  };
}
