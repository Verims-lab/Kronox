// Codex106 — Solo Level Path data + progress helper.
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
//         "1": { bestStars, bestMistakes, bestTimeSeconds, attempts, completedAt }
//       } }
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

const STORAGE_KEY = 'kx_solo_progress_v1';

// ─── Constants surfaced to the rest of the app ─────────────────────────
export const SOLO_CARDS_PER_LEVEL = 10;
export const SOLO_LEVEL_TIME_SECONDS = 120;
export const SOLO_MAX_MISTAKES = 8; // 8+ → fail

// Base level catalog. Keep small enough to fit no-scroll on common phones.
const LEVEL_CATALOG = [
  { levelNumber: 1, title: 'Level 1' },
  { levelNumber: 2, title: 'Level 2' },
  { levelNumber: 3, title: 'Level 3' },
  { levelNumber: 4, title: 'Level 4' },
  { levelNumber: 5, title: 'Level 5' },
  { levelNumber: 6, title: 'Level 6' },
  { levelNumber: 7, title: 'Level 7' },
  { levelNumber: 8, title: 'Level 8' },
];

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
  const m = Math.max(0, Number(mistakes) || 0);
  if (m >= SOLO_MAX_MISTAKES) return { stars: 0, passed: false };
  if (m <= 1) return { stars: 3, passed: true };
  if (m <= 4) return { stars: 2, passed: true };
  return { stars: 1, passed: true };
}

// ─── Storage helpers ───────────────────────────────────────────────────
function emptyProgress() {
  return { currentLevel: 1, levels: {} };
}

function safeReadLocal() {
  if (typeof window === 'undefined') return emptyProgress();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyProgress();
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return emptyProgress();
    return {
      currentLevel: Number(parsed.currentLevel) || 1,
      levels: (parsed.levels && typeof parsed.levels === 'object') ? parsed.levels : {},
    };
  } catch {
    return emptyProgress();
  }
}

function safeWriteLocal(progress) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
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
    ? {
        currentLevel: Number(user.solo_progress.currentLevel) || 1,
        levels: user.solo_progress.levels || {},
      }
    : null;
  if (!fromUser) return fromLocal;
  return pickMoreAdvanced(fromUser, fromLocal);
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
  safeWriteLocal(progress); // mirror locally so guests + flakey network still see it
  if (!user || !user.email) return;
  try {
    await base44.auth.updateMe({ solo_progress: progress });
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
  const prevStars = Number(prev.bestStars) || 0;
  const freshStars = Number(fresh.stars) || 0;
  const attempts = (Number(prev.attempts) || 0) + 1;

  // Never regress stars.
  if (freshStars < prevStars) {
    return { ...prev, attempts };
  }

  // Higher stars or first pass → take the new record outright.
  if (freshStars > prevStars) {
    return {
      bestStars: freshStars,
      bestMistakes: fresh.mistakes,
      bestTimeSeconds: fresh.timeSeconds,
      attempts,
      completedAt: new Date().toISOString(),
    };
  }

  // Equal stars → prefer the tighter run (fewer mistakes, then faster).
  const prevMistakes = Number(prev.bestMistakes);
  const prevTime = Number(prev.bestTimeSeconds);
  const tighterMistakes = !Number.isFinite(prevMistakes) || fresh.mistakes < prevMistakes;
  const equalMistakesFaster = fresh.mistakes === prevMistakes
    && (!Number.isFinite(prevTime) || fresh.timeSeconds < prevTime);
  if (tighterMistakes || equalMistakesFaster) {
    return {
      bestStars: freshStars,
      bestMistakes: fresh.mistakes,
      bestTimeSeconds: fresh.timeSeconds,
      attempts,
      completedAt: prev.completedAt || new Date().toISOString(),
    };
  }
  return { ...prev, attempts };
}

/**
 * Applies a level attempt result to the user's progress and returns the
 * updated progress object. Caller is responsible for persisting it via
 * `writeSoloProgress()`.
 *
 * fresh = { levelNumber, stars, mistakes, timeSeconds, passed }
 */
export function applyLevelAttempt(progress, fresh) {
  const next = {
    currentLevel: Number(progress?.currentLevel) || 1,
    levels: { ...(progress?.levels || {}) },
  };
  const key = String(fresh.levelNumber);
  const prevEntry = next.levels[key] || null;
  next.levels[key] = mergeBetterResult(prevEntry, fresh);

  // Passing unlocks the next level. We just bump `currentLevel` if the
  // attempt passed and the user wasn't already further along.
  if (fresh.passed) {
    const nextUnlock = Math.min(getSoloLevelCount(), fresh.levelNumber + 1);
    if (nextUnlock > next.currentLevel) next.currentLevel = nextUnlock;
  }
  return next;
}

// ─── Level list for the Solo screen ────────────────────────────────────
/**
 * Returns the catalog annotated with status/stars/isPlayable using the
 * supplied progress object.
 *
 * Rules:
 *   - status='completed' for any level with bestStars > 0.
 *   - status='current'   for the lowest level whose number === currentLevel
 *                        AND which isn't already completed; or the next
 *                        non-completed level after currentLevel.
 *   - status='locked'    for anything beyond currentLevel.
 *   - completed + current → isPlayable=true. Locked → false.
 */
export function getSoloLevels(progress) {
  const safe = progress || emptyProgress();
  const unlocked = Math.max(1, Number(safe.currentLevel) || 1);

  return LEVEL_CATALOG.map((lvl) => {
    const entry = safe.levels?.[String(lvl.levelNumber)] || null;
    const stars = Math.max(0, Math.min(3, Number(entry?.bestStars) || 0));
    const isCompleted = stars > 0;
    let status;
    if (lvl.levelNumber > unlocked) status = 'locked';
    else if (isCompleted) status = 'completed';
    else status = 'current';

    return {
      levelNumber: lvl.levelNumber,
      title: lvl.title,
      status,
      stars,
      bestMistakes: typeof entry?.bestMistakes === 'number' ? entry.bestMistakes : null,
      bestTimeSeconds: typeof entry?.bestTimeSeconds === 'number' ? entry.bestTimeSeconds : null,
      isPlayable: status !== 'locked',
    };
  });
}

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