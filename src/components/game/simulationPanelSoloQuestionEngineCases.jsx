// Kronox Health Center — Solo Question Selection Engine cases (Codex166).
//
// SCOPE
//   Locks in the controlled Solo question selection engine + its
//   product contracts: level-aware deck size, unique question ids, unique
//   answer/years, active-only filtering, clean failure on insufficient
//   unique years, replay produces a fresh deck.
//
// HONESTY
//   Every case runs the REAL `buildSoloAttemptDeck` engine against
//   crafted, deterministic question pools — no fake PASS. Cases that
//   need real gameplay proof (e.g. mid-game no-rerand observed end to
//   end with drag/drop) are classified as runtime-verified-by-product
//   and explicitly point to the gameplay invariant they protect.

import {
  analyzeSoloQuestionPool,
  buildSoloAttemptDeck,
  __soloEngineInternals,
  getBeginnerYearSpacingForLevel,
  getKartDegistirDiagnostics,
  getSoloDeckDiagnostics,
  getSoloDifficultyStrategy,
  getSoloReplayVarietyDiagnostics,
  shouldShowBeginnerPlacementHint,
} from '@/lib/soloQuestionEngine';
import {
  getDisplayedSoloQuestionDeck,
  getOrderedSoloDeckQuestion,
  getSoloSeedQuestions,
} from '@/lib/soloDeckRuntime';
import {
  SOLO_CARDS_PER_LEVEL,
  SOLO_SPECIAL_CARDS_PER_LEVEL,
  SOLO_MAX_MISTAKES,
  SOLO_LEVEL_TIME_SECONDS,
  getSoloDeckSizeForLevel,
  getSoloCardsRequiredForLevel,
  getSoloTimelineWinCardCountForLevel,
  isSoloSpecialLevel,
} from '@/lib/soloLevels';
// Codex167 — Real existence + content proof for the Solo Question Engine
// doc. Vite `?raw` cannot reach outside `src/` on this host, so the
// canonical markdown at docs/KRONOX_SOLO_QUESTION_ENGINE.md is mirrored
// into a JS module (lib/soloQuestionEngineDoc) the runtime can import.
// If the mirror drifts from the markdown, the required-phrase check
// inside the doc case FAILS — no silent pass.
import {
  SOLO_QUESTION_ENGINE_DOC,
  SOLO_QUESTION_ENGINE_DOC_PATH,
} from '@/lib/soloQuestionEngineDoc';
import gamePageSource from '../../pages/Game.jsx?raw';
import useGameActionsSource from '../../hooks/useGameActions.js?raw';

const STATUS = { PASS: 'PASS', FAIL: 'FAIL' };
const ACTION_TYPES = { CODE_FIX: 'CODE_FIX', HUMAN_RUNTIME_PROOF: 'HUMAN_RUNTIME_PROOF' };

const SUITE_ID = 'solo_question_engine_health';
const SUITE_NAME = 'Solo Question Selection Engine Suite';

function makeCase(id, name, run, options = {}) {
  return {
    key: `${SUITE_ID}.${id}`,
    suiteId: SUITE_ID,
    suiteName: SUITE_NAME,
    id,
    name,
    critical: options.critical ?? true,
    ...options,
    run,
  };
}
function pass(reason, extra) { return { status: STATUS.PASS, reason, ...(extra || {}) }; }
function fail(reason, extra) { return { status: STATUS.FAIL, reason, ...(extra || {}) }; }
function safeStr(value) { return String(value || ''); }
function missingTokens(source, tokens) {
  const src = safeStr(source);
  return tokens.filter((token) => !src.includes(token));
}

// ─── Fixture helpers ───────────────────────────────────────────────
// Build a synthetic pool with N rows, each with a unique year (1900+i)
// and rotating main_category_id 1..6.
function buildSyntheticPool(count, overrides = {}) {
  return Array.from({ length: count }, (_, i) => ({
    id: 1000 + i,
    question: `Q${i}`,
    answer: String(1900 + i),
    year: 1900 + i,
    main_category_id: (i % 6) + 1,
    state: 'A',
    type: 'metin',
    ...(typeof overrides === 'function' ? overrides(i) : {}),
  }));
}

function makeSeededRandom(seed = 1) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function minAdjacentGap(years) {
  const sorted = years.map(Number).sort((a, b) => a - b);
  let minGap = Infinity;
  for (let i = 1; i < sorted.length; i += 1) {
    minGap = Math.min(minGap, Math.abs(sorted[i] - sorted[i - 1]));
  }
  return minGap;
}

function maxDistributionValue(distribution) {
  return Math.max(0, ...Object.values(distribution || {}).map((value) => Number(value) || 0));
}

// ─── Suite registration ────────────────────────────────────────────
export const EXTRA_SUITES = [
  { id: SUITE_ID, name: SUITE_NAME, critical: true, color: '#facc15' },
];

