import { getSoloLevelCount, readSoloProgress } from './soloLevels';
import { summarizeSoloProgress } from './soloProgressHelpers';

export function getOnlineProgressScore(user) {
  const score = Number(user?.online_progress?.score);
  return Number.isFinite(score) ? Math.max(0, Math.floor(score)) : 0;
}

/**
 * Materialized current-score read — PRIMARY visible read path.
 *
 * The visible Kronox Puan is the materialized current-score projection, not a
 * reconstruction from full Solo/Online history or score ledgers. The mapping
 * is direct: visible kronoxPuan = kronox_puan_total (the materialized
 * User.kronox_puan_total / GuestProfile.kronox_puan_total projection that both
 * Solo finalization and Online result writes keep current). Returns null only
 * when no materialized projection exists yet (older rows), so the caller can
 * fall back to a derived value for backward compatibility.
 */
export function getMaterializedKronoxScore(user) {
  // Visible-score contract: kronoxPuan = kronox_puan_total (materialized).
  const kronoxPuan = Number(user?.kronox_puan_total);
  return Number.isFinite(kronoxPuan) && kronoxPuan >= 0 ? Math.floor(kronoxPuan) : null;
}

export function getSoloProgressScore(user, options = {}) {
  const totalLevels = options.totalLevels || getSoloLevelCount();
  const progress = options.soloProgress || readSoloProgress(user);
  const summary = summarizeSoloProgress(progress, totalLevels);
  return Number.isFinite(Number(summary.totalSoloScore))
    ? Math.max(0, Math.floor(Number(summary.totalSoloScore)))
    : 0;
}

/**
 * Visible Kronox Puan source of truth — UNIFIED across Solo and Online.
 *
 * Kronox Puan is ONE score. Solo and Online are not separate public score
 * systems: both Solo level finalization and Online result writes update the
 * SAME materialized current score, and Leaderboard / Profile / headers all
 * read that one unified visible source. There is no separate Solo-only or
 * Online-only public score field.
 *
 * Online + Solo composition contract:
 *   visibleKronoxPuan = solo_progress.totalSoloScore + online_progress.score
 *     • Solo level finalization writes Solo best-score progress
 *       (solo_progress.totalSoloScore) AND the materialized kronox_puan_total.
 *     • Online result finalization writes online_progress?.score (winner +15,
 *       loser -6, no speed bonus) AND the SAME materialized kronox_puan_total.
 *     • Daily Calendar / Streak is Diamond-only. Daily Wheel V2 can grant
 *       Diamonds, approved jokers, or Gift Box rewards. Neither writes Kronox
 *       Puan, so they never affect this visible score or the leaderboard.
 *
 * Preferred read = the materialized projection (kronox_puan_total). The
 * leaderboard reads this materialized value rather than recomputing from full
 * historical score transactions; any ledger/history exists for audit and
 * idempotency only, not the normal leaderboard read path. Materialized
 * sources/projections: User.kronox_puan_total, GuestProfile.kronox_puan_total,
 * and SoloLeaderboardEntry.total_kronox_score (a LEGACY leaderboard projection
 * name — despite "Solo" in the name it already includes Online writes, so it
 * is not proof of a Solo-only public score model).
 *
 * When older rows are missing that materialized projection, the helper
 * derives a backward-compatible value from the same Online + Solo composition
 * (solo_progress.totalSoloScore + online_progress.score). Once a materialized
 * projection exists it is authoritative; local derived state cannot override
 * it while backend persistence/reconciliation is still in flight.
 */
export function getKronoxVisibleScore(user, options = {}) {
  const materialized = getMaterializedKronoxScore(user);
  const derived = getSoloProgressScore(user, options) + getOnlineProgressScore(user);
  return materialized === null ? derived : materialized;
}

export function getUnifiedKronoxPuan(user, options = {}) {
  return getKronoxVisibleScore(user, options);
}
