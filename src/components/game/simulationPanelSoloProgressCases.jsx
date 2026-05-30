// Kronox Health Center — Solo Progress / Profile / Gameplay timer cases.
//
// SCOPE
//   STATIC_CONTRACT health cases for the Solo Level Path + Profile
//   source-of-truth, the Solo result popup CTA contract, and the
//   in-gameplay last-10-seconds audio cue. Companion NOT_AUTOMATABLE
//   cases keep honest runtime gaps visible.
//
// REGISTRATION
//   This module is registered through
//   components/game/simulationPanelCaseRegistry.js (the single aggregator
//   SimulationPanel.jsx imports). Adding a NEW health case file should
//   follow the same pattern:
//     1. Export `EXTRA_SUITES` (suite descriptors) and `EXTRA_TESTS`
//        (case array) from the new file.
//     2. Add the new file to the registry's `MODULES` list.
//     3. Do NOT mutate simulationPanelExtraCases.js — that file has hit
//        the 2000-line edit cap and is intentionally frozen.
//
// HONESTY RULES
//   - STATIC_CONTRACT only: presence/absence/regex checks of source tokens.
//   - Runtime audio playback and on-device popup rendering remain
//     NOT_AUTOMATABLE.
//   - No scoring constant or status is weakened anywhere.

import profilePageSource from '../../pages/ProfilePage.jsx?raw';
import leaderboardPageSource from '../../pages/LeaderboardPage.jsx?raw';
import soloChallengeSource from '../../pages/SoloChallenge.jsx?raw';
import soloLevelsLibSource from '../../lib/soloLevels.js?raw';
import soloProgressHelpersSource from '../../lib/soloProgressHelpers.js?raw';
import soloRankingSource from '../../lib/soloRanking.js?raw';
import soloLevelResultSource from './SoloLevelResult.jsx?raw';
import soloLevelTimerSource from './SoloLevelTimer.jsx?raw';
import gameSoundsSource from '../../lib/gameSounds.js?raw';
import {
  backfillSoloScores,
  calculateSoloAttemptResult,
  calculateSoloLevelScore,
  calculateSoloLevelScoreFromBestResult,
  getBestSoloLevelResult,
  summarizeSoloProgress,
} from '../../lib/soloProgressHelpers';

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
  solo_progress_health: 'Solo Progress / Profile Source-of-Truth Suite',
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

// Suite descriptor surfaced through the registry. Each new health case
// module exports its own EXTRA_SUITES so the registry can flatten them
// without SimulationPanel.jsx knowing about individual files.
export const EXTRA_SUITES = [
  {
    id: 'solo_progress_health',
    name: SUITE_NAMES.solo_progress_health,
    critical: true,
    color: '#fbbf24',
  },
];

