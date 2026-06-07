import { base44 } from '@/api/base44Client';

export async function expireOldGameInvites(options = {}) {
  return base44.functions.invoke('expireOldGameInvites', options);
}

export async function cancelStaleLobbies(options = {}) {
  return base44.functions.invoke('cancelStaleLobbies', options);
}

export async function expirePushSubscriptions(options = {}) {
  return base44.functions.invoke('expirePushSubscriptions', options);
}

export async function refreshLeaderboardProjection(options = {}) {
  return base44.functions.invoke('refreshLeaderboardProjection', options);
}

export async function aggregateQuestionStats(options = {}) {
  return base44.functions.invoke('aggregateQuestionStats', options);
}

export async function resetQuestionAnalyticsData(options = {}) {
  return base44.functions.invoke('resetQuestionAnalyticsData', options);
}

export async function cleanupAdminMaintenanceLog(options = {}) {
  return base44.functions.invoke('cleanupAdminMaintenanceLog', options);
}

export const cleanupGatewayContract = Object.freeze({
  adminOnly: true,
  dryRunCapable: true,
  hardDeleteByDefault: false,
  statusTransitionFirst: true,
});
