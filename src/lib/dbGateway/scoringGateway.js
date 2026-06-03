import { applyOnlineMatchToCurrentUser } from '@/lib/applyOnlineResult';
import {
  buildSoloLeaderboardPayload,
  publishSoloLeaderboardEntry,
} from '@/lib/leaderboard';
import { getKronoxVisibleScore } from '@/lib/kronoxScore';

export {
  applyOnlineMatchToCurrentUser,
  buildSoloLeaderboardPayload,
  getKronoxVisibleScore,
  publishSoloLeaderboardEntry,
};

export const scoringGatewayContract = Object.freeze({
  visibleScore: 'unified Kronox Puan',
  onlineIdempotency: 'OnlineMatchResult.idempotency_key logical guard; unique constraint platform/manual',
  leaderboardProjection: 'SoloLeaderboardEntry.total_kronox_score',
});
