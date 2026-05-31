// Kronox Health Center — Leaderboard Fallback UX (Codex119).
//
// SCOPE
//   Locks the friendly fallback behavior when the global ranking call
//   cannot produce real data (permission gate, empty users list, network
//   error). Without these contracts the page can drift back to the harsh
//   red "Sıralama şu an yüklenemedi / Backend tüm kullanıcı skorlarını..."
//   error box that exposes backend internals to end users.
//
// CONTRACTS
//   1. Stat cards (Puan / Level / Elmas) must still source from the
//      shared Solo summary so own-score never disappears.
//   2. End-user-facing copy must not mention backend/permission language.
//   3. The fallback placeholder must show the user's own totalSoloScore
//      and a safe "Hazırlanıyor" rank phrase, never an invented rank.
//   4. Admin diagnostics: when an admin is signed in, the technical
//      reason MAY appear in a small diagnostics block — gated by
//      isAdminUser, never visible to normal users.
//   5. Fake user/rank generation remains forbidden (re-asserted from
//      the original suite so a future refactor can't sneak it in).
//
// HONESTY
//   - All cases are STATIC_CONTRACT token checks against the page +
//     extracted section component sources. The real "global rank
//     correctness" gap is already covered by the existing
//     leaderboard_runtime_backend_rank_probe NOT_AUTOMATABLE case in
//     simulationPanelLeaderboardCases.js.

import leaderboardPageSource from '../../pages/LeaderboardPage.jsx?raw';
import kronoxRankingSectionSource from '../leaderboard/KronoxRankingSection.jsx?raw';

const STATUS = { PASS: 'PASS', FAIL: 'FAIL' };
const ACTION_TYPES = { CODE_FIX: 'CODE_FIX' };

