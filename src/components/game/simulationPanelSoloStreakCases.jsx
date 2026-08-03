import gameSource from '../../pages/Game.jsx?raw';
import layoutSource from './GameLayout.jsx?raw';
import hudSource from './SoloStreakHud.jsx?raw';
import hookSource from '../../features/solo/viewModel/useSoloStreakSystem.js?raw';
import rewardSource from '../../lib/soloStreakRewards.js?raw';
import backendSource from '../../../base44/functions/claimLoginBonuses/entry.ts?raw';
import dailySource from '../../lib/dailyQuestEvents.js?raw';
import onlineSource from '../../lib/applyOnlineResult.js?raw';
import { applySoloStreakPlacement, createSoloStreakState } from '@/features/solo/model/soloStreakModel';

const SUITE_ID = 'solo_streak_health';
const suite = { id: SUITE_ID, name: 'Solo Streak System Health Suite', critical: true, color: '#facc15' };
const pass = (reason) => ({ status: 'PASS', reason, verification: 'EXECUTABLE' });
const fail = (reason) => ({ status: 'FAIL', reason, verification: 'EXECUTABLE' });
const makeCase = (id, name, run) => ({
  key: `${SUITE_ID}.${id}`,
  suiteId: SUITE_ID,
  suiteName: suite.name,
  id,
  name,
  critical: true,
  actionType: 'CODE_FIX',
  nextStep: 'Keep Kronox Seri Sistemi Solo-only, assistance-neutral, source-proven, idempotent, and Diamond-only.',
  run,
});
const step = (state, placement) => applySoloStreakPlacement(state, placement);
const clean = (state, levelNumber = 7, placementKey = '') => step(state, { correct: true, levelNumber, placementKey });

