// Codex128 — Online ranking math (pure helpers).
//
// PRODUCT RULES
//   • Online win        : +15
//   • Online loss       : −6
//   • Draw              : +3 / +3
//   • Winner time bonus :
//       0–60 sec   → +10
//       61–90 sec  → +5
//       91+ sec    → +0
//
//   Checkpoint ladder:
//     [0, 100, 250, 500, 1000, 1500, 2000, 3000]
//
//   Checkpoint rule:
//     Oyuncu ulaştığı en yüksek checkpoint'in ALTINA puan kaybıyla düşemez.
//     (Win/draw never gets clamped — only loss reductions get floored at
//      the player's reached checkpoint.)
//
// PURITY
//   No imports, no React, no DOM, no SDK. Same input → same output.
//   Health Center and runtime both call these directly.

export const ONLINE_WIN_POINTS = 15;
export const ONLINE_LOSS_POINTS = -6;
export const ONLINE_DRAW_POINTS = 3;

export const ONLINE_TIME_BONUS_TIERS = Object.freeze([
  { maxSeconds: 60, bonus: 10 },
  { maxSeconds: 90, bonus: 5 },
]);

export const ONLINE_CHECKPOINTS = Object.freeze([
  0, 100, 250, 500, 1000, 1500, 2000, 3000,
]);

const RESULT_WIN = 'win';
const RESULT_LOSS = 'loss';
const RESULT_DRAW = 'draw';

export const ONLINE_RESULT = Object.freeze({
  WIN: RESULT_WIN,
  LOSS: RESULT_LOSS,
  DRAW: RESULT_DRAW,
});

function clampNonNegative(n) {
  const v = Number(n);
  return Number.isFinite(v) && v > 0 ? v : 0;
}

/**
 * Returns the winner time bonus for the given match duration (seconds).
 * Non-winners (loss/draw) receive 0 — call only for the winner.
 */
export function getOnlineWinnerTimeBonus(durationSeconds) {
  const seconds = clampNonNegative(durationSeconds);
  for (const tier of ONLINE_TIME_BONUS_TIERS) {
    if (seconds <= tier.maxSeconds) return tier.bonus;
  }
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
 *   result          : 'win' | 'loss' | 'draw'
 *   durationSeconds : match length in seconds (only used for winners)
 */
export function calculateOnlineMatchDelta({ result, durationSeconds = 0 } = {}) {
  if (result === RESULT_WIN) {
    const bonus = getOnlineWinnerTimeBonus(durationSeconds);
    return { base: ONLINE_WIN_POINTS, timeBonus: bonus, delta: ONLINE_WIN_POINTS + bonus };
  }
  if (result === RESULT_DRAW) {
    return { base: ONLINE_DRAW_POINTS, timeBonus: 0, delta: ONLINE_DRAW_POINTS };
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
 *   result         : 'win' | 'loss' | 'draw'
 *   durationSeconds: total match duration (for winner time bonus)
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
 * Wins/draws never get clamped down — they only ratchet the score up.
 */
export function applyOnlineMatchResult(progress, { result, durationSeconds = 0 } = {}) {
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
  const draws = Number.isFinite(Number(prev.draws)) ? Number(prev.draws) : 0;

  const nextWins = result === RESULT_WIN ? wins + 1 : wins;
  const nextLosses = result === RESULT_LOSS ? losses + 1 : losses;
  const nextDraws = result === RESULT_DRAW ? draws + 1 : draws;

  return {
    progress: {
      score: nextScore,
      peakScore: nextPeakScore,
      peakCheckpoint: nextPeakCheckpoint,
      wins: nextWins,
      losses: nextLosses,
      draws: nextDraws,
      lastUpdatedAt: new Date().toISOString(),
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