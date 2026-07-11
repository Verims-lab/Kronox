// Codex111 — Solo Level Path data + progress helper.
//
// PURPOSE
//   Single source of truth for:
//     1. The Solo level catalog (level numbers + titles).
//     2. Reading/writing per-user Solo progress.
//     3. Computing star count from evaluated placement moves.
//     4. Building the route-state config Game.jsx expects when a level
//        attempt starts.
//
// PERSISTENCE STRATEGY
//   Signed-in users → `User.solo_progress` (via base44.auth.updateMe).
//   Guest users     → localStorage["kx_solo_progress_v1:guest"] fallback.
//   Local mirrors    → user-scoped keys only; never cross-apply another
//                      signed-in user's progress on a shared device.
//   Both sources use the same compact shape:
//
//     { currentLevel: number,
//       levels: {
//         "1": {
//           bestStars, bestScore, bestScoreStars, bestScoreBaseScore,
//           bestScoreTimeBonus, bestUsedMoves, bestMistakes, bestTimeSeconds, attempts,
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
import { isSavedBeforeProgressReset } from './progressResetCache';
import {
  calculateSoloAttemptResult,
  calculateSoloStars,
  backfillSoloScores,
  getBestSoloLevelResult,
  getSoloAttemptDeckSizeForLevel,
  getSoloCardsRequiredForLevel,
  getSoloLevelType,
  getSoloMaxEvaluatedMovesForLevel,
  getSoloPlayableCardCountForLevel,
  getSoloReferenceCardCountForLevel,
  getEffectiveUnlockedLevel,
  getHighestCompletedLevel,
  getLevelStatus,
  isSoloSpecialLevel,
  SOLO_INITIAL_TIMELINE_CARDS as SOLO_INITIAL_TIMELINE_CARDS_FROM_RULES,
  SOLO_NORMAL_MAX_EVALUATED_MOVES,
  SOLO_NORMAL_CARD_TARGET,
  SOLO_SPECIAL_MAX_EVALUATED_MOVES,
  SOLO_SPECIAL_CARD_TARGET,
  SOLO_RULES_VERSION,
  summarizeSoloProgress,
} from './soloProgressHelpers';
import { buildSoloLeaderboardPayload, publishSoloLeaderboardEntry } from './leaderboard';
import { syncGuestProfileProgress } from './guestProfile';

const STORAGE_KEY = 'kx_solo_progress_v1';
const GUEST_STORAGE_KEY = `${STORAGE_KEY}:guest`;
const LOCAL_MIRROR_VERSION = 2;

// ─── Constants surfaced to the rest of the app ─────────────────────────
export const SOLO_CARDS_PER_LEVEL = SOLO_NORMAL_CARD_TARGET;
export const SOLO_SPECIAL_CARDS_PER_LEVEL = SOLO_SPECIAL_CARD_TARGET;
export const SOLO_INITIAL_TIMELINE_CARDS = SOLO_INITIAL_TIMELINE_CARDS_FROM_RULES;
export const SOLO_LEVEL_TIME_SECONDS = 180;
export const SOLO_MAX_MOVES = SOLO_NORMAL_MAX_EVALUATED_MOVES;
export const SOLO_SPECIAL_MAX_MOVES = SOLO_SPECIAL_MAX_EVALUATED_MOVES;

export function getSoloTimelineWinCardCountForLevel(levelNumber) {
  // The timeline itself is the Solo source of truth: seed cards and
  // accepted placements are both already-correct timeline cards. The top
  // progress counter and hasPlayerWon() must compare against the same target.
  return getSoloCardsRequiredForLevel(levelNumber);
}

export function getSoloDeckSizeForLevel(levelNumber) {
  return getSoloAttemptDeckSizeForLevel(levelNumber);
}

export function getSoloMaxMovesForLevel(levelNumber) {
  return getSoloMaxEvaluatedMovesForLevel(levelNumber);
}

// Solo Level Path catalog. Extended to support a long progression journey
// (up to 1000 levels). The catalog is generated lazily by the UI — only a
// windowed slice around the user's current frontier is rendered at a time
// — so the array itself stays cheap. Wording uses "Seviye" everywhere
// that is user-facing; the internal `title` field stays in English for
// backwards compat with existing Health/snapshot fixtures.
const TOTAL_LEVELS = 1000;
const LEVEL_CATALOG = Array.from({ length: TOTAL_LEVELS }, (_, i) => ({
  levelNumber: i + 1,
  title: `Seviye ${i + 1}`,
}));

