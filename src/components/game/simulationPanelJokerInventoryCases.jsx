// Kronox Health Center — Joker Inventory contracts.
//
// Scope: user-owned joker balance foundation, starter grant idempotency,
// Profile Joker Çantası display, Phase 2 Solo spending, and Mağaza catalog boundaries.

import userJokerInventoryEntitySource from '../../../base44/entities/UserJokerInventory.jsonc?raw';
import jokerTransactionEntitySource from '../../../base44/entities/JokerTransaction.jsonc?raw';
import economyOperationLockEntitySource from '../../../base44/entities/EconomyOperationLock.jsonc?raw';
import ensureUserJokerInventorySource from '../../../base44/functions/ensureUserJokerInventory/entry.ts?raw';
import ensureUserJokerInventoryManifestSource from '../../../base44/functions/ensureUserJokerInventory/function.jsonc?raw';
import spendUserJokerSource from '../../../base44/functions/spendUserJoker/entry.ts?raw';
import spendUserJokerManifestSource from '../../../base44/functions/spendUserJoker/function.jsonc?raw';
import jokerInventorySource from '../../lib/jokerInventory.js?raw';
import hintInventorySource from '../../lib/hintInventory.js?raw';
import jokerInventorySpendMergeSource from '../../lib/jokerInventorySpendMerge.js?raw';
import authContextSource from '../../lib/AuthContext.jsx?raw';
import profilePageSource from '../../pages/ProfilePage.jsx?raw';
import mainMenuSource from '../../pages/MainMenu.jsx?raw';
import marketPageSource from '../../pages/MarketPage.jsx?raw';
import marketSource from '../../lib/market.js?raw';
import purchaseJokerWithDiamondsSource from '../../../base44/functions/purchaseJokerWithDiamonds/entry.ts?raw';
import soloJokerBarSource from './SoloJokerBar.jsx?raw';
import gameSource from '../../pages/Game.jsx?raw';
import claimDailyWheelRewardSource from '../../../base44/functions/claimDailyWheelReward/entry.ts?raw';
import userHintInventoryEntitySource from '../../../base44/entities/UserHintInventory.jsonc?raw';
import hintTransactionEntitySource from '../../../base44/entities/HintTransaction.jsonc?raw';
import { runJokerSpendMergeMatrix } from '@/lib/jokerInventorySpendMerge';

const STATUS = { PASS: 'PASS', FAIL: 'FAIL', NOT_AUTOMATABLE: 'NOT_AUTOMATABLE' };
const ACTION_TYPES = { CODE_FIX: 'CODE_FIX', MANUAL_VERIFY: 'MANUAL_VERIFY' };
const SUITE_ID = 'joker_inventory_health';
const SUITE_NAME = 'Joker Inventory Suite';

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
    nextStep: options.nextStep || 'Keep joker inventory user-owned, idempotent, ledger-backed, Solo-only for usage, and Mağaza Diamond purchases server-authoritative.',
    ...options,
    run,
  };
}

export const EXTRA_SUITES = [
  { id: SUITE_ID, name: SUITE_NAME, critical: true, color: '#f59e0b' },
];

