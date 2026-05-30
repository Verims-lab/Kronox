// Kronox Health Center — Solo focus / CTA / unlock contracts (Codex109).
//
// SCOPE
//   Locks the four product invariants the Codex109 pass fixed:
//     1. There is at most ONE 'current' level returned by getSoloLevels.
//        Previously every unlocked-but-incomplete level became 'current',
//        which forced the auto-scroll target to Level 1 and forced the
//        bottom Play CTA to always render "Level 1".
//     2. Passing Level N must unlock Level N+1 (currentLevel = N+1).
//        applyLevelAttempt is the single writer; we lock its formula
//        statically so future refactors can't introduce off-by-one
//        regressions.
//     3. SoloChallenge's bottom Play CTA never hard-codes "Level 1".
//        It must render the currently selected level number.
//     4. LevelMapPath's auto-scroll effect is hardened against the
//        Android-WebView "clientHeight===0 on first paint" case (deferred
//        via requestAnimationFrame + retry).
//
// HONESTY RULES
//   - Pure static token / formula checks.
//   - No scoring constants touched.
//   - Real-device proof of the actual scroll landing position remains
//     covered by the existing `auto_scroll_runtime_proof_needed` case in
//     the Solo Adventure Map suite — we do not duplicate it here.

import soloChallengeSource from '../../pages/SoloChallenge.jsx?raw';
import levelMapPathSource from '../solo/LevelMapPath.jsx?raw';
import soloLevelsLibSource from '../../lib/soloLevels.js?raw';

const STATUS = {
  PASS: 'PASS',
  FAIL: 'FAIL',
};

const ACTION_TYPES = {
  CODE_FIX: 'CODE_FIX',
};

