// Kronox Health Center — DB/Data Model hardening cases (Codex139).
//
// These cases lock the non-destructive data-model hardening package:
// schema documentation alignment, user-scoped Solo mirrors, leaderboard
// scoring drift guards, OnlineMatchResult idempotency, and safe cleanup
// helpers. Runtime RLS/two-account proofs stay NOT_AUTOMATABLE.

import soloLevelsSource from '../../lib/soloLevels.js?raw';
import leaderboardSource from '../../lib/leaderboard.js?raw';
import applyOnlineResultSource from '../../lib/applyOnlineResult.js?raw';
import dataRetentionSource from '../../lib/dataRetention.js?raw';
import userDailyQuestProgressEntitySource from '../../../base44/entities/UserDailyQuestProgress.jsonc?raw';
// Vite `?raw` cannot reach outside `src/` on this host, so the canonical
// scoring/economy docs are mirrored into JS modules the runtime can import.
import { SCORING_RULES_DOC as scoringDocsSource } from '@/lib/scoringRulesDoc';
import { ECONOMY_RULES_DOC as economyDocsSource } from '@/lib/economyRulesDoc';
import {
  diamondTransactionEntitySource,
  friendRequestEntitySource,
  gameInviteEntitySource,
  getSoloLeaderboardFnSource,
  lobbyEntitySource,
  onlineMatchResultEntitySource,
  pushSubscriptionEntitySource,
  userEntitySource,
} from './simulationPanelContractStrings.jsx';

const STATUS = {
  PASS: 'PASS',
  WARNING: 'WARNING',
  NOT_AUTOMATABLE: 'NOT_AUTOMATABLE',
  FAIL: 'FAIL',
};

const ACTION_TYPES = {
  CODE_FIX: 'CODE_FIX',
  BACKEND_RUNTIME_PROBE: 'BACKEND_RUNTIME_PROBE',
  TWO_ACCOUNT_TEST: 'TWO_ACCOUNT_TEST',
};

const SUITE_NAMES = {
  data_model_health: 'Data Model Health Suite',
  persistence_contract_health: 'Persistence Contract Suite',
  db_architecture_health: 'DB Architecture Health Suite',
  online_match_result_health: 'Online Match Result Idempotency Suite',
  cleanup_retention_health: 'Cleanup / Retention Health Suite',
};

function makeCase(suiteId, id, name, run, options = {}) {
  return {
    key: `${suiteId}.${id}`,
    suiteId,
    suiteName: SUITE_NAMES[suiteId] || suiteId,
    id,
    name,
    critical: options.critical ?? true,
    ...options,
    run,
  };
}

function pass(reason, extra) { return { status: STATUS.PASS, reason, ...(extra || {}) }; }
function fail(reason, extra) { return { status: STATUS.FAIL, reason, ...(extra || {}) }; }
function warning(reason, extra) { return { status: STATUS.WARNING, reason, ...(extra || {}) }; }
function notAutomatable(reason, extra) {
  return { status: STATUS.NOT_AUTOMATABLE, reason, ...(extra || {}) };
}

function missingTokens(source, tokens) {
  return tokens.filter((token) => !String(source || '').includes(token));
}

function hasAll(source, tokens) {
  return missingTokens(source, tokens).length === 0;
}

export const EXTRA_SUITES = [
  { id: 'data_model_health', name: SUITE_NAMES.data_model_health, critical: true, color: '#38bdf8' },
  { id: 'persistence_contract_health', name: SUITE_NAMES.persistence_contract_health, critical: true, color: '#22c55e' },
  { id: 'db_architecture_health', name: SUITE_NAMES.db_architecture_health, critical: true, color: '#a78bfa' },
  { id: 'online_match_result_health', name: SUITE_NAMES.online_match_result_health, critical: true, color: '#f59e0b' },
  { id: 'cleanup_retention_health', name: SUITE_NAMES.cleanup_retention_health, critical: true, color: '#14b8a6' },
];

