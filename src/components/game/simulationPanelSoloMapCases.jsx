// Kronox Health Center — Solo Adventure Map cases (Codex108).
//
// SCOPE
//   STATIC_CONTRACT health cases for the new scrollable Solo Level Map:
//     - Map is scrollable (overflow-y-auto), not a fixed no-scroll list.
//     - Level 1 lives at the bottom; the list is rendered reversed so
//       progression goes upward.
//     - Auto-scroll-to-current-level wiring is present.
//     - Every 5 levels renders a zone banner.
//     - BottomNav stays visible on /solo (the page never calls
//       setBottomNavHidden).
//     - Completed levels show bestStars (Star icon driven by `level.stars`).
//     - Profile/Solo source-of-truth still flows through readSoloProgress
//       (we don't re-test that here — the existing Solo Progress suite
//       already locks it; we just assert that SoloChallenge keeps using
//       LevelMapPath WITH readSoloProgress wired).
//
// HONESTY RULES
//   - Pure static token checks. We CANNOT prove actual scroll position
//     statically — that case is filed as NOT_AUTOMATABLE.
//   - No scoring constants or thresholds touched.

import soloChallengeSource from '../../pages/SoloChallenge.jsx?raw';
import levelMapPathSource from '../solo/LevelMapPath.jsx?raw';
import levelMapNodeSource from '../solo/LevelMapNode.jsx?raw';
import soloLevelsLibSource from '../../lib/soloLevels.js?raw';

const STATUS = {
  PASS: 'PASS',
  FAIL: 'FAIL',
  WARNING: 'WARNING',
  NOT_AUTOMATABLE: 'NOT_AUTOMATABLE',
};

const ACTION_TYPES = {
  CODE_FIX: 'CODE_FIX',
  DEVICE_TEST: 'DEVICE_TEST',
};

const SUITE_NAMES = {
  solo_adventure_map: 'Solo Adventure Map Suite',
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
  return tokens.filter((t) => !String(source || '').includes(t));
}
function forbiddenTokensFound(source, tokens) {
  return tokens.filter((t) => String(source || '').includes(t));
}

export const EXTRA_SUITES = [
  {
    id: 'solo_adventure_map',
    name: SUITE_NAMES.solo_adventure_map,
    critical: true,
    color: '#7dd3fc',
  },
];

