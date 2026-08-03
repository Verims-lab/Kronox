import { base44 } from '@/api/base44Client';

export async function claimSoloStreakReward({ attemptId, milestone, levelNumber }) {
  const response = await base44.functions.invoke('claimLoginBonuses', {
    action: 'solo_streak_reward',
    attemptId,
    milestone,
    levelNumber,
  });
  return response?.data || response || {};
}

export function trackSoloStreakEvent(eventName, properties = {}) {
  try {
    base44.analytics.track({ eventName, properties });
  } catch {
    // Best-effort analytics is downstream of gameplay and rewards.
  }
}