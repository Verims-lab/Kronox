// Kronox Health Center — Solo Adventure Map Focus Suite (Codex117).
//
// SCOPE
//   Locks the Codex117 fix for the "CTA shows Level 10 but map block is
//   16–20" bug. The previous LevelMapPath auto-scroll used
//   `node.offsetTop` on a `position: absolute` node, which resolves
//   against the inner 128px row (its offsetParent), not the scroll
//   container — so scrollTop landed near 0 and the reversed list put
//   the highest zone at the top of the viewport.
//
//   Three contracts:
//     1. Level → section range is correct on every boundary.
//     2. CTA and map focus derive from the SAME source (the shared
//        getCurrentPlayableLevel / getDefaultSelectedLevel helpers).
//     3. The LevelMapPath auto-scroll math uses getBoundingClientRect
//        on BOTH the container and the node (the bug fix), not the
//        offsetTop-on-absolute pattern that caused the regression.
//
//   We keep this in its own modular file (registered via the case
//   registry) so simulationPanelExtraCases.js stays frozen.
//
// HONESTY
//   - Cases 1 and 2 are RUNTIME_VERIFIED — they execute helpers and
//     check the actual returned values.
//   - Case 3 is STATIC_CONTRACT — proves the fix landed in source.
//   - Case 4 is NOT_AUTOMATABLE — actual scroll position on a mounted
//     viewport still needs a real device.

import { getSoloMapSectionRange, getDefaultSelectedLevel } from '../../lib/soloProgressHelpers';
import levelMapPathSource from '../solo/LevelMapPath.jsx?raw';
import soloChallengeSource from '../../pages/SoloChallenge.jsx?raw';
// Codex121 — Scroll helper that owns the actual centering math, the
// bottom-CTA-aware visible band, and post-jump verification.
import scrollHelperSource from '../../lib/scrollSoloMapToLevel.js?raw';

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
  solo_map_focus: 'Solo Map Focus / Section Suite',
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

export const EXTRA_SUITES = [
  {
    id: 'solo_map_focus',
    name: SUITE_NAMES.solo_map_focus,
    critical: true,
    color: '#7dd3fc',
  },
];

