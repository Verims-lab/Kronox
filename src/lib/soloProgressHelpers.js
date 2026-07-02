// Codex111 — Single-source-of-truth helpers for Solo progress + scoring.
//
// WHY THIS FILE EXISTS
//   Codex109 fixed the "multiple current levels" picker but the actual
//   shipped product still showed:
//     • Level 9 locked after Levels 1-8 completed.
//     • CTA stuck on "Level 1".
//     • Solo screen opening at the wrong scroll position.
//
//   Root cause was NOT the picker — it was that `currentLevel` (a single
//   number) and the per-level `bestStars` map can desync. If a write
//   partially succeeded, or the user is on a new device where `currentLevel`
//   is 1 but server has stars for Levels 1-8, the picker would still
//   compute `unlocked = 1` and lock everything.
//
//   This module derives unlock state from BOTH signals:
//     - persisted `currentLevel` (the unlocked frontier writer)
//     - the highest level with `bestStars > 0` (what the player has
//       actually proven they completed)
//   The effective unlock = max(currentLevel, highestCompleted + 1).
//
//   That self-heals all three production bugs without changing the
//   storage shape, without backend migrations, and without touching
//   gameplay code.
//
// USED BY
//   - lib/soloLevels.js  (getSoloLevels, applyLevelAttempt)
//   - pages/SoloChallenge.jsx  (default selection)
//   - components/game/simulationPanelSoloUnlockCases.js  (Health)
//   - components/game/simulationPanelSoloProgressCases.js  (Health)
//   - pages/ProfilePage.jsx  (Seviye tile, indirectly via readSoloProgress
//     → getCurrentPlayableLevel)

// ─── Solo attempt scoring constants ───────────────────────────────────
export const SOLO_RULES_VERSION = 3;
export const SOLO_NORMAL_CARD_TARGET = 7;
export const SOLO_SPECIAL_CARD_TARGET = 10;
export const SOLO_SPECIAL_START_LEVEL = 5;
export const SOLO_SPECIAL_LEVEL_INTERVAL = 5;
export const SOLO_SCORE_CARD_TARGET = SOLO_SPECIAL_CARD_TARGET;
export const SOLO_BEGINNER_CARD_TARGET = SOLO_NORMAL_CARD_TARGET;
export const SOLO_BEGINNER_CARD_TARGET_MAX_LEVEL = 0;
export const SOLO_SCORE_TIME_LIMIT_SECONDS = 180;
export const SOLO_INITIAL_TIMELINE_CARDS = 2;
export const SOLO_NORMAL_MAX_EVALUATED_MOVES = 10;
export const SOLO_SPECIAL_MAX_EVALUATED_MOVES = 13;
export const SOLO_MAX_EVALUATED_MOVES = SOLO_NORMAL_MAX_EVALUATED_MOVES;
export const SOLO_CORRECT_PLACEMENTS_NEEDED = SOLO_NORMAL_CARD_TARGET - SOLO_INITIAL_TIMELINE_CARDS;
export const SOLO_CARD_SWAP_BUFFER_CARDS = 3;
export const SOLO_MISTAKE_SHIELD_BUFFER_CARDS = 3;
export const SOLO_JOKER_BUFFER_CARDS = SOLO_CARD_SWAP_BUFFER_CARDS + SOLO_MISTAKE_SHIELD_BUFFER_CARDS;
export const SOLO_MAX_NON_FAILING_MISTAKES = SOLO_MAX_EVALUATED_MOVES - 1; // legacy progress metadata only
export const SOLO_NORMAL_DECK_SIZE = SOLO_INITIAL_TIMELINE_CARDS + SOLO_NORMAL_MAX_EVALUATED_MOVES + SOLO_JOKER_BUFFER_CARDS;
export const SOLO_SPECIAL_DECK_SIZE = SOLO_INITIAL_TIMELINE_CARDS + SOLO_SPECIAL_MAX_EVALUATED_MOVES + SOLO_JOKER_BUFFER_CARDS;

export function isSoloSpecialLevel(levelNumber) {
  const level = Math.trunc(Number(levelNumber) || 0);
  return level >= SOLO_SPECIAL_START_LEVEL
    && (level - SOLO_SPECIAL_START_LEVEL) % SOLO_SPECIAL_LEVEL_INTERVAL === 0;
}

