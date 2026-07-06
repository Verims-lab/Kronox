// Kronox Health Center — Logical Unique Guard Suite (GFable 5).
//
// Base44 has no repo-level unique index support. After the approved duplicate
// cleanup, uniqueness for every cleaned key is enforced PERMANENTLY at
// function/code level: query-before-create, reserve-first (DailyWheelSpin),
// EconomyOperationLock for economy mutations, idempotency_key checks on
// transaction ledgers, re-read after write where race risk exists, and
// return-existing-canonical-record on duplicate-key hits. Read-time dedupe is
// preserved as the safety fallback and must not be removed.

import dailyWheelFnSource from '../../../base44/functions/claimDailyWheelReward/entry.ts?raw';
import purchaseFnSource from '../../../base44/functions/purchaseJokerWithDiamonds/entry.ts?raw';
import spendJokerFnSource from '../../../base44/functions/spendUserJoker/entry.ts?raw';
import consumeHintFnSource from '../../../base44/functions/consumeUserHint/entry.ts?raw';
import ensureJokerFnSource from '../../../base44/functions/ensureUserJokerInventory/entry.ts?raw';
import questProgressFnSource from '../../../base44/functions/recordDailyQuestProgress/entry.ts?raw';
import questClaimFnSource from '../../../base44/functions/claimDailyQuestReward/entry.ts?raw';
import refreshProjectionFnSource from '../../../base44/functions/refreshLeaderboardProjection/entry.ts?raw';
import duplicateReportFnSource from '../../../base44/functions/adminDuplicateKeyReport/entry.ts?raw';
import diamondEconomySource from '../../lib/diamondEconomy.js?raw';
import leaderboardLibSource from '../../lib/leaderboard.js?raw';
import lobbyCodeGuardSource from '../../lib/lobbyCodeGuard.js?raw';
import lobbyRoomSource from '../../pages/LobbyRoom.jsx?raw';
import { DB_ARCHITECTURE_IMPLEMENTATION_MIRROR } from '../../lib/dbArchitectureMirrors';

const STATUS = {
  PASS: 'PASS',
  FAIL: 'FAIL',
  NOT_AUTOMATABLE: 'NOT_AUTOMATABLE',
};

const SUITE_ID = 'logical_unique_guards';
const SUITE_NAME = 'Logical Unique Guard Suite';

function makeCase(id, name, run, options = {}) {
  return {
    key: `${SUITE_ID}.${id}`,
    suiteId: SUITE_ID,
    suiteName: SUITE_NAME,
    id,
    name,
    critical: options.critical ?? true,
    ...options,
    run,
  };
}

function pass(reason, extra) { return { status: STATUS.PASS, reason, ...(extra || {}) }; }
function fail(reason, extra) { return { status: STATUS.FAIL, reason, ...(extra || {}) }; }
function notAutomatable(reason, extra) { return { status: STATUS.NOT_AUTOMATABLE, reason, ...(extra || {}) }; }

function safeStr(source) {
  if (source == null) return '';
  if (typeof source === 'string') return source;
  try { return String(source); } catch { /* fall through */ }
  try { return JSON.stringify(source); } catch { return ''; }
}

function missingTokens(source, tokens) {
  const text = safeStr(source);
  return tokens.filter((token) => !text.includes(token));
}

export const EXTRA_SUITES = [
  { id: SUITE_ID, name: SUITE_NAME, critical: true, color: '#a3e635' },
];

