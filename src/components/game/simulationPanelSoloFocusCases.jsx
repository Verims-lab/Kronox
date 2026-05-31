// Kronox Health Center — Solo focus / CTA / unlock contracts.
//
// SCOPE
//   Originally introduced in Codex109 to lock the "single current level"
//   picker + CTA-reflects-selected-level invariants. Codex110 superseded
//   the underlying implementation with a SELF-HEALING unlock formula
//   (see lib/soloProgressHelpers.js + simulationPanelSoloUnlockCases.js).
//
//   The token-level contracts below were rewritten to match the Codex110
//   shape: they no longer assert against the removed inline picker, but
//   they DO continue to lock the high-level product invariants:
//
//     1. SoloChallenge default selection comes from the shared helper.
//     2. CTA label is derived from selectedLevel/defaultSelectedNumber,
//        never hard-coded to "LEVEL 1".
//     3. SoloChallenge gates async hydration with progressLoaded so the
//        CTA cannot prematurely commit to Level 1.
//     4. SoloChallenge passes focusLevelNumber to LevelMapPath so auto-
//        scroll targets the helper-computed current playable.
//     5. LevelMapPath auto-scroll math is layout-timing resilient.
//
//   The deeper unlock/self-healing behavior lives in
//   simulationPanelSoloUnlockCases.js, where it is exercised by live
//   formulas, not just tokens.

import soloChallengeSource from '../../pages/SoloChallenge.jsx?raw';
import levelMapPathSource from '../solo/LevelMapPath.jsx?raw';

const STATUS = { PASS: 'PASS', FAIL: 'FAIL' };
const ACTION_TYPES = { CODE_FIX: 'CODE_FIX' };

const SUITE_NAMES = {
  solo_focus_and_unlock: 'Solo Focus & CTA Suite',
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
    id: 'solo_focus_and_unlock',
    name: SUITE_NAMES.solo_focus_and_unlock,
    critical: true,
    color: '#facc15',
  },
];