export function getSoloCardsRequiredForLevel(levelNumber) {
  return isSoloSpecialLevel(levelNumber) ? SOLO_SPECIAL_CARD_TARGET : SOLO_NORMAL_CARD_TARGET;
}

export function getSoloMaxEvaluatedMovesForLevel(levelNumber) {
  return isSoloSpecialLevel(levelNumber) ? SOLO_SPECIAL_MAX_EVALUATED_MOVES : SOLO_NORMAL_MAX_EVALUATED_MOVES;
}

export function getSoloAttemptDeckSizeForLevel(levelNumber) {
  return isSoloSpecialLevel(levelNumber) ? SOLO_SPECIAL_DECK_SIZE : SOLO_NORMAL_DECK_SIZE;
}

export const SOLO_STAR_BASE_SCORES = Object.freeze({
  0: 0,
  1: 5,
  2: 10,
  3: 15,
});

export function calculateSoloStars(
  usedMoves,
  completedCards = SOLO_SCORE_CARD_TARGET,
  elapsedSeconds = 0,
  requiredCards = SOLO_SCORE_CARD_TARGET,
  maxMoves = SOLO_MAX_EVALUATED_MOVES,
) {
  const moves = Math.max(0, Number(usedMoves) || 0);
  const moveLimit = Math.max(1, Number(maxMoves) || SOLO_MAX_EVALUATED_MOVES);
  const cards = Math.max(0, Number(completedCards) || 0);
  const elapsed = Math.max(0, Number(elapsedSeconds) || 0);
  const target = Math.max(1, Number(requiredCards) || SOLO_SCORE_CARD_TARGET);
  const completed = cards >= target;
  const timedOutBeforeCompletion = !completed && elapsed >= SOLO_SCORE_TIME_LIMIT_SECONDS;

  if (!completed && moves >= moveLimit) {
    return { stars: 0, passed: false, failReason: 'moves' };
  }
  if (timedOutBeforeCompletion) {
    return { stars: 0, passed: false, failReason: 'timeout' };
  }
  if (!completed) {
    return { stars: 0, passed: false, failReason: 'incomplete' };
  }
  if (moves <= 6) return { stars: 3, passed: true, failReason: null };
  if (moves <= 8) return { stars: 2, passed: true, failReason: null };
  return { stars: 1, passed: true, failReason: null };
}

export function calculateSoloTimeBonus(elapsedSeconds, passed) {
  if (!passed) return 0;
  const elapsed = Math.max(0, Number(elapsedSeconds) || 0);
  if (elapsed <= 60) return 15;
  if (elapsed <= 90) return 10;
  if (elapsed <= 120) return 5;
  return 0;
}

export function calculateSoloLevelScore({ stars, elapsedSeconds, passed }) {
  const safeStars = Math.max(0, Math.min(3, Number(stars) || 0));
  const didPass = Boolean(passed) && safeStars > 0;
  const baseScore = didPass ? (SOLO_STAR_BASE_SCORES[safeStars] || 0) : 0;
  const timeBonus = calculateSoloTimeBonus(elapsedSeconds, didPass);
  return {
    baseScore,
    timeBonus,
    totalScore: baseScore + timeBonus,
  };
}

export function calculateSoloAttemptResult({
  mistakes,
  usedMoves,
  remainingMoves,
  maxMoves = SOLO_MAX_EVALUATED_MOVES,
  completedCards,
  elapsedSeconds,
  requiredCards = SOLO_SCORE_CARD_TARGET,
}) {
  const safeMaxMoves = Math.max(1, Number(maxMoves) || SOLO_MAX_EVALUATED_MOVES);
  const safeMistakes = Math.max(0, Number(mistakes) || 0);
  const explicitUsedMoves = Number(usedMoves);
  const explicitRemainingMoves = Number(remainingMoves);
  const legacyMistakeMoves = Number(mistakes);
  const safeUsedMoves = Number.isFinite(explicitUsedMoves)
    ? Math.max(0, Math.floor(explicitUsedMoves))
    : Number.isFinite(explicitRemainingMoves)
      ? Math.max(0, safeMaxMoves - Math.max(0, Math.floor(explicitRemainingMoves)))
      : Math.max(0, Math.floor(Number.isFinite(legacyMistakeMoves) ? legacyMistakeMoves : 0));
  const safeRemainingMoves = Math.max(0, safeMaxMoves - safeUsedMoves);
  const safeCards = Math.max(0, Number(completedCards) || 0);
  const safeElapsed = Math.max(0, Number(elapsedSeconds) || 0);
  const starResult = calculateSoloStars(safeUsedMoves, safeCards, safeElapsed, requiredCards, safeMaxMoves);
  const score = calculateSoloLevelScore({
    stars: starResult.stars,
    elapsedSeconds: safeElapsed,
    passed: starResult.passed,
  });

  return {
    passed: starResult.passed,
    stars: starResult.stars,
    mistakes: safeMistakes,
    usedMoves: safeUsedMoves,
    remainingMoves: safeRemainingMoves,
    maxMoves: safeMaxMoves,
    cardsCompleted: safeCards,
    elapsedSeconds: safeElapsed,
    timeSeconds: safeElapsed,
    failReason: starResult.failReason,
    baseScore: score.baseScore,
    timeBonus: score.timeBonus,
    levelScore: score.totalScore,
    score: score.totalScore,
    soloRulesVersion: SOLO_RULES_VERSION,
  };
}

