export {
  buildSoloLeaderboardPayload,
  getLeaderboardOwnerKey,
  getSafeLeaderboardName,
  loadSoloLeaderboardEntries,
  publishSoloLeaderboardEntry,
  rankSoloLeaderboardEntries,
  selectLeaderboardSections,
  toSoloLeaderboardEntry,
} from '@/lib/leaderboard';

export const leaderboardGatewayContract = Object.freeze({
  currentProjectionEntity: 'SoloLeaderboardEntry',
  futureAlias: 'LeaderboardProjection',
  publicEmailExposure: false,
  noRawEmail: true,
  sortDisplayField: 'total_kronox_score',
  refreshJob: 'refreshLeaderboardProjection',
});