export const EXTRA_SUITES = [suite];
export const EXTRA_TESTS = [
  makeCase('solo_only_no_online', 'Streak system is Solo-only', () => (
    gameSource.includes('enabled: isSoloLevelMode')
    && layoutSource.includes('!isOnline && showSoloLevelHeader')
    && !onlineSource.includes('soloStreak')
      ? pass('Solo gates own runtime and HUD; Online result authority has no streak dependency.')
      : fail('Solo/Online streak boundary drifted.')
  )),
  makeCase('thresholds_trigger_correct_feedback', 'Clean thresholds trigger 2/3/4/5 milestones', () => {
    let state = createSoloStreakState();
    const seen = [];
    for (let index = 0; index < 5; index += 1) {
      const result = clean(state);
      state = result.state;
      if (result.milestone) seen.push(result.milestone);
    }
    return seen.join(',') === 'streak2,streak3,streak4,streak5' && hudSource.includes('KRONOX SERİSİ!')
      ? pass('All four feedback thresholds execute in order.')
      : fail(`Unexpected milestones: ${seen.join(',')}`);
  }),
  makeCase('wrong_answer_resets_streak', 'Wrong answer resets streak', () => {
    const active = clean(clean(createSoloStreakState()).state).state;
    const result = step(active, { correct: false });
    return result.state.currentSoloStreak === 0 && result.broken
      ? pass('Wrong placement resets a live streak to zero.')
      : fail('Wrong placement did not reset streak.');
  }),
  makeCase('joker_does_not_increment_or_break', 'Joker-assisted correct is neutral', () => {
    const active = clean(clean(createSoloStreakState()).state).state;
    const result = step(active, { correct: true, usedJoker: true, levelNumber: 7 });
    return result.state.currentSoloStreak === 2 && !result.milestone
      ? pass('Joker assistance preserves but does not increment streak.')
      : fail('Joker assistance changed streak.');
  }),
  makeCase('hint_does_not_increment_or_break', 'Hint-assisted correct is neutral', () => {
    const active = clean(clean(createSoloStreakState()).state).state;
    const result = step(active, { correct: true, usedHint: true, levelNumber: 7 });
    return result.state.currentSoloStreak === 2 && !result.milestone
      ? pass('Hint assistance preserves but does not increment streak.')
      : fail('Hint assistance changed streak.');
  }),
  makeCase('hint_is_not_joker', 'Hint and Joker flags stay separate', () => {
    const result = step(createSoloStreakState(), { correct: true, usedHint: true });
    return result.state.currentQuestionUsedHint
      && !result.state.currentQuestionUsedJoker
      && gameSource.includes('usedHintForStreak')
      && gameSource.includes('usedJokerTypeForStreak')
      ? pass('Hint and Joker use have independent current-card flags.')
      : fail('Hint is conflated with Joker.');
  }),
  makeCase('training_levels_no_economy_reward', 'Levels 1-6 are visual-only', () => {
    let state = createSoloStreakState();
    let reward = null;
    for (let index = 0; index < 5; index += 1) {
      const result = clean(state, 6);
      state = result.state;
      reward ||= result.rewardRequest;
    }
    return !reward
      && state.latestMilestone === 'streak5'
      && backendSource.includes('levelNumber < 7')
      && backendSource.includes('level: levelNumber')
      ? pass('Training reaches visual milestones without client or backend reward eligibility.')
      : fail('Training can create an economy reward.')
  }),
  makeCase('duplicate_placement_is_neutral', 'Duplicate placement callbacks cannot advance streak', () => {
    const first = clean(createSoloStreakState(), 7, 'attempt-1:answer-1');
    const duplicate = clean(first.state, 7, 'attempt-1:answer-1');
    return first.state.currentSoloStreak === 1
      && duplicate.duplicate === true
      && duplicate.state.currentSoloStreak === 1
      && !duplicate.rewardRequest
      ? pass('Stable placement keys suppress duplicate callback progress and rewards.')
      : fail('Duplicate placement callback advanced streak state.')
  }),
  makeCase('milestone_rewards_idempotent_per_attempt', 'Milestone reward requests are once per attempt', () => {
    let state = createSoloStreakState();
    const requests = [];
    for (let index = 0; index < 5; index += 1) {
      const result = clean(state, 7, `attempt-1:answer-${index + 1}`);
      state = result.state;
      if (result.rewardRequest) requests.push(result.rewardRequest.milestone);
    }
    const duplicate = step(state, { correct: true, levelNumber: 7, placementKey: 'attempt-1:answer-5' });
    return requests.join(',') === 'streak4,streak5'
      && !duplicate.rewardRequest
      && backendSource.includes('idempotencyKey = `solo_streak_reward:')
      && backendSource.includes('seenEventIds')
      ? pass('Client state and backend receipt verification both suppress duplicates.')
      : fail('Milestone idempotency drifted.');
  }),
  makeCase('persisted_answer_receipts_are_bound', 'Rewards require level-bound persisted clean answer receipts', () => (
    backendSource.includes('QuestionAttemptEvent')
    && backendSource.includes('attempt_id: attemptId')
    && backendSource.includes('event_type: \'answered\'')
    && backendSource.includes('level: levelNumber')
    && backendSource.includes('Number(row?.level) !== levelNumber')
    && backendSource.includes('row?.metadata?.streakAssisted === true')
    && gameSource.includes('joker_used: usedJokerForStreak')
    && gameSource.includes('hintUsed: usedHintForStreak')
      ? pass('Backend proof is attempt/level-bound, deduped, and assistance-aware.')
      : fail('Persisted streak reward proof is incomplete.')
  )),
  makeCase('reward_retry_is_bounded', 'Receipt and lock propagation retries are bounded', () => (
    rewardSource.includes('SOLO_STREAK_RETRY_DELAYS_MS')
    && rewardSource.includes('solo_streak_receipt_not_ready')
    && rewardSource.includes('economy_operation_in_progress')
    && rewardSource.includes('index < delays.length - 1')
      ? pass('Only known transient receipt/lock failures receive bounded retries.')
      : fail('Solo streak claims lack bounded transient recovery.')
  )),
  makeCase('reward_does_not_affect_puan_or_leaderboard', 'Rewards mutate Diamonds only', () => (
    backendSource.includes("source: 'solo_streak'")
    && backendSource.includes('noKronoxPuan: true')
    && backendSource.includes('noLeaderboardImpact: true')
    && rewardSource.includes('noClientDiamondMutation: true')
    && !rewardSource.includes('kronox_puan_total')
      ? pass('Reward path is backend-owned and Diamond-only.')
      : fail('Reward path can affect score/leaderboard or grant client-side.')
  )),
  makeCase('no_daily_goal_cross_contamination', 'Streak does not emit Daily events', () => (
    !rewardSource.includes('recordDailyQuest')
    && !hookSource.includes('recordDailyQuest')
    && backendSource.includes('noDailyGoalImpact: true')
    && dailySource.includes('recordDailyQuestSourceEvent')
      ? pass('Streak rewards stay outside Daily event progression.')
      : fail('Streak/Daily boundary drifted.')
  )),
  makeCase('guest_reward_is_fail_closed', 'Guest milestones stay visual-only without reward claims', () => (
    hookSource.includes('if (!authenticated) return;')
    && hookSource.includes("authenticated ? 'pending' : 'unsupported'")
    && hudSource.includes('visualOnlyRewardMilestone')
    && hudSource.includes('Seri devam ediyor')
      ? pass('Guests keep streak feedback without a fake grant or reward-error message.')
      : fail('Guest streak feedback can imply or attempt an unsupported Diamond grant.')
  )),
  makeCase('effects_cleanup', 'Visual and async effects clean up', () => (
    hudSource.includes('window.clearTimeout(timer)')
    && hudSource.includes('onFeedbackDone')
    && hookSource.includes('activeAttemptRef')
    && hookSource.includes('mountedRef.current = true')
    && !hudSource.includes('repeat: Infinity')
      ? pass('Feedback timers are finite and stale async reward responses are ignored.')
      : fail('Streak effect cleanup is missing.')
  )),
  makeCase('mobile_reduced_motion_safe', 'HUD is mobile-width and reduced-motion safe', () => (
    hudSource.includes("width: 'min(calc(100vw - 2rem), 20rem)'")
    && hudSource.includes("max-w-[calc(100vw-2rem)]")
    && hudSource.includes('pointer-events-none')
    && hudSource.includes('useReducedMotion')
    && hudSource.includes('duration: reduced ? 0')
      ? pass('HUD is bounded to the mobile viewport, non-interactive, finite, and reduced-motion aware.')
      : fail('HUD mobile or reduced-motion guard drifted.')
  )),
  makeCase('analytics_downstream_only', 'Analytics is downstream only', () => (
    rewardSource.includes('try {')
    && rewardSource.includes('Best-effort analytics is downstream')
    && !String(applySoloStreakPlacement).includes('analytics')
      ? pass('Pure transition owns gameplay rules; analytics failure is ignored.')
      : fail('Analytics can control streak gameplay rules.')
  )),
];
