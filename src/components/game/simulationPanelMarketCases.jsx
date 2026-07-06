// Kronox Health Center — Mağaza / Store contracts.
//
// Scope: /market UI catalog, real-money no-fake-grant safety,
// server-backed Diamond-spend purchases, Hint inventory foundation, docs, and
// BottomNav/Home ownership boundaries.

import mainMenuSource from '../../pages/MainMenu.jsx?raw';
import appSource from '../../App.jsx?raw';
import marketPageSource from '../../pages/MarketPage.jsx?raw';
import standardTopBarSource from '../layout/StandardTopBar.jsx?raw';
import bottomNavSource from '../layout/BottomNav.jsx?raw';
import marketSource from '../../lib/market.js?raw';
import economyGatewaySource from '../../lib/dbGateway/economyGateway.js?raw';
import purchaseJokerWithDiamondsSource from '../../../base44/functions/purchaseJokerWithDiamonds/entry.ts?raw';
import purchaseJokerWithDiamondsManifestSource from '../../../base44/functions/purchaseJokerWithDiamonds/function.jsonc?raw';
import ensureUserHintInventorySource from '../../../base44/functions/ensureUserHintInventory/entry.ts?raw';
import consumeUserHintSource from '../../../base44/functions/consumeUserHint/entry.ts?raw';
import diamondTransactionEntitySource from '../../../base44/entities/DiamondTransaction.jsonc?raw';
import jokerTransactionEntitySource from '../../../base44/entities/JokerTransaction.jsonc?raw';
import userHintInventoryEntitySource from '../../../base44/entities/UserHintInventory.jsonc?raw';
import hintTransactionEntitySource from '../../../base44/entities/HintTransaction.jsonc?raw';
import { RELEASE_PROOF_CHECKLIST_DOC } from '@/lib/package2DocMirrors';
import { ECONOMY_RULES_DOC } from '@/lib/economyRulesDoc';
import claimDailyWheelRewardSource from '../../../base44/functions/claimDailyWheelReward/entry.ts?raw';
import onlineChallengeSource from '../lobby/OnlineChallengeScreen.jsx?raw';
import lobbyGatewaySource from '../../lib/dbGateway/lobbyGateway.js?raw';
import {
  MARKET_ADVANTAGE_PRODUCTS,
  MARKET_DIAMOND_PACKAGES,
  MARKET_FUTURE_PRODUCTS,
  MARKET_HINT_PRODUCTS,
  MARKET_JOKER_PRODUCTS,
  MARKET_PRICE_TYPES,
} from '@/lib/market';

