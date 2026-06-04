// Kronox Health Center — Daily Reward Wheel contracts.
//
// Static coverage for the server-backed Home Daily Wheel. Live duplicate
// prevention under two devices remains NOT_AUTOMATABLE until Base44 unique
// idempotency keys or a real backend race probe are verified.

import mainMenuSource from '../../pages/MainMenu.jsx?raw';
import dailyWheelCardSource from '../dailyWheel/DailyWheelCard.jsx?raw';
import dailyWheelHookSource from '../../hooks/useDailyWheel.js?raw';
import economyGatewaySource from '../../lib/dbGateway/economyGateway.js?raw';
import diamondEconomySource from '../../lib/diamondEconomy.js?raw';
import economyRulesSource from '../../../docs/KRONOX_ECONOMY_RULES.md?raw';
import releaseChecklistSource from '../../../docs/KRONOX_RELEASE_PROOF_CHECKLIST.md?raw';
import { DAILY_WHEEL_BACKEND_HEALTH_SOURCE } from '@/lib/dailyWheelHealthMirror';

const STATUS = {
  PASS: 'PASS',
  FAIL: 'FAIL',
  NOT_AUTOMATABLE: 'NOT_AUTOMATABLE',
};

const ACTION_TYPES = {
  CODE_FIX: 'CODE_FIX',
  BACKEND_RUNTIME_PROBE: 'BACKEND_RUNTIME_PROBE',
};

const SUITE_ID = 'daily_wheel_health';
const SUITE_NAME = 'Daily Reward Wheel Health Suite';

function safeStr(source) {
  if (source == null) return '';
  if (typeof source === 'string') return source;
  try { return String(source); } catch { return ''; }
}

function missingTokens(source, tokens) {
  const value = safeStr(source);
  return tokens.filter((token) => !value.includes(token));
}

function forbiddenTokens(source, tokens) {
  const value = safeStr(source);
  return tokens.filter((token) => value.includes(token));
}

function pass(reason, extra = {}) { return { status: STATUS.PASS, reason, ...extra }; }
function fail(reason, extra = {}) { return { status: STATUS.FAIL, reason, ...extra }; }
function notAutomatable(reason, extra = {}) { return { status: STATUS.NOT_AUTOMATABLE, reason, ...extra }; }

function makeCase(id, name, run, options = {}) {
  return {
    key: `${SUITE_ID}.${id}`,
    suiteId: SUITE_ID,
    suiteName: SUITE_NAME,
    id,
    name,
    critical: options.critical ?? true,
    actionType: options.actionType || ACTION_TYPES.CODE_FIX,
    nextStep: options.nextStep || 'Keep Daily Wheel server-backed, Diamond-only, and one-spin-per-server-day.',
    ...options,
    run,
  };
}

export const EXTRA_SUITES = [
  { id: SUITE_ID, name: SUITE_NAME, critical: true, color: '#facc15' },
];