const SUITE_NAMES = {
  leaderboard_fallback: 'Leaderboard Fallback / Liderlik Hazırlanıyor Suite',
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

function missingTokens(source, tokens) {
  return tokens.filter((t) => !String(source || '').includes(t));
}
function forbiddenTokensFound(source, tokens) {
  return tokens.filter((t) => String(source || '').includes(t));
}

export const EXTRA_SUITES = [
  {
    id: 'leaderboard_fallback',
    name: SUITE_NAMES.leaderboard_fallback,
    critical: true,
    color: '#60a5fa',
  },
];

export const EXTRA_TESTS = [
  /* 1. Own score visible even when global load fails. */
  makeCase('leaderboard_fallback', 'leaderboard_own_score_visible_when_global_load_fails',
    'Stat cards + fallback placeholder both source the user\'s own Puan/Level from the shared Solo summary so the screen never feels broken when global ranking fails',
    () => {
      // Page must keep computing & rendering Puan/Level/Elmas tiles from
      // summarizeSoloProgress(progress, …) regardless of leaderboard
      // error state — i.e. those values are derived OUTSIDE the
      // leaderboard fetch's try/catch.
      const pageMissing = missingTokens(leaderboardPageSource, [
        'summarizeSoloProgress(progress, getSoloLevelCount())',
        'value={summary.totalSoloScore}',
        'value={summary.currentLevel}',
        'value={diamondValue}',
        // Fallback payload travels alongside the leaderboard state so
        // the section component can render own Puan in the placeholder.
        'ownScoreFallback',
      ]);
      // The section component must render Senin Puanın from ownScore.
      const sectionMissing = missingTokens(kronoxRankingSectionSource, [
        'Senin Puanın',
        'ownScore?.totalSoloScore',
      ]);
      if (pageMissing.length || sectionMissing.length) {
        return fail('Own-score visibility contract broken: a global load failure could hide the user\'s real Puan/Level.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          file: 'pages/LeaderboardPage.jsx + components/leaderboard/KronoxRankingSection.jsx',
          actionType: ACTION_TYPES.CODE_FIX,
          expected: 'stat tiles use shared Solo summary outside the leaderboard fetch; placeholder reads ownScoreFallback',
          actual: { pageMissing, sectionMissing },
        });
      }
      return pass('Own Puan/Level/Elmas stays visible independent of global ranking state.', {
        verification: 'STATIC_CONTRACT',
        classification: 'STATIC_CHECK_LIMITATION',
        actionType: ACTION_TYPES.CODE_FIX,
      });
    },
    { actionType: ACTION_TYPES.CODE_FIX }),

  /* 2. No scary backend error text for normal users. */
  makeCase('leaderboard_fallback', 'leaderboard_no_scary_backend_error_for_normal_users',
    'End-user-facing copy must not expose backend/permission language like "Backend tüm kullanıcı skorlarını..." or "Sıralama şu an yüklenemedi."',
    () => {
      // These strings used to live in the old harsh error block. They
      // must not be present as user-facing literals anywhere on the page
      // or the extracted section component.
      const combined = `${leaderboardPageSource}\n${kronoxRankingSectionSource}`;
      const forbidden = forbiddenTokensFound(combined, [
        'Backend tüm kullanıcı skorlarını',
        'Sıralama şu an yüklenemedi',
        'Veri uydurulmadı',
        'üretilemez',
      ]);
      if (forbidden.length) {
        return fail('Harsh backend wording is still present in user-facing leaderboard copy.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          file: 'pages/LeaderboardPage.jsx + components/leaderboard/KronoxRankingSection.jsx',
          actionType: ACTION_TYPES.CODE_FIX,
          expected: 'no backend/permission wording in normal-user copy',
          actual: { forbidden },
          nextStep: 'Use neutral "hazırlanıyor" copy and keep backend reasons in admin-only diagnostics.',
        });
      }
      return pass('Leaderboard copy is free of backend/permission language for end users.', {
        verification: 'STATIC_CONTRACT',
        classification: 'STATIC_CHECK_LIMITATION',
        actionType: ACTION_TYPES.CODE_FIX,
      });
    },
    { actionType: ACTION_TYPES.CODE_FIX }),

  /* 3. Fallback uses friendly placeholder + no fake rank/users. */
  makeCase('leaderboard_fallback', 'leaderboard_global_failure_uses_safe_placeholder',
    'When global ranking fails, a friendly "Kronox sıralaması hazırlanıyor" placeholder is shown with "Genel Sıran: Hazırlanıyor" and no invented rows',
    () => {
      const sectionMissing = missingTokens(kronoxRankingSectionSource, [
        'Kronox sıralaması hazırlanıyor.',
        'Puanın kaydedildi. Kısa süre içinde sıralamada görünecek.',
        'Genel Sıran',
        'Hazırlanıyor',
        'Tekrar Dene',
      ]);
      // Never invent users, ranks, or random rows.
      const sectionForbidden = forbiddenTokensFound(kronoxRankingSectionSource, [
        'Math.random',
        'mockUsers',
        'fakeUsers',
        'mockRank',
        'fakeRank',
      ]);
      if (sectionMissing.length || sectionForbidden.length) {
        return fail('Safe placeholder contract broken.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          file: 'components/leaderboard/KronoxRankingSection.jsx',
          actionType: ACTION_TYPES.CODE_FIX,
          expected: 'friendly hazırlanıyor copy + own Puan + Tekrar Dene; no fake users/ranks',
          actual: { sectionMissing, sectionForbidden },
        });
      }
      return pass('Friendly "hazırlanıyor" placeholder is in place; no fake users/ranks are generated.', {
        verification: 'STATIC_CONTRACT',
        classification: 'STATIC_CHECK_LIMITATION',
        actionType: ACTION_TYPES.CODE_FIX,
      });
    },
    { actionType: ACTION_TYPES.CODE_FIX }),

  /* 4. Admin diagnostics may show backend reason. */
  makeCase('leaderboard_fallback', 'leaderboard_admin_diagnostics_can_show_backend_reason',
    'Admins (isAdminUser) may see a small diagnostics block with the backend reason; normal users do not',
    () => {
      const pageMissing = missingTokens(leaderboardPageSource, [
        "from '@/lib/admin'",
        'isAdminUser(user)',
        'isAdmin={isAdmin}',
      ]);
      const sectionMissing = missingTokens(kronoxRankingSectionSource, [
        'isAdmin',
        'backendReason',
        'Admin tanılama',
      ]);
      if (pageMissing.length || sectionMissing.length) {
        return fail('Admin diagnostics wiring is missing — backend reason has nowhere safe to surface.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          file: 'pages/LeaderboardPage.jsx + components/leaderboard/KronoxRankingSection.jsx',
          actionType: ACTION_TYPES.CODE_FIX,
          expected: 'isAdminUser gate on the page, isAdmin+backendReason props consumed by the section',
          actual: { pageMissing, sectionMissing },
        });
      }
      return pass('Admin diagnostics block is wired and gated by isAdminUser.', {
        verification: 'STATIC_CONTRACT',
        classification: 'STATIC_CHECK_LIMITATION',
        actionType: ACTION_TYPES.CODE_FIX,
      });
    },
    { actionType: ACTION_TYPES.CODE_FIX, critical: false }),

  /* 5. Stat cards continue using the Solo source of truth. */
  makeCase('leaderboard_fallback', 'leaderboard_stat_cards_use_solo_source',
    'Puan / Level / Elmas tiles read from summarizeSoloProgress + getLeaderboardDiamondValue (the shared Solo + economy sources)',
    () => {
      const pageMissing = missingTokens(leaderboardPageSource, [
        "from '@/lib/soloProgressHelpers'",
        "from '@/lib/soloLevels'",
        "from '@/lib/leaderboard'",
        'summarizeSoloProgress(progress, getSoloLevelCount())',
        'getLeaderboardDiamondValue(user)',
        'value={summary.totalSoloScore}',
        'value={summary.currentLevel}',
        'value={diamondValue}',
      ]);
      if (pageMissing.length) {
        return fail('Stat cards no longer use the shared Solo/economy source.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          file: 'pages/LeaderboardPage.jsx',
          actionType: ACTION_TYPES.CODE_FIX,
          expected: 'Puan/Level from summarizeSoloProgress; Elmas from getLeaderboardDiamondValue',
          actual: { pageMissing },
        });
      }
      return pass('Stat cards read from the single shared Solo + economy sources of truth.', {
        verification: 'STATIC_CONTRACT',
        classification: 'STATIC_CHECK_LIMITATION',
        actionType: ACTION_TYPES.CODE_FIX,
      });
    },
    { actionType: ACTION_TYPES.CODE_FIX }),
];
