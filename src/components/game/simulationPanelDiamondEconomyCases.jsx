// Kronox Health Center — Diamond economy contracts (Codex152).
//
// Static coverage for the new persisted Elmas/Diamond economy:
// canonical User.diamonds source, starter + daily grants, idempotency keys,
// ledger schema, display helper alignment, and future-source extensibility.

import authContextSource from '../../lib/AuthContext.jsx?raw';
import diamondEconomySource from '../../lib/diamondEconomy.js?raw';
import leaderboardSource from '../../lib/leaderboard.js?raw';
import mainMenuSource from '../../pages/MainMenu.jsx?raw';
import dailyRewardsPanelSource from '../dailyWheel/DailyRewardsPanel.jsx?raw';
import marketPageSource from '../../pages/MarketPage.jsx?raw';
import purchaseJokerWithDiamondsSource from '../../../base44/functions/purchaseJokerWithDiamonds/entry.ts?raw';
import profilePageSource from '../../pages/ProfilePage.jsx?raw';
import leaderboardPageSource from '../../pages/LeaderboardPage.jsx?raw';
import soloChallengeSource from '../../pages/SoloChallenge.jsx?raw';
import onlineChallengeSource from '../lobby/OnlineChallengeScreen.jsx?raw';
import screenHeaderSource from '../layout/ScreenHeader.jsx?raw';
import economyRulesSource from '../../../docs/KRONOX_ECONOMY_RULES.md?raw';
import {
  DIAMOND_DAILY_LOGIN_AMOUNT,
  DIAMOND_STARTER_BONUS_AMOUNT,
  getDiamondBalance,
} from '@/lib/diamondEconomy';
import {
  diamondTransactionEntitySource,
  userEntitySource,
} from './simulationPanelContractStrings.jsx';

const STATUS = {
  PASS: 'PASS',
  FAIL: 'FAIL',
  NOT_AUTOMATABLE: 'NOT_AUTOMATABLE',
};

const ACTION_TYPES = {
  CODE_FIX: 'CODE_FIX',
  BACKEND_RUNTIME_PROBE: 'BACKEND_RUNTIME_PROBE',
};

const SUITE_ID = 'diamond_economy_health';
const SUITE_NAME = 'Diamond Economy Health Suite';

const DISPLAY_SOURCES = {
  MainMenu: mainMenuSource,
  ProfilePage: profilePageSource,
  LeaderboardPage: leaderboardPageSource,
  SoloChallenge: soloChallengeSource,
  OnlineChallengeScreen: onlineChallengeSource,
  ScreenHeader: screenHeaderSource,
};

function safeStr(source) {
  if (source == null) return '';
  if (typeof source === 'string') return source;
  try { return String(source); } catch { return ''; }
}

function pass(reason, extra = {}) { return { status: STATUS.PASS, reason, ...extra }; }
function fail(reason, extra = {}) { return { status: STATUS.FAIL, reason, ...extra }; }
function notAutomatable(reason, extra = {}) { return { status: STATUS.NOT_AUTOMATABLE, reason, ...extra }; }

function missingTokens(source, tokens) {
  const text = safeStr(source);
  return tokens.filter((token) => !text.includes(token));
}

function findForbidden(sources, tokens) {
  return Object.entries(sources).flatMap(([file, source]) => {
    const text = safeStr(source);
    return tokens
      .filter((token) => text.includes(token))
      .map((token) => ({ file, token }));
  });
}

function makeCase(id, name, run, options = {}) {
  return {
    key: `${SUITE_ID}.${id}`,
    suiteId: SUITE_ID,
    suiteName: SUITE_NAME,
    id,
    name,
    critical: options.critical ?? true,
    actionType: options.actionType || ACTION_TYPES.CODE_FIX,
    nextStep: options.nextStep || 'Keep Diamond economy source, grants, and display contracts aligned.',
    ...options,
    run,
  };
}

export const EXTRA_SUITES = [
  { id: SUITE_ID, name: SUITE_NAME, critical: true, color: '#67e8f9' },
];