const SUITE_NAMES = {
  solo_focus_and_unlock: 'Solo Focus & Unlock Suite',
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
  /* 1. getSoloLevels picks a SINGLE current level (not every uncompleted one). */
  makeCase('solo_focus_and_unlock', 'getSoloLevels_picks_single_current_level',
    'getSoloLevels selects exactly one current level (the highest unlocked & unfinished one), preventing "Level 1 always current" regressions',
    () => {
      const required = missingTokens(soloLevelsLibSource, [
        'let currentLevelNumber = cap;',
        'for (let n = cap; n >= 1; n -= 1)',
        'lvl.levelNumber === currentLevelNumber && !isCompleted',
      ]);
      // The old buggy formula collapsed every non-completed unlocked
      // level to 'current'. We forbid that exact fallback as the SOLE
      // branch for 'current'.
      const forbidden = forbiddenTokensFound(soloLevelsLibSource, [
        // explicit anti-pattern: a bare else-current chain that would
        // mark multiple levels current.
        "else if (isCompleted) status = 'completed';\n    else status = 'current';",
      ]);
      if (required.length || forbidden.length) {
        return fail('Single-current-level picker missing — multiple levels could be flagged current at once.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          file: 'lib/soloLevels.js',
          actionType: ACTION_TYPES.CODE_FIX,
          expected: 'highest-unfinished-unlocked level picked as the unique current; bare else-current fallback removed',
          actual: { required, forbidden },
        });
      }
      return pass('Exactly one current level is selected by getSoloLevels.', {
        verification: 'STATIC_CONTRACT',
        classification: 'STATIC_CHECK_LIMITATION',
      });
    },
    { actionType: ACTION_TYPES.CODE_FIX }),

  /* 2. Passing Level N unlocks Level N+1 (off-by-one regression guard). */
  makeCase('solo_focus_and_unlock', 'passing_level_n_unlocks_level_n_plus_1',
    'applyLevelAttempt bumps currentLevel to fresh.levelNumber + 1 on pass and never decreases it on replay/fail',
    () => {
      const required = missingTokens(soloLevelsLibSource, [
        'const nextUnlock = Math.min(getSoloLevelCount(), fresh.levelNumber + 1);',
        'if (nextUnlock > next.currentLevel) next.currentLevel = nextUnlock;',
        'if (fresh.passed) {',
      ]);
      // Make sure stars are still monotonic so replay can't regress.
      const requiredMerge = missingTokens(soloLevelsLibSource, [
        'if (freshStars < prevStars)',
        'Never regress stars',
      ]);
      if (required.length || requiredMerge.length) {
        return fail('Unlock formula or stars-monotonic guard missing — risk of Level 9 stuck locked after Level 8 pass.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          file: 'lib/soloLevels.js',
          actionType: ACTION_TYPES.CODE_FIX,
          expected: 'fresh.levelNumber + 1 unlock on pass; never decreases; never regresses stars on replay',
          actual: { required, requiredMerge },
        });
      }
      return pass('Pass → next level unlock formula and monotonic stars guard are in place.', {
        verification: 'STATIC_CONTRACT',
        classification: 'STATIC_CHECK_LIMITATION',
      });
    },
    { actionType: ACTION_TYPES.CODE_FIX }),

  /* 3. Bottom Play CTA reflects the selected level, never hard-coded "Level 1". */
  makeCase('solo_focus_and_unlock', 'bottom_cta_reflects_selected_level',
    'SoloChallenge bottom CTA renders the selected level number (no hard-coded "LEVEL 1" label)',
    () => {
      const required = missingTokens(soloChallengeSource, [
        'selectedLevel ? `LEVEL ${selectedLevel.levelNumber}`',
      ]);
      // Forbid any hard-coded "LEVEL 1" / "Level 1" CTA string in source.
      // The hint banner is allowed to use "Level X" via template literal,
      // so we only guard the literal hard-coded form.
      const forbidden = forbiddenTokensFound(soloChallengeSource, [
        '>LEVEL 1<',
        "'LEVEL 1'",
        '"LEVEL 1"',
      ]);
      if (required.length || forbidden.length) {
        return fail('Bottom Play CTA does not derive its label from the selected level.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          file: 'pages/SoloChallenge.jsx',
          actionType: ACTION_TYPES.CODE_FIX,
          expected: 'CTA label = `LEVEL ${selectedLevel.levelNumber}`; no hard-coded LEVEL 1 literal',
          actual: { required, forbidden },
        });
      }
      return pass('Bottom CTA reflects the currently selected level dynamically.', {
        verification: 'STATIC_CONTRACT',
        classification: 'STATIC_CHECK_LIMITATION',
      });
    },
    { actionType: ACTION_TYPES.CODE_FIX }),

  /* 4. Initial selection defaults to current/next playable, not Level 1 blindly. */
  makeCase('solo_focus_and_unlock', 'initial_selection_uses_current_level',
    'SoloChallenge initial selected level number resolves from levels.find(status==="current") before falling back to the first playable level',
    () => {
      const required = missingTokens(soloChallengeSource, [
        "const current = levels.find((l) => l.status === 'current');",
        'if (current) return current.levelNumber;',
        "const firstPlayable = levels.find((l) => l.isPlayable);",
      ]);
      if (required.length) {
        return fail('Initial selection does not prefer the current level — Solo would always start at Level 1.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          file: 'pages/SoloChallenge.jsx',
          actionType: ACTION_TYPES.CODE_FIX,
          expected: 'initialSelectedNumber prefers current → first playable → 1',
          actual: { required },
        });
      }
      return pass('Initial selection prefers the current level.', {
        verification: 'STATIC_CONTRACT',
        classification: 'STATIC_CHECK_LIMITATION',
      });
    },
    { actionType: ACTION_TYPES.CODE_FIX }),

  /* 5. Auto-scroll is hardened against zero-height first paint. */
  makeCase('solo_focus_and_unlock', 'auto_scroll_resilient_to_layout_timing',
    'LevelMapPath defers the auto-scroll math to the next animation frame and retries when the container height is not yet measured',
    () => {
      const required = missingTokens(levelMapPathSource, [
        'requestAnimationFrame',
        'container.clientHeight',
        'scrollIntoView',
      ]);
      if (required.length) {
        return fail('Auto-scroll is not resilient to the Android-WebView "clientHeight===0 on first paint" case.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          file: 'components/solo/LevelMapPath.jsx',
          actionType: ACTION_TYPES.CODE_FIX,
          expected: 'rAF + clientHeight guard + scrollIntoView fallback',
          actual: { required },
        });
      }
      return pass('Auto-scroll defers to rAF and falls back to scrollIntoView when layout is not ready.', {
        verification: 'STATIC_CONTRACT',
        classification: 'STATIC_CHECK_LIMITATION',
      });
    },
    { actionType: ACTION_TYPES.CODE_FIX }),
];