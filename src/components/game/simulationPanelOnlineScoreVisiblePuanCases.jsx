// Kronox Health Center — visible Kronox Puan contracts.
//
// SCOPE
//   Online match scoring must persist to User.online_progress AND visibly
//   affect the player-facing Kronox Puan surfaces after refresh. An
//   OnlineMatchResult audit row or popup-only delta is not enough.

import {
  getKronoxVisibleScore,
  getOnlineProgressScore,
  getSoloProgressScore,
} from '@/lib/kronoxScore';
import applyOnlineResultSource from '../../lib/applyOnlineResult.js?raw';
import kronoxScoreSource from '../../lib/kronoxScore.js?raw';
import gameSource from '../../pages/Game.jsx?raw';
import gameOverSource from './GameOver.jsx?raw';
import profilePageSource from '../../pages/ProfilePage.jsx?raw';
import leaderboardPageSource from '../../pages/LeaderboardPage.jsx?raw';
import leaderboardLibSource from '../../lib/leaderboard.js?raw';

const STATUS = { PASS: 'PASS', FAIL: 'FAIL' };
const ACTION_TYPES = { CODE_FIX: 'CODE_FIX', MANUAL_VERIFY: 'MANUAL_VERIFY' };
const SUITE_ID = 'online_score_visible_puan_health';
const SUITE_NAME = 'Online Score Visible Kronox Puan Suite';

function safeStr(src) {
  if (src == null) return '';
  if (typeof src === 'string') return src;
  try { return String(src); } catch { return ''; }
}

function pass(reason, extra = {}) { return { status: STATUS.PASS, reason, ...extra }; }
function fail(reason, extra = {}) { return { status: STATUS.FAIL, reason, ...extra }; }

function missingTokens(source, tokens) {
  const src = safeStr(source);
  return tokens.filter((token) => !src.includes(token));
}

function makeCase(id, name, run, options = {}) {
  return {
    key: `${SUITE_ID}.${id}`,
    suiteId: SUITE_ID,
    suiteName: SUITE_NAME,
    id,
    name,
    critical: options.critical ?? true,
    actionType: options.actionType || ACTION_TYPES.CODE_FIX,
    nextStep: options.nextStep || 'Fix the visible Kronox Puan persistence contract.',
    ...options,
    run,
  };
}

export const EXTRA_SUITES = [
  { id: SUITE_ID, name: SUITE_NAME, critical: true, color: '#facc15' },
];