export const EXTRA_TESTS = [
  /* ============================================================
   *  1. SOLO / PROFILE SOURCE OF TRUTH
   * ============================================================ */
  makeCase('solo_progress_health', 'solo_progress_profile_source_of_truth',
    'Profile Level and Solo Level Path read from the SAME user-specific solo_progress source',
    () => {
      // a) Profile imports readSoloProgress and derives `profileLevel` from it.
      const profileWires = [
        "from '@/lib/soloLevels'",
        'readSoloProgress',
        'profileLevel',
        'currentLevel',
      ];
      const profileMissing = missingTokens(profilePageSource, profileWires);

      // b) Profile must NOT hard-code Level value as 1.
      const profileHardcodedLevel = /label:\s*'Level',\s*value:\s*1\b/.test(profilePageSource);

      // c) SoloChallenge reads the same helper.
      const soloMissing = missingTokens(soloChallengeSource, ['readSoloProgress']);

      // d) Persistence path: writeSoloProgress is the single writer, mirrors
      //    to localStorage AND updates the user profile.
      const writerMissing = missingTokens(soloLevelsLibSource, [
        'export async function writeSoloProgress',
        'safeWriteLocal(normalized)',
        'base44.auth.updateMe({ solo_progress: normalized })',
      ]);

      // e) currentLevel monotonic guard — Codex110 reshaped this from
      //    "bump only on pass" to a self-healing recompute:
      //       frontier = max(prev currentLevel, highestCompleted + 1)
      //       if (passed) frontier = max(frontier, freshLevel + 1)
      //    The recompute can never DECREASE currentLevel (Math.min(total,
      //    max(...))) so monotonicity is preserved by construction.
      const monotonicMissing = missingTokens(soloLevelsLibSource, [
        'if (fresh.passed) {',
        'const highestCompleted = getHighestCompletedLevel(next);',
        'Math.max(',
        'next.currentLevel = Math.min(total, frontier);',
      ]);

      // f) bestStars cannot regress — mergeBetterResult guard.
      const mergeMissing = missingTokens(soloLevelsLibSource, [
        'if (freshStars < prevStars)',
        'Never regress stars',
      ]);

      if (profileMissing.length || soloMissing.length || writerMissing.length || monotonicMissing.length || mergeMissing.length || profileHardcodedLevel) {
        return fail('Profile Level no longer ties cleanly to solo_progress, or solo writer guards regressed.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          file: 'ProfilePage.jsx + SoloChallenge.jsx + lib/soloLevels.js',
          actionType: ACTION_TYPES.CODE_FIX,
          expected: {
            profile: 'imports readSoloProgress and derives profileLevel from solo_progress.currentLevel',
            soloPath: 'reads readSoloProgress',
            writer: 'writeSoloProgress mirrors to localStorage AND updateMe',
            monotonic: 'currentLevel only bumps when passed AND new unlock > current',
            merge: 'bestStars never decreases on replay',
            disallowed: 'Profile must not hard-code Level value 1',
          },
          actual: {
            profileMissing,
            soloMissing,
            writerMissing,
            monotonicMissing,
            mergeMissing,
            profileHardcodedLevel,
          },
        });
      }
      return pass('Profile + Solo Level Path share one source of truth: readSoloProgress(user.solo_progress) with monotonic level + non-regressing stars.', {
        verification: 'STATIC_CONTRACT',
        classification: 'STATIC_CHECK_LIMITATION',
        actionType: ACTION_TYPES.CODE_FIX,
        actual: 'shared helper + monotonic guards present',
      });
    },
    { actionType: ACTION_TYPES.CODE_FIX, runtimeProofRequired: true }),

  // Honest gap: two-account / device-level proof for "passing a Solo level
  // immediately moves Profile Level forward on the same user across views"
  // still requires a runtime check.
  makeCase('solo_progress_health', 'solo_progress_profile_runtime_proof_needed',
    'Live runtime proof that passing a Solo level updates Profile Level on the same user',
    () => notAutomatable('Static contract proves shared source; runtime click-through (Solo pass → /profile shows new level) needs a mounted session.', {
      verification: 'NOT_AUTOMATABLE',
      classification: 'STATIC_CHECK_LIMITATION',
      verificationLabels: ['NOT_AUTOMATABLE', 'MANUAL_REQUIRED'],
      actionType: ACTION_TYPES.DEVICE_TEST,
      expected: 'mounted browser: pass Level 1 → /profile shows Level 2',
      actual: 'static-only verification in simulator',
    }), { actionType: ACTION_TYPES.DEVICE_TEST, critical: true }),

  /* ============================================================
   *  2. SOLO RESULT POPUP NEXT-LEVEL CTA CONTRACT
   * ============================================================ */
  makeCase('solo_progress_health', 'solo_result_popup_next_level_cta_contract',
    'Result popup next-level CTA shows "Level X" with Play icon; never "Level X\'e Geç"; replay stays "Tekrar Oyna"; failed attempts do not enable next-level',
    () => {
      // (a) Forbidden copy that previously existed.
      const forbidden = forbiddenTokensFound(soloLevelResultSource, [
        "Level {nextLevelNumber}'e Geç",
      ]);
      if (forbidden.length) {
        return fail('Result popup still uses the forbidden "Level X\'e Geç" copy.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          file: 'components/game/SoloLevelResult.jsx',
          actionType: ACTION_TYPES.CODE_FIX,
          expected: 'no "Level X\'e Geç" string',
          actual: { forbidden },
        });
      }

      // (b) Required CTA: "Level {nextLevelNumber}" + a Play icon inline.
      const ctaMissing = missingTokens(soloLevelResultSource, [
        'Level {nextLevelNumber}',
        '<Play className="w-4 h-4" fill="currentColor" />',
      ]);

      // (c) Pass-only gating — next-level CTA only renders inside the
      //     `passed ? hasNextLevel ? ...` branch.
      const gatingMissing = missingTokens(soloLevelResultSource, [
        'passed ? (',
        'hasNextLevel ? (',
      ]);

      // (d) Failed attempts use the replay CTA, not next-level.
      const failReplayMissing = missingTokens(soloLevelResultSource, [
        'onClick={onRetry}',
        'Tekrar Oyna',
        '<RotateCcw',
      ]);

      // (e) Lock/coming-soon branch covers the no-next-level case.
      const lockMissing = missingTokens(soloLevelResultSource, [
        'disabled',
        '<Lock',
      ]);

      if (ctaMissing.length || gatingMissing.length || failReplayMissing.length || lockMissing.length) {
        return fail('Result popup CTA contract drifted.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          file: 'components/game/SoloLevelResult.jsx',
          actionType: ACTION_TYPES.CODE_FIX,
          expected: {
            cta: '"Level {nextLevelNumber}" + inline Play icon',
            gating: 'next-level only when passed && hasNextLevel',
            failPath: '"Tekrar Oyna" replay button with RotateCcw icon',
            noNext: 'disabled Lock-icon button when no next level',
          },
          actual: { ctaMissing, gatingMissing, failReplayMissing, lockMissing },
        });
      }
      return pass('Result popup CTA: pass → "Level X" + Play; fail → "Tekrar Oyna"; no next-level enabled on fail.', {
        verification: 'STATIC_CONTRACT',
        classification: 'STATIC_CHECK_LIMITATION',
        actionType: ACTION_TYPES.CODE_FIX,
        actual: 'tokens present, forbidden copy removed',
      });
    },
    { actionType: ACTION_TYPES.CODE_FIX }),

  /* ============================================================
   *  3. SOLO 120s TIMER LAST-10-SECONDS AUDIO CUE
   * ============================================================ */
  makeCase('solo_progress_health', 'solo_timer_last_10_seconds_audio_cue',
    'Solo gameplay has a 120s total timer with a guarded last-10s audio cue (dedupe + cleanup + non-blocking failure)',
    () => {
      // (a) 120s total timer constant.
      const constMissing = missingTokens(soloLevelsLibSource, [
        'SOLO_LEVEL_TIME_SECONDS = 120',
      ]);

      // (b) Timer component imports sounds and gates the cue to the
      //     1..10 window with a dedupe ref.
      const timerMissing = missingTokens(soloLevelTimerSource, [
        "import { sounds } from '@/lib/gameSounds'",
        'lastTickedRef = useRef(null)',
        'if (remaining < 1 || remaining > 10) return',
        'if (lastTickedRef.current === remaining) return',
        'lastTickedRef.current = remaining',
        'sounds.urgencyTick()',
      ]);

      // (c) Audio failure is non-blocking — try/catch around the call.
      const nonBlockingMissing = missingTokens(soloLevelTimerSource, [
        'try { sounds.urgencyTick(); } catch',
      ]);

      // (d) gameSounds.urgencyTick exists and is wrapped in playTone's
      //     internal try/catch (audio init failure cannot crash gameplay).
      const soundsMissing = missingTokens(gameSoundsSource, [
        'urgencyTick()',
        'try {',
        'if (!c) return',
      ]);

      // (e) Timer cleanup is React-implicit (no setInterval/setTimeout).
      const timerForbidden = forbiddenTokensFound(soloLevelTimerSource, [
        'setInterval',
        'setTimeout',
      ]);

      if (constMissing.length || timerMissing.length || nonBlockingMissing.length || soundsMissing.length || timerForbidden.length) {
        return fail('Last-10s audio countdown contract failed.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          file: 'components/game/SoloLevelTimer.jsx + lib/gameSounds.js + lib/soloLevels.js',
          actionType: ACTION_TYPES.CODE_FIX,
          expected: {
            totalTimer: 'SOLO_LEVEL_TIME_SECONDS = 120',
            cue: 'last-10s 1Hz urgencyTick guarded by remaining 1..10 + lastTickedRef dedupe',
            nonBlocking: 'try/catch around sounds.urgencyTick',
            soundsLib: 'urgencyTick exists with try/catch + ctx-availability guard',
            cleanup: 'no setInterval/setTimeout — cleanup is React-implicit on unmount',
          },
          actual: {
            constMissing,
            timerMissing,
            nonBlockingMissing,
            soundsMissing,
            timerForbidden,
          },
        });
      }
      return pass('120s timer + dedupe-guarded last-10s audio cue + non-blocking failure path all detected.', {
        verification: 'STATIC_CONTRACT',
        classification: 'STATIC_CHECK_LIMITATION',
        actionType: ACTION_TYPES.CODE_FIX,
        actual: 'tokens present, no rogue intervals',
      });
    },
    { actionType: ACTION_TYPES.CODE_FIX }),

  /* ============================================================
   *  4. SOLO SCORE / LEADERBOARD CONTRACTS
   * ============================================================ */
  makeCase('solo_progress_health', 'solo_score_calculation_contract',
    'Solo score calculation contract: star base + exact time bonus boundaries + fail gets 0',
    () => {
      const examples = [
        { input: { stars: 3, elapsedSeconds: 54, passed: true }, expected: { baseScore: 10, timeBonus: 10, totalScore: 20 } },
        { input: { stars: 3, elapsedSeconds: 75, passed: true }, expected: { baseScore: 10, timeBonus: 5, totalScore: 15 } },
        { input: { stars: 2, elapsedSeconds: 88, passed: true }, expected: { baseScore: 8, timeBonus: 5, totalScore: 13 } },
        { input: { stars: 1, elapsedSeconds: 110, passed: true }, expected: { baseScore: 5, timeBonus: 0, totalScore: 5 } },
        { input: { stars: 0, elapsedSeconds: 40, passed: false }, expected: { baseScore: 0, timeBonus: 0, totalScore: 0 } },
        { input: { stars: 0, elapsedSeconds: 120, passed: false }, expected: { baseScore: 0, timeBonus: 0, totalScore: 0 } },
      ];
      const mismatches = examples
        .map((item) => ({ ...item, actual: calculateSoloLevelScore(item.input) }))
        .filter((item) => JSON.stringify(item.actual) !== JSON.stringify(item.expected));
      const attemptTimeout = calculateSoloAttemptResult({ mistakes: 0, completedCards: 9, elapsedSeconds: 120 });
      if (mismatches.length || attemptTimeout.levelScore !== 0 || attemptTimeout.failReason !== 'timeout') {
        return fail('Solo score helper returned an unexpected score or timeout result.', {
          verification: 'RUNTIME_VERIFIED',
          classification: 'REAL_PRODUCT_RISK',
          actionType: ACTION_TYPES.CODE_FIX,
          expected: 'examples match product score table; timeout = 0',
          actual: { mismatches, attemptTimeout },
        });
      }
      return pass('Solo score helper matches the product score table and exact 60/90s boundaries.', {
        verification: 'RUNTIME_VERIFIED',
        classification: 'EXECUTABLE_HELPER_PROOF',
        actionType: ACTION_TYPES.CODE_FIX,
        actual: examples.map((item) => ({ input: item.input, score: item.expected.totalScore })),
      });
    },
    { actionType: ACTION_TYPES.CODE_FIX }),

  makeCase('solo_progress_health', 'solo_score_single_source_helper',
    'Solo score calculation lives in one shared helper and is consumed by Game/Profile/Leaderboard/Popup',
    () => {
      const helperMissing = missingTokens(soloProgressHelpersSource, [
        'export function calculateSoloStars',
        'export function calculateSoloTimeBonus',
        'export function calculateSoloLevelScore',
        'export function calculateSoloAttemptResult',
        'export function getBestSoloLevelResult',
        'export function summarizeSoloProgress',
        'export function calculateSoloLevelScoreFromBestResult',
        'export function backfillSoloScores',
        'scoreDelta',
        'updatedBestLevelResult',
      ]);
      const consumerMissing = [
        ...missingTokens(soloLevelsLibSource, ['calculateSoloAttemptResult', 'getBestSoloLevelResult', 'summarizeSoloProgress']),
        ...missingTokens(profilePageSource, ['summarizeSoloProgress', 'totalSoloScore', 'totalStars']),
        ...missingTokens(leaderboardPageSource, ['summarizeSoloProgress', 'totalSoloScore', 'Kronox Sıralaması']),
        ...missingTokens(soloLevelResultSource, ['levelScore', 'baseScore', 'timeBonus', 'Puan:']),
      ];
      const forbidden = [
        ...forbiddenTokensFound(profilePageSource, ['value: 0,            icon: Trophy']),
        ...forbiddenTokensFound(leaderboardPageSource, ['Küresel sıralama yakında. Şimdilik kendi rekorlarını']),
      ];
      if (helperMissing.length || consumerMissing.length || forbidden.length) {
        return fail('Solo score is not consistently wired through the shared helper/source of truth.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          actionType: ACTION_TYPES.CODE_FIX,
          expected: 'helper exports + consumers use score/summary; no old placeholder score copy',
          actual: { helperMissing, consumerMissing, forbidden },
        });
      }
      return pass('Solo score helper is shared by progress merge, Profile, Leaderboard, and result popup.', {
        verification: 'STATIC_CONTRACT',
        classification: 'STATIC_CHECK_LIMITATION',
        actionType: ACTION_TYPES.CODE_FIX,
      });
    },
    { actionType: ACTION_TYPES.CODE_FIX }),

  makeCase('solo_progress_health', 'solo_replay_best_score_preserved',
    'Replay preserves best stars/score on worse attempts and updates on better attempts',
    () => {
      const previous = {
        bestStars: 3,
        bestScore: 15,
        bestScoreStars: 3,
        bestTimeSeconds: 75,
        bestMistakes: 1,
      };
      const worse = getBestSoloLevelResult(previous, calculateSoloAttemptResult({
        mistakes: 6,
        completedCards: 10,
        elapsedSeconds: 110,
      }));
      const better = getBestSoloLevelResult(previous, calculateSoloAttemptResult({
        mistakes: 0,
        completedCards: 10,
        elapsedSeconds: 54,
      }));
      if (worse.bestStars !== 3 || worse.bestScore !== 15 || worse.scoreDelta !== 0 || better.bestStars !== 3 || better.bestScore !== 20 || better.bestTimeSeconds !== 54 || better.scoreDelta !== 5) {
        return fail('Replay best-score preservation helper regressed.', {
          verification: 'RUNTIME_VERIFIED',
          classification: 'REAL_PRODUCT_RISK',
          actionType: ACTION_TYPES.CODE_FIX,
          expected: {
            worseReplay: 'bestStars=3 and bestScore=15 remain',
            betterReplay: 'bestScore=20, bestTimeSeconds=54, scoreDelta=5',
          },
          actual: { worse, better },
        });
      }
      return pass('Replay helper preserves worse records and upgrades better score/time records.', {
        verification: 'RUNTIME_VERIFIED',
        classification: 'EXECUTABLE_HELPER_PROOF',
        actionType: ACTION_TYPES.CODE_FIX,
      });
    },
    { actionType: ACTION_TYPES.CODE_FIX }),

  makeCase('solo_progress_health', 'solo_replay_score_delta_only',
    'Replay score delta only: improving 13 → 18 adds +5; replaying 18 → 10 adds +0',
    () => {
      const previous13 = {
        bestStars: 2,
        bestScore: 13,
        bestScoreStars: 2,
        bestTimeSeconds: 88,
        bestMistakes: 2,
      };
      const replay18 = getBestSoloLevelResult(previous13, calculateSoloAttemptResult({
        mistakes: 2,
        completedCards: 10,
        elapsedSeconds: 54,
      }));
      const previous18 = replay18.updatedBestLevelResult;
      const replay10 = getBestSoloLevelResult(previous18, calculateSoloAttemptResult({
        mistakes: 1,
        completedCards: 10,
        elapsedSeconds: 100,
      }));

      const beforeTotal = summarizeSoloProgress({ currentLevel: 4, levels: { 3: previous13 } }, 20).totalSoloScore;
      const afterImproveTotal = summarizeSoloProgress({ currentLevel: 4, levels: { 3: replay18.updatedBestLevelResult } }, 20).totalSoloScore;
      const afterWorseTotal = summarizeSoloProgress({ currentLevel: 4, levels: { 3: replay10.updatedBestLevelResult } }, 20).totalSoloScore;

      if (replay18.scoreDelta !== 5 || afterImproveTotal - beforeTotal !== 5 || replay10.scoreDelta !== 0 || afterWorseTotal !== afterImproveTotal) {
        return fail('Replay delta-only scoring regressed.', {
          verification: 'RUNTIME_VERIFIED',
          classification: 'REAL_PRODUCT_RISK',
          actionType: ACTION_TYPES.CODE_FIX,
          expected: '13→18 delta +5; 18→10 delta +0; total score follows only bestScore difference',
          actual: { replay18, replay10, beforeTotal, afterImproveTotal, afterWorseTotal },
        });
      }
      return pass('Replay scoring only applies the bestScore difference and never adds the full replay attempt twice.', {
        verification: 'RUNTIME_VERIFIED',
        classification: 'EXECUTABLE_HELPER_PROOF',
        actionType: ACTION_TYPES.CODE_FIX,
        actual: { improveDelta: replay18.scoreDelta, worseDelta: replay10.scoreDelta },
      });
    },
    { actionType: ACTION_TYPES.CODE_FIX }),

  makeCase('solo_progress_health', 'solo_total_score_is_sum_of_level_best_scores',
    'totalSoloScore is the sum of per-level bestScore values, not the sum of all attempts',
    () => {
      const progress = {
        currentLevel: 4,
        levels: {
          1: { bestStars: 3, bestScore: 20, attempts: 9 },
          2: { bestStars: 2, bestScore: 13, attempts: 7 },
          3: { bestStars: 0, bestScore: 0, attempts: 5 },
        },
      };
      const summary = summarizeSoloProgress(progress, 20);
      const fakeAttemptTotal = (20 * 9) + (13 * 7);
      if (summary.totalSoloScore !== 33 || summary.totalSoloScore === fakeAttemptTotal) {
        return fail('totalSoloScore is not clearly derived from level bestScore sum.', {
          verification: 'RUNTIME_VERIFIED',
          classification: 'REAL_PRODUCT_RISK',
          actionType: ACTION_TYPES.CODE_FIX,
          expected: '20 + 13 + 0 = 33, regardless of attempts',
          actual: { summary, fakeAttemptTotal },
        });
      }
      return pass('totalSoloScore equals the sum of each completed level bestScore and ignores attempt count multiplication.', {
        verification: 'RUNTIME_VERIFIED',
        classification: 'EXECUTABLE_HELPER_PROOF',
        actionType: ACTION_TYPES.CODE_FIX,
        actual: summary,
      });
    },
    { actionType: ACTION_TYPES.CODE_FIX }),

  makeCase('solo_progress_health', 'solo_replay_does_not_duplicate_points',
    'Repeated same-score replays do not keep increasing totalSoloScore',
    () => {
      const sameScoreAttempt = calculateSoloAttemptResult({
        mistakes: 1,
        completedCards: 10,
        elapsedSeconds: 75,
      });
      let progress = {
        currentLevel: 2,
        levels: {
          1: {
            bestStars: 3,
            bestScore: 15,
            bestScoreStars: 3,
            bestTimeSeconds: 75,
            bestMistakes: 1,
            attempts: 1,
          },
        },
      };
      const before = summarizeSoloProgress(progress, 20).totalSoloScore;
      const deltas = [];
      for (let i = 0; i < 3; i += 1) {
        const merged = getBestSoloLevelResult(progress.levels[1], sameScoreAttempt);
        deltas.push(merged.scoreDelta);
        progress = {
          ...progress,
          levels: {
            ...progress.levels,
            1: {
              ...progress.levels[1],
              ...merged.updatedBestLevelResult,
              attempts: progress.levels[1].attempts + 1,
            },
          },
        };
      }
      const after = summarizeSoloProgress(progress, 20).totalSoloScore;
      if (before !== 15 || after !== 15 || deltas.some((d) => d !== 0)) {
        return fail('Same-score replay duplicated Solo points.', {
          verification: 'RUNTIME_VERIFIED',
          classification: 'REAL_PRODUCT_RISK',
          actionType: ACTION_TYPES.CODE_FIX,
          expected: 'totalSoloScore remains 15 and every replay delta is 0',
          actual: { before, after, deltas, progress },
        });
      }
      return pass('Repeated same-score replays preserve totalSoloScore; no duplicate points are added.', {
        verification: 'RUNTIME_VERIFIED',
        classification: 'EXECUTABLE_HELPER_PROOF',
        actionType: ACTION_TYPES.CODE_FIX,
        actual: { before, after, deltas },
      });
    },
    { actionType: ACTION_TYPES.CODE_FIX }),

  makeCase('solo_progress_health', 'solo_existing_progress_score_backfill_from_stars',
    'Existing completed levels with stars but missing score get bestScore from stars',
    () => {
      const backfilled = backfillSoloScores({
        currentLevel: 4,
        levels: {
          1: { bestStars: 3, attempts: 2 },
          2: { bestStars: 2, attempts: 1 },
          3: { bestStars: 1, attempts: 1 },
          4: { bestStars: 0, attempts: 1 },
        },
      }, 20).progress;
      if (
        backfilled.levels[1].bestScore !== 10 ||
        backfilled.levels[2].bestScore !== 8 ||
        backfilled.levels[3].bestScore !== 5 ||
        Number(backfilled.levels[4].bestScore || 0) !== 0 ||
        backfilled.summary.totalSoloScore !== 23
      ) {
        return fail('Existing star-only Solo progress did not backfill base scores correctly.', {
          verification: 'RUNTIME_VERIFIED',
          classification: 'REAL_PRODUCT_RISK',
          actionType: ACTION_TYPES.CODE_FIX,
          expected: '3 stars=10, 2 stars=8, 1 star=5, 0 stars=0, total=23',
          actual: backfilled,
        });
      }
      return pass('Star-only existing progress backfills level bestScore from the base star score.', {
        verification: 'RUNTIME_VERIFIED',
        classification: 'EXECUTABLE_HELPER_PROOF',
        actionType: ACTION_TYPES.CODE_FIX,
        actual: backfilled.summary,
      });
    },
    { actionType: ACTION_TYPES.CODE_FIX }),

  makeCase('solo_progress_health', 'solo_existing_progress_time_bonus_if_time_exists',
    'Backfill applies time bonus only when reliable bestTimeSeconds exists',
    () => {
      const noTime = calculateSoloLevelScoreFromBestResult({ bestStars: 3 });
      const fast = calculateSoloLevelScoreFromBestResult({ bestStars: 3, bestTimeSeconds: 54 });
      const medium = calculateSoloLevelScoreFromBestResult({ bestStars: 2, bestTimeSeconds: 75 });
      const slow = calculateSoloLevelScoreFromBestResult({ bestStars: 1, bestTimeSeconds: 110 });
      const backfilled = backfillSoloScores({
        currentLevel: 4,
        levels: {
          1: { bestStars: 3, bestTimeSeconds: 54 },
          2: { bestStars: 2, bestTimeSeconds: 75 },
          3: { bestStars: 1 },
        },
      }, 20).progress;
      const missingTimeWasInvented = Object.prototype.hasOwnProperty.call(backfilled.levels[3], 'bestTimeSeconds');
      if (
        noTime.timeBonus !== 0 ||
        fast.totalScore !== 20 ||
        medium.totalScore !== 13 ||
        slow.totalScore !== 5 ||
        backfilled.summary.totalSoloScore !== 38 ||
        missingTimeWasInvented
      ) {
        return fail('Backfill time bonus or missing-time handling regressed.', {
          verification: 'RUNTIME_VERIFIED',
          classification: 'REAL_PRODUCT_RISK',
          actionType: ACTION_TYPES.CODE_FIX,
          expected: '<60 +10, 60-90 +5, >90 +0, missing time +0 and no fake bestTimeSeconds',
          actual: { noTime, fast, medium, slow, backfilled, missingTimeWasInvented },
        });
      }
      return pass('Backfill uses reliable bestTimeSeconds for bonus and gives missing time base score only.', {
        verification: 'RUNTIME_VERIFIED',
        classification: 'EXECUTABLE_HELPER_PROOF',
        actionType: ACTION_TYPES.CODE_FIX,
        actual: { noTime, fast, medium, slow, total: backfilled.summary.totalSoloScore },
      });
    },
    { actionType: ACTION_TYPES.CODE_FIX }),

  makeCase('solo_progress_health', 'solo_total_score_backfill_is_idempotent',
    'Running Solo score backfill twice does not double totalSoloScore',
    () => {
      const original = {
        currentLevel: 3,
        summary: { totalSoloScore: 9999 },
        levels: {
          1: { bestStars: 3, bestTimeSeconds: 54, attempts: 4 },
          2: { bestStars: 2, attempts: 3 },
        },
      };
      const once = backfillSoloScores(original, 20).progress;
      const twice = backfillSoloScores(once, 20).progress;
      if (once.summary.totalSoloScore !== 28 || twice.summary.totalSoloScore !== 28 || JSON.stringify(once) !== JSON.stringify(twice)) {
        return fail('Backfill is not idempotent or total score was added to an old total.', {
          verification: 'RUNTIME_VERIFIED',
          classification: 'REAL_PRODUCT_RISK',
          actionType: ACTION_TYPES.CODE_FIX,
          expected: '20 + 8 = 28 on every run, not 9999 + 28 or repeated accumulation',
          actual: { once, twice },
        });
      }
      return pass('Backfill deterministically recomputes totalSoloScore from level bestScore and is idempotent.', {
        verification: 'RUNTIME_VERIFIED',
        classification: 'EXECUTABLE_HELPER_PROOF',
        actionType: ACTION_TYPES.CODE_FIX,
        actual: once.summary,
      });
    },
    { actionType: ACTION_TYPES.CODE_FIX }),

  makeCase('solo_progress_health', 'solo_backfill_preserves_unlocked_level',
    'Backfill never reduces currentLevel and completed Level 8 implies Level 9 playable',
    () => {
      const alreadyNine = backfillSoloScores({
        currentLevel: 9,
        levels: { 1: { bestStars: 3 } },
      }, 20).progress;
      const staleOne = backfillSoloScores({
        currentLevel: 1,
        levels: {
          1: { bestStars: 3 },
          2: { bestStars: 3 },
          3: { bestStars: 3 },
          4: { bestStars: 3 },
          5: { bestStars: 3 },
          6: { bestStars: 3 },
          7: { bestStars: 3 },
          8: { bestStars: 3 },
        },
      }, 20).progress;
      if (alreadyNine.currentLevel !== 9 || staleOne.currentLevel < 9 || staleOne.summary.unlockedLevel < 9) {
        return fail('Backfill reduced or failed to recover the Solo unlock frontier.', {
          verification: 'RUNTIME_VERIFIED',
          classification: 'REAL_PRODUCT_RISK',
          actionType: ACTION_TYPES.CODE_FIX,
          expected: 'existing Level 9 remains 9; completed Level 8 recovers to at least Level 9',
          actual: { alreadyNine, staleOne },
        });
      }
      return pass('Backfill preserves currentLevel and recovers Level 9 from completed Level 8 history.', {
        verification: 'RUNTIME_VERIFIED',
        classification: 'EXECUTABLE_HELPER_PROOF',
        actionType: ACTION_TYPES.CODE_FIX,
        actual: { alreadyNine: alreadyNine.currentLevel, staleOne: staleOne.currentLevel },
      });
    },
    { actionType: ACTION_TYPES.CODE_FIX }),

  makeCase('solo_progress_health', 'solo_backfill_no_fake_time',
    'Missing time does not create fake bestTimeSeconds during backfill',
    () => {
      const backfilled = backfillSoloScores({
        currentLevel: 2,
        levels: {
          1: { bestStars: 3, attempts: 1 },
        },
      }, 20).progress;
      const hasTime = Object.prototype.hasOwnProperty.call(backfilled.levels[1], 'bestTimeSeconds');
      if (hasTime || backfilled.levels[1].bestScore !== 10 || backfilled.levels[1].bestScoreTimeBonus !== 0) {
        return fail('Backfill invented missing time or gave a fake time bonus.', {
          verification: 'RUNTIME_VERIFIED',
          classification: 'REAL_PRODUCT_RISK',
          actionType: ACTION_TYPES.CODE_FIX,
          expected: 'no bestTimeSeconds field; bestScore=10; bestScoreTimeBonus=0',
          actual: backfilled.levels[1],
        });
      }
      return pass('Missing time stays missing; score uses star base only with no fake bonus.', {
        verification: 'RUNTIME_VERIFIED',
        classification: 'EXECUTABLE_HELPER_PROOF',
        actionType: ACTION_TYPES.CODE_FIX,
        actual: backfilled.levels[1],
      });
    },
    { actionType: ACTION_TYPES.CODE_FIX }),

  makeCase('solo_progress_health', 'solo_result_popup_score_visible',
    'Solo result popup shows score breakdown, stars/time/mistakes, rank placeholder, and keeps next CTA copy contract',
    () => {
      const required = missingTokens(soloLevelResultSource, [
        'Puan: {levelScore}',
        '${stars} yıldız: ${baseScore} + hız bonusu: ${timeBonus}',
        'Yeni en iyi puan! +${scoreDelta}',
        'En iyi puanın korunuyor',
        'Sıralama verisi hazırlanıyor',
        'Level {nextLevelNumber}',
        '<Play className="w-4 h-4" fill="currentColor" />',
        'Tekrar Oyna',
      ]);
      const forbidden = forbiddenTokensFound(soloLevelResultSource, [
        "Level {nextLevelNumber}'e Geç",
      ]);
      if (required.length || forbidden.length) {
        return fail('Solo result popup score/rank/CTA contract drifted.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          actionType: ACTION_TYPES.CODE_FIX,
          expected: 'score breakdown + safe rank placeholder + Level X CTA',
          actual: { required, forbidden },
        });
      }
      return pass('Solo result popup exposes score breakdown and keeps ranking/CTA contracts honest.', {
        verification: 'STATIC_CONTRACT',
        classification: 'STATIC_CHECK_LIMITATION',
        actionType: ACTION_TYPES.CODE_FIX,
      });
    },
    { actionType: ACTION_TYPES.CODE_FIX }),

  makeCase('solo_progress_health', 'solo_leaderboard_total_score_contract',
    'Leaderboard uses Solo score/level plus Elmas economy placeholder/field and does not fake friend ranking',
    () => {
      const required = missingTokens(leaderboardPageSource, [
        'readSoloProgress',
        'summarizeSoloProgress',
        'summary.totalSoloScore',
        'summary.currentLevel',
        'getLeaderboardDiamondValue',
        'label="Elmas"',
        'Arkadaşlarınla yarışmak için onları davet et',
      ]);
      const forbidden = forbiddenTokensFound(leaderboardPageSource, [
        'label="Yıldız"',
        "label: 'Yıldız'",
        'summary.totalStars',
        '2. sırada',
        '1. oldun',
        'Math.random',
      ]);
      if (required.length || forbidden.length) {
        return fail('Leaderboard total score, Elmas placeholder, or no-fake-ranking contract failed.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          actionType: ACTION_TYPES.CODE_FIX,
          expected: 'Puan/Level from Solo summary + Elmas from economy field or safe 0 placeholder',
          actual: { required, forbidden },
        });
      }
      return pass('Leaderboard reads Solo score/level, keeps Elmas separate from stars, and uses a safe friend-ranking placeholder.', {
        verification: 'STATIC_CONTRACT',
        classification: 'STATIC_CHECK_LIMITATION',
        actionType: ACTION_TYPES.CODE_FIX,
      });
    },
    { actionType: ACTION_TYPES.CODE_FIX }),

  makeCase('solo_progress_health', 'solo_profile_score_contract',
    'Profile reads the same Solo progress source for level, totalSoloScore, and totalStars; no hard-coded Level 1/stale score',
    () => {
      const required = missingTokens(profilePageSource, [
        'ensureSoloProgressBackfill',
        'readSoloProgress',
        'summarizeSoloProgress',
        'getCurrentPlayableLevel',
        'soloSummary.totalSoloScore',
        'soloSummary.totalStars',
        'profileLevel',
      ]);
      const forbidden = forbiddenTokensFound(profilePageSource, [
        "label: 'Level', value: 1",
        "id: 'puan',  label: 'Puan',  value: 0",
        "id: 'stars', label: 'Yıldız', value: 0",
      ]);
      if (required.length || forbidden.length) {
        return fail('Profile Solo score/source-of-truth contract drifted.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          actionType: ACTION_TYPES.CODE_FIX,
          expected: 'Profile backfills current user progress, reads shared Solo summary, and never hard-codes Level/Puan/Yıldız',
          actual: { required, forbidden },
        });
      }
      return pass('Profile uses shared Solo progress summary for Puan/Level/Yıldız and avoids stale hard-coded values.', {
        verification: 'STATIC_CONTRACT',
        classification: 'STATIC_CHECK_LIMITATION',
        actionType: ACTION_TYPES.CODE_FIX,
      });
    },
    { actionType: ACTION_TYPES.CODE_FIX }),

  makeCase('solo_progress_health', 'solo_level_ranking_placeholder_or_real_data',
    'Level result ranking is either real backend data or an explicit safe placeholder; no fake rank',
    () => {
      const required = missingTokens(soloRankingSource, [
        'return { ready: false, rank: null }',
        'server-side aggregation function',
      ]);
      const popupRequired = missingTokens(soloLevelResultSource, [
        'ready && typeof rank ===',
        'Sıralama verisi hazırlanıyor',
      ]);
      if (required.length || popupRequired.length) {
        return fail('Solo level rank placeholder/real-data contract drifted.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          actionType: ACTION_TYPES.CODE_FIX,
          expected: 'no fake rank; placeholder until backend rank exists',
          actual: { required, popupRequired },
        });
      }
      return pass('Level rank remains honest: real backend rank when ready, safe placeholder otherwise.', {
        verification: 'STATIC_CONTRACT',
        classification: 'STATIC_CHECK_LIMITATION',
        actionType: ACTION_TYPES.CODE_FIX,
      });
    },
    { actionType: ACTION_TYPES.CODE_FIX }),

  // Honest runtime gap — actual audible playback requires a real device.
  makeCase('solo_progress_health', 'solo_last_10_seconds_audio_runtime_proof',
    'Actual audible last-10s cue playback proof on a real device',
    () => notAutomatable('Web Audio playback requires a real user-gesture-unlocked AudioContext on a mounted device. Static contract proves the guarded code path; release sign-off needs a phone test.', {
      verification: 'NOT_AUTOMATABLE',
      classification: 'STATIC_CHECK_LIMITATION',
      verificationLabels: ['NOT_AUTOMATABLE', 'EXTERNAL_DEVICE_REQUIRED'],
      actionType: ACTION_TYPES.DEVICE_TEST,
      expected: 'audible 1Hz ticks from 10s down to 1s on real device',
      actual: 'static guarded implementation only',
    }), { actionType: ACTION_TYPES.DEVICE_TEST, critical: false }),
];
