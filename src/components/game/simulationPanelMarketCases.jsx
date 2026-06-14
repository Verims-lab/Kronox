// Kronox Health Center — Mağaza Phase 1 contracts.
//
// Scope: Home entry, /market UI, server-backed Diamond-to-Solo-joker
// purchases, ledger writes, idempotency guards, and Phase 1 product boundary.

import mainMenuSource from '../../pages/MainMenu.jsx?raw';
import appSource from '../../App.jsx?raw';
import marketPageSource from '../../pages/MarketPage.jsx?raw';
import standardTopBarSource from '../layout/StandardTopBar.jsx?raw';
import bottomNavSource from '../layout/BottomNav.jsx?raw';
import marketSource from '../../lib/market.js?raw';
import economyGatewaySource from '../../lib/dbGateway/economyGateway.js?raw';
import purchaseJokerWithDiamondsSource from '../../../base44/functions/purchaseJokerWithDiamonds/entry.ts?raw';
import purchaseJokerWithDiamondsManifestSource from '../../../base44/functions/purchaseJokerWithDiamonds/function.jsonc?raw';
import diamondTransactionEntitySource from '../../../base44/entities/DiamondTransaction.jsonc?raw';
import jokerTransactionEntitySource from '../../../base44/entities/JokerTransaction.jsonc?raw';
import { RELEASE_PROOF_CHECKLIST_DOC } from '@/lib/package2DocMirrors';
import { ECONOMY_RULES_DOC } from '@/lib/economyRulesDoc';
import profilePageSource from '../../pages/ProfilePage.jsx?raw';
import gameSource from '../../pages/Game.jsx?raw';
import claimDailyWheelRewardSource from '../../../base44/functions/claimDailyWheelReward/entry.ts?raw';
import onlineChallengeSource from '../lobby/OnlineChallengeScreen.jsx?raw';
import lobbyGatewaySource from '../../lib/dbGateway/lobbyGateway.js?raw';
import { MARKET_JOKER_PRODUCTS } from '@/lib/market';