export const EXTRA_TESTS = [
  makeCase('user_joker_inventory_entity_exists',
    'UserJokerInventory entity exists with user/type/quantity fields',
    () => {
      const missing = missingTokens(userJokerInventoryEntitySource, [
        '"name": "UserJokerInventory"',
        '"user_email"',
        '"joker_type"',
        '"quantity"',
        '"minimum": 0',
        '"mistake_shield"',
        '"card_swap"',
        '"time_freeze"',
        '"data.user_email": "{{user.email}}"',
      ]);
      if (missing.length) return fail('UserJokerInventory schema is missing the user-owned balance contract.', {
        verification: 'STATIC_CONTRACT',
        file: 'base44/entities/UserJokerInventory.jsonc',
        missing,
      });
      return pass('UserJokerInventory exists as a user-owned non-negative joker balance entity.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('joker_transaction_entity_exists',
    'JokerTransaction ledger exists with starter and future reason fields',
    () => {
      const missing = missingTokens(jokerTransactionEntitySource, [
        '"name": "JokerTransaction"',
        '"quantity_delta"',
        '"starter_grant"',
        '"admin_adjustment"',
        '"solo_use"',
        '"market_purchase"',
        '"idempotency_key"',
        '"balance_after"',
        '"created_by"',
      ]);
      if (missing.length) return fail('JokerTransaction schema is missing ledger/idempotency fields.', {
        verification: 'STATIC_CONTRACT',
        file: 'base44/entities/JokerTransaction.jsonc',
        missing,
      });
      return pass('JokerTransaction ledger exists with starter and future transaction reason contracts.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('joker_types_are_stable',
    'Joker types use stable internal enum values and Turkish labels',
    () => {
      const combined = `${jokerInventorySource}\n${ensureUserJokerInventorySource}`;
      const missing = missingTokens(combined, [
        'mistake_shield',
        'card_swap',
        'time_freeze',
        'Kronokalkan',
        'Kart Değiştir',
        'Zamanı Dondur',
      ]);
      if (missing.length) return fail('Stable joker type values or player-facing labels drifted.', {
        verification: 'STATIC_CONTRACT',
        files: ['src/lib/jokerInventory.js', 'base44/functions/ensureUserJokerInventory/entry.ts'],
        missing,
      });
      return pass('Internal joker types and Turkish labels are stable.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('starter_grant_gives_three_each',
    'Starter grant gives 3 of each joker',
    () => {
      const missing = missingTokens(`${jokerInventorySource}\n${ensureUserJokerInventorySource}`, [
        'STARTER_JOKER_QUANTITY = 3',
        'const STARTER_QUANTITY = 3',
        'balanceAfter = Math.max(currentQuantity, STARTER_QUANTITY)',
        'mistake_shield',
        'card_swap',
        'time_freeze',
      ]);
      if (missing.length) return fail('Starter grant no longer clearly initializes 3 of each joker.', {
        verification: 'STATIC_CONTRACT',
        missing,
      });
      return pass('Starter grant contract initializes 3 Kronokalkan, 3 Kart Değiştir, and 3 Zamanı Dondur.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('starter_grant_is_idempotent',
    'Starter grant uses per-user/per-type idempotency keys and existing transaction checks',
    () => {
      const missing = missingTokens(`${jokerInventorySource}\n${ensureUserJokerInventorySource}`, [
        'starter_jokers',
        'buildStarterJokerIdempotencyKey',
        'buildStarterIdempotencyKey',
        'findStarterTransaction',
        'createStarterTransaction',
        'alreadyGranted',
      ]);
      if (missing.length) return fail('Starter grants are missing idempotency/recovery contracts.', {
        verification: 'STATIC_CONTRACT',
        missing,
      });
      return pass('Starter grants use per-user/per-joker idempotency and existing transaction checks.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('missing_inventory_self_heals',
    'Missing or partial UserJokerInventory self-heals for authenticated users',
    () => {
      const missing = missingTokens(`${jokerInventorySource}\n${ensureUserJokerInventorySource}`, [
        'JOKER_INVENTORY_SELF_HEAL_CONTRACT',
        'Missing UserJokerInventory self-heals for authenticated users.',
        'Partial inventory rows self-heal missing joker types.',
        'selfHealedMissingOrPartialInventory',
        'findInventoryRows',
        'findLatestJokerTransaction',
        'selfHealed',
      ]);
      if (missing.length) return fail('Missing/partial joker inventory self-heal contract is incomplete.', {
        verification: 'STATIC_CONTRACT',
        files: ['src/lib/jokerInventory.js', 'base44/functions/ensureUserJokerInventory/entry.ts'],
        missing,
      });
      return pass('Missing/partial UserJokerInventory rows are repaired through the authenticated ensure path.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('existing_balances_preserved_during_ensure',
    'Ensure preserves existing balances and avoids duplicate-row crashes',
    () => {
      const missing = missingTokens(`${jokerInventorySource}\n${ensureUserJokerInventorySource}`, [
        'Existing joker balances are preserved',
        'Duplicate or malformed UserJokerInventory rows do not crash Joker Çantası.',
        'maxKnownInventoryQuantity',
        'duplicateRowsIgnored',
        'ledgerRecoveredQuantity',
        'balances[type] = Math.max(balances[type], normalizeJokerQuantity',
      ]);
      if (missing.length) return fail('Ensure can overwrite balances or let duplicate/corrupt rows break the loader.', {
        verification: 'STATIC_CONTRACT',
        files: ['src/lib/jokerInventory.js', 'base44/functions/ensureUserJokerInventory/entry.ts'],
        missing,
      });
      return pass('Ensure keeps the highest known balance, ignores duplicates safely, and reconstructs from ledger when needed.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('profile_joker_cantasi_waits_and_retries',
    'Profile Joker Çantası waits for auth/user and offers retry on real error',
    () => {
      const missing = missingTokens(profilePageSource, [
        'authLoading={loading}',
        'loading={jokerState.loading}',
        'getUserJokerBalances(user, {',
        'guestCredentials,',
        'ensureStarter: false',
        'forceRefresh: jokerReloadKey > 0',
        'ensureStarterJokers(user, { forceEnsure: true, forceRefresh: jokerReloadKey > 0 })',
        'Joker Çantası şu anda yüklenemedi.',
        'setJokerReloadKey',
        'Tekrar Dene',
      ]);
      if (missing.length) return fail('Profile Joker Çantası can show a permanent error before retryable ensure/load completes.', {
        verification: 'STATIC_CONTRACT',
        file: 'src/pages/ProfilePage.jsx',
        missing,
      });
      return pass('Profile shows fast inventory rows first, self-heals missing rows in the background, retries safely, and uses generic Turkish error copy.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('joker_inventory_fast_read_before_self_heal',
    'Profile/Solo balance helper reads UserJokerInventory before self-heal',
    () => {
      const missing = missingTokens(jokerInventorySource, [
        'JOKER_INVENTORY_FAST_LOAD_CONTRACT',
        'Profile and Solo read current balances from UserJokerInventory before self-heal.',
        'JokerTransaction is ledger only and is not scanned during render-time balance reads.',
        'Profile Joker Çantası renders the fast UserJokerInventory result before background self-heal refresh.',
        'completeKnownInventoryRows(rows)',
        'ensureSkipped: true',
        'queryPath: \'UserJokerInventory.fast_read\'',
        "'ensureUserJokerInventory'",
      ]);
      if (missing.length) return fail('Joker balance helper can still run heavy starter/self-heal before reading current balances.', {
        verification: 'STATIC_CONTRACT',
        file: 'src/lib/jokerInventory.js',
        missing,
      });
      return pass('Joker balances now use a fast UserJokerInventory read and only invoke self-heal for missing/partial rows.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('joker_inventory_reconciliation_helper_exists',
    'Joker inventory and ledger can be reconciled without mutation',
    () => {
      const missing = missingTokens(jokerInventorySource, [
        'buildJokerInventoryLedgerReconciliation',
        'ledgerSummedDelta',
        'latestBalanceAfter',
        'matchesLatestLedger',
        'matchesDeltaSum',
        'mismatches: rows.filter',
      ]);
      if (missing.length) return fail('Joker inventory/ledger reconciliation helper is missing or not diagnostic-only.', {
        verification: 'STATIC_CONTRACT',
        file: 'src/lib/jokerInventory.js',
        missing,
      });
      return pass('A non-destructive helper can compare UserJokerInventory balances against JokerTransaction ledger totals/latest balance.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('joker_economy_unique_and_idempotency_guards',
    'Joker inventory and ledger have logical unique/idempotency guards',
    () => {
      const combined = `${userJokerInventoryEntitySource}\n${jokerTransactionEntitySource}\n${jokerInventorySource}\n${ensureUserJokerInventorySource}\n${purchaseJokerWithDiamondsSource}\n${spendUserJokerSource}`;
      const missing = missingTokens(combined, [
        'JOKER_ECONOMY_INDEX_GUARD_CONTRACT',
        'UserJokerInventory logical unique key is user_email + joker_type.',
        'JokerTransaction logical unique key is idempotency_key when present.',
        'user_email + joker_type',
        'idempotency_key is the logical unique duplicate-protection key',
        'filter({ user_email: email, joker_type: jokerType }',
        'filter({ user_email: email, joker_type: jokerType, idempotency_key: idempotencyKey }',
        'findJokerTransaction',
        'findTransaction',
        'Math.max(balances[type], normalizeQuantity',
        'duplicateRowsIgnored',
      ]);
      if (missing.length) return fail('Joker balance or ledger duplicate/idempotency protection contract is incomplete.', {
        verification: 'STATIC_CONTRACT',
        files: [
          'base44/entities/UserJokerInventory.jsonc',
          'base44/entities/JokerTransaction.jsonc',
          'base44/functions/ensureUserJokerInventory/entry.ts',
          'base44/functions/purchaseJokerWithDiamonds/entry.ts',
          'base44/functions/spendUserJoker/entry.ts',
          'src/lib/jokerInventory.js',
        ],
        missing,
      });
      return pass('Joker inventory uses user+joker logical uniqueness, ledger writes use idempotency lookup, and duplicate balance rows are tolerated safely.', {
        verification: 'STATIC_CONTRACT',
      });
    }),

  makeCase('solo_joker_spend_uses_economy_lock',
    'Normal Solo joker spend is protected by the economy operation lock',
    () => {
      const combined = `${economyOperationLockEntitySource}\n${spendUserJokerSource}\n${purchaseJokerWithDiamondsSource}\n${jokerTransactionEntitySource}`;
      const missing = missingTokens(combined, [
        '"name": "EconomyOperationLock"',
        '"operation_scope"',
        'economy_parallel_race_guard_phase_1',
        'withEconomyOperationLock',
        'buildEconomyLockKey(email)',
        "operationScope: 'solo_joker_spend'",
        'guidedTutorialSpendBypass: false',
        'const secondExistingTransaction = await findTransaction',
        'const inventory = await findInventory(base44, email, jokerType)',
        'const insufficientBalance = quantityBefore <= 0',
        'const balanceAfter = quantityBefore - 1',
        'balance_after: balanceAfter',
      ]);
      if (missing.length) return fail('Solo joker spend can still race or bypass the non-negative inventory contract.', {
        verification: 'STATIC_CONTRACT',
        files: [
          'base44/entities/EconomyOperationLock.jsonc',
          'base44/functions/spendUserJoker/entry.ts',
          'base44/functions/purchaseJokerWithDiamonds/entry.ts',
        ],
        missing,
      });
      return pass('Normal Solo joker spend uses the shared player economy lock and rechecks idempotency/inventory before decrementing.', {
        verification: 'STATIC_CONTRACT',
      });
    }),

  makeCase('joker_inventory_query_path_is_shared_and_cached',
    'Profile, Solo, and Market share one cached balance helper path',
    () => {
      const missing = missingTokens(`${jokerInventorySource}\n${profilePageSource}\n${gameSource}\n${marketSource}`, [
        'JOKER_INVENTORY_CACHE_TTL_MS',
        'jokerBalanceCache',
        'jokerBalanceInflight',
        'cacheKeyUserScoped',
        'clearJokerInventoryCache',
        'setCachedJokerBalances',
        'getUserJokerBalances(user, {',
        'guestCredentials,',
        'ensureStarter: false',
        'forceRefresh: jokerReloadKey > 0',
        'ensureStarterJokers(user, { forceEnsure: true, forceRefresh: jokerReloadKey > 0 })',
        'getUserJokerBalances(currentUser, {',
        'ensureStarter: true',
      ]);
      if (missing.length) return fail('Joker inventory loads are not clearly shared, cached, and user-scoped.', {
        verification: 'STATIC_CONTRACT',
        files: ['src/lib/jokerInventory.js', 'src/pages/ProfilePage.jsx', 'src/pages/Game.jsx', 'src/lib/market.js'],
        missing,
      });
      return pass('Profile, Solo, and Market use the shared getUserJokerBalances path with a normalized per-user cache and in-flight de-dupe.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('joker_inventory_render_path_does_not_scan_ledger',
    'Profile render-time balances do not scan JokerTransaction ledger',
    () => {
      const renderSources = `${profilePageSource}\n${jokerInventorySource}`;
      const forbidden = forbiddenTokens(profilePageSource, [
        'JokerTransaction',
        'balance_after',
        'quantity_delta',
      ]);
      const missing = missingTokens(renderSources, [
        'UserJokerInventory',
        'readOwnInventoryRows',
        'JokerTransaction is ledger only and is not scanned during render-time balance reads.',
      ]);
      if (missing.length || forbidden.length) return fail('Profile can still calculate balances from ledger rows instead of current inventory rows.', {
        verification: 'STATIC_CONTRACT',
        actual: { missing, forbidden },
      });
      return pass('Profile render path reads current UserJokerInventory balances and does not expose or scan JokerTransaction.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('joker_inventory_cache_invalidates_after_mutations',
    'Market purchase and Solo spend refresh the shared joker balance cache',
    () => {
      const missing = missingTokens(`${jokerInventorySource}\n${marketSource}\n${authContextSource}`, [
        'setCachedJokerBalances(email, normalized.balances',
        'setCachedJokerBalances(actorCacheKey, result.balances',
        "invalidatedBy: 'market_purchase'",
        "invalidatedBy: 'solo_spend'",
        'invalidateJokerInventoryCache(actorCacheKey)',
        'clearJokerInventoryCache();',
      ]);
      if (missing.length) return fail('Market/Solo mutations or logout do not clearly invalidate/update cached joker balances.', {
        verification: 'STATIC_CONTRACT',
        files: ['src/lib/jokerInventory.js', 'src/lib/market.js', 'src/lib/AuthContext.jsx'],
        missing,
      });
      return pass('Market purchase, Solo spend, and logout keep the shared joker balance cache coherent and user-scoped.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('starter_self_heal_not_render_loop',
    'Starter/self-heal is not called from a render loop',
    () => {
      const missing = missingTokens(`${jokerInventorySource}\n${profilePageSource}\n${ensureUserJokerInventorySource}`, [
        'Self-heal runs only when UserJokerInventory rows are missing or partial, or when forced.',
        'completeKnownInventoryRows(rows)',
        'Promise.all(JOKER_TYPES.map',
        'parallelSelfHeal: true',
        'useEffect(() => {',
        'jokerReloadKey',
      ]);
      const forbidden = forbiddenTokens(profilePageSource, [
        'ensureStarterJokers(user)',
        'ensureUserJokerInventory(',
      ]);
      if (missing.length || forbidden.length) return fail('Starter repair may still run on every Profile render or serially block the UI.', {
        verification: 'STATIC_CONTRACT',
        actual: { missing, forbidden },
      });
      return pass('Profile uses an effect/retry key, while the helper skips repair for complete rows and the backend repairs types in parallel.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('starter_grant_requires_authenticated_user',
    'Starter grant requires linked auth or a verified completed guest proof',
    () => {
      const missing = missingTokens(ensureUserJokerInventorySource, [
        'base44.auth.me().catch',
        'normalizeGuestId(body?.guest_id)',
        'normalizeGuestToken(body?.guest_token)',
        'hashGuestToken(guestId, guestToken)',
        'expectedHash !== providedHash',
        'guest_profile_incomplete',
        'unauthenticated',
        '401',
        'rawGuestTokenServerStored: false',
      ]);
      if (missing.length) return fail('Starter grant can no longer prove linked or guest inventory ownership safely.', {
        verification: 'STATIC_CONTRACT',
        file: 'base44/functions/ensureUserJokerInventory/entry.ts',
        missing,
      });
      return pass('Starter grant accepts linked auth or token-proven completed guests and rejects missing/invalid proof.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('inventory_balance_cannot_go_negative',
    'Inventory helper/function clamp balances and expose a negative-delta guard',
    () => {
      const missing = missingTokens(`${jokerInventorySource}\n${ensureUserJokerInventorySource}`, [
        'Math.max(0, Math.floor',
        'canApplyJokerTransaction',
        'current + Math.trunc(delta) >= 0',
        '"minimum": 0',
      ]);
      if (missing.length) return fail('Joker balance non-negative contract is incomplete.', {
        verification: 'STATIC_CONTRACT',
        missing,
      });
      return pass('Joker balances are normalized non-negative and future negative deltas have a sufficient-balance guard.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('ledger_records_starter_grant_with_idempotency_key',
    'Starter grants write JokerTransaction rows with starter_grant and idempotency_key',
    () => {
      const missing = missingTokens(ensureUserJokerInventorySource, [
        "entityStore(base44, 'JokerTransaction')",
        '.create(payload)',
        'quantity_delta',
        'reason: STARTER_REASON',
        'source: STARTER_SOURCE',
        'idempotency_key: idempotencyKey',
        'balance_before',
        'balance_after',
      ]);
      if (missing.length) return fail('Starter grant ledger write contract is incomplete.', {
        verification: 'STATIC_CONTRACT',
        file: 'base44/functions/ensureUserJokerInventory/entry.ts',
        missing,
      });
      return pass('Starter grant writes JokerTransaction rows with idempotency and balance-after fields.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('profile_shows_joker_cantasi',
    'Profile shows Joker Çantası section',
    () => {
      const missing = missingTokens(profilePageSource, [
        'Joker Çantası',
        'JokerPocketSection',
        'getUserJokerBalances',
      ]);
      const forbidden = forbiddenTokens(profilePageSource, ['Envanter']);
      if (missing.length || forbidden.length) return fail('Profile joker display is missing or uses the forbidden Envanter wording.', {
        verification: 'STATIC_CONTRACT',
        file: 'src/pages/ProfilePage.jsx',
        actual: { missing, forbidden },
      });
      return pass('Profile exposes the user-facing Joker Çantası balance section.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('profile_displays_jokers_and_hint_in_one_row',
    'Profile Joker Çantası displays three jokers plus İpucu in one row',
    () => {
      const combined = `${profilePageSource}\n${jokerInventorySource}\n${hintInventorySource}`;
      const missing = missingTokens(combined, [
        'PROFILE_INVENTORY_ITEMS',
        "kind: 'joker'",
        "kind: 'hint'",
        'Kronokalkan',
        'Kart Değiştir',
        'Zamanı Dondur',
        'İpucu',
        'grid-cols-4',
        'data-kronox-profile-inventory-row="four-items"',
        'overflow-visible',
        'min-w-0',
        'balances?.[item.type]',
        'hintState.balance',
        'getUserHintBalance(user, { forceRefresh: jokerReloadKey > 0 })',
        "x{countUnavailable ? '—' : count}",
      ]);
      const forbidden = forbiddenTokens(profilePageSource, [
        'overflow-x-auto',
        'overflow-x-scroll',
        'whitespace-nowrap',
      ]);
      if (missing.length || forbidden.length) return fail('Profile does not clearly render three joker counts plus the Hint count in one non-scrolling row.', {
        verification: 'STATIC_CONTRACT',
        file: 'src/pages/ProfilePage.jsx',
        actual: { missing, forbidden },
      });
      return pass('Profile renders Kronokalkan, Kart Değiştir, Zamanı Dondur, and İpucu as four compact non-scrolling row cards.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('profile_hint_balance_uses_read_only_current_inventory',
    'Profile Hint count uses read-only UserHintInventory current balance',
    () => {
      const missing = missingTokens(`${profilePageSource}\n${hintInventorySource}\n${userHintInventoryEntitySource}\n${hintTransactionEntitySource}`, [
        'getUserHintBalance',
        'ensureUserHintInventory({ guestCredentials })',
        'const hintRequest = email',
        'readOwnHintInventoryRows',
        'UserHintInventory.fast_read',
        'currentBalanceSource: \'UserHintInventory.quantity\'',
        'ledgerScanned: false',
        'displayOnlyRead: true',
        'noInventoryMutation: true',
        'HintTransaction',
        'ledger/idempotency audit',
        'normalizeHintQuantity(result?.hintBalance)',
      ]);
      const forbidden = forbiddenTokens(profilePageSource, [
        'consumeUserHint(',
        'UserHintInventory.create',
        'UserHintInventory.update',
        'HintTransaction',
        'STARTER_HINT_QUANTITY',
        'hintBalance: 3',
        'balance: 3',
      ]);
      if (missing.length || forbidden.length) return fail('Profile Hint card can drift from read-only UserHintInventory balance or mutate/grant inventory.', {
        verification: 'STATIC_CONTRACT',
        actual: { missing, forbidden },
      });
      return pass('Profile uses the direct read-only path for linked players and the token-proven backend inventory projection for guests; no direct consume/entity mutation exists.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('profile_hint_remains_separate_from_joker_inventory',
    'Profile Hint card remains separate from Joker inventory',
    () => {
      const missing = missingTokens(`${profilePageSource}\n${hintInventorySource}\n${jokerInventorySource}`, [
        "kind: 'hint'",
        "type: 'hint'",
        'label: \'İpucu\'',
        'Hammer',
        'Solo Hint / İpucu is separate from Joker inventory.',
        'UserHintInventory',
        'UserJokerInventory',
      ]);
      const forbidden = forbiddenTokens(jokerInventorySource, [
        "HINT: 'hint'",
        "İpucu', shortLabel",
      ]);
      if (missing.length || forbidden.length) return fail('Hint display is being folded into Joker inventory instead of remaining separate.', {
        verification: 'STATIC_CONTRACT',
        actual: { missing, forbidden },
      });
      return pass('Profile displays İpucu beside the jokers while keeping Hint state in UserHintInventory, not JOKER_DEFINITIONS.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('profile_does_not_expose_joker_ledger',
    'Profile does not expose JokerTransaction ledger details',
    () => {
      const forbidden = forbiddenTokens(profilePageSource, [
        'JokerTransaction',
        'quantity_delta',
        'idempotency_key',
        'starter_grant',
      ]);
      if (forbidden.length) return fail('Profile exposes joker transaction ledger details.', {
        verification: 'STATIC_CONTRACT',
        file: 'src/pages/ProfilePage.jsx',
        forbidden,
      });
      return pass('Profile reads balances only and does not render JokerTransaction ledger details.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('joker_inventory_separate_from_diamonds',
    'Joker inventory is separate from Diamonds',
    () => {
      const missing = missingTokens(`${userJokerInventoryEntitySource}\n${jokerTransactionEntitySource}\n${jokerInventorySource}`, [
        'UserJokerInventory',
        'JokerTransaction',
        'joker_type',
      ]);
      const forbidden = forbiddenTokens(`${userJokerInventoryEntitySource}\n${jokerTransactionEntitySource}\n${jokerInventorySource}`, [
        'DiamondTransaction.create',
        'diamonds:',
        'User.diamonds',
      ]);
      if (missing.length || forbidden.length) return fail('Joker inventory is leaking into Diamond balance/ledger contracts.', {
        verification: 'STATIC_CONTRACT',
        actual: { missing, forbidden },
      });
      return pass('Joker inventory uses separate balance and ledger entities, not Diamond balance fields.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('daily_wheel_v2_joker_grants_are_backend_owned',
    'Daily Wheel V2 joker grants are backend-owned and ledgered',
    () => {
      const required = missingTokens(claimDailyWheelRewardSource, [
        'DailyWheelSpin',
        'JokerTransaction',
        'UserJokerInventory',
        "DAILY_WHEEL_JOKER_REASON = 'daily_wheel'",
        'grantDailyWheelJokers',
        '${context.idempotencyKey}:joker:${jokerType}',
      ]);
      const forbidden = forbiddenTokens(claimDailyWheelRewardSource, [
        'market_purchase',
        'purchaseJokerWithDiamonds',
      ]);
      if (required.length || forbidden.length) return fail('Daily Wheel V2 joker grants are missing backend ledger ownership or leak Market purchase semantics.', {
        verification: 'STATIC_CONTRACT',
        file: 'base44/functions/claimDailyWheelReward/entry.ts',
        actual: { required, forbidden },
      });
      return pass('Daily Wheel V2 approved joker rewards write UserJokerInventory/JokerTransaction through the server claim path.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('market_catalog_joker_boundary',
    'Mağaza catalog keeps joker purchases server-owned inside expanded Store',
    () => {
      const missing = missingTokens(`${mainMenuSource}\n${marketPageSource}\n${marketSource}\n${purchaseJokerWithDiamondsSource}`, [
        'showMarket',
        'Mağaza',
        'MARKET_JOKER_PRODUCTS',
        'MARKET_HINT_PRODUCTS',
        'MARKET_ADVANTAGE_PRODUCTS',
        'Kronokalkan',
        'Kart Değiştir',
        'Zamanı Dondur',
        'market_purchase',
        'purchaseJokerWithDiamonds',
        'DiamondTransaction',
        'JokerTransaction',
      ]);
      const forbidden = forbiddenTokens(marketPageSource, [
        'abonelik',
        'avatar',
        'cosmetic',
        'random_box',
        'loot',
        'client-side grant',
      ]);
      if (missing.length || forbidden.length) return fail('Mağaza expanded catalog boundary is missing or can client-grant non-owned products.', {
        verification: 'STATIC_CONTRACT',
        actual: { missing, forbidden },
      });
      return pass('Mağaza exposes expanded product sections while keeping joker grants server-owned through JokerTransaction/UserJokerInventory.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('market_purchase_increases_correct_joker_type_only',
    'Market purchase increases only configured UserJokerInventory joker grants',
    () => {
      const missing = missingTokens(purchaseJokerWithDiamondsSource, [
        'normalizeJokerGrants(product)',
        'MARKET_DIAMOND_PRODUCTS',
        'for (const [jokerType, quantity] of jokerEntries)',
        'const after = before + quantity',
        'joker_type: jokerType',
        'quantity: after',
        'quantity_delta: grant.quantity',
      ]);
      const forbidden = forbiddenTokens(purchaseJokerWithDiamondsSource, [
        'quantity: jokerAfter,\n      mistake_shield',
        'quantity: jokerAfter,\n      card_swap',
        'quantity: jokerAfter,\n      time_freeze',
      ]);
      if (missing.length || forbidden.length) return fail('Market purchase may grant joker types outside the configured product grant map.', {
        verification: 'STATIC_CONTRACT',
        file: 'base44/functions/purchaseJokerWithDiamonds/entry.ts',
        actual: { missing, forbidden },
      });
      return pass('Market purchase iterates only the product grant map and writes matching positive joker ledger deltas.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('joker_transaction_reasons_remain_distinct',
    'Starter, Solo use, and Market purchase ledger reasons remain distinct',
    () => {
      const missing = missingTokens(`${jokerInventorySource}\n${ensureUserJokerInventorySource}\n${spendUserJokerSource}\n${purchaseJokerWithDiamondsSource}`, [
        "STARTER_GRANT: 'starter_grant'",
        "const STARTER_REASON = 'starter_grant'",
        "SOLO_USE: 'solo_use'",
        "const SOLO_USE_REASON = 'solo_use'",
        "MARKET_PURCHASE: 'market_purchase'",
        "const MARKET_PURCHASE_REASON = 'market_purchase'",
      ]);
      if (missing.length) return fail('JokerTransaction reason contracts drifted between starter, Solo, and Market paths.', {
        verification: 'STATIC_CONTRACT',
        missing,
      });
      return pass('Starter grants, Solo spends, and Market purchases write separate reason values.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('market_purchase_does_not_rerun_starter_or_allow_client_grant',
    'Market purchase cannot rerun starter grants or grant arbitrary jokers by client mutation',
    () => {
      const missing = missingTokens(`${purchaseJokerWithDiamondsSource}\n${marketSource}`, [
        'findStarterTransaction',
        'existingTransaction',
        'market_phase_1_lazy_starter_repair',
        'starter self-heal skipped',
        'normalizeJokerType',
        'invalid_joker_type',
        'getMarketJokerProduct',
        'buildJokerPurchaseIdempotencyKey',
      ]);
      const forbidden = forbiddenTokens(marketSource, [
        'UserJokerInventory.create',
        'UserJokerInventory.update',
        'JokerTransaction.create',
      ]);
      if (missing.length || forbidden.length) return fail('Market purchase can bypass the server-backed inventory grant contract or duplicate starter grants.', {
        verification: 'STATIC_CONTRACT',
        actual: { missing, forbidden },
      });
      return pass('Market uses server-backed validated joker types, best-effort idempotent starter repair, and no client-side inventory/ledger mutation.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('market_purchase_visible_in_profile_and_solo',
    'Market-purchased jokers can appear in Profile and Solo joker bar',
    () => {
      const missing = missingTokens(`${marketPageSource}\n${profilePageSource}\n${soloJokerBarSource}\n${gameSource}`, [
        'setBalances(normalizeJokerBalances(result.balances))',
        'Joker Çantası',
        'getUserJokerBalances(user, {',
        'guestCredentials,',
        'ensureStarter: false',
        'forceRefresh: jokerReloadKey > 0',
        'ensureStarterJokers(user, { forceEnsure: true, forceRefresh: jokerReloadKey > 0 })',
        'Number(balances?.[item.type]) || 0',
        'balances={soloJokers?.balances || null}',
        'balances?.[inventoryType]',
      ]);
      if (missing.length) return fail('Purchased joker balances are not visible through Profile/Solo balance paths.', {
        verification: 'STATIC_CONTRACT',
        missing,
      });
      return pass('Purchased balances update Market locally and Profile/Solo reread UserJokerInventory counts.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('solo_joker_behavior_uses_inventory_in_phase_2',
    'Solo joker behavior uses user-owned inventory in Phase 2',
    () => {
      const missing = missingTokens(`${soloJokerBarSource}\n${gameSource}\n${jokerInventorySource}`, [
        'getUserJokerBalances(currentUser, {',
        'ensureStarter: true',
        'guestCredentials: guestRecordPayload',
        'spendSoloJokerForCurrentCard',
        'spendUserJoker(currentUser',
        'soloJokerUsedByDecisionKeyRef',
        'const balance = normalizeJokerQuantity(balances?.[inventoryType])',
      ]);
      const forbidden = forbiddenTokens(`${soloJokerBarSource}\n${gameSource}`, [
        'remainingUses = jokerConsumed ? 0 : 1',
        'if (!isSoloLevelMode || jokerUsedRef.current || usedJokerType',
      ]);
      if (missing.length || forbidden.length) return fail('Phase 2 Solo joker inventory wiring is missing or old attempt-local limits remain.', {
        verification: 'STATIC_CONTRACT',
        files: ['src/pages/Game.jsx', 'src/components/game/SoloJokerBar.jsx'],
        actual: { missing, forbidden },
      });
      return pass('Solo joker runtime reads inventory balances and spends through the backend ledger path.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('phase_2_solo_consumption_contract_exists',
    'Phase 2 Solo joker consumption contract exists',
    () => {
      const missing = missingTokens(jokerInventorySource, [
        'PHASE2_SOLO_JOKER_CONSUMPTION_CONTRACT',
        'Solo joker buttons read user-owned balances',
        'One joker may be used per question/card',
        'Any number of jokers may be used across a level if the user owns them',
        'JokerTransaction reason solo_use',
        'Used jokers are not refunded on fail/exit',
      ]);
      if (missing.length) return fail('Phase 2 Solo joker consumption contract is missing.', {
        verification: 'STATIC_CONTRACT',
        file: 'src/lib/jokerInventory.js',
        missing,
      });
      return pass('Phase 2 Solo consumption rules are documented in the inventory helper contract.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('auth_lazily_initializes_existing_users',
    'Existing linked users and completed guests are lazily initialized through canonical profile paths',
    () => {
      const missing = missingTokens(`${authContextSource}\n${profilePageSource}`, [
        'ensureStarterJokers(currentUser)',
        'jokerEnsureKeyRef',
        'getUserJokerBalances(user, {',
        'guestCredentials,',
        'ensureStarter: false',
        'forceRefresh: jokerReloadKey > 0',
        'ensureStarterJokers(user, { forceEnsure: true, forceRefresh: jokerReloadKey > 0 })',
      ]);
      if (missing.length) return fail('Existing player inventory is not lazily initialized through auth/profile paths.', {
        verification: 'STATIC_CONTRACT',
        files: ['src/lib/AuthContext.jsx', 'src/pages/ProfilePage.jsx'],
        missing,
      });
      return pass('Auth startup preserves linked fast initialization and Profile resolves guest credentials through the shared inventory helper.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('ensure_function_is_registered',
    'ensureUserJokerInventory backend function is registered',
    () => {
      const missing = missingTokens(`${ensureUserJokerInventoryManifestSource}\n${jokerInventorySource}`, [
        '"name": "ensureUserJokerInventory"',
        '"entry": "entry.ts"',
        "'ensureUserJokerInventory'",
      ]);
      if (missing.length) return fail('ensureUserJokerInventory is not registered/invoked clearly.', {
        verification: 'STATIC_CONTRACT',
        files: ['base44/functions/ensureUserJokerInventory/function.jsonc', 'src/lib/jokerInventory.js'],
        missing,
      });
      return pass('ensureUserJokerInventory function is registered and used by the helper.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('spend_function_is_registered',
    'spendUserJoker backend function is registered and invoked',
    () => {
      const missing = missingTokens(`${spendUserJokerManifestSource}\n${jokerInventorySource}`, [
        '"name": "spendUserJoker"',
        '"entry": "entry.ts"',
        "base44.functions.invoke('spendUserJoker'",
      ]);
      if (missing.length) return fail('spendUserJoker is not registered/invoked clearly.', {
        verification: 'STATIC_CONTRACT',
        files: ['base44/functions/spendUserJoker/function.jsonc', 'src/lib/jokerInventory.js'],
        missing,
      });
      return pass('spendUserJoker function is registered and used by the helper.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('solo_spend_uses_deploy_safe_entities_and_solo_context',
    'Solo spend has deploy-safe entity binding and rejects non-Solo context',
    () => {
      const missing = missingTokens(`${spendUserJokerSource}\n${jokerInventorySource}\n${gameSource}`, [
        "entityStore(base44, 'UserJokerInventory')",
        "entityStore(base44, 'JokerTransaction')",
        'invalid_joker_context',
        'Joker yalnızca Solo modda kullanılabilir.',
        "mode: 'solo'",
        'safeJokerSpendError',
        'joker_spend_request_failed',
      ]);
      if (missing.length) return fail('Solo joker spend can regress to service-role-only deployment failures, non-Solo usage, or raw UI errors.', {
        verification: 'STATIC_CONTRACT',
        files: ['base44/functions/spendUserJoker/entry.ts', 'src/lib/jokerInventory.js', 'src/pages/Game.jsx'],
        missing,
      });
      return pass('Solo spend uses service-role/auth entity fallback, validates Solo context, and maps Base44 invoke failures to safe UI copy.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('solo_spend_records_ledger',
    'Solo spend records JokerTransaction reason solo_use',
    () => {
      const missing = missingTokens(`${spendUserJokerSource}\n${jokerInventorySource}`, [
        "const SOLO_USE_REASON = 'solo_use'",
        'quantity_delta: -1',
        'source: SOLO_SOURCE',
        'idempotency_key: idempotencyKey',
        'balance_before: quantityBefore',
        'balance_after: balanceAfter',
        'created_by: player.createdBy',
        'playerType: player.playerType',
      ]);
      if (missing.length) return fail('Solo joker spend ledger write contract is incomplete.', {
        verification: 'STATIC_CONTRACT',
        files: ['base44/functions/spendUserJoker/entry.ts', 'src/lib/jokerInventory.js'],
        missing,
      });
      return pass('Solo joker spend writes append-only ledger rows with reason solo_use and quantity_delta -1.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('solo_spend_is_idempotent_and_non_negative',
    'Solo spend is idempotent and balance cannot go negative',
    () => {
      const missing = missingTokens(`${spendUserJokerSource}\n${jokerInventorySource}`, [
        'findTransaction(base44, email, jokerType, idempotencyKey)',
        'alreadyApplied',
        'quantityBefore <= 0',
        'insufficient_joker_balance',
        'const balanceAfter = quantityBefore - 1',
        'buildSoloJokerUseIdempotencyKey',
      ]);
      if (missing.length) return fail('Solo joker spend no longer clearly prevents duplicate or negative spends.', {
        verification: 'STATIC_CONTRACT',
        missing,
      });
      return pass('Solo spend uses idempotency and positive-balance checks before writing balanceAfter.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('solo_spend_reconciles_duplicate_rows_and_badge_balance',
    'Solo spend repairs duplicate inventory rows and badge balance merges partial payloads',
    () => {
      const combined = `${spendUserJokerSource}\n${jokerInventorySource}\n${jokerInventorySpendMergeSource}\n${gameSource}`;
      const missing = missingTokens(combined, [
        'repairDuplicateInventoryRowsAfterSpend',
        'duplicateSpendBalanceReconciled',
        'duplicateRowsRepaired',
        'getJokerBalancePayloadTypes',
        'getJokerSpendBalancePayloadTypes',
        'mergeJokerBalances',
        'mergeJokerSpendMutationBalances',
        'normalizeJokerSpendBalances',
        'balancePayloadTypes',
        'balancesComplete',
        'readBalanceSnapshot',
        'readBalancePayload',
        'balancePayloadTypes.length === JOKER_DEFINITIONS.length',
        'response?.updatedCount',
        'response?.updated_count',
        'balancesComplete === true',
        'normalizeOptionalJokerQuantity(balanceAfter)',
        'setSoloJokerBalancesFromSpendResponse',
        'setJokerBalances((previousBalances) => mergeJokerSpendMutationBalances',
        'setCachedJokerBalances(actorCacheKey, result.balances',
      ]);
      if (missing.length) return fail('Solo joker spend can still show stale counts from duplicate inventory rows or partial balance payloads.', {
        verification: 'STATIC_CONTRACT',
        files: ['base44/functions/spendUserJoker/entry.ts', 'src/lib/jokerInventory.js', 'src/lib/jokerInventorySpendMerge.js', 'src/pages/Game.jsx'],
        missing,
      });
      return pass('Post-spend balanceAfter is authoritative for the used joker, partial payloads merge into current balances, cache/UI badges update immediately, and duplicate inventory rows are reconciled.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('solo_spend_preserves_untouched_joker_counts_matrix',
    'Solo spend merge preserves untouched joker counts for all jokers and partial responses',
    () => {
      const failed = runJokerSpendMergeMatrix().filter((scenario) => !scenario.passed);
      const missing = missingTokens(`${jokerInventorySpendMergeSource}\n${gameSource}\n${spendUserJokerSource}`, [
        'A_CARD_SWAP_SELECTED_ONLY',
        'B_MISTAKE_SHIELD_SELECTED_ONLY',
        'C_TIME_FREEZE_SELECTED_ONLY',
        'D_PARTIAL_CARD_SWAP_RESPONSE',
        'E_MISSING_FIELDS_STAY_UNCHANGED',
        'F_IDEMPOTENT_DUPLICATE_RESULT_DOES_NOT_DOUBLE_SPEND',
        'G_TUTORIAL_NO_SPEND_BASELINE_UNCHANGED',
        'H_UNDERPOPULATED_FULL_BALANCES_NO_COMPLETE_FLAG',
        'mergeJokerBalancesByPayloadTypes',
        'getJokerSpendBalancePayloadTypes',
        'balancePayloadTypes',
        'balancesComplete',
        'setJokerBalances((previousBalances) => mergeJokerSpendMutationBalances',
      ]);
      if (failed.length || missing.length) return fail('Solo joker spend merge can still zero untouched counts or double-decrement selected counts.', {
        verification: 'EXECUTABLE_HELPER_AND_STATIC_CONTRACT',
        files: ['src/lib/jokerInventorySpendMerge.js', 'src/pages/Game.jsx', 'base44/functions/spendUserJoker/entry.ts'],
        actual: { failed, missing },
      });
      return pass('Executable merge matrix preserves untouched counts after Kart Değiştir, Kronokalkan, Zamanı Dondur, partial payloads, idempotent retries, and tutorial no-spend baseline.', {
        verification: 'EXECUTABLE_HELPER_AND_STATIC_CONTRACT',
        scenarios: runJokerSpendMergeMatrix().map((scenario) => scenario.id),
      });
    }),

  makeCase('joker_inventory_rls_runtime_proof_manual',
    'Two-account joker inventory RLS proof remains manual',
    () => notAutomatable('Runtime proof that users cannot read/mutate other users’ joker balances or ledger rows requires a real two-account Base44 probe.', {
      verification: 'RUNTIME_PROOF_REQUIRED',
      classification: 'MANUAL_RELEASE_PROOF',
      actionType: ACTION_TYPES.MANUAL_VERIFY,
      expected: 'Account A can read only its UserJokerInventory rows; Account B cannot read/mutate Account A rows; normal users cannot create arbitrary grant transactions.',
    }),
  ),
];
