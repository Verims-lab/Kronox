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
import guestProfileEntitySource from '../../../base44/entities/GuestProfile.jsonc?raw';
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
    nextStep: options.nextStep || 'Keep Daily Wheel V2 server-backed, weighted, one-free-spin-per-server-day, and no-Puan/no-leaderboard.',
    ...options,
    run,
  };
}

export const EXTRA_SUITES = [
  { id: SUITE_ID, name: SUITE_NAME, critical: true, color: '#facc15' },
];

export const EXTRA_TESTS = [
  makeCase('daily_rewards_panel_above_solo_cta',
    'Home exposes compact Görevler/Çark shortcuts above Solo CTA without expanded rewards on first render',
    () => {
      const src = safeStr(mainMenuSource);
      const shortcutIndex = src.indexOf('label="Görevler"');
      const soloIndex = src.indexOf('primaryLabel="OYNA"');
      const missing = missingTokens(`${src}\n${dailyRewardsPanelSource}`, [
        'HomeShortcut',
        'HomeShortcutModal',
        'items-center justify-center',
        "maxHeight: 'calc(100dvh - env(safe-area-inset-top) - env(safe-area-inset-bottom) - 3rem)'",
        "overflowY: 'auto'",
        'label="Görevler"',
        'label="Çark"',
        "'quests'",
        "'wheel'",
        'activeShortcut',
        'completedGuestProfile',
        'guestProfile={guestProfile}',
        'DailyWheelCard',
        'DailyQuestV1Card',
        'Günlük Görev',
        'getLeaderboardDiamondValue(user || completedGuestProfile)',
        'onUserUpdated={handleDailyWheelUserPatch}',
        'primaryLabel="OYNA"',
        '`Seviye ${homeSoloLevelNumber}`',
        'buildSoloGameConfigForLevel',
        'label="ONLINE KAPIŞMA"',
      ]);
      const forbidden = forbiddenTokens(src, [
        '<DailyRewardsPanel',
        'Günlük Ödüller',
        'items-end justify-center',
        'onLogin={handleLogin}',
        'function handleLogin',
        'const handleLogin',
      ]);
      if (missing.length || forbidden.length || shortcutIndex < 0 || soloIndex < 0 || shortcutIndex > soloIndex) {
        return fail('Home does not place compact reward shortcuts before the Solo CTA while avoiding expanded reward panels and login prompts on first render.', {
          verification: 'STATIC_CONTRACT',
          file: 'src/pages/MainMenu.jsx',
          actual: { missing, forbidden, shortcutIndex, soloIndex },
        });
      }
      return pass('Compact Görevler/Çark shortcuts sit above Solo CTA, open existing reward flows in a centered modal, and keep first-render Home free of expanded reward panels.', { verification: 'STATIC_CONTRACT' });
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

  makeCase('daily_wheel_auto_popup_once_per_day_visual_only',
    'Daily Wheel auto-popup is once per player/day and visual-only',
    () => {
      const missing = missingTokens(`${dailyWheelHookSource}\n${mainMenuSource}`, [
        'kronox_daily_wheel_auto_popup_seen',
        'localStorage',
        'autoPopupStorageKey',
        'showPrompt',
        'dismissPrompt',
        'shouldAutoOpen',
        'markAutoPopupShown',
        "setActiveShortcut('wheel')",
        'Auto-popup state is visual only; reward source of truth stays server-side.',
      ]);
      const forbidden = forbiddenTokens(dailyWheelHookSource, [
        'diamonds +=',
      ]);
      if (missing.length || forbidden.length) {
        return fail('Daily Wheel auto-popup state can affect reward source-of-truth or lacks day-key suppression.', {
          verification: 'STATIC_CONTRACT',
          files: ['src/hooks/useDailyWheel.js', 'src/pages/MainMenu.jsx'],
          actual: { missing, forbidden },
        });
      }
      return pass('Auto-popup dismissal uses a per-player/day localStorage key and never grants rewards.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('daily_wheel_claim_requires_auth_and_server_reward',
    'Daily Wheel claim requires trusted player proof and selects rewards server-side',
    () => {
      const missing = missingTokens(DAILY_WHEEL_BACKEND_HEALTH_SOURCE, [
        'claimDailyWheelReward',
        'base44.auth.me()',
        'resolveDailyWheelPlayer',
        'isGuestProfileComplete',
        'unauthenticated',
        'REWARD_TABLE',
        'DailyWheelSpin.create',
        'DiamondTransaction.create',
      ]);
      if (missing.length) {
        return fail('Daily Wheel backend player-proof/server reward contract is incomplete.', {
          verification: 'STATIC_CONTRACT',
          file: 'base44/functions/claimDailyWheelReward/entry.ts',
          missing,
        });
      }
      return pass('Claim requires authenticated user context or completed guest token proof, and reward selection is server-side.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('completed_guest_daily_wheel_player_contract',
    'Completed guest profiles can use Daily Wheel with persisted GuestProfile Diamonds',
    () => {
      const combined = `${mainMenuSource}\n${dailyWheelHookSource}\n${dailyRewardsPanelSource}\n${guestProfileEntitySource}\n${DAILY_WHEEL_BACKEND_HEALTH_SOURCE}\n${economyRulesSource}`;
      const missing = missingTokens(combined, [
        'getCompletedGuestCredentialsPayload',
        'guestProfile',
        'dailyWheelPayload',
        'completedGuestProfile',
        'rewardsPlayer',
        'GuestProfile.diamonds',
        'daily_wheel_last_spin_date',
        'daily_wheel_next_available_at',
        'playerType',
        'guestProfileReward',
        'rawGuestTokenServerStored: false',
      ]);
      if (missing.length) {
        return fail('Completed guests can lose Daily Wheel access, balance persistence, or guest reward proof.', {
          verification: 'STATIC_CONTRACT',
          files: [
            'src/pages/MainMenu.jsx',
            'src/hooks/useDailyWheel.js',
            'base44/functions/getDailyWheelStatus/entry.ts',
            'base44/functions/claimDailyWheelReward/entry.ts',
            'base44/entities/GuestProfile.jsonc',
          ],
          missing,
        });
      }
      return pass('Completed guest Daily Wheel path sends guest token proof, persists rewards on GuestProfile.diamonds, and carries guest-safe metadata.', {
        verification: 'STATIC_CONTRACT',
      });
    }),

  makeCase('daily_wheel_reward_table_weighted_server_side',
    'Daily Wheel V2 uses the weighted 8-slice backend reward table',
    () => {
      const missing = missingTokens(DAILY_WHEEL_BACKEND_HEALTH_SOURCE, [
        'REWARD_TABLE',
        'DAILY_WHEEL_REWARD_TABLE_VERSION = \'daily_wheel_v2\'',
        'DAILY_WHEEL_VISUAL_SEGMENT_COUNT = 8',
        'diamond_20 weight: 28',
        'diamond_60 weight: 20',
        'diamond_100 weight: 15',
        'joker_krono_kalkan weight: 12',
        'joker_zamani_dondur weight: 10',
        'joker_kart_degistir weight: 8',
        'gift_box weight: 5',
        'diamond_250 weight: 2',
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
      return pass('Daily Wheel V2 reward weights are documented in the backend mirror and selected server-side.', {
        verification: 'STATIC_CONTRACT',
        actual: { rewards: ['diamond_20', 'diamond_60', 'diamond_100', 'joker_krono_kalkan', 'joker_zamani_dondur', 'joker_kart_degistir', 'gift_box', 'diamond_250'], weights: [28, 20, 15, 12, 10, 8, 5, 2] },
      });
    }),

  makeCase('daily_rewards_panel_quest_v1_no_client_grant',
    'Daily Quest Runtime v1 is visible and claims through backend only',
    () => {
      const combined = `${dailyRewardsPanelSource}\n${economyRulesSource}\n${economyGatewaySource}`;
      const missing = missingTokens(combined, [
        'DailyQuestV1Card',
        'Günlük Görev',
        'claimDailyQuestReward',
        'daily_quest_reward',
        'User.daily_quest_*',
        'does not grant Kronox Puan',
        'no leaderboard impact',
      ]);
      const forbidden = forbiddenTokens(dailyRewardsPanelSource, [
        'DiamondTransaction',
        'diamonds:',
        'kronox_puan_total',
      ]);
      if (missing.length || forbidden.length) {
        return fail('Daily Quest Runtime v1 can grant rewards client-side or lacks separate backend claim contract.', {
          verification: 'STATIC_CONTRACT',
          actual: { missing, forbidden },
        });
      }
      return pass('Daily Quest Runtime v1 is panel-visible and Diamond claims are backend-owned, not client-mutated.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('daily_wheel_v2_no_puan_no_leaderboard',
    'Daily Wheel V2 rewards never grant Kronox Puan or leaderboard impact',
    () => {
      const combined = `${DAILY_WHEEL_BACKEND_HEALTH_SOURCE}\n${economyRulesSource}\n${diamondEconomySource}`;
      const missing = missingTokens(combined, [
        "DAILY_WHEEL: 'daily_wheel'",
        'noKronoxPuan: true',
        'Daily Wheel never grants Kronox Puan',
        'does not affect leaderboard sorting or rank',
      ]);
      const forbidden = forbiddenTokens(DAILY_WHEEL_BACKEND_HEALTH_SOURCE, [
        'kronox_puan_total',
        'total_kronox_score',
        'online_progress',
        'solo_progress',
      ]);
      if (missing.length || forbidden.length) {
        return fail('Daily Wheel can affect scoring/leaderboard or lacks no-Puan/no-leaderboard contract.', {
          verification: 'STATIC_CONTRACT',
          actual: { missing, forbidden },
        });
      }
      return pass('Daily Wheel V2 can grant rewards but has no Puan/leaderboard writes.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('daily_wheel_v2_joker_and_giftbox_contract',
    'Daily Wheel V2 can grant approved jokers and Gift Box without market purchase leakage',
    () => {
      const combined = `${DAILY_WHEEL_BACKEND_HEALTH_SOURCE}\n${economyRulesSource}`;
      const missing = missingTokens(combined, [
        'Daily Wheel V2 can grant Diamonds, approved Solo jokers, or Gift Box rewards',
        'GIFT_BOX_REWARD_TABLE',
        'grantDailyWheelJokers',
        'JokerTransaction.create',
        'UserJokerInventory',
        'giftBoxResolvedServerSide',
        'noFakeAdRewardFlow',
        'Mağaza purchase is a Diamond sink',
      ]);
      const forbidden = forbiddenTokens(DAILY_WHEEL_BACKEND_HEALTH_SOURCE, [
        'market_purchase',
        'purchaseJokerWithDiamonds',
      ]);
      if (missing.length || forbidden.length) {
        return fail('Daily Wheel V2 joker/gift-box rewards can drift into Market purchase sources or lose server ownership.', {
          verification: 'STATIC_CONTRACT',
          actual: { missing, forbidden },
        });
      }
      return pass('Daily Wheel V2 grants approved reward lanes directly while Mağaza remains the separate Diamond sink for purchases.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('daily_wheel_one_spin_per_server_day',
    'Daily Wheel has one-spin-per-player-UTC-server-day idempotency contract',
    () => {
      const combined = `${DAILY_WHEEL_BACKEND_HEALTH_SOURCE}\n${economyGatewaySource}\n${economyRulesSource}`;
      const missing = missingTokens(combined, [
        'daily_wheel:<playerKey>:<YYYY-MM-DD>',
        'guest:<g_owner_key>',
        'daily_wheel_last_spin_date',
        'DailyWheelSpin.idempotency_key',
        'one claim per player per UTC server day',
        'logical guard; unique constraint platform/manual',
        'postCreateCanonicalSpin',
        'postReserveSpin',
        'postReservePlayer',
        'postReserveTransaction',
        'Base44 schema-level uniqueness is not assumed',
        'function-level guard only = Medium / P1 hardening',
        'recoveredExistingDailyWheelSpin',
      ]);
      if (missing.length) {
        return fail('Daily Wheel server-day idempotency contract is incomplete.', {
          verification: 'STATIC_CONTRACT',
          missing,
        });
      }
      return pass('Daily Wheel is keyed by player + UTC day with reserve/canonical, User/GuestProfile, and ledger guards.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('completed_guest_daily_wheel_same_day_guard',
    'Completed guest Daily Wheel has same-day duplicate guard parity',
    () => {
      const missing = missingTokens(DAILY_WHEEL_BACKEND_HEALTH_SOURCE, [
        'resolveDailyWheelPlayer',
        'guestPlayerKey',
        'updateDailyWheelPlayer',
        'buildIdempotencyKey',
        'findSpin',
        'postReserveSpin',
        'daily_wheel_last_spin_date',
        'DiamondTransaction.create',
        'DailyWheelSpin.create',
        'guestProfileReward',
      ]);
      if (missing.length) {
        return fail('Completed guest Daily Wheel duplicate prevention does not match the registered-player guard shape.', {
          verification: 'STATIC_CONTRACT',
          file: 'base44/functions/claimDailyWheelReward/entry.ts',
          missing,
        });
      }
      return pass('Completed guest Daily Wheel claims use the same player-key idempotency, spin, profile guard, and ledger re-checks as registered users.', {
        verification: 'STATIC_CONTRACT',
      });
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
        'summarizeDailyWheelReward',
        'resultSummary.title',
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
        'WHEEL_REWARD_SLICES = DAILY_WHEEL_REWARD_SEGMENTS',
        'DAILY_WHEEL_VISUAL_SEGMENT_COUNT',
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
        'useReducedMotion',
        'disableClose={claiming || (hasReward && !revealReady)}',
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

  makeCase('daily_wheel_single_coherent_spin_motion',
    'Daily Wheel spin uses one coherent loop→landing motion with no keyframe speed phases or overshoot',
    () => {
      const missing = missingTokens(dailyWheelCardSource, [
        "phase === 'loop'",
        "phase === 'landing'",
        'WHEEL_LANDING_EASE',
        'WHEEL_PRESPIN_ROTATION_SECONDS',
        'rotate: targetRotation',
        // Spin starts immediately on tap — no separate "prepare" wait.
        'wheel.openResult();\n      wheel.claim();',
      ]);
      const forbidden = forbiddenTokens(dailyWheelCardSource, [
        // Old multi-phase keyframe array + overshoot/bounce-back must be gone.
        'targetRotation * 0.72',
        'targetRotation - 8',
        'targetRotation + 2',
        'Ödül hazırlanıyor',
      ]);
      if (missing.length || forbidden.length) {
        return fail('Daily Wheel spin can still show multi-phase speed jumps, overshoot, or a separate prepare wait.', {
          verification: 'STATIC_CONTRACT',
          file: 'src/components/dailyWheel/DailyWheelCard.jsx',
          actual: { missing, forbidden },
        });
      }
      return pass('Daily Wheel starts spinning on tap and runs one loop→single-decel landing with no overshoot or prepare wait.', {
        verification: 'STATIC_CONTRACT',
      });
    }),

  makeCase('daily_wheel_result_uses_backend_reward_amount',
    'Daily Wheel spin lands on and reveals the backend reward segment',
    () => {
      const missing = missingTokens(dailyWheelCardSource, [
        'getWheelTargetRotation(result?.rewardSegmentIndex, prefersReducedMotion)',
        'highlightAmount={revealReady ? result.rewardId : null}',
        'result.totalRewardAmount',
        'result.rewardId',
        'result.rewardSegmentIndex',
        '7 günlük seri bonusu: +150 elmas',
      ]);
      if (missing.length) {
        return fail('Daily Wheel visual result can drift from the backend-selected segment payload.', {
          verification: 'STATIC_CONTRACT',
          file: 'src/components/dailyWheel/DailyWheelCard.jsx',
          missing,
        });
      }
      return pass('Wheel landing target and reveal text are both derived from the claim result segment payload.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('daily_wheel_gift_box_resolves_server_side',
    'Daily Wheel Gift Box contents are server-resolved and idempotent',
    () => {
      const missing = missingTokens(`${DAILY_WHEEL_BACKEND_HEALTH_SOURCE}\n${dailyWheelCardSource}`, [
        'GIFT_BOX_REWARD_TABLE',
        'selectGiftBoxReward',
        'giftBoxResolvedServerSide',
        'gift_box_reward_id',
        'gift_box_reward_summary',
        'GiftBoxRewardSummary',
        'Hediye Kutusu açıldı!',
      ]);
      if (missing.length) {
        return fail('Gift Box reward contents can drift client-side or lose same-day idempotency context.', {
          verification: 'STATIC_CONTRACT',
          files: ['base44/functions/claimDailyWheelReward/entry.ts', 'src/components/dailyWheel/DailyWheelCard.jsx'],
          missing,
        });
      }
      return pass('Gift Box package selection is backend-owned, stored on DailyWheelSpin, and rendered from the server result.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('daily_wheel_ad_repeat_cta_disabled_yakinda',
    'Daily Wheel repeat ad spin CTA is visible but disabled as Yakında',
    () => {
      const missing = missingTokens(`${dailyWheelCardSource}\n${DAILY_WHEEL_BACKEND_HEALTH_SOURCE}\n${economyRulesSource}`, [
        'DisabledAdSpinCta',
        'Tekrar şansını dene!',
        '📺 Reklam İzle ve Tekrar Çevir',
        'Yakında',
        'noFakeAdRewardFlow',
        'future rewarded-ad integration',
      ]);
      const forbidden = forbiddenTokens(dailyWheelCardSource, [
        'claimAdSpinReward',
        'rewardedAd',
        'showRewardedAd',
        'adSpinReward',
      ]);
      if (missing.length || forbidden.length) {
        return fail('Daily Wheel repeat ad CTA can look active or add a fake ad reward path.', {
          verification: 'STATIC_CONTRACT',
          files: ['src/components/dailyWheel/DailyWheelCard.jsx', 'docs/KRONOX_ECONOMY_RULES.md'],
          actual: { missing, forbidden },
        });
      }
      return pass('Repeat spin ad CTA is disabled, marked Yakında, and has no fake reward flow.', { verification: 'STATIC_CONTRACT' });
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

  makeCase('daily_wheel_claim_failure_reconciles_server_status',
    'Daily Wheel claim failure rechecks server state before showing retry error',
    () => {
      const missing = missingTokens(dailyWheelHookSource, [
        'buildClaimResultFromStatus',
        'const recoveredStatus = await refresh().catch(() => null);',
        'recoveredStatus?.alreadyClaimedToday',
        'recoveredStatus?.available === false',
        'needsBalanceRepair',
        'recoveryFromClaimFailure: true',
        'applyClaimSuccessBody(recoveredClaim)',
        'const recoveredResult = buildClaimResultFromStatus(recoveredStatus);',
        "setStatus('claimed')",
        'setLastResult(recoveredResult)',
        'onUserUpdated(recoveredResult.userPatch)',
        "setError(userSafeDailyWheelError(err, 'Çark çevrilemedi. Lütfen tekrar dene.'))",
      ]);
      if (missing.length) {
        return fail('Daily Wheel can remain stuck in a false spin-failed state instead of reconciling an already-applied server claim.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          files: ['src/hooks/useDailyWheel.js'],
          missing,
        });
      }
      return pass('Claim failures perform a server status refresh and convert an already-claimed day into the claimed/result state before showing retry copy.', {
        verification: 'STATIC_CONTRACT',
      });
    }),

  makeCase('daily_wheel_claim_uses_runtime_safe_entity_handles',
    'Daily Wheel claim binds runtime-safe entity handles for player, spin, and Diamond writes',
    () => {
      const missing = missingTokens(DAILY_WHEEL_BACKEND_HEALTH_SOURCE, [
        'userEntity',
        'dailyWheelSpinEntity',
        'diamondTransactionEntity',
        'authEntity || serviceEntity',
        'player?.isGuest ? serviceEntity : (authEntity || serviceEntity)',
        'daily_wheel_user_update_unavailable',
        'daily_wheel_guest_update_unavailable',
        'DailyWheelSpin.create',
        'DiamondTransaction.create',
      ]);
      if (missing.length) {
        return fail('Daily Wheel claim write path can drift back to brittle service/auth entity access and fail after the spin starts.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          file: 'base44/functions/claimDailyWheelReward/entry.ts',
          missing,
        });
      }
      return pass('Daily Wheel claim uses explicit runtime-safe entity handles for profile update, spin ledger, and Diamond ledger writes.', {
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
        'setLocalUser((current)',
        'setLocalGuestProfile((current)',
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
      return pass('Successful wheel claim patches Home user or completed-guest diamonds immediately.', { verification: 'STATIC_CONTRACT' });
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
    () => notAutomatable('Static Health verifies idempotency keys and function-level guards, but Base44 schema uniqueness/transaction behavior under two simultaneous devices requires a live backend probe.', {
      verification: 'NOT_AUTOMATABLE',
      classification: 'BACKEND_RACE_PROOF_REQUIRED',
      actionType: ACTION_TYPES.BACKEND_RUNTIME_PROBE,
      expected: 'Two simultaneous Daily Wheel claims for the same user/day grant Diamonds at most once; any duplicate rows are documented as a platform uniqueness gap.',
      actual: 'No two-device/backend race harness or DB/entity unique proof in Health Center.',
    }),
    { actionType: ACTION_TYPES.BACKEND_RUNTIME_PROBE, critical: false }),
];
