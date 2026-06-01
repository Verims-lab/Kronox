import { getSoloLevelCount, readSoloProgress } from './soloLevels';
import { summarizeSoloProgress } from './soloProgressHelpers';

export function getOnlineProgressScore(user) {
  const score = Number(user?.online_progress?.score);
  return Number.isFinite(score) ? Math.max(0, Math.floor(score)) : 0;
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
 * Solo leaderboard ranking remains based on Solo best-score totals. The
 * player-facing Kronox Puan shown in headers/Profile/Liderlik stat cards is
 * the durable game score the player sees after both Solo and Online play:
 *
 *   kronoxPuan = solo_progress.totalSoloScore + online_progress.score
 */
export function getKronoxVisibleScore(user, options = {}) {
  return getSoloProgressScore(user, options) + getOnlineProgressScore(user);
}
