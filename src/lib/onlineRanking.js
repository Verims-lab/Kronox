// Codex136 — Online ranking math (pure helpers).
//
// PRODUCT RULES (source of truth: docs/KRONOX_SCORING_RULES.md)
//   • Online win        : +15
//   • Online loss       : -6
//   • No draw scoring   : matches must resolve to one winner and one loser.
//   • No Online speed/time bonus. Elapsed seconds may be stored for audit or
//     display, but they must not change the Online score delta.
//
//   Checkpoint ladder:
//     [0, 100, 250, 500, 1000, 1500, 2000, 3000]
//
//   Checkpoint rule:
//     Oyuncu ulaştigi en yüksek checkpoint'in ALTINA puan kaybiyla düsemez.
//     (Wins never get clamped — only loss reductions get floored at the
//      player's reached checkpoint.)
//
// PURITY
//   No imports, no React, no DOM, no SDK. Same input → same output.
//   Health Center and runtime both call these directly.
//
// HELPER NAMING (Codex136)
//   The product doc names helpers as:
//     - calculateOnlineWinnerDelta(elapsedSeconds)
//     - calculateOnlineLoserDelta()
//     - getOnlineCheckpoint(score)
//     - applyOnlineScoreWithCheckpoint(currentScore, delta)
//     - applyOnlineMatchResultOnce(matchResult)
//   These names are exported as thin aliases at the bottom of this file
//   so callers and Health cases can use either set. There is ONE source
//   of scoring truth per concern (no duplicated math).

export const ONLINE_WIN_POINTS = 15;
export const ONLINE_LOSS_POINTS = -6;

export const ONLINE_TIME_BONUS_TIERS = Object.freeze([]);

export const ONLINE_CHECKPOINTS = Object.freeze([
  0, 100, 250, 500, 1000, 1500, 2000, 3000,
]);

const RESULT_WIN = 'win';
const RESULT_LOSS = 'loss';

export const ONLINE_RESULT = Object.freeze({
  WIN: RESULT_WIN,
  LOSS: RESULT_LOSS,
});

/**
 * Online has no speed bonus. This legacy helper stays exported so older
 * callers and Health contracts have a stable API, but it always returns 0.
 */
export function getOnlineWinnerTimeBonus(_durationSeconds) {
  return 0;
}

/**
 * Highest checkpoint <= score. Used to compute the floor a player can
 * not be dropped below on a loss. For score >= 3000 the floor is 3000.
 */
export function getReachedCheckpoint(score) {
  const safe = Number.isFinite(Number(score)) ? Number(score) : 0;
  let reached = ONLINE_CHECKPOINTS[0];
  for (const cp of ONLINE_CHECKPOINTS) {
    if (safe >= cp) reached = cp;
    else break;
  }
  return reached;
}

/**
 * Raw delta for a single match BEFORE checkpoint clamping.
 *
 *   result          : 'win' | 'loss'
 *   durationSeconds : elapsed seconds retained for audit/display only
 *
 * Codex136 — Draw scoring is removed. Passing result === 'draw' (or anything
 * other than 'win' / 'loss') returns a zero delta — it does NOT silently
 * award +3 anymore. Callers should never pass 'draw'; deterministic winner
 * selection is required at the call site.
 */
export function calculateOnlineMatchDelta({ result, durationSeconds } = {}) {
  if (result === RESULT_WIN) {
    const bonus = getOnlineWinnerTimeBonus(durationSeconds);
    return { base: ONLINE_WIN_POINTS, timeBonus: bonus, delta: ONLINE_WIN_POINTS + bonus };
  }
  if (result === RESULT_LOSS) {
    return { base: ONLINE_LOSS_POINTS, timeBonus: 0, delta: ONLINE_LOSS_POINTS };
  }
  return { base: 0, timeBonus: 0, delta: 0 };
}

/**
 * Apply a single match result to an existing online_progress snapshot.
 *
 * Inputs:
 *   progress       : current online_progress object (may be null/empty)
 *   result         : 'win' | 'loss'   (draws are not supported)
 *   durationSeconds: optional elapsed seconds retained for audit/display only
 *
 * Returns:
 *   {
 *     progress: <next online_progress>,
 *     applied:  { result, base, timeBonus, delta, effectiveDelta,
 *                 previousScore, nextScore, floorCheckpoint,
 *                 clampedByCheckpoint, peakScore, peakCheckpoint },
 *   }
 *
 * Checkpoint rule (the only non-trivial step):
 *   • Compute prospective = previousScore + delta.
 *   • floorCheckpoint    = peakCheckpoint reached BEFORE this match
 *                          (i.e. derived from previousScore + stored peak).
 *   • If prospective < floorCheckpoint AND delta < 0:
 *       nextScore = floorCheckpoint
 *       clampedByCheckpoint = true
 *       effectiveDelta = nextScore - previousScore  (>= delta, may be 0)
 *     Otherwise: nextScore = prospective, effectiveDelta = delta.
 *
 * Wins never get clamped down — they only ratchet the score up.
 *
 * Codex136 — Persistence shape:
 *   • Writes `lastMatchAt` (product doc) instead of `lastUpdatedAt`.
 *   • Does NOT write `draws` (draw scoring removed). Existing
 *     online_progress objects with a `draws` field are NOT crashed; the
 *     field is simply ignored for new writes.
 */
