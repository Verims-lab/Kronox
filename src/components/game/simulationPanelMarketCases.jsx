// Kronox Health Center — Mağaza Phase 1 contracts.
//
// Scope: Home entry, /market UI, server-backed Diamond-to-Solo-joker
// purchases, ledger writes, idempotency guards, and Phase 1 product boundary.

import mainMenuSource from '../../pages/MainMenu.jsx?raw';
import appSource from '../../App.jsx?raw';
import marketPageSource from '../../pages/MarketPage.jsx?raw';
import standardTopBarSource from '../layout/StandardTopBar.jsx?raw';
import marketSource from '../../lib/market.js?raw';
import economyGatewaySource from '../../lib/dbGateway/economyGateway.js?raw';
import purchaseJokerWithDiamondsSource from '../../../base44/functions/purchaseJokerWithDiamonds/entry.ts?raw';
import purchaseJokerWithDiamondsManifestSource from '../../../base44/functions/purchaseJokerWithDiamonds/function.jsonc?raw';
import diamondTransactionEntitySource from '../../../base44/entities/DiamondTransaction.jsonc?raw';
import jokerTransactionEntitySource from '../../../base44/entities/JokerTransaction.jsonc?raw';
import profilePageSource from '../../pages/ProfilePage.jsx?raw';
import gameSource from '../../pages/Game.jsx?raw';
import claimDailyWheelRewardSource from '../../../base44/functions/claimDailyWheelReward/entry.ts?raw';
import onlineChallengeSource from '../lobby/OnlineChallengeScreen.jsx?raw';
import lobbyGatewaySource from '../../lib/dbGateway/lobbyGateway.js?raw';
import { MARKET_JOKER_PRODUCTS } from '@/lib/market';

const STATUS = { PASS: 'PASS', FAIL: 'FAIL', NOT_AUTOMATABLE: 'NOT_AUTOMATABLE' };
const ACTION_TYPES = { CODE_FIX: 'CODE_FIX', MANUAL_VERIFY: 'MANUAL_VERIFY' };
const SUITE_ID = 'market_health';
const SUITE_NAME = 'Mağaza Phase 1 Suite';

function safeStr(source) {
  if (source == null) return '';
  if (typeof source === 'string') return source;
  try { return String(source); } catch { return ''; }
}

function missingTokens(source, tokens) {
  const src = safeStr(source);
  return tokens.filter((token) => !src.includes(token));
}

function forbiddenTokens(source, tokens) {
  const src = safeStr(source);
  return tokens.filter((token) => src.includes(token));
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
    nextStep: options.nextStep || 'Keep Mağaza server-backed, joker-only, Diamond-ledgered, and out of Online/Daily Wheel.',
    ...options,
    run,
  };
}

export const EXTRA_SUITES = [
  { id: SUITE_ID, name: SUITE_NAME, critical: true, color: '#facc15' },
];