export const EXTRA_TESTS = [
  /* 1. Default selection sources from the shared helper. */
  makeCase('solo_focus_and_unlock', 'default_selection_from_helper',
    'SoloChallenge computes defaultSelectedNumber via getDefaultSelectedLevel(progress, getSoloLevelCount())',
    () => {
      const required = missingTokens(soloChallengeSource, [
        "import { getDefaultSelectedLevel } from '@/lib/soloProgressHelpers'",
        'getDefaultSelectedLevel(progress, getSoloLevelCount())',
      ]);
      if (required.length) {
        return fail('Default selection no longer goes through the shared helper.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          file: 'pages/SoloChallenge.jsx',
          actionType: ACTION_TYPES.CODE_FIX,
          expected: 'helper import + call',
          actual: { required },
        });
      }
      return pass('Default selection is on the shared helper.', {
        verification: 'STATIC_CONTRACT',
        classification: 'STATIC_CHECK_LIMITATION',
      });
    },
    { actionType: ACTION_TYPES.CODE_FIX }),

  /* 2. CTA label is derived, never hard-coded. */
  makeCase('solo_focus_and_unlock', 'bottom_cta_reflects_selected_level',
    'SoloChallenge bottom CTA renders LEVEL ${selectedLevel.levelNumber} (or defaultSelectedNumber while loading) and never hard-codes "LEVEL 1"',
    () => {
      const required = missingTokens(soloChallengeSource, [
        'LEVEL ${selectedLevel.levelNumber}',
        'LEVEL ${defaultSelectedNumber}',
      ]);
      const forbidden = forbiddenTokensFound(soloChallengeSource, [
        '>LEVEL 1<',
        "'LEVEL 1'",
        '"LEVEL 1"',
      ]);
      if (required.length || forbidden.length) {
        return fail('CTA label is not properly derived.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          file: 'pages/SoloChallenge.jsx',
          actionType: ACTION_TYPES.CODE_FIX,
          expected: 'template-literal labels for both selectedLevel and defaultSelectedNumber; no hard-coded LEVEL 1',
          actual: { required, forbidden },
        });
      }
      return pass('CTA label is dynamic.', {
        verification: 'STATIC_CONTRACT',
        classification: 'STATIC_CHECK_LIMITATION',
      });
    },
    { actionType: ACTION_TYPES.CODE_FIX }),

  /* 3. progressLoaded gate exists. */
  makeCase('solo_focus_and_unlock', 'progress_loaded_gate_present',
    'SoloChallenge declares progressLoaded state + setter so async hydration cannot commit the CTA to the wrong level',
    () => {
      const required = missingTokens(soloChallengeSource, [
        'progressLoaded',
        'setProgressLoaded(true)',
      ]);
      if (required.length) {
        return fail('progressLoaded gate missing.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          file: 'pages/SoloChallenge.jsx',
          actionType: ACTION_TYPES.CODE_FIX,
          expected: 'progressLoaded state + setProgressLoaded(true) call',
          actual: { required },
        });
      }
      return pass('Hydration gate is present.', {
        verification: 'STATIC_CONTRACT',
        classification: 'STATIC_CHECK_LIMITATION',
      });
    },
    { actionType: ACTION_TYPES.CODE_FIX }),

  /* 4. Selection stickiness flag exists. */
  makeCase('solo_focus_and_unlock', 'user_touched_selection_flag',
    'SoloChallenge tracks userTouchedSelection so a tapped level stays selected even if progress refreshes',
    () => {
      const required = missingTokens(soloChallengeSource, [
        'userTouchedSelection',
        'setUserTouchedSelection(true)',
        'setUserTouchedSelection(false)',
      ]);
      if (required.length) {
        return fail('Selection stickiness flag missing.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          file: 'pages/SoloChallenge.jsx',
          actionType: ACTION_TYPES.CODE_FIX,
          expected: 'userTouchedSelection state + both setter usages',
          actual: { required },
        });
      }
      return pass('Selection stickiness is wired.', {
        verification: 'STATIC_CONTRACT',
        classification: 'STATIC_CHECK_LIMITATION',
      });
    },
    { actionType: ACTION_TYPES.CODE_FIX }),

  /* 5. Initial focus uses helper-computed default. */
  makeCase('solo_focus_and_unlock', 'level_map_path_receives_focus_target',
    'SoloChallenge passes focusLevelNumber={defaultSelectedNumber} to LevelMapPath so auto-scroll targets the current playable level',
    () => {
      const required = missingTokens(soloChallengeSource, [
        'focusLevelNumber={defaultSelectedNumber}',
      ]);
      if (required.length) {
        return fail('focusLevelNumber prop not wired to LevelMapPath.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          file: 'pages/SoloChallenge.jsx',
          actionType: ACTION_TYPES.CODE_FIX,
          expected: 'focusLevelNumber={defaultSelectedNumber}',
          actual: { required },
        });
      }
      return pass('Auto-scroll target is sourced from the shared helper.', {
        verification: 'STATIC_CONTRACT',
        classification: 'STATIC_CHECK_LIMITATION',
      });
    },
    { actionType: ACTION_TYPES.CODE_FIX, runtimeProofRequired: true }),

  /* 6. LevelMapPath accepts focusLevelNumber and prefers it over status='current'. */
  makeCase('solo_focus_and_unlock', 'level_map_path_honors_focus_target',
    'LevelMapPath accepts focusLevelNumber and uses it as the auto-scroll target when provided',
    () => {
      const required = missingTokens(levelMapPathSource, [
        'focusLevelNumber',
        'levels.find((l) => l.levelNumber === focusLevelNumber)',
      ]);
      if (required.length) {
        return fail('LevelMapPath does not honor focusLevelNumber.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          file: 'components/solo/LevelMapPath.jsx',
          actionType: ACTION_TYPES.CODE_FIX,
          expected: 'focusLevelNumber prop + lookup',
          actual: { required },
        });
      }
      return pass('LevelMapPath honors the focus target.', {
        verification: 'STATIC_CONTRACT',
        classification: 'STATIC_CHECK_LIMITATION',
      });
    },
    { actionType: ACTION_TYPES.CODE_FIX }),

  /* 7. Auto-scroll math is layout-timing resilient.
   *
   *    Codex122 — Updated to match the Codex121 inner-container architecture.
   *    The old contract required `scrollIntoView` as a fallback. That token
   *    is now FORBIDDEN by `solo_map_focus.solo_map_scroll_container_is_inner`
   *    because `scrollIntoView` can be resolved against an outer scrollable
   *    ancestor (page-level), causing the "page scrolls instead of inner
   *    container" bug that left scrollTop=0 on the Solo map.
   *
   *    The replacement resilience contract: rAF retry + clientHeight guard
   *    + direct container.scrollTop assignment via the externalised helper.
   *    No `scrollIntoView` is required (or allowed). This is intentionally
   *    NOT a weakening — the architecture is stricter now. */
  makeCase('solo_focus_and_unlock', 'auto_scroll_resilient_to_layout_timing',
    'LevelMapPath defers auto-scroll to the next animation frame and guards on container.clientHeight (Codex122 inner-container architecture)',
    () => {
      const required = missingTokens(levelMapPathSource, [
        'requestAnimationFrame',
        'container.clientHeight',
        // Codex122 — direct scrollTop assignment is the new "fallback" path
        // (formerly scrollIntoView, now forbidden by the inner-container
        // contract). Confirms the architecture didn't drift back to the
        // outer-scroll-ancestor bug.
        'container.scrollTop',
      ]);
      // Defensive: scrollIntoView must NOT come back into the component.
      const forbidden = forbiddenTokensFound(levelMapPathSource, [
        'scrollIntoView',
      ]);
      if (required.length || forbidden.length) {
        return fail('Auto-scroll is not resilient to the Android-WebView "clientHeight===0 on first paint" case, or scrollIntoView regression detected.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          file: 'components/solo/LevelMapPath.jsx',
          actionType: ACTION_TYPES.CODE_FIX,
          expected: 'rAF + clientHeight guard + direct container.scrollTop; no scrollIntoView',
          actual: { required, forbidden },
        });
      }
      return pass('Auto-scroll math is layout-timing resilient via rAF + clientHeight guard + direct scrollTop assignment.', {
        verification: 'STATIC_CONTRACT',
        classification: 'STATIC_CHECK_LIMITATION',
      });
    },
    { actionType: ACTION_TYPES.CODE_FIX }),
];