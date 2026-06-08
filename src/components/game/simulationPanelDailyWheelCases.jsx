// Kronox Health Center — Daily Reward Wheel contracts.
//
// Static coverage for the server-backed Home Daily Wheel. Live duplicate
// prevention under two devices remains NOT_AUTOMATABLE until Base44 unique
// idempotency keys or a real backend race probe are verified.

import mainMenuSource from '../../pages/MainMenu.jsx?raw';
import dailyWheelCardSource from '../dailyWheel/DailyWheelCard.jsx?raw';
import dailyRewardsPanelSource from '../dailyWheel/DailyRewardsPanel.jsx?raw';
import dailyWheelHookSource from '../../hooks/useDailyWheel.js?raw';
import economyGatewaySource from '../../lib/dbGateway/economyGateway.js?raw';
import diamondEconomySource from '../../lib/diamondEconomy.js?raw';
import gameSoundsSource from '../../lib/gameSounds.js?raw';
import { ECONOMY_RULES_DOC as economyRulesSource } from '@/lib/economyRulesDoc';
import { RELEASE_PROOF_CHECKLIST_DOC as releaseChecklistSource } from '@/lib/package2DocMirrors';
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
  makeCase('daily_rewards_panel_above_solo_cta',
    'Günlük Ödüller panel exists on Home above Solo CTA',
    () => {
      const src = safeStr(mainMenuSource);
      const panelIndex = src.indexOf('<DailyRewardsPanel');
      const soloIndex = src.indexOf('label="SOLO MEYDAN OKUMA"');
      const missing = missingTokens(`${src}\n${dailyRewardsPanelSource}`, [
        'DailyRewardsPanel',
        'Günlük Ödüller',
        'DailyWheelCard',
        'DailyQuestV1Card',
        'Günlük Görev',
        'onUserUpdated={handleDailyWheelUserPatch}',
        'onLogin={handleLogin}',
        "paddingBottom: 'clamp(1.35rem, 5.8vh, 3.2rem)'",
        'label="SOLO MEYDAN OKUMA"',
        'label="ONLINE KAPIŞMA"',
      ]);
      if (missing.length || panelIndex < 0 || soloIndex < 0 || panelIndex > soloIndex) {
        return fail('Home does not place Günlük Ödüller before the Solo CTA while preserving Solo/Online buttons.', {
          verification: 'STATIC_CONTRACT',
          file: 'src/pages/MainMenu.jsx',
          actual: { missing, panelIndex, soloIndex },
        });
      }
      return pass('Günlük Ödüller is wired above Solo CTA and Solo/Online CTAs remain present.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('daily_wheel_icon_polished_not_asset_dependent',
    'Daily Wheel icon is a compact premium gold/navy wheel without a new asset pipeline',
    () => {
      const missing = missingTokens(dailyWheelCardSource, [
        'WheelEmblem',
        'clamp(58px, 15.8vw, 70px)',
        '#ffe77a',
        '#0b1736',
        'width: \'24%\'',
        'borderTop: \'14px solid #f8fafc\'',
      ]);
      if (missing.length) {
        return fail('Daily Wheel icon lost its premium compact gold/navy wheel treatment.', {
          verification: 'STATIC_CONTRACT',
          file: 'src/components/dailyWheel/DailyWheelCard.jsx',
          missing,
        });
      }
      return pass('Daily Wheel icon is lightweight CSS/SVG-style composition with gold rim, navy center, hub, and pointer.', {
        verification: 'STATIC_CONTRACT',
      });
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

  makeCase('daily_wheel_reward_table_weighted_server_side',
    'Daily Wheel v1 uses the weighted 8-slice backend reward table',
    () => {
      const missing = missingTokens(DAILY_WHEEL_BACKEND_HEALTH_SOURCE, [
        'REWARD_TABLE',
        '30 high weight 24',
        '40 high weight 22',
        '50 high weight 20',
        '60 medium weight 12',
        '75 medium weight 10',
        '100 low weight 7',
        '150 rare weight 4',
        '250 very_rare weight 1',
        'selectReward',
        'randomUnit',
      ]);
      if (missing.length) {
        return fail('Daily Wheel weighted reward table is missing or not server-owned.', {
          verification: 'STATIC_CONTRACT',
          file: 'base44/functions/claimDailyWheelReward/entry.ts',
          missing,
        });
      }
      return pass('Daily Wheel v1 reward weights are documented in the backend mirror and selected server-side.', {
        verification: 'STATIC_CONTRACT',
        actual: { rewards: [30, 40, 50, 60, 75, 100, 150, 250], weights: [24, 22, 20, 12, 10, 7, 4, 1] },
      });
    }),

  makeCase('daily_rewards_panel_quest_v1_no_client_grant',
    'Daily Quest v1 is visible but does not grant rewards client-side',
    () => {
      const combined = `${dailyRewardsPanelSource}\n${economyRulesSource}\n${economyGatewaySource}`;
      const missing = missingTokens(combined, [
        'DailyQuestV1Card',
        'Günlük Görev',
        'daily_quest:<normalizedEmail>:<YYYY-MM-DD>',
        'User.daily_quest_*',
        'does not grant Diamonds or Kronox Puan yet',
      ]);
      const forbidden = forbiddenTokens(dailyRewardsPanelSource, [
        'base44.functions.invoke',
        'DiamondTransaction',
        'diamonds:',
        'kronox_puan_total',
      ]);
      if (missing.length || forbidden.length) {
        return fail('Daily Quest v1 can grant rewards client-side or lacks separate future backend contract.', {
          verification: 'STATIC_CONTRACT',
          actual: { missing, forbidden },
        });
      }
      return pass('Daily Quest v1 is panel-visible, reward-inactive, and reserved for a separate server-backed quest lane.', { verification: 'STATIC_CONTRACT' });
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

  makeCase('daily_wheel_does_not_grant_market_jokers',
    'Daily Wheel remains a Diamond source only after Mağaza launch',
    () => {
      const combined = `${DAILY_WHEEL_BACKEND_HEALTH_SOURCE}\n${economyRulesSource}`;
      const missing = missingTokens(combined, [
        'Daily Wheel remains a Diamond source',
        'Daily Wheel remains Diamond-only',
        'Mağaza purchase is a Diamond sink',
      ]);
      const forbidden = forbiddenTokens(DAILY_WHEEL_BACKEND_HEALTH_SOURCE, [
        'JokerTransaction',
        'UserJokerInventory',
        'mistake_shield',
        'card_swap',
        'time_freeze',
        'market_purchase',
      ]);
      if (missing.length || forbidden.length) {
        return fail('Daily Wheel can drift into joker rewards or Market purchase sources.', {
          verification: 'STATIC_CONTRACT',
          actual: { missing, forbidden },
        });
      }
      return pass('Daily Wheel remains Diamond-only and Mağaza remains the separate Diamond sink for joker purchases.', { verification: 'STATIC_CONTRACT' });
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
        'recoveredExistingDailyWheelSpin',
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
        'STREAK_BONUS_AMOUNT = 150',
        'streakAfter % 7 === 0',
        '7 günlük seri bonusu: +150 elmas',
        '7-day streak bonus: +150 diamonds',
      ]);
      if (missing.length) {
        return fail('Daily Wheel 7-day streak bonus contract is incomplete.', {
          verification: 'STATIC_CONTRACT',
          missing,
        });
      }
      return pass('Daily Wheel grants/document a +150 Diamond bonus on every 7th consecutive daily spin.', { verification: 'STATIC_CONTRACT' });
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

  makeCase('daily_wheel_home_countdown_has_no_diamond_icon',
    'Daily Wheel claimed countdown is text-only without a Diamond icon',
    () => {
      const missing = missingTokens(dailyWheelCardSource, [
        'icon={null} label={claimedLabel',
        'return `${hours} sa ${minutes} dk`',
      ]);
      const forbidden = forbiddenTokens(dailyWheelCardSource, [
        'icon={Gem} label={claimedLabel',
      ]);
      if (missing.length || forbidden.length) {
        return fail('Claimed Daily Wheel countdown can still show a Diamond/Gem icon beside the time.', {
          verification: 'STATIC_CONTRACT',
          file: 'src/components/dailyWheel/DailyWheelCard.jsx',
          actual: { missing, forbidden },
        });
      }
      return pass('Claimed Daily Wheel countdown uses plain text such as Yarın hazır / 11 sa 24 dk.', {
        verification: 'STATIC_CONTRACT',
      });
    }),

  makeCase('daily_wheel_spin_success_opens_result_modal',
    'Daily Wheel successful claim always opens a visible reward result',
    () => {
      const missing = missingTokens(`${dailyWheelHookSource}\n${dailyWheelCardSource}`, [
        'setLastResult(body)',
        'setShowResult(true)',
        '+{formatDiamondCount(result.rewardAmount)} Elmas kazandın',
        'Toplam: +{formatDiamondCount(result.totalRewardAmount)} elmas',
        'Toplam Elmas',
        'updatedDiamondTotal',
      ]);
      if (missing.length) {
        return fail('Daily Wheel claim success can finish without a clear reward modal or updated total.', {
          verification: 'STATIC_CONTRACT',
          files: ['src/hooks/useDailyWheel.js', 'src/components/dailyWheel/DailyWheelCard.jsx'],
          missing,
        });
      }
      return pass('Successful Daily Wheel claim stores the result, opens the modal, shows reward text, and displays updated Elmas total.', {
        verification: 'STATIC_CONTRACT',
      });
    }),

  makeCase('daily_wheel_modal_shows_visible_reward_wheel',
    'Daily Wheel modal shows a visible wheel with reward slices and fixed pointer',
    () => {
      const missing = missingTokens(dailyWheelCardSource, [
        'RewardWheel',
        'WHEEL_REWARD_SLICES = [30, 40, 50, 60, 75, 100, 150, 250]',
        'WHEEL_SLICE_COLORS',
        'conic-gradient',
        'Günlük Çark ödül seçenekleri',
        'borderTop: \'34px solid #fde68a\'',
        'rimLights',
        'center hub',
      ]);
      if (missing.length) {
        return fail('Daily Wheel modal no longer proves a visible sliced wheel with a fixed pointer.', {
          verification: 'STATIC_CONTRACT',
          file: 'src/components/dailyWheel/DailyWheelCard.jsx',
          missing,
        });
      }
      return pass('Daily Wheel modal has a sliced reward wheel, fixed pointer, and center hub.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('daily_wheel_spin_duration_and_button_lock',
    'Daily Wheel spin duration is at least 4 seconds and button/close controls lock during spin',
    () => {
      const missing = missingTokens(dailyWheelCardSource, [
        'WHEEL_SPIN_DURATION_MS = 4600',
        'WHEEL_REDUCED_MOTION_DURATION_MS = 900',
        'WHEEL_SPIN_DURATION_SECONDS',
        'WHEEL_SPIN_KEYFRAME_TIMES',
        'useReducedMotion',
        'disableClose={hasReward && !revealReady}',
        '<ModalButton disabled>Çevriliyor...</ModalButton>',
        'setRevealReady(true)',
      ]);
      if (missing.length) {
        return fail('Daily Wheel spin can reveal too early or remain closable/clickable during the landing spin.', {
          verification: 'STATIC_CONTRACT',
          file: 'src/components/dailyWheel/DailyWheelCard.jsx',
          missing,
        });
      }
      return pass('Daily Wheel uses a 4.6s landing spin and keeps result/close controls disabled until reveal.', {
        verification: 'STATIC_CONTRACT',
        actual: { spinDurationMs: 4600 },
      });
    }),

  makeCase('daily_wheel_result_uses_backend_reward_amount',
    'Daily Wheel spin lands on and reveals the backend reward amount',
    () => {
      const missing = missingTokens(dailyWheelCardSource, [
        'getWheelTargetRotation(result?.rewardAmount, prefersReducedMotion)',
        'highlightAmount={revealReady ? result.rewardAmount : null}',
        'result.totalRewardAmount',
        'result.rewardAmount',
        '7 günlük seri bonusu: +150 elmas',
      ]);
      if (missing.length) {
        return fail('Daily Wheel visual result can drift from the backend reward payload.', {
          verification: 'STATIC_CONTRACT',
          file: 'src/components/dailyWheel/DailyWheelCard.jsx',
          missing,
        });
      }
      return pass('Wheel landing target and reveal text are both derived from the claim result payload.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('daily_wheel_sound_safe_existing_infrastructure',
    'Daily Wheel sound uses existing safe gameSounds infrastructure',
    () => {
      const missing = missingTokens(`${dailyWheelCardSource}\n${gameSoundsSource}`, [
        'sounds.wheelSpinStart?.()',
        'sounds.wheelTick?.()',
        'sounds.rewardReveal?.()',
        'wheelSpinStart()',
        'wheelTick()',
        'rewardReveal()',
      ]);
      const forbidden = forbiddenTokens(dailyWheelCardSource, [
        'new Audio(',
        '.mp3',
        '.wav',
      ]);
      if (missing.length || forbidden.length) {
        return fail('Daily Wheel sound is not using the existing optional sound infrastructure safely.', {
          verification: 'STATIC_CONTRACT',
          file: 'src/components/dailyWheel/DailyWheelCard.jsx',
          actual: { missing, forbidden },
        });
      }
      return pass('Daily Wheel attempts optional spin/reveal cues through gameSounds and adds no audio asset dependency.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('daily_wheel_already_claimed_does_not_fake_spin',
    'Already-claimed Daily Wheel state does not fake a spin',
    () => {
      const alreadyIndex = safeStr(dailyWheelCardSource).indexOf(') : alreadyClaimed ? (');
      const rewardIndex = safeStr(dailyWheelCardSource).indexOf(') : hasReward ? (');
      const alreadyBlock = safeStr(dailyWheelCardSource).slice(alreadyIndex, safeStr(dailyWheelCardSource).indexOf(') : (', alreadyIndex));
      const fakeSpin = alreadyBlock.includes('RewardWheel') || alreadyBlock.includes('Çark dönüyor');
      if (alreadyIndex < 0 || rewardIndex < 0 || alreadyIndex <= rewardIndex || fakeSpin) {
        return fail('Already-claimed branch can show fake spin UI instead of direct status copy.', {
          verification: 'STATIC_CONTRACT',
          file: 'src/components/dailyWheel/DailyWheelCard.jsx',
          actual: { alreadyIndex, rewardIndex, fakeSpin },
        });
      }
      return pass('Already-claimed branch bypasses spin UI and shows the claimed/tomorrow status directly.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('daily_wheel_claim_error_visible_recoverable',
    'Daily Wheel claim errors are visible and recoverable',
    () => {
      const missing = missingTokens(`${dailyWheelHookSource}\n${dailyWheelCardSource}`, [
        'setShowPrompt(false)',
        'setShowResult(true)',
        'role="alert"',
        'Çark çevrilemedi. Lütfen tekrar dene.',
        'daily_wheel_request_failed',
        'Tekrar dene',
      ]);
      if (missing.length) {
        return fail('Daily Wheel claim errors can remain hidden or unrecoverable.', {
          verification: 'STATIC_CONTRACT',
          files: ['src/hooks/useDailyWheel.js', 'src/components/dailyWheel/DailyWheelCard.jsx'],
          missing,
        });
      }
      return pass('Claim errors close the prompt path, open the result/error modal, and expose a retry action.', {
        verification: 'STATIC_CONTRACT',
      });
    }),

  makeCase('daily_wheel_pending_blocks_double_tap',
    'Daily Wheel pending state prevents double-tap duplicate claim attempts',
    () => {
      const missing = missingTokens(`${dailyWheelHookSource}\n${dailyWheelCardSource}`, [
        'if (claiming) return null;',
        'if (claimingRef.current) return null;',
        'disabled={wheel.claiming}',
        'disabled={claiming}',
        'aria-busy={wheel.claiming ? \'true\' : \'false\'}',
      ]);
      if (missing.length) {
        return fail('Daily Wheel pending state does not block duplicate taps in hook and UI.', {
          verification: 'STATIC_CONTRACT',
          files: ['src/hooks/useDailyWheel.js', 'src/components/dailyWheel/DailyWheelCard.jsx'],
          missing,
        });
      }
      return pass('Daily Wheel blocks duplicate claim attempts while a claim is pending.', {
        verification: 'STATIC_CONTRACT',
      });
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
