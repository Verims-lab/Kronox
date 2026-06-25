// Kronox Health Center — Leaderboard / Liderlik contracts.
//
// Static coverage only. Exact global rank still needs production data with
// multiple real users, but these cases prevent regressions back to private
// User.list reads, placeholder-only UI, fake ranks, or email leakage.

import leaderboardPageSource from '../../pages/LeaderboardPage.jsx?raw';
import settingsPageSource from '../../pages/SettingsPage.jsx?raw';
import leaderboardLibSource from '../../lib/leaderboard.js?raw';
import navigationStackSource from '../../lib/NavigationStackContext.jsx?raw';
import soloLevelsSource from '../../lib/soloLevels.js?raw';
// Codex169 — The backend function (functions/) and entity schema
// (entities/) live OUTSIDE src/, so `?raw` (and the old GitHub-mirror
// `base44/...` paths) return empty here → false FAILs. Read the real
// contract from src-resident mirrors kept in sync with the deployed files.
import { SOLO_LEADERBOARD_ENTITY_SOURCE as soloLeaderboardEntitySource } from '@/lib/healthMirrors/soloLeaderboardEntityMirror';
import { GET_SOLO_LEADERBOARD_SOURCE as getSoloLeaderboardFunctionSource } from '@/lib/healthMirrors/getSoloLeaderboardMirror';
// Codex119 — Section UI moved into a focused component; some state
// strings now live there instead of the page.
import kronoxRankingSectionSource from '../leaderboard/KronoxRankingSection.jsx?raw';
import bottomNavSource from '../layout/BottomNav.jsx?raw';

const STATUS = {
  PASS: 'PASS',
  FAIL: 'FAIL',
  NOT_AUTOMATABLE: 'NOT_AUTOMATABLE',
};

const ACTION_TYPES = {
  CODE_FIX: 'CODE_FIX',
  BACKEND_RUNTIME_PROBE: 'BACKEND_RUNTIME_PROBE',
};