export const EXTRA_TESTS = [
  makeCase('online_score_updates_visible_kronox_puan_source',
    'Online scoring writes to a field included in visible Kronox Puan',
    () => {
      const user = {
        online_progress: { score: 25 },
        solo_progress: {
          levels: {
            1: { bestStars: 3, bestScore: 20 },
            2: { bestStars: 2, bestScore: 13 },
          },
        },
      };
      const total = getKronoxVisibleScore(user, { soloProgress: user.solo_progress, totalLevels: 20 });
      if (total !== 58) {
        return fail('Visible Kronox Puan does not include Online score.', {
          verification: 'EXECUTABLE',
          expected: '20 + 13 + 25 = 58',
          actual: total,
        });
      }
      const missing = missingTokens(kronoxScoreSource, ['online_progress?.score', 'solo_progress.totalSoloScore + online_progress.score']);
      if (missing.length) {
        return fail('Visible score helper source no longer documents Online + Solo composition.', {
          verification: 'STATIC_CONTRACT',
          missing,
        });
      }
      return pass('Visible Kronox Puan includes persisted Online score and Solo best-score total.', { verification: 'EXECUTABLE' });
    }),

  makeCase('visible_kronox_puan_helper_exists',
    'Shared visible Kronox Puan helper exists',
    () => {
      const checks = [
        typeof getKronoxVisibleScore === 'function',
        typeof getOnlineProgressScore === 'function',
        typeof getSoloProgressScore === 'function',
      ];
      const missing = missingTokens(kronoxScoreSource, [
        'export function getKronoxVisibleScore',
        'export function getOnlineProgressScore',
        'export function getSoloProgressScore',
      ]);
      if (checks.some((ok) => !ok) || missing.length) {
        return fail('Visible Kronox Puan helper exports are missing.', { verification: 'EXECUTABLE', missing });
      }
      return pass('Visible Kronox Puan helper is centralized in lib/kronoxScore.js.', { verification: 'EXECUTABLE' });
    }),

  makeCase('header_profile_online_use_same_score_helper',
    'Profile and Liderlik visible Puan use the shared getKronoxVisibleScore helper',
    () => {
      // Codex159 — Honest contract scope. The visible Kronox Puan
      // SURFACES (what the user reads as "Puan") today are:
      //   • Profile İstatistikler tile
      //   • Liderlik stat row + ranking section
      // Home/Solo/Online top bars intentionally show Elmas, not Puan
      // (StandardTopBar). So the helper-usage contract is scoped to the
      // two Puan-rendering screens, and we verify the REAL canonical
      // pattern: import `getKronoxVisibleScore` from @/lib/kronoxScore
      // and invoke it with `(user`.
      //
      // This avoids brittle "exact key form" tokens
      // (e.g. `totalKronoxScore: getKronoxVisibleScore`) that don't
      // match the actual code shape but also don't reflect a real
      // contract.
      function checkVisiblePuanSurface(fileLabel, source) {
        const text = safeStr(source);
        const tokens = [
          "from '@/lib/kronoxScore'",
          'getKronoxVisibleScore',
          'getKronoxVisibleScore(user',
        ];
        const missing = tokens.filter((t) => !text.includes(t));
        return { file: fileLabel, missing };
      }
      const results = [
        checkVisiblePuanSurface('profile', profilePageSource),
        checkVisiblePuanSurface('leaderboard', leaderboardPageSource),
      ];
      const bad = results.filter((r) => r.missing.length);
      if (bad.length) {
        return fail('At least one visible Puan surface bypasses getKronoxVisibleScore.', {
          verification: 'STATIC_CONTRACT',
          actual: bad,
        });
      }
      return pass('Profile and Liderlik both import and call getKronoxVisibleScore for visible Puan.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('online_score_persistence_refreshes_user_state',
    'After score apply, user/profile state is refreshed or updated',
    () => {
      const missing = missingTokens(applyOnlineResultSource, [
        'refreshCurrentUserAfterOnlineScore',
        'await base44.auth.updateMe(payload)',
        'refreshedUser',
      ]);
      const gameMissing = missingTokens(gameSource, ['if (res?.refreshedUser) setCurrentUser(res.refreshedUser)']);
      if (missing.length || gameMissing.length) {
        return fail('Online score persistence may leave visible user state stale.', {
          verification: 'STATIC_CONTRACT',
          actual: { missing, gameMissing },
        });
      }
      return pass('Online score apply refreshes auth user state and Game consumes the refreshed user.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('online_match_result_not_enough_without_user_score',
    'OnlineMatchResult row alone is not considered sufficient if visible score does not update',
    () => {
      const missing = missingTokens(applyOnlineResultSource, [
        'reconcileOnlineMatchResultForCurrentUser',
        'audit_row_exists_but_visible_score_matches_before',
        'score_after',
        'score_before',
      ]);
      if (missing.length) {
        return fail('Existing OnlineMatchResult rows can still hide a missing user score update.', {
          verification: 'STATIC_CONTRACT',
          missing,
        });
      }
      return pass('Existing audit rows are checked for safe user-score reconciliation.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('online_score_idempotency_does_not_mark_applied_before_user_update',
    'Applied marker happens after user score persistence',
    () => {
      const src = safeStr(applyOnlineResultSource);
      const updateIndex = src.indexOf('await base44.auth.updateMe(payload)');
      const auditIndex = src.indexOf('const onlineMatchResult = await createOnlineMatchResult');
      const lastMatchIndex = src.indexOf('lastMatchId: String(lobbyId)');
      if (updateIndex < 0 || auditIndex < 0 || lastMatchIndex < 0 || !(updateIndex < auditIndex)) {
        return fail('OnlineMatchResult can be marked before user score persistence.', {
          verification: 'STATIC_CONTRACT',
          actual: { updateIndex, auditIndex, lastMatchIndex },
        });
      }
      return pass('User online_progress is persisted before the OnlineMatchResult audit row is created.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('online_score_reconcile_detects_result_without_user_score',
    'Bad prior OnlineMatchResult-without-score state is detectable/recoverable',
    () => {
      const missing = missingTokens(applyOnlineResultSource, [
        'shouldRepairOnlineMatchResult',
        'scoreMatchesBefore',
        'scoreMatchesAfter',
        'newer_online_progress_exists',
        'reconciled_from_audit',
      ]);
      if (missing.length) return fail('Safe reconciliation guard is missing.', { verification: 'STATIC_CONTRACT', missing });
      return pass('Prior audit-without-visible-score state has a guarded reconciliation path.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('result_popup_shows_score_after_persist',
    'Popup shows saved scoreBefore/scoreAfter, not preview-only',
    () => {
      const missing = missingTokens(gameOverSource, [
        'Yeni Kronox Puanın:',
        'scoreBefore',
        'scoreAfter',
        'Puan kaydedilemedi',
      ]);
      const gameMissing = missingTokens(gameSource, ['buildOnlineScorePopupState', 'scoreAfter', 'saved: true']);
      if (missing.length || gameMissing.length) {
        return fail('Online result popup can still look preview-only or hide save failure.', {
          verification: 'STATIC_CONTRACT',
          actual: { missing, gameMissing },
        });
      }
      return pass('Online result popup shows persisted score before/after and save failure copy.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('online_score_survives_refresh_contract',
    'Persisted source is server/user profile, not local React state',
    () => {
      const missing = missingTokens(applyOnlineResultSource, [
        'base44.auth.updateMe',
        'online_progress',
        'refreshCurrentUserAfterOnlineScore',
      ]);
      if (missing.length) return fail('Online score may not survive refresh.', { verification: 'STATIC_CONTRACT', missing });
      return pass('Online score writes User.online_progress and refreshes from auth profile.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('online_score_not_solo_leaderboard_mutation',
    'Online visible Puan change does not corrupt Solo leaderboard source',
    () => {
      const applyBad = safeStr(applyOnlineResultSource).includes('totalSoloScore') ||
        safeStr(applyOnlineResultSource).includes('solo_progress');
      const leaderboardMissing = missingTokens(leaderboardLibSource, [
        'total_kronox_score',
        'total_solo_score',
        'summary.totalKronoxScore',
        'rankSoloLeaderboardEntries',
      ]);
      if (applyBad || leaderboardMissing.length) {
        return fail('Online scoring is mutating Solo score or Solo leaderboard source drifted.', {
          verification: 'STATIC_CONTRACT',
          actual: { applyBad, leaderboardMissing },
        });
      }
      return pass('Online score affects visible Puan and leaderboard rows without mutating Solo progress data.', { verification: 'STATIC_CONTRACT' });
    }),
];