export const EXTRA_TESTS = [
  /* 1. Solo screen mounts LevelMapPath (not the old flat list). */
  makeCase('solo_adventure_map', 'solo_uses_scrollable_map',
    'SoloChallenge renders the scrollable LevelMapPath component (not the old flat LevelPathRow list)',
    () => {
      const required = missingTokens(soloChallengeSource, [
        "import LevelMapPath from '@/components/solo/LevelMapPath'",
        '<LevelMapPath',
        'readSoloProgress',
      ]);
      // Old `fixed inset-0` page-level lock used to prevent any scroll.
      const forbidden = forbiddenTokensFound(soloChallengeSource, [
        'fixed inset-0 flex flex-col',
      ]);
      if (required.length || forbidden.length) {
        return fail('Solo screen no longer wires the scrollable map.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          file: 'pages/SoloChallenge.jsx',
          actionType: ACTION_TYPES.CODE_FIX,
          expected: 'LevelMapPath wired with readSoloProgress; no page-level fixed inset lock',
          actual: { required, forbidden },
        });
      }
      return pass('Solo screen mounts LevelMapPath with shared progress source.', {
        verification: 'STATIC_CONTRACT',
        classification: 'STATIC_CHECK_LIMITATION',
      });
    },
    { actionType: ACTION_TYPES.CODE_FIX }),

  /* 2. Map container is actually scrollable. */
  makeCase('solo_adventure_map', 'solo_map_is_scrollable',
    'LevelMapPath container uses overflow-y-auto and a smooth-scroll viewport (vertical scroll, mobile-friendly)',
    () => {
      const missing = missingTokens(levelMapPathSource, [
        'overflow-y-auto',
        'WebkitOverflowScrolling',
        'scrollBehavior',
      ]);
      if (missing.length) {
        return fail('LevelMapPath is not configured as a scrollable viewport.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          file: 'components/solo/LevelMapPath.jsx',
          actionType: ACTION_TYPES.CODE_FIX,
          expected: 'overflow-y-auto + WebkitOverflowScrolling + scrollBehavior tokens present',
          actual: { missing },
        });
      }
      return pass('Map viewport is scrollable.', {
        verification: 'STATIC_CONTRACT',
        classification: 'STATIC_CHECK_LIMITATION',
      });
    },
    { actionType: ACTION_TYPES.CODE_FIX }),

  /* 3. Level 1 at the bottom = list rendered reversed. */
  makeCase('solo_adventure_map', 'level_one_at_bottom_upward_progression',
    'Map renders levels in reverse order so Level 1 sits at the bottom and progression goes upward',
    () => {
      const required = missingTokens(levelMapPathSource, [
        '.slice().reverse()',
      ]);
      if (required.length) {
        return fail('Reversed render order missing — Level 1 would appear at the top.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          file: 'components/solo/LevelMapPath.jsx',
          actionType: ACTION_TYPES.CODE_FIX,
          expected: 'levels reversed before mapping',
          actual: { required },
        });
      }
      return pass('Levels rendered top-down with reversed order; Level 1 sits at the bottom.', {
        verification: 'STATIC_CONTRACT',
        classification: 'STATIC_CHECK_LIMITATION',
      });
    },
    { actionType: ACTION_TYPES.CODE_FIX }),

  /* 4. Auto-scroll-to-current-level wiring. */
  makeCase('solo_adventure_map', 'auto_scroll_to_current_level_wired',
    'LevelMapPath centers the current level on mount via scrollTop math (auto-scroll target wiring present)',
    () => {
      const missing = missingTokens(levelMapPathSource, [
        "status === 'current'",
        'container.scrollTop',
        'offsetTop',
      ]);
      if (missing.length) {
        return fail('Auto-scroll wiring missing — Solo would always open at the top.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          file: 'components/solo/LevelMapPath.jsx',
          actionType: ACTION_TYPES.CODE_FIX,
          expected: 'current-level lookup + container.scrollTop computed from offsetTop',
          actual: { missing },
        });
      }
      return pass('Auto-scroll-to-current-level wiring is present.', {
        verification: 'STATIC_CONTRACT',
        classification: 'STATIC_CHECK_LIMITATION',
      });
    },
    { actionType: ACTION_TYPES.CODE_FIX, runtimeProofRequired: true }),

  /* 4b. Honest gap: actual scroll position on a real device. */
  makeCase('solo_adventure_map', 'auto_scroll_runtime_proof_needed',
    'Live runtime proof that opening /solo at Level N centers Level N in the viewport',
    () => notAutomatable('Scroll position requires a mounted, sized DOM. Static contract proves the math; release sign-off needs a phone test.', {
      verification: 'NOT_AUTOMATABLE',
      classification: 'STATIC_CHECK_LIMITATION',
      verificationLabels: ['NOT_AUTOMATABLE', 'EXTERNAL_DEVICE_REQUIRED'],
      actionType: ACTION_TYPES.DEVICE_TEST,
      expected: 'Open /solo at Level 8 → Level 8 node visible without manual scroll',
      actual: 'static-only proof in simulator',
    }), { actionType: ACTION_TYPES.DEVICE_TEST, critical: false }),

  /* 5. Every 5 levels → a zone banner. */
  makeCase('solo_adventure_map', 'every_five_levels_zone_theme',
    'Map declares 4 zone bands (1-5, 6-10, 11-15, 16-20) and emits a zone banner at each boundary',
    () => {
      const required = missingTokens(levelMapPathSource, [
        'range: [1, 5]',
        'range: [6, 10]',
        'range: [11, 15]',
        'range: [16, 20]',
        'ZoneBanner',
        'data-kx-solo-zone',
      ]);
      if (required.length) {
        return fail('Zone banner rhythm missing — section/theme change every 5 levels is not in source.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          file: 'components/solo/LevelMapPath.jsx',
          actionType: ACTION_TYPES.CODE_FIX,
          expected: '4 zones × 5 levels + ZoneBanner + data-kx-solo-zone marker',
          actual: { required },
        });
      }
      return pass('Four 5-level zones with banners are declared.', {
        verification: 'STATIC_CONTRACT',
        classification: 'STATIC_CHECK_LIMITATION',
      });
    },
    { actionType: ACTION_TYPES.CODE_FIX }),

  /* 6. BottomNav remains visible on Solo. */
  makeCase('solo_adventure_map', 'bottom_nav_visible_on_solo',
    'Solo Level Path does NOT call setBottomNavHidden, so BottomNav remains visible',
    () => {
      const forbidden = forbiddenTokensFound(soloChallengeSource, [
        'setBottomNavHidden(true)',
        'setBottomNavHidden(',
      ]);
      if (forbidden.length) {
        return fail('SoloChallenge hides BottomNav — Solo Level Path must keep it visible.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          file: 'pages/SoloChallenge.jsx',
          actionType: ACTION_TYPES.CODE_FIX,
          expected: 'no setBottomNavHidden call',
          actual: { forbidden },
        });
      }
      return pass('SoloChallenge never hides BottomNav.', {
        verification: 'STATIC_CONTRACT',
        classification: 'STATIC_CHECK_LIMITATION',
      });
    },
    { actionType: ACTION_TYPES.CODE_FIX }),

  /* 7. Completed levels render stars. */
  makeCase('solo_adventure_map', 'completed_levels_show_best_stars',
    'LevelMapNode renders 0–3 Star icons driven by level.stars for completed levels (bestStars surfaced from progress)',
    () => {
      const nodeMissing = missingTokens(levelMapNodeSource, [
        "import { Lock, Star, Play } from 'lucide-react'",
        'isCompleted',
        '{[1, 2, 3].map',
        'i <= stars',
      ]);
      // Solo lib must still publish stars from bestStars.
      const libMissing = missingTokens(soloLevelsLibSource, [
        'Number(entry?.bestStars) || 0',
        'stars,',
      ]);
      if (nodeMissing.length || libMissing.length) {
        return fail('Stars on completed levels not wired.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          file: 'components/solo/LevelMapNode.jsx + lib/soloLevels.js',
          actionType: ACTION_TYPES.CODE_FIX,
          expected: 'LevelMapNode maps 3 stars from level.stars; getSoloLevels surfaces bestStars',
          actual: { nodeMissing, libMissing },
        });
      }
      return pass('Stars on completed levels are wired from bestStars.', {
        verification: 'STATIC_CONTRACT',
        classification: 'STATIC_CHECK_LIMITATION',
      });
    },
    { actionType: ACTION_TYPES.CODE_FIX }),

  /* 8. Locked nodes are non-interactive. */
  makeCase('solo_adventure_map', 'locked_levels_disabled',
    'LevelMapNode disables clicks and shows a Lock icon for locked levels',
    () => {
      const missing = missingTokens(levelMapNodeSource, [
        'disabled={isLocked}',
        'onClick={isLocked ? undefined : onSelect}',
        '<Lock',
      ]);
      if (missing.length) {
        return fail('Locked levels are not properly disabled.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          file: 'components/solo/LevelMapNode.jsx',
          actionType: ACTION_TYPES.CODE_FIX,
          expected: 'disabled + onClick guard + Lock icon for locked status',
          actual: { missing },
        });
      }
      return pass('Locked levels are non-interactive.', {
        verification: 'STATIC_CONTRACT',
        classification: 'STATIC_CHECK_LIMITATION',
      });
    },
    { actionType: ACTION_TYPES.CODE_FIX }),

  /* 9. Bottom padding reserves space for Play + BottomNav. */
  makeCase('solo_adventure_map', 'bottom_reserved_space_for_play_and_nav',
    'LevelMapPath applies bottomReservedPx padding so Level 1 is not hidden behind the Play button / BottomNav',
    () => {
      const pathMissing = missingTokens(levelMapPathSource, [
        'bottomReservedPx',
        'paddingBottom',
      ]);
      const soloMissing = missingTokens(soloChallengeSource, [
        'BOTTOM_RESERVED_PX',
        'bottomReservedPx={BOTTOM_RESERVED_PX}',
      ]);
      if (pathMissing.length || soloMissing.length) {
        return fail('Bottom reserved space wiring is missing.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          file: 'pages/SoloChallenge.jsx + components/solo/LevelMapPath.jsx',
          actionType: ACTION_TYPES.CODE_FIX,
          expected: 'SoloChallenge passes BOTTOM_RESERVED_PX → LevelMapPath applies it as paddingBottom',
          actual: { pathMissing, soloMissing },
        });
      }
      return pass('Bottom space reserved so Level 1 stays above Play + BottomNav.', {
        verification: 'STATIC_CONTRACT',
        classification: 'STATIC_CHECK_LIMITATION',
      });
    },
    { actionType: ACTION_TYPES.CODE_FIX }),
];