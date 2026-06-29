import { getSoloLevelCount, readSoloProgress } from './soloLevels';
import { summarizeSoloProgress } from './soloProgressHelpers';

export function getOnlineProgressScore(user) {
  const score = Number(user?.online_progress?.score);
  return Number.isFinite(score) ? Math.max(0, Math.floor(score)) : 0;
}

export function getMaterializedKronoxScore(user) {
  const score = Number(user?.kronox_puan_total);
  return Number.isFinite(score) && score >= 0 ? Math.floor(score) : null;
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
 * Visible Kronox Puan source of truth.
 *
 * Leaderboard ranking, headers, Profile, and other player-facing score
 * surfaces must all show the same durable game score after both Solo and
 * Online play:
 *
 *   kronoxPuan = kronox_puan_total
 *
 * When older rows are missing that materialized projection, the helper
 * derives a backward-compatible value from Solo best-score progress plus the
 * Online score component. If both values exist, the higher non-negative value
 * wins so a stale local progress object cannot down-display a persisted score.
 */
export function getKronoxVisibleScore(user, options = {}) {
  const materialized = getMaterializedKronoxScore(user);
  const derived = getSoloProgressScore(user, options) + getOnlineProgressScore(user);
  return materialized === null ? derived : Math.max(materialized, derived);
}

export function getUnifiedKronoxPuan(user, options = {}) {
  return getKronoxVisibleScore(user, options);
}
