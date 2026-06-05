// Kronox Health Center — Solo Jokers v1 contracts.
//
// Scope: static contract coverage for the first free, attempt-local Solo
// joker system. Runtime feel and real drag/timer proof stay manual.

import gameSource from '../../pages/Game.jsx?raw';
import gameLayoutSource from './GameLayout.jsx?raw';
import soloJokerBarSource from './SoloJokerBar.jsx?raw';
import soloTimerSource from './SoloLevelTimer.jsx?raw';
import { SOLO_QUESTION_ENGINE_DOC } from '@/lib/soloQuestionEngineDoc';

const STATUS = { PASS: 'PASS', FAIL: 'FAIL', NOT_AUTOMATABLE: 'NOT_AUTOMATABLE' };
const ACTION_TYPES = { CODE_FIX: 'CODE_FIX', HUMAN_RUNTIME_PROOF: 'HUMAN_RUNTIME_PROOF' };
const SUITE_ID = 'solo_jokers_health';
const SUITE_NAME = 'Solo Jokers Health Suite';

function safeStr(src) {
  if (src == null) return '';
  if (typeof src === 'string') return src;
  try { return String(src); } catch { return ''; }
}

function missingTokens(source, tokens) {
  const src = safeStr(source);
  return tokens.filter((token) => !src.includes(token));
}

function getHandleUseSoloJokerSource() {
  const src = safeStr(gameSource);
  const start = src.indexOf('const handleUseSoloJoker');
  const end = src.indexOf('const handleRestart', start);
  if (start < 0 || end < 0) return '';
  return src.slice(start, end);
}

function pass(reason, extra = {}) { return { status: STATUS.PASS, reason, ...extra }; }
function fail(reason, extra = {}) { return { status: STATUS.FAIL, reason, ...extra }; }
function notAutomatable(reason, extra = {}) { return { status: STATUS.NOT_AUTOMATABLE, reason, ...extra }; }

function makeCase(id, name, run, options = {}) {
  return {
    key: `${SUITE_ID}.${id}`,
    suiteId: SUITE_ID,
    suiteName: SUITE_NAME,
    id,
    name,
    critical: options.critical ?? true,
    actionType: options.actionType || ACTION_TYPES.CODE_FIX,
    nextStep: options.nextStep || 'Keep Solo Jokers attempt-local, free, and visual/gameplay-safe.',
    ...options,
    run,
  };
}

export const EXTRA_SUITES = [
  { id: SUITE_ID, name: SUITE_NAME, critical: true, color: '#facc15' },
];