function calculateLegacySoloLevelScore({ stars, elapsedSeconds, passed }) {
  const safeStars = Math.max(0, Math.min(3, Number(stars) || 0));
  const didPass = Boolean(passed) && safeStars > 0;
  const baseScores = { 0: 0, 1: 5, 2: 8, 3: 10 };
  const elapsed = Math.max(0, Number(elapsedSeconds) || 0);
  const timeBonus = didPass
    ? elapsed <= 60
      ? 10
      : elapsed <= 90
        ? 5
        : 0
    : 0;
  return {
    baseScore: didPass ? baseScores[safeStars] || 0 : 0,
    timeBonus,
    totalScore: (didPass ? baseScores[safeStars] || 0 : 0) + timeBonus,
  };
}

export function calculateSoloLevelScoreFromBestResult(levelResult) {
  const stars = Math.max(0, Math.min(3, Number(levelResult?.bestStars) || 0));
  const passed = stars > 0;
  const hasReliableTime = Number.isFinite(Number(levelResult?.bestTimeSeconds));
  const elapsedSeconds = hasReliableTime ? Number(levelResult.bestTimeSeconds) : null;
  const rulesVersion = Number(levelResult?.soloRulesVersion ?? levelResult?.rulesVersion ?? 1) || 1;
  const scoreHelper = rulesVersion >= SOLO_RULES_VERSION
    ? calculateSoloLevelScore
    : calculateLegacySoloLevelScore;
  const score = scoreHelper({
    stars,
    elapsedSeconds: elapsedSeconds ?? 0,
    passed,
  });

  return {
    stars,
    passed,
    baseScore: score.baseScore,
    timeBonus: hasReliableTime ? score.timeBonus : 0,
    totalScore: passed ? score.baseScore + (hasReliableTime ? score.timeBonus : 0) : 0,
    timeBonusBackfilled: passed && hasReliableTime,
    scoreBackfillReason: passed && hasReliableTime
      ? 'best_time_used_for_time_bonus'
      : passed
        ? 'missing_time_used_star_base_only'
        : 'not_completed_zero_score',
  };
}

function finiteNumber(value, fallback = null) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function derivePreviousScore(previous) {
  const stored = finiteNumber(previous?.bestScore, null);
  if (stored !== null) return stored;
  const derived = calculateSoloLevelScoreFromBestResult(previous);
  return derived.passed ? derived.totalScore : null;
}

function isAttemptBetterForScore(previous, attempt) {
  if (!attempt?.passed) return false;
  const prevScore = derivePreviousScore(previous);
  const attemptScore = Math.max(0, Number(attempt?.levelScore) || 0);
  if (prevScore === null) return true;
  // Replay delta is anchored to the explicit stored bestScore when present.
  // Same-score/lower-score replays can improve local time/mistake metadata in
  // future, but they must never add points unless this comparison is positive.
  if (attemptScore !== prevScore) return attemptScore > prevScore;

  const prevStars = finiteNumber(previous?.bestScoreStars ?? previous?.bestStars, 0);
  if (attempt.stars !== prevStars) return attempt.stars > prevStars;

  const prevTime = finiteNumber(previous?.bestTimeSeconds, Infinity);
  if (attempt.timeSeconds !== prevTime) return attempt.timeSeconds < prevTime;

  const prevUsedMoves = finiteNumber(previous?.bestUsedMoves, Infinity);
  if (attempt.usedMoves !== prevUsedMoves) return attempt.usedMoves < prevUsedMoves;

  const prevMistakes = finiteNumber(previous?.bestMistakes, Infinity);
  return attempt.mistakes < prevMistakes;
}

