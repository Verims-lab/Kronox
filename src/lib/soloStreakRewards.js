import { base44 } from '@/api/base44Client';

export const SOLO_STREAK_RETRY_DELAYS_MS = Object.freeze([0, 280, 720]);

const RETRYABLE_SOLO_STREAK_CODES = new Set([
  'solo_streak_receipt_not_ready',
  'economy_operation_in_progress',
]);

function sleep(ms) {
  return ms > 0 ? new Promise((resolve) => setTimeout(resolve, ms)) : Promise.resolve();
}

function responseData(value) {
  return value?.data || value?.body || value?.response?.data || value || {};
}

export async function claimSoloStreakReward({ attemptId, milestone, levelNumber }, options = {}) {
  const delays = Array.isArray(options.retryDelaysMs)
    ? options.retryDelaysMs
    : SOLO_STREAK_RETRY_DELAYS_MS;
  let lastError = null;
  for (let index = 0; index < delays.length; index += 1) {
    await sleep(Number(delays[index]) || 0);
    try {
      const response = await base44.functions.invoke('claimLoginBonuses', {
        action: 'solo_streak_reward',
        attemptId,
        milestone,
        levelNumber,
      });
      const result = responseData(response);
      const retryable = result?.ok === false && RETRYABLE_SOLO_STREAK_CODES.has(String(result?.code || ''));
      if (retryable && index < delays.length - 1) continue;
      return result;
    } catch (error) {
      lastError = error;
      const code = String(responseData(error)?.code || '');
      if (!RETRYABLE_SOLO_STREAK_CODES.has(code) || index === delays.length - 1) throw error;
    }
  }
  throw lastError || new Error('solo_streak_reward_failed');
}

export const SOLO_STREAK_REWARD_CONTRACT = Object.freeze({
  backendFunction: 'claimLoginBonuses',
  backendAction: 'solo_streak_reward',
  retryableCodes: [...RETRYABLE_SOLO_STREAK_CODES],
  retryDelaysMs: SOLO_STREAK_RETRY_DELAYS_MS,
  noClientDiamondMutation: true,
  noKronoxPuan: true,
  noLeaderboardImpact: true,
  noDailyGoalImpact: true,
});

export function trackSoloStreakEvent(eventName, properties = {}) {
  try {
    base44.analytics.track({ eventName, properties });
  } catch {
    // Best-effort analytics is downstream of gameplay and rewards.
  }
}
