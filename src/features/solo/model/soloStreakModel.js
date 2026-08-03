export const SOLO_STREAK_THRESHOLDS = Object.freeze({ COMBO: 2, FLAME: 3, REWARD: 4, KRONOX: 5 });
export const SOLO_STREAK_REWARDS = Object.freeze({ streak4: 3, streak5: 5 });

export function createSoloStreakState() {
  return {
    currentSoloStreak: 0,
    currentQuestionUsedJoker: false,
    currentQuestionUsedHint: false,
    processedPlacementKeys: [],
    rewardedMilestonesThisAttempt: [],
    latestMilestone: null,
  };
}

export function applySoloStreakPlacement(state, placement = {}) {
  const previous = state || createSoloStreakState();
  const previousPlacementKeys = Array.isArray(previous.processedPlacementKeys)
    ? previous.processedPlacementKeys
    : [];
  const placementKey = String(placement.placementKey || '').trim();
  if (placementKey && previousPlacementKeys.includes(placementKey)) {
    return {
      state: previous,
      duplicate: true,
      broken: false,
      milestone: null,
      rewardRequest: null,
    };
  }
  const processedPlacementKeys = placementKey
    ? [...previousPlacementKeys, placementKey].slice(-20)
    : previousPlacementKeys;
  const usedJoker = placement.usedJoker === true;
  const usedHint = placement.usedHint === true;
  if (placement.correct !== true) {
    return {
      state: { ...previous, currentSoloStreak: 0, currentQuestionUsedJoker: usedJoker, currentQuestionUsedHint: usedHint, processedPlacementKeys, latestMilestone: null },
      duplicate: false,
      broken: previous.currentSoloStreak > 0,
      milestone: null,
      rewardRequest: null,
    };
  }
  if (usedJoker || usedHint) {
    return {
      state: { ...previous, currentQuestionUsedJoker: usedJoker, currentQuestionUsedHint: usedHint, processedPlacementKeys, latestMilestone: null },
      duplicate: false,
      broken: false,
      milestone: null,
      rewardRequest: null,
    };
  }
  const streak = previous.currentSoloStreak + 1;
  const milestone = streak >= 2 && streak <= 5 ? `streak${streak}` : null;
  const rewardAmount = SOLO_STREAK_REWARDS[milestone] || 0;
  const rewardEligible = Number(placement.levelNumber) >= 7 && rewardAmount > 0;
  const alreadyRequested = previous.rewardedMilestonesThisAttempt.includes(milestone);
  const rewardedMilestonesThisAttempt = rewardEligible && !alreadyRequested
    ? [...previous.rewardedMilestonesThisAttempt, milestone]
    : previous.rewardedMilestonesThisAttempt;
  return {
    state: { ...previous, currentSoloStreak: streak, currentQuestionUsedJoker: false, currentQuestionUsedHint: false, processedPlacementKeys, rewardedMilestonesThisAttempt, latestMilestone: milestone },
    duplicate: false,
    broken: false,
    milestone,
    rewardRequest: rewardEligible && !alreadyRequested ? { milestone, amount: rewardAmount } : null,
  };
}