export function getBestSoloLevelResult(previousBest, newAttempt) {
  const prev = previousBest || {};
  const attempt = {
    ...newAttempt,
    levelScore: Number(newAttempt?.levelScore) || 0,
    baseScore: Number(newAttempt?.baseScore) || 0,
    timeBonus: Number(newAttempt?.timeBonus) || 0,
    stars: Math.max(0, Math.min(3, Number(newAttempt?.stars) || 0)),
    mistakes: Math.max(0, Number(newAttempt?.mistakes) || 0),
    usedMoves: Math.max(0, Number(newAttempt?.usedMoves) || 0),
    remainingMoves: Math.max(0, Number(newAttempt?.remainingMoves) || 0),
    maxMoves: Math.max(1, Number(newAttempt?.maxMoves) || SOLO_MAX_EVALUATED_MOVES),
    timeSeconds: Math.max(0, Number(newAttempt?.timeSeconds ?? newAttempt?.elapsedSeconds) || 0),
    passed: Boolean(newAttempt?.passed),
  };

  const prevStars = Math.max(0, Math.min(3, Number(prev.bestStars) || 0));
  const bestStars = Math.max(prevStars, attempt.stars);
  const replaceScoreRecord = isAttemptBetterForScore(prev, attempt);
  const previousScore = derivePreviousScore(prev);
  const previousBreakdown = calculateSoloLevelScoreFromBestResult(prev);

  const updatedBestLevelResult = {
    bestStars,
    bestScore: replaceScoreRecord
      ? attempt.levelScore
      : Math.max(0, previousScore || 0),
    bestScoreStars: replaceScoreRecord
      ? attempt.stars
      : Math.max(0, Number(prev.bestScoreStars ?? prev.bestStars) || 0),
    bestScoreBaseScore: replaceScoreRecord
      ? attempt.baseScore
      : Math.max(0, Number(prev.bestScoreBaseScore) || previousBreakdown.baseScore || 0),
    bestScoreTimeBonus: replaceScoreRecord
      ? attempt.timeBonus
      : Math.max(0, Number(prev.bestScoreTimeBonus) || previousBreakdown.timeBonus || 0),
    bestTimeSeconds: replaceScoreRecord
      ? attempt.timeSeconds
      : prev.bestTimeSeconds,
    bestMistakes: replaceScoreRecord
      ? attempt.mistakes
      : prev.bestMistakes,
    bestUsedMoves: replaceScoreRecord
      ? attempt.usedMoves
      : prev.bestUsedMoves,
    bestRemainingMoves: replaceScoreRecord
      ? attempt.remainingMoves
      : prev.bestRemainingMoves,
    bestMaxMoves: replaceScoreRecord
      ? attempt.maxMoves
      : prev.bestMaxMoves,
    soloRulesVersion: replaceScoreRecord
      ? (attempt.soloRulesVersion || SOLO_RULES_VERSION)
      : (prev.soloRulesVersion || prev.rulesVersion || 1),
  };
  const previousBestScore = Math.max(0, previousScore || 0);
  const nextBestScore = Math.max(0, Number(updatedBestLevelResult.bestScore) || 0);
  const scoreDelta = Math.max(0, nextBestScore - previousBestScore);

  return {
    ...updatedBestLevelResult,
    updatedBestLevelResult,
    previousBestScore,
    scoreDelta,
    didImprove: scoreDelta > 0,
    didImproveRecord: replaceScoreRecord,
    improvedScore: scoreDelta > 0,
    improvedStars: bestStars > prevStars,
  };
}

/**
 * Highest level number for which the user has at least 1 best star.
 * Returns 0 when the user has never passed a level.
 */
export function getHighestCompletedLevel(progress) {
  const map = progress?.levels;
  if (!map || typeof map !== 'object') return 0;
  let highest = 0;
  for (const key of Object.keys(map)) {
    const n = Number(key);
    if (!Number.isFinite(n) || n <= 0) continue;
    const stars = Number(map[key]?.bestStars) || 0;
    if (stars > 0 && n > highest) highest = n;
  }
  return highest;
}

