import { useCallback, useEffect, useRef, useState } from 'react';
import { applySoloStreakPlacement, createSoloStreakState } from '@/features/solo/model/soloStreakModel';
import { claimSoloStreakReward, trackSoloStreakEvent } from '@/lib/soloStreakRewards';

export function useSoloStreakSystem({ enabled, attemptId, levelNumber, authenticated, onBalance }) {
  const stateRef = useRef(createSoloStreakState());
  const activeAttemptRef = useRef(attemptId);
  const mountedRef = useRef(true);
  activeAttemptRef.current = attemptId;
  const [state, setState] = useState(stateRef.current);
  const [feedback, setFeedback] = useState(null);
  const reset = useCallback(() => {
    stateRef.current = createSoloStreakState();
    setState(stateRef.current);
    setFeedback(null);
  }, []);
  useEffect(() => { reset(); }, [attemptId, enabled, reset]);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);
  const processPlacement = useCallback(({ correct, usedJoker, usedHint, placementKey }) => {
    if (!enabled) return;
    const transition = applySoloStreakPlacement(stateRef.current, {
      correct,
      usedJoker,
      usedHint,
      placementKey,
      levelNumber,
    });
    if (transition.duplicate) return;
    stateRef.current = transition.state;
    setState(transition.state);
    if (transition.broken) trackSoloStreakEvent('solo_streak_broken', { level: levelNumber || 0 });
    if (transition.milestone) {
      setFeedback({
        key: `${attemptId}:${transition.milestone}:${Date.now()}`,
        milestone: transition.milestone,
        rewardStatus: transition.rewardRequest
          ? (authenticated ? 'pending' : 'unsupported')
          : 'visual',
      });
      trackSoloStreakEvent(`solo_${transition.milestone}`, { level: levelNumber || 0, rewardEligible: Boolean(transition.rewardRequest) });
    }
    if (!transition.rewardRequest) return;
    if (!authenticated) return;
    const rewardAttemptId = attemptId;
    claimSoloStreakReward({ attemptId: rewardAttemptId, milestone: transition.rewardRequest.milestone, levelNumber })
      .then((result) => {
        if (!mountedRef.current || activeAttemptRef.current !== rewardAttemptId) return;
        setFeedback({ key: `${rewardAttemptId}:${transition.rewardRequest.milestone}:reward:${Date.now()}`, milestone: transition.rewardRequest.milestone, rewardStatus: result?.ok ? 'granted' : 'failed' });
        if (result?.ok) onBalance?.(result.diamondBalanceAfter);
        trackSoloStreakEvent(result?.ok ? `solo_${transition.rewardRequest.milestone}_rewarded` : 'solo_streak_reward_claim_failed', { level: levelNumber || 0 });
      })
      .catch(() => {
        if (!mountedRef.current || activeAttemptRef.current !== rewardAttemptId) return;
        setFeedback({ key: `${rewardAttemptId}:${transition.rewardRequest.milestone}:failed`, milestone: transition.rewardRequest.milestone, rewardStatus: 'failed' });
        trackSoloStreakEvent('solo_streak_reward_claim_failed', { level: levelNumber || 0 });
      });
  }, [attemptId, authenticated, enabled, levelNumber, onBalance]);
  const clearFeedback = useCallback(() => setFeedback(null), []);
  return { state, feedback, processPlacement, reset, clearFeedback };
}
