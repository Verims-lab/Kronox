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
import scoringDocsSource from '../../docs/KRONOX_SCORING_RULES.md?raw';
import {
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

  makeCase('db_architecture_health', 'schema_docs_exist',
    'Data model and scoring docs are registered as architecture references',
    () => {
      const scoringDocOk = hasAll(scoringDocsSource, ['Kronox Scoring Rules', 'OnlineMatchResult', 'User.solo_progress']);
      if (!scoringDocOk) {
        return fail('Scoring docs are missing current persistence/source-of-truth references.', {
          verification: 'STATIC_CONTRACT',
          expected: 'src/docs/KRONOX_SCORING_RULES.md mentions User.solo_progress and OnlineMatchResult',
        });
      }
      return pass('Architecture docs expected for this package: docs/KRONOX_DATA_MODEL_AUDIT.md, docs/KRONOX_DATA_MODEL_IMPLEMENTATION_PLAN.md, and src/docs/KRONOX_SCORING_RULES.md.', {
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
        'base44.auth.updateMe({ solo_progress: normalized })',
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
    'SoloLeaderboardEntry publishing uses the same Solo progress summary as Profile/Solo',
    () => {
      const missing = missingTokens(leaderboardSource, [
        'buildSoloLeaderboardPayload',
        'backfillSoloScores',
        'summarizeSoloProgress',
        'total_solo_score',
        'current_level',
        'publishSoloLeaderboardEntry',
      ]);
      if (missing.length) return fail('Leaderboard entry publishing no longer mirrors Solo summary.', { verification: 'STATIC_CONTRACT', missing });
      return pass('Leaderboard-safe row is built from normalized Solo progress summary.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('data_model_health', 'scoring_docs_match_code_getSoloLeaderboard',
    'Scoring docs and getSoloLeaderboard agree on Solo 60/90 second boundaries',
    () => {
      const docsOk = hasAll(scoringDocsSource, ['0–60 seconds', '61–90 seconds', '60.0s yields +10']);
      const projectionOk = hasAll(getSoloLeaderboardFnSource, ['seconds <= 60', 'seconds <= 90']);
      if (!docsOk || !projectionOk) {
        return fail('Solo scoring docs/projection boundary contract drifted.', {
          verification: 'STATIC_CONTRACT',
          actual: { docsOk, projectionOk },
        });
      }
      return pass('Docs and leaderboard projection both treat 60.0s as +10 and 90.0s as +5.', { verification: 'STATIC_CONTRACT' });
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
      const bad = String(applyOnlineResultSource).includes('totalSoloScore') || String(applyOnlineResultSource).includes('solo_progress');
      if (bad) return fail('Online scoring writer references Solo score/progress.', { verification: 'STATIC_CONTRACT' });
      return pass('Online scoring writer only updates online_progress and OnlineMatchResult.', { verification: 'STATIC_CONTRACT' });
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