export const EXTRA_TESTS = [
  makeCase('solo_jokers_render_three_options',
    'Solo gameplay renders the three v1 joker options',
    () => {
      const missing = missingTokens(soloJokerBarSource, [
        'Kronokalkan',
        'Kart Değiştir',
        'Zaman Dondur',
        'Jokerler • 1 hak',
        'Shield',
        'RefreshCw',
        'Snowflake',
      ]);
      if (missing.length) return fail('SoloJokerBar lost one or more required joker options.', {
        verification: 'STATIC_CONTRACT',
        file: 'components/game/SoloJokerBar.jsx',
        missing,
      });
      return pass('SoloJokerBar renders Kronokalkan, Kart Değiştir, and Zaman Dondur.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('solo_jokers_one_use_per_attempt',
    'Only one joker can be used per Solo attempt',
    () => {
      const missing = missingTokens(gameSource, [
        'usedJokerType',
        'jokerUsedRef.current',
        'resetSoloJokers',
        'if (!isSoloLevelMode || jokerUsedRef.current || usedJokerType',
      ]);
      if (missing.length) return fail('Game.jsx no longer guards Solo jokers as one-use attempt-local state.', {
        verification: 'STATIC_CONTRACT',
        file: 'pages/Game.jsx',
        missing,
      });
      return pass('Game.jsx guards joker actions with usedJokerType/jokerUsedRef and resets on new attempts.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('solo_jokers_disable_others_after_use',
    'Unused joker buttons remain visible but disabled after one joker is used',
    () => {
      const missing = missingTokens(soloJokerBarSource, [
        'jokerConsumed',
        'jokerConsumed && !isUsed',
        'disabled={isDisabled || isUsed}',
        'aria-pressed={isUsed}',
      ]);
      if (missing.length) return fail('SoloJokerBar no longer keeps used/disabled joker state visible.', {
        verification: 'STATIC_CONTRACT',
        file: 'components/game/SoloJokerBar.jsx',
        missing,
      });
      return pass('SoloJokerBar leaves all three jokers visible and disables the unused ones after a use.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('kronokalkan_next_wrong_not_counted',
    'Kronokalkan absorbs the next wrong placement without incrementing mistakes',
    () => {
      const missing = missingTokens(gameSource, [
        "jokerType === 'mistakeShield'",
        'setMistakeShieldActive(true)',
        "feedback.result === 'wrong'",
        'if (mistakeShieldActive)',
        'Kronokalkan hatayı engelledi!',
        'setMistakeCount((prev) => prev + 1)',
      ]);
      if (missing.length) return fail('Kronokalkan no longer wraps wrong-feedback mistake counting.', {
        verification: 'STATIC_CONTRACT',
        file: 'pages/Game.jsx',
        missing,
      });
      return pass('Wrong feedback consumes Kronokalkan before mistake count increments.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('kronokalkan_correct_does_not_consume',
    'Correct placements do not consume Kronokalkan',
    () => {
      const wrongIndex = safeStr(gameSource).indexOf("feedback.result === 'wrong'");
      const correctIndex = safeStr(gameSource).indexOf("feedback.result === 'correct'");
      const shieldIndex = safeStr(gameSource).indexOf('if (mistakeShieldActive)', wrongIndex);
      const shieldInWrongBranch = wrongIndex >= 0 && shieldIndex > wrongIndex && shieldIndex < correctIndex;
      if (!shieldInWrongBranch) return fail('Kronokalkan consumption is no longer scoped to the wrong-feedback branch.', {
        verification: 'STATIC_CONTRACT',
        file: 'pages/Game.jsx',
        actual: { wrongIndex, correctIndex, shieldIndex },
      });
      return pass('Kronokalkan is consumed only inside the wrong-feedback branch; correct feedback only updates streak.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('kart_degistir_replaces_current_card',
    'Kart Değiştir replaces the current active card from the Solo attempt deck',
    () => {
      const handleSource = getHandleUseSoloJokerSource();
      const missing = missingTokens(handleSource, [
        "jokerType === 'swapCard'",
        'getOrderedSoloDeckQuestion',
        'replacement.id',
        'current_question_id: replacement.id',
        'setLobbyData((prev)',
      ]);
      if (missing.length) return fail('Kart Değiştir no longer replaces the current question from soloAttemptDeck.', {
        verification: 'STATIC_CONTRACT',
        file: 'pages/Game.jsx',
        missing,
      });
      return pass('Kart Değiştir selects a replacement from the prebuilt soloAttemptDeck and updates current_question_id.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('kart_degistir_does_not_fetch_mid_attempt',
    'Kart Değiştir does not fetch or rerandomize mid-attempt',
    () => {
      const handleSource = getHandleUseSoloJokerSource();
      const forbidden = ['base44', 'buildSoloAttemptDeck', 'fetch(', 'functions.invoke'].filter((token) => handleSource.includes(token));
      if (!handleSource || forbidden.length) return fail('Kart Değiştir handler contains a backend fetch/rebuild token.', {
        verification: 'STATIC_CONTRACT',
        file: 'pages/Game.jsx',
        forbidden,
      });
      return pass('Kart Değiştir handler mutates local attempt state only; no backend fetch or deck rebuild token exists.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('kart_degistir_preserves_deck_rules',
    'Kart Değiştir preserves unique-year/timeline safety while using the prebuilt deck',
    () => {
      const handleSource = getHandleUseSoloJokerSource();
      const missing = missingTokens(handleSource, [
        'getTimelineYears(currentPlayer.cards || [])',
        'usedIds.delete(currentQuestion.id)',
        'soloSkippedQuestionIdsRef.current',
        'skippedIds.add(currentQuestion.id)',
        'excludeQuestionIds: [currentQuestion.id]',
        'allowSkippedFallback: false',
        'requireVisibleYearSpacing: true',
      ]);
      if (missing.length) return fail('Kart Değiştir lost the static guards that keep replacement cards safe.', {
        verification: 'STATIC_CONTRACT',
        file: 'pages/Game.jsx',
        missing,
      });
      return pass('Kart Değiştir excludes the current card, already-used cards, skipped cards, and timeline years through the ordered deck helper.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('zaman_dondur_freezes_timer_10_seconds',
    'Zaman Dondur freezes the Solo timer for 10 seconds',
    () => {
      const missing = missingTokens(gameSource, [
        "jokerType === 'freezeTime'",
        'start + 10000',
        'setTimerFreezeUntil',
        'setFrozenElapsedOffset',
        'soloEffectiveElapsedSeconds',
      ]);
      const timerMissing = missingTokens(soloTimerSource, ['frozen = false', 'Donduruldu']);
      if (missing.length || timerMissing.length) return fail('Zaman Dondur lost its 10-second effective-timer freeze contract.', {
        verification: 'STATIC_CONTRACT',
        files: ['pages/Game.jsx', 'components/game/SoloLevelTimer.jsx'],
        actual: { missing, timerMissing },
      });
      return pass('Zaman Dondur subtracts a frozen offset from Solo elapsed time and marks the timer as frozen.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('zaman_dondur_cleans_up_on_level_end',
    'Zaman Dondur timers are cleaned up on reset/unmount',
    () => {
      const missing = missingTokens(gameSource, [
        'clearSoloTimerFreeze',
        'window.clearTimeout(timerFreezeTimeoutRef.current)',
        'window.clearInterval(timerFreezeIntervalRef.current)',
        'resetSoloJokers();',
        'clearSoloTimerFreeze(false, false)',
      ]);
      if (missing.length) return fail('Zaman Dondur cleanup/reset contract drifted.', {
        verification: 'STATIC_CONTRACT',
        file: 'pages/Game.jsx',
        missing,
      });
      return pass('Timer-freeze timeout/interval are cleared on reset and unmount.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('solo_jokers_do_not_affect_online',
    'Solo jokers are not rendered or wired in Online mode',
    () => {
      const layoutMissing = missingTokens(gameLayoutSource, [
        'SoloJokerBar',
        '!isOnline',
        'soloJokers?.enabled',
      ]);
      const gameMissing = missingTokens(gameSource, [
        'soloJokers={isSoloLevelMode ?',
        'if (!isSoloLevelMode || jokerUsedRef.current',
      ]);
      if (layoutMissing.length || gameMissing.length) return fail('Solo joker rendering/action gates no longer prove Solo-only behavior.', {
        verification: 'STATIC_CONTRACT',
        files: ['pages/Game.jsx', 'components/game/GameLayout.jsx'],
        actual: { layoutMissing, gameMissing },
      });
      return pass('Solo joker UI/action wiring is gated by isSoloLevelMode and hidden when isOnline is true.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('solo_jokers_do_not_grant_kronox_puan',
    'Solo jokers do not directly grant Kronox Puan',
    () => {
      const handleSource = getHandleUseSoloJokerSource();
      const forbidden = ['Kronox Puan', 'levelScore', 'scoreDelta', 'writeSoloProgress', 'kronox_puan_total'].filter((token) => handleSource.includes(token));
      if (!handleSource || forbidden.length) return fail('Solo joker action handler contains score/progress write tokens.', {
        verification: 'STATIC_CONTRACT',
        file: 'pages/Game.jsx',
        forbidden,
      });
      return pass('Solo joker actions do not write score/progress or mention Kronox Puan.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('solo_jokers_are_free_no_inventory_v1',
    'Solo jokers are free v1 helpers with no inventory, shop, ads, or Diamond spend',
    () => {
      const docMissing = missingTokens(SOLO_QUESTION_ENGINE_DOC, [
        'Solo Jokers v1',
        'free',
        'Only 1 joker',
        'do not use Diamonds',
        'do not grant Kronox Puan',
      ]);
      const uiForbidden = ['diamonds', 'shop', 'inventory', 'purchase', 'reklam', 'adreward'].filter((token) => safeStr(soloJokerBarSource).toLowerCase().includes(token));
      if (docMissing.length || uiForbidden.length) return fail('Solo Jokers v1 free/no-inventory contract is missing or UI gained economy tokens.', {
        verification: 'STATIC_CONTRACT',
        files: ['lib/soloQuestionEngineDoc.js', 'components/game/SoloJokerBar.jsx'],
        actual: { docMissing, uiForbidden },
      });
      return pass('Docs and UI keep Solo Jokers as free v1 attempt-local helpers with no Diamond/inventory economy.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('solo_jokers_runtime_proof_required',
    'Solo joker behavior still needs manual gameplay proof',
    () => notAutomatable('Manual Solo run must verify touch layout, one-use state, Kronokalkan, Kart Değiştir, and Zaman Dondur on a real gameplay screen.', {
      verification: 'MANUAL_RUNTIME_PROOF_REQUIRED',
      classification: 'NOT_AUTOMATABLE',
      actionType: ACTION_TYPES.HUMAN_RUNTIME_PROOF,
      manualProof: [
        'Use each joker once across fresh Solo attempts.',
        'Confirm the bar sits between timeline and KARTI YERLEŞTİR without overlap.',
        'Confirm Zaman Dondur resumes after 10 seconds and cleanup works after replay/result.',
      ],
    }), { critical: false, actionType: ACTION_TYPES.HUMAN_RUNTIME_PROOF }),
];