export const EXTRA_TESTS = [
  makeCase('diamond_balance_source_of_truth_exists',
    'Canonical persisted Diamond balance source exists',
    () => {
      const missing = missingTokens(`${diamondEconomySource}\n${userEntitySource}`, [
        "DIAMOND_BALANCE_FIELD = 'diamonds'",
        'export function getDiamondBalance',
        'normalizeDiamondBalance',
        '"diamonds"',
      ]);
      const sample = getDiamondBalance({ diamonds: 42 });
      if (missing.length || sample !== 42) {
        return fail('Diamond balance source is not canonical or executable.', {
          verification: 'STATIC_CONTRACT+EXECUTABLE',
          missing,
          actual: { sample },
        });
      }
      return pass('User.diamonds is the canonical Diamond balance source.', { verification: 'STATIC_CONTRACT+EXECUTABLE' });
    }),

  makeCase('starter_bonus_grants_100_once',
    'Starter bonus grants 100 Diamonds once',
    () => {
      const missing = missingTokens(diamondEconomySource, [
        'DIAMOND_STARTER_BONUS_AMOUNT = 100',
        "DIAMOND_STARTER_BONUS_IDEMPOTENCY_PREFIX = 'starter_bonus:'",
        'grantStarterBonusIfNeeded',
        'starter_bonus_granted_at',
      ]);
      if (missing.length || DIAMOND_STARTER_BONUS_AMOUNT !== 100) {
        return fail('Starter bonus amount/idempotency contract drifted.', {
          verification: 'STATIC_CONTRACT+EXECUTABLE',
          missing,
          actual: { DIAMOND_STARTER_BONUS_AMOUNT },
        });
      }
      return pass('Starter bonus is +100 and guarded by starter_bonus_granted_at/idempotency key.', { verification: 'STATIC_CONTRACT+EXECUTABLE' });
    }),

  makeCase('daily_login_grants_20_once_per_day',
    'Daily login grants 20 Diamonds once per UTC day',
    () => {
      const missing = missingTokens(diamondEconomySource, [
        'DIAMOND_DAILY_LOGIN_AMOUNT = 20',
        "DIAMOND_DAILY_LOGIN_IDEMPOTENCY_PREFIX = 'daily_login:'",
        'grantDailyLoginRewardIfNeeded',
        'getDiamondDailyKey',
        'last_daily_diamond_reward_date',
      ]);
      if (missing.length || DIAMOND_DAILY_LOGIN_AMOUNT !== 20) {
        return fail('Daily login amount/day-idempotency contract drifted.', {
          verification: 'STATIC_CONTRACT+EXECUTABLE',
          missing,
          actual: { DIAMOND_DAILY_LOGIN_AMOUNT },
        });
      }
      return pass('Daily login reward is +20 and keyed by UTC YYYY-MM-DD.', { verification: 'STATIC_CONTRACT+EXECUTABLE' });
    }),

  makeCase('first_day_total_can_be_120',
    'First-day user can receive starter + daily rewards',
    () => {
      const missing = missingTokens(`${diamondEconomySource}\n${economyRulesSource}`, [
        'ensureDiamondEconomyForUser',
        'grantStarterBonusIfNeeded',
        'grantDailyLoginRewardIfNeeded',
        'First-day total: `120` Diamonds',
      ]);
      const total = DIAMOND_STARTER_BONUS_AMOUNT + DIAMOND_DAILY_LOGIN_AMOUNT;
      if (missing.length || total !== 120) {
        return fail('First-day total no longer grants 100 + 20.', {
          verification: 'STATIC_CONTRACT+EXECUTABLE',
          missing,
          actual: { total },
        });
      }
      return pass('A new user can receive 120 Diamonds on first day: 100 starter + 20 daily.', { verification: 'STATIC_CONTRACT+EXECUTABLE' });
    }),

  makeCase('diamond_rewards_use_idempotency_keys',
    'Diamond reward grants use durable idempotency keys',
    () => {
      const missing = missingTokens(diamondEconomySource, [
        'buildDiamondIdempotencyKey',
        'idempotencyKey',
        'findDiamondTransaction',
        'DIAMOND_STARTER_BONUS_IDEMPOTENCY_PREFIX',
        'DIAMOND_DAILY_LOGIN_IDEMPOTENCY_PREFIX',
        'already_recorded',
      ]);
      if (missing.length) {
        return fail('Diamond reward idempotency key contract is incomplete.', { verification: 'STATIC_CONTRACT', missing });
      }
      return pass('Starter and daily rewards check durable transaction idempotency keys.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('diamond_reward_not_regranted_on_refresh',
    'Refresh/re-render does not repeatedly grant Diamonds',
    () => {
      const missing = missingTokens(`${diamondEconomySource}\n${authContextSource}`, [
        'hasPersistedGrantGuard',
        'economyEnsureKeyRef',
        'economyEnsurePromiseRef',
        'ensureDiamondEconomyForUser(currentUser)',
        'starter_bonus_granted_at',
        'last_daily_diamond_reward_date',
      ]);
      if (missing.length) {
        return fail('Diamond bootstrap can regrant on refresh/re-render.', { verification: 'STATIC_CONTRACT', missing });
      }
      return pass('Bootstrap uses in-session guard plus persisted starter/daily guard fields.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('diamond_reward_not_regranted_multi_device_contract',
    'Multi-device duplicate prevention requires runtime probe',
    () => notAutomatable('Static contract verifies durable guards and transaction keys, but two-device Base44 race behavior requires a live runtime probe.', {
      verification: 'NOT_AUTOMATABLE',
      classification: 'RUNTIME_BACKEND_PROBE_REQUIRED',
      actionType: ACTION_TYPES.BACKEND_RUNTIME_PROBE,
      expected: 'Two simultaneous sessions grant at most one starter and one daily reward; duplicate ledger rows are rejected or harmless.',
      actual: 'No multi-device harness in Health Center.',
    }),
    { actionType: ACTION_TYPES.BACKEND_RUNTIME_PROBE, critical: false }),

  makeCase('diamond_balance_display_uses_real_field',
    'Visible Elmas display uses real persisted Diamond balance',
    () => {
      // Codex159 — Verify the REAL canonical helper usage instead of a
      // single brittle key-form literal. The canonical bridge is:
      //   lib/leaderboard.js → `getLeaderboardDiamondValue(user)` →
      //   returns `getDiamondBalance(user)` (canonical persisted source).
      //
      // Visible Elmas SURFACES today are:
      //   • Home / Solo  → StandardTopBar (gets `diamonds={getLeaderboardDiamondValue(user)}`)
      //   • Profile      → İstatistikler tile (via getProfileDiamondValue → getLeaderboardDiamondValue)
      //   • Liderlik     → stat row (`diamondValue = getLeaderboardDiamondValue(user)`)
      //
      // We verify each surface imports the canonical helper AND calls
      // it (`getLeaderboardDiamondValue(user`). The exact JSX/key shape
      // is intentionally not pinned — only the helper contract is.

      // 1. Bridge: lib/leaderboard exposes the canonical bridge to
      //    getDiamondBalance. This is the real source-of-truth check.
      const bridgeMissing = missingTokens(leaderboardSource, [
        'export function getLeaderboardDiamondValue',
        'return getDiamondBalance(user)',
      ]);

      // 2. Display surfaces. Each must import + call the canonical helper.
      const DISPLAY_SURFACES = {
        MainMenu: mainMenuSource,
        ProfilePage: profilePageSource,
        LeaderboardPage: leaderboardPageSource,
        SoloChallenge: soloChallengeSource,
      };
      const surfaceMissing = Object.entries(DISPLAY_SURFACES)
        .map(([file, src]) => ({
          file,
          missing: [
            'getLeaderboardDiamondValue',
            'getLeaderboardDiamondValue(user',
          ].filter((t) => !safeStr(src).includes(t)),
        }))
        .filter((r) => r.missing.length);

      // 3. Elmas label must exist somewhere across all surfaces, so the
      //    UI actually shows Elmas to the user. Either JSX attribute or
      //    object key is acceptable.
      const labelText = `${safeStr(profilePageSource)}\n${safeStr(leaderboardPageSource)}\n${safeStr(screenHeaderSource)}`;
      const hasElmasLabel = labelText.includes("label: 'Elmas'") || labelText.includes('label="Elmas"');

      if (bridgeMissing.length || surfaceMissing.length || !hasElmasLabel) {
        return fail('Visible Elmas surfaces are not tied to the canonical Diamond helper.', {
          verification: 'STATIC_CONTRACT',
          actual: { bridgeMissing, surfaceMissing, hasElmasLabel },
        });
      }
      return pass('Home/Solo/Profile/Liderlik Elmas displays flow through getLeaderboardDiamondValue → getDiamondBalance.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('diamonds_not_derived_from_score_or_stars',
    'Diamonds are not derived from Puan, stars, or level',
    () => {
      const bridgeMissing = missingTokens(leaderboardSource, ['return getDiamondBalance(user)']);
      const offenders = findForbidden({ diamondEconomySource }, [
        'totalSoloScore',
        'totalStars',
        'getKronoxVisibleScore',
        'bestStars',
        'currentLevel',
        'online_progress',
      ]);
      if (bridgeMissing.length || offenders.length) {
        return fail('Diamond helper derives balance from scoring/progression fields.', {
          verification: 'STATIC_CONTRACT',
          actual: { bridgeMissing, offenders },
        });
      }
      return pass('Diamond balance normalization only reads User.diamonds and numeric input.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('future_sources_supported_by_generic_model',
    'Future Diamond sources are supported by generic transaction model',
    () => {
      const missing = missingTokens(`${diamondEconomySource}\n${diamondTransactionEntitySource}`, [
        'wheel_spin_future',
        'daily_quest_future',
        'rewarded_ad_future',
        'quest_reward_future',
        'purchase_future',
        'admin_adjustment',
        'grantDiamondsOnce',
      ]);
      if (missing.length) {
        return fail('Diamond economy cannot extend to future sources without one-off code.', { verification: 'STATIC_CONTRACT', missing });
      }
      return pass('Generic ledger/source model is ready for future reward sources without implementing them now.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('diamond_transaction_ledger_exists_if_implemented',
    'DiamondTransaction ledger schema and helper exist',
    () => {
      const missing = missingTokens(`${diamondTransactionEntitySource}\n${diamondEconomySource}`, [
        'DiamondTransaction',
        'balance_before',
        'balance_after',
        'idempotency_key',
        'createDiamondTransaction',
        'base44.entities.DiamondTransaction',
      ]);
      if (missing.length) {
        return fail('DiamondTransaction ledger contract is incomplete.', { verification: 'STATIC_CONTRACT', missing });
      }
      return pass('DiamondTransaction ledger exists and the grant helper writes audit rows.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('daily_quest_v1_no_client_grants',
    'Daily Quest v1 is visible but not an active client-side Diamond grant',
    () => {
      const activeRuntimeSources = `${diamondEconomySource}\n${userEntitySource}\n${diamondTransactionEntitySource}\n${dailyRewardsPanelSource}`;
      const accidentalGrant = dailyRewardsPanelSource.includes('base44.functions.invoke')
        || dailyRewardsPanelSource.includes('DiamondTransaction')
        || dailyRewardsPanelSource.includes('diamonds:');
      const missing = missingTokens(`${activeRuntimeSources}\n${economyRulesSource}`, [
        'DailyQuestV1Card',
        'daily_quest_future',
        'daily_quest_last_claim_date',
        'does not grant Diamonds or Kronox Puan yet',
      ]);
      if (accidentalGrant || missing.length) {
        return fail('Daily Quest v1 can grant Diamonds client-side or lacks the separate future-source contract.', {
          verification: 'STATIC_CONTRACT',
          actual: { accidentalGrant, missing },
        });
      }
      return pass('Daily Quest v1 is visible in Günlük Ödüller, reward-inactive, and reserved for a separate server-backed source.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('market_purchase_is_diamond_sink',
    'Mağaza purchase is a controlled Diamond sink',
    () => {
      const missing = missingTokens(`${purchaseJokerWithDiamondsSource}\n${diamondEconomySource}\n${economyRulesSource}`, [
        "MARKET_PURCHASE: 'market_purchase'",
        'const diamondCost = product.price * quantity',
        'const diamondAfter = diamondBefore - diamondCost',
        "direction: 'spend'",
        'Mağaza purchase is a Diamond sink',
      ]);
      const forbidden = findForbidden({ purchaseJokerWithDiamondsSource }, [
        'diamondAfter = diamondBefore +',
        "direction: 'earn'",
      ]);
      if (missing.length || forbidden.length) {
        return fail('Mağaza purchase does not clearly remove Diamonds as a controlled sink.', {
          verification: 'STATIC_CONTRACT',
          actual: { missing, forbidden },
        });
      }
      return pass('Mağaza purchases remove Diamonds only through the server-backed spend path.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('market_purchase_updates_visible_diamond_balances',
    'Home and Mağaza Diamond displays can update after purchase',
    () => {
      const missing = missingTokens(`${mainMenuSource}\n${marketPageSource}\n${purchaseJokerWithDiamondsSource}`, [
        'getLeaderboardDiamondValue(user)',
        'aria-label={`Elmas: ${diamonds}`}',
        'setUser((current) => ({',
        'diamonds: normalizeJokerQuantity(result.diamondBalanceAfter)',
        'diamondBalanceAfter',
      ]);
      if (missing.length) {
        return fail('Market purchase cannot clearly refresh visible Diamond totals.', {
          verification: 'STATIC_CONTRACT',
          files: ['src/pages/MainMenu.jsx', 'src/pages/MarketPage.jsx', 'base44/functions/purchaseJokerWithDiamonds/entry.ts'],
          missing,
        });
      }
      return pass('Home and Mağaza Diamond displays use User.diamonds and Mağaza patches the post-purchase total.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('diamond_ledger_differentiates_daily_and_market_sources',
    'DiamondTransaction differentiates Daily Wheel grants and Market spends',
    () => {
      const missing = missingTokens(`${diamondTransactionEntitySource}\n${diamondEconomySource}\n${economyRulesSource}`, [
        '"starter_bonus"',
        '"daily_login"',
        '"daily_wheel"',
        '"market_purchase"',
        'earn for granted Diamonds, spend for Mağaza purchases/costs',
        'Daily Wheel remains a Diamond source',
        'Mağaza purchase is a Diamond sink',
      ]);
      if (missing.length) {
        return fail('DiamondTransaction source/direction model no longer distinguishes grants from market spends.', {
          verification: 'STATIC_CONTRACT',
          missing,
        });
      }
      return pass('Diamond ledger source/direction contracts distinguish starter/daily/wheel grants from Mağaza market_purchase spends.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('market_partial_failure_reconciliation_is_documented',
    'Market partial-failure rollback/reconciliation risk is visible',
    () => {
      const missing = missingTokens(`${purchaseJokerWithDiamondsSource}\n${economyRulesSource}`, [
        'rollbackState',
        'market_ledger_write_failed',
        'Partial failure reconciliation',
        'best-effort rollback',
      ]);
      if (missing.length) {
        return fail('Market partial failure handling or documentation is incomplete.', {
          verification: 'STATIC_CONTRACT',
          files: ['base44/functions/purchaseJokerWithDiamonds/entry.ts', 'docs/KRONOX_ECONOMY_RULES.md'],
          missing,
        });
      }
      return pass('Market ledger write failure uses best-effort rollback and documents remaining reconciliation risk.', { verification: 'STATIC_CONTRACT' });
    }),
];