export const EXTRA_TESTS = [
  makeCase('home_top_layout_has_market_diamond_notifications',
    'Home top layout has Mağaza left, Diamonds center, notifications right',
    () => {
      const missing = missingTokens(`${mainMenuSource}\n${standardTopBarSource}`, [
        'showMarket',
        'onMarket={handleMarket}',
        "navigate('/market')",
        'aria-label="Mağaza"',
        'ShoppingBag',
        'justify-center',
        'HeaderNotificationBell',
        'right: \'calc(env(safe-area-inset-right) + 0.75rem)\'',
        'aria-label={`Elmas: ${diamonds}`}',
      ]);
      if (missing.length) return fail('Home top layout does not clearly expose Mağaza left, Diamond center, notification right.', {
        verification: 'STATIC_CONTRACT',
        files: ['src/pages/MainMenu.jsx', 'src/components/layout/StandardTopBar.jsx'],
        missing,
      });
      return pass('Home uses the shared top bar with Mağaza left, centered Diamonds, and right notifications.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('market_route_and_screen_exist',
    'Mağaza screen/page exists on /market',
    () => {
      const missing = missingTokens(`${appSource}\n${marketPageSource}\n${purchaseJokerWithDiamondsManifestSource}\n${economyGatewaySource}`, [
        "lazyWithRetry(() => import('./pages/MarketPage'), 'MarketPage')",
        'path="/market"',
        'export default function MarketPage',
        'Mağaza',
        'MARKET_JOKER_PRODUCTS',
        '"name": "purchaseJokerWithDiamonds"',
        "base44.functions.invoke('purchaseJokerWithDiamonds'",
      ]);
      if (missing.length) return fail('Mağaza route/screen or backend function registration is incomplete.', {
        verification: 'STATIC_CONTRACT',
        missing,
      });
      return pass('Mağaza page and purchaseJokerWithDiamonds backend invocation are present.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('market_shows_exact_three_phase_1_joker_products',
    'Mağaza shows exactly the 3 Phase 1 joker products',
    () => {
      const names = MARKET_JOKER_PRODUCTS.map((product) => product.name);
      const types = MARKET_JOKER_PRODUCTS.map((product) => product.jokerType);
      const requiredNames = ['Zaman Dondur', 'Kart Değiştir', 'Kronokalkan'];
      const requiredTypes = ['time_freeze', 'card_swap', 'mistake_shield'];
      const missing = [
        ...requiredNames.filter((name) => !names.includes(name)),
        ...requiredTypes.filter((type) => !types.includes(type)),
      ];
      if (MARKET_JOKER_PRODUCTS.length !== 3 || missing.length) {
        return fail('Mağaza product list is not exactly the three Phase 1 Solo joker products.', {
          verification: 'EXECUTABLE_STATIC_CONTRACT',
          actual: { length: MARKET_JOKER_PRODUCTS.length, names, types, missing },
        });
      }
      return pass('Mağaza product list is exactly Zaman Dondur, Kart Değiştir, and Kronokalkan.', {
        verification: 'EXECUTABLE_STATIC_CONTRACT',
      });
    }),

  makeCase('market_prices_match_phase_1_contract',
    'Mağaza prices are 40/50/60 Diamonds',
    () => {
      const priceByType = Object.fromEntries(MARKET_JOKER_PRODUCTS.map((product) => [product.jokerType, product.price]));
      const ok = priceByType.time_freeze === 40 && priceByType.card_swap === 50 && priceByType.mistake_shield === 60;
      const backendMissing = missingTokens(purchaseJokerWithDiamondsSource, [
        "time_freeze: { jokerType: 'time_freeze', label: 'Zaman Dondur', price: 40 }",
        "card_swap: { jokerType: 'card_swap', label: 'Kart Değiştir', price: 50 }",
        "mistake_shield: { jokerType: 'mistake_shield', label: 'Kronokalkan', price: 60 }",
        'const diamondCost = product.price * quantity',
      ]);
      if (!ok || backendMissing.length) return fail('Market prices drifted from the Phase 1 contract or backend price table.', {
        verification: 'EXECUTABLE_STATIC_CONTRACT',
        actual: { priceByType, backendMissing },
      });
      return pass('Zaman Dondur=40, Kart Değiştir=50, Kronokalkan=60 in both UI and backend price table.', {
        verification: 'EXECUTABLE_STATIC_CONTRACT',
      });
    }),

  makeCase('client_does_not_control_trusted_price',
    'Client does not control trusted purchase price',
    () => {
      const missing = missingTokens(`${marketSource}\n${purchaseJokerWithDiamondsSource}`, [
        'clientPriceIgnored: true',
        'const diamondCost = product.price * quantity',
        'JOKER_MARKET_PRODUCTS',
      ]);
      const helperPayloadStart = safeStr(marketSource).indexOf('await invokePurchaseJokerWithDiamonds({');
      const helperPayloadEnd = safeStr(marketSource).indexOf('});', helperPayloadStart);
      const helperPayload = helperPayloadStart >= 0 && helperPayloadEnd > helperPayloadStart
        ? safeStr(marketSource).slice(helperPayloadStart, helperPayloadEnd)
        : '';
      const sendsPrice = helperPayload.includes('price') || helperPayload.includes('diamondCost');
      if (missing.length || sendsPrice) return fail('Client purchase helper appears to send or trust price.', {
        verification: 'STATIC_CONTRACT',
        actual: { missing, sendsPrice },
      });
      return pass('Client displays prices but backend computes trusted Diamond cost from its own product table.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('purchase_requires_auth_and_self_owned_backend',
    'Purchase requires authenticated self-owned user context',
    () => {
      const missing = missingTokens(purchaseJokerWithDiamondsSource, [
        'base44.auth.me()',
        'unauthenticated',
        '401',
        'const email = normalizeEmail(user?.email)',
        'user_email: email',
        'userEntity.update(latestUser.id || user.id',
      ]);
      if (missing.length) return fail('purchaseJokerWithDiamonds does not clearly bind purchase to authenticated user.', {
        verification: 'STATIC_CONTRACT',
        file: 'base44/functions/purchaseJokerWithDiamonds/entry.ts',
        missing,
      });
      return pass('Purchase function requires auth and writes user-owned rows for the requesting user.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('insufficient_diamonds_blocks_purchase',
    'Insufficient Diamonds blocks purchase with no successful ledger writes',
    () => {
      const source = safeStr(purchaseJokerWithDiamondsSource);
      const missing = missingTokens(source, [
        'diamondBefore < diamondCost',
        'insufficient_diamonds',
        'Yeterli elmas yok.',
      ]);
      const insufficientIdx = source.indexOf('diamondBefore < diamondCost');
      const updateIdx = source.indexOf('userEntity.update', insufficientIdx);
      const ledgerIdx = source.indexOf('createDiamondTransaction', insufficientIdx);
      const guardedBeforeWrites = insufficientIdx >= 0 && updateIdx > insufficientIdx && ledgerIdx > insufficientIdx;
      if (missing.length || !guardedBeforeWrites) return fail('Insufficient Diamond guard is missing or appears after writes.', {
        verification: 'STATIC_CONTRACT',
        actual: { missing, guardedBeforeWrites },
      });
      return pass('Purchase rejects insufficient Diamonds before balance or ledger writes.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('successful_purchase_updates_balances_and_ledgers',
    'Successful purchase decreases Diamonds, increases joker balance, and writes both ledgers',
    () => {
      const missing = missingTokens(`${purchaseJokerWithDiamondsSource}\n${diamondTransactionEntitySource}\n${jokerTransactionEntitySource}`, [
        'const diamondAfter = diamondBefore - diamondCost',
        'const jokerAfter = jokerBefore + quantity',
        'userEntity.update',
        'upsertInventory',
        'DiamondTransaction',
        'JokerTransaction',
        "source: DIAMOND_MARKET_PURCHASE_SOURCE",
        "direction: 'spend'",
        "reason: MARKET_PURCHASE_REASON",
        "source: MARKET_SOURCE",
        'quantity_delta: quantity',
        'balance_after: diamondAfter',
        'balance_after: jokerAfter',
        '"market_purchase"',
      ]);
      if (missing.length) return fail('Successful purchase balance/ledger contract is incomplete.', {
        verification: 'STATIC_CONTRACT',
        missing,
      });
      return pass('Successful purchase updates Diamond balance, joker balance, DiamondTransaction, and JokerTransaction.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('purchase_has_double_tap_idempotency_guard',
    'Purchase uses client pending state and backend idempotency guards',
    () => {
      const missing = missingTokens(`${marketPageSource}\n${marketSource}\n${purchaseJokerWithDiamondsSource}`, [
        'pendingType',
        'if (pendingType) return',
        'disabled={disabled}',
        'createMarketClientRequestId',
        'buildJokerPurchaseIdempotencyKey',
        'idempotencyKey',
        'findDiamondTransaction(base44, email, idempotencyKey)',
        'findJokerTransaction(base44, email, jokerType, idempotencyKey)',
        'alreadyApplied',
      ]);
      if (missing.length) return fail('Double-tap/idempotency protection is incomplete.', {
        verification: 'STATIC_CONTRACT',
        missing,
      });
      return pass('Client disables pending purchases and backend checks purchase idempotency keys.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('profile_and_solo_can_reflect_purchased_balances',
    'Profile and Solo joker counts can reflect purchased balances',
    () => {
      const missing = missingTokens(`${marketPageSource}\n${profilePageSource}\n${gameSource}`, [
        'setBalances(nextBalances)',
        'setUser((current) => ({',
        'getUserJokerBalances(user, { ensureStarter: true })',
        'getUserJokerBalances(currentUser, { ensureStarter: true })',
      ]);
      if (missing.length) return fail('Purchased balances are not refreshed in Market/Profile/Solo paths.', {
        verification: 'STATIC_CONTRACT',
        missing,
      });
      return pass('Market updates local counts, and Profile/Solo reread UserJokerInventory on mount.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('online_and_daily_wheel_unaffected',
    'Online mode and Daily Wheel remain unaffected by Mağaza',
    () => {
      const onlineForbidden = forbiddenTokens(`${onlineChallengeSource}\n${lobbyGatewaySource}`, [
        'purchaseJokerWithDiamonds',
        'UserJokerInventory',
        'JokerTransaction',
      ]);
      const dailyForbidden = forbiddenTokens(claimDailyWheelRewardSource, [
        'purchaseJokerWithDiamonds',
        'JokerTransaction',
        'UserJokerInventory',
        'market_purchase',
      ]);
      if (onlineForbidden.length || dailyForbidden.length) return fail('Market purchase leaked into Online or Daily Wheel paths.', {
        verification: 'STATIC_CONTRACT',
        actual: { onlineForbidden, dailyForbidden },
      });
      return pass('Online does not use market/joker purchases; Daily Wheel remains Diamond-only.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('phase_1_has_no_extra_market_products',
    'No bundles/subscriptions/cosmetics/random boxes are active in Phase 1',
    () => {
      const forbidden = forbiddenTokens(marketPageSource, [
        'bundle',
        'abonelik',
        'subscription',
        'avatar',
        'cosmetic',
        'random_box',
        'loot',
        'external payment',
      ]);
      if (forbidden.length) return fail('Mağaza page contains a non-Phase-1 product surface.', {
        verification: 'STATIC_CONTRACT',
        file: 'src/pages/MarketPage.jsx',
        forbidden,
      });
      return pass('Mağaza page contains only the three Phase 1 Solo joker products.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('market_runtime_race_proof_manual',
    'Real backend race/idempotency proof remains manual',
    () => notAutomatable('Static code verifies pending state, idempotency keys, and ledger writes. Real two-device double-tap/race proof requires a live Base44 backend run.', {
      verification: 'MANUAL_RUNTIME_PROOF_REQUIRED',
      classification: 'NOT_AUTOMATABLE',
      actionType: ACTION_TYPES.MANUAL_VERIFY,
      manualProof: [
        'Buy Zaman Dondur with enough Diamonds and confirm -40 Diamonds and +1 time_freeze.',
        'Confirm DiamondTransaction and JokerTransaction both exist with market_purchase and the same idempotency key.',
        'Double tap Satın Al and confirm a single charge/grant.',
        'Attempt purchase with insufficient Diamonds and confirm no state or successful ledger rows change.',
      ],
    }), { critical: false, actionType: ACTION_TYPES.MANUAL_VERIFY }),
];
