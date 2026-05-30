// Kronox Health Center — Leaderboard / Liderlik contracts.
//
// Static coverage only. Real all-user rank correctness still needs backend
// data access with multiple real users; this suite prevents the UI from
// drifting back to placeholders, stars-as-score, fake ranks, or email leakage.

import leaderboardPageSource from '../../pages/LeaderboardPage.jsx?raw';
import leaderboardLibSource from '../../lib/leaderboard.js?raw';

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
  makeCase('leaderboard_health', 'leaderboard_uses_total_solo_score',
    'Leaderboard ranks by totalSoloScore before level/stars/time tie-breakers',
    () => {
      const required = missingTokens(leaderboardLibSource, [
        'rankSoloLeaderboardUsers',
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

  makeCase('leaderboard_health', 'leaderboard_shows_top_10_or_available_users',
    'Leaderboard shows top 10 or fewer real available users without fake rows',
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
        return fail('Top-10 real-user leaderboard contract drifted.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          actionType: ACTION_TYPES.CODE_FIX,
          expected: 'render only rows returned by the real ranked list',
          actual: { required, forbidden },
        });
      }
      return pass('Top list renders the first 10 ranked real rows, or fewer if fewer exist.', {
        verification: 'STATIC_CONTRACT',
        classification: 'STATIC_CHECK_LIMITATION',
        actionType: ACTION_TYPES.CODE_FIX,
      });
    }),

  makeCase('leaderboard_health', 'leaderboard_current_user_rank_visible',
    'Current user is highlighted in top 10 or shown separately as Benim Sıram',
    () => {
      const required = missingTokens(`${leaderboardPageSource}\n${leaderboardLibSource}`, [
        'currentUserRow',
        'currentUserInTop',
        'Benim Sıram',
        'isCurrentUser',
      ]);
      if (required.length) {
        return fail('Current-user rank visibility contract is missing.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          actionType: ACTION_TYPES.CODE_FIX,
          expected: 'highlight current user or render separate own-rank row',
          actual: { required },
        });
      }
      return pass('Current-user rank is visible without duplicating the row when already in top 10.', {
        verification: 'STATIC_CONTRACT',
        classification: 'STATIC_CHECK_LIMITATION',
        actionType: ACTION_TYPES.CODE_FIX,
      });
    }),

  makeCase('leaderboard_health', 'leaderboard_friend_rows_marked',
    'Friend rows are marked from accepted FriendRequest data and no fake friends are generated',
    () => {
      const required = missingTokens(`${leaderboardPageSource}\n${leaderboardLibSource}`, [
        'loadFriends',
        'friend.friend_email',
        'friendEmailSet',
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
          expected: 'accepted friends only, marked in real ranked rows',
          actual: { required, forbidden },
        });
      }
      return pass('Friend rows are driven by accepted friend data and marked without fake friend rows.', {
        verification: 'STATIC_CONTRACT',
        classification: 'STATIC_CHECK_LIMITATION',
        actionType: ACTION_TYPES.CODE_FIX,
      });
    }),

  makeCase('leaderboard_health', 'leaderboard_no_fake_data',
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
          expected: 'real User rows only; no invented users/ranks',
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
      const required = missingTokens(`${leaderboardPageSource}\n${leaderboardLibSource}`, [
        'getSafeLeaderboardName',
        "split('@')[0]",
        'displayName',
      ]);
      const forbidden = forbiddenTokensFound(leaderboardPageSource, [
        '{row.email}',
        'row.email}</',
      ]);
      if (required.length || forbidden.length) {
        return fail('Safe identity display contract drifted.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          actionType: ACTION_TYPES.CODE_FIX,
          expected: 'display safe name/local-part fallback, never raw email rows',
          actual: { required, forbidden },
        });
      }
      return pass('Leaderboard rows render safe display names rather than raw private emails.', {
        verification: 'STATIC_CONTRACT',
        classification: 'STATIC_CHECK_LIMITATION',
        actionType: ACTION_TYPES.CODE_FIX,
      });
    }),

  makeCase('leaderboard_health', 'leaderboard_empty_state_safe',
    'Leaderboard has loading, no-user, no-friend, and backend-error states',
    () => {
      const required = missingTokens(leaderboardPageSource, [
        'Sıralama yükleniyor',
        'Henüz sıralama verisi yok',
        'Arkadaşlarını davet et, sıralamada yarışın',
        'Arkadaşların puan aldıkça burada görünecek',
        'Sıralama şu an yüklenemedi',
        'Tekrar Dene',
      ]);
      if (required.length) {
        return fail('Leaderboard empty/error state coverage drifted.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          actionType: ACTION_TYPES.CODE_FIX,
          expected: 'non-crashing states for loading/empty/friendless/backend error',
          actual: { required },
        });
      }
      return pass('Leaderboard exposes safe loading, empty, no-friend, and backend-error states.', {
        verification: 'STATIC_CONTRACT',
        classification: 'STATIC_CHECK_LIMITATION',
        actionType: ACTION_TYPES.CODE_FIX,
      });
    }),

  makeCase('leaderboard_health', 'leaderboard_runtime_backend_rank_probe',
    'Real multi-user global rank proof requires backend data access',
    () => notAutomatable('Static checks prove the UI/data contract, but exact global rank still requires a real backend probe with multiple User.solo_progress rows and production read permissions.', {
      verification: 'NOT_AUTOMATABLE',
      classification: 'STATIC_CHECK_LIMITATION',
      verificationLabels: ['NOT_AUTOMATABLE', 'BACKEND_RUNTIME_PROBE'],
      actionType: ACTION_TYPES.BACKEND_RUNTIME_PROBE,
      expected: 'multiple real users ranked by totalSoloScore in production data',
      actual: 'static contract only',
    }), { actionType: ACTION_TYPES.BACKEND_RUNTIME_PROBE, critical: false }),
];
