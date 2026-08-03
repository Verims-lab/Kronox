import gameSource from '../../pages/Game.jsx?raw';
import layoutSource from './GameLayout.jsx?raw';
import hudSource from './SoloStreakHud.jsx?raw';
import rewardSource from '../../lib/soloStreakRewards.js?raw';
import backendSource from '../../../base44/functions/claimLoginBonuses/entry.ts?raw';
import dailySource from '../../lib/dailyQuestEvents.js?raw';
import onlineSource from '../../lib/applyOnlineResult.js?raw';
import { applySoloStreakPlacement, createSoloStreakState } from '@/features/solo/model/soloStreakModel';

const SUITE_ID = 'solo_streak_health';
const suite = { id: SUITE_ID, name: 'Solo Streak System Health Suite', critical: true, color: '#facc15' };
const pass = (reason) => ({ status: 'PASS', reason, verification: 'EXECUTABLE' });
const fail = (reason) => ({ status: 'FAIL', reason, verification: 'EXECUTABLE' });
const makeCase = (id, name, run) => ({ key: `${SUITE_ID}.${id}`, suiteId: SUITE_ID, suiteName: suite.name, id, name, critical: true, actionType: 'CODE_FIX', nextStep: 'Keep Kronox Seri Sistemi Solo-only, assistance-neutral, idempotent, and Diamond-only.', run });
const step = (state, placement) => applySoloStreakPlacement(state, placement);
const clean = (state, levelNumber = 7) => step(state, { correct: true, levelNumber });

export const EXTRA_SUITES = [suite];
export const EXTRA_TESTS = [
  makeCase('solo_only_no_online', 'Streak system is Solo-only', () => gameSource.includes('enabled: isSoloLevelMode') && layoutSource.includes('!isOnline && showSoloLevelHeader') && !onlineSource.includes('soloStreak') ? pass('Solo gates own runtime and HUD; Online result authority has no streak dependency.') : fail('Solo/Online streak boundary drifted.')),
  makeCase('thresholds_trigger_correct_feedback', 'Clean thresholds trigger 2/3/4/5 milestones', () => { let s = createSoloStreakState(); const seen = []; for (let i = 0; i < 5; i += 1) { const r = clean(s); s = r.state; if (r.milestone) seen.push(r.milestone); } return seen.join(',') === 'streak2,streak3,streak4,streak5' && hudSource.includes('KRONOX SERİSİ!') ? pass('All four feedback thresholds execute in order.') : fail(`Unexpected milestones: ${seen.join(',')}`); }),
  makeCase('wrong_answer_resets_streak', 'Wrong answer resets streak', () => { let s = clean(clean(createSoloStreakState()).state).state; const r = step(s, { correct: false }); return r.state.currentSoloStreak === 0 && r.broken ? pass('Wrong placement resets a live streak to zero.') : fail('Wrong placement did not reset streak.'); }),
  makeCase('joker_does_not_increment_or_break', 'Joker-assisted correct is neutral', () => { let s = clean(clean(createSoloStreakState()).state).state; const r = step(s, { correct: true, usedJoker: true, levelNumber: 7 }); return r.state.currentSoloStreak === 2 && !r.milestone ? pass('Joker assistance preserves but does not increment streak.') : fail('Joker assistance changed streak.'); }),
  makeCase('hint_does_not_increment_or_break', 'Hint-assisted correct is neutral', () => { let s = clean(clean(createSoloStreakState()).state).state; const r = step(s, { correct: true, usedHint: true, levelNumber: 7 }); return r.state.currentSoloStreak === 2 && !r.milestone ? pass('Hint assistance preserves but does not increment streak.') : fail('Hint assistance changed streak.'); }),
  makeCase('hint_is_not_joker', 'Hint and Joker flags stay separate', () => { const r = step(createSoloStreakState(), { correct: true, usedHint: true }); return r.state.currentQuestionUsedHint && !r.state.currentQuestionUsedJoker && gameSource.includes('usedHintForStreak') ? pass('Hint has an independent assistance flag.') : fail('Hint is conflated with Joker.'); }),
  makeCase('training_levels_no_economy_reward', 'Levels 1-6 are visual-only', () => { let s = createSoloStreakState(); let reward = null; for (let i = 0; i < 5; i += 1) { const r = clean(s, 6); s = r.state; reward ||= r.rewardRequest; } return !reward && s.latestMilestone === 'streak5' ? pass('Training reaches visual milestones without reward eligibility.') : fail('Training created an economy reward.'); }),
  makeCase('milestone_rewards_idempotent_per_attempt', 'Milestone reward requests are once per attempt', () => { let s = createSoloStreakState(); const requests = []; for (let i = 0; i < 5; i += 1) { const r = clean(s); s = r.state; if (r.rewardRequest) requests.push(r.rewardRequest.milestone); } const duplicate = step(s, { correct: true, levelNumber: 7 }); return requests.join(',') === 'streak4,streak5' && !duplicate.rewardRequest && backendSource.includes('idempotencyKey = `solo_streak_reward:') ? pass('Pure state and backend key both suppress duplicate milestone grants.') : fail('Milestone idempotency drifted.'); }),
  makeCase('reward_does_not_affect_puan_or_leaderboard', 'Rewards mutate Diamonds only', () => backendSource.includes("source: 'solo_streak'") && backendSource.includes('noKronoxPuan: true') && backendSource.includes('noLeaderboardImpact: true') && !rewardSource.includes('kronox_puan_total') ? pass('Reward path is Diamond-only.') : fail('Reward path can affect score/leaderboard.')),
  makeCase('no_daily_goal_cross_contamination', 'Streak does not emit Daily events', () => !rewardSource.includes('recordDailyQuest') && backendSource.includes('noDailyGoalImpact: true') && dailySource.includes('recordDailyQuestSourceEvent') ? pass('Streak rewards stay outside Daily event progression.') : fail('Streak/Daily boundary drifted.')),
  makeCase('effects_cleanup', 'Visual effects clean up', () => hudSource.includes('window.clearTimeout(timer)') && hudSource.includes('onFeedbackDone') && rewardSource.includes('activeAttemptRef') && rewardSource.includes('mountedRef.current = true') && !hudSource.includes('repeat: Infinity') ? pass('Feedback timer is finite and cleaned on change/unmount.') : fail('Streak effect cleanup is missing.')),
  makeCase('analytics_downstream_only', 'Analytics is downstream only', () => rewardSource.includes('try {') && rewardSource.includes('Best-effort analytics is downstream') && !String(applySoloStreakPlacement).includes('analytics') ? pass('Pure transition owns rules; analytics failure is ignored.') : fail('Analytics can control streak rules.')),
];