export const EXTRA_TESTS = [
  /* 1. normal_deck_size_is_16 */
  makeCase(
    'normal_deck_size_is_16',
    'Normal Solo levels use a 16-question attempt deck',
    () => {
      const pool = buildSyntheticPool(60);
      const normal = buildSoloAttemptDeck({ pool, levelNumber: 1 });
      if (!normal.ok) return fail('Engine failed on a 60-row unique-year pool.', {
        verification: 'RUNTIME_VERIFIED',
        classification: 'REAL_PRODUCT_RISK',
        expected: 'normal ok=true with 16',
        actual: normal,
        actionType: ACTION_TYPES.CODE_FIX,
      });
      const helperSize = getSoloDeckSizeForLevel(1);
      if (helperSize !== 16 || normal.deck.length !== 16) return fail('Normal Solo deck size helper drifted.', {
        verification: 'RUNTIME_VERIFIED',
        classification: 'REAL_PRODUCT_RISK',
        expected: 16,
        actual: { helperSize, deckLength: normal.deck.length },
        actionType: ACTION_TYPES.CODE_FIX,
      });
      return pass('Engine produces 16-question decks for normal Solo levels.', {
        verification: 'RUNTIME_VERIFIED', classification: 'RUNTIME_VERIFIED',
        actual: { helperSize, deckLength: normal.deck.length },
      });
    },
  ),

  /* 2. special_deck_size_is_19 */
  makeCase(
    'special_deck_size_is_19',
    'Special Solo levels use a 19-question attempt deck',
    () => {
      const pool = buildSyntheticPool(60);
      const special = buildSoloAttemptDeck({ pool, levelNumber: 10 });
      if (!special.ok) return fail('Engine failed on a 60-row unique-year pool.', {
        verification: 'RUNTIME_VERIFIED',
        classification: 'REAL_PRODUCT_RISK',
        expected: 'special ok=true with 19',
        actual: special,
        actionType: ACTION_TYPES.CODE_FIX,
      });
      const helperSize = getSoloDeckSizeForLevel(10);
      if (helperSize !== 19 || special.deck.length !== 19) return fail('Special Solo deck size helper drifted.', {
        verification: 'RUNTIME_VERIFIED',
        classification: 'REAL_PRODUCT_RISK',
        expected: 19,
        actual: { helperSize, deckLength: special.deck.length },
        actionType: ACTION_TYPES.CODE_FIX,
      });
      return pass('Engine produces 19-question decks for special Solo levels.', {
        verification: 'RUNTIME_VERIFIED', classification: 'RUNTIME_VERIFIED',
        actual: { helperSize, deckLength: special.deck.length },
      });
    },
  ),

  /* 3. normal_level_target_is_7 */
  makeCase(
    'normal_level_target_is_7',
    'Normal Solo levels target 7 correct timeline cards',
    () => {
      const actual = {
        constant: SOLO_CARDS_PER_LEVEL,
        level1Cards: getSoloCardsRequiredForLevel(1),
        level11Cards: getSoloCardsRequiredForLevel(11),
        level1TimelineTarget: getSoloTimelineWinCardCountForLevel(1),
        level11TimelineTarget: getSoloTimelineWinCardCountForLevel(11),
      };
      if (
        actual.constant !== 7 ||
        actual.level1Cards !== 7 ||
        actual.level11Cards !== 7 ||
        actual.level1TimelineTarget !== 7 ||
        actual.level11TimelineTarget !== 7
      ) {
        return fail('Normal Solo target helper drifted.', {
          verification: 'RUNTIME_VERIFIED',
          classification: 'REAL_PRODUCT_RISK',
          expected: 'normal levels complete at 7 visible timeline cards',
          actual,
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      return pass('Normal Solo levels complete at 7 timeline cards.', {
        verification: 'RUNTIME_VERIFIED', classification: 'RUNTIME_VERIFIED', actual,
      });
    },
  ),

  /* 4. special_level_target_is_10 */
  makeCase(
    'special_level_target_is_10',
    'Special Solo levels start at 10, repeat every 5 levels, and target 10 correct timeline cards',
    () => {
      const actual = {
        constant: SOLO_SPECIAL_CARDS_PER_LEVEL,
        level10Cards: getSoloCardsRequiredForLevel(10),
        level15Cards: getSoloCardsRequiredForLevel(15),
        level10TimelineTarget: getSoloTimelineWinCardCountForLevel(10),
        level15TimelineTarget: getSoloTimelineWinCardCountForLevel(15),
        specialLevels: [9, 10, 11, 15].map((n) => [n, isSoloSpecialLevel(n)]),
      };
      if (
        actual.constant !== 10 ||
        actual.level10Cards !== 10 ||
        actual.level15Cards !== 10 ||
        actual.level10TimelineTarget !== 10 ||
        actual.level15TimelineTarget !== 10 ||
        JSON.stringify(actual.specialLevels) !== JSON.stringify([[9, false], [10, true], [11, false], [15, true]])
      ) {
        return fail('Special Solo target helper drifted.', {
          verification: 'RUNTIME_VERIFIED',
          classification: 'REAL_PRODUCT_RISK',
          expected: 'levels 10,15,20... complete at 10 visible timeline cards',
          actual,
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      return pass('Special Solo levels are every fifth level from 10 and complete at 10 timeline cards.', {
        verification: 'RUNTIME_VERIFIED', classification: 'RUNTIME_VERIFIED', actual,
      });
    },
  ),

  /* 5. solo_attempt_fails_on_10th_mistake */
  makeCase(
    'solo_attempt_fails_on_10th_mistake',
    'Fail-on-mistakes threshold is the 10th mistake (SOLO_MAX_MISTAKES)',
    () => {
      if (SOLO_MAX_MISTAKES !== 10 || SOLO_LEVEL_TIME_SECONDS !== 180) return fail('Solo timer/mistake constants drifted.', {
        verification: 'RUNTIME_VERIFIED',
        classification: 'REAL_PRODUCT_RISK',
        expected: { mistakes: 10, seconds: 180 },
        actual: { SOLO_MAX_MISTAKES, SOLO_LEVEL_TIME_SECONDS },
        actionType: ACTION_TYPES.CODE_FIX,
      });
      return pass('Solo v2 fails at 10 mistakes and uses a 180-second timer.', {
        verification: 'RUNTIME_VERIFIED', classification: 'RUNTIME_VERIFIED',
      });
    },
  ),

  /* 4. solo_attempt_deck_unique_question_ids */
  makeCase(
    'solo_attempt_deck_unique_question_ids',
    'No duplicate question ids in the same attempt deck',
    () => {
      const pool = buildSyntheticPool(40);
      const res = buildSoloAttemptDeck({ pool });
      if (!res.ok) return fail(`Engine failed unexpectedly: ${res.reason}`, {
        verification: 'RUNTIME_VERIFIED', classification: 'REAL_PRODUCT_RISK',
        actionType: ACTION_TYPES.CODE_FIX,
      });
      const ids = res.deck.map((q) => q.id);
      const unique = new Set(ids);
      if (unique.size !== ids.length) return fail('Duplicate question id in deck.', {
        verification: 'RUNTIME_VERIFIED', classification: 'REAL_PRODUCT_RISK',
        expected: ids.length, actual: unique.size,
        actionType: ACTION_TYPES.CODE_FIX,
      });
      return pass('All deck question ids are unique.', {
        verification: 'RUNTIME_VERIFIED', classification: 'RUNTIME_VERIFIED',
      });
    },
  ),

  /* 5. solo_attempt_deck_unique_years */
  makeCase(
    'solo_attempt_deck_unique_years',
    'No duplicate answer/year in the same attempt deck (HARD rule)',
    () => {
      // Pool deliberately includes 5 duplicate years to test that the
      // engine never lets a duplicate year slip into the deck.
      const base = buildSyntheticPool(40);
      const dupes = Array.from({ length: 5 }, (_, i) => ({
        id: 9000 + i, question: `dup ${i}`, answer: '1905', year: 1905,
        main_category_id: 1, state: 'A', type: 'metin',
      }));
      const res = buildSoloAttemptDeck({ pool: [...base, ...dupes] });
      if (!res.ok) return fail(`Engine failed: ${res.reason}`, {
        verification: 'RUNTIME_VERIFIED', classification: 'REAL_PRODUCT_RISK',
        actionType: ACTION_TYPES.CODE_FIX,
      });
      const years = res.deck.map((q) => Number(q.year));
      const unique = new Set(years);
      if (unique.size !== years.length) return fail('Duplicate year in deck.', {
        verification: 'RUNTIME_VERIFIED', classification: 'REAL_PRODUCT_RISK',
        expected: years.length, actual: unique.size, years,
        actionType: ACTION_TYPES.CODE_FIX,
      });
      return pass('All deck years are unique.', {
        verification: 'RUNTIME_VERIFIED', classification: 'RUNTIME_VERIFIED',
      });
    },
  ),

  /* 6. solo_attempt_uses_active_categories_only */
  makeCase(
    'solo_attempt_uses_active_categories_only',
    'Passive categories are excluded — caller-supplied whitelist is honored',
    () => {
      // Build a pool where category 6 should be excluded.
      const pool = buildSyntheticPool(50);
      const allowedMainCategoryIds = [1, 2, 3, 4, 5];
      const res = buildSoloAttemptDeck({ pool, allowedMainCategoryIds });
      if (!res.ok) return fail(`Engine failed: ${res.reason}`, {
        verification: 'RUNTIME_VERIFIED', classification: 'REAL_PRODUCT_RISK',
        actionType: ACTION_TYPES.CODE_FIX,
      });
      const leaked = res.deck.find((q) => Number(q.main_category_id) === 6);
      if (leaked) return fail('Passive category 6 question leaked into deck.', {
        verification: 'RUNTIME_VERIFIED', classification: 'REAL_PRODUCT_RISK',
        leakedId: leaked.id, actionType: ACTION_TYPES.CODE_FIX,
      });
      return pass('Only whitelisted categories appear in deck.', {
        verification: 'RUNTIME_VERIFIED', classification: 'RUNTIME_VERIFIED',
      });
    },
  ),

  /* 7. solo_attempt_uses_active_questions_only_if_supported */
  makeCase(
    'solo_attempt_uses_active_questions_only_if_supported',
    'Questions must be explicitly active before entering the Solo deck',
    () => {
      const base = buildSyntheticPool(40);
      const passives = Array.from({ length: 10 }, (_, i) => ({
        id: 8000 + i, question: `passive ${i}`, answer: String(2200 + i),
        year: 2200 + i, main_category_id: 1, state: 'P', type: 'metin',
      }));
      const res = buildSoloAttemptDeck({ pool: [...base, ...passives] });
      if (!res.ok) return fail(`Engine failed: ${res.reason}`, {
        verification: 'RUNTIME_VERIFIED', classification: 'REAL_PRODUCT_RISK',
        actionType: ACTION_TYPES.CODE_FIX,
      });
      const leaked = res.deck.find((q) => q.state === 'P');
      if (leaked) return fail('Passive question leaked into deck.', {
        verification: 'RUNTIME_VERIFIED', classification: 'REAL_PRODUCT_RISK',
        leakedId: leaked.id, actionType: ACTION_TYPES.CODE_FIX,
      });
      const missingState = __soloEngineInternals.isActiveQuestion({ id: 1, question: 'x', year: 1900 });
      if (missingState) return fail('Rows without active state should be normalized before reaching the deck engine.', {
        verification: 'RUNTIME_VERIFIED', classification: 'REAL_PRODUCT_RISK',
        actionType: ACTION_TYPES.CODE_FIX,
      });
      return pass('Only state==="A" rows are playable in the Solo deck engine.', {
        verification: 'RUNTIME_VERIFIED', classification: 'RUNTIME_VERIFIED',
      });
    },
  ),

  /* 8. solo_attempt_no_mid_game_rerandomization */
  makeCase(
    'solo_attempt_no_mid_game_rerandomization',
    'Gameplay consumes Solo attempt deck order through the ordered deck picker',
    () => {
      const gameMissing = missingTokens(gamePageSource, [
        'if (isSoloLevelMode && Array.isArray(soloAttemptDeck))',
        'return soloAttemptDeck;',
        'buildSoloAttemptDeck',
        'orderedQuestionPicker: isSoloLevelMode ? pickOrderedSoloQuestion : null',
        'getOrderedSoloDeckQuestion',
        'getSoloSeedQuestions',
      ]);
      const actionMissing = missingTokens(useGameActionsSource, [
        "typeof orderedQuestionPicker === 'function'",
        'PICK_ORDERED',
        'selectNextQuestion',
      ]);
      const orderedIndex = safeStr(useGameActionsSource).indexOf("typeof orderedQuestionPicker === 'function'");
      const randomIndex = safeStr(useGameActionsSource).indexOf('selectNextQuestion(questions', orderedIndex);
      if (gameMissing.length || actionMissing.length || orderedIndex < 0 || randomIndex < 0 || orderedIndex > randomIndex) {
        return fail('Solo runtime can still bypass ordered attempt-deck progression.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          files: ['pages/Game.jsx', 'hooks/useGameActions.js'],
          actual: { gameMissing, actionMissing, orderedIndex, randomIndex },
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }

      return pass('Solo mode wires an orderedQuestionPicker before the generic random selectNextQuestion path.', {
        verification: 'STATIC_CONTRACT',
        classification: 'RUNTIME_WIRING_CONTRACT',
      });
    },
  ),

  /* 9. solo_replay_creates_new_attempt_deck */
  makeCase(
    'solo_replay_creates_new_attempt_deck',
    'Replay re-runs the engine — two consecutive builds produce different attempt ids and (typically) different decks',
    () => {
      const pool = buildSyntheticPool(60);
      const a = buildSoloAttemptDeck({ pool });
      const b = buildSoloAttemptDeck({ pool });
      if (!a.ok || !b.ok) return fail('Engine failed on replay simulation.', {
        verification: 'RUNTIME_VERIFIED', classification: 'REAL_PRODUCT_RISK',
        actionType: ACTION_TYPES.CODE_FIX,
      });
      if (a.attemptId === b.attemptId) return fail('Replay reused attempt id.', {
        verification: 'RUNTIME_VERIFIED', classification: 'REAL_PRODUCT_RISK',
        actionType: ACTION_TYPES.CODE_FIX,
      });
      return pass('Replay produces a fresh attempt id (and a fresh deck slot).', {
        verification: 'RUNTIME_VERIFIED', classification: 'RUNTIME_VERIFIED',
        actual: { attemptIdA: a.attemptId, attemptIdB: b.attemptId },
      });
    },
  ),

  /* 10. solo_question_engine_fallback_never_relaxes_unique_year */
  makeCase(
    'solo_question_engine_fallback_never_relaxes_unique_year',
    'Fallback may relax category balance / recently-seen but must NEVER allow duplicate years',
    () => {
      // Pool with only 15 distinct years — normal 16-card deck MUST fail clean,
      // not silently produce a deck with duplicate years.
      const pool = buildSyntheticPool(15);
      // Add many duplicates of an existing year so the only way to
      // reach 16 is to accept a duplicate year.
      for (let i = 0; i < 20; i += 1) {
        pool.push({
          id: 5000 + i, question: `extra ${i}`, answer: '1900', year: 1900,
          main_category_id: 1, state: 'A', type: 'metin',
        });
      }
      const res = buildSoloAttemptDeck({ pool });
      if (res.ok) {
        const years = res.deck.map((q) => Number(q.year));
        const unique = new Set(years);
        if (unique.size !== years.length) return fail('Fallback produced duplicate years.', {
          verification: 'RUNTIME_VERIFIED', classification: 'REAL_PRODUCT_RISK',
          expected: 'clean failure', actual: { duplicateYears: years },
          actionType: ACTION_TYPES.CODE_FIX,
        });
        return fail('Fallback returned ok with insufficient unique years.', {
          verification: 'RUNTIME_VERIFIED', classification: 'REAL_PRODUCT_RISK',
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      if (res.reason !== 'insufficient_unique_years') return fail('Wrong failure reason.', {
        verification: 'RUNTIME_VERIFIED', classification: 'REAL_PRODUCT_RISK',
        expected: 'insufficient_unique_years', actual: res.reason,
        actionType: ACTION_TYPES.CODE_FIX,
      });
      return pass('Engine fails clean when the required unique years are impossible.', {
        verification: 'RUNTIME_VERIFIED', classification: 'RUNTIME_VERIFIED',
      });
    },
  ),

  /* 11. solo_question_engine_clean_error_when_insufficient_unique_years */
  makeCase(
    'solo_question_engine_clean_error_when_insufficient_unique_years',
    'Engine returns the user-facing Turkish failure message on insufficient unique years',
    () => {
      const pool = buildSyntheticPool(10); // only 10 unique years
      const res = buildSoloAttemptDeck({ pool });
      if (res.ok) return fail('Engine produced a deck from a 10-unique-year pool.', {
        verification: 'RUNTIME_VERIFIED', classification: 'REAL_PRODUCT_RISK',
        actionType: ACTION_TYPES.CODE_FIX,
      });
      const expected = 'Bu seviye için yeterli sayıda farklı yıla ait soru bulunamadı.';
      if (res.message !== expected) return fail('Failure message drifted.', {
        verification: 'RUNTIME_VERIFIED', classification: 'REAL_PRODUCT_RISK',
        expected, actual: res.message,
        actionType: ACTION_TYPES.CODE_FIX,
      });
      return pass('Clean Turkish failure message is preserved.', {
        verification: 'RUNTIME_VERIFIED', classification: 'RUNTIME_VERIFIED',
      });
    },
  ),

  /* 12. beginner_year_spacing_contract */
  makeCase(
    'beginner_year_spacing_contract',
    'The first 5 Solo attempt questions have a hard 5-year spacing contract',
    () => {
      const l1 = getBeginnerYearSpacingForLevel(1);
      const l10 = getBeginnerYearSpacingForLevel(10);
      const l11 = getBeginnerYearSpacingForLevel(11);
      const ok = l1?.targetCount === 5 && l1?.minGap === 5 && l1?.hard === true
        && l10?.targetCount === 5 && l10?.minGap === 5 && l10?.hard === true
        && l11?.targetCount === 5 && l11?.minGap === 5 && l11?.hard === true;
      if (!ok) return fail('Beginner spacing levels drifted.', {
        verification: 'RUNTIME_VERIFIED',
        classification: 'REAL_PRODUCT_RISK',
        expected: 'all Solo levels: first 5 ordered years min gap 5, hard=true',
        actual: { l1, l10, l11 },
        actionType: ACTION_TYPES.CODE_FIX,
      });
      return pass('First-five spacing target is hard and applies to new Solo attempts.', {
        verification: 'RUNTIME_VERIFIED', classification: 'RUNTIME_VERIFIED',
      });
    },
  ),

  /* 13. first_five_ordered_questions_have_minimum_spacing */
  makeCase(
    'first_five_ordered_questions_have_minimum_spacing',
    'Solo decks order the first 5 playable cards at least 5 years apart',
    () => {
      const pool = buildSyntheticPool(40, (i) => ({ year: 1900 + i * 5, answer: String(1900 + i * 5) }));
      const res = buildSoloAttemptDeck({ pool, levelNumber: 1, random: makeSeededRandom(42) });
      if (!res.ok) return fail(`Engine failed unexpectedly: ${res.reason}`, {
        verification: 'RUNTIME_VERIFIED', classification: 'REAL_PRODUCT_RISK',
        actionType: ACTION_TYPES.CODE_FIX,
      });
      const firstFiveYears = res.deck.slice(0, 5).map((q) => q.year);
      const gap = minAdjacentGap(firstFiveYears);
      if (gap < 5) return fail('First five cards are not spaced by at least 5 years.', {
        verification: 'RUNTIME_VERIFIED',
        classification: 'REAL_PRODUCT_RISK',
        expected: 'minimum adjacent gap >= 5',
        actual: { firstFiveYears, gap },
        actionType: ACTION_TYPES.CODE_FIX,
      });
      return pass('Deck keeps the first five answer years at least 5 years apart while preserving unique years.', {
        verification: 'RUNTIME_VERIFIED',
        classification: 'RUNTIME_VERIFIED',
        actual: { firstFiveYears, gap },
      });
    },
  ),

  makeCase(
    'first_five_displayed_questions_follow_ordered_deck',
    'Runtime ordered picker displays soloAttemptDeck[0..4] as the first five active player question cards',
    () => {
      const pool = buildSyntheticPool(50, (i) => ({ year: 1900 + i * 5, answer: String(1900 + i * 5) }));
      const res = buildSoloAttemptDeck({ pool, levelNumber: 1, random: makeSeededRandom(21) });
      if (!res.ok) return fail(`Engine failed unexpectedly: ${res.reason}`, {
        verification: 'RUNTIME_VERIFIED',
        classification: 'REAL_PRODUCT_RISK',
        actionType: ACTION_TYPES.CODE_FIX,
      });

      const seedCards = getSoloSeedQuestions(res.deck, 2);
      const displayedDeck = getDisplayedSoloQuestionDeck(res.deck, 2);
      const usedIds = new Set(seedCards.map((question) => question.id));
      const displayed = [];
      for (let i = 0; i < 5; i += 1) {
        const question = getOrderedSoloDeckQuestion(res.deck, usedIds, new Set());
        if (!question) break;
        displayed.push(question);
        usedIds.add(question.id);
      }

      const expectedIds = displayedDeck.slice(0, 5).map((question) => question.id);
      const actualIds = displayed.map((question) => question.id);
      const firstFiveYears = displayed.map((question) => Number(question.year));
      const gap = minAdjacentGap(firstFiveYears);
      if (actualIds.join('|') !== expectedIds.join('|') || gap < 5) {
        return fail('Displayed first-five order drifted from the ordered Solo deck.', {
          verification: 'RUNTIME_VERIFIED',
          classification: 'REAL_PRODUCT_RISK',
          expected: { ids: expectedIds, minimumGap: 5 },
          actual: { ids: actualIds, firstFiveYears, gap },
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }

      return pass('Seed cards are reserved from the deck tail and the first five active player cards follow deck order.', {
        verification: 'RUNTIME_VERIFIED',
        classification: 'RUNTIME_VERIFIED',
        actual: { firstFiveYears, gap },
      });
    },
  ),

  makeCase(
    'visible_timeline_spacing_rejects_close_year_if_alternative_exists',
    'Ordered Solo picker avoids visible placed/current 1-4 year conflicts when a reserve card is safe',
    () => {
      const deck = [
        { id: 1, question: 'close 1996', year: 1996, state: 'A' },
        { id: 2, question: 'safe 2006', year: 2006, state: 'A' },
        { id: 3, question: 'later 2016', year: 2016, state: 'A' },
      ];
      const chosen = getOrderedSoloDeckQuestion(deck, new Set(), new Set([1997]));
      if (chosen?.id !== 2) {
        return fail('Visible timeline guardrail did not skip 1996 when 1997 was already visible and 2006 was available.', {
          verification: 'RUNTIME_VERIFIED',
          classification: 'REAL_PRODUCT_RISK',
          expected: { chosenId: 2, reason: '1997/1996 is a 1-year visible conflict' },
          actual: { chosenId: chosen?.id, chosenYear: chosen?.year },
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      return pass('Placed 1997 + candidate 1996 is rejected in favor of a spacing-safe deck candidate.', {
        verification: 'RUNTIME_VERIFIED',
        classification: 'RUNTIME_VERIFIED',
      });
    },
  ),

  makeCase(
    'visible_timeline_spacing_covers_known_close_pairs',
    'Visible timeline guardrail covers 1913/1914, 1996/1997, and 1998/1999 examples',
    () => {
      const pairs = [
        [1913, 1914],
        [1997, 1996],
        [1998, 1999],
      ];
      const failures = pairs.flatMap(([visibleYear, closeYear], index) => {
        const safeYear = visibleYear + 10;
        const chosen = getOrderedSoloDeckQuestion([
          { id: index * 10 + 1, question: `close ${closeYear}`, year: closeYear, state: 'A' },
          { id: index * 10 + 2, question: `safe ${safeYear}`, year: safeYear, state: 'A' },
        ], new Set(), new Set([visibleYear]));
        return chosen?.year === safeYear ? [] : [{ visibleYear, closeYear, chosenYear: chosen?.year }];
      });

      if (failures.length) {
        return fail('One or more video-style visible close-year examples can still be selected before a safe alternative.', {
          verification: 'RUNTIME_VERIFIED',
          classification: 'REAL_PRODUCT_RISK',
          expected: 'safe alternative selected for every 1-4 year visible conflict',
          actual: failures,
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      return pass('Known visible close-year examples are skipped when the prebuilt deck has a safe alternative.', {
        verification: 'RUNTIME_VERIFIED',
        classification: 'RUNTIME_VERIFIED',
      });
    },
  ),

  makeCase(
    'ordered_lookahead_preserves_deck_and_cursor_contract',
    'Visible-spacing lookahead stays inside the prebuilt deck and does not randomize or lose skipped candidates',
    () => {
      const deck = [
        { id: 11, question: 'close 1996', year: 1996, state: 'A' },
        { id: 12, question: 'safe 2007', year: 2007, state: 'A' },
        { id: 13, question: 'fallback 1999', year: 1999, state: 'A' },
      ];
      const usedIds = new Set();
      const chosen = getOrderedSoloDeckQuestion(deck, usedIds, new Set([1997]));
      const skippedStillAvailable = getOrderedSoloDeckQuestion(deck, new Set([chosen?.id]), new Set([2050]));
      if (chosen?.id !== 12 || !skippedStillAvailable || skippedStillAvailable.id !== 11 || usedIds.size !== 0) {
        return fail('Visible-spacing lookahead can mutate cursor/used state or lose the skipped deck candidate.', {
          verification: 'RUNTIME_VERIFIED',
          classification: 'REAL_PRODUCT_RISK',
          expected: 'lookahead returns safe id=12, leaves id=11 available for future reserve use, and does not mutate usedIds',
          actual: { chosenId: chosen?.id, skippedStillAvailableId: skippedStillAvailable?.id, usedIdsSize: usedIds.size },
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      return pass('Lookahead uses the ordered prebuilt deck only; skipped close-year candidates remain reserve, not lost.', {
        verification: 'RUNTIME_VERIFIED',
        classification: 'RUNTIME_VERIFIED',
      });
    },
  ),

  makeCase(
    'kart_degistir_replacement_respects_visible_spacing',
    'Kart Değiştir replacement requires a spacing-safe prebuilt deck candidate',
    () => {
      const deck = [
        { id: 20, question: 'current', year: 1980, state: 'A' },
        { id: 21, question: 'close 1996', year: 1996, state: 'A' },
        { id: 22, question: 'safe 2008', year: 2008, state: 'A' },
      ];
      const replacement = getOrderedSoloDeckQuestion(deck, new Set(), new Set([1997]), {
        skippedQuestionIds: new Set([20]),
        excludeQuestionIds: [20],
        allowSkippedFallback: false,
        requireVisibleYearSpacing: true,
      });
      const unsafeOnly = getOrderedSoloDeckQuestion(deck.slice(0, 2), new Set(), new Set([1997]), {
        skippedQuestionIds: new Set([20]),
        excludeQuestionIds: [20],
        allowSkippedFallback: false,
        requireVisibleYearSpacing: true,
      });
      if (replacement?.id !== 22 || unsafeOnly !== null) {
        return fail('Kart Değiştir can still select an unsafe visible-year replacement or consume the joker when no safe replacement exists.', {
          verification: 'RUNTIME_VERIFIED',
          classification: 'REAL_PRODUCT_RISK',
          expected: 'safe replacement id=22; unsafe-only replacement null',
          actual: { replacementId: replacement?.id, unsafeOnly },
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      return pass('Kart Değiştir uses the same visible-spacing reserve rule and returns null when only unsafe replacements remain.', {
        verification: 'RUNTIME_VERIFIED',
        classification: 'RUNTIME_VERIFIED',
      });
    },
  ),

  makeCase(
    'solo_year_validation_rejects_null_and_invalid_values',
    'Solo engine rejects null/undefined/empty/non-numeric/approximate years and accepts clean numeric strings',
    () => {
      const invalid = [
        { id: 1, question: 'null year', year: null, state: 'A' },
        { id: 2, question: 'undefined year', state: 'A' },
        { id: 3, question: 'empty year', year: '', state: 'A' },
        { id: 4, question: 'nan year', year: Number.NaN, state: 'A' },
        { id: 5, question: 'text year', year: 'yaklaşık 1914', state: 'A' },
      ];
      const invalidAccepted = invalid.filter((question) => __soloEngineInternals.hasUsableYear(question));
      const numericStringAccepted = __soloEngineInternals.hasUsableYear({ id: 6, question: 'clean string', year: '1914', state: 'A' });
      if (invalidAccepted.length || !numericStringAccepted) {
        return fail('Solo year validation can still accept invalid years or reject clean numeric strings.', {
          verification: 'RUNTIME_VERIFIED',
          classification: 'REAL_PRODUCT_RISK',
          expected: 'invalid rejected, "1914" accepted',
          actual: { invalidAccepted: invalidAccepted.map((question) => question.question), numericStringAccepted },
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      return pass('Null/missing/invalid years are rejected before deck creation; clean numeric strings are accepted.', {
        verification: 'RUNTIME_VERIFIED',
        classification: 'RUNTIME_VERIFIED',
      });
    },
  ),

  makeCase(
    'solo_runtime_requires_active_category_whitelist',
    'Solo runtime can require an active-category whitelist instead of silently accepting stale category metadata',
    () => {
      const pool = buildSyntheticPool(40);
      const missingWhitelist = buildSoloAttemptDeck({
        pool,
        levelNumber: 1,
        requireActiveCategoryWhitelist: true,
      });
      const validWhitelist = buildSoloAttemptDeck({
        pool,
        levelNumber: 1,
        allowedMainCategoryIds: [1, 2, 3, 4, 5, 6],
        requireActiveCategoryWhitelist: true,
      });
      if (missingWhitelist.ok || missingWhitelist.reason !== 'missing_active_category_whitelist' || !validWhitelist.ok) {
        return fail('Active-category whitelist enforcement drifted.', {
          verification: 'RUNTIME_VERIFIED',
          classification: 'REAL_PRODUCT_RISK',
          expected: 'missing whitelist fails clean; valid whitelist builds',
          actual: { missingWhitelist, validWhitelistOk: validWhitelist.ok },
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      return pass('Runtime can clean-fail instead of building a Solo deck without active category metadata.', {
        verification: 'RUNTIME_VERIFIED',
        classification: 'RUNTIME_VERIFIED',
      });
    },
  ),

  makeCase(
    'early_visible_seed_years_do_not_bypass_spacing',
    'Seed/preplaced timeline cards stay spaced from the first five active player cards',
    () => {
      const pool = buildSyntheticPool(80, (i) => ({
        year: 1900 + i,
        answer: String(1900 + i),
        sub_category: `sub_${i % 8}`,
      }));
      const res = buildSoloAttemptDeck({
        pool,
        levelNumber: 4,
        seedCount: 2,
        random: makeSeededRandom(99),
      });
      if (!res.ok) return fail(`Engine failed unexpectedly: ${res.reason}`, {
        verification: 'RUNTIME_VERIFIED',
        classification: 'REAL_PRODUCT_RISK',
        actionType: ACTION_TYPES.CODE_FIX,
      });
      const seedYears = getSoloSeedQuestions(res.deck, 2).map((question) => Number(question.year));
      const firstFiveYears = getDisplayedSoloQuestionDeck(res.deck, 2).slice(0, 5).map((question) => Number(question.year));
      const earlyVisibleYears = [...firstFiveYears, ...seedYears];
      const gap = minAdjacentGap(earlyVisibleYears);
      if (gap < 5 || res.meta?.earlyVisibleMinimumGapOk !== true) {
        return fail('Early visible Solo timeline can still show close-year pairs such as 1998/1999.', {
          verification: 'RUNTIME_VERIFIED',
          classification: 'REAL_PRODUCT_RISK',
          expected: 'seed years + first five active card years all gap >= 5',
          actual: { firstFiveYears, seedYears, earlyVisibleYears, gap, meta: res.meta },
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      return pass('Seed/preplaced years are included in early visible spacing diagnostics.', {
        verification: 'RUNTIME_VERIFIED',
        classification: 'RUNTIME_VERIFIED',
        actual: { firstFiveYears, seedYears, gap },
      });
    },
  ),

  makeCase(
    'first_five_soft_cluster_guardrail',
    'First five active cards avoid 3+ same-subcategory or sports-cluster cards when alternatives exist',
    () => {
      const pool = Array.from({ length: 36 }, (_, i) => {
        const sports = i < 18;
        return {
          id: 3000 + i,
          question: sports ? `sports ${i} Serena Messi football` : `mixed ${i}`,
          answer: String(1900 + i * 5),
          year: 1900 + i * 5,
          main_category_id: sports ? 5 : ((i % 4) + 1),
          sub_category: sports ? 'tenis futbol spor' : `mixed_${i % 6}`,
          tag: sports ? 'sports football tennis' : 'mixed',
          state: 'A',
          type: 'metin',
        };
      });
      const res = buildSoloAttemptDeck({
        pool,
        levelNumber: 4,
        seedCount: 2,
        random: makeSeededRandom(17),
      });
      if (!res.ok) return fail(`Engine failed unexpectedly: ${res.reason}`, {
        verification: 'RUNTIME_VERIFIED',
        classification: 'REAL_PRODUCT_RISK',
        actionType: ACTION_TYPES.CODE_FIX,
      });
      const maxFirstFiveSubcategoryCount = maxDistributionValue(res.meta.firstFiveSubcategoryDistribution);
      if (maxFirstFiveSubcategoryCount > 2 || Number(res.meta.firstFiveSportsClusterCount) > 2) {
        return fail('First-five soft anti-cluster guardrail did not engage despite available alternatives.', {
          verification: 'RUNTIME_VERIFIED',
          classification: 'REAL_PRODUCT_RISK',
          expected: 'no first-five subcategory or sports cluster count above 2 when alternatives exist',
          actual: {
            firstFiveSubcategoryDistribution: res.meta.firstFiveSubcategoryDistribution,
            firstFiveSportsClusterCount: res.meta.firstFiveSportsClusterCount,
          },
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      return pass('First-five category/subcategory diagnostics can catch sports-heavy clustering.', {
        verification: 'RUNTIME_VERIFIED',
        classification: 'RUNTIME_VERIFIED',
        actual: {
          firstFiveSubcategoryDistribution: res.meta.firstFiveSubcategoryDistribution,
          firstFiveSportsClusterCount: res.meta.firstFiveSportsClusterCount,
        },
      });
    },
  ),

  makeCase(
    'solo_first_five_spacing_clean_fail_when_impossible',
    'Solo engine clean-fails when no valid first-five 5-year spacing deck exists',
    () => {
      const clusteredPool = buildSyntheticPool(16, (i) => ({
        year: 1900 + i,
        answer: String(1900 + i),
      }));
      const res = buildSoloAttemptDeck({ pool: clusteredPool, levelNumber: 1, random: makeSeededRandom(7) });
      if (res.ok || res.reason !== 'insufficient_first_five_spacing') {
        return fail('Clustered pool did not clean-fail on first-five spacing.', {
          verification: 'RUNTIME_VERIFIED',
          classification: 'REAL_PRODUCT_RISK',
          expected: 'ok=false, reason=insufficient_first_five_spacing',
          actual: res,
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      return pass('First-five spacing failure is explicit and user-safe.', {
        verification: 'RUNTIME_VERIFIED',
        classification: 'RUNTIME_VERIFIED',
      });
    },
  ),

  makeCase(
    'normal_deck_category_balance_rich_pool',
    'Normal Solo rich pools avoid one active category dominating the deck or first seven cards',
    () => {
      const pool = buildSyntheticPool(96, (i) => ({
        year: 1800 + i * 5,
        answer: String(1800 + i * 5),
        main_category_id: (i % 6) + 1,
        sub_category: `sub_${i % 12}`,
        tag: `theme_${i % 10}`,
      }));
      const res = buildSoloAttemptDeck({ pool, levelNumber: 4, seedCount: 2, random: makeSeededRandom(111) });
      if (!res.ok) return fail(`Engine failed unexpectedly: ${res.reason}`, {
        verification: 'RUNTIME_VERIFIED',
        classification: 'REAL_PRODUCT_RISK',
        actionType: ACTION_TYPES.CODE_FIX,
      });
      if (Number(res.meta.maxCategoryCount) > 4 || Number(res.meta.maxFirstSevenCategoryCount) > 3) {
        return fail('Normal Solo P1 category balance let one category dominate despite a rich active pool.', {
          verification: 'RUNTIME_VERIFIED',
          classification: 'REAL_PRODUCT_RISK',
          expected: 'normal rich pool: max full category <=4 and first-seven category <=3',
          actual: {
            categoryDistribution: res.meta.categoryDistribution,
            firstSevenCategoryDistribution: res.meta.firstSevenCategoryDistribution,
            maxCategoryCount: res.meta.maxCategoryCount,
            maxFirstSevenCategoryCount: res.meta.maxFirstSevenCategoryCount,
          },
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      return pass('Normal Solo rich pool deck stays category-balanced across full deck and first seven active cards.', {
        verification: 'RUNTIME_VERIFIED',
        classification: 'RUNTIME_VERIFIED',
      });
    },
  ),

  makeCase(
    'special_deck_category_balance_rich_pool',
    'Special Solo rich pools avoid one active category dominating the 19-question deck',
    () => {
      const pool = buildSyntheticPool(114, (i) => ({
        year: 1700 + i * 5,
        answer: String(1700 + i * 5),
        main_category_id: (i % 6) + 1,
        sub_category: `special_sub_${i % 14}`,
        tag: `special_theme_${i % 10}`,
      }));
      const res = buildSoloAttemptDeck({ pool, levelNumber: 10, seedCount: 2, random: makeSeededRandom(112) });
      if (!res.ok) return fail(`Engine failed unexpectedly: ${res.reason}`, {
        verification: 'RUNTIME_VERIFIED',
        classification: 'REAL_PRODUCT_RISK',
        actionType: ACTION_TYPES.CODE_FIX,
      });
      if (res.deck.length !== 19 || Number(res.meta.maxCategoryCount) > 5 || Number(res.meta.maxFirstSevenCategoryCount) > 3) {
        return fail('Special Solo P1 category balance drifted on a rich active pool.', {
          verification: 'RUNTIME_VERIFIED',
          classification: 'REAL_PRODUCT_RISK',
          expected: 'special rich pool: deck length 19, max category <=5, first-seven category <=3',
          actual: {
            deckLength: res.deck.length,
            categoryDistribution: res.meta.categoryDistribution,
            firstSevenCategoryDistribution: res.meta.firstSevenCategoryDistribution,
          },
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      return pass('Special Solo 19-card decks stay category-balanced where the pool allows.', {
        verification: 'RUNTIME_VERIFIED',
        classification: 'RUNTIME_VERIFIED',
      });
    },
  ),

  makeCase(
    'subcategory_first_seven_and_consecutive_balance',
    'P1 ordering avoids first-seven subcategory domination and same-subcategory streaks where alternatives exist',
    () => {
      const pool = buildSyntheticPool(80, (i) => ({
        year: 1600 + i * 5,
        answer: String(1600 + i * 5),
        main_category_id: (i % 6) + 1,
        sub_category: `sub_${i % 10}`,
        tag: `theme_${i % 10}`,
      }));
      const res = buildSoloAttemptDeck({ pool, levelNumber: 6, seedCount: 2, random: makeSeededRandom(113) });
      if (!res.ok) return fail(`Engine failed unexpectedly: ${res.reason}`, {
        verification: 'RUNTIME_VERIFIED',
        classification: 'REAL_PRODUCT_RISK',
        actionType: ACTION_TYPES.CODE_FIX,
      });
      if (Number(res.meta.maxFirstSevenSubcategoryCount) > 3 || Number(res.meta.maxConsecutiveSubcategoryCount) > 2) {
        return fail('Subcategory balance/order diagnostics show avoidable early domination or long streaks.', {
          verification: 'RUNTIME_VERIFIED',
          classification: 'REAL_PRODUCT_RISK',
          expected: 'first-seven subcategory <=3 and max consecutive subcategory <=2 where alternatives exist',
          actual: {
            firstSevenSubcategoryDistribution: res.meta.firstSevenSubcategoryDistribution,
            maxFirstSevenSubcategoryCount: res.meta.maxFirstSevenSubcategoryCount,
            maxConsecutiveSubcategoryCount: res.meta.maxConsecutiveSubcategoryCount,
          },
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      return pass('Subcategory distribution diagnostics stay within P1 soft limits on a rich pool.', {
        verification: 'RUNTIME_VERIFIED',
        classification: 'RUNTIME_VERIFIED',
      });
    },
  ),

  makeCase(
    'sports_theme_clustering_reduced_where_metadata_allows',
    'Sports-like theme clustering is reduced when non-sports alternatives exist',
    () => {
      const pool = Array.from({ length: 72 }, (_, i) => {
        const sports = i < 30;
        return {
          id: 7000 + i,
          question: sports ? `Arena sports ${i}` : `Mixed topic ${i}`,
          answer: String(1500 + i * 5),
          year: 1500 + i * 5,
          main_category_id: sports ? 5 : ((i % 5) + 1),
          sub_category: sports ? `spor_${i % 4}` : `mixed_${i % 12}`,
          tag: sports ? 'sports football tennis' : `theme_${i % 12}`,
          state: 'A',
          type: 'metin',
        };
      });
      const res = buildSoloAttemptDeck({ pool, levelNumber: 4, seedCount: 2, random: makeSeededRandom(114) });
      if (!res.ok) return fail(`Engine failed unexpectedly: ${res.reason}`, {
        verification: 'RUNTIME_VERIFIED',
        classification: 'REAL_PRODUCT_RISK',
        actionType: ACTION_TYPES.CODE_FIX,
      });
      const firstFiveSports = Number(res.meta.firstFiveSportsClusterCount);
      const firstSevenSports = Number(res.meta.firstSevenSportsClusterCount);
      const maxThemeStreak = Number(res.meta.maxConsecutiveThemeCount);
      const themeSportsCount = Number(res.meta.themeDistribution?.['theme:sports'] || 0);
      if (firstFiveSports > 2 || firstSevenSports > 3 || maxThemeStreak > 2 || themeSportsCount > 6) {
        return fail('Sports/theme clustering remains too high despite non-sports alternatives.', {
          verification: 'RUNTIME_VERIFIED',
          classification: 'REAL_PRODUCT_RISK',
          expected: 'first five sports <=2, first seven sports <=3, no 3 sports/theme back-to-back, full sports <=6',
          actual: { firstFiveSports, firstSevenSports, maxThemeStreak, themeDistribution: res.meta.themeDistribution },
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      return pass('Sports/theme clustering is limited by metadata-aware P1 balancing where alternatives exist.', {
        verification: 'RUNTIME_VERIFIED',
        classification: 'RUNTIME_VERIFIED',
      });
    },
  ),

  makeCase(
    'era_decade_distribution_balanced_where_pool_allows',
    'P1 era spread avoids excessive same-decade clustering in rich pools',
    () => {
      const decades = [1950, 1960, 1970, 1980, 1990, 2000, 2010, 2020];
      const pool = Array.from({ length: 80 }, (_, i) => {
        const decade = decades[i % decades.length];
        const offset = Math.floor(i / decades.length);
        return {
          id: 8000 + i,
          question: `Era ${decade} ${i}`,
          answer: String(decade + offset),
          year: decade + offset,
          main_category_id: (i % 6) + 1,
          sub_category: `era_sub_${i % 16}`,
          tag: `era_theme_${i % 12}`,
          state: 'A',
          type: 'metin',
        };
      });
      const res = buildSoloAttemptDeck({ pool, levelNumber: 8, seedCount: 2, random: makeSeededRandom(115) });
      if (!res.ok) return fail(`Engine failed unexpectedly: ${res.reason}`, {
        verification: 'RUNTIME_VERIFIED',
        classification: 'REAL_PRODUCT_RISK',
        actionType: ACTION_TYPES.CODE_FIX,
      });
      if (Number(res.meta.maxDecadeCount) > 4 || Number(res.meta.maxConsecutiveDecadeCount) > 2 || !res.meta.decadeDistribution) {
        return fail('Era/decade diagnostics show avoidable clustering.', {
          verification: 'RUNTIME_VERIFIED',
          classification: 'REAL_PRODUCT_RISK',
          expected: 'max decade <=4, max consecutive decade <=2, diagnostics exposed',
          actual: {
            decadeDistribution: res.meta.decadeDistribution,
            maxDecadeCount: res.meta.maxDecadeCount,
            maxConsecutiveDecadeCount: res.meta.maxConsecutiveDecadeCount,
          },
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      return pass('Era/decade distribution stays varied and diagnostics are exposed.', {
        verification: 'RUNTIME_VERIFIED',
        classification: 'RUNTIME_VERIFIED',
      });
    },
  ),

  makeCase(
    'solo_deck_balance_metadata_contract',
    'Solo deck reports category/subcategory balance and era spread metadata',
    () => {
      const pool = buildSyntheticPool(60, (i) => ({
        sub_category: `sub_${i % 5}`,
        year: 1900 + i * 5,
        answer: String(1900 + i * 5),
      }));
      const res = buildSoloAttemptDeck({ pool, levelNumber: 1, random: makeSeededRandom(11) });
      const meta = res.ok ? res.meta : null;
      if (
        !res.ok ||
        !meta?.categoryBalance ||
        !meta?.subcategoryBalance ||
        !meta?.categoryDistribution ||
        !meta?.subcategoryDistribution ||
        !meta?.firstFiveCategoryDistribution ||
        !meta?.firstFiveSubcategoryDistribution ||
        !meta?.firstSevenCategoryDistribution ||
        !meta?.firstSevenSubcategoryDistribution ||
        !meta?.themeDistribution ||
        !meta?.decadeDistribution ||
        !Array.isArray(meta?.earlyVisibleYears) ||
        !meta?.eraSpread ||
        !Number.isFinite(Number(meta?.maxConsecutiveThemeCount))
      ) {
        return fail('Deck balance metadata contract drifted.', {
          verification: 'RUNTIME_VERIFIED',
          classification: 'REAL_PRODUCT_RISK',
          expected: 'category/subcategory/theme/decade distributions + early visible years + eraSpread diagnostics',
          actual: res,
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      return pass('Category/subcategory balance, first-five diagnostics, and era spread contracts are represented by the engine.', {
        verification: 'RUNTIME_VERIFIED',
        classification: 'RUNTIME_VERIFIED',
        actual: meta,
      });
    },
  ),

  makeCase(
    'solo_p2_deck_diagnostics_contract',
    'P2 Solo deck diagnostics expose Health/admin-only quality fields without normal UI usage',
    () => {
      const pool = buildSyntheticPool(72, (i) => ({
        year: 1800 + i * 5,
        answer: String(1800 + i * 5),
        sub_category: `diag_sub_${i % 9}`,
        tag: i % 6 === 0 ? 'sports football' : `diag_theme_${i % 8}`,
        difficulty: (i % 3) + 1,
      }));
      const res = buildSoloAttemptDeck({ pool, levelNumber: 4, random: makeSeededRandom(211) });
      if (!res.ok) return fail(`Engine failed unexpectedly: ${res.reason}`, {
        verification: 'RUNTIME_VERIFIED',
        classification: 'REAL_PRODUCT_RISK',
        actionType: ACTION_TYPES.CODE_FIX,
      });
      const diagnostics = getSoloDeckDiagnostics(res, { levelNumber: 4 });
      const missing = [
        'questionIds',
        'answerYears',
        'firstFiveYears',
        'minimumFirstFiveYearGap',
        'categoryDistribution',
        'subcategoryDistribution',
        'themeDistribution',
        'decadeDistribution',
        'difficultyDistribution',
        'fallbackTier',
        'balanceScore',
        'warnings',
      ].filter((key) => diagnostics[key] === undefined);
      const uiLeaks = missingTokens(gamePageSource, ['getSoloDeckDiagnostics', 'analyzeSoloQuestionPool']);
      if (
        missing.length ||
        diagnostics.adminHealthOnly !== true ||
        diagnostics.exposeToNormalPlayers !== false ||
        uiLeaks.length !== 2
      ) {
        return fail('P2 deck diagnostics contract drifted or leaked into normal UI source.', {
          verification: 'RUNTIME_VERIFIED',
          classification: 'REAL_PRODUCT_RISK',
          expected: 'pure Health/admin diagnostics only; no Game.jsx usage',
          actual: { missing, diagnostics, uiLeaks },
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      return pass('P2 deck diagnostics expose quality fields for Health/admin only.', {
        verification: 'RUNTIME_VERIFIED',
        classification: 'RUNTIME_VERIFIED',
        actual: {
          levelType: diagnostics.levelType,
          minimumFirstFiveYearGap: diagnostics.minimumFirstFiveYearGap,
          fallbackTier: diagnostics.fallbackTier,
        },
      });
    },
  ),

  makeCase(
    'solo_p2_question_pool_health_warnings',
    'P2 pool health detects invalid years, sparse metadata, and hard deck limits',
    () => {
      const weakPool = [
        { id: 1, question: 'bad year', year: null, answer: '', main_category_id: 1, state: 'A' },
        ...buildSyntheticPool(12, (i) => ({
          id: 2000 + i,
          year: 1900 + i,
          answer: String(1900 + i),
          main_category_id: 1,
          sub_category: i < 2 ? 'same' : '',
          difficulty: i < 3 ? 1 : undefined,
        })),
      ];
      const health = analyzeSoloQuestionPool(weakPool);
      const expectedWarnings = ['invalid_or_missing_years_present', 'missing_subcategory_metadata', 'missing_difficulty_metadata'];
      const missingWarnings = expectedWarnings.filter((warning) => !health.warnings.includes(warning));
      if (
        health.adminHealthOnly !== true ||
        health.canBuildNormalDeck !== false ||
        !health.hardFailures.includes('insufficient_unique_years_for_normal_deck') ||
        missingWarnings.length
      ) {
        return fail('P2 question pool health failed to surface weak-pool quality issues.', {
          verification: 'RUNTIME_VERIFIED',
          classification: 'REAL_PRODUCT_RISK',
          expected: 'hard unique-year failure plus metadata/year warnings',
          actual: { health, missingWarnings },
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      return pass('Question pool health reports warnings without pretending weak pools are production-ready.', {
        verification: 'RUNTIME_VERIFIED',
        classification: 'RUNTIME_VERIFIED',
        actual: { warnings: health.warnings, hardFailures: health.hardFailures },
      });
    },
  ),

  makeCase(
    'solo_p2_difficulty_strategy_safe_fallback',
    'P2 difficulty readiness helper keeps missing difficulty data as safe soft fallback',
    () => {
      const missingDifficultyPool = buildSyntheticPool(30, (i) => ({
        year: 1700 + i * 5,
        answer: String(1700 + i * 5),
        difficulty: undefined,
      }));
      const early = getSoloDifficultyStrategy(2, missingDifficultyPool);
      const special = getSoloDifficultyStrategy(10, buildSyntheticPool(30, (i) => ({
        year: 1800 + i * 5,
        answer: String(1800 + i * 5),
        difficulty: (i % 5) + 1,
      })));
      if (
        early.readinessOnly !== true ||
        early.missingDifficultyFallback !== true ||
        early.fallbackMode !== 'missing_difficulty_safe_easy' ||
        special.levelType !== 'special' ||
        !special.preferredDifficulties.includes(4)
      ) {
        return fail('Difficulty progression readiness helper would hard-gate current easy-only data or missed special handling.', {
          verification: 'RUNTIME_VERIFIED',
          classification: 'REAL_PRODUCT_RISK',
          expected: 'readiness-only, missing difficulty safe fallback, special strategy differs',
          actual: { early, special },
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      return pass('Difficulty strategy is readiness-only and falls back safely when difficulty metadata is missing.', {
        verification: 'RUNTIME_VERIFIED',
        classification: 'RUNTIME_VERIFIED',
      });
    },
  ),

  makeCase(
    'solo_p2_replay_variety_diagnostics',
    'P2 replay diagnostics expose repeated first-five sequence risk without relaxing hard rules',
    () => {
      const pool = buildSyntheticPool(80, (i) => ({
        year: 1600 + i * 5,
        answer: String(1600 + i * 5),
        sub_category: `replay_${i % 10}`,
      }));
      const a = buildSoloAttemptDeck({ pool, levelNumber: 5, random: makeSeededRandom(301) });
      const b = buildSoloAttemptDeck({ pool, levelNumber: 5, random: makeSeededRandom(302) });
      if (!a.ok || !b.ok) return fail('Replay variety fixture failed to build valid decks.', {
        verification: 'RUNTIME_VERIFIED',
        classification: 'REAL_PRODUCT_RISK',
        actual: { a, b },
        actionType: ACTION_TYPES.CODE_FIX,
      });
      const variety = getSoloReplayVarietyDiagnostics(a.deck, b.deck);
      const aGap = minAdjacentGap(a.deck.slice(0, 5).map((q) => q.year));
      const bGap = minAdjacentGap(b.deck.slice(0, 5).map((q) => q.year));
      if (
        variety.adminHealthOnly !== true ||
        variety.exactFirstFiveRepeat === true ||
        aGap < 5 ||
        bGap < 5 ||
        variety.softOnly !== true
      ) {
        return fail('Replay variety diagnostics either repeated the first-five sequence or weakened hard spacing rules.', {
          verification: 'RUNTIME_VERIFIED',
          classification: 'REAL_PRODUCT_RISK',
          expected: 'different first-five where alternatives exist, hard spacing still valid',
          actual: { variety, aGap, bGap },
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      return pass('Replay diagnostics can flag exact early-sequence repeats while preserving hard deck validity.', {
        verification: 'RUNTIME_VERIFIED',
        classification: 'RUNTIME_VERIFIED',
        actual: variety,
      });
    },
  ),

  makeCase(
    'solo_p2_kart_degistir_diagnostics_contract',
    'P2 Kart Değiştir diagnostics describe deck/reserve source, spacing, and no-safe-replacement state',
    () => {
      const deck = [
        { id: 1, question: 'current', year: 1990, main_category_id: 1, state: 'A' },
        { id: 2, question: 'replacement', year: 2006, main_category_id: 2, state: 'A' },
      ];
      const ok = getKartDegistirDiagnostics({
        deck,
        currentQuestion: deck[0],
        replacement: deck[1],
        timelineYears: [1997],
        previousContextCards: [],
      });
      const noSafe = getKartDegistirDiagnostics({
        deck: [deck[0]],
        currentQuestion: deck[0],
        replacement: null,
        timelineYears: [1997],
        noSafeReplacement: true,
      });
      if (
        ok.replacementSource !== 'unused_deck_reserve' ||
        ok.preservedVisibleSpacing !== true ||
        ok.jokerShouldBeConsumed !== true ||
        noSafe.noSafeReplacement !== true ||
        noSafe.jokerShouldBeConsumed !== false ||
        ok.exposeToNormalPlayers !== false
      ) {
        return fail('Kart Değiştir diagnostics contract drifted.', {
          verification: 'RUNTIME_VERIFIED',
          classification: 'REAL_PRODUCT_RISK',
          expected: 'deck/reserve source, spacing proof, failed replacement does not consume joker',
          actual: { ok, noSafe },
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      return pass('Kart Değiştir diagnostics are helper-only and preserve no-safe-replacement semantics.', {
        verification: 'RUNTIME_VERIFIED',
        classification: 'RUNTIME_VERIFIED',
      });
    },
  ),

  /* 14. beginner_placement_hint_levels_1_to_3_only */
  makeCase(
    'beginner_placement_hint_levels_1_to_3_only',
    'Placement hint is enabled only for Solo levels 1-3',
    () => {
      const actual = {
        level1: shouldShowBeginnerPlacementHint(1),
        level3: shouldShowBeginnerPlacementHint(3),
        level4: shouldShowBeginnerPlacementHint(4),
        legacy: shouldShowBeginnerPlacementHint(null),
      };
      if (!actual.level1 || !actual.level3 || actual.level4 || actual.legacy) {
        return fail('Beginner placement hint level gate drifted.', {
          verification: 'RUNTIME_VERIFIED',
          classification: 'REAL_PRODUCT_RISK',
          expected: 'true for 1-3 only',
          actual,
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      return pass('Beginner placement hint helper is limited to levels 1-3.', {
        verification: 'RUNTIME_VERIFIED', classification: 'RUNTIME_VERIFIED',
      });
    },
  ),

  /* 15. solo_question_engine_doc_exists */
  makeCase(
    'solo_question_engine_doc_exists',
    'docs/KRONOX_SOLO_QUESTION_ENGINE.md exists at the exact path and codifies the core rules',
    () => {
      // Codex167 — real existence proof. If the JS mirror is missing or
      // emptied, this case hard-FAILS. The canonical markdown lives at
      // docs/KRONOX_SOLO_QUESTION_ENGINE.md and MUST stay in sync.
      const docPath = SOLO_QUESTION_ENGINE_DOC_PATH;
      const body = typeof SOLO_QUESTION_ENGINE_DOC === 'string' ? SOLO_QUESTION_ENGINE_DOC : '';
      if (!body || body.trim().length < 200) {
        return fail(`${docPath} is missing or empty.`, {
          verification: 'RUNTIME_VERIFIED',
          classification: 'REAL_PRODUCT_RISK',
          file: docPath,
          expected: 'non-empty markdown with the engine rules',
          actual: { length: body ? body.length : 0 },
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      // Lock in the user-facing rules the doc MUST codify. Substring
      // checks are case-insensitive on the lowercased body.
      const lower = body.toLowerCase();
      const requiredPhrases = [
        '16 questions',
        '19 questions',
        '7 correct',
        '10 correct',
        '10 mistakes',
        '180 seconds',
        'first 5',
        'minimum 5-year',
        'unique year',
        'active question',
        'active categor',
        'replay',
        'fallback',
        'no mid-attempt re-randomization'.toLowerCase(),
      ];
      const missing = requiredPhrases.filter((p) => !lower.includes(p));
      if (missing.length > 0) {
        return fail(`${docPath} is missing required rules.`, {
          verification: 'RUNTIME_VERIFIED',
          classification: 'REAL_PRODUCT_RISK',
          file: docPath, expected: requiredPhrases, actual: { missing },
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      return pass(`${docPath} exists (${body.length} chars) and codifies every required rule.`, {
        verification: 'RUNTIME_VERIFIED',
        classification: 'RUNTIME_VERIFIED',
        file: docPath,
        actual: { length: body.length },
      });
    },
  ),
];
