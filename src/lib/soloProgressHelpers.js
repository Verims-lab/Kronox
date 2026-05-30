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
//   - pages/ProfilePage.jsx  (Level tile, indirectly via readSoloProgress
//     → getCurrentPlayableLevel)

// ─── Solo attempt scoring constants ───────────────────────────────────
export const SOLO_SCORE_CARD_TARGET = 10;
export const SOLO_SCORE_TIME_LIMIT_SECONDS = 120;
export const SOLO_SCORE_MAX_MISTAKES = 8;

export const SOLO_STAR_BASE_SCORES = Object.freeze({
  0: 0,
  1: 5,
  2: 8,
  3: 10,
});

export function calculateSoloStars(
  mistakes,
  completedCards = SOLO_SCORE_CARD_TARGET,
  elapsedSeconds = 0,
) {
  const m = Math.max(0, Number(mistakes) || 0);
  const cards = Math.max(0, Number(completedCards) || 0);
  const elapsed = Math.max(0, Number(elapsedSeconds) || 0);
  const completed = cards >= SOLO_SCORE_CARD_TARGET;
  const timedOutBeforeCompletion = !completed && elapsed >= SOLO_SCORE_TIME_LIMIT_SECONDS;

  if (m >= SOLO_SCORE_MAX_MISTAKES) {
    return { stars: 0, passed: false, failReason: 'mistakes' };
  }
  if (timedOutBeforeCompletion) {
    return { stars: 0, passed: false, failReason: 'timeout' };
  }
  if (!completed) {
    return { stars: 0, passed: false, failReason: 'incomplete' };
  }
  if (m <= 1) return { stars: 3, passed: true, failReason: null };
  if (m <= 4) return { stars: 2, passed: true, failReason: null };
  return { stars: 1, passed: true, failReason: null };
}

export function calculateSoloTimeBonus(elapsedSeconds, passed) {
  if (!passed) return 0;
  const elapsed = Math.max(0, Number(elapsedSeconds) || 0);
  if (elapsed < 60) return 10;
  if (elapsed >= 60 && elapsed <= 90) return 5;
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
  completedCards,
  elapsedSeconds,
}) {
  const safeMistakes = Math.max(0, Number(mistakes) || 0);
  const safeCards = Math.max(0, Number(completedCards) || 0);
  const safeElapsed = Math.max(0, Number(elapsedSeconds) || 0);
  const starResult = calculateSoloStars(safeMistakes, safeCards, safeElapsed);
  const score = calculateSoloLevelScore({
    stars: starResult.stars,
    elapsedSeconds: safeElapsed,
    passed: starResult.passed,
  });

  return {
    passed: starResult.passed,
    stars: starResult.stars,
    mistakes: safeMistakes,
    cardsCompleted: safeCards,
    elapsedSeconds: safeElapsed,
    timeSeconds: safeElapsed,
    failReason: starResult.failReason,
    baseScore: score.baseScore,
    timeBonus: score.timeBonus,
    levelScore: score.totalScore,
    score: score.totalScore,
  };
}

function finiteNumber(value, fallback = null) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function derivePreviousScore(previous) {
  const stored = finiteNumber(previous?.bestScore, null);
  if (stored !== null) return stored;
  const stars = Math.max(0, Math.min(3, Number(previous?.bestStars) || 0));
  if (stars <= 0) return null;
  return calculateSoloLevelScore({
    stars,
    elapsedSeconds: previous?.bestTimeSeconds,
    passed: true,
  }).totalScore;
}

function isAttemptBetterForScore(previous, attempt) {
  if (!attempt?.passed) return false;
  const prevScore = derivePreviousScore(previous);
  if (prevScore === null) return true;
  if (attempt.levelScore !== prevScore) return attempt.levelScore > prevScore;

  const prevStars = finiteNumber(previous?.bestScoreStars ?? previous?.bestStars, 0);
  if (attempt.stars !== prevStars) return attempt.stars > prevStars;

  const prevTime = finiteNumber(previous?.bestTimeSeconds, Infinity);
  if (attempt.timeSeconds !== prevTime) return attempt.timeSeconds < prevTime;

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
    timeSeconds: Math.max(0, Number(newAttempt?.timeSeconds ?? newAttempt?.elapsedSeconds) || 0),
    passed: Boolean(newAttempt?.passed),
  };

  const prevStars = Math.max(0, Math.min(3, Number(prev.bestStars) || 0));
  const bestStars = Math.max(prevStars, attempt.stars);
  const replaceScoreRecord = isAttemptBetterForScore(prev, attempt);
  const previousScore = derivePreviousScore(prev);
  const previousBreakdown = calculateSoloLevelScore({
    stars: Math.max(0, Number(prev.bestScoreStars ?? prev.bestStars) || 0),
    elapsedSeconds: prev.bestTimeSeconds,
    passed: Math.max(0, Number(prev.bestScoreStars ?? prev.bestStars) || 0) > 0,
  });

  return {
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
    improvedScore: replaceScoreRecord,
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
    const derived = calculateSoloLevelScore({
      stars,
      elapsedSeconds: entry?.bestTimeSeconds,
      passed: stars > 0,
    });
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