export function applyOnlineMatchResult(progress, { result, durationSeconds } = {}) {
  const prev = progress && typeof progress === 'object' ? progress : {};
  const previousScore = Number.isFinite(Number(prev.score)) ? Number(prev.score) : 0;
  const previousPeakScore = Number.isFinite(Number(prev.peakScore))
    ? Number(prev.peakScore)
    : previousScore;
  const previousPeakCheckpoint = Number.isFinite(Number(prev.peakCheckpoint))
    ? Number(prev.peakCheckpoint)
    : getReachedCheckpoint(Math.max(previousScore, previousPeakScore));

  const { base, timeBonus, delta } = calculateOnlineMatchDelta({ result, durationSeconds });
  const prospective = previousScore + delta;

  // The floor is whichever is higher: the stored peakCheckpoint or the
  // checkpoint the previousScore already sits on. (Ensures a fresh user
  // with score 130 but no stored peakCheckpoint still gets a 100 floor.)
  const floorCheckpoint = Math.max(
    previousPeakCheckpoint,
    getReachedCheckpoint(previousScore),
  );

  let nextScore = prospective;
  let clampedByCheckpoint = false;
  if (delta < 0 && prospective < floorCheckpoint) {
    nextScore = floorCheckpoint;
    clampedByCheckpoint = true;
  }
  // Score floor is also 0 — applies only if the player has never reached
  // any checkpoint (shouldn't happen because 0 is in the ladder, but
  // defensive).
  if (nextScore < 0) nextScore = 0;

  const effectiveDelta = nextScore - previousScore;
  const nextPeakScore = Math.max(previousPeakScore, nextScore);
  const nextPeakCheckpoint = Math.max(
    previousPeakCheckpoint,
    getReachedCheckpoint(nextScore),
  );

  const wins = Number.isFinite(Number(prev.wins)) ? Number(prev.wins) : 0;
  const losses = Number.isFinite(Number(prev.losses)) ? Number(prev.losses) : 0;

  const nextWins = result === RESULT_WIN ? wins + 1 : wins;
  const nextLosses = result === RESULT_LOSS ? losses + 1 : losses;

  return {
    progress: {
      score: nextScore,
      peakScore: nextPeakScore,
      peakCheckpoint: nextPeakCheckpoint,
      wins: nextWins,
      losses: nextLosses,
      lastMatchAt: new Date().toISOString(),
    },
    applied: {
      result,
      base,
      timeBonus,
      delta,
      effectiveDelta,
      previousScore,
      nextScore,
      floorCheckpoint,
      clampedByCheckpoint,
      peakScore: nextPeakScore,
      peakCheckpoint: nextPeakCheckpoint,
    },
  };
}

// ─── Codex136 — Doc-named aliases (no duplicated logic) ──────────────
// docs/KRONOX_SCORING_RULES.md §3.6 lists these helper names. We expose
// them as thin wrappers around the canonical implementations above so
// either naming style works. There is still a single source of math.

/** Winner delta is always the +15 base; elapsed time is ignored for scoring. */
export function calculateOnlineWinnerDelta(elapsedSeconds) {
  return calculateOnlineMatchDelta({ result: RESULT_WIN, durationSeconds: elapsedSeconds }).delta;
}

/** Loser delta — constant -6. */
export function calculateOnlineLoserDelta() {
  return calculateOnlineMatchDelta({ result: RESULT_LOSS }).delta;
}

/** Highest checkpoint <= score (alias of getReachedCheckpoint). */
export function getOnlineCheckpoint(score) {
  return getReachedCheckpoint(score);
}

/**
 * Apply a raw delta to a current score with the checkpoint floor rule.
 * Wins/positive deltas pass through unchanged. Losses cannot drop below
 * the highest checkpoint reached by `currentScore`, and never below 0.
 */
export function applyOnlineScoreWithCheckpoint(currentScore, delta) {
  const safeScore = Number.isFinite(Number(currentScore)) ? Number(currentScore) : 0;
  const safeDelta = Number.isFinite(Number(delta)) ? Number(delta) : 0;
  if (safeDelta >= 0) return safeScore + safeDelta;
  const checkpoint = getReachedCheckpoint(safeScore);
  const rawScore = safeScore + safeDelta;
  return Math.max(rawScore, checkpoint, 0);
}

/**
 * Doc-named alias of `applyOnlineMatchResult`. The "Once" suffix matches
 * the product doc which scopes this helper to a single match application.
 * Caller-side idempotency (lastMatchId guard) lives in
 * lib/applyOnlineResult.js.
 */
export function applyOnlineMatchResultOnce(matchResult) {
  const { progress, ...rest } = matchResult || {};
  return applyOnlineMatchResult(progress, rest);
}
