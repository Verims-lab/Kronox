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

  /* 4. Auto-scroll math uses getBoundingClientRect on container + node. */
  makeCase('solo_map_focus', 'solo_map_scroll_uses_bounding_rect',
    'LevelMapPath auto-scroll uses getBoundingClientRect on BOTH the container and the node (root-cause fix for offsetTop-on-absolute regression)',
    () => {
      const required = missingTokens(levelMapPathSource, [
        // The fix tokens — both rects measured, scrollTop derived from
        // the viewport-relative delta, clamped against scrollHeight.
        'container.getBoundingClientRect()',
        'node.getBoundingClientRect()',
        'container.scrollHeight',
        // Resilience: keep rAF + clientHeight guard + scrollIntoView fallback
        'requestAnimationFrame',
        'container.clientHeight',
        'scrollIntoView',
      ]);
      if (required.length) {
        return fail('Auto-scroll math is missing the getBoundingClientRect fix — the offsetTop-on-absolute regression can return.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          file: 'components/solo/LevelMapPath.jsx',
          actionType: ACTION_TYPES.CODE_FIX,
          expected: 'scrollTop derived from container & node getBoundingClientRect, clamped to scrollHeight, with rAF/clientHeight/scrollIntoView resilience',
          actual: { required },
        });
      }
      return pass('Auto-scroll math is anchored to viewport-relative bounding rects.', {
        verification: 'STATIC_CONTRACT',
        classification: 'STATIC_CHECK_LIMITATION',
        actionType: ACTION_TYPES.CODE_FIX,
      });
    },
    { actionType: ACTION_TYPES.CODE_FIX }),

  /* 5. Codex120 — Refocus must trigger after async progress load. */
  makeCase('solo_map_focus', 'solo_map_refocus_after_progress_load',
    'LevelMapPath focus effect re-runs when progress / focusLevelNumber changes after async load (useLayoutEffect with focusLevelNumber + levels deps)',
    () => {
      // Static proof that the focus effect:
      //  (a) uses useLayoutEffect (so it lands before paint, not after a
      //      flash of the highest-zone banner);
      //  (b) depends on focusLevelNumber AND the levels reference, so a
      //      progress reload that swaps levels[] or changes the focus
      //      number triggers a refocus;
      //  (c) retries until layout is ready (rAF loop with a finite cap);
      //  (d) suspends smooth-scroll during the jump so the math can't be
      //      cancelled mid-animation by competing layout.
      const required = missingTokens(levelMapPathSource, [
        'useLayoutEffect',
        '[focusLevelNumber, currentLevelNumber, levels]',
        // Retry-until-ready signal — both the rAF loop variable and the
        // clientHeight guard inside `focus()`.
        'requestAnimationFrame(tick)',
        'if (ch === 0) return false',
        // Hard-jump (smooth disabled) — proves animation can't race.
        "container.style.scrollBehavior = 'auto'",
      ]);
      if (required.length) {
        return fail('Refocus-after-progress-load contract drifted — the "CTA shows Level 10 but map opens on 16–20" bug can return.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          file: 'components/solo/LevelMapPath.jsx',
          actionType: ACTION_TYPES.CODE_FIX,
          expected: 'useLayoutEffect, deps include focusLevelNumber + levels, rAF retry loop until clientHeight > 0, smooth-scroll suspended during the focus jump',
          actual: { required },
          nextStep: 'Restore the Codex120 focus effect: useLayoutEffect with [focusLevelNumber, currentLevelNumber, levels] deps + rAF retry tick + scrollBehavior=auto during the jump.',
        });
      }
      return pass('Focus refocuses on async progress load with a retry loop and no smooth-scroll race.', {
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

  /* 7. Honest gap: actual visible section on a real device. */
  makeCase('solo_map_focus', 'solo_map_focus_runtime_proof_needed',
    'Live runtime proof that opening /solo at Level 10 shows the 6–10 zone banner (not 16–20)',
    () => notAutomatable('Visible section depends on a mounted DOM with non-zero clientHeight. Static + helper contracts prove the math and the source mapping; release sign-off still needs a phone test.', {
      verification: 'NOT_AUTOMATABLE',
      classification: 'STATIC_CHECK_LIMITATION',
      verificationLabels: ['NOT_AUTOMATABLE', 'EXTERNAL_DEVICE_REQUIRED'],
      actionType: ACTION_TYPES.DEVICE_TEST,
      expected: 'Open /solo with current level 10 → "Altın Ovalar 6–10" banner visible, not "Kristal Zirve 16–20"',
      actual: 'static + helper-runtime proof only',
    }),
    { actionType: ACTION_TYPES.DEVICE_TEST, critical: false }),
];