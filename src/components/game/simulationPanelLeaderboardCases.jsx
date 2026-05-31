// Kronox Health Center — Leaderboard / Liderlik contracts.
//
// Static coverage only. Exact global rank still needs production data with
// multiple real users, but these cases prevent regressions back to private
// User.list reads, placeholder-only UI, fake ranks, or email leakage.

import leaderboardPageSource from '../../pages/LeaderboardPage.jsx?raw';
import leaderboardLibSource from '../../lib/leaderboard.js?raw';
import soloLevelsSource from '../../lib/soloLevels.js?raw';
import soloLeaderboardEntitySource from '../../../base44/entities/SoloLeaderboardEntry.jsonc?raw';

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
    'Leaderboard uses a public-safe SoloLeaderboardEntry source, not private full User rows',
    () => {
      const required = missingTokens(`${soloLeaderboardEntitySource}\n${leaderboardLibSource}\n${leaderboardPageSource}`, [
        '"name": "SoloLeaderboardEntry"',
        '"owner_key"',
        '"display_name"',
        '"total_solo_score"',
        '"current_level"',
        '"read": {}',
        'base44.entities.SoloLeaderboardEntry',
        'loadSoloLeaderboardEntries',
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
          expected: 'SoloLeaderboardEntry public-safe source; no User.list production dependency',
          actual: { required, forbidden },
        });
      }
      return pass('Leaderboard has a public-safe SoloLeaderboardEntry source and no longer ranks from full User.list reads.', {
        verification: 'STATIC_CONTRACT',
        classification: 'STATIC_CHECK_LIMITATION',
        actionType: ACTION_TYPES.CODE_FIX,
      });
    }),

  makeCase('leaderboard_health', 'leaderboard_current_user_score_published',
    'Current user Solo score is mirrored into the leaderboard-safe source',
    () => {
      const required = missingTokens(`${leaderboardLibSource}\n${soloLevelsSource}\n${leaderboardPageSource}`, [
        'publishSoloLeaderboardEntry',
        'buildSoloLeaderboardPayload',
        'total_solo_score',
        'current_level',
        'await publishSoloLeaderboardEntry(user, normalized)',
        'publishSoloLeaderboardEntry(user, progress).catch',
        'publishSoloLeaderboardEntry(user, currentProgress)',
      ]);
      if (required.length) {
        return fail('Current-user Solo score is not clearly published to the leaderboard-safe source.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          actionType: ACTION_TYPES.CODE_FIX,
          expected: 'write/backfill/load paths mirror current user score to SoloLeaderboardEntry',
          actual: { required },
        });
      }
      return pass('Current-user score is mirrored on Solo progress write/backfill and refreshed on Liderlik load.', {
        verification: 'STATIC_CONTRACT',
        classification: 'STATIC_CHECK_LIMITATION',
        actionType: ACTION_TYPES.CODE_FIX,
      });
    }),

  makeCase('leaderboard_health', 'leaderboard_uses_total_solo_score',
    'Leaderboard ranks by total_solo_score before level/stars/time tie-breakers',
    () => {
      const required = missingTokens(leaderboardLibSource, [
        'rankSoloLeaderboardEntries',
        'summary.totalSoloScore',
        'scoreDiff = b.summary.totalSoloScore - a.summary.totalSoloScore',
        'levelDiff = b.summary.currentLevel - a.summary.currentLevel',
        'starsDiff = b.summary.totalStars - a.summary.totalStars',
      ]);
      const totalBeforeStars = ordered(
        leaderboardLibSource,
        'scoreDiff = b.summary.totalSoloScore - a.summary.totalSoloScore',
        'starsDiff = b.summary.totalStars - a.summary.totalStars',
      );
      if (required.length || !totalBeforeStars) {
        return fail('Leaderboard ranking no longer prioritizes totalSoloScore.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          actionType: ACTION_TYPES.CODE_FIX,
          expected: 'totalSoloScore primary, then level/stars/time tie-breakers',
          actual: { required, totalBeforeStars },
        });
      }
      return pass('Leaderboard ranking uses totalSoloScore as the primary rank signal.', {
        verification: 'STATIC_CONTRACT',
        classification: 'STATIC_CHECK_LIMITATION',
        actionType: ACTION_TYPES.CODE_FIX,
      });
    }),

  makeCase('leaderboard_health', 'leaderboard_global_table_not_fallback_when_data_exists',
    'Available leaderboard entries render rows instead of fallback-only copy',
    () => {
      const required = missingTokens(leaderboardPageSource, [
        'leaderboard.topRows.map',
        'LeaderboardRow',
        'showOwnScoreFallback',
        'PendingLeaderboardState',
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
      const required = missingTokens(`${leaderboardPageSource}\n${leaderboardLibSource}`, [
        'LEADERBOARD_TOP_LIMIT = 10',
        'topRows',
        'slice(0, topLimit)',
        'leaderboard.topRows.map',
      ]);
      const forbidden = forbiddenTokensFound(leaderboardPageSource, [
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
      const required = missingTokens(`${leaderboardPageSource}\n${leaderboardLibSource}`, [
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
    'Friend rows are marked by public-safe owner keys from real accepted friends',
    () => {
      const required = missingTokens(`${leaderboardPageSource}\n${leaderboardLibSource}`, [
        'loadFriends',
        'friend.friend_email',
        'getFriendLeaderboardKeys',
        'friendKeySet',
        'owner_key',
        'isFriend',
        'Arkadaş',
        'Arkadaşların',
      ]);
      const forbidden = forbiddenTokensFound(leaderboardPageSource, [
        'mockFriends',
        'fakeFriends',
      ]);
      if (required.length || forbidden.length) {
        return fail('Friend marker contract drifted.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          actionType: ACTION_TYPES.CODE_FIX,
          expected: 'accepted friends only, matched by safe owner_key, marked in real ranked rows',
          actual: { required, forbidden },
        });
      }
      return pass('Friend rows are driven by accepted friend data and safe owner keys; no fake friend rows.', {
        verification: 'STATIC_CONTRACT',
        classification: 'STATIC_CHECK_LIMITATION',
        actionType: ACTION_TYPES.CODE_FIX,
      });
    }),

  makeCase('leaderboard_health', 'leaderboard_no_fake_users_or_ranks',
    'Leaderboard production path contains no mock users or invented ranks',
    () => {
      const forbidden = forbiddenTokensFound(`${leaderboardPageSource}\n${leaderboardLibSource}`, [
        'Math.random',
        'mockUsers',
        'fakeUsers',
        'mockRank',
        'fakeRank',
        'rank: 1, displayName',
      ]);
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
    'Leaderboard display names avoid exposing private email addresses',
    () => {
      const required = missingTokens(`${soloLeaderboardEntitySource}\n${leaderboardPageSource}\n${leaderboardLibSource}`, [
        'getSafeLeaderboardName',
        'display_name',
        'owner_key',
        'displayName',
      ]);
      const entityForbidden = forbiddenTokensFound(soloLeaderboardEntitySource, [
        '"user_email"',
        '"email"',
      ]);
      const renderForbidden = forbiddenTokensFound(leaderboardPageSource, [
        '{row.email}',
        'row.email}</',
      ]);
      const forbidden = [...entityForbidden, ...renderForbidden];
      if (required.length || forbidden.length) {
        return fail('Safe identity display contract drifted.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          actionType: ACTION_TYPES.CODE_FIX,
          expected: 'display safe names/initials and public owner_key, never raw email rows',
          actual: { required, forbidden },
        });
      }
      return pass('Leaderboard rows render safe display names and public owner keys rather than raw private emails.', {
        verification: 'STATIC_CONTRACT',
        classification: 'STATIC_CHECK_LIMITATION',
        actionType: ACTION_TYPES.CODE_FIX,
      });
    }),

  makeCase('leaderboard_health', 'leaderboard_empty_state_safe',
    'Leaderboard has loading, no-user, no-friend, fallback, and retry states',
    () => {
      const required = missingTokens(leaderboardPageSource, [
        'Sıralama yükleniyor',
        'Henüz sıralama verisi yok',
        'Arkadaşlarını davet et, sıralamada yarışın',
        'Arkadaşların puan aldıkça burada görünecek',
        'Kronox sıralaması hazırlanıyor',
        'Puanın kaydedildi. Kısa süre içinde sıralamada görünecek',
        'Tekrar Dene',
      ]);
      const forbidden = forbiddenTokensFound(leaderboardPageSource, [
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
      expected: 'multiple real users mirrored to SoloLeaderboardEntry and ranked by totalSoloScore',
      actual: 'static contract only',
    }), { actionType: ACTION_TYPES.BACKEND_RUNTIME_PROBE, critical: false }),
];