const STATUS = { PASS: 'PASS', FAIL: 'FAIL', NOT_AUTOMATABLE: 'NOT_AUTOMATABLE' };
const ACTION_TYPES = { CODE_FIX: 'CODE_FIX', MANUAL_VERIFY: 'MANUAL_VERIFY' };
const SUITE_ID = 'market_health';
const SUITE_NAME = 'Mağaza / Store Health Suite';

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
    nextStep: options.nextStep || 'Keep Mağaza server-authoritative, no-fake-IAP, and out of Kronox Puan/Leaderboard.',
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
        'Store',
        'justify-center',
        'HeaderNotificationBell',
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
        'getMarketCatalogSections',
        '"name": "purchaseJokerWithDiamonds"',
        "base44.functions.invoke('purchaseJokerWithDiamonds'",
      ]);
      if (missing.length) return fail('Mağaza route/screen or backend function registration is incomplete.', {
        verification: 'STATIC_CONTRACT',
        missing,
      });
      return pass('Mağaza page and server-backed market purchase invocation are present.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('store_visual_style_and_scroll_contract',
    'Store uses requested scroll, gradient, glow, card, typography, and CTA tokens',
    () => {
      const missing = missingTokens(`${marketPageSource}\n${marketSource}`, [
        'overflow-y-auto',
        '#081327 0%, #0B1C38 45%, #081327 100%',
        'rgba(65,196,255,.08)',
        'rgba(12,24,48,.88)',
        'rgba(255,210,95,.18)',
        'clamp(1rem,2vw,1.4rem)',
        '"Barlow Condensed", "Arial Narrow", sans-serif',
        'text-white',
        '#FFD24A',
        '#C6CEDB',
        '#8FA3C4',
        'SATIN AL',
      ]);
      if (missing.length) return fail('Store visual contract tokens are missing from MarketPage.', {
        verification: 'STATIC_CONTRACT',
        file: 'src/pages/MarketPage.jsx',
        missing,
      });
      return pass('Store screen is scrollable and carries the approved premium visual tokens.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('real_money_diamond_packages_exact_display',
    'Real-money Diamond packages display exact amounts and prices',
    () => {
      const actual = MARKET_DIAMOND_PACKAGES.map((product) => ({
        id: product.id,
        title: product.title,
        displayPrice: product.displayPrice,
        unitPrice: product.unitPrice,
        badge: product.badge || '',
        priceType: product.priceType,
      }));
      const expected = [
        ['360 ELMAS', '₺79,99', '₺0,22', ''],
        ['1.100 ELMAS', '₺199,99', '₺0,18', 'EN POPÜLER'],
        ['2.400 ELMAS', '₺349,99', '₺0,15', ''],
        ['6.200 ELMAS', '₺799,99', '₺0,13', ''],
        ['13.000 ELMAS', '₺1.499,99', '₺0,12', 'EN İYİ DEĞER'],
      ];
      const ok = MARKET_DIAMOND_PACKAGES.length === expected.length
        && expected.every(([title, price, unit, badge]) => actual.some((product) => (
          product.title === title
          && product.displayPrice === price
          && product.unitPrice === unit
          && product.badge === badge
          && product.priceType === MARKET_PRICE_TYPES.REAL_MONEY
        )));
      if (!ok) return fail('Real-money Diamond package catalog drifted from the required display contract.', {
        verification: 'EXECUTABLE_STATIC_CONTRACT',
        actual,
      });
      return pass('All real-money Diamond packages, prices, unit prices, and badges match the requested catalog.', {
        verification: 'EXECUTABLE_STATIC_CONTRACT',
      });
    }),

  makeCase('real_money_buttons_do_not_grant_without_iap',
    'Real-money package buttons do not grant Diamonds without approved IAP',
    () => {
      const missing = missingTokens(`${marketSource}\n${marketPageSource}`, [
        'MARKET_REAL_MONEY_IAP_AVAILABLE = false',
        "reason: 'real_money_unavailable'",
        'Satın alma yakında aktif olacak.',
      ]);
      const grantPathSource = `${marketPageSource}\n${economyGatewaySource}\n${purchaseJokerWithDiamondsSource}`;
      // Narrowed to real fake-grant call patterns: the shared economy gateway
      // legitimately re-exports the bootstrap-only grantDiamondsOnce helper
      // for starter/daily grants, which is not reachable from Store buttons.
      const forbidden = forbiddenTokens(grantPathSource, [
        'diamonds_360',
        'client-side add Diamonds',
        'diamondBalanceAfter: diamonds +',
        "invoke('grantDiamonds",
        "invoke('adminGrantDiamonds",
        'grantDiamondsOnce(',
        'purchase_future',
      ]);
      if (missing.length || forbidden.length) return fail('Real-money catalog can fake a purchase or lacks unavailable gating.', {
        verification: 'STATIC_CONTRACT',
        actual: { missing, forbidden },
      });
      return pass('Real-money Diamond package buttons show unavailable feedback and never grant Diamonds in repo code.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('diamond_spend_catalog_contains_jokers_hints_advantages',
    'Diamond-spend catalog includes Joker, Hint, and Advantage packages',
    () => {
      const jokerOk = MARKET_JOKER_PRODUCTS.length === 9
        && MARKET_JOKER_PRODUCTS.some((p) => p.id === 'joker_mistake_shield_15' && p.diamondCost === 720)
        && MARKET_JOKER_PRODUCTS.some((p) => p.id === 'joker_time_freeze_5' && p.diamondCost === 180)
        && MARKET_JOKER_PRODUCTS.some((p) => p.id === 'joker_card_swap_15' && p.diamondCost === 600);
      const hintOk = MARKET_HINT_PRODUCTS.length === 3
        && MARKET_HINT_PRODUCTS.some((p) => p.id === 'hint_5' && p.diamondCost === 40)
        && MARKET_HINT_PRODUCTS.some((p) => p.id === 'hint_15' && p.diamondCost === 100)
        && MARKET_HINT_PRODUCTS.some((p) => p.id === 'hint_40' && p.diamondCost === 240);
      const advantageOk = MARKET_ADVANTAGE_PRODUCTS.length === 2
        && MARKET_ADVANTAGE_PRODUCTS.some((p) => p.id === 'advantage_starter' && p.diamondCost === 250 && p.grants.hints === 10)
        && MARKET_ADVANTAGE_PRODUCTS.some((p) => p.id === 'advantage_mega' && p.diamondCost === 1000 && p.grants.hints === 30);
      if (!jokerOk || !hintOk || !advantageOk) return fail('Diamond-spend product catalog is incomplete or incorrectly priced.', {
        verification: 'EXECUTABLE_STATIC_CONTRACT',
        actual: {
          jokers: MARKET_JOKER_PRODUCTS,
          hints: MARKET_HINT_PRODUCTS,
          advantages: MARKET_ADVANTAGE_PRODUCTS,
        },
      });
      return pass('Joker, Hint, and Advantage product catalogs match the requested Diamond prices.', { verification: 'EXECUTABLE_STATIC_CONTRACT' });
    }),

  makeCase('client_does_not_control_trusted_price_or_grant_items',
    'Client does not control trusted price or grant Store items',
    () => {
      const missing = missingTokens(`${marketSource}\n${purchaseJokerWithDiamondsSource}`, [
        'clientPriceIgnored: true',
        'const diamondCost = normalizeDiamondBalance(product.diamondCost)',
        'MARKET_DIAMOND_PRODUCTS',
        'productId: product.id',
      ]);
      const helperPayloadStart = safeStr(marketSource).indexOf('await invokePurchaseMarketProductWithDiamonds({');
      const helperPayloadEnd = safeStr(marketSource).indexOf('});', helperPayloadStart);
      const helperPayload = helperPayloadStart >= 0 && helperPayloadEnd > helperPayloadStart
        ? safeStr(marketSource).slice(helperPayloadStart, helperPayloadEnd)
        : '';
      const sendsTrustedPrice = helperPayload.includes('diamondCost') || helperPayload.includes('price');
      const forbidden = forbiddenTokens(marketSource, [
        'UserJokerInventory.create',
        'UserJokerInventory.update',
        'UserHintInventory.create',
        'UserHintInventory.update',
        'DiamondTransaction.create',
      ]);
      if (missing.length || sendsTrustedPrice || forbidden.length) return fail('Client purchase helper appears to send trusted price or directly mutate economy inventory.', {
        verification: 'STATIC_CONTRACT',
        actual: { missing, sendsTrustedPrice, forbidden },
      });
      return pass('Client sends productId/idempotency only; backend computes trusted Diamond cost and owns grants.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('diamond_spend_purchase_is_server_side_idempotent',
    'Diamond-spend purchases are server-side, idempotent, and no-partial by design',
    () => {
      const missing = missingTokens(`${purchaseJokerWithDiamondsSource}\n${diamondTransactionEntitySource}\n${jokerTransactionEntitySource}\n${hintTransactionEntitySource}`, [
        'base44.auth.me()',
        'const email = normalizeEmail(user?.email)',
        'diamondBefore < diamondCost',
        'withEconomyOperationLock',
        'findDiamondTransaction(base44, email, idempotencyKey)',
        'findGrantTransactions(base44, email, product, idempotencyKey)',
        'purchase_idempotency_partial',
        'duplicate_purchase_in_progress',
        'rollbackState',
        'DiamondTransaction',
        'JokerTransaction',
        'HintTransaction',
      ]);
      if (missing.length) return fail('Diamond-spend backend purchase safety/idempotency contract is incomplete.', {
        verification: 'STATIC_CONTRACT',
        file: 'base44/functions/purchaseJokerWithDiamonds/entry.ts',
        missing,
      });
      return pass('Backend validates auth/balance, uses economy locks/idempotency checks, and rolls back best-effort on ledger failure.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('hint_inventory_foundation_exists_and_gameplay_consumption_is_server_owned',
    'Hint inventory foundation exists and Solo gameplay Hint consumption is server-owned',
    () => {
      const missing = missingTokens(`${userHintInventoryEntitySource}\n${hintTransactionEntitySource}\n${purchaseJokerWithDiamondsSource}\n${ensureUserHintInventorySource}\n${consumeUserHintSource}`, [
        '"name": "UserHintInventory"',
        '"name": "HintTransaction"',
        'hintInventoryEntity',
        'hintTransactionEntity',
        'Hint inventory',
        'starter_grant',
        'solo_use',
        'STARTER_QUANTITY = 3',
        'consumeUserHint',
        'privateActorKeyReturned: false',
        'noKronoxPuan: true',
        'noLeaderboardImpact: true',
      ]);
      if (missing.length) return fail('Hint inventory foundation or server-owned gameplay consumption contract is incomplete.', {
        verification: 'STATIC_CONTRACT',
        actual: { missing },
      });
      return pass('Hint inventory/ledger supports Store grants plus server-owned Solo starter/consume paths without Kronox Puan or leaderboard impact.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('future_kronoclub_remove_ads_disabled',
    'KronoClub and Remove Ads are future/disabled',
    () => {
      const actual = MARKET_FUTURE_PRODUCTS.map((product) => ({
        id: product.id,
        priceType: product.priceType,
        available: product.available,
      }));
      const ok = actual.some((p) => p.id === 'krono_club_future' && p.available === false)
        && actual.some((p) => p.id === 'remove_ads_future' && p.available === false);
      const missing = missingTokens(`${marketSource}\n${marketPageSource}`, [
        'KronoClub',
        'REKLAMLARI KALDIR',
        "reason: 'future_feature'",
        'YAKINDA',
      ]);
      if (!ok || missing.length) return fail('Future real-money sections are missing or can look active.', {
        verification: 'EXECUTABLE_STATIC_CONTRACT',
        actual: { futureProducts: actual, missing },
      });
      return pass('KronoClub and Remove Ads are visible future sections with disabled/no-grant behavior.', { verification: 'EXECUTABLE_STATIC_CONTRACT' });
    }),

  makeCase('store_purchases_do_not_affect_puan_or_leaderboard',
    'Store purchases do not grant Kronox Puan or affect Leaderboard',
    () => {
      const missing = missingTokens(purchaseJokerWithDiamondsSource, [
        'noKronoxPuan: true',
        'noLeaderboardImpact: true',
        "source: DIAMOND_MARKET_PURCHASE_SOURCE",
        "direction: 'spend'",
      ]);
      const forbidden = forbiddenTokens(purchaseJokerWithDiamondsSource, [
        'kronox_puan_total',
        'total_kronox_score',
        'SoloLeaderboardEntry',
        'getSoloLeaderboard',
        'leaderboard',
      ]);
      if (missing.length || forbidden.length) return fail('Store purchase path can affect scoring/leaderboard or lacks explicit no-impact metadata.', {
        verification: 'STATIC_CONTRACT',
        actual: { missing, forbidden },
      });
      return pass('Market purchase writes Diamond spend/inventory ledgers only and carries no-Puan/no-Leaderboard metadata.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('home_bottomnav_contracts_remain_unchanged',
    'Home and BottomNav contracts remain unchanged',
    () => {
      const missing = missingTokens(`${bottomNavSource}\n${mainMenuSource}`, [
        'Ana Sayfa',
        'Liderlik',
        'Profil',
        'ONLINE KAPIŞ',
        "navigate('/market')",
      ]);
      // Inspect BottomNav TAB entries only — comments legitimately explain
      // that Online stays Home CTA-owned, so a whole-file 'Online' scan is
      // over-broad. Forbid actual tab label entries instead.
      const forbidden = forbiddenTokens(bottomNavSource, [
        "{ label: 'Mağaza'",
        "{ label: 'Market'",
        "{ label: 'Online'",
        "{ label: 'Günlük'",
        "{ label: 'GÜNLÜK'",
        "{ label: 'Çark'",
        "{ label: 'Admin'",
      ]);
      if (missing.length || forbidden.length) return fail('Store task changed BottomNav or Home Online ownership contracts.', {
        verification: 'STATIC_CONTRACT',
        actual: { missing, forbidden },
      });
      return pass('BottomNav remains Ana Sayfa/Liderlik/Profil and Store remains Home/top-bar reachable.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('online_daily_wheel_daily_quest_unaffected',
    'Online, Daily Wheel, and Daily Quest do not use Store purchase semantics',
    () => {
      const onlineForbidden = forbiddenTokens(`${onlineChallengeSource}\n${lobbyGatewaySource}`, [
        'purchaseJokerWithDiamonds',
        'UserHintInventory',
        'HintTransaction',
        'UserJokerInventory',
        'JokerTransaction',
      ]);
      const dailyForbidden = forbiddenTokens(claimDailyWheelRewardSource, [
        'purchaseJokerWithDiamonds',
        'market_purchase',
        'UserHintInventory',
      ]);
      if (onlineForbidden.length || dailyForbidden.length) return fail('Store purchase semantics leaked into Online or Daily Wheel paths.', {
        verification: 'STATIC_CONTRACT',
        actual: { onlineForbidden, dailyForbidden },
      });
      return pass('Online and Daily Wheel remain separate from Mağaza purchase semantics.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('economy_docs_capture_store_catalog_and_safety',
    'Docs lock Store catalog and purchase safety',
    () => {
      const missing = missingTokens(`${ECONOMY_RULES_DOC}\n${RELEASE_PROOF_CHECKLIST_DOC}`, [
        '360 ELMAS',
        '13.000 ELMAS',
        'Satın alma yakında aktif olacak',
        'HintTransaction',
        'UserHintInventory',
        'Advantage',
        'KronoClub',
        'Reklamları Kaldır',
        'Store purchases do not grant Kronox Puan',
        'Store purchases do not affect Leaderboard',
      ]);
      if (missing.length) return fail('Store economy/docs do not capture the expanded catalog and safety contract.', {
        verification: 'STATIC_CONTRACT',
        files: ['docs/KRONOX_ECONOMY_RULES.md', 'docs/KRONOX_RELEASE_PROOF_CHECKLIST.md'],
        missing,
      });
      return pass('Docs cover expanded Store catalog, real-money no-grant gating, server-owned Diamond spends, and no score/rank impact.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('market_runtime_race_and_visual_proof_manual',
    'Real backend race/idempotency and visual proof remain manual',
    () => notAutomatable('Static code verifies catalog, guarded real-money buttons, pending state, idempotency keys, ledger writes, and docs. Real payment/IAP proof, Base44 unique constraints, two-device Diamond-spend race proof, and pixel-level Store visual validation require a live deployed/mobile run.', {
      verification: 'MANUAL_RUNTIME_PROOF_REQUIRED',
      classification: 'NOT_AUTOMATABLE',
      actionType: ACTION_TYPES.MANUAL_VERIFY,
      manualProof: [
        'Open Mağaza on a 320px-class viewport and confirm vertical scroll, no horizontal overflow, target card layout, badges, and safe BottomNav spacing.',
        'Tap a real-money Diamond package and confirm no Diamonds are granted and unavailable copy appears.',
        'Buy each Diamond-spend product class with enough Diamonds and confirm server-side Diamond decrease plus inventory increase.',
        'Attempt insufficient-Diamond purchase and confirm no state or successful ledger rows change.',
        'Double tap/retry from two tabs/devices and confirm no duplicate charge/grant.',
      ],
    }), { critical: false, actionType: ACTION_TYPES.MANUAL_VERIFY }),
];