/**
 * Effective unlock frontier — the LARGEST level number the user is
 * allowed to play right now.
 *
 *   unlocked = max(persisted currentLevel, highestCompleted + 1)
 *
 * Capped to `totalLevels` so we never return a level beyond the catalog.
 * This is the formula every consumer (status, default selection, CTA,
 * Profile tile) must use.
 */
export function getEffectiveUnlockedLevel(progress, totalLevels) {
  const cap = Math.max(1, Number(totalLevels) || 1);
  const persisted = Math.max(1, Number(progress?.currentLevel) || 1);
  const fromHistory = getHighestCompletedLevel(progress) + 1;
  return Math.min(cap, Math.max(persisted, fromHistory));
}

/**
 * The level the user should be focused on right now.
 *
 *   - If the unlock frontier has bestStars === 0 → that level (next
 *     real challenge).
 *   - Otherwise (every unlocked level already completed) → the frontier
 *     itself, so the user can replay it explicitly.
 *
 * NEVER returns 0; lowest is 1.
 */
export function getCurrentPlayableLevel(progress, totalLevels) {
  const frontier = getEffectiveUnlockedLevel(progress, totalLevels);
  const stars = Number(progress?.levels?.[String(frontier)]?.bestStars) || 0;
  return stars === 0 ? frontier : frontier;
}

/**
 * Default level number to highlight in the CTA when the Solo screen
 * first lands. Identical to `getCurrentPlayableLevel` today, but kept
 * as its own export so future product tweaks (e.g. "default to the
 * lowest 1-star level so the user can chase 3 stars") don't ripple.
 */
export function getDefaultSelectedLevel(progress, totalLevels) {
  return getCurrentPlayableLevel(progress, totalLevels);
}

/**
 * Status for a single level number, given current progress.
 * Returns one of: 'completed' | 'current' | 'locked'.
 *
 *   completed : levelNumber ≤ highestCompleted (has bestStars > 0)
 *   current   : levelNumber === effective unlock frontier AND not completed
 *               (or the frontier itself when everything below is completed)
 *   locked    : levelNumber > effective unlock frontier
 */
export function getLevelStatus(levelNumber, progress, totalLevels) {
  const frontier = getEffectiveUnlockedLevel(progress, totalLevels);
  if (levelNumber > frontier) return 'locked';
  const stars = Number(progress?.levels?.[String(levelNumber)]?.bestStars) || 0;
  if (stars > 0) return 'completed';
  return 'current';
}

/**
 * Can the user start an attempt on this level right now?
 *   - locked  → no
 *   - current → yes
 *   - completed → yes (replay)
 */
export function canPlayLevel(levelNumber, progress, totalLevels) {
  return getLevelStatus(levelNumber, progress, totalLevels) !== 'locked';
}

export function deriveUnlockedLevelFromCompletedLevels(progress, totalLevels) {
  return getEffectiveUnlockedLevel(progress, totalLevels);
}

/**
 * Codex117 — Solo Adventure Map section helper (single source of truth).
 *
 * The Solo Level Path groups levels into fixed 5-level "zones":
 *   1–5, 6–10, 11–15, 16–20, ...
 *
 * Given a level number, returns the inclusive [start, end] range of the
 * zone that level belongs to. The LevelMapPath UI uses this for the
 * "where should the map focus when I open Solo at Level N?" question.
 *
 * Boundary contract (locked by Health):
 *   Level 1  → [1, 5]
 *   Level 5  → [1, 5]
 *   Level 6  → [6, 10]
 *   Level 10 → [6, 10]
 *   Level 11 → [11, 15]
 *   Level 15 → [11, 15]
 *   Level 16 → [16, 20]
 *   Level 20 → [16, 20]
 *
 * The helper handles any positive integer; non-positive / non-finite
 * inputs fall back to [1, 5] (the safe first section).
 *
 * KEEP THIS PURE — no React, no DOM. The UI consumes it from
 * LevelMapPath.jsx; Health consumes it directly via executable cases.
 */
