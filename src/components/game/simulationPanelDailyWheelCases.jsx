// Kronox Health Center — Daily Reward Wheel contracts.
//
// Static coverage for the server-backed Home Daily Wheel. Live duplicate
// prevention under two devices remains NOT_AUTOMATABLE until Base44 unique
// idempotency keys or a real backend race probe are verified.

import mainMenuSource from '../../pages/MainMenu.jsx?raw';
import appSource from '../../App.jsx?raw';
import dailyPageSource from '../../pages/DailyPage.jsx?raw';
import bottomNavSource from '../layout/BottomNav.jsx?raw';
import dailyWheelCardSource from '../dailyWheel/DailyWheelCard.jsx?raw';
import dailyRewardsPanelSource from '../dailyWheel/DailyRewardsPanel.jsx?raw';
import dailyWheelHookSource from '../../hooks/useDailyWheel.js?raw';
import dailyWheelRewardsSource from '../../lib/dailyWheelRewards.js?raw';
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
    'Home exposes compact GÜNLÜK/Çark shortcuts above Solo CTA without expanded rewards on first render',
    () => {
      const src = safeStr(mainMenuSource);
      const shortcutIndex = src.indexOf('label="GÜNLÜK"');
      const soloIndex = src.indexOf('primaryLabel="OYNA"');
      const missing = missingTokens(`${src}\n${dailyRewardsPanelSource}\n${appSource}\n${dailyPageSource}\n${bottomNavSource}`, [
        'HomeShortcut',
        'HomeShortcutModal',
        'items-center justify-center',
        "maxHeight: 'calc(100dvh - env(safe-area-inset-top) - env(safe-area-inset-bottom) - 3rem)'",
        "overflowY: 'auto'",
        'CalendarDays',
        'label="GÜNLÜK"',
        "navigate('/daily'",
        'path="/daily"',
        'element={<DailyPage />}',
        'label="Çark"',
        "'wheel'",
        'width: 44',
        'height: 44',
        'activeShortcut',
        'completedGuestProfile',
        'guestProfile={guestProfile}',
        'DailyWheelCard',
        'GÜNLÜK',
        'BUGÜNKÜ GÖREVLER',
        'getLeaderboardDiamondValue(user || completedGuestProfile)',
        'onUserUpdated={handleDailyWheelUserPatch}',
        'primaryLabel="OYNA"',
        '`Seviye ${homeSoloLevelNumber}`',
        'buildSoloGameConfigForLevel',
        'label="ONLINE KAPIŞ"',
        "{ label: 'Ana Sayfa'",
        "{ label: 'Liderlik'",
        "{ label: 'Profil'",
      ]);
      const miniWheelStart = src.indexOf('function HomeMiniDailyWheelIcon');
      const miniWheelEnd = src.indexOf('function HomeTimeArtifact');
      const miniWheelSource = miniWheelStart >= 0 && miniWheelEnd > miniWheelStart
        ? src.slice(miniWheelStart, miniWheelEnd)
        : '';
      const miniWheelMissing = missingTokens(miniWheelSource, [
        'data-kronox-home-mini-wheel-icon',
        'data-kronox-home-mini-wheel-inner-scale="1.3"',
        'const wheelInnerScale = 1.3',
        "transform: `scale(${wheelInnerScale})`",
        '<svg',
        '<clipPath',
        '<path',
        '#FFC928',
        'radialGradient',
      ]);
      const miniWheelForbidden = forbiddenTokens(miniWheelSource, [
        '<text',
        'Gem',
        'diamond',
        'reward',
        '20',
        '60',
        '100',
        '250',
      ]);
      const forbidden = forbiddenTokens(src, [
        '<DailyRewardsPanel',
        'Günlük Ödüller',
        'items-end justify-center',
        'onLogin={handleLogin}',
        'function handleLogin',
        'const handleLogin',
        'icon={TimerReset}',
        'label="Görevler"',
        "'quests'",
        'DailyQuestV1Card',
      ]);
      if (missing.length || miniWheelMissing.length || miniWheelForbidden.length || forbidden.length || shortcutIndex < 0 || soloIndex < 0 || shortcutIndex > soloIndex) {
        return fail('Home does not place compact reward shortcuts before the Solo CTA while avoiding expanded reward panels and login prompts on first render.', {
          verification: 'STATIC_CONTRACT',
          file: 'src/pages/MainMenu.jsx',
          actual: { missing, miniWheelMissing, miniWheelForbidden, forbidden, shortcutIndex, soloIndex },
        });
      }
      return pass('Compact GÜNLÜK/Çark shortcuts sit above Solo CTA, Çark uses a content-free mini wheel icon, and Daily is route-owned instead of BottomNav-owned.', { verification: 'STATIC_CONTRACT' });
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
        'dailyWheelAutoPopupResetAt',
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

  makeCase('daily_calendar_no_client_grant',
    'Daily Calendar streak reward claims through backend only',
    () => {
      const combined = `${dailyPageSource}\n${economyRulesSource}\n${economyGatewaySource}`;
      const missing = missingTokens(combined, [
        'claimDailyQuestReward',
        'daily_calendar_streak_reward',
        '200 Elmas',
        '200 Diamonds',
        'does not grant Kronox Puan',
        'does not affect Leaderboard',
      ]);
      const forbidden = forbiddenTokens(dailyPageSource, [
        'DiamondTransaction',
        'diamonds:',
        'kronox_puan_total',
      ]);
      if (missing.length || forbidden.length) {
        return fail('Daily Calendar streak reward can grant client-side or lacks separate backend claim contract.', {
          verification: 'STATIC_CONTRACT',
          actual: { missing, forbidden },
        });
      }
      return pass('Daily Calendar streak reward claim is backend-owned and the route UI does not mutate Diamonds directly.', { verification: 'STATIC_CONTRACT' });
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
    'Daily Wheel 7-day streak bonus contract exists when runtime implements it',
    () => {
      const combined = `${DAILY_WHEEL_BACKEND_HEALTH_SOURCE}\n${dailyWheelCardSource}\n${economyRulesSource}\n${releaseChecklistSource}`;
      const missing = missingTokens(combined, [
        'STREAK_BONUS_AMOUNT = 150',
        'streakAfter % 7 === 0',
        '7 günlük seri bonusu: +150 elmas',
        '7-day streak bonus: +150 diamonds',
        'Daily Calendar / Streak 200-Diamond streak reward',
      ]);
      if (missing.length) {
        return fail('Daily Wheel runtime has a 7-day streak path but docs/Health do not clearly distinguish it from the Daily Calendar streak reward.', {
          verification: 'STATIC_CONTRACT',
          missing,
        });
      }
      return pass('Daily Wheel keeps its existing +150 7-day spin streak path and docs distinguish it from the Daily Calendar / Streak 200-Diamond streak reward.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('daily_wheel_claimed_card_passive_countdown',
    'Claimed Daily Wheel shortcut card stays passive until explicit result reopen',
    () => {
      const missing = missingTokens(dailyWheelCardSource, [
        'formatCountdown',
        'claimedLabel',
        'Yarın hazır',
        'icon={null} label={claimedLabel',
        'wheel.openClaimedResult();',
      ]);
      const forbidden = forbiddenTokens(dailyWheelCardSource, [
        'DailyWheelStatusModal',
        'statusModalOpen',
        'setStatusModalOpen',
      ]);
      const claimedClickIndex = safeStr(dailyWheelCardSource).indexOf("if (wheel.status === 'claimed')");
      const claimedClickBlock = claimedClickIndex >= 0
        ? safeStr(dailyWheelCardSource).slice(claimedClickIndex, safeStr(dailyWheelCardSource).indexOf("if (wheel.status === 'error')", claimedClickIndex))
        : '';
      const startsNewSpin = claimedClickBlock.includes('wheel.claim()') || claimedClickBlock.includes('claimDailyWheelReward');
      if (missing.length || forbidden.length || startsNewSpin) {
        return fail('Claimed Daily Wheel card can reopen the removed cooldown modal or start a duplicate spin instead of the stored result.', {
          verification: 'STATIC_CONTRACT',
          file: 'src/components/dailyWheel/DailyWheelCard.jsx',
          actual: { missing, forbidden, startsNewSpin },
        });
      }
      return pass('Claimed Daily Wheel card keeps the plain countdown badge and explicit taps route to stored-result reopen, not the removed cooldown modal.', { verification: 'STATIC_CONTRACT' });
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
    'Daily Wheel successful claim opens the simplified backend-reward result',
    () => {
      const missing = missingTokens(`${dailyWheelHookSource}\n${dailyWheelCardSource}`, [
        'setLastResult(body)',
        'setShowResult(true)',
        'getDailyWheelWonRewardLine(displayResult, jokerRewards)',
        'DailyWheelWonRewardLine',
        'daily-wheel-simplified-result',
        'daily-wheel-result-reward-line',
        'DisabledAdSpinCta',
      ]);
      const forbidden = forbiddenTokens(dailyWheelCardSource, [
        'Toplam:',
        'Toplam Elmas',
        'Seri:',
        'Tekrar şansını dene!',
        'Reklamla tekrar çevirme yakında.',
        'Reklam İzle ve Tekrar Çevir',
      ]);
      if (missing.length || forbidden.length) {
        return fail('Daily Wheel claim success can drift away from the simplified result screen contract.', {
          verification: 'STATIC_CONTRACT',
          files: ['src/hooks/useDailyWheel.js', 'src/components/dailyWheel/DailyWheelCard.jsx'],
          actual: { missing, forbidden },
        });
      }
      return pass('Successful Daily Wheel claim stores the backend result, keeps the wheel visible, and shows only the won reward line plus disabled ad CTA.', {
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
        'segment.segmentColor',
        'conic-gradient',
        'Günlük Çark ödül seçenekleri',
        'borderTop: \'clamp(1.35rem, 7vw, 2.25rem) solid #facc15\'',
        'rimLights',
        'center hub',
        'width: \'85%\'',
        'maxWidth: \'22rem\'',
        'aspectRatio: \'1 / 1\'',
        'DailyWheelSegmentContent',
        'PremiumDiamondIcon',
        'PremiumGiftIcon',
        'width: \'8%\'',
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

  makeCase('daily_wheel_ready_popup_premium_visual_contract',
    'Daily Wheel ready popup uses the premium centered modal visual contract',
    () => {
      const missing = missingTokens(dailyWheelCardSource, [
        'rgba(0,0,0,.55)',
        'backdropFilter: \'blur(8px)\'',
        'WebkitBackdropFilter: \'blur(8px)\'',
        'width: \'min(92vw, 32rem)\'',
        'maxWidth: \'32rem\'',
        'height: \'auto\'',
        'border: \'1px solid rgba(250,204,21,0.46)\'',
        'DailyWheelReadyTitle',
        'DailyWheelReadyActions',
        'GÜNLÜK ÇARK HAZIR',
        'Bugünkü ödülünü almak için çevir',
        'SONRA',
        'ÇEVİR',
        'fontFamily: "\'Barlow Condensed\', \'Arial Narrow\', sans-serif"',
        'letterSpacing: \'0.12em\'',
        'gap: \'clamp(.8rem,2vw,1rem)\'',
      ]);
      if (missing.length) {
        return fail('Daily Wheel ready popup can drift from the requested premium centered modal/copy/button contract.', {
          verification: 'STATIC_CONTRACT',
          file: 'src/components/dailyWheel/DailyWheelCard.jsx',
          missing,
        });
      }
      return pass('Daily Wheel ready popup uses the requested centered blur overlay, premium frame, exact copy, and equal actions.', {
        verification: 'STATIC_CONTRACT',
      });
    }),

  makeCase('daily_wheel_spin_stays_in_ready_popup_without_intermediate_copy',
    'Daily Wheel spinning state keeps the premium popup and removes intermediate copy',
    () => {
      const oldSpinTitle = 'Çark ' + 'dönüyor...';
      const oldSpinSubtitle = 'Ödülün işaretçinin ' + 'altında duracak.';
      const missing = missingTokens(dailyWheelCardSource, [
        '(forceModalOpen || wheel.showPrompt || wheel.showResult)',
        'onClose={modalCloseHandler}',
        'const spinLocked = claiming || (hasReward && !readOnlyResult && !revealReady)',
        'disableClose={spinLocked}',
        'DailyWheelReadyTitle',
        'DailyWheelReadyActions claiming={spinLocked}',
        "const wheelPhase = isLanding ? 'landing' : 'idle'",
        'highlightAmount={revealReady ? displayResult?.rewardId : null}',
      ]);
      const forbidden = forbiddenTokens(dailyWheelCardSource, [
        oldSpinTitle,
        oldSpinSubtitle,
      ]);
      if (missing.length || forbidden.length) {
        return fail('Daily Wheel can still swap to the old intermediate spinning screen instead of keeping the approved popup shell during spin.', {
          verification: 'STATIC_CONTRACT',
          file: 'src/components/dailyWheel/DailyWheelCard.jsx',
          actual: { missing, forbidden },
        });
      }
      return pass('Daily Wheel spin keeps the approved ready popup title/actions mounted and removes the intermediate spinning copy from runtime UI.', {
        verification: 'STATIC_CONTRACT',
      });
    }),

  makeCase('daily_wheel_completed_result_close_returns_home',
    'Closing a completed Daily Wheel result closes the Home wheel sheet directly',
    () => {
      const combined = `${dailyWheelCardSource}\n${mainMenuSource}`;
      const missing = missingTokens(combined, [
        'const handleResultClose = () => {',
        'wheel.closeResult();',
        'onResultClose?.();',
        'const modalCloseHandler = (forceModalOpen || wheel.showResult)',
        'onClose={modalCloseHandler}',
        'renderLauncher={false}',
        'forceModalOpen',
        'openAvailableResultOnMount',
        'openClaimedResultOnMount',
        'onResultClose={onClose}',
      ]);
      const forbidden = forbiddenTokens(dailyWheelCardSource, [
        'DailyWheelStatusModal',
        'statusModalOpen',
        'setStatusModalOpen',
      ]);
      if (missing.length || forbidden.length) {
        return fail('Completed Daily Wheel result close can leave the Home Çark sheet/cooldown card visible.', {
          verification: 'STATIC_CONTRACT',
          files: ['src/components/dailyWheel/DailyWheelCard.jsx', 'src/pages/MainMenu.jsx'],
          actual: { missing, forbidden },
        });
      }
      return pass('Completed result close dismisses the result and Home opens ready/claimed wheel states directly without the extra compact sheet.', {
        verification: 'STATIC_CONTRACT',
      });
    }),

  makeCase('daily_wheel_home_shortcut_uses_full_modal_not_legacy_card',
    'Home ÇARK shortcut opens the full Daily Wheel modal and cannot show the legacy mini card',
    () => {
      const modalStart = safeStr(mainMenuSource).indexOf('function HomeShortcutModal');
      const modalSource = modalStart >= 0 ? safeStr(mainMenuSource).slice(modalStart) : '';
      const wheelBranchStart = modalSource.indexOf('if (isWheel)');
      const wheelBranchEnd = modalSource.indexOf('return null;', wheelBranchStart);
      const wheelBranch = wheelBranchStart >= 0 && wheelBranchEnd > wheelBranchStart
        ? modalSource.slice(wheelBranchStart, wheelBranchEnd)
        : '';
      const missing = missingTokens(wheelBranch, [
        'if (isWheel)',
        'renderLauncher={false}',
        'forceModalOpen',
        'openAvailableResultOnMount',
        'openClaimedResultOnMount',
      ]);
      const forbidden = forbiddenTokens(wheelBranch, [
        'compact',
        '<motion.div',
        '<h2',
        'DailyQuestV1Card',
      ]);
      if (missing.length || forbidden.length) {
        return fail('Home ÇARK can still route through the old compact Günlük Çark / Hazır card instead of the full wheel modal.', {
          verification: 'STATIC_CONTRACT',
          files: ['src/pages/MainMenu.jsx', 'src/components/dailyWheel/DailyWheelCard.jsx'],
          actual: { missing, forbidden },
        });
      }
      return pass('Home ÇARK mounts the full Daily Wheel modal controller directly for loading, available, claimed, and error states; the compact mini-card branch is not reachable from Home.', {
        verification: 'STATIC_CONTRACT',
      });
    }),

  makeCase('daily_wheel_claimed_manual_reopen_uses_stored_result',
    'Already-claimed Home Daily Wheel taps reopen the stored post-win result screen',
    () => {
      const combined = `${dailyWheelHookSource}\n${dailyWheelCardSource}\n${mainMenuSource}`;
      const missing = missingTokens(combined, [
        'openClaimedResult',
        'wheel.openClaimedResult();',
        'buildClaimResultFromStatus',
        'sourceStatus?.lastReward',
        'const refreshedStatus = await refresh().catch(() => null);',
        'fallbackClaimedResult',
        'Bugünkü ödül alındı',
        'displayResult?.fallbackClaimedResult || displayResult?.rewardId',
        'DailyWheelWonRewardLine',
        'DisabledAdSpinCta',
        'openClaimedResultOnMount',
      ]);
      const openIndex = safeStr(dailyWheelHookSource).indexOf('const openClaimedResult = useCallback');
      const openBlock = openIndex >= 0
        ? safeStr(dailyWheelHookSource).slice(openIndex, safeStr(dailyWheelHookSource).indexOf('return useMemo', openIndex))
        : '';
      const forbidden = [
        ...forbiddenTokens(openBlock, [
          'invokeDailyWheelFunction(\'claimDailyWheelReward\'',
          'claimDailyWheelReward(',
          'applyClaimSuccessBody(',
          'setClaiming(true)',
        ]),
        ...forbiddenTokens(dailyWheelCardSource, [
          'DailyWheelStatusModal',
          'statusModalOpen',
        ]),
      ];
      if (missing.length || forbidden.length) {
        return fail('Already-claimed Daily Wheel can show the removed cooldown card, skip stored reward payload, or trigger a duplicate claim path.', {
          verification: 'STATIC_CONTRACT',
          files: ['src/hooks/useDailyWheel.js', 'src/components/dailyWheel/DailyWheelCard.jsx', 'src/pages/MainMenu.jsx'],
          actual: { missing, forbidden },
        });
      }
      return pass('Already-claimed manual reopen reads cached/refreshed lastReward, falls back safely if old data lacks payload, and renders the same wheel + reward line + disabled future-repeat result screen without claiming again.', {
        verification: 'STATIC_CONTRACT',
      });
    }),

  makeCase('daily_wheel_segment_content_scale_reduced',
    'Daily Wheel segment icons and numbers are reduced by the 0.8 content scale token',
    () => {
      const missing = missingTokens(dailyWheelCardSource, [
        'DAILY_WHEEL_SEGMENT_CONTENT_SCALE = 0.8',
        "'--daily-wheel-segment-content-scale': DAILY_WHEEL_SEGMENT_CONTENT_SCALE",
        "transform: 'scale(var(--daily-wheel-segment-content-scale))'",
        'DAILY_WHEEL_SEGMENT_CONTENT_STYLE',
        'style={DAILY_WHEEL_SEGMENT_CONTENT_STYLE}',
        'PremiumDiamondIcon',
        'PremiumShieldIcon',
        'PremiumFreezeIcon',
        'PremiumSwapIcon',
        'PremiumGiftIcon',
      ]);
      if (missing.length) {
        return fail('Daily Wheel segment content can drift back to oversized icon/number rendering.', {
          verification: 'STATIC_CONTRACT',
          file: 'src/components/dailyWheel/DailyWheelCard.jsx',
          missing,
        });
      }
      return pass('All Daily Wheel segment content uses a shared 0.8 scale token without changing wheel size or segment order.', {
        verification: 'STATIC_CONTRACT',
      });
    }),

  makeCase('daily_wheel_segment_content_radially_center_facing',
    'Daily Wheel segment content rotates with its wedge and faces the wheel center (no screen-upright counter-rotation)',
    () => {
      const missing = missingTokens(dailyWheelCardSource, [
        // Content group is placed at its segment center angle...
        'const angle = index * WHEEL_SLICE_DEGREES;',
        // ...and rotated by that same angle so it aligns radially with the wedge.
        'transform: `translate(-50%, -50%) rotate(${angle}deg)`',
        "transformOrigin: 'center'",
        // The content lives inside the spinning wheel layer so it rotates with
        // the wheel; the 0.8 content scale is preserved (not enlarged).
        'WHEEL_REWARD_SLICES.map((segment, index)',
        'DAILY_WHEEL_SEGMENT_CONTENT_SCALE = 0.8',
      ]);
      const forbidden = forbiddenTokens(dailyWheelCardSource, [
        // No screen-upright counter-rotation that cancels the wheel/segment angle.
        'rotate(${-angle}deg)',
        'rotate(-${angle}deg)',
        'rotate(${angle * -1}deg)',
      ]);
      if (missing.length || forbidden.length) {
        return fail('Daily Wheel segment content can stay artificially screen-upright instead of facing the wheel center, or the size reduction can drift.', {
          verification: 'STATIC_CONTRACT',
          file: 'src/components/dailyWheel/DailyWheelCard.jsx',
          actual: { missing, forbidden },
        });
      }
      return pass('Diamond icon+number groups and Joker/Gift icons rotate with their wedge toward the wheel center, keep the reduced 0.8 scale, and add no counter-rotation.', {
        verification: 'STATIC_CONTRACT',
      });
    }),

  makeCase('daily_wheel_visual_segment_order_matches_backend_rewards',
    'Daily Wheel visual segment order matches backend-selected reward IDs',
    () => {
      const missing = missingTokens(dailyWheelRewardsSource, [
        "id: 'diamond_20'",
        'segmentIndex: 0',
        "wheelLabel: '20'",
        "segmentColor: '#0f5f4f'",
        "id: 'diamond_60'",
        'segmentIndex: 1',
        "wheelLabel: '60'",
        "segmentColor: '#1599c9'",
        "id: 'diamond_100'",
        'segmentIndex: 2',
        "wheelLabel: '100'",
        "segmentColor: '#d95b06'",
        "id: 'joker_krono_kalkan'",
        'segmentIndex: 3',
        "iconKey: 'shield'",
        "segmentColor: '#f2bb13'",
        "id: 'joker_zamani_dondur'",
        'segmentIndex: 4',
        "iconKey: 'snowflake'",
        "segmentColor: '#b8171f'",
        "id: 'joker_kart_degistir'",
        'segmentIndex: 5',
        "iconKey: 'swap'",
        "segmentColor: '#8526ae'",
        "id: 'gift_box'",
        'segmentIndex: 6',
        "iconKey: 'gift_box'",
        "segmentColor: '#087a38'",
        "id: 'diamond_250'",
        'segmentIndex: 7',
        "wheelLabel: '250'",
        "segmentColor: '#4c168d'",
      ]);
      const runtimeMissing = missingTokens(`${dailyWheelCardSource}\n${dailyWheelRewardsSource}`, [
        'WHEEL_REWARD_SLICES = DAILY_WHEEL_REWARD_SEGMENTS',
        'getWheelTargetRotation(displayResult?.rewardSegmentIndex, prefersReducedMotion)',
        'highlightAmount={revealReady ? displayResult?.rewardId : null}',
      ]);
      if (missing.length || runtimeMissing.length) {
        return fail('Daily Wheel visible slices can drift from the backend reward ID/segment index mapping.', {
          verification: 'STATIC_CONTRACT',
          files: ['src/lib/dailyWheelRewards.js', 'src/components/dailyWheel/DailyWheelCard.jsx'],
          actual: { missing, runtimeMissing },
        });
      }
      return pass('The client paints the same eight reward IDs in backend segment order and lands by rewardSegmentIndex.', {
        verification: 'STATIC_CONTRACT',
      });
    }),

  makeCase('daily_wheel_spin_duration_and_button_lock',
    'Daily Wheel spin duration is about 5 seconds and button/close controls lock during spin',
    () => {
      const missing = missingTokens(dailyWheelCardSource, [
        'WHEEL_SPIN_DURATION_MS = 5000',
        'WHEEL_REDUCED_MOTION_DURATION_MS = 900',
        'WHEEL_SPIN_DURATION_SECONDS',
        'useReducedMotion',
        'const spinLocked = claiming || (hasReward && !readOnlyResult && !revealReady)',
        'disableClose={spinLocked}',
        'DailyWheelReadyActions claiming={spinLocked}',
        'setRevealReady(true)',
      ]);
      if (missing.length) {
        return fail('Daily Wheel spin can reveal too early or remain closable/clickable during the landing spin.', {
          verification: 'STATIC_CONTRACT',
          file: 'src/components/dailyWheel/DailyWheelCard.jsx',
          missing,
        });
      }
      return pass('Daily Wheel uses a 5s landing spin and keeps result/close controls disabled until reveal.', {
        verification: 'STATIC_CONTRACT',
        actual: { spinDurationMs: 5000 },
      });
    }),

  makeCase('daily_wheel_single_continuous_spin_no_slow_fast_slow',
    'Daily Wheel spin uses one continuous fast-start → decelerate motion with no visible loop phase',
    () => {
      const missing = missingTokens(dailyWheelCardSource, [
        "phase === 'landing'",
        'WHEEL_LANDING_EASE',
        // Steep-early, long-tail monotonic ease-out (fast start, decel at end).
        'const WHEEL_LANDING_EASE = [0.05, 0.75, 0.15, 1]',
        // One continuous keyframe from rest to target with a light final bounce.
        'rotate: [0, targetRotation + WHEEL_LANDING_BOUNCE_DEGREES, targetRotation]',
        'WHEEL_LANDING_BOUNCE_DEGREES',
        "times: [0, 0.9, 1]",
        "const wheelPhase = isLanding ? 'landing' : 'idle'",
        // Spin starts immediately on tap — no separate "prepare" wait.
        'wheel.openResult();\n      wheel.claim();',
      ]);
      const forbidden = forbiddenTokens(dailyWheelCardSource, [
        // The old separate steady pre-spin loop that caused slow → fast → slow.
        "phase === 'loop'",
        'WHEEL_PRESPIN_ROTATION_SECONDS',
        "phase={claiming ? 'loop' : 'idle'}",
        "(claiming && !hasReward ? 'loop' : 'idle')",
        // Old multi-phase keyframe array + heavy overshoot/bounce-back must be gone.
        'targetRotation * 0.72',
        'targetRotation - 8',
        'Ödül hazırlanıyor',
      ]);
      if (missing.length || forbidden.length) {
        return fail('Daily Wheel spin can still use a separate loop phase or non-monotonic curve, reintroducing slow → fast → slow.', {
          verification: 'STATIC_CONTRACT',
          file: 'src/components/dailyWheel/DailyWheelCard.jsx',
          actual: { missing, forbidden },
        });
      }
      return pass('Daily Wheel starts spinning on tap and runs one continuous fast-start → decelerate landing with a light final bounce, no visible loop handoff.', {
        verification: 'STATIC_CONTRACT',
      });
    }),

  makeCase('daily_wheel_spin_effects_sync_to_visible_rotation',
    'Daily Wheel sounds/ticks track the visible spin and celebration fires only when the wheel stops',
    () => {
      const missing = missingTokens(dailyWheelCardSource, [
        'if (!hasReward || readOnlyResult) return undefined',
        'sounds.wheelSpinStart?.()',
        'sounds.wheelTick?.()',
        // Ticks widen as the wheel decelerates (audio in step with rotation).
        'const scheduleTick = () =>',
        'const gap = 70 + (progress * progress * 290)',
        'const revealId = window.setTimeout(() => {',
        'setRevealReady(true)',
        'fireDailyWheelConfetti(prefersReducedMotion, isActiveSession)',
        'window.navigator?.vibrate?.(28)',
        'sounds.rewardReveal?.()',
        // All timers cleaned up on close/unmount so no sound outlives the wheel.
        'cancelled = true;',
        'timers.forEach((id) => window.clearTimeout(id))',
        '}, spinDurationMs)',
      ]);
      const forbidden = forbiddenTokens(dailyWheelCardSource, [
        // No fixed-cadence tick interval decoupled from deceleration.
        "window.setInterval(() => {\n      try { sounds.wheelTick",
      ]);
      if (missing.length || forbidden.length) {
        return fail('Daily Wheel sound/effects can desynchronize from the visible spin or leak sound after the wheel stops.', {
          verification: 'STATIC_CONTRACT',
          file: 'src/components/dailyWheel/DailyWheelCard.jsx',
          actual: { missing, forbidden },
        });
      }
      return pass('Daily Wheel ticks widen with deceleration, celebration cues fire at the visible stop, and all timers/sound are cleaned up on close/unmount.', {
        verification: 'STATIC_CONTRACT',
      });
    }),

  makeCase('daily_wheel_result_uses_backend_reward_amount',
    'Daily Wheel spin lands on and reveals the backend reward payload',
    () => {
      const missing = missingTokens(dailyWheelCardSource, [
        'getWheelTargetRotation(displayResult?.rewardSegmentIndex, prefersReducedMotion)',
        'highlightAmount={revealReady ? displayResult?.rewardId : null}',
        'getDailyWheelWonRewardLine(displayResult, jokerRewards)',
        // Simplified result reads the backend amount inside the reward-line
        // helper (result?.rewardAmount ?? result?.reward_amount ?? segment).
        'result?.rewardAmount ??',
        'displayResult?.rewardId',
        'displayResult?.rewardSegmentIndex',
        'getDailyWheelSegmentById(rewardId)',
        'formatDailyWheelJokerLabel(jokerType)',
        'Hediye Kutusu',
      ]);
      if (missing.length) {
        return fail('Daily Wheel visual result can drift from the backend-selected reward payload.', {
          verification: 'STATIC_CONTRACT',
          file: 'src/components/dailyWheel/DailyWheelCard.jsx',
          missing,
        });
      }
      return pass('Wheel landing target and simplified reward line are derived from the backend claim payload.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('daily_wheel_gift_box_resolves_server_side',
    'Daily Wheel Gift Box contents are server-resolved and idempotent',
    () => {
      const missing = missingTokens(`${DAILY_WHEEL_BACKEND_HEALTH_SOURCE}\n${dailyWheelCardSource}\n${dailyWheelRewardsSource}`, [
        'GIFT_BOX_REWARD_TABLE',
        'selectGiftBoxReward',
        'giftBoxResolvedServerSide',
        'gift_box_reward_id',
        'gift_box_reward_summary',
        "rewardType === 'gift_box'",
        "rewardId === 'gift_box'",
        'Hediye Kutusu',
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

  makeCase('daily_wheel_ad_repeat_cta_disabled_no_fake_ad',
    'Daily Wheel repeat ad spin CTA is visible but disabled without fake ad flow',
    () => {
      const ctaStart = dailyWheelCardSource.indexOf('function DisabledAdSpinCta');
      const ctaEnd = dailyWheelCardSource.indexOf('function DailyWheelReadyTitle');
      const ctaSource = ctaStart >= 0 && ctaEnd > ctaStart ? dailyWheelCardSource.slice(ctaStart, ctaEnd) : '';
      const missing = missingTokens(`${dailyWheelCardSource}\n${DAILY_WHEEL_BACKEND_HEALTH_SOURCE}\n${economyRulesSource}`, [
        'DisabledAdSpinCta',
        'daily-wheel-disabled-ad-spin-cta',
        'RewardedVideoIcon',
        '<span>ÇEVİR</span>',
        'Yakında',
        'text-[10px]',
        'tracking-[0.18em]',
        'text-slate-300',
        'aria-disabled="true"',
        'Reklam entegrasyonu yakında. Şu anda tekrar çevirme devre dışı.',
        'noFakeAdRewardFlow',
        'future rewarded-ad integration',
      ]);
      const ctaForbidden = forbiddenTokens(ctaSource, [
        'onClick',
        'onSpin',
        'claim',
        'rewardedAd',
        'showRewardedAd',
        'adSpinReward',
      ]);
      const forbidden = forbiddenTokens(dailyWheelCardSource, [
        'claimAdSpinReward',
        'rewardedAd',
        'showRewardedAd',
        'adSpinReward',
        'Tekrar şansını dene!',
        'Reklamla tekrar çevirme yakında.',
        'Reklam İzle ve Tekrar Çevir',
      ]);
      if (missing.length || ctaForbidden.length || forbidden.length) {
        return fail('Daily Wheel repeat ad CTA can look active or add a fake ad reward path.', {
          verification: 'STATIC_CONTRACT',
          files: ['src/components/dailyWheel/DailyWheelCard.jsx', 'docs/KRONOX_ECONOMY_RULES.md'],
          actual: { missing, ctaForbidden, forbidden },
        });
      }
      return pass('Repeat spin ad CTA is disabled, visually subdued, keeps ÇEVİR as the main label with small Yakında subtext, and has no fake reward flow.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('daily_wheel_result_close_cancels_stale_effect_callbacks',
    'Daily Wheel close cancels or ignores stale result effects and leaves no hidden overlay',
    () => {
      const missing = missingTokens(dailyWheelCardSource, [
        'effectSessionRef',
        'isActiveSession',
        'stopDailyWheelConfetti',
        'dailyWheelConfettiInstance?.reset?.()',
        'forceModalOpen',
        'handleModalClose',
        'effectSessionRef.current += 1',
        'timers.forEach((id) => window.clearTimeout(id))',
        'return resultModal ? <>{resultModal}</> : null;',
      ]);
      const forbidden = forbiddenTokens(dailyWheelCardSource, [
        'setTimeout(() => onClose',
        'setTimeout(onClose',
      ]);
      if (missing.length || forbidden.length) {
        return fail('Daily Wheel close can still leave stale timers/confetti or an invisible modal path after result close.', {
          verification: 'STATIC_CONTRACT',
          file: 'src/components/dailyWheel/DailyWheelCard.jsx',
          actual: { missing, forbidden },
        });
      }
      return pass('Daily Wheel result close invalidates the active effect session, clears timers/confetti, and the Home shortcut unmounts the modal instead of leaving a hidden overlay.', {
        verification: 'STATIC_CONTRACT',
      });
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

  makeCase('daily_wheel_already_claimed_no_duplicate_reward',
    'Already-claimed Daily Wheel reopen never starts a new spin or duplicate reward',
    () => {
      const openIndex = safeStr(dailyWheelHookSource).indexOf('const openClaimedResult = useCallback');
      const openBlock = openIndex >= 0
        ? safeStr(dailyWheelHookSource).slice(openIndex, safeStr(dailyWheelHookSource).indexOf('return useMemo', openIndex))
        : '';
      const cardClaimedIndex = safeStr(dailyWheelCardSource).indexOf("if (wheel.status === 'claimed')");
      const cardClaimedBlock = cardClaimedIndex >= 0
        ? safeStr(dailyWheelCardSource).slice(cardClaimedIndex, safeStr(dailyWheelCardSource).indexOf("if (wheel.status === 'error')", cardClaimedIndex))
        : '';
      const missing = missingTokens(openBlock, [
        'setShowPrompt(false)',
        'buildClaimResultFromStatus',
        'setLastResult(reopenedResult)',
        'setStatus(\'claimed\')',
        'setShowResult(true)',
      ]);
      const forbidden = [
        ...forbiddenTokens(openBlock, [
          'claimDailyWheelReward',
          'applyClaimSuccessBody',
          'setClaiming(true)',
        ]),
        ...forbiddenTokens(cardClaimedBlock, [
          'wheel.claim()',
          'claimDailyWheelReward',
        ]),
      ];
      if (missing.length || forbidden.length) {
        return fail('Already-claimed manual reopen can start a new claim or skip the read-only stored-result state.', {
          verification: 'STATIC_CONTRACT',
          files: ['src/hooks/useDailyWheel.js', 'src/components/dailyWheel/DailyWheelCard.jsx'],
          actual: { missing, forbidden },
        });
      }
      return pass('Already-claimed reopen is read-only: it builds a result from status/lastReward and never calls the claim/reward path.', { verification: 'STATIC_CONTRACT' });
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
