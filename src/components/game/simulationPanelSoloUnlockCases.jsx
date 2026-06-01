// Kronox Health Center — Solo unlock self-healing contracts (Codex110).
//
// SCOPE
//   Codex109 added a "single current level" picker contract. It did NOT
//   guarantee that completing Level N actually unlocks Level N+1 when
//   the persisted `currentLevel` is stale. Codex110 makes the unlock
//   self-healing by deriving the frontier from BOTH `currentLevel` AND
//   the highest level with `bestStars > 0`. This suite locks that
//   contract statically, plus the CTA / default-selection / Profile
//   single-source-of-truth invariants.
//
//   Each test is a pure formula or token check. The behavioral cases
//   (1, 2, 4) ALSO exercise the live formulas — those are real PASS/FAIL
//   signals, not static-only contracts.
//
// HONESTY RULES
//   - No scoring constants touched.
//   - The static contract cases mark themselves STATIC_CHECK_LIMITATION
//     when the assertion is a token presence check.
//   - The runtime "auto-scroll lands at current level" gap is already
//     covered by `auto_scroll_runtime_proof_needed` in the Solo
//     Adventure Map suite — not duplicated here.

import {
  applyLevelAttempt,
  getSoloLevels,
  getSoloLevelCount,
} from '../../lib/soloLevels';
import {
  canPlayLevel,
  getCurrentPlayableLevel,
  getDefaultSelectedLevel,
  getEffectiveUnlockedLevel,
  getHighestCompletedLevel,
  getLevelStatus,
} from '../../lib/soloProgressHelpers';
import soloChallengeSource from '../../pages/SoloChallenge.jsx?raw';
import profilePageSource from '../../pages/ProfilePage.jsx?raw';
import soloLevelsLibSource from '../../lib/soloLevels.js?raw';

const STATUS = { PASS: 'PASS', FAIL: 'FAIL' };
const ACTION_TYPES = { CODE_FIX: 'CODE_FIX' };