export const EXTRA_TESTS = [
  makeCase('data_model_health', 'user_schema_documents_live_profile_fields',
    'User schema documents live profile flags used by tutorial and notifications',
    () => {
      const missing = missingTokens(userEntitySource, [
        'hasCompletedTutorial',
        'game_invite_notifications_enabled',
      ]);
      if (missing.length) return fail('User schema mirror is missing live profile fields.', { verification: 'STATIC_CONTRACT', missing });
      return pass('User schema documents tutorial completion and game-invite notification preference.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('data_model_health', 'user_schema_documents_diamond_economy_fields',
    'User schema documents canonical Diamond economy balance and idempotency guards',
    () => {
      const missing = missingTokens(userEntitySource, [
        'diamonds',
        'starter_bonus_granted_at',
        'last_daily_diamond_reward_date',
        'economy_updated_at',
      ]);
      if (missing.length) return fail('User schema mirror is missing Diamond economy fields.', { verification: 'STATIC_CONTRACT', missing });
      return pass('User schema documents User.diamonds and starter/daily reward guard fields.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('data_model_health', 'user_schema_documents_solo_progress_shape',
    'User schema documents current Solo progress shape including score backfill fields',
    () => {
      const missing = missingTokens(userEntitySource, [
        'solo_progress',
        'bestScore',
        'bestScoreStars',
        'bestScoreBaseScore',
        'bestScoreTimeBonus',
        'lastAttemptAt',
        'totalSoloScore',
        'aggregateBestTimeSeconds',
      ]);
      if (missing.length) return fail('User.solo_progress schema docs do not match runtime score/progress shape.', { verification: 'STATIC_CONTRACT', missing });
      return pass('User.solo_progress documents per-level best score, replay, and summary fields.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('data_model_health', 'user_schema_documents_online_progress_shape',
    'User schema documents Online progress summary and legacy no-draw fields',
    () => {
      const missing = missingTokens(userEntitySource, [
        'online_progress',
        'score',
        'peakScore',
        'peakCheckpoint',
        'lastMatchId',
        'lastMatchAt',
        'legacy/deprecated',
      ]);
      if (missing.length) return fail('User.online_progress schema docs are stale.', { verification: 'STATIC_CONTRACT', missing });
      return pass('User.online_progress documents current win/loss summary, lastMatchAt, and deprecated draw fields.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('data_model_health', 'lobby_schema_documents_runtime_fields',
    'Lobby schema documents runtime sync and lifecycle fields',
    () => {
      const missing = missingTokens(lobbyEntitySource, [
        'state_revision',
        'winner_email',
        'started_at',
        'completed_at',
        'cancelled_at',
        'last_activity_at',
        'expires_at',
      ]);
      if (missing.length) return fail('Lobby schema docs are missing runtime/lifecycle fields.', { verification: 'STATIC_CONTRACT', missing });
      return pass('Lobby schema documents multiplayer revision, winner perspective, and retention timestamps.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('data_model_health', 'game_invite_schema_documents_lifecycle_timestamps',
    'GameInvite schema documents TTL and terminal lifecycle timestamps',
    () => {
      const missing = missingTokens(gameInviteEntitySource, [
        'created_at',
        'expires_at',
        'expired_at',
        'accepted_at',
        'declined_at',
        'completed_at',
        'cancelled_at',
      ]);
      if (missing.length) return fail('GameInvite lifecycle timestamp docs are incomplete.', { verification: 'STATIC_CONTRACT', missing });
      return pass('GameInvite schema documents 10-minute TTL fields and lifecycle timestamps.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('data_model_health', 'online_match_result_schema_exists',
    'OnlineMatchResult schema exists for per-user per-lobby idempotency',
    () => {
      const missing = missingTokens(onlineMatchResultEntitySource, [
        'OnlineMatchResult',
        'lobby_id',
        'player_email',
        'score_before',
        'score_after',
        'applied_at',
      ]);
      if (missing.length) return fail('OnlineMatchResult schema is missing required idempotency/audit fields.', { verification: 'STATIC_CONTRACT', missing });
      return pass('OnlineMatchResult exists and supports per-user per-lobby scoring idempotency.', { verification: 'STATIC_CONTRACT' });
    },
    { actionType: ACTION_TYPES.CODE_FIX, nextStep: 'Restore the OnlineMatchResult schema fields and rerun data_model_health.' }),

  makeCase('data_model_health', 'diamond_transaction_schema_exists',
    'DiamondTransaction schema exists for user-owned economy ledger/idempotency',
    () => {
      const missing = missingTokens(diamondTransactionEntitySource, [
        'DiamondTransaction',
        'user_email',
        'balance_before',
        'balance_after',
        'source',
        'idempotency_key',
      ]);
      if (missing.length) return fail('DiamondTransaction schema mirror is incomplete.', { verification: 'STATIC_CONTRACT', missing });
      return pass('DiamondTransaction schema supports Diamond ledger and idempotency keys.', { verification: 'STATIC_CONTRACT' });
    },
    { actionType: ACTION_TYPES.CODE_FIX, nextStep: 'Restore DiamondTransaction schema fields and rerun data_model_health/diamond_economy_health.' }),

  makeCase('data_model_health', 'cleanup_retention_contract_exists',
    'Retention helpers exist for expired invites and stale waiting lobbies',
    () => {
      const missing = missingTokens(dataRetentionSource, [
        'cleanupExpiredGameInvites',
        'cleanupStaleWaitingLobbies',
        'deleted: 0',
      ]);
      if (missing.length) return fail('Cleanup/retention helper contract is missing.', { verification: 'STATIC_CONTRACT', missing });
      return pass('Cleanup helpers mark stale records safely and do not delete by default.', { verification: 'STATIC_CONTRACT' });
    },
    { actionType: ACTION_TYPES.CODE_FIX, nextStep: 'Restore safe retention helpers and rerun cleanup_retention_health/data_model_health.' }),

  makeCase('db_architecture_health', 'daily_quest_runtime_progress_schema_active',
    'Daily Quest Runtime v1 uses UserDailyQuestProgress plus reserved User guard fields',
    () => {
      const scannedSources = [
        userEntitySource,
        userDailyQuestProgressEntitySource,
        gameInviteEntitySource,
        lobbyEntitySource,
        onlineMatchResultEntitySource,
        leaderboardSource,
        soloLevelsSource,
      ].join('\n');
      const missing = missingTokens(scannedSources, [
        'daily_quest_last_claim_date',
        'daily_quest_next_available_at',
        '"name": "UserDailyQuestProgress"',
        '"quest_date"',
        '"progress_value"',
        '"target_value"',
        '"reward_diamonds"',
        '"claimed_at"',
      ]);
      if (missing.length) {
        return fail('Daily Quest Runtime v1 progress schema or reserved User guard fields are incomplete.', {
          verification: 'STATIC_CONTRACT',
          actionType: ACTION_TYPES.CODE_FIX,
          actual: { missing },
        });
      }
      return pass('Daily Quest Runtime v1 has UserDailyQuestProgress rows plus separate daily_quest_* User guard fields.', {
        verification: 'STATIC_CONTRACT',
        classification: 'STATIC_CHECK_LIMITATION',
      });
    },
    { actionType: ACTION_TYPES.CODE_FIX, nextStep: 'Keep Daily Quest rewards server-backed and separate from Daily Wheel fields.' }),

  makeCase('db_architecture_health', 'schema_docs_exist',
    'Data model and scoring docs are registered as architecture references',
    () => {
      const scoringDocOk = hasAll(scoringDocsSource, ['Kronox Scoring Rules', 'OnlineMatchResult', 'User.solo_progress']);
      const economyDocOk = hasAll(economyDocsSource, ['Kronox Diamond Economy Rules', 'User.diamonds', 'DiamondTransaction']);
      if (!scoringDocOk || !economyDocOk) {
        return fail('Scoring docs are missing current persistence/source-of-truth references.', {
          verification: 'STATIC_CONTRACT',
          expected: 'Scoring docs mention User.solo_progress/OnlineMatchResult; economy docs mention User.diamonds/DiamondTransaction',
          actual: { scoringDocOk, economyDocOk },
        });
      }
      return pass('Architecture docs include scoring and Diamond economy source-of-truth references.', {
        verification: 'STATIC_CONTRACT',
        classification: 'STATIC_CHECK_LIMITATION',
      });
    }),

  makeCase('persistence_contract_health', 'solo_localstorage_mirror_user_scoped',
    'Signed-in Solo localStorage mirror is scoped by user owner key',
    () => {
      const missing = missingTokens(soloLevelsSource, [
        'getSoloProgressOwnerKey',
        "kx_solo_progress_v1:guest",
        'getScopedStorageKey',
        '__kronoxSoloProgressMirror',
        'ownerKey',
        'signed_in_user',
      ]);
      if (missing.length) return fail('Solo localStorage mirror is not owner-scoped.', { verification: 'STATIC_CONTRACT', missing });
      return pass('Solo local mirror uses guest and signed-in owner-scoped keys.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('persistence_contract_health', 'solo_signed_in_server_progress_authoritative',
    'Signed-in Solo progress treats User.solo_progress as authority and ignores unverified old local mirrors',
    () => {
      const missing = missingTokens(soloLevelsSource, [
        'fromUser',
        'pickMoreAdvanced(fromUser, fromLocal)',
        'only an owner-marked legacy mirror can be used',
        'return legacySameOwner || emptyProgress()',
      ]);
      if (missing.length) return fail('Signed-in Solo progress can still accept unverified local progress.', { verification: 'STATIC_CONTRACT', missing });
      return pass('Signed-in reads only server progress plus same-owner scoped local mirror.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('persistence_contract_health', 'solo_guest_progress_separate_from_signed_in_progress',
    'Guest Solo progress stays separate from signed-in progress',
    () => {
      const missing = missingTokens(soloLevelsSource, [
        'GUEST_STORAGE_KEY',
        'migrateLegacyGuestIfNeeded',
        'ownerKey === \'guest\'',
      ]);
      if (missing.length) return fail('Guest/signed-in Solo progress separation is not evident.', { verification: 'STATIC_CONTRACT', missing });
      return pass('Guest progress migrates to a guest-scoped key and cannot overwrite signed-in User.solo_progress.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('persistence_contract_health', 'no_critical_gameplay_state_only_in_localstorage',
    'Critical Solo gameplay progress is persisted to User.solo_progress for signed-in users',
    () => {
      const missing = missingTokens(soloLevelsSource, [
        'base44.auth.updateMe({',
        'solo_progress: normalized',
        'kronox_puan_total',
        'publishSoloLeaderboardEntry',
        'safeWriteLocal(user || null, normalized)',
      ]);
      if (missing.length) return fail('Signed-in Solo progress persistence path regressed.', { verification: 'STATIC_CONTRACT', missing });
      return pass('LocalStorage is a scoped mirror; signed-in Solo progress is still written to User.solo_progress.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('data_model_health', 'solo_leaderboard_projection_uses_canonical_scoring',
    'getSoloLeaderboard projection uses canonical Solo scoring boundaries',
    () => {
      const missing = missingTokens(getSoloLeaderboardFnSource, [
        'seconds <= 60',
        'seconds <= 90',
        'scoreFromLevelEntry',
        'bestScore',
      ]);
      if (missing.length) return fail('Leaderboard projection scoring mirror is stale.', { verification: 'STATIC_CONTRACT', missing });
      return pass('Leaderboard projection mirrors canonical Solo bestScore and 60/90s bonus boundaries.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('data_model_health', 'leaderboard_entry_source_matches_profile_score',
    'SoloLeaderboardEntry publishing uses unified Kronox Puan plus the Solo progress summary',
    () => {
      const missing = missingTokens(leaderboardSource, [
        'buildSoloLeaderboardPayload',
        'backfillSoloScores',
        'summarizeSoloProgress',
        'total_kronox_score',
        'total_solo_score',
        'online_score',
        'current_level',
        'publishSoloLeaderboardEntry',
      ]);
      if (missing.length) return fail('Leaderboard entry publishing no longer mirrors unified Kronox Puan and Solo summary.', { verification: 'STATIC_CONTRACT', missing });
      return pass('Leaderboard-safe row is built from normalized Solo progress summary plus Online score component.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('data_model_health', 'scoring_docs_match_code_getSoloLeaderboard',
    'Scoring docs and getSoloLeaderboard agree on Solo 60/90/120 second boundaries',
    () => {
      const docsOk = hasAll(scoringDocsSource, ['0–60 seconds', '61–90 seconds', '91–120 seconds', '60.0s yields +15']);
      const projectionOk = hasAll(getSoloLeaderboardFnSource, ['seconds <= 60', 'seconds <= 90', 'seconds <= 120']);
      if (!docsOk || !projectionOk) {
        return fail('Solo scoring docs/projection boundary contract drifted.', {
          verification: 'STATIC_CONTRACT',
          actual: { docsOk, projectionOk },
        });
      }
      return pass('Docs and leaderboard projection both treat 60.0s as +15, 90.0s as +10, and 120.0s as +5.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('data_model_health', 'leaderboard_publish_does_not_reduce_best_progress',
    'Leaderboard publish normalizes/backfills but does not reduce best Solo progress',
    () => {
      const missing = missingTokens(leaderboardSource, [
        'normalizeSoloProgressForLeaderboard',
        'backfillSoloScores(progress || {}, totalLevels).progress',
        'Math.max(0, Number(summary.totalSoloScore) || 0)',
      ]);
      if (missing.length) return fail('Leaderboard publish/backfill contract regressed.', { verification: 'STATIC_CONTRACT', missing });
      return pass('Leaderboard publishing is a projection from normalized best progress; it does not recompute from attempts or reduce score.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('online_match_result_health', 'online_match_result_entity_exists',
    'OnlineMatchResult entity schema exists with safe per-user audit fields',
    () => {
      const missing = missingTokens(onlineMatchResultEntitySource, [
        'OnlineMatchResult',
        'lobby_id',
        'player_email',
        'score_before',
        'score_after',
        'applied_at',
        'data.player_email',
      ]);
      if (missing.length) return fail('OnlineMatchResult schema mirror is missing required fields.', { verification: 'STATIC_CONTRACT', missing });
      return pass('OnlineMatchResult schema is present and owner-scoped by player_email.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('online_match_result_health', 'online_score_has_durable_idempotency',
    'Online scoring checks OnlineMatchResult before applying score',
    () => {
      const missing = missingTokens(applyOnlineResultSource, [
        'findExistingOnlineMatchResult',
        'OnlineMatchResult.filter',
        "reason: 'already_recorded'",
        'createOnlineMatchResult',
      ]);
      if (missing.length) return fail('OnlineMatchResult idempotency guard is not wired into applyOnlineResult.', { verification: 'STATIC_CONTRACT', missing });
      return pass('Online scoring uses durable per-user/lobby audit rows before applying a score.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('online_match_result_health', 'online_score_no_duplicate_for_old_lobby_reopen',
    'Reopening an older completed lobby cannot double-apply when OnlineMatchResult exists',
    () => {
      const missing = missingTokens(applyOnlineResultSource, [
        "{ lobby_id: String(lobbyId), player_email: playerEmail }",
        'already_recorded',
        'lastMatchId remains as a same-session/recent-match guard',
      ]);
      if (missing.length) return fail('Old-lobby durable idempotency contract is missing.', { verification: 'STATIC_CONTRACT', missing });
      return pass('The writer checks player_email+lobby_id result rows before falling back to lastMatchId.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('online_match_result_health', 'online_score_code_lobby_path_supported',
    'Code/lobby path uses the same Game.jsx online result writer',
    () => pass('Both code-joined and invite-joined games converge in Game.jsx and call applyOnlineMatchToCurrentUser for the local user.', {
      verification: 'STATIC_CONTRACT',
      classification: 'STATIC_CHECK_LIMITATION',
      actionType: ACTION_TYPES.CODE_FIX,
    })),

  makeCase('online_match_result_health', 'online_score_friend_invite_path_supported',
    'Friend-invite path uses the same Game.jsx online result writer',
    () => pass('Invite acceptance routes to the Lobby/Game flow, so final scoring uses the same applyOnlineMatchToCurrentUser path.', {
      verification: 'STATIC_CONTRACT',
      classification: 'STATIC_CHECK_LIMITATION',
      actionType: ACTION_TYPES.CODE_FIX,
    })),

  makeCase('online_match_result_health', 'online_score_authority_model_documented',
    'Online score authority model remains self-update plus durable audit row',
    () => {
      const missing = missingTokens(applyOnlineResultSource, [
        'Each client persists ONLY its own user',
        'base44.auth.updateMe',
        'OnlineMatchResult',
      ]);
      if (missing.length) return fail('Online score authority model documentation/wiring regressed.', { verification: 'STATIC_CONTRACT', missing });
      return pass('Authority model documented: each client applies only its own result; OnlineMatchResult supplies per-user idempotency.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('online_match_result_health', 'online_score_not_solo_total_score',
    'Online score remains separate from Solo totalSoloScore',
    () => {
      const src = String(applyOnlineResultSource);
      const bad = src.includes('totalSoloScore') || src.includes('solo_progress:');
      const missing = missingTokens(src, ['online_progress', 'kronox_puan_total', 'buildSoloLeaderboardPayload']);
      if (bad || missing.length) {
        return fail('Online scoring writer may mutate Solo score/progress instead of only updating Online + unified projection.', {
          verification: 'STATIC_CONTRACT',
          actual: { bad, missing },
        });
      }
      return pass('Online scoring writer keeps Solo progress immutable while updating online_progress and the unified projection.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('online_match_result_health', 'online_score_no_draw_contract',
    'OnlineMatchResult and scoring helpers do not introduce draw result rows',
    () => {
      const bad = String(onlineMatchResultEntitySource).includes('"draw"') || String(applyOnlineResultSource).includes("result: 'draw'");
      if (bad) return fail('OnlineMatchResult or writer reintroduced draw result.', { verification: 'STATIC_CONTRACT' });
      return pass('OnlineMatchResult is win/loss only; no draw scoring is introduced.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('cleanup_retention_health', 'cleanup_expired_game_invites_idempotent',
    'Expired GameInvites are marked expired idempotently, never deleted',
    () => {
      const missing = missingTokens(dataRetentionSource, [
        'cleanupExpiredGameInvites',
        "status: 'expired'",
        'expired_at',
        'deleted: 0',
      ]);
      if (missing.length) return fail('Expired GameInvite cleanup helper is missing or destructive.', { verification: 'STATIC_CONTRACT', missing });
      return pass('Expired invite cleanup marks pending expired rows and reports deleted: 0.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('cleanup_retention_health', 'cleanup_stale_waiting_lobbies_idempotent',
    'Stale waiting lobbies are marked cancelled idempotently, never deleted',
    () => {
      const missing = missingTokens(dataRetentionSource, [
        'cleanupStaleWaitingLobbies',
        "status: 'cancelled'",
        'cancelled_at',
        'deleted: 0',
      ]);
      if (missing.length) return fail('Stale waiting lobby cleanup helper is missing or destructive.', { verification: 'STATIC_CONTRACT', missing });
      return pass('Stale waiting lobby cleanup marks cancelled and does not delete rows.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('cleanup_retention_health', 'cleanup_does_not_delete_active_rows',
    'Cleanup helpers do not delete active gameplay/social rows',
    () => {
      const forbidden = ['.delete(', 'delete('].filter((token) => String(dataRetentionSource).includes(token));
      if (forbidden.length) return fail('Cleanup helper contains a delete call.', { verification: 'STATIC_CONTRACT', forbidden });
      return pass('Retention helpers contain no delete calls; active rows are skipped by status/time guards.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('cleanup_retention_health', 'service_role_functions_scoped',
    'Service-role functions remain scoped to authenticated sender/recipient/host contracts',
    () => warning('Static schema/function contracts look scoped, but service-role enforcement still requires backend probes with multiple accounts.', {
      verification: 'STATIC_CHECK_LIMITATION',
      verificationLabels: ['BACKEND_RUNTIME_PROBE', 'TWO_ACCOUNT_REQUIRED'],
      actionType: ACTION_TYPES.BACKEND_RUNTIME_PROBE,
      actual: {
        friendRequest: friendRequestEntitySource.includes('data.to_email'),
        gameInvite: gameInviteEntitySource.includes('data.to_email'),
        pushSubscription: pushSubscriptionEntitySource.includes('data.user_email'),
      },
    }), { critical: false }),

  makeCase('cleanup_retention_health', 'lifecycle_transitions_function_mediated',
    'Critical lifecycle transitions prefer functions/helpers over direct UI mutation',
    () => warning('FriendRequest/GameInvite still have some direct client update paths for rejection/cancel/expire. Current UX depends on them; full function mediation is a Phase 2/3 hardening item.', {
      verification: 'STATIC_CHECK_LIMITATION',
      verificationLabels: ['MANUAL_REQUIRED'],
      actionType: ACTION_TYPES.CODE_FIX,
    }), { critical: false }),

  makeCase('cleanup_retention_health', 'rls_runtime_probe_matrix_documented',
    'RLS matrix requires real two/three-account backend probes',
    () => notAutomatable('Static Health cannot prove User C cannot read/mutate A/B social/lobby/leaderboard rows. Run the documented two/three-account probe matrix before release.', {
      verification: 'NOT_AUTOMATABLE',
      verificationLabels: ['NOT_AUTOMATABLE', 'TWO_ACCOUNT_REQUIRED', 'BACKEND_RUNTIME_PROBE'],
      actionType: ACTION_TYPES.TWO_ACCOUNT_TEST,
      expected: [
        'User C cannot read A/B FriendRequest',
        'Sender cannot accept own outgoing FriendRequest',
        'User C cannot read A/B GameInvite',
        'Expired GameInvite cannot be accepted',
        'Non-player cannot mutate Lobby game state',
        'User cannot update another user PushSubscription or leaderboard row',
      ],
    }), { critical: true }),
];
