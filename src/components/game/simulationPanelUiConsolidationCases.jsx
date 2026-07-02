// Kronox Health Center — Phase 3 UI Consolidation Suite.
//
// SCOPE
//   Locks the Phase 3 UI/UX standardization landing:
//     1. Profile renders Puan / Seviye / Elmas through the shared
//        <KronoxStatTile /> component, NOT a local copy.
//     2. Profile stat row contains exactly Puan + Seviye + Elmas — no
//        Yıldız tile, no other accidental stat.
//     3. Leaderboard no longer renders top stat tiles by approved design;
//        it keeps rows and the fixed current-user card on unified Puan.
//     4. Elmas value continues to source from getLeaderboardDiamondValue
//        where it is still displayed (never derived from stars / score /
//        completed levels).
//     5. The shared style-token module (lib/kronoxStyleTokens.js)
//        exposes the documented exports — accidental deletion is caught.
//
// HONESTY
//   Every case in this suite is a STATIC_CONTRACT. They prove the source
//   wiring lands correctly; they do NOT prove the rendered pixels look
//   right on a real device. The companion case 6 stays NOT_AUTOMATABLE
//   so manual visual review remains visible.
//
// REGISTRY
//   This file is registered through simulationPanelCaseRegistry. It does
//   not modify the frozen simulationPanelExtraCases.jsx.

import profilePageSource from '../../pages/ProfilePage.jsx?raw';
import leaderboardPageSource from '../../pages/LeaderboardPage.jsx?raw';
import statTileSource from '../ui/KronoxStatTile.jsx?raw';
import styleTokensSource from '../../lib/kronoxStyleTokens.js?raw';

const STATUS = {
  PASS: 'PASS',
  FAIL: 'FAIL',
  NOT_AUTOMATABLE: 'NOT_AUTOMATABLE',
};

const ACTION_TYPES = {
  CODE_FIX: 'CODE_FIX',
  DEVICE_TEST: 'DEVICE_TEST',
};

const SUITE_NAMES = {
  ui_shared_components: 'UI Shared Components / Phase 3 Suite',
};

