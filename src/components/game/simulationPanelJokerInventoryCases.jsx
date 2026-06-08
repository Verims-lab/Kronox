// Kronox Health Center — Joker Inventory Phase 1 contracts.
//
// Scope: user-owned joker balance foundation, starter grant idempotency,
// Profile Joker Çantası display, and Phase 2 Solo/Market boundaries.

import userJokerInventoryEntitySource from '../../../base44/entities/UserJokerInventory.jsonc?raw';
import jokerTransactionEntitySource from '../../../base44/entities/JokerTransaction.jsonc?raw';
import ensureUserJokerInventorySource from '../../../base44/functions/ensureUserJokerInventory/entry.ts?raw';
import ensureUserJokerInventoryManifestSource from '../../../base44/functions/ensureUserJokerInventory/function.jsonc?raw';
import jokerInventorySource from '../../lib/jokerInventory.js?raw';
import authContextSource from '../../lib/AuthContext.jsx?raw';
import profilePageSource from '../../pages/ProfilePage.jsx?raw';
import mainMenuSource from '../../pages/MainMenu.jsx?raw';
import soloJokerBarSource from './SoloJokerBar.jsx?raw';
import gameSource from '../../pages/Game.jsx?raw';
import claimDailyWheelRewardSource from '../../../base44/functions/claimDailyWheelReward/entry.ts?raw';