export const EXTRA_TESTS = [
  /* 1. Boundary table for level → section range. */
  makeCase('solo_map_focus', 'solo_map_boundary_level_ranges',
    'Level → adventure-map section: 5→[1,5], 6→[6,10], 10→[6,10], 11→[11,15], 15→[11,15], 16→[16,20], 20→[16,20], 1→[1,5]',
    () => {
      const cases = [
        { input: 1,  expected: [1, 5] },
        { input: 5,  expected: [1, 5] },
        { input: 6,  expected: [6, 10] },
        { input: 10, expected: [6, 10] },
        { input: 11, expected: [11, 15] },
        { input: 15, expected: [11, 15] },
        { input: 16, expected: [16, 20] },
        { input: 20, expected: [16, 20] },
      ];
      const mismatches = cases
        .map((c) => ({ ...c, actual: getSoloMapSectionRange(c.input) }))
        .filter((c) => c.actual[0] !== c.expected[0] || c.actual[1] !== c.expected[1]);
      if (mismatches.length) {
        return fail('getSoloMapSectionRange returned wrong range for at least one boundary.', {
          verification: 'RUNTIME_VERIFIED',
          classification: 'REAL_PRODUCT_RISK',
          file: 'lib/soloProgressHelpers.js',
          actionType: ACTION_TYPES.CODE_FIX,
          expected: '5-level zones starting at 1; Level 10 must map to [6,10], NOT [11,15] or [16,20]',
          actual: { mismatches },
        });
      }
      return pass('All Solo map section boundaries match the product spec.', {
        verification: 'RUNTIME_VERIFIED',
        classification: 'EXECUTABLE_HELPER_PROOF',
        actionType: ACTION_TYPES.CODE_FIX,
        actual: cases,
      });
    },
    { actionType: ACTION_TYPES.CODE_FIX }),

  /* 2. Reported bug case: current level 10 → section 6–10, NOT 16–20. */
  makeCase('solo_map_focus', 'solo_map_section_matches_current_level',
    'Map section for the current playable level must contain that level (Level 10 → 6–10; Level 16 → 16–20)',
    () => {
      const totalLevels = 20;
      // Level 10 scenario — Codex117 reported bug: CTA said Level 10 but
      // map showed 16–20. With the fix, getCurrentPlayableLevel returns
      // 10 and getSoloMapSectionRange(10) is [6, 10].
      const progressLevel10 = {
        currentLevel: 10,
        levels: {
          1: { bestStars: 3 }, 2: { bestStars: 3 }, 3: { bestStars: 3 },
          4: { bestStars: 3 }, 5: { bestStars: 3 }, 6: { bestStars: 3 },
          7: { bestStars: 3 }, 8: { bestStars: 3 }, 9: { bestStars: 3 },
        },
      };
      const lvl10 = getDefaultSelectedLevel(progressLevel10, totalLevels);
      const range10 = getSoloMapSectionRange(lvl10);

      const progressLevel16 = {
        currentLevel: 16,
        levels: Object.fromEntries(
          Array.from({ length: 15 }, (_, i) => [String(i + 1), { bestStars: 3 }]),
        ),
      };
      const lvl16 = getDefaultSelectedLevel(progressLevel16, totalLevels);
      const range16 = getSoloMapSectionRange(lvl16);

      const ok10 = lvl10 === 10 && range10[0] === 6 && range10[1] === 10;
      const ok16 = lvl16 === 16 && range16[0] === 16 && range16[1] === 20;

      if (!ok10 || !ok16) {
        return fail('Map section drifts away from the current playable level — the reported bug.', {
          verification: 'RUNTIME_VERIFIED',
          classification: 'REAL_PRODUCT_RISK',
          file: 'lib/soloProgressHelpers.js + components/solo/LevelMapPath.jsx',
          actionType: ACTION_TYPES.CODE_FIX,
          expected: { level10: { current: 10, range: [6, 10] }, level16: { current: 16, range: [16, 20] } },
          actual: { lvl10, range10, lvl16, range16 },
        });
      }
      return pass('Current playable level always belongs to its computed map section.', {
        verification: 'RUNTIME_VERIFIED',
        classification: 'EXECUTABLE_HELPER_PROOF',
        actionType: ACTION_TYPES.CODE_FIX,
        actual: { level10: range10, level16: range16 },
      });
    },
    { actionType: ACTION_TYPES.CODE_FIX }),

  /* 3. CTA and map focus must share the same source. */
  makeCase('solo_map_focus', 'solo_cta_and_map_use_same_focus_level',
    'SoloChallenge derives the CTA label AND focusLevelNumber from the SAME defaultSelectedNumber (getDefaultSelectedLevel)',
    () => {
      // The CTA template literal must reference defaultSelectedNumber,
      // and the LevelMapPath focusLevelNumber prop must reference the
      // same variable. If those drift apart, CTA and map can disagree.
      const required = missingTokens(soloChallengeSource, [
        'getDefaultSelectedLevel(progress, getSoloLevelCount())',
        'LEVEL ${defaultSelectedNumber}',
        'focusLevelNumber={defaultSelectedNumber}',
      ]);
      if (required.length) {
        return fail('CTA label and map focus do not derive from the same source variable.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          file: 'pages/SoloChallenge.jsx',
          actionType: ACTION_TYPES.CODE_FIX,
          expected: 'defaultSelectedNumber drives BOTH the CTA template and the LevelMapPath focusLevelNumber prop',
          actual: { required },
          nextStep: 'Restore "LEVEL ${defaultSelectedNumber}" CTA + focusLevelNumber={defaultSelectedNumber} so a Level 10 CTA can never coexist with a 16–20 map view.',
        });
      }
      return pass('CTA and map focus both read defaultSelectedNumber.', {
        verification: 'STATIC_CONTRACT',
        classification: 'STATIC_CHECK_LIMITATION',
        actionType: ACTION_TYPES.CODE_FIX,
      });
    },
    { actionType: ACTION_TYPES.CODE_FIX }),

  /* 4. Codex121 — Scroll math lives in the externalised helper. */
  makeCase('solo_map_focus', 'solo_map_scroll_uses_bounding_rect',
    'scrollSoloMapToLevel uses getBoundingClientRect on container + node, accounts for the bottom CTA overlay, and verifies the node is centered after the jump',
    () => {
      const required = missingTokens(scrollHelperSource, [
        // Both rects measured from the viewport — independent of offsetParent.
        'container.getBoundingClientRect()',
        'node.getBoundingClientRect()',
        // Clamp against scrollHeight so the jump is bounded.
        'container.scrollHeight',
        // Bottom CTA overlay handled — visible band shrinks accordingly.
        'bottomOverlayPx',
        'visibleBand',
        // Resilience: rAF retry + clientHeight guard.
        'requestAnimationFrame',
        'container.clientHeight',
        // Hard-jump (smooth disabled) so animation can't race.
        "container.style.scrollBehavior = 'auto'",
        // Post-jump verification: the helper checks the node actually
        // landed inside the visible band before declaring success.
        'isNodeCentered',
      ]);
      if (required.length) {
        return fail('scrollSoloMapToLevel math is missing the core defensive tokens — the runtime "still lands at 16-20" regression can return.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          file: 'lib/scrollSoloMapToLevel.js',
          actionType: ACTION_TYPES.CODE_FIX,
          expected: 'container/node bounding rects, scrollHeight clamp, bottom overlay subtracted from visible band, rAF retry, smooth-scroll suspended during jump, post-jump centered verification',
          actual: { required },
        });
      }
      return pass('Scroll helper is anchored to viewport-relative bounding rects, bottom-CTA-aware, and post-jump verified.', {
        verification: 'STATIC_CONTRACT',
        classification: 'STATIC_CHECK_LIMITATION',
        actionType: ACTION_TYPES.CODE_FIX,
      });
    },
    { actionType: ACTION_TYPES.CODE_FIX }),

  /* 5. Codex121 — Refocus must trigger after async progress load. */
  makeCase('solo_map_focus', 'solo_map_refocus_after_progress_load',
    'LevelMapPath focus effect re-runs when progress / focusLevelNumber changes after async load and delegates the scroll to attemptCenterSoloMap',
    () => {
      // Static proof that LevelMapPath:
      //  (a) uses useLayoutEffect (lands before paint);
      //  (b) depends on currentLevelNumber AND the levels reference;
      //  (c) delegates the actual scroll to attemptCenterSoloMap which
      //      owns the rAF retry loop and post-jump verification;
      //  (d) passes bottomReservedPx as bottomOverlayPx so the focused
      //      node isn't hidden behind the fixed CTA;
      //  (e) renders the stable DOM hooks the helper queries against.
      const componentRequired = missingTokens(levelMapPathSource, [
        'useLayoutEffect',
        'attemptCenterSoloMap',
        'bottomOverlayPx: bottomReservedPx',
        'data-kx-solo-map-container="true"',
        'data-kx-solo-level={level.levelNumber}',
        // Deps must include the focus number AND the levels reference
        // so async progress updates refocus the map.
        '[currentLevelNumber, levels, bottomReservedPx, diagnosticsEnabled]',
      ]);
      const helperRequired = missingTokens(scrollHelperSource, [
        'export function attemptCenterSoloMap',
        'export function scrollSoloMapToLevel',
        // Retry until the node is actually centered.
        'diag.ok && diag.nodeCenteredAfter',
      ]);
      if (componentRequired.length || helperRequired.length) {
        return fail('Refocus-after-progress-load contract drifted — the "CTA shows Level 10 but map opens on 16–20" bug can return.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          file: 'components/solo/LevelMapPath.jsx + lib/scrollSoloMapToLevel.js',
          actionType: ACTION_TYPES.CODE_FIX,
          expected: 'useLayoutEffect with [currentLevelNumber, levels, bottomReservedPx, diagnosticsEnabled] deps; scroll delegated to attemptCenterSoloMap with bottomOverlayPx wired; stable DOM hooks present; helper retries until centered',
          actual: { componentRequired, helperRequired },
        });
      }
      return pass('Focus delegates to attemptCenterSoloMap, runs on each focus/levels change, and retries until centered.', {
        verification: 'STATIC_CONTRACT',
        classification: 'STATIC_CHECK_LIMITATION',
        actionType: ACTION_TYPES.CODE_FIX,
      });
    },
    { actionType: ACTION_TYPES.CODE_FIX }),

  /* 6. Codex120 — CTA level === map focus level invariant. */
  makeCase('solo_map_focus', 'solo_map_focus_matches_cta_level',
    'If the SoloChallenge CTA shows Level N, LevelMapPath focus level and section must also be Level N',
    () => {
      // Exercise the helper directly for several states. Whatever value
      // drives the CTA (`getDefaultSelectedLevel(progress, total)`) must
      // ALSO be the value LevelMapPath receives as `focusLevelNumber`.
      // The page wires both to the same `defaultSelectedNumber` const
      // (already proven by `solo_cta_and_map_use_same_focus_level`);
      // this case adds a runtime check that the helper itself returns
      // a level inside the expected zone for the reported bug case.
      const totalLevels = 20;
      const buildProgress = (frontier) => ({
        currentLevel: frontier,
        levels: Object.fromEntries(
          Array.from({ length: Math.max(0, frontier - 1) }, (_, i) => [String(i + 1), { bestStars: 3 }]),
        ),
      });
      const cases = [1, 5, 6, 10, 11, 15, 16, 20].map((n) => {
        const progress = buildProgress(n);
        const cta = getDefaultSelectedLevel(progress, totalLevels);
        const range = getSoloMapSectionRange(cta);
        const inside = cta >= range[0] && cta <= range[1];
        return { frontier: n, cta, range, inside };
      });
      const drift = cases.filter((c) => c.cta !== c.frontier || !c.inside);
      // Also check the source wires both to the same const + exposes
      // the runtime data attribute so a future device test can verify
      // the rendered DOM directly.
      const sourceRequired = missingTokens(
        `${soloChallengeSource}\n${levelMapPathSource}`,
        [
          'focusLevelNumber={defaultSelectedNumber}',
          'LEVEL ${defaultSelectedNumber}',
          'data-kx-focus-level',
          'data-kx-focus-section',
        ],
      );
      if (drift.length || sourceRequired.length) {
        return fail('CTA level and map focus level can disagree — the exact reported bug.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          file: 'pages/SoloChallenge.jsx + components/solo/LevelMapPath.jsx',
          actionType: ACTION_TYPES.CODE_FIX,
          expected: 'CTA level === focusLevelNumber, and focus level falls inside its own section range',
          actual: { drift, sourceRequired },
        });
      }
      return pass('CTA level equals map focus level for every tested frontier; both stay inside the correct section.', {
        verification: 'RUNTIME_VERIFIED',
        classification: 'EXECUTABLE_HELPER_PROOF',
        actionType: ACTION_TYPES.CODE_FIX,
        actual: cases,
      });
    },
    { actionType: ACTION_TYPES.CODE_FIX }),

  /* 7. Codex121 — Scroll container mismatch guard. The previous
     attempts failed at runtime because the fallback `scrollIntoView`
     could be resolved against an OUTER scrollable ancestor (page-level)
     instead of the inner container, leaving our container at
     scrollTop=0. This case locks the container-scoped approach. */
  makeCase('solo_map_focus', 'solo_map_scroll_container_is_inner',
    'Scroll math operates on the inner Solo map container only — no implicit `window`/page scroll fallback that can leave the container at scrollTop=0',
    () => {
      // The helper must look up the container via the stable
      // `[data-kx-solo-map-container="true"]` attribute the component
      // renders, and the apply step must call `container.scrollTop = …`
      // directly. No `window.scrollTo`, no bare `scrollIntoView` on a
      // detached node, no `document.documentElement.scrollTop`.
      const required = missingTokens(scrollHelperSource, [
        '[data-kx-solo-map-container="true"]',
        'container.scrollTop =',
        '[data-kx-solo-level="${levelNumber}"]',
      ]);
      const forbiddenInHelper = ['window.scrollTo', 'document.documentElement.scrollTop']
        .filter((t) => scrollHelperSource.includes(t));
      // The component must NOT call scrollIntoView at all anymore — that
      // pattern is exactly what could pick the wrong scrollable ancestor.
      const componentForbidden = ['scrollIntoView']
        .filter((t) => levelMapPathSource.includes(t));
      if (required.length || forbiddenInHelper.length || componentForbidden.length) {
        return fail('Scroll-container contract drifted — the page-scroll-instead-of-inner-container bug can return.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          file: 'lib/scrollSoloMapToLevel.js + components/solo/LevelMapPath.jsx',
          actionType: ACTION_TYPES.CODE_FIX,
          expected: 'helper queries `[data-kx-solo-map-container]`, assigns `container.scrollTop` directly; no `window.scrollTo`, no `scrollIntoView` fallback in the component',
          actual: { required, forbiddenInHelper, componentForbidden },
        });
      }
      return pass('Scroll operates on the inner Solo map container only; no implicit outer-scroll fallback path exists.', {
        verification: 'STATIC_CONTRACT',
        classification: 'STATIC_CHECK_LIMITATION',
        actionType: ACTION_TYPES.CODE_FIX,
      });
    },
    { actionType: ACTION_TYPES.CODE_FIX }),

  /* 8. Codex121 — Admin-gated diagnostics so a real device can see why
     the focus failed without exposing internals to normal users. */
  makeCase('solo_map_focus', 'solo_map_admin_focus_diagnostics_wired',
    'Admin users (isAdminUser) get console diagnostics for every focus attempt; normal users see nothing',
    () => {
      const pageRequired = missingTokens(soloChallengeSource, [
        "from '@/lib/admin'",
        'isAdminUser(user)',
        'diagnosticsEnabled={isAdminUser(user)}',
      ]);
      const componentRequired = missingTokens(levelMapPathSource, [
        'diagnosticsEnabled',
        '[kronox.solo.focus]',
      ]);
      if (pageRequired.length || componentRequired.length) {
        return fail('Admin diagnostics wiring is missing — runtime focus failures have no surface to debug on real devices.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          file: 'pages/SoloChallenge.jsx + components/solo/LevelMapPath.jsx',
          actionType: ACTION_TYPES.CODE_FIX,
          expected: 'page passes diagnosticsEnabled={isAdminUser(user)}; component logs `[kronox.solo.focus]` only when enabled',
          actual: { pageRequired, componentRequired },
        });
      }
      return pass('Admin-gated focus diagnostics are wired end-to-end.', {
        verification: 'STATIC_CONTRACT',
        classification: 'STATIC_CHECK_LIMITATION',
        actionType: ACTION_TYPES.CODE_FIX,
      });
    },
    { actionType: ACTION_TYPES.CODE_FIX, critical: false }),

  /* 9. Honest gap: actual visible section on a real device.
     Codex121 — explicit wording: static checks pass, but the rendered
     viewport still needs runtime proof. PASS at Health does NOT mean
     the real screen is correct. */
  makeCase('solo_map_focus', 'solo_map_focus_runtime_proof_needed',
    'Live runtime proof that opening /solo at Level 10 actually shows the 6–10 zone banner (not 16–20)',
    () => notAutomatable('Static + executable-helper proofs cannot observe the rendered viewport. The reported bug ("CTA Level 10 but map opens on 16-20") manifests only after the container is mounted with a real clientHeight, the layout has settled, and the bottom CTA overlay is in place. Release sign-off MUST come from a real device screenshot showing the "Altın Ovalar 6-10" banner with the Level 10 node visible. A Health PASS on this suite does NOT mean the rendered screen is correct — it only means the source contracts match the Codex121 architecture.', {
      verification: 'NOT_AUTOMATABLE',
      classification: 'STATIC_CHECK_LIMITATION',
      verificationLabels: ['NOT_AUTOMATABLE', 'EXTERNAL_DEVICE_REQUIRED'],
      actionType: ACTION_TYPES.DEVICE_TEST,
      expected: 'Open /solo with current level 10 → "Altın Ovalar 6–10" banner visible at top of viewport, Level 10 node centered, NOT "Kristal Zirve 16–20" with locked nodes',
      actual: 'static + helper-runtime proof only — viewport state requires a mounted DOM',
    }),
    { actionType: ACTION_TYPES.DEVICE_TEST, critical: false }),
];