const STATUS = { PASS: 'PASS', FAIL: 'FAIL', NOT_AUTOMATABLE: 'NOT_AUTOMATABLE' };
const ACTION_TYPES = { CODE_FIX: 'CODE_FIX', MANUAL_VERIFY: 'MANUAL_VERIFY' };
const SUITE_ID = 'market_health';
const SUITE_NAME = 'Mağaza / Market Health Suite';

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

  makeCase('market_mobile_page_navigation_contract',
    'Mağaza is a mobile-safe page with consistent navigation',
    () => {
      const missing = missingTokens(`${marketPageSource}\n${bottomNavSource}\n${appSource}`, [
        'min-h-screen',
        'max-w-md',
        'flex flex-col gap-3',
        'showBack',
        "navigate('/')",
        'aria-label="Mağaza ürünleri"',
        "const HIDDEN_ROUTES = ['/game']",
        'path="/market"',
      ]);
      const forbidden = forbiddenTokens(marketPageSource, [
        '<Dialog',
        '<Modal',
        'fixed inset-0 overflow-y-auto',
      ]);
      if (missing.length || forbidden.length) return fail('Mağaza is not clearly a mobile-safe top-level page or has fragile modal/nested-scroll tokens.', {
        verification: 'STATIC_CONTRACT',
        files: ['src/pages/MarketPage.jsx', 'src/components/layout/BottomNav.jsx', 'src/App.jsx'],
        actual: { missing, forbidden },
      });
      return pass('Mağaza is a full page with back navigation and follows the existing bottom-nav hide-by-route rules.', { verification: 'STATIC_CONTRACT' });
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

  makeCase('market_product_cards_include_price_cta_owned_count_feedback',
    'Product cards include price, owned count, CTA, and safe feedback',
    () => {
      const missing = missingTokens(marketPageSource, [
        'ownedCount',
        'x{ownedCount}',
        '{product.price}',
        'Satın Al',
        'İşleniyor',
        'Yeterli elmas yok',
        'Satın alma tamamlanamadı. Tekrar dene.',
        "setNotice({ type: 'success'",
        "setNotice({ type: 'error'",
        '${product.name} alındı.',
      ]);
      const forbidden = forbiddenTokens(marketPageSource, [
        'error?.message',
        'stack',
      ]);
      if (missing.length || forbidden.length) return fail('Market cards lack price/CTA/count/feedback contract or can expose raw errors.', {
        verification: 'STATIC_CONTRACT',
        file: 'src/pages/MarketPage.jsx',
        actual: { missing, forbidden },
      });
      return pass('Product cards show owned counts, prices, reachable purchase CTAs, and controlled success/failure feedback.', { verification: 'STATIC_CONTRACT' });
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
        'updateCurrentUser(base44',
        'entities.UserJokerInventory',
        'entities.DiamondTransaction',
        'entities.JokerTransaction',
      ]);
      if (missing.length) return fail('purchaseJokerWithDiamonds does not clearly bind purchase to authenticated user.', {
        verification: 'STATIC_CONTRACT',
        file: 'base44/functions/purchaseJokerWithDiamonds/entry.ts',
        missing,
      });
      return pass('Purchase function requires auth and writes user-owned rows for the requesting user.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('purchase_validates_joker_type_quantity_and_safe_errors',
    'Purchase validates joker type/quantity and returns safe errors',
    () => {
      const missing = missingTokens(purchaseJokerWithDiamondsSource, [
        'normalizeJokerType',
        'invalid_joker_type',
        'parsePurchaseQuantity',
        'number <= 0',
        'invalid_quantity',
        'missing_idempotency_key',
        'market_purchase_failed',
        'Satın alma tamamlanamadı. Tekrar dene.',
      ]);
      const forbidden = forbiddenTokens(purchaseJokerWithDiamondsSource, [
        'body?.price',
        'body?.diamondCost',
        'stack: error',
        'error: error.message',
        'user_email: body',
      ]);
      if (missing.length || forbidden.length) return fail('Purchase validation/safe-error contract is incomplete.', {
        verification: 'STATIC_CONTRACT',
        file: 'base44/functions/purchaseJokerWithDiamonds/entry.ts',
        actual: { missing, forbidden },
      });
      return pass('Purchase rejects invalid joker types, zero/negative quantities, missing idempotency, and avoids raw error/secret exposure.', { verification: 'STATIC_CONTRACT' });
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
      const updateIdx = source.indexOf('updateCurrentUser', insufficientIdx);
      const ledgerIdx = source.indexOf('createDiamondTransaction', insufficientIdx);
      const guardedBeforeWrites = insufficientIdx >= 0 && updateIdx > insufficientIdx && ledgerIdx > insufficientIdx;
      if (missing.length || !guardedBeforeWrites) return fail('Insufficient Diamond guard is missing or appears after writes.', {
        verification: 'STATIC_CONTRACT',
        actual: { missing, guardedBeforeWrites },
      });
      return pass('Purchase rejects insufficient Diamonds before balance or ledger writes.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('purchase_cannot_make_negative_balances',
    'Purchase cannot reduce Diamonds below zero or create negative joker balances',
    () => {
      const missing = missingTokens(`${purchaseJokerWithDiamondsSource}\n${diamondTransactionEntitySource}\n${jokerTransactionEntitySource}`, [
        'diamondBefore < diamondCost',
        'const diamondAfter = diamondBefore - diamondCost',
        'const jokerAfter = jokerBefore + quantity',
        'JOKER_NON_NEGATIVE_BALANCE_CONTRACT',
        '"minimum": 0',
        'normalizeDiamondBalance',
        'normalizeQuantity',
      ]);
      if (missing.length) return fail('Purchase non-negative economy contract is incomplete.', {
        verification: 'STATIC_CONTRACT',
        missing,
      });
      return pass('Purchase has a pre-spend Diamond guard and non-negative balance normalization contracts.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('successful_purchase_updates_balances_and_ledgers',
    'Successful purchase decreases Diamonds, increases joker balance, and writes both ledgers',
    () => {
      const missing = missingTokens(`${purchaseJokerWithDiamondsSource}\n${diamondTransactionEntitySource}\n${jokerTransactionEntitySource}`, [
        'const diamondAfter = diamondBefore - diamondCost',
        'const jokerAfter = jokerBefore + quantity',
        'updateCurrentUser',
        'upsertInventory',
        'DiamondTransaction',
        'JokerTransaction',
        'entities.UserJokerInventory',
        'entities.DiamondTransaction',
        'entities.JokerTransaction',
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

  makeCase('purchase_result_and_ledgers_share_purchase_key',
    'Purchase result exposes safe summary and both ledgers share purchase id',
    () => {
      const missing = missingTokens(purchaseJokerWithDiamondsSource, [
        'related_entity_type: RELATED_ENTITY_TYPE',
        'related_entity_id: idempotencyKey',
        'idempotency_key: idempotencyKey',
        'diamondBalanceAfter',
        'jokerBalanceAfter',
        'jokerType',
        'diamondCost',
        'purchaseId: idempotencyKey',
        'diamondTransactionId',
        'jokerTransactionId',
      ]);
      if (missing.length) return fail('Purchase result/ledger correlation contract is incomplete.', {
        verification: 'STATIC_CONTRACT',
        file: 'base44/functions/purchaseJokerWithDiamonds/entry.ts',
        missing,
      });
      return pass('DiamondTransaction, JokerTransaction, and safe response diagnostics all carry the same purchase/idempotency key.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('purchase_has_double_tap_idempotency_guard',
    'Purchase uses client pending state and backend idempotency guards',
    () => {
      const missing = missingTokens(`${marketPageSource}\n${marketSource}\n${purchaseJokerWithDiamondsSource}`, [
        'pendingType',
        'if (pendingType) return',
        'disabled={disabled}',
        'createMarketClientRequestId',
        'safeMarketPurchaseError',
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

  makeCase('retry_cannot_double_charge_or_double_grant',
    'Retry/idempotency contract prevents double-charge and double-grant drift',
    () => {
      const missing = missingTokens(purchaseJokerWithDiamondsSource, [
        'if (existingDiamondTx && existingJokerTx)',
        'alreadyApplied: true',
        'if (existingDiamondTx || existingJokerTx)',
        'purchase_idempotency_partial',
        'secondExistingDiamondTx',
        'secondExistingJokerTx',
        'duplicate_purchase_in_progress',
        'rollbackState',
        'market_ledger_write_failed',
      ]);
      if (missing.length) return fail('Retry/partial-failure idempotency handling is incomplete.', {
        verification: 'STATIC_CONTRACT',
        file: 'base44/functions/purchaseJokerWithDiamonds/entry.ts',
        missing,
      });
      return pass('Retries return an already-applied result only when both ledgers exist, partial idempotency states fail closed, and ledger write failure rolls back best-effort.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('profile_and_solo_can_reflect_purchased_balances',
    'Profile and Solo joker counts can reflect purchased balances',
    () => {
      const missing = missingTokens(`${marketPageSource}\n${profilePageSource}\n${gameSource}\n${marketSource}`, [
        'setBalances(nextBalances)',
        'setUser((current) => ({',
        'setCachedJokerBalances(email, balances',
        "invalidatedBy: 'market_purchase'",
        'getUserJokerBalances(user, { ensureStarter: false, forceRefresh: jokerReloadKey > 0 })',
        'ensureStarterJokers(user, { forceEnsure: true, forceRefresh: jokerReloadKey > 0 })',
        'getUserJokerBalances(currentUser, { ensureStarter: true })',
      ]);
      if (missing.length) return fail('Purchased balances are not refreshed in Market/Profile/Solo paths.', {
        verification: 'STATIC_CONTRACT',
        missing,
      });
      return pass('Market updates local counts and the shared cache, while Profile/Solo reread UserJokerInventory through the shared helper.', { verification: 'STATIC_CONTRACT' });
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

  makeCase('economy_docs_capture_source_sink_and_research_principles',
    'Docs lock source/sink, server-authoritative pricing, ledgers, and idempotency principles',
    () => {
      const missing = missingTokens(`${ECONOMY_RULES_DOC}\n${RELEASE_PROOF_CHECKLIST_DOC}`, [
        'Diamond source/sink balance',
        'server-authoritative',
        'Client is not trusted for price',
        'idempotency key',
        'double-tap',
        'network retry',
        'both `DiamondTransaction` and `JokerTransaction`',
        'two tabs/devices',
      ]);
      if (missing.length) return fail('Market economy/docs do not capture the researched purchase-integrity principles.', {
        verification: 'STATIC_CONTRACT',
        files: ['docs/KRONOX_ECONOMY_RULES.md', 'docs/KRONOX_RELEASE_PROOF_CHECKLIST.md'],
        missing,
      });
      return pass('Docs cover Mağaza as a Diamond sink with server-authoritative price, dual ledgers, idempotency, and manual race proof.', { verification: 'STATIC_CONTRACT' });
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
        'Retry the same request after a network interruption and confirm no double-charge or double-grant.',
        'Attempt purchase with insufficient Diamonds and confirm no state or successful ledger rows change.',
        'Repeat from two tabs/devices if possible; this is the real backend race proof static Health cannot automate.',
      ],
    }), { critical: false, actionType: ACTION_TYPES.MANUAL_VERIFY }),
];
