export {
  buildSoloLeaderboardPayload,
  buildGuestSoloLeaderboardPayload,
  getGuestLeaderboardOwnerKey,
  getLeaderboardOwnerKey,
  getSafeLeaderboardName,
  loadSoloLeaderboardEntries,
  loadSoloLeaderboardSnapshot,
  publishSoloLeaderboardEntry,
  rankSoloLeaderboardEntries,
  selectLeaderboardSections,
  toSoloLeaderboardEntry,
} from '@/lib/leaderboard';

export const leaderboardGatewayContract = Object.freeze({
  currentProjectionEntity: 'SoloLeaderboardEntry',
  futureAlias: 'LeaderboardProjection',
  publicEmailExposure: false,
  publicInternalOwnerKeyExposure: false,
  noRawEmail: true,
  sanitizedPublicResponse: 'username + leaderboard_id via getSoloLeaderboard',
  sortDisplayField: 'total_kronox_score',
  refreshJob: 'refreshLeaderboardProjection',
});