export const EXTRA_TESTS = [
  makeCase('daily_wheel_reserve_first_guard',
    'DailyWheelSpin (idempotency_key + user/day) uses reserve-first + lock + re-read',
    () => {
      const missing = missingTokens(dailyWheelFnSource, [
        'const existingSpin = await findSpin',
        'withEconomyOperationLock',
        'const postLockSpin = await findSpin',
        'const postReserveSpin = await findSpin',
        'recoverExistingSpin',
        "'daily_wheel_spin_existing_after_create'",
        "'daily_wheel_spin_existing_after_create_error'",
        'dedupeSpinRows',
      ]);
      if (missing.length) {
        return fail('Daily Wheel reserve-first / re-read guard drifted; a race could create a second spin row for the same player/day.', {
          verification: 'STATIC_CONTRACT',
          file: 'base44/functions/claimDailyWheelReward/entry.ts',
          missing,
        });
      }
      return pass('Claim path checks the existing spin before + inside the lock, reserves the spin row first, re-reads after create, and recovers the existing canonical spin instead of duplicating.', {
        verification: 'STATIC_CONTRACT',
      });
    }),

  makeCase('diamond_ledger_idempotency_guards',
    'Every DiamondTransaction create path checks idempotency_key before create and re-reads after write',
    () => {
      const missing = [
        ...missingTokens(dailyWheelFnSource, [
          'const existing = await findDiamondTransaction',
          'const confirmed = await findDiamondTransaction',
        ]).map((t) => `claimDailyWheelReward:${t}`),
        ...missingTokens(purchaseFnSource, [
          'const existing = await findDiamondTransaction',
          'const confirmed = await findDiamondTransaction',
          "code: 'duplicate_purchase_in_progress'",
          'withEconomyOperationLock',
        ]).map((t) => `purchaseJokerWithDiamonds:${t}`),
        ...missingTokens(questClaimFnSource, [
          'const existingTx = await findDiamondTransaction',
          'const postLockExisting = await findDiamondTransaction',
          'withEconomyLock',
        ]).map((t) => `claimDailyQuestReward:${t}`),
        ...missingTokens(diamondEconomySource, [
          'const existing = await findDiamondTransaction',
          'const confirmed = await findDiamondTransaction',
          'existingAfterRefresh',
          'hasPersistedGrantGuard',
          "'created_at', 1",
        ]).map((t) => `diamondEconomy:${t}`),
      ];
      if (missing.length) {
        return fail('A DiamondTransaction create path lost its idempotency_key query-before-create / re-read guard.', {
          verification: 'STATIC_CONTRACT',
          missing,
        });
      }
      return pass('Daily Wheel, Market, Daily Calendar claim, and client starter/daily grants all find-before-create, confirm after write, and converge on the earliest canonical ledger row.', {
        verification: 'STATIC_CONTRACT',
      });
    }),

  makeCase('joker_hint_ledger_and_spend_guards',
    'JokerTransaction/HintTransaction spends are idempotent, locked, and return the existing canonical record',
    () => {
      const missing = [
        ...missingTokens(spendJokerFnSource, [
          'const existingTransaction = await findTransaction',
          'const secondExistingTransaction = await findTransaction',
          'alreadyApplied: true',
          'withEconomyOperationLock',
          'repairDuplicateInventoryRowsAfterSpend',
        ]).map((t) => `spendUserJoker:${t}`),
        ...missingTokens(consumeHintFnSource, [
          'const existingTransaction = await findTransaction',
          'const secondExistingTransaction = await findTransaction',
          'alreadyApplied: true',
          'withEconomyOperationLock',
          'repairDuplicateInventoryRowsAfterSpend',
        ]).map((t) => `consumeUserHint:${t}`),
        ...missingTokens(ensureJokerFnSource, [
          'findStarterTransaction',
          'recoveredExisting',
        ]).map((t) => `ensureUserJokerInventory:${t}`),
      ];
      if (missing.length) {
        return fail('A joker/hint ledger path lost its idempotency guard; retries could double-spend or double-grant.', {
          verification: 'STATIC_CONTRACT',
          missing,
        });
      }
      return pass('Joker/hint spends check the ledger before and inside the EconomyOperationLock and return already-applied results instead of creating second rows.', {
        verification: 'STATIC_CONTRACT',
      });
    }),

  makeCase('inventory_logical_unique_upsert',
    'UserJokerInventory (user_email + joker_type) is upserted by existing row id, never blind-created',
    () => {
      const missing = [
        ...missingTokens(ensureJokerFnSource, [
          'findInventoryRows',
          'selectPrimaryInventoryRow',
          'upsertInventory',
          'duplicateRowsIgnored',
        ]).map((t) => `ensureUserJokerInventory:${t}`),
        ...missingTokens(purchaseFnSource, [
          'findInventory',
          'upsertInventory',
        ]).map((t) => `purchaseJokerWithDiamonds:${t}`),
        ...missingTokens(dailyWheelFnSource, [
          'findJokerInventory',
          'upsertJokerInventory',
        ]).map((t) => `claimDailyWheelReward:${t}`),
      ];
      if (missing.length) {
        return fail('A joker inventory write path lost its query-then-upsert guard for the user_email + joker_type logical key.', {
          verification: 'STATIC_CONTRACT',
          missing,
        });
      }
      return pass('All inventory writers filter by user_email + joker_type first and update the existing row when one exists.', {
        verification: 'STATIC_CONTRACT',
      });
    }),

  makeCase('daily_calendar_assignment_guard',
    'UserDailyQuestProgress assignment rows use find-before-create with catch-recover',
    () => {
      const missing = missingTokens(questProgressFnSource, [
        'buildAssignmentKey',
        'const existing = await findProgressByAssignment',
        '.catch(async () => findProgressByAssignment',
        'buildProgressEventKey',
      ]);
      if (missing.length) {
        return fail('Daily Calendar assignment creation lost its find-before-create / catch-recover guard for user + quest_date + quest_key.', {
          verification: 'STATIC_CONTRACT',
          file: 'base44/functions/recordDailyQuestProgress/entry.ts',
          missing,
        });
      }
      return pass('Assignments check idempotency_key + quest_date/quest_key before create and recover the existing row on create failure; progress events are deduped by event key.', {
        verification: 'STATIC_CONTRACT',
      });
    }),

  makeCase('leaderboard_owner_key_guard',
    'SoloLeaderboardEntry.owner_key publishes are query-before-create with post-create canonical re-read',
    () => {
      const missing = [
        ...missingTokens(leaderboardLibSource, [
          '{ owner_key: payload.owner_key }',
          'ownRow?.id',
          'const confirmed = await base44.entities.SoloLeaderboardEntry.filter',
        ]).map((t) => `leaderboard:${t}`),
        ...missingTokens(refreshProjectionFnSource, [
          'upsertByFilter',
          '{ owner_key: ownerKey }',
        ]).map((t) => `refreshLeaderboardProjection:${t}`),
      ];
      if (missing.length) {
        return fail('A leaderboard projection write path lost its owner_key query-before-create / re-read guard.', {
          verification: 'STATIC_CONTRACT',
          missing,
        });
      }
      return pass('Client publish and admin refresh both filter owner_key before update/create; publish re-reads the canonical row after create.', {
        verification: 'STATIC_CONTRACT',
      });
    }),

  makeCase('lobby_code_unique_guard',
    'Lobby.code creation goes through generateUniqueLobbyCode (server-side query-before-create)',
    () => {
      const missing = [
        ...missingTokens(lobbyCodeGuardSource, [
          'export async function generateUniqueLobbyCode',
          'isLobbyCodeTaken',
          "invoke('findLobbyByCode'",
          'LOBBY_CODE_MAX_ATTEMPTS',
        ]).map((t) => `lobbyCodeGuard:${t}`),
        ...missingTokens(lobbyRoomSource, [
          'generateUniqueLobbyCode(',
        ]).map((t) => `LobbyRoom:${t}`),
      ];
      if (missing.length) {
        return fail('Lobby creation lost the code-uniqueness query-before-create guard.', {
          verification: 'STATIC_CONTRACT',
          missing,
        });
      }
      return pass('Lobby codes are checked server-side (lookup-only findLobbyByCode) before Lobby.create, with regeneration on collision.', {
        verification: 'STATIC_CONTRACT',
      });
    }),

  makeCase('read_time_dedupe_fallback_preserved',
    'Read-time dedupe fallbacks remain even though current duplicates were cleaned',
    () => {
      const missing = [
        ...missingTokens(dailyWheelFnSource, ['dedupeSpinRows']).map((t) => `claimDailyWheelReward:${t}`),
        ...missingTokens(spendJokerFnSource, ['selectPrimaryInventoryRow', 'repairDuplicateInventoryRowsAfterSpend']).map((t) => `spendUserJoker:${t}`),
        ...missingTokens(consumeHintFnSource, ['selectPrimaryInventoryRow']).map((t) => `consumeUserHint:${t}`),
        ...missingTokens(ensureJokerFnSource, ['selectPrimaryInventoryRow']).map((t) => `ensureUserJokerInventory:${t}`),
      ];
      if (missing.length) {
        return fail('A read-time dedupe fallback was removed. Cleanup alone is not enough — dedupe-on-read must stay.', {
          verification: 'STATIC_CONTRACT',
          missing,
        });
      }
      return pass('Spin-row dedupe and primary-inventory-row selection remain as the safety fallback behind the create guards.', {
        verification: 'STATIC_CONTRACT',
      });
    }),

  makeCase('duplicate_monitor_and_docs_alignment',
    'adminDuplicateKeyReport stays the admin-gated read-only monitor and docs record the permanent guard contract',
    () => {
      const missing = [
        ...missingTokens(duplicateReportFnSource, [
          'requireAdmin',
          'readOnly: true',
          'mutatesRows: false',
        ]).map((t) => `adminDuplicateKeyReport:${t}`),
        ...missingTokens(DB_ARCHITECTURE_IMPLEMENTATION_MIRROR, [
          'duplicate cleanup is not enough by itself',
          'logical uniqueness is enforced at function/code level',
          'query-before-create',
          'reserve-first',
          'Read-time dedupe',
          'adminDuplicateKeyReport remains the duplicate monitor',
          'manual release gates',
        ]).map((t) => `mirror:${t}`),
      ];
      if (missing.length) {
        return fail('The duplicate monitor or the documented permanent-guard contract drifted.', {
          verification: 'STATIC_CONTRACT',
          missing,
        });
      }
      return pass('Duplicate report tool remains admin-gated/read-only and the mirror documents the permanent code-level guard model.', {
        verification: 'STATIC_CONTRACT',
      });
    }),

  makeCase('concurrent_race_runtime_proof_manual',
    'True parallel-request duplicate races require manual runtime proof',
    () => notAutomatable(
      'Static contracts prove the guard code exists; genuine concurrent-request races (two simultaneous claims/purchases from separate devices) need a manual runtime test. Trigger the same claim twice in parallel and verify a single ledger/spin row plus an already-applied second response.',
      {
        verification: 'NOT_AUTOMATABLE',
        verificationLabels: ['NOT_AUTOMATABLE', 'MANUAL_REQUIRED'],
        expected: 'One canonical row per logical unique key under parallel load; adminDuplicateKeyReport dry-run stays at zero duplicates.',
      },
    )),
];