function makeCase(suiteId, id, name, run, options = {}) {
  return {
    key: `${suiteId}.${id}`,
    suiteId,
    suiteName: SUITE_NAMES[suiteId] || suiteId,
    id,
    name,
    critical: options.critical ?? false,
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
  return tokens.filter((t) => !String(source || '').includes(t));
}

function presentTokens(source, tokens) {
  return tokens.filter((t) => String(source || '').includes(t));
}

export const EXTRA_SUITES = [
  {
    id: 'ui_shared_components',
    name: SUITE_NAMES.ui_shared_components,
    critical: false,
    color: '#a78bfa',
  },
];

export const EXTRA_TESTS = [
  /* 1. Shared StatTile contract — Profile imports and uses it; Leaderboard top tiles stay removed. */
  makeCase('ui_shared_components', 'ui_shared_stat_tile_contract',
    'Profile renders Puan / Seviye / Elmas through shared KronoxStatTile while Leaderboard top stat tiles stay removed',
    () => {
      const profileRequired = missingTokens(profilePageSource, [
        "from '@/components/ui/KronoxStatTile'",
        '<KronoxStatTile',
      ]);
      // Neither page should still define a local StatTile fallback —
      // that would re-introduce the duplication this case prevents.
      const profileForbidden = presentTokens(profilePageSource, [
        'function StatTile(',
      ]);
      const leaderboardForbidden = presentTokens(leaderboardPageSource, [
        'function StatTile(',
        "from '@/components/ui/KronoxStatTile'",
        '<KronoxStatTile',
      ]);
      if (profileRequired.length || profileForbidden.length || leaderboardForbidden.length) {
        return fail('Profile shared StatTile or approved Leaderboard tile-removal contract drifted.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          file: 'pages/ProfilePage.jsx + pages/LeaderboardPage.jsx',
          actionType: ACTION_TYPES.CODE_FIX,
          expected: 'Profile imports/renders KronoxStatTile; Leaderboard does not restore removed top stat tiles; no local StatTile() function remains',
          actual: { profileRequired, profileForbidden, leaderboardForbidden },
          nextStep: 'Keep Profile on shared KronoxStatTile and keep Leaderboard on rows/current-user card instead of top stat tiles.',
        });
      }
      return pass('Profile renders the shared KronoxStatTile and Leaderboard keeps the approved no-top-stat-tile design.', {
        verification: 'STATIC_CONTRACT',
        classification: 'STATIC_CHECK_LIMITATION',
        actionType: ACTION_TYPES.CODE_FIX,
      });
    },
    { actionType: ACTION_TYPES.CODE_FIX }),

  /* 2. Profile + Leaderboard stat row composition — Puan / Seviye / Elmas. */
  makeCase('ui_shared_components', 'ui_profile_leaderboard_stats_contract',
    'Profile stat row shows Puan + Seviye + Elmas; Leaderboard rows/current-user card show unified Puan without top stat tiles',
    () => {
      const profileMissingLabels = missingTokens(profilePageSource, [
        "label: 'Puan'",
        "label: 'Seviye'",
        "label: 'Elmas'",
      ]);
      const leaderboardRequired = missingTokens(leaderboardPageSource, [
        '<KronoxRankingSection',
      ]);
      const leaderboardForbiddenLabels = presentTokens(leaderboardPageSource, [
        'label="Puan"',
        'label="Seviye"',
        'label="Elmas"',
      ]);
      // No Yıldız stat tile should reappear in either screen's stat row.
      // We allow the literal "Yıldız" elsewhere (e.g. SoloLevelResult)
      // but not as a StatTile label on these two pages.
      const profileYildiz = profilePageSource.includes("label: 'Yıldız'") || profilePageSource.includes('label="Yıldız"');
      const leaderboardYildiz = leaderboardPageSource.includes("label: 'Yıldız'") || leaderboardPageSource.includes('label="Yıldız"');
      if (profileMissingLabels.length || leaderboardRequired.length || leaderboardForbiddenLabels.length || profileYildiz || leaderboardYildiz) {
        return fail('Profile stat row or approved Leaderboard no-top-stat design drifted.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          file: 'pages/ProfilePage.jsx + pages/LeaderboardPage.jsx',
          actionType: ACTION_TYPES.CODE_FIX,
          expected: 'Profile renders exactly Puan + Seviye + Elmas; Leaderboard keeps rows/current-user Puan and no restored top stat labels',
          actual: { profileMissingLabels, leaderboardRequired, leaderboardForbiddenLabels, profileYildiz, leaderboardYildiz },
        });
      }
      return pass('Profile stat row matches Puan/Seviye/Elmas and Leaderboard keeps unified Puan without restored top stat tiles.', {
        verification: 'STATIC_CONTRACT',
        classification: 'STATIC_CHECK_LIMITATION',
        actionType: ACTION_TYPES.CODE_FIX,
      });
    },
    { actionType: ACTION_TYPES.CODE_FIX, critical: true }),

  /* 3. Elmas source-of-truth preserved on both surfaces. */
  makeCase('ui_shared_components', 'ui_elmas_source_preserved',
    'Elmas tile sources from getLeaderboardDiamondValue where displayed',
    () => {
      const profileRequired = missingTokens(profilePageSource, [
        'getLeaderboardDiamondValue',
        // Profile mirrors via a tiny passthrough helper.
        'getProfileDiamondValue',
      ]);
      if (profileRequired.length) {
        return fail('Elmas value is no longer sourced from getLeaderboardDiamondValue on at least one surface.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          file: 'pages/ProfilePage.jsx + pages/LeaderboardPage.jsx',
          actionType: ACTION_TYPES.CODE_FIX,
          expected: 'Displayed Elmas surfaces call getLeaderboardDiamondValue(user); Elmas never derived from stars/score/completed levels',
          actual: { profileRequired },
        });
      }
      return pass('Displayed Elmas tiles source from getLeaderboardDiamondValue.', {
        verification: 'STATIC_CONTRACT',
        classification: 'STATIC_CHECK_LIMITATION',
        actionType: ACTION_TYPES.CODE_FIX,
      });
    },
    { actionType: ACTION_TYPES.CODE_FIX, critical: true }),

  /* 4. Shared KronoxStatTile supports both variants. */
  makeCase('ui_shared_components', 'ui_stat_tile_variants_supported',
    'KronoxStatTile supports both `profile` and `compact` variants for shared stat surfaces',
    () => {
      const required = missingTokens(statTileSource, [
        "variant = 'profile'",
        "variant === 'compact'",
        // Tints used by both surfaces must exist.
        "gold:",
        "portal:",
        "cyan:",
        // Both surfaces use the tintHex passthrough path; keep it.
        'tintHex',
      ]);
      if (required.length) {
        return fail('Shared KronoxStatTile lost one of the variants or tint paths shared stat surfaces rely on.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          file: 'components/ui/KronoxStatTile.jsx',
          actionType: ACTION_TYPES.CODE_FIX,
          expected: 'profile + compact variants, semantic tints (gold/portal/cyan), tintHex passthrough',
          actual: { required },
        });
      }
      return pass('KronoxStatTile supports both variants and tint paths used by Profile and Leaderboard.', {
        verification: 'STATIC_CONTRACT',
        classification: 'STATIC_CHECK_LIMITATION',
        actionType: ACTION_TYPES.CODE_FIX,
      });
    },
    { actionType: ACTION_TYPES.CODE_FIX }),

  /* 5. Shared style tokens module exists with the documented exports. */
  makeCase('ui_shared_components', 'ui_kronox_style_tokens_present',
    'lib/kronoxStyleTokens.js exposes the documented shared tokens',
    () => {
      const required = missingTokens(styleTokensSource, [
        'export const stonePanelBackground',
        'export const heroPanelBackground',
        'export const fantasyPageBackground',
        'export const goldBorderShadow',
        'export const portalBorderShadow',
        'export const heroPanelShadow',
        'export const goldHeadingTextStyle',
        'export const safeAreaBottomPadding',
        'export const headerTopPadding',
        'export function tintRingShadow',
      ]);
      if (required.length) {
        return fail('Shared style tokens module is missing documented exports.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          file: 'lib/kronoxStyleTokens.js',
          actionType: ACTION_TYPES.CODE_FIX,
          expected: 'All documented exports remain available so callers do not silently break',
          actual: { required },
        });
      }
      return pass('Shared Kronox style tokens are all available.', {
        verification: 'STATIC_CONTRACT',
        classification: 'STATIC_CHECK_LIMITATION',
        actionType: ACTION_TYPES.CODE_FIX,
      });
    },
    { actionType: ACTION_TYPES.CODE_FIX }),

  /* 6. Honest gap — visual alignment on a real device. */
  makeCase('ui_shared_components', 'ui_profile_leaderboard_visual_parity_runtime_proof_needed',
    'Live visual proof that Profile stats and Leaderboard rows/current-user card look aligned on a real device',
    () => notAutomatable('Static contracts can prove Profile uses KronoxStatTile and Leaderboard uses the approved row/current-user-card layout, but cannot judge whether the rendered pixels feel consistent across iOS Safari, Android Chrome, and small-width devices. Release sign-off requires side-by-side screenshots.', {
      verification: 'NOT_AUTOMATABLE',
      classification: 'STATIC_CHECK_LIMITATION',
      verificationLabels: ['NOT_AUTOMATABLE', 'EXTERNAL_DEVICE_REQUIRED'],
      actionType: ACTION_TYPES.DEVICE_TEST,
      expected: 'Profile stat row and Leaderboard stat row visually match on a 360px-wide device — same ring colors, same numeric typography, no overflow',
      actual: 'static source proof only',
    }),
    { actionType: ACTION_TYPES.DEVICE_TEST, critical: false }),
];