const STATUS = { PASS: 'PASS', FAIL: 'FAIL', NOT_AUTOMATABLE: 'NOT_AUTOMATABLE' };
const ACTION_TYPES = { CODE_FIX: 'CODE_FIX', MANUAL_VERIFY: 'MANUAL_VERIFY' };
const SUITE_ID = 'joker_inventory_health';
const SUITE_NAME = 'Joker Inventory Phase 1 Suite';

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
    nextStep: options.nextStep || 'Keep joker inventory Phase 1 limited to balances, starter grants, Profile display, and docs/Health contracts.',
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
      if (missing.length) return fail('UserJokerInventory schema is missing the Phase 1 balance contract.', {
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
        'Zaman Dondur',
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
      return pass('Starter grant contract initializes 3 Kronokalkan, 3 Kart Değiştir, and 3 Zaman Dondur.', { verification: 'STATIC_CONTRACT' });
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

  makeCase('starter_grant_requires_authenticated_user',
    'Starter grant function rejects unauthenticated users',
    () => {
      const missing = missingTokens(ensureUserJokerInventorySource, [
        'base44.auth.me()',
        'unauthenticated',
        '401',
        'Joker Çantası için giriş yapmalısın.',
      ]);
      if (missing.length) return fail('Starter grant callable no longer fails closed for unauthenticated users.', {
        verification: 'STATIC_CONTRACT',
        file: 'base44/functions/ensureUserJokerInventory/entry.ts',
        missing,
      });
      return pass('Starter grant callable requires authenticated user context.', { verification: 'STATIC_CONTRACT' });
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
        'JokerTransaction.create',
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

  makeCase('profile_displays_all_three_balances',
    'Profile displays all three joker balances',
    () => {
      const combined = `${profilePageSource}\n${jokerInventorySource}`;
      const missing = missingTokens(combined, [
        'JOKER_DEFINITIONS.map',
        'Kronokalkan',
        'Kart Değiştir',
        'Zaman Dondur',
        'balances?.[joker.type]',
        'x{count}',
      ]);
      if (missing.length) return fail('Profile does not clearly render all three joker balance counts.', {
        verification: 'STATIC_CONTRACT',
        file: 'src/pages/ProfilePage.jsx',
        missing,
      });
      return pass('Profile renders Kronokalkan, Kart Değiştir, and Zaman Dondur counts.', { verification: 'STATIC_CONTRACT' });
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

  makeCase('daily_wheel_remains_diamond_only',
    'Daily Wheel remains Diamond-only and does not grant jokers',
    () => {
      const required = missingTokens(claimDailyWheelRewardSource, [
        'DiamondTransaction',
        'totalRewardAmount',
        'diamonds',
      ]);
      const forbidden = forbiddenTokens(claimDailyWheelRewardSource, [
        'JokerTransaction',
        'UserJokerInventory',
        'mistake_shield',
        'card_swap',
        'time_freeze',
      ]);
      if (required.length || forbidden.length) return fail('Daily Wheel no longer looks Diamond-only.', {
        verification: 'STATIC_CONTRACT',
        file: 'base44/functions/claimDailyWheelReward/entry.ts',
        actual: { required, forbidden },
      });
      return pass('Daily Wheel still grants Diamonds only and does not touch joker inventory.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('market_not_active_in_phase_1',
    'Market purchase UI is not implemented in Phase 1',
    () => {
      const forbidden = forbiddenTokens(`${mainMenuSource}\n${profilePageSource}`, [
        'Joker Market',
        'Joker Pazarı',
        'market_purchase',
        'diamond-to-joker',
      ]);
      if (forbidden.length) return fail('A joker market/purchase surface appears active in Phase 1 UI.', {
        verification: 'STATIC_CONTRACT',
        forbidden,
      });
      return pass('Market purchase remains future-only; no active joker market UI is present.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('solo_joker_behavior_not_replaced_in_phase_1',
    'Existing Solo joker behavior remains backward-compatible in Phase 1',
    () => {
      const missing = missingTokens(`${soloJokerBarSource}\n${gameSource}`, [
        'usedJokerType',
        'jokerUsedRef.current',
        'remainingUses = jokerConsumed ? 0 : 1',
        'if (!isSoloLevelMode || jokerUsedRef.current || usedJokerType',
      ]);
      if (missing.length) return fail('Phase 1 accidentally removed or rewired existing Solo joker attempt-local behavior.', {
        verification: 'STATIC_CONTRACT',
        files: ['src/pages/Game.jsx', 'src/components/game/SoloJokerBar.jsx'],
        missing,
      });
      return pass('Existing Solo joker behavior remains intact; spending integration is deferred.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('phase_2_solo_consumption_contract_exists',
    'Phase 2 Solo joker consumption TODO contract exists',
    () => {
      const missing = missingTokens(jokerInventorySource, [
        'PHASE2_SOLO_JOKER_CONSUMPTION_TODO',
        'Solo joker buttons should read user-owned balances',
        'One joker may be used per question/card',
        'Any number of jokers may be used across a level if the user owns them',
        'A joker is consumed only after its effect is successfully applied',
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
    'Existing authenticated users are lazily initialized on app/profile load',
    () => {
      const missing = missingTokens(`${authContextSource}\n${profilePageSource}`, [
        'ensureStarterJokers(currentUser)',
        'jokerEnsureKeyRef',
        'getUserJokerBalances(user, { ensureStarter: true })',
      ]);
      if (missing.length) return fail('Existing users are not lazily initialized through auth/profile paths.', {
        verification: 'STATIC_CONTRACT',
        files: ['src/lib/AuthContext.jsx', 'src/pages/ProfilePage.jsx'],
        missing,
      });
      return pass('Auth startup and Profile load both use idempotent starter initialization for existing users.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('ensure_function_is_registered',
    'ensureUserJokerInventory backend function is registered',
    () => {
      const missing = missingTokens(`${ensureUserJokerInventoryManifestSource}\n${jokerInventorySource}`, [
        '"name": "ensureUserJokerInventory"',
        '"entry": "entry.ts"',
        "base44.functions.invoke('ensureUserJokerInventory'",
      ]);
      if (missing.length) return fail('ensureUserJokerInventory is not registered/invoked clearly.', {
        verification: 'STATIC_CONTRACT',
        files: ['base44/functions/ensureUserJokerInventory/function.jsonc', 'src/lib/jokerInventory.js'],
        missing,
      });
      return pass('ensureUserJokerInventory function is registered and used by the helper.', { verification: 'STATIC_CONTRACT' });
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