export function getSoloMapSectionRange(levelNumber) {
  const n = Math.max(1, Math.floor(Number(levelNumber) || 1));
  // Zones are 5 levels wide and start at 1. (n - 1) / 5 floored gives
  // the zero-based zone index; +1 gives the 1-based first level of the
  // zone. Adding 4 gives the inclusive end. Math, not a lookup table,
  // so future catalog growth (25+, 30+ levels) needs zero code change.
  const zoneIndex = Math.floor((n - 1) / 5);
  const start = zoneIndex * 5 + 1;
  const end = start + 4;
  return [start, end];
}

export function summarizeSoloProgress(progress, totalLevels) {
  const levels = progress?.levels && typeof progress.levels === 'object'
    ? progress.levels
    : {};
  let completedLevelCount = 0;
  let totalStars = 0;
  let totalSoloScore = 0;
  let totalAttempts = 0;

  Object.values(levels).forEach((entry) => {
    const stars = Math.max(0, Math.min(3, Number(entry?.bestStars) || 0));
    const attempts = Math.max(0, Number(entry?.attempts) || 0);
    totalAttempts += attempts;
    if (stars > 0) completedLevelCount += 1;
    totalStars += stars;

    const storedScore = finiteNumber(entry?.bestScore, null);
    if (storedScore !== null) {
      totalSoloScore += Math.max(0, storedScore);
      return;
    }

    // Backward-compatible derivation for pre-score progress snapshots.
    // No soloRulesVersion means legacy scoring; new v3 attempts store
    // bestScore directly and are never recalculated from old snapshots.
    const derived = calculateSoloLevelScoreFromBestResult(entry);
    totalSoloScore += derived.totalScore;
  });

  const unlockedLevel = getEffectiveUnlockedLevel(progress, totalLevels);
  const currentLevel = getCurrentPlayableLevel(progress, totalLevels);
  return {
    currentLevel,
    unlockedLevel,
    totalSoloScore,
    completedLevelCount,
    totalStars,
    totalAttempts,
  };
}

export function recalculateTotalSoloScore(progress) {
  const levels = progress?.levels && typeof progress.levels === 'object'
    ? progress.levels
    : {};
  return Object.values(levels).reduce((sum, entry) => {
    const storedScore = finiteNumber(entry?.bestScore, null);
    if (storedScore !== null) return sum + Math.max(0, storedScore);
    return sum + calculateSoloLevelScoreFromBestResult(entry).totalScore;
  }, 0);
}

export function backfillSoloScores(progress, totalLevels) {
  const source = progress && typeof progress === 'object' ? progress : {};
  const levels = source.levels && typeof source.levels === 'object' ? source.levels : {};
  const storedFrontier = Math.max(
    1,
    Number(source.currentLevel) || 1,
    Number(source.unlockedLevel) || 1,
  );
  const next = {
    currentLevel: storedFrontier,
    levels: {},
  };
  let changed = false;

  Object.entries(levels).forEach(([key, entry]) => {
    const currentEntry = entry && typeof entry === 'object' ? entry : {};
    const copy = { ...currentEntry };
    const score = calculateSoloLevelScoreFromBestResult(copy);

    if (score.passed) {
      if (!Number.isFinite(Number(copy.bestScore))) {
        copy.bestScore = score.totalScore;
        changed = true;
      }
      if (!Number.isFinite(Number(copy.bestScoreStars))) {
        copy.bestScoreStars = score.stars;
        changed = true;
      }
      if (!Number.isFinite(Number(copy.bestScoreBaseScore))) {
        copy.bestScoreBaseScore = score.baseScore;
        changed = true;
      }
      if (!Number.isFinite(Number(copy.bestScoreTimeBonus))) {
        copy.bestScoreTimeBonus = score.timeBonus;
        changed = true;
      }
    }

    next.levels[key] = copy;
  });

  const derivedFrontier = getHighestCompletedLevel(next) + 1;
  const boundedDerivedFrontier = Math.min(Math.max(1, Number(totalLevels) || 1), Math.max(1, derivedFrontier));
  const preservedCurrent = Math.max(next.currentLevel, boundedDerivedFrontier);
  if (preservedCurrent !== next.currentLevel) {
    next.currentLevel = preservedCurrent;
    changed = true;
  }

  const summary = summarizeSoloProgress(next, totalLevels);
  if (JSON.stringify(source.summary || null) !== JSON.stringify(summary)) {
    changed = true;
  }

  return {
    progress: {
      ...next,
      summary,
    },
    changed,
  };
}