const SUITE_NAMES = {
  solo_unlock_self_healing: 'Solo Unlock Self-Healing Suite',
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

// Builds a progress snapshot where levels 1..highestCompleted are all
// marked completed with 3 stars. Useful for the 1..8 → 9 unlock test.
function buildProgressForCompleted(highest, persistedCurrentLevel) {
  const levels = {};
  for (let n = 1; n <= highest; n += 1) {
    levels[String(n)] = {
      bestStars: 3,
      bestMistakes: 0,
      bestTimeSeconds: 60,
      attempts: 1,
      completedAt: new Date().toISOString(),
    };
  }
  return { currentLevel: persistedCurrentLevel ?? highest + 1, levels };
}

export const EXTRA_SUITES = [
  {
    id: 'solo_unlock_self_healing',
    name: SUITE_NAMES.solo_unlock_self_healing,
    critical: true,
    color: '#34d399',
  },
];

export const EXTRA_TESTS = [
  /* 1. Levels 1-8 completed → current playable = 9 (the headline bug). */
  makeCase('solo_unlock_self_healing', 'current_level_from_completed_progress',
    'After completing Levels 1-8, current playable level resolves to 9 and Level 9 status is "current" (not locked)',
    () => {
      const total = getSoloLevelCount();
      const progress = buildProgressForCompleted(8, 9);
      const current = getCurrentPlayableLevel(progress, total);
      const levels = getSoloLevels(progress);
      const lvl9 = levels.find((l) => l.levelNumber === 9);
      const lvl10 = levels.find((l) => l.levelNumber === 10);
      if (current !== 9 || lvl9?.status !== 'current' || !lvl9?.isPlayable || lvl10?.status !== 'locked') {
        return fail('Level 9 must be the current playable level after Level 8 completion.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          file: 'lib/soloProgressHelpers.js + lib/soloLevels.js',
          actionType: ACTION_TYPES.CODE_FIX,
          expected: 'getCurrentPlayableLevel === 9; Level 9 current/playable; Level 10 locked',
          actual: { current, lvl9, lvl10 },
        });
      }
      return pass('Level 9 is unlocked and current after completing Levels 1-8.');
    },
    { actionType: ACTION_TYPES.CODE_FIX }),

  /* 2. Self-healing: stale persisted currentLevel must NOT lock completed levels. */
  makeCase('solo_unlock_self_healing', 'unlock_self_heals_from_stars_when_currentLevel_is_stale',
    'If persisted currentLevel is stale (e.g. 1) but Levels 1-8 have bestStars > 0, the effective unlock recovers to 9',
    () => {
      const total = getSoloLevelCount();
      // Stale: currentLevel=1 but 8 levels are actually completed.
      const stale = buildProgressForCompleted(8, 1);
      const unlocked = getEffectiveUnlockedLevel(stale, total);
      const current = getCurrentPlayableLevel(stale, total);
      const highest = getHighestCompletedLevel(stale);
      if (highest !== 8 || unlocked !== 9 || current !== 9) {
        return fail('Self-healing unlock formula did not recover from stale currentLevel.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          file: 'lib/soloProgressHelpers.js',
          actionType: ACTION_TYPES.CODE_FIX,
          expected: 'highestCompleted=8, unlocked=9, current=9 even with currentLevel=1',
          actual: { highest, unlocked, current },
        });
      }
      return pass('Stale currentLevel is recovered from bestStars history.');
    },
    { actionType: ACTION_TYPES.CODE_FIX }),

  /* 3. applyLevelAttempt(N, passed) guarantees next.currentLevel >= N+1. */
  makeCase('solo_unlock_self_healing', 'passing_level_n_guarantees_currentLevel_n_plus_1',
    'applyLevelAttempt always sets currentLevel ≥ N+1 after passing Level N (even if prior currentLevel was wrong)',
    () => {
      const total = getSoloLevelCount();
      // Scenario A: passing Level 8 with stale currentLevel=1.
      const a = applyLevelAttempt({ currentLevel: 1, levels: {} }, {
        levelNumber: 8, stars: 2, mistakes: 3, timeSeconds: 90, passed: true,
      });
      // Scenario B: replaying old Level 2 when already on currentLevel=9.
      const b = applyLevelAttempt(buildProgressForCompleted(8, 9), {
        levelNumber: 2, stars: 3, mistakes: 0, timeSeconds: 40, passed: true,
      });
      if (a.currentLevel < 9 || a.currentLevel > total) {
        return fail('Passing Level 8 did not unlock Level 9 from a stale snapshot.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          file: 'lib/soloLevels.js (applyLevelAttempt)',
          actionType: ACTION_TYPES.CODE_FIX,
          expected: 'a.currentLevel === 9',
          actual: { a },
        });
      }
      if (b.currentLevel !== 9) {
        return fail('Replaying an older level must not change the unlock frontier.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          file: 'lib/soloLevels.js (applyLevelAttempt)',
          actionType: ACTION_TYPES.CODE_FIX,
          expected: 'b.currentLevel === 9',
          actual: { b },
        });
      }
      return pass('applyLevelAttempt always unlocks N+1 on pass and never regresses on replay.');
    },
    { actionType: ACTION_TYPES.CODE_FIX }),

  /* 4. Failing Level N does NOT unlock Level N+1. */
  makeCase('solo_unlock_self_healing', 'failing_level_does_not_unlock',
    'applyLevelAttempt with passed=false does NOT unlock the next level',
    () => {
      const before = { currentLevel: 5, levels: {
        '1': { bestStars: 3 }, '2': { bestStars: 3 }, '3': { bestStars: 3 }, '4': { bestStars: 3 },
      } };
      const after = applyLevelAttempt(before, {
        levelNumber: 5, stars: 0, mistakes: 8, timeSeconds: 120, passed: false,
      });
      if (after.currentLevel !== 5) {
        return fail('Failing Level 5 changed the unlock frontier.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          file: 'lib/soloLevels.js (applyLevelAttempt)',
          actionType: ACTION_TYPES.CODE_FIX,
          expected: 'after.currentLevel === 5',
          actual: { after },
        });
      }
      return pass('Failed attempts never unlock the next level.');
    },
    { actionType: ACTION_TYPES.CODE_FIX }),

  /* 5. Default selection helper matches current playable. */
  makeCase('solo_unlock_self_healing', 'default_selected_level_uses_current_playable',
    'getDefaultSelectedLevel and getCurrentPlayableLevel return the same number for representative scenarios',
    () => {
      const total = getSoloLevelCount();
      const scenarios = [
        { name: 'fresh', p: { currentLevel: 1, levels: {} }, expect: 1 },
        { name: 'mid', p: buildProgressForCompleted(3, 4), expect: 4 },
        { name: 'level-9', p: buildProgressForCompleted(8, 9), expect: 9 },
        { name: 'all-but-final', p: buildProgressForCompleted(total - 1, total), expect: total },
      ];
      for (const s of scenarios) {
        const a = getDefaultSelectedLevel(s.p, total);
        const b = getCurrentPlayableLevel(s.p, total);
        if (a !== s.expect || b !== s.expect) {
          return fail(`Scenario "${s.name}" mismatch: default=${a}, current=${b}, expected=${s.expect}`, {
            verification: 'STATIC_CONTRACT',
            classification: 'REAL_PRODUCT_RISK',
            file: 'lib/soloProgressHelpers.js',
            actionType: ACTION_TYPES.CODE_FIX,
          });
        }
      }
      return pass('Default selection and current playable are unified across scenarios.');
    },
    { actionType: ACTION_TYPES.CODE_FIX }),

  /* 6. Locked levels cannot be played. */
  makeCase('solo_unlock_self_healing', 'locked_levels_block_canPlay',
    'canPlayLevel returns false for any level beyond the effective unlock frontier',
    () => {
      const total = getSoloLevelCount();
      const progress = buildProgressForCompleted(8, 9);
      const checks = [
        { n: 9, expect: true },
        { n: 10, expect: false },
        { n: total, expect: false },
        { n: 4, expect: true }, // replay
      ];
      for (const c of checks) {
        const got = canPlayLevel(c.n, progress, total);
        if (got !== c.expect) {
          return fail(`canPlayLevel(${c.n}) returned ${got}, expected ${c.expect}.`, {
            verification: 'STATIC_CONTRACT',
            classification: 'REAL_PRODUCT_RISK',
            file: 'lib/soloProgressHelpers.js',
            actionType: ACTION_TYPES.CODE_FIX,
          });
        }
      }
      return pass('Locked levels properly block play; unlocked levels allow play.');
    },
    { actionType: ACTION_TYPES.CODE_FIX }),

  /* 7. CTA never hard-codes "Level 1" — token check. */
  makeCase('solo_unlock_self_healing', 'bottom_cta_not_hardcoded_level_1',
    'SoloChallenge bottom CTA label is derived from selectedLevel/defaultSelectedNumber, never hard-coded to "Level 1"',
    () => {
      const required = missingTokens(soloChallengeSource, [
        'selectedLevel',
        'defaultSelectedNumber',
        'LEVEL ${selectedLevel.levelNumber}',
        'LEVEL ${defaultSelectedNumber}',
      ]);
      const forbidden = forbiddenTokensFound(soloChallengeSource, [
        '>LEVEL 1<',
        "'LEVEL 1'",
        '"LEVEL 1"',
      ]);
      if (required.length || forbidden.length) {
        return fail('CTA label is not properly derived from the shared default selection.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          file: 'pages/SoloChallenge.jsx',
          actionType: ACTION_TYPES.CODE_FIX,
          expected: 'template-literal label backed by selectedLevel + defaultSelectedNumber; no hard-coded LEVEL 1',
          actual: { required, forbidden },
        });
      }
      return pass('CTA label derives from the shared helper.', {
        verification: 'STATIC_CONTRACT',
        classification: 'STATIC_CHECK_LIMITATION',
      });
    },
    { actionType: ACTION_TYPES.CODE_FIX }),

  /* 8. Progress loaded flag exists so async resolves don't lock CTA to wrong level. */
  makeCase('solo_unlock_self_healing', 'progress_loaded_gates_cta_label',
    'SoloChallenge tracks a progressLoaded state so the CTA does not commit to Level 1 before the server snapshot resolves',
    () => {
      const required = missingTokens(soloChallengeSource, [
        'progressLoaded',
        'setProgressLoaded(true)',
        "'YÜKLENİYOR'",
      ]);
      if (required.length) {
        return fail('progressLoaded gate missing — CTA could lock to Level 1 during async hydration.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          file: 'pages/SoloChallenge.jsx',
          actionType: ACTION_TYPES.CODE_FIX,
          expected: 'progressLoaded state + setter + loading fallback label',
          actual: { required },
        });
      }
      return pass('CTA hydration is gated on progressLoaded.', {
        verification: 'STATIC_CONTRACT',
        classification: 'STATIC_CHECK_LIMITATION',
      });
    },
    { actionType: ACTION_TYPES.CODE_FIX }),

  /* 9. Initial focus uses helper, not the multi-current find(). */
  makeCase('solo_unlock_self_healing', 'solo_initial_focus_uses_current_playable',
    'SoloChallenge passes focusLevelNumber=defaultSelectedNumber to LevelMapPath so the screen opens around the current playable level',
    () => {
      const required = missingTokens(soloChallengeSource, [
        'focusLevelNumber={defaultSelectedNumber}',
        'getDefaultSelectedLevel(progress, getSoloLevelCount())',
      ]);
      if (required.length) {
        return fail('Initial focus is not wired through the shared helper.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          file: 'pages/SoloChallenge.jsx',
          actionType: ACTION_TYPES.CODE_FIX,
          expected: 'focusLevelNumber prop sourced from getDefaultSelectedLevel',
          actual: { required },
        });
      }
      return pass('Initial focus target is the helper-computed current playable level.', {
        verification: 'STATIC_CONTRACT',
        classification: 'STATIC_CHECK_LIMITATION',
      });
    },
    { actionType: ACTION_TYPES.CODE_FIX, runtimeProofRequired: true }),

  /* 10. Profile uses the same shared helper as Solo. */
  makeCase('solo_unlock_self_healing', 'profile_level_uses_shared_helper',
    'ProfilePage computes its Seviye tile via getCurrentPlayableLevel — the same source of truth Solo uses',
    () => {
      const required = missingTokens(profilePageSource, [
        "import { getCurrentPlayableLevel } from '@/lib/soloProgressHelpers'",
        'getCurrentPlayableLevel(soloProgress, getSoloLevelCount())',
      ]);
      // Also forbid the old hard-coded fallback so we don't regress.
      const forbidden = forbiddenTokensFound(profilePageSource, [
        "value: 1, ",
      ]);
      if (required.length || forbidden.length) {
        return fail('Profile Seviye tile is not on the shared source of truth.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          file: 'pages/ProfilePage.jsx',
          actionType: ACTION_TYPES.CODE_FIX,
          expected: 'import + call getCurrentPlayableLevel; no hard-coded value:1',
          actual: { required, forbidden },
        });
      }
      return pass('Profile Seviye uses the shared helper.', {
        verification: 'STATIC_CONTRACT',
        classification: 'STATIC_CHECK_LIMITATION',
      });
    },
    { actionType: ACTION_TYPES.CODE_FIX }),

  /* 11. getLevelStatus locked/current/completed shape sanity. */
  makeCase('solo_unlock_self_healing', 'level_status_shape_invariants',
    'getLevelStatus returns "completed" for stars>0, "current" for unlocked-not-completed, "locked" beyond frontier',
    () => {
      const total = getSoloLevelCount();
      const progress = buildProgressForCompleted(8, 9);
      const expectations = {
        1: 'completed', 4: 'completed', 8: 'completed',
        9: 'current',
        10: 'locked', 15: 'locked', [total]: 'locked',
      };
      for (const [k, want] of Object.entries(expectations)) {
        const got = getLevelStatus(Number(k), progress, total);
        if (got !== want) {
          return fail(`getLevelStatus(${k}) = ${got}, expected ${want}.`, {
            verification: 'STATIC_CONTRACT',
            classification: 'REAL_PRODUCT_RISK',
            file: 'lib/soloProgressHelpers.js',
            actionType: ACTION_TYPES.CODE_FIX,
          });
        }
      }
      return pass('Level status mapping is correct for the canonical 1-8 completed scenario.');
    },
    { actionType: ACTION_TYPES.CODE_FIX }),

  /* 12. soloLevels.js still re-exports the helpers (single import surface). */
  makeCase('solo_unlock_self_healing', 'soloLevels_reexports_helpers',
    'lib/soloLevels.js re-exports the unlock helpers so callers can import from one place',
    () => {
      const required = missingTokens(soloLevelsLibSource, [
        "export { getEffectiveUnlockedLevel, getHighestCompletedLevel } from './soloProgressHelpers'",
      ]);
      if (required.length) {
        return fail('soloLevels.js no longer surfaces the helper re-exports.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          file: 'lib/soloLevels.js',
          actionType: ACTION_TYPES.CODE_FIX,
          expected: 'helper re-export line present',
          actual: { required },
        });
      }
      return pass('Helper re-exports preserved.', {
        verification: 'STATIC_CONTRACT',
        classification: 'STATIC_CHECK_LIMITATION',
      });
    },
    { actionType: ACTION_TYPES.CODE_FIX }),
];
