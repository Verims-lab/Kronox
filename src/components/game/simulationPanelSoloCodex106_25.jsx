// Codex106-25 — Solo Level Path / Profile / Gameplay timer health cases.
//
// PURPOSE
//   Three focused Health Simulator cases for the Codex106-25 scope:
//     1. solo_progress_profile_source_of_truth — Profile Level + Solo Level
//        Path must read from the SAME user-specific source. Previously
//        Profile hard-coded `value: 1`, drifting from solo_progress.
//     2. solo_result_popup_next_level_cta_contract — Pass popup CTA shows
//        "Level X" with a Play icon (NOT "Level X'e Geç"); replay stays
//        "Tekrar Oyna"; fail attempts do not enable a next-level action.
//     3. solo_timer_last_10_seconds_audio_cue — 120s total timer with a
//        guarded last-10-second audio cue (dedupe + cleanup +
//        non-blocking failure).
//
// DESIGN
//   - STATIC_CONTRACT only — these are presence/absence/regex checks of
//     known source tokens. Runtime audio playback and on-device popup
//     rendering remain NOT_AUTOMATABLE; we add those as honest gaps.
//   - No scoring constant or status is weakened.
//   - Lives in its own file because components/game/simulationPanelExtraCases.js
//     hit the 2000-line edit cap. Spread into EXTRA_TESTS as the last block.

import profilePageSource from '../../pages/ProfilePage.jsx?raw';
import soloChallengeSource from '../../pages/SoloChallenge.jsx?raw';
import soloLevelsLibSource from '../../lib/soloLevels.js?raw';
import soloLevelResultSource from './SoloLevelResult.jsx?raw';
import soloLevelTimerSource from './SoloLevelTimer.jsx?raw';
import gameSoundsSource from '../../lib/gameSounds.js?raw';

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

// Codex106-25 — Suite descriptor for the new Solo cases. Surfaced to
// SimulationPanel via a separate export so we don't have to mutate the
// already-line-capped simulationPanelExtraCases.js file.
export const SOLO_CODEX106_25_EXTRA_SUITES = [
  {
    id: 'solo_progress_health',
    name: SUITE_NAMES.solo_progress_health,
    critical: true,
    color: '#fbbf24',
  },
];

export const SOLO_CODEX106_25_EXTRA_TESTS = [
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
        'safeWriteLocal(progress)',
        'base44.auth.updateMe({ solo_progress: progress })',
      ]);

      // e) currentLevel monotonic guard — applyLevelAttempt only bumps when
      //    the attempt PASSED and the new unlock is greater than current.
      const monotonicMissing = missingTokens(soloLevelsLibSource, [
        'if (fresh.passed)',
        'nextUnlock > next.currentLevel',
      ]);

      // f) bestStars cannot regress — mergeBetterResult guard.
      const mergeMissing = missingTokens(soloLevelsLibSource, [
        'if (freshStars < prevStars)',
        'never decrease',
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

      // (e) Timer is only rendered while gameplay runs — once `winner`
      //     is set, GameLayout stops rendering SoloLevelTimer. We assert
      //     the gate exists in GameLayout via the result popup taking
      //     over (Game.jsx switches to SoloLevelResult before unmount).
      //     The timer effect cleanup is React-implicit (no setInterval).
      //     We assert there is NO setInterval/setTimeout in the timer.
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