export function getSoloLevelCount() {
  return LEVEL_CATALOG.length;
}

// ─── Star calculation ──────────────────────────────────────────────────
/**
 * Maps used evaluated moves to stars. Matches the product brief:
 *   5–6 → 3 stars, 7–8 → 2 stars, 9–10 → 1 star, 10 without target → fail.
 * Also returns `passed` so the caller doesn't need to re-check.
 */
export function computeLevelStars(usedMoves, levelNumber = null) {
  const requiredCards = getSoloCardsRequiredForLevel(levelNumber);
  const { stars, passed } = calculateSoloStars(
    usedMoves,
    requiredCards,
    0,
    requiredCards,
    getSoloMaxMovesForLevel(levelNumber),
  );
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

function normalizeSoloProgressEmail(email) {
  return String(email || '').trim().toLowerCase();
}

export function getSoloProgressOwnerKey(userOrEmail) {
  const email = normalizeSoloProgressEmail(
    typeof userOrEmail === 'string' ? userOrEmail : userOrEmail?.email,
  );
  if (!email) return 'guest';

  let hash = 2166136261;
  for (let i = 0; i < email.length; i += 1) {
    hash ^= email.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `u_${(hash >>> 0).toString(36)}`;
}

function getScopedStorageKey(user) {
  const ownerKey = getSoloProgressOwnerKey(user);
  return ownerKey === 'guest' ? GUEST_STORAGE_KEY : `${STORAGE_KEY}:${ownerKey}`;
}

function readStorageJson(key) {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

function unwrapLocalMirror(parsed, expectedOwnerKey, progressResetAt = '') {
  if (!parsed || typeof parsed !== 'object') return null;

  // Codex139 mirror envelope. Signed-in reads require matching ownerKey.
  if (parsed.__kronoxSoloProgressMirror === LOCAL_MIRROR_VERSION) {
    const ownerKey = String(parsed.ownerKey || '').trim();
    if (expectedOwnerKey !== 'guest' && ownerKey !== expectedOwnerKey) return null;
    if (expectedOwnerKey === 'guest' && ownerKey !== 'guest') return null;
    if (isSavedBeforeProgressReset(parsed.savedAt, progressResetAt)) return null;
    return parsed.progress && typeof parsed.progress === 'object'
      ? normalizeProgressShape(parsed.progress)
      : null;
  }

  // Legacy signed-in mirrors are only accepted when they explicitly carry
  // a same-owner marker. Old unscoped progress without owner metadata is
  // treated as guest-only fallback to prevent cross-user inheritance.
  const legacyOwner = String(parsed.ownerKey || parsed.__ownerKey || '').trim();
  if (expectedOwnerKey !== 'guest') {
    if (!legacyOwner || legacyOwner !== expectedOwnerKey) return null;
    if (progressResetAt) return null;
    return normalizeProgressShape(parsed.progress && typeof parsed.progress === 'object'
      ? parsed.progress
      : parsed);
  }

  return normalizeProgressShape(parsed.progress && typeof parsed.progress === 'object'
    ? parsed.progress
    : parsed);
}

function wrapLocalMirror(user, progress) {
  const ownerKey = getSoloProgressOwnerKey(user);
  return {
    __kronoxSoloProgressMirror: LOCAL_MIRROR_VERSION,
    ownerKey,
    scope: ownerKey === 'guest' ? 'guest' : 'signed_in_user',
    savedAt: new Date().toISOString(),
    progress: normalizeProgressShape(progress),
  };
}

function migrateLegacyGuestIfNeeded() {
  if (typeof window === 'undefined') return null;
  const guestParsed = readStorageJson(GUEST_STORAGE_KEY);
  if (guestParsed) return unwrapLocalMirror(guestParsed, 'guest', '');

  const legacyParsed = readStorageJson(STORAGE_KEY);
  const legacyProgress = unwrapLocalMirror(legacyParsed, 'guest', '');
  if (legacyProgress) {
    try {
      window.localStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify(wrapLocalMirror(null, legacyProgress)));
    } catch {
      /* quota or private mode — ignore */
    }
  }
  return legacyProgress;
}

function safeReadLocal(user = null) {
  if (typeof window === 'undefined') return emptyProgress();
  const ownerKey = getSoloProgressOwnerKey(user);
  const progressResetAt = ownerKey === 'guest' ? '' : String(user?.progress_reset_at || '');
  try {
    const scoped = unwrapLocalMirror(readStorageJson(getScopedStorageKey(user)), ownerKey, progressResetAt);
    if (scoped) return scoped;
    if (ownerKey === 'guest') return migrateLegacyGuestIfNeeded() || emptyProgress();

    // Signed-in migration from the old unscoped key is intentionally strict:
    // only an owner-marked legacy mirror can be used. Anonymous old progress
    // remains guest fallback and can never overwrite User.solo_progress.
    const legacySameOwner = unwrapLocalMirror(readStorageJson(STORAGE_KEY), ownerKey, progressResetAt);
    return legacySameOwner || emptyProgress();
  } catch {
    return emptyProgress();
  }
}

function safeWriteLocal(user, progress) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(getScopedStorageKey(user), JSON.stringify(wrapLocalMirror(user, progress)));
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
  const fromLocal = safeReadLocal(user || null);
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
    safeWriteLocal(null, progress);
    return progress;
  }

  const userMeta = normalizeProgressShapeWithMeta(user.solo_progress || null);
  const shouldPersist = userMeta.changed || !sameProgress(userMeta.progress, progress);
  if (shouldPersist) {
    await writeSoloProgress(user, progress);
  } else {
    publishSoloLeaderboardEntry(user, progress).catch(() => {});
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
  safeWriteLocal(user || null, normalized); // same-user mirror so guests + flakey network still see it
  if (!user || !user.email) {
    try {
      const result = await syncGuestProfileProgress({ soloProgress: normalized });
      return result?.ok !== false;
    } catch {
      return false;
    }
  }
  try {
    const leaderboardPayload = buildSoloLeaderboardPayload(user, normalized);
    await base44.auth.updateMe({
      solo_progress: normalized,
      kronox_puan_total: leaderboardPayload.total_kronox_score,
    });
    await publishSoloLeaderboardEntry(user, normalized);
    return true;
  } catch {
    /* ignore — local mirror keeps the UI honest */
    return false;
  }
}

// ─── Result merge ──────────────────────────────────────────────────────
/**
 * Returns the merged "best ever" entry for a level given a fresh attempt.
 * Rules:
 *   - Stars are monotonic: never decrease.
 *   - When the new attempt has equal-or-higher stars, prefer the lower
 *     used move count and lower time as tiebreakers (better record).
 *   - Attempts counter always increments.
 */
function mergeBetterResult(previous, fresh) {
  const prev = previous || {};
  const attempts = (Number(prev.attempts) || 0) + 1;
  const now = new Date().toISOString();
  const requiredCards = Math.max(
    1,
    Number(fresh.cardTarget ?? fresh.requiredCards ?? getSoloCardsRequiredForLevel(fresh.levelNumber)) || SOLO_CARDS_PER_LEVEL,
  );
  const attempt = calculateSoloAttemptResult({
    mistakes: fresh.mistakes,
    usedMoves: fresh.usedMoves,
    remainingMoves: fresh.remainingMoves,
    maxMoves: fresh.maxMoves ?? getSoloMaxMovesForLevel(fresh.levelNumber),
    completedCards: fresh.cardsCompleted ?? (fresh.passed ? requiredCards : 0),
    elapsedSeconds: fresh.timeSeconds,
    requiredCards,
  });
  const best = getBestSoloLevelResult(prev, {
    ...attempt,
    soloRulesVersion: fresh.soloRulesVersion || attempt.soloRulesVersion || SOLO_RULES_VERSION,
    stars: typeof fresh.stars === 'number' ? fresh.stars : attempt.stars,
    passed: Boolean(fresh.passed),
    baseScore: typeof fresh.baseScore === 'number' ? fresh.baseScore : attempt.baseScore,
    timeBonus: typeof fresh.timeBonus === 'number' ? fresh.timeBonus : attempt.timeBonus,
    levelScore: typeof fresh.levelScore === 'number' ? fresh.levelScore : attempt.levelScore,
  });

  // Never regress stars on replay — explicit, defensive guard layered on top
  // of getBestSoloLevelResult. A worse replay (lower stars OR fail attempt)
  // must NEVER reduce the user's previously recorded bestStars. The helper
  // above already enforces this via Math.max, but we keep this explicit
  // assertion here so the contract is visible at the storage merge layer
  // and any future helper refactor cannot silently regress the invariant.
  const prevStars = Math.max(0, Math.min(3, Number(prev.bestStars) || 0));
  const freshStars = Math.max(0, Math.min(3, Number(best.bestStars) || 0));
  let guardedBestStars = freshStars;
  if (freshStars < prevStars) {
    // Worse replay — keep previous best stars. Never regress stars.
    guardedBestStars = prevStars;
  }

  return {
    ...prev,
    bestStars: guardedBestStars,
    bestScore: best.bestScore,
    bestScoreStars: best.bestScoreStars,
    bestScoreBaseScore: best.bestScoreBaseScore,
    bestScoreTimeBonus: best.bestScoreTimeBonus,
    bestMistakes: best.bestMistakes,
    bestUsedMoves: best.bestUsedMoves,
    bestRemainingMoves: best.bestRemainingMoves,
    bestMaxMoves: best.bestMaxMoves,
    bestTimeSeconds: best.bestTimeSeconds,
    soloRulesVersion: best.soloRulesVersion,
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
 * fresh = { levelNumber, stars, usedMoves, remainingMoves, maxMoves, mistakes, timeSeconds, passed,
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
    const levelType = getSoloLevelType(lvl.levelNumber);
    return {
      levelNumber: lvl.levelNumber,
      title: lvl.title,
      levelType,
      status,
      stars,
      bestScore: typeof entry?.bestScore === 'number' ? entry.bestScore : null,
      bestMistakes: typeof entry?.bestMistakes === 'number' ? entry.bestMistakes : null,
      bestUsedMoves: typeof entry?.bestUsedMoves === 'number' ? entry.bestUsedMoves : null,
      bestRemainingMoves: typeof entry?.bestRemainingMoves === 'number' ? entry.bestRemainingMoves : null,
      bestMaxMoves: typeof entry?.bestMaxMoves === 'number' ? entry.bestMaxMoves : null,
      bestTimeSeconds: typeof entry?.bestTimeSeconds === 'number' ? entry.bestTimeSeconds : null,
      referenceCardCount: getSoloReferenceCardCountForLevel(lvl.levelNumber),
      playableCardCount: getSoloPlayableCardCountForLevel(lvl.levelNumber),
      isSpecial: isSoloSpecialLevel(lvl.levelNumber),
      trainingConsumables: levelType === 'before_after' || levelType === 'timeline_basic',
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
 * the 180-second total timer and the 10-move limit. When absent
 * (e.g. legacy paths), Game.jsx behaves exactly as before.
 */
export function buildSoloGameConfigForLevel(level) {
  const levelNumber = level?.levelNumber || 1;
  const cardCount = getSoloCardsRequiredForLevel(levelNumber);
  const deckSize = getSoloAttemptDeckSizeForLevel(levelNumber);
  const maxMoves = getSoloMaxMovesForLevel(levelNumber);
  const levelType = getSoloLevelType(levelNumber);
  return {
    playerNames: ['Sen'],
    category: 'karisik',
    yearStart: 1900,
    yearEnd: 2025,
    turnDuration: 0, // no per-question timer — the brief explicitly forbids it
    winCardCount: getSoloTimelineWinCardCountForLevel(levelNumber),
    soloLevel: {
      levelNumber,
      levelType,
      cardCount,
      deckSize,
      referenceCardCount: getSoloReferenceCardCountForLevel(levelNumber),
      playableCardCount: getSoloPlayableCardCountForLevel(levelNumber),
      isSpecial: isSoloSpecialLevel(levelNumber),
      trainingConsumables: levelType === 'before_after' || levelType === 'timeline_basic',
      soloRulesVersion: SOLO_RULES_VERSION,
      totalTimeSeconds: SOLO_LEVEL_TIME_SECONDS,
      maxMoves,
      maxMistakes: maxMoves,
    },
  };
}

export {
  getSoloAttemptDeckSizeForLevel,
  getSoloCardsRequiredForLevel,
  getSoloMaxEvaluatedMovesForLevel,
  isSoloSpecialLevel,
} from './soloProgressHelpers';