export const EXTRA_TESTS = [
  makeCase('daily_wheel_home_card_above_solo_cta',
    'Daily Wheel card exists on Home above Solo CTA',
    () => {
      const src = safeStr(mainMenuSource);
      const dailyWheelIndex = src.indexOf('<DailyWheelCard');
      const soloIndex = src.indexOf('label="SOLO MEYDAN OKUMA"');
      const missing = missingTokens(src, [
        'DailyWheelCard',
        'onUserUpdated={handleDailyWheelUserPatch}',
        'onLogin={handleLogin}',
        'label="SOLO MEYDAN OKUMA"',
        'label="ONLINE KAPIŞMA"',
      ]);
      if (missing.length || dailyWheelIndex < 0 || soloIndex < 0 || dailyWheelIndex > soloIndex) {
        return fail('Home does not place DailyWheelCard directly before the Solo CTA while preserving Solo/Online buttons.', {
          verification: 'STATIC_CONTRACT',
          file: 'src/pages/MainMenu.jsx',
          actual: { missing, dailyWheelIndex, soloIndex },
        });
      }
      return pass('DailyWheelCard is wired above Solo CTA and Solo/Online CTAs remain present.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('daily_wheel_card_states_exist',
    'Daily Wheel card has loading, available, claimed, error, and sign-in states',
    () => {
      const missing = missingTokens(dailyWheelCardSource, [
        'Günlük Çark',
        'Hazır!',
        'Yarın hazır',
        'Giriş gerekli',
        'Tekrar dene',
        'Kontrol ediliyor',
        'Bugünkü ödülünü aldın.',
        'Yeni çark yarın hazır olacak.',
      ]);
      if (missing.length) {
        return fail('DailyWheelCard state/copy contract is incomplete.', {
          verification: 'STATIC_CONTRACT',
          file: 'src/components/dailyWheel/DailyWheelCard.jsx',
          missing,
        });
      }
      return pass('DailyWheelCard exposes every required user-facing state.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('daily_wheel_prompt_once_per_session_visual_only',
    'Daily Wheel availability prompt is once-per-session and visual-only',
    () => {
      const missing = missingTokens(dailyWheelHookSource, [
        'kronox_daily_wheel_prompt_seen',
        'sessionStorage',
        'showPrompt',
        'dismissPrompt',
        'reward source of truth stays server-side',
      ]);
      const forbidden = forbiddenTokens(dailyWheelHookSource, [
        'localStorage.setItem',
        'diamonds +=',
      ]);
      if (missing.length || forbidden.length) {
        return fail('Daily Wheel prompt state can affect reward source-of-truth or lacks session-only suppression.', {
          verification: 'STATIC_CONTRACT',
          file: 'src/hooks/useDailyWheel.js',
          actual: { missing, forbidden },
        });
      }
      return pass('Prompt dismissal uses sessionStorage only and never grants rewards.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('daily_wheel_claim_requires_auth_and_server_reward',
    'Daily Wheel claim requires auth and selects rewards server-side',
    () => {
      const missing = missingTokens(DAILY_WHEEL_BACKEND_HEALTH_SOURCE, [
        'claimDailyWheelReward',
        'base44.auth.me()',
        'unauthenticated',
        'REWARD_TABLE',
        'DailyWheelSpin.create',
        'DiamondTransaction.create',
      ]);
      if (missing.length) {
        return fail('Daily Wheel backend auth/server reward contract is incomplete.', {
          verification: 'STATIC_CONTRACT',
          file: 'base44/functions/claimDailyWheelReward/entry.ts',
          missing,
        });
      }
      return pass('Claim requires authenticated backend context and reward selection is server-side.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('daily_wheel_diamonds_only_no_puan',
    'Daily Wheel grants Diamonds only and never Kronox Puan',
    () => {
      const combined = `${DAILY_WHEEL_BACKEND_HEALTH_SOURCE}\n${economyRulesSource}\n${diamondEconomySource}`;
      const missing = missingTokens(combined, [
        "DAILY_WHEEL: 'daily_wheel'",
        'noKronoxPuan: true',
        'grants no Kronox Puan',
        'does not affect leaderboard sorting or rank',
      ]);
      const forbidden = forbiddenTokens(DAILY_WHEEL_BACKEND_HEALTH_SOURCE, [
        'kronox_puan_total',
        'total_kronox_score',
        'online_progress',
        'solo_progress',
      ]);
      if (missing.length || forbidden.length) {
        return fail('Daily Wheel can affect scoring/leaderboard or lacks Diamond-only contract.', {
          verification: 'STATIC_CONTRACT',
          actual: { missing, forbidden },
        });
      }
      return pass('Daily Wheel source is Diamond-only and has no Puan/leaderboard writes.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('daily_wheel_one_spin_per_server_day',
    'Daily Wheel has one-spin-per-UTC-server-day idempotency contract',
    () => {
      const combined = `${DAILY_WHEEL_BACKEND_HEALTH_SOURCE}\n${economyGatewaySource}\n${economyRulesSource}`;
      const missing = missingTokens(combined, [
        'daily_wheel:<normalizedEmail>:<YYYY-MM-DD>',
        'daily_wheel_last_spin_date',
        'DailyWheelSpin.idempotency_key',
        'one claim per user per UTC server day',
        'logical guard; unique constraint platform/manual',
      ]);
      if (missing.length) {
        return fail('Daily Wheel server-day idempotency contract is incomplete.', {
          verification: 'STATIC_CONTRACT',
          missing,
        });
      }
      return pass('Daily Wheel is keyed by authenticated user + UTC day with User and ledger guards.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('daily_wheel_daily_login_separate',
    'Daily Wheel remains separate from daily login reward',
    () => {
      const missing = missingTokens(`${economyRulesSource}\n${releaseChecklistSource}`, [
        'separate from the existing +20 daily login reward',
        'Daily Wheel is separate from the existing +20 daily login reward',
        'First authenticated entry grants +100 once.',
        'Same-day daily login grants +20 once.',
      ]);
      if (missing.length) {
        return fail('Daily Wheel is not clearly separated from starter/daily login rewards.', {
          verification: 'STATIC_CONTRACT',
          files: ['docs/KRONOX_ECONOMY_RULES.md', 'docs/KRONOX_RELEASE_PROOF_CHECKLIST.md'],
          missing,
        });
      }
      return pass('Daily Wheel does not replace or merge starter/daily login rewards.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('daily_wheel_streak_bonus_contract',
    'Daily Wheel 7-day streak bonus contract exists',
    () => {
      const combined = `${DAILY_WHEEL_BACKEND_HEALTH_SOURCE}\n${dailyWheelCardSource}\n${economyRulesSource}`;
      const missing = missingTokens(combined, [
        'STREAK_BONUS_AMOUNT = 100',
        'streakAfter % 7 === 0',
        '7 günlük seri bonusu: +100 elmas',
        '7-day streak bonus: +100 diamonds',
      ]);
      if (missing.length) {
        return fail('Daily Wheel 7-day streak bonus contract is incomplete.', {
          verification: 'STATIC_CONTRACT',
          missing,
        });
      }
      return pass('Daily Wheel grants/document a +100 Diamond bonus on every 7th consecutive daily spin.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('daily_wheel_claimed_passive_countdown',
    'Claimed Daily Wheel state is passive and shows next availability',
    () => {
      const missing = missingTokens(dailyWheelCardSource, [
        'formatCountdown',
        'claimedLabel',
        'Yarın hazır',
        'DailyWheelStatusModal',
        'Bugünkü ödülünü aldın.',
      ]);
      if (missing.length) {
        return fail('Claimed Daily Wheel card can look actionable or lacks countdown/status modal.', {
          verification: 'STATIC_CONTRACT',
          file: 'src/components/dailyWheel/DailyWheelCard.jsx',
          missing,
        });
      }
      return pass('Claimed Daily Wheel remains visible but passive with tomorrow/countdown status.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('daily_wheel_home_diamond_updates_immediately',
    'Home diamond count updates after successful wheel claim',
    () => {
      const missing = missingTokens(`${mainMenuSource}\n${dailyWheelHookSource}`, [
        'handleDailyWheelUserPatch',
        'setUser((current)',
        'onUserUpdated(body.userPatch)',
        'updatedDiamondTotal',
      ]);
      if (missing.length) {
        return fail('Home diamond count cannot update immediately from Daily Wheel claim result.', {
          verification: 'STATIC_CONTRACT',
          files: ['src/pages/MainMenu.jsx', 'src/hooks/useDailyWheel.js'],
          missing,
        });
      }
      return pass('Successful wheel claim patches Home user.diamonds immediately.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('daily_wheel_admin_delete_cleanup_contract',
    'Admin reset and account deletion include Daily Wheel state/rows',
    () => {
      const combined = `${economyRulesSource}\n${releaseChecklistSource}`;
      const missing = missingTokens(combined, [
        'sets `daily_wheel_last_spin_date` to the current UTC day',
        'clears Daily Wheel guard fields',
        'removes target `DailyWheelSpin` rows',
        'Retained OnlineMatchResult/DiamondTransaction/DailyWheelSpin rows no longer contain the deleted user',
      ]);
      if (missing.length) {
        return fail('Daily Wheel reset/deletion cleanup contract is missing from docs.', {
          verification: 'STATIC_CONTRACT',
          files: ['docs/KRONOX_ECONOMY_RULES.md', 'docs/KRONOX_RELEASE_PROOF_CHECKLIST.md'],
          missing,
        });
      }
      return pass('Daily Wheel reset and account-deletion cleanup are documented.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('daily_wheel_duplicate_race_runtime_probe_required',
    'Daily Wheel duplicate prevention still needs live race proof',
    () => notAutomatable('Static Health verifies idempotency keys and guards, but Base44 uniqueness/transaction behavior under two simultaneous devices requires a live backend probe.', {
      verification: 'NOT_AUTOMATABLE',
      classification: 'BACKEND_RACE_PROOF_REQUIRED',
      actionType: ACTION_TYPES.BACKEND_RUNTIME_PROBE,
      expected: 'Two simultaneous Daily Wheel claims for the same user/day grant Diamonds at most once.',
      actual: 'No two-device/backend race harness in Health Center.',
    }),
    { actionType: ACTION_TYPES.BACKEND_RUNTIME_PROBE, critical: false }),
];