const SUITE_NAMES = {
  leaderboard_health: 'Leaderboard / Liderlik Health Suite',
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
function notAutomatable(reason, extra) {
  return { status: STATUS.NOT_AUTOMATABLE, reason, ...(extra || {}) };
}

function missingTokens(source, tokens) {
  return tokens.filter((token) => !String(source || '').includes(token));
}

function forbiddenTokensFound(source, tokens) {
  return tokens.filter((token) => String(source || '').includes(token));
}

function ordered(source, first, second) {
  const a = String(source || '').indexOf(first);
  const b = String(source || '').indexOf(second);
  return a !== -1 && b !== -1 && a < b;
}

export const EXTRA_SUITES = [
  {
    id: 'leaderboard_health',
    name: SUITE_NAMES.leaderboard_health,
    critical: true,
    color: '#facc15',
  },
];

export const EXTRA_TESTS = [
  makeCase('leaderboard_health', 'leaderboard_public_score_source_exists',
    'Leaderboard uses a public-safe Kronox Puan source, not private full User rows',
    () => {
      const required = missingTokens(`${soloLeaderboardEntitySource}\n${leaderboardLibSource}\n${leaderboardPageSource}\n${getSoloLeaderboardFunctionSource}`, [
        '"name": "SoloLeaderboardEntry"',
        '"owner_key"',
        '"display_name"',
        '"total_kronox_score"',
        '"total_solo_score"',
        '"online_score"',
        '"current_level"',
        'direct entity reads are admin-only',
        'public getSoloLeaderboard strips owner_key/display_name',
        'base44.entities.SoloLeaderboardEntry',
        "base44.functions.invoke('getSoloLeaderboard'",
        'solo_leaderboard_entry_projection',
        'solo_leaderboard_entry_total_kronox_score_projection',
        'loadSoloLeaderboardSnapshot',
      ]);
      const forbidden = forbiddenTokensFound(leaderboardPageSource, [
        'base44.entities.User.list',
        'base44.entities.User.filter',
      ]);
      if (required.length || forbidden.length) {
        return fail('Leaderboard still depends on private/full profile reads or lacks a public score source.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          actionType: ACTION_TYPES.CODE_FIX,
          expected: 'SoloLeaderboardEntry projection-first Kronox Puan source; bounded server-side User repair allowed, no broad User rows shipped to the client',
          actual: { required, forbidden },
        });
      }
      return pass('Leaderboard has a public-safe Kronox Puan source and no longer ranks from full User.list reads on the page.', {
        verification: 'STATIC_CONTRACT',
        classification: 'STATIC_CHECK_LIMITATION',
        actionType: ACTION_TYPES.CODE_FIX,
      });
    }),

  makeCase('leaderboard_health', 'leaderboard_entity_schema_exists',
    'SoloLeaderboardEntry schema exists when entity publishing references it',
    () => {
      const required = missingTokens(`${soloLeaderboardEntitySource}\n${leaderboardLibSource}`, [
        '"name": "SoloLeaderboardEntry"',
        'base44.entities.SoloLeaderboardEntry',
        '"owner_key"',
        '"display_name"',
        '"total_kronox_score"',
        '"total_solo_score"',
        '"online_score"',
        '"current_level"',
      ]);
      if (required.length) {
        return fail('SoloLeaderboardEntry is referenced but the local schema contract is incomplete.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          actionType: ACTION_TYPES.CODE_FIX,
          expected: 'schema filename/name and code reference match SoloLeaderboardEntry',
          actual: { required },
        });
      }
      return pass('SoloLeaderboardEntry schema exists locally and matches the entity reference used for best-effort publishing.', {
        verification: 'STATIC_CONTRACT',
        classification: 'STATIC_CHECK_LIMITATION',
        actionType: ACTION_TYPES.CODE_FIX,
      });
    }),

  makeCase('leaderboard_health', 'leaderboard_projection_index_and_owner_guard',
    'SoloLeaderboardEntry declares projection index intent and dedupes owner rows',
    () => {
      const required = missingTokens(`${soloLeaderboardEntitySource}\n${leaderboardLibSource}\n${getSoloLeaderboardFunctionSource}`, [
        'owner_key is the logical unique key',
        'total_kronox_score desc is the hot leaderboard sort',
        'publishSoloLeaderboardEntry',
        '{ owner_key: payload.owner_key }',
        'dedupeProjectionRows',
        'byOwnerKey',
        'SoloLeaderboardEntry.filter',
        "projectionEntity.list('-total_kronox_score', limit)",
      ]);
      if (required.length) {
        return fail('SoloLeaderboardEntry lacks a clear owner_key uniqueness/sort guard contract.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          actionType: ACTION_TYPES.CODE_FIX,
          expected: 'owner_key logical uniqueness, total_kronox_score desc sort, write-path filter guard, server-side dedupe',
          actual: { required },
        });
      }
      return pass('SoloLeaderboardEntry uses owner_key as the logical unique key, total_kronox_score desc as the hot sort, and server-side dedupe/write guards.', {
        verification: 'STATIC_CONTRACT',
        classification: 'STATIC_CHECK_LIMITATION',
        actionType: ACTION_TYPES.CODE_FIX,
      });
    }),

  makeCase('leaderboard_health', 'leaderboard_missing_schema_regression',
    'Missing SoloLeaderboardEntry runtime schema does not block the leaderboard UI',
    () => {
      const required = missingTokens(`${leaderboardLibSource}\n${leaderboardPageSource}\n${kronoxRankingSectionSource}`, [
        'isMissingSoloLeaderboardEntityError',
        'Entity schema',
        'return []',
        'getSoloLeaderboard',
        'ownPendingRow',
        'rankFinalizing',
      ]);
      if (required.length) {
        return fail('Missing runtime entity schema can still collapse Liderlik into a fallback-only state.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          actionType: ACTION_TYPES.CODE_FIX,
          expected: 'function-first load, missing-schema catch, and current-user pending row',
          actual: { required },
        });
      }
      return pass('Missing SoloLeaderboardEntry runtime schema is handled: function-first load, safe catch, and own score row fallback.', {
        verification: 'STATIC_CONTRACT',
        classification: 'STATIC_CHECK_LIMITATION',
        actionType: ACTION_TYPES.CODE_FIX,
      });
    }),

  makeCase('leaderboard_health', 'leaderboard_entity_reference_matches_schema',
    'Leaderboard entity reference matches the schema and backend projection fallback',
    () => {
      const required = missingTokens(`${soloLeaderboardEntitySource}\n${leaderboardLibSource}\n${getSoloLeaderboardFunctionSource}`, [
        '"name": "SoloLeaderboardEntry"',
        'const SOLO_LEADERBOARD_ENTITY = \'SoloLeaderboardEntry\'',
        'base44.entities.SoloLeaderboardEntry',
        "base44.functions.invoke('getSoloLeaderboard'",
      ]);
      if (required.length) {
        return fail('Leaderboard entity/function references drifted from the schema contract.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          actionType: ACTION_TYPES.CODE_FIX,
          expected: 'SoloLeaderboardEntry schema reference plus getSoloLeaderboard fallback stay aligned',
          actual: { required },
        });
      }
      return pass('Entity reference, local schema, and backend projection fallback are aligned.', {
        verification: 'STATIC_CONTRACT',
        classification: 'STATIC_CHECK_LIMITATION',
        actionType: ACTION_TYPES.CODE_FIX,
      });
    }),

  makeCase('leaderboard_health', 'leaderboard_current_user_score_published',
    'Current user Kronox Puan is mirrored into the leaderboard-safe source',
    () => {
      const required = missingTokens(`${leaderboardLibSource}\n${soloLevelsSource}\n${leaderboardPageSource}`, [
        'publishSoloLeaderboardEntry',
        'buildSoloLeaderboardPayload',
        'total_kronox_score',
        'total_solo_score',
        'online_score',
        'current_level',
        'await publishSoloLeaderboardEntry(user, normalized)',
        'publishSoloLeaderboardEntry(user, currentProgress).catch',
      ]);
      if (required.length) {
        return fail('Current-user Kronox Puan is not clearly published to the leaderboard-safe source.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          actionType: ACTION_TYPES.CODE_FIX,
          expected: 'write/backfill/load paths mirror current user Kronox Puan to SoloLeaderboardEntry',
          actual: { required },
        });
      }
      return pass('Current-user score is mirrored on Solo progress write/backfill and refreshed on Liderlik load.', {
        verification: 'STATIC_CONTRACT',
        classification: 'STATIC_CHECK_LIMITATION',
        actionType: ACTION_TYPES.CODE_FIX,
      });
    }),

  makeCase('leaderboard_health', 'leaderboard_current_user_entry_upsert',
    'Current user leaderboard entry is updated or created without duplicates when the entity is available',
    () => {
      const required = missingTokens(leaderboardLibSource, [
        'SoloLeaderboardEntry.filter',
        '{ owner_key: payload.owner_key }',
        'SoloLeaderboardEntry.update',
        'SoloLeaderboardEntry.create',
        'isMissingSoloLeaderboardEntityError',
      ]);
      if (required.length) {
        return fail('Current-user leaderboard publishing no longer has a safe update/create path.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          actionType: ACTION_TYPES.CODE_FIX,
          expected: 'filter by owner_key, update existing row, create only when missing, tolerate missing runtime schema',
          actual: { required },
        });
      }
      return pass('Current-user leaderboard publishing upserts by owner_key and avoids duplicate rows when the entity is available.', {
        verification: 'STATIC_CONTRACT',
        classification: 'STATIC_CHECK_LIMITATION',
        actionType: ACTION_TYPES.CODE_FIX,
      });
    }),

  makeCase('leaderboard_health', 'leaderboard_does_not_query_private_profile_for_global_table',
    'Liderlik page does not query private full User profiles for the global table',
    () => {
      const forbidden = forbiddenTokensFound(leaderboardPageSource, [
        'base44.entities.User.list',
        'base44.entities.User.filter',
        'base44.asServiceRole.entities.User',
      ]);
      const required = missingTokens(`${leaderboardPageSource}\n${leaderboardLibSource}`, [
        'loadSoloLeaderboardSnapshot',
        "base44.functions.invoke('getSoloLeaderboard'",
      ]);
      if (required.length || forbidden.length) {
        return fail('Global table depends on private User reads from the page instead of a safe leaderboard source.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          actionType: ACTION_TYPES.CODE_FIX,
          expected: 'page calls loadSoloLeaderboardSnapshot; backend reads SoloLeaderboardEntry projection first',
          actual: { required, forbidden },
        });
      }
      return pass('Liderlik page reads through the public-safe leaderboard helper, not private full User rows.', {
        verification: 'STATIC_CONTRACT',
        classification: 'STATIC_CHECK_LIMITATION',
        actionType: ACTION_TYPES.CODE_FIX,
      });
    }),

  makeCase('leaderboard_health', 'leaderboard_safe_backend_projection_exists',
    'Backend leaderboard projection sanitizes internal owner keys before response',
    () => {
      const required = missingTokens(getSoloLeaderboardFunctionSource, [
        'entities?.SoloLeaderboardEntry',
        'projectionEntity.list(\'-total_kronox_score\', limit)',
        "User.list('-kronox_puan_total', limit)",
        'server-side User.list',
        'broadUserRowsReturned: false',
        'serverSideUserRepairUsed',
        'publicLeaderboardId',
        'safePublicUsername',
        'toPublicLeaderboardRow',
        'leaderboard_id',
        'username',
        'total_kronox_score',
        'total_solo_score',
        'online_score',
        'current_level',
        'solo_leaderboard_entry_projection',
      ]);
      const forbidden = forbiddenTokensFound(getSoloLeaderboardFunctionSource, [
        'game_invite_notifications_enabled',
        'PushSubscription',
        'keys_p256dh',
        'keys_auth',
      ]);
      if (required.length || forbidden.length) {
        return fail('Backend leaderboard projection is missing or may return unsafe identity fields.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          actionType: ACTION_TYPES.CODE_FIX,
          expected: 'projection-first service-role read plus bounded repair returns sanitized username/leaderboard_id rows only',
          actual: { required, forbidden },
        });
      }
      return pass('Backend projection reads SoloLeaderboardEntry first and strips owner_key/display_name before returning public rows.', {
        verification: 'STATIC_CONTRACT',
        classification: 'STATIC_CHECK_LIMITATION',
        actionType: ACTION_TYPES.CODE_FIX,
      });
    }),

  makeCase('leaderboard_health', 'completed_guest_leaderboard_access_and_privacy',
    'Completed guests can open Liderlik and appear as username-only rows',
    () => {
      const combined = `${leaderboardPageSource}\n${leaderboardLibSource}\n${soloLeaderboardEntitySource}\n${getSoloLeaderboardFunctionSource}\n${kronoxRankingSectionSource}`;
      const required = missingTokens(combined, [
        'resolveLeaderboardActor',
        'ownerKeyFromGuestId',
        'isGuestProfileComplete',
        'getCompletedGuestCredentialsPayload',
        'getGuestLeaderboardOwnerKey',
        'buildGuestSoloLeaderboardPayload',
        'syncGuestProfileProgress',
        'completedGuestProfile',
        'leaderboardPlayer',
        'leaderboard_id',
        'username',
        'Completed guests can pass guest_id + guest_token',
        'raw guest id',
        'owner_key, player_key',
        'guest_token',
        'display_name',
      ]);
      const forbidden = forbiddenTokensFound(`${leaderboardPageSource}\n${kronoxRankingSectionSource}`, [
        '{row.owner_key}',
        '{row.display_name}',
        '{row.guest_id}',
        '{row.player_key}',
        '{row.email}',
        'row.email}</',
      ]);
      if (required.length || forbidden.length) {
        return fail('Completed guest leaderboard access or public identity privacy contract drifted.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          actionType: ACTION_TYPES.CODE_FIX,
          expected: 'completed guest can call getSoloLeaderboard with token proof; public rows show username/leaderboard_id only and never raw guest/internal/provider fields',
          actual: { required, forbidden },
        });
      }
      return pass('Completed guests can load/publish Liderlik rows with internal g_ owner keys while UI/public payloads stay username-only.', {
        verification: 'STATIC_CONTRACT',
        classification: 'STATIC_CHECK_LIMITATION',
        actionType: ACTION_TYPES.CODE_FIX,
      });
    }),

  makeCase('leaderboard_health', 'leaderboard_projection_completeness_repair',
    'Incomplete projection rows cannot claim exact global rank or crowd out positive scores',
    () => {
      const required = missingTokens(`${leaderboardLibSource}\n${getSoloLeaderboardFunctionSource}`, [
        'findProjectionRepairReason',
        'projection_missing_positive_top_rows',
        'positive_user_score_missing_from_projection',
        'projection_score_stale_below_user_score',
        'projection_score_stale_above_user_score',
        'mergeProjectionAndUserScoreRows',
        'scoreSourceMismatchSummary',
        'scoreSourceMismatches',
        'sourceScoreRepairMode',
        'non_destructive_positive_user_rows_only',
        'computed solo_progress',
        'repairSoloLeaderboardProjection',
        'positiveDecoratedRows',
        'zeroDecoratedRows',
        'rankConfidence',
        'rankScope',
        'limitedRankBeforeExact: true',
        'fallbackUsed',
        'fallbackReason',
        'projectionRowsRead',
        'positiveScoreRowsRead',
        'zeroScoreRowsRead',
        'broadUserRowsReturned',
      ]);
      const limitedRankBeforeExact = ordered(
        getSoloLeaderboardFunctionSource,
        'fallbackUsed',
        'rankConfidence',
      );
      if (required.length || !limitedRankBeforeExact) {
        return fail('Leaderboard can still treat an incomplete SoloLeaderboardEntry projection as a complete global ranking.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          actionType: ACTION_TYPES.CODE_FIX,
          expected: 'bounded server-side repair, explicit rank scope/confidence, positive-score rows before zero-score rows, compact-only response',
          actual: { required, limitedRankBeforeExact },
        });
      }
      return pass('Leaderboard has projection completeness repair and rank diagnostics, and zero-score rows only fill after positive-score rows.', {
        verification: 'STATIC_CONTRACT',
        classification: 'STATIC_CHECK_LIMITATION',
        actionType: ACTION_TYPES.CODE_FIX,
      });
    }),

  makeCase('leaderboard_health', 'leaderboard_compact_endpoint_returns_rank_snapshot',
    'Backend leaderboard endpoint returns compact top/current/friend rank snapshot',
    () => {
      const required = missingTokens(`${leaderboardPageSource}\n${leaderboardLibSource}\n${getSoloLeaderboardFunctionSource}`, [
        'loadSoloLeaderboardSnapshot',
        'topRows',
        'currentUserRow',
        'currentUserRank',
        'friendsOutsideTop',
        'generatedAt',
        'rankConfidence',
        'rankScope',
        'rows: publicCompactResponseRows',
        'topRows: publicTopRows',
        'currentUserRow: publicCurrentUserRow',
        'getFriendLeaderboardKeys',
        'loadFriends',
      ]);
      const forbidden = [];
      if (required.length || forbidden.length) {
        return fail('Leaderboard endpoint/client can still ship broad rows or miss accepted friend-key badge metadata.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          actionType: ACTION_TYPES.CODE_FIX,
          expected: 'getSoloLeaderboard compact payload includes sanitized top/current/friend/rank metadata; page may still use accepted loadFriends rows for local fallback badges',
          actual: { required, forbidden },
        });
      }
      return pass('Leaderboard consumes a compact backend snapshot with sanitized top rows, current-user rank metadata, and friend markers.', {
        verification: 'STATIC_CONTRACT',
        classification: 'STATIC_CHECK_LIMITATION',
        actionType: ACTION_TYPES.CODE_FIX,
      });
    }),

  makeCase('leaderboard_health', 'leaderboard_safe_fields_only',
    'Leaderboard public response avoids private notification, push, auth, owner key, and email fields',
    () => {
      const combined = `${soloLeaderboardEntitySource}\n${getSoloLeaderboardFunctionSource}`;
      const required = missingTokens(combined, [
        'direct entity reads are admin-only',
        'public getSoloLeaderboard strips owner_key/display_name',
        'leaderboard_id',
        'username',
        'total_kronox_score',
        'total_solo_score',
        'online_score',
        'current_level',
        'total_stars',
        'updated_at',
      ]);
      const forbidden = forbiddenTokensFound(combined, [
        'game_invite_notifications_enabled',
        'PushSubscription',
        'keys_p256dh',
        'keys_auth',
        '"email"',
        '"user_email"',
      ]);
      if (required.length || forbidden.length) {
        return fail('Leaderboard-safe source exposes or references fields outside the rank contract.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          actionType: ACTION_TYPES.CODE_FIX,
          expected: 'internal entity admin-only; public response uses username/leaderboard_id and no email/notification/push/auth fields',
          actual: { required, forbidden },
        });
      }
      return pass('Leaderboard public function response exposes only sanitized ranking fields; internal projection remains admin-only for direct reads.', {
        verification: 'STATIC_CONTRACT',
        classification: 'STATIC_CHECK_LIMITATION',
        actionType: ACTION_TYPES.CODE_FIX,
      });
    }),

  makeCase('leaderboard_health', 'leaderboard_uses_unified_kronox_puan',
    'Leaderboard ranks by unified Kronox Puan before level/stars/time tie-breakers',
    () => {
      const required = missingTokens(leaderboardLibSource, [
        'rankSoloLeaderboardEntries',
        'summary.totalKronoxScore',
        'scoreDiff = b.summary.totalKronoxScore - a.summary.totalKronoxScore',
        'levelDiff = b.summary.currentLevel - a.summary.currentLevel',
        'starsDiff = b.summary.totalStars - a.summary.totalStars',
      ]);
      const totalBeforeStars = ordered(
        leaderboardLibSource,
        'scoreDiff = b.summary.totalKronoxScore - a.summary.totalKronoxScore',
        'starsDiff = b.summary.totalStars - a.summary.totalStars',
      );
      if (required.length || !totalBeforeStars) {
        return fail('Leaderboard ranking no longer prioritizes unified Kronox Puan.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          actionType: ACTION_TYPES.CODE_FIX,
          expected: 'totalKronoxScore primary, then level/stars/time tie-breakers',
          actual: { required, totalBeforeStars },
        });
      }
      return pass('Leaderboard ranking uses unified Kronox Puan as the primary rank signal.', {
        verification: 'STATIC_CONTRACT',
        classification: 'STATIC_CHECK_LIMITATION',
        actionType: ACTION_TYPES.CODE_FIX,
      });
    }),

  makeCase('leaderboard_health', 'leaderboard_global_table_not_fallback_when_data_exists',
    'Available leaderboard entries render rows instead of fallback-only copy',
    () => {
      const combined = `${leaderboardPageSource}\n${kronoxRankingSectionSource}`;
      const required = missingTokens(combined, [
        'leaderboard.topRows.map',
        'LeaderboardRow',
        'RankingPreparingState',
        '!hasRows',
      ]);
      if (required.length) {
        return fail('Leaderboard UI no longer distinguishes real rows from fallback-only state.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          actionType: ACTION_TYPES.CODE_FIX,
          expected: 'render topRows when available; fallback only when table source is unavailable',
          actual: { required },
        });
      }
      return pass('Leaderboard rows render when entries exist; fallback is isolated to unavailable/finalizing states.', {
        verification: 'STATIC_CONTRACT',
        classification: 'STATIC_CHECK_LIMITATION',
        actionType: ACTION_TYPES.CODE_FIX,
      });
    }),

  makeCase('leaderboard_health', 'leaderboard_top_10_or_available_users',
    'Leaderboard shows top 10 or fewer real available entries without fake rows',
    () => {
      // Codex119 — `leaderboard.topRows.map` now lives in the extracted
      // section component; include it in the combined source for the
      // token check.
      const combined = `${leaderboardPageSource}\n${leaderboardLibSource}\n${kronoxRankingSectionSource}`;
      const required = missingTokens(combined, [
        'LEADERBOARD_TOP_LIMIT = 10',
        'topRows',
        'slice(0, topLimit)',
        'leaderboard.topRows.map',
      ]);
      const forbidden = forbiddenTokensFound(`${leaderboardPageSource}\n${kronoxRankingSectionSource}`, [
        'Array.from({ length: 10',
        'mockUsers',
        'fakeUsers',
      ]);
      if (required.length || forbidden.length) {
        return fail('Top-10 real-entry leaderboard contract drifted.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          actionType: ACTION_TYPES.CODE_FIX,
          expected: 'render only rows returned by the real ranked list',
          actual: { required, forbidden },
        });
      }
      return pass('Top list renders the first 10 ranked real entries, or fewer if fewer exist.', {
        verification: 'STATIC_CONTRACT',
        classification: 'STATIC_CHECK_LIMITATION',
        actionType: ACTION_TYPES.CODE_FIX,
      });
    }),

  makeCase('leaderboard_health', 'leaderboard_current_user_rank_visible',
    'Current user is highlighted in top 10 or shown separately as Senin Sıran / own score',
    () => {
      // Codex119 — "Benim Sıram" copy lives in the extracted section
      // component now; widen the source surface for the token check.
      const combined = `${leaderboardPageSource}\n${leaderboardLibSource}\n${kronoxRankingSectionSource}`;
      const required = missingTokens(combined, [
        'currentUserRow',
        'currentUserInTop',
        'Senin Sıran',
        'Senin Puanın',
        'isCurrentUser',
        'ownScoreRow',
      ]);
      if (required.length) {
        return fail('Current-user rank visibility contract is missing.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          actionType: ACTION_TYPES.CODE_FIX,
          expected: 'highlight current user, show own-rank row, or show own score while rank finalizes',
          actual: { required },
        });
      }
      return pass('Current user is visible as a highlighted rank row or an own-score row while rank finalizes.', {
        verification: 'STATIC_CONTRACT',
        classification: 'STATIC_CHECK_LIMITATION',
        actionType: ACTION_TYPES.CODE_FIX,
      });
    }),

  makeCase('leaderboard_health', 'leaderboard_friend_markers_safe',
    'Friend rows are marked server-side from real accepted friends without returning owner keys',
    () => {
      // Codex119 — friend marker strings/badges live in the section
      // component; data wiring (loadFriends, friendEmailSet, isFriend)
      // stays on the page + lib. Combine all three sources.
      const combined = `${leaderboardPageSource}\n${leaderboardLibSource}\n${kronoxRankingSectionSource}\n${getSoloLeaderboardFunctionSource}`;
      const required = missingTokens(combined, [
        'loadFriends',
        'friend.friend_email',
        'getFriendLeaderboardKeys',
        'loadAcceptedFriendOwnerKeys',
        'publicFriendsOutsideTop',
        'leaderboard_id',
        'isFriend',
        'Arkadaş',
        'Arkadaşların',
      ]);
      const forbidden = forbiddenTokensFound(`${leaderboardPageSource}\n${kronoxRankingSectionSource}\n${getSoloLeaderboardFunctionSource}`, [
        'mockFriends',
        'fakeFriends',
      ]);
      if (required.length || forbidden.length) {
        return fail('Friend marker contract drifted.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          actionType: ACTION_TYPES.CODE_FIX,
          expected: 'accepted friends only, matched server-side by internal owner keys, returned as sanitized friend badges',
          actual: { required, forbidden },
        });
      }
      return pass('Friend rows are driven by accepted friend data and returned with sanitized friend badges; no fake friend rows.', {
        verification: 'STATIC_CONTRACT',
        classification: 'STATIC_CHECK_LIMITATION',
        actionType: ACTION_TYPES.CODE_FIX,
      });
    }),

  makeCase('leaderboard_health', 'leaderboard_no_fake_users_or_ranks',
    'Leaderboard production path contains no mock users or invented ranks',
    () => {
      // Codex119 — include the extracted section component in the scan
      // surface so the fake-data ban applies there as well.
      const forbidden = forbiddenTokensFound(
        `${leaderboardPageSource}\n${leaderboardLibSource}\n${kronoxRankingSectionSource}`,
        [
          'Math.random',
          'mockUsers',
          'fakeUsers',
          'mockRank',
          'fakeRank',
          'rank: 1, displayName',
        ],
      );
      if (forbidden.length) {
        return fail('Leaderboard appears to include fake data markers.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          actionType: ACTION_TYPES.CODE_FIX,
          expected: 'real leaderboard entries only; no invented users/ranks',
          actual: { forbidden },
        });
      }
      return pass('No mock-user or invented-rank markers are present in the leaderboard path.', {
        verification: 'STATIC_CONTRACT',
        classification: 'STATIC_CHECK_LIMITATION',
        actionType: ACTION_TYPES.CODE_FIX,
      });
    }),

  makeCase('leaderboard_health', 'leaderboard_safe_identity_display',
    'Leaderboard identity is username-only and avoids internal owner keys',
    () => {
      // Codex119 — row rendering now lives in the section component;
      // include it in both the required- and forbidden-token surfaces.
      const combined = `${soloLeaderboardEntitySource}\n${leaderboardPageSource}\n${leaderboardLibSource}\n${kronoxRankingSectionSource}`;
      const required = missingTokens(combined, [
        'getSafeLeaderboardName',
        'isSafePublicUsername',
        'username',
        'leaderboard_id',
        'displayName',
        'direct entity reads are admin-only',
      ]);
      const entityForbidden = forbiddenTokensFound(soloLeaderboardEntitySource, [
        '"user_email"',
        '"email"',
      ]);
      const renderForbidden = forbiddenTokensFound(`${leaderboardPageSource}\n${kronoxRankingSectionSource}`, [
        '{row.email}',
        'row.email}</',
      ]);
      const forbidden = [...entityForbidden, ...renderForbidden];
      if (required.length || forbidden.length) {
        return fail('Safe identity display contract drifted.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          actionType: ACTION_TYPES.CODE_FIX,
          expected: 'display username/publicName from sanitized rows, never raw email/provider/internal owner keys',
          actual: { required, forbidden },
        });
      }
      return pass('Leaderboard rows render username-only public identity from sanitized rows rather than raw private emails or owner keys.', {
        verification: 'STATIC_CONTRACT',
        classification: 'STATIC_CHECK_LIMITATION',
        actionType: ACTION_TYPES.CODE_FIX,
      });
    }),

  makeCase('leaderboard_health', 'own_row_opens_profile_settings_only',
    'Current user leaderboard row opens Profile Settings without making other rows private links',
    () => {
      const required = missingTokens(`${leaderboardPageSource}\n${kronoxRankingSectionSource}\n${settingsPageSource}\n${bottomNavSource}\n${navigationStackSource}`, [
        'openCurrentUserProfileSettings',
        "navigate('/settings?focus=profile'",
        "source: 'leaderboard_self_row'",
        'focusProfileSettings: true',
        'onCurrentUserRowOpenSettings',
        "row.isCurrentUser && typeof onOpenSettings === 'function'",
        'aria-label="Profil ayarlarını aç"',
        'Badge text="Sen"',
        'data-kx-profile-settings-anchor="true"',
        'shouldFocusProfileSettings',
        'Profil Bilgileri',
        'name="username"',
        "['/profile', '/friends', '/settings', '/admin', '/test-suite', '/account-deletion']",
        "Ana Sayfa",
        "Liderlik",
        "Profil",
      ]);
      const forbidden = forbiddenTokensFound(`${leaderboardPageSource}\n${kronoxRankingSectionSource}`, [
        'row.email',
        'row.owner_key',
        'row.ownerKey}</',
        'raw_guest_id',
        'internal player_key',
      ]);
      if (required.length || forbidden.length) {
        return fail('Own leaderboard-row Profile Settings navigation contract drifted.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          actionType: ACTION_TYPES.CODE_FIX,
          expected: 'only row.isCurrentUser/Sen row is a button to /settings?focus=profile; Settings anchors Profil Bilgileri; BottomNav remains Ana Sayfa/Liderlik/Profil; no private IDs rendered',
          actual: { required, forbidden },
        });
      }
      return pass('Only the current-user leaderboard row can open Profile Settings, Settings deep-links to Profil Bilgileri, and BottomNav/public identity contracts stay intact.', {
        verification: 'STATIC_CONTRACT',
        classification: 'STATIC_CHECK_LIMITATION',
        actionType: ACTION_TYPES.CODE_FIX,
      });
    }),

  /*
   * Codex119 — Updated for the graceful-fallback rewrite. The "Kronox
   * Sıralaması" UI now lives in components/leaderboard/KronoxRankingSection.
   * The harsh "Sıralama şu an yüklenemedi" wording has been replaced by a
   * neutral "Kronox sıralaması hazırlanıyor." placeholder, so this case
   * now scans BOTH source files and requires the NEW friendly copy.
   * The new `leaderboard_fallback` suite covers the deeper contracts
   * (own-score visibility, admin diagnostics, no scary backend wording).
  */
  makeCase('leaderboard_health', 'leaderboard_empty_state_safe',
    'Leaderboard has loading, no-user, no-friend, fallback, and retry states',
    () => {
      const combined = `${leaderboardPageSource}\n${kronoxRankingSectionSource}`;
      const required = missingTokens(combined, [
        'Sıralama yükleniyor',
        'Arkadaşlarını davet et, sıralamada yarışın',
        'Arkadaşların puan aldıkça burada görünecek',
        'Kronox sıralaması hazırlanıyor',
        'Puanın kaydedildi. Kısa süre içinde sıralamada görünecek',
        'Tekrar Dene',
      ]);
      const forbidden = forbiddenTokensFound(combined, [
        'Backend tüm kullanıcı',
        'Veri uydurulmadı',
      ]);
      if (required.length || forbidden.length) {
        return fail('Leaderboard empty/fallback state coverage drifted.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          actionType: ACTION_TYPES.CODE_FIX,
          expected: 'non-crashing product copy for loading/empty/friendless/finalizing/retry',
          actual: { required, forbidden },
        });
      }
      return pass('Leaderboard exposes safe product-copy states for loading, empty, no-friend, finalizing, and retry.', {
        verification: 'STATIC_CONTRACT',
        classification: 'STATIC_CHECK_LIMITATION',
        actionType: ACTION_TYPES.CODE_FIX,
      });
    }),

  makeCase('leaderboard_health', 'leaderboard_runtime_backend_rank_probe',
    'Real multi-user global rank proof requires public leaderboard rows in backend',
    () => notAutomatable('Static checks prove the public leaderboard source and UI contract, but exact global rank still requires a real backend probe with multiple SoloLeaderboardEntry rows and production read/update permissions.', {
      verification: 'NOT_AUTOMATABLE',
      classification: 'STATIC_CHECK_LIMITATION',
      verificationLabels: ['NOT_AUTOMATABLE', 'BACKEND_RUNTIME_PROBE'],
      actionType: ACTION_TYPES.BACKEND_RUNTIME_PROBE,
      expected: 'multiple real users mirrored to SoloLeaderboardEntry and ranked by unified Kronox Puan',
      actual: 'static contract only',
    }), { actionType: ACTION_TYPES.BACKEND_RUNTIME_PROBE, critical: false }),
];
