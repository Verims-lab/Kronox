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
  getSoloCategoryPreferenceTargetCounts,
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
import useOfflineQuestionsSource from '../../hooks/useOfflineQuestions.js?raw';
import useGameActionsSource from '../../hooks/useGameActions.js?raw';
import questionHistorySource from '../../lib/questionHistory.js?raw';
import userCategoryPreferenceHelperSource from '../../lib/userCategoryPreferences.js?raw';
import getQuestionsFunctionSource from '../../../base44/functions/getQuestions/entry.ts?raw';
import onlineGameStartSource from '../../lib/onlineGameStart.js?raw';

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

function distributionShare(distribution, key) {
  const total = Object.values(distribution || {}).reduce((sum, value) => sum + (Number(value) || 0), 0);
  if (!total) return 0;
  return (Number(distribution?.[key]) || 0) / total;
}

function countKeysWithValue(distribution, minValue = 1) {
  return Object.values(distribution || {}).filter((value) => Number(value) >= minValue).length;
}

function sumDistribution(distribution) {
  return Object.values(distribution || {}).reduce((sum, value) => sum + (Number(value) || 0), 0);
}

function countSelectedCategoryCards(deck = [], selectedCategoryIds = []) {
  const selected = new Set(selectedCategoryIds.map((value) => String(Math.trunc(Number(value)))));
  return (deck || []).filter((question) => {
    const id = Number(question?.main_category_id ?? question?.category_id ?? question?.categoryId);
    return Number.isFinite(id) && selected.has(String(Math.trunc(id)));
  }).length;
}

function getGlobalCategoryCards(deck = [], selectedCategoryIds = []) {
  const selected = new Set(selectedCategoryIds.map((value) => String(Math.trunc(Number(value)))));
  return (deck || []).filter((question) => {
    const id = Number(question?.main_category_id ?? question?.category_id ?? question?.categoryId);
    return !Number.isFinite(id) || !selected.has(String(Math.trunc(id)));
  });
}

function countDifficultyOneCards(deck = []) {
  return (deck || []).filter((question) => Number(question?.difficulty ?? question?.Difficulty) === 1).length;
}

function incrementMapCount(map, key, amount = 1) {
  const normalized = String(key || 'unknown');
  map.set(normalized, (map.get(normalized) || 0) + amount);
}

function getMapShare(map, key) {
  const total = Array.from(map.values()).reduce((sum, value) => sum + (Number(value) || 0), 0);
  if (!total) return 0;
  return (Number(map.get(key)) || 0) / total;
}

function getDistributionKeyCount(map) {
  return Array.from(map.values()).filter((value) => Number(value) > 0).length;
}

function buildP3RepresentativePool() {
  return Array.from({ length: 240 }, (_, i) => {
    const categoryId = i < 96 ? 1 : i < 156 ? 2 : i < 204 ? 3 : i < 228 ? 4 : 5;
    const subCategory = i < 80 ? 'hobbies_like_fixture' : `p3_sub_${i % 24}`;
    const tag = i < 80 ? 'culture hobby archive' : `p3_theme_${i % 18}`;
    return {
      id: 10000 + i,
      question: `P3 fairness fixture ${i}`,
      answer: String(1000 + i * 5),
      year: 1000 + i * 5,
      main_category_id: categoryId,
      sub_category: subCategory,
      tag,
      difficulty: (i % 5) + 1,
      state: 'A',
      type: 'metin',
    };
  });
}

function runP3RepeatedDeckSimulation({ builds = 100 } = {}) {
  const pool = buildP3RepresentativePool();
  const exposureStats = {};
  const recentIds = [];
  const selectedQuestionCounts = new Map();
  const selectedCategoryCounts = new Map();
  const selectedSubcategoryCounts = new Map();
  const selectedYearBandCounts = new Map();
  const poolCategoryCounts = new Map();
  const poolSubcategoryCounts = new Map();
  const poolYearBandCounts = new Map();
  const failures = [];
  const firstFiveGapViolations = [];
  const exposureMetaSamples = [];
  const now = Date.now();

  for (const question of pool) {
    incrementMapCount(poolCategoryCounts, __soloEngineInternals.getCategoryKey(question));
    incrementMapCount(poolSubcategoryCounts, __soloEngineInternals.getSubcategoryKey(question));
    incrementMapCount(poolYearBandCounts, __soloEngineInternals.getYearBandKey(question));
  }

  for (let index = 0; index < builds; index += 1) {
    const result = buildSoloAttemptDeck({
      pool,
      levelNumber: (index % 9) + 1,
      seedCount: 2,
      recentlySeenQuestionIds: recentIds,
      questionExposureStats: exposureStats,
      random: makeSeededRandom(700 + index),
    });

    if (!result.ok) {
      failures.push({ index, result });
      continue;
    }

    const firstFiveYears = result.deck.slice(0, 5).map((question) => Number(question.year));
    const gap = minAdjacentGap(firstFiveYears);
    if (gap < 5) firstFiveGapViolations.push({ index, firstFiveYears, gap });
    if (result.meta?.exposureFairness) exposureMetaSamples.push(result.meta.exposureFairness);

    for (const question of result.deck) {
      const id = String(question.id);
      incrementMapCount(selectedQuestionCounts, id);
      incrementMapCount(selectedCategoryCounts, __soloEngineInternals.getCategoryKey(question));
      incrementMapCount(selectedSubcategoryCounts, __soloEngineInternals.getSubcategoryKey(question));
      incrementMapCount(selectedYearBandCounts, __soloEngineInternals.getYearBandKey(question));
      exposureStats[id] = {
        shownCount: (Number(exposureStats[id]?.shownCount) || 0) + 1,
        lastShownAt: now - index * 1000,
        source: 'health_fixture',
      };
      recentIds.unshift(id);
    }
    if (recentIds.length > 320) recentIds.length = 320;
  }

  const selectedCounts = Array.from(selectedQuestionCounts.values());
  return {
    pool,
    builds,
    failures,
    firstFiveGapViolations,
    uniqueQuestionsSelected: selectedQuestionCounts.size,
    topQuestionSelectionCount: Math.max(0, ...selectedCounts),
    totalSelected: selectedCounts.reduce((sum, value) => sum + value, 0),
    selectedQuestionCounts,
    selectedCategoryCounts,
    selectedSubcategoryCounts,
    selectedYearBandCounts,
    poolCategoryCounts,
    poolSubcategoryCounts,
    poolYearBandCounts,
    exposureMetaSamples,
  };
}

const p3RepeatedDeckSimulationCache = new Map();

function getP3RepeatedDeckSimulation(builds = 100) {
  if (!p3RepeatedDeckSimulationCache.has(builds)) {
    p3RepeatedDeckSimulationCache.set(builds, runP3RepeatedDeckSimulation({ builds }));
  }
  return p3RepeatedDeckSimulationCache.get(builds);
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
        random: makeSeededRandom(231),
      });
      const validStringWhitelist = buildSoloAttemptDeck({
        pool,
        levelNumber: 1,
        allowedMainCategoryIds: ['1', '2', '3', '4', '5', '6'],
        requireActiveCategoryWhitelist: true,
        random: makeSeededRandom(231),
      });
      if (
        missingWhitelist.ok ||
        missingWhitelist.reason !== 'missing_active_category_whitelist' ||
        !validWhitelist.ok ||
        !validStringWhitelist.ok
      ) {
        return fail('Active-category whitelist enforcement drifted.', {
          verification: 'RUNTIME_VERIFIED',
          classification: 'REAL_PRODUCT_RISK',
          expected: 'missing whitelist fails clean; valid numeric/string whitelist builds',
          actual: {
            missingWhitelist,
            validWhitelistOk: validWhitelist.ok,
            validStringWhitelistOk: validStringWhitelist.ok,
          },
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
        !meta?.yearBandDistribution ||
        !Array.isArray(meta?.earlyVisibleYears) ||
        !meta?.eraSpread ||
        !meta?.diversityFairness ||
        meta?.diversityFairness?.poolProportional !== true ||
        meta?.diversityFairness?.equalCountBalancing !== false ||
        !Number.isFinite(Number(meta?.maxConsecutiveThemeCount))
      ) {
        return fail('Deck balance metadata contract drifted.', {
          verification: 'RUNTIME_VERIFIED',
          classification: 'REAL_PRODUCT_RISK',
          expected: 'category/subcategory/theme/decade/year-band distributions + early visible years + pool-proportional diagnostics',
          actual: res,
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      return pass('Category/subcategory balance, first-five diagnostics, and proportional era spread contracts are represented by the engine.', {
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
        'yearBandDistribution',
        'difficultyDistribution',
        'diversityFairness',
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
    'solo_p1_exposure_cooldown_prefers_low_shown_candidates',
    'P1 exposure cooldown downweights high/recent shown cards without breaking deck rules',
    () => {
      const pool = buildSyntheticPool(80, (i) => ({
        year: 1500 + i * 5,
        answer: String(1500 + i * 5),
        sub_category: `exposure_sub_${i % 12}`,
        tag: `exposure_theme_${i % 9}`,
      }));
      const highExposureIds = new Set(pool.slice(0, 48).map((question) => String(question.id)));
      const now = Date.now();
      const questionExposureStats = Object.fromEntries(
        Array.from(highExposureIds).map((id, index) => [id, {
          shownCount: 12,
          lastShownAt: now - index * 1000,
          recentRank: index,
          source: 'health_fixture',
        }]),
      );
      const res = buildSoloAttemptDeck({
        pool,
        levelNumber: 4,
        seedCount: 2,
        recentlySeenQuestionIds: Array.from(highExposureIds),
        questionExposureStats,
        random: makeSeededRandom(401),
      });
      if (!res.ok) return fail(`Engine failed unexpectedly: ${res.reason}`, {
        verification: 'RUNTIME_VERIFIED',
        classification: 'REAL_PRODUCT_RISK',
        actual: res,
        actionType: ACTION_TYPES.CODE_FIX,
      });
      const selectedHighExposureCount = res.deck.filter((question) => highExposureIds.has(String(question.id))).length;
      const firstFiveGap = minAdjacentGap(res.deck.slice(0, 5).map((question) => question.year));
      const exposureMeta = res.meta?.exposureFairness || {};
      if (
        res.deck.length !== 16 ||
        firstFiveGap < 5 ||
        selectedHighExposureCount > 2 ||
        exposureMeta.softCooldownOnly !== true ||
        exposureMeta.localRecentHistoryUsed !== true ||
        exposureMeta.selectedRecentHistoryHitCount !== selectedHighExposureCount
      ) {
        return fail('Exposure cooldown did not prefer lower-exposure alternatives or drifted hard deck rules.', {
          verification: 'RUNTIME_VERIFIED',
          classification: 'REAL_PRODUCT_RISK',
          expected: '16-card deck, first-five gap >= 5, high/recent shown cards strongly downweighted',
          actual: {
            deckLength: res.deck.length,
            selectedHighExposureCount,
            firstFiveGap,
            exposureMeta,
            selectedIds: res.deck.map((question) => question.id),
          },
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      return pass('Exposure-aware scoring prefers never/low-shown cards while preserving Solo deck rules.', {
        verification: 'RUNTIME_VERIFIED',
        classification: 'RUNTIME_VERIFIED',
        actual: { selectedHighExposureCount, firstFiveGap, exposureMeta },
      });
    },
  ),

  makeCase(
    'solo_p1_local_history_stats_feed_runtime',
    'P1 local recent history stores count/recency stats and feeds Solo deck cooldown before attempt start',
    () => {
      const missing = missingTokens(`${questionHistorySource}\n${gamePageSource}`, [
        'MAX_RECENT_IDS = 320',
        'MAX_HISTORY_EVENTS = 900',
        'loadRecentQuestionExposureStats',
        'shownCount',
        'lastShownAt',
        'softCooldownOnly: true',
        'questionExposureStats: loadRecentQuestionExposureStats()',
      ]);
      if (missing.length) {
        return fail('Local exposure history no longer provides the P1 cooldown stats expected by Solo runtime.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          files: ['src/lib/questionHistory.js', 'src/pages/Game.jsx'],
          missing,
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      return pass('Solo runtime has timestamp/count-aware local history for soft pre-attempt exposure cooldown.', {
        verification: 'STATIC_CONTRACT',
        classification: 'RUNTIME_VERIFIED',
      });
    },
  ),

  makeCase(
    'solo_p2_category_distribution_tracks_pool_proportions',
    'P2 category balancing tracks eligible-pool proportions instead of equal category counts',
    () => {
      const pool = buildSyntheticPool(100, (i) => ({
        year: 1200 + i * 5,
        answer: String(1200 + i * 5),
        main_category_id: i < 50 ? 1 : i < 75 ? 2 : i < 90 ? 3 : 4,
        sub_category: `cat_prop_sub_${i % 14}`,
        tag: `cat_prop_theme_${i % 10}`,
      }));
      const res = buildSoloAttemptDeck({ pool, levelNumber: 6, seedCount: 2, random: makeSeededRandom(501) });
      if (!res.ok) return fail(`Engine failed unexpectedly: ${res.reason}`, {
        verification: 'RUNTIME_VERIFIED',
        classification: 'REAL_PRODUCT_RISK',
        actual: res,
        actionType: ACTION_TYPES.CODE_FIX,
      });
      const categoryDistribution = res.meta.categoryDistribution || {};
      const cat1Share = distributionShare(categoryDistribution, 'cat:1');
      const cat4Count = Number(categoryDistribution['cat:4'] || 0);
      const diversityMeta = res.meta.diversityFairness || {};
      if (
        res.deck.length !== 16 ||
        categoryDistribution['cat:1'] < 6 ||
        categoryDistribution['cat:1'] > 10 ||
        cat1Share < 0.35 ||
        cat4Count < 1 ||
        diversityMeta.poolProportional !== true ||
        diversityMeta.equalCountBalancing !== false
      ) {
        return fail('P2 category balancing drifted from pool-proportional fairness.', {
          verification: 'RUNTIME_VERIFIED',
          classification: 'REAL_PRODUCT_RISK',
          expected: '50/25/15/10 pool produces a 16-card deck that keeps cat:1 largest without forcing equal category counts',
          actual: { categoryDistribution, cat1Share, cat4Count, diversityMeta },
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      return pass('Category selection remains pool-proportional and explicitly avoids equal-count balancing.', {
        verification: 'RUNTIME_VERIFIED',
        classification: 'RUNTIME_VERIFIED',
        actual: { categoryDistribution, diversityStrategy: diversityMeta.strategy },
      });
    },
  ),

  makeCase(
    'solo_p2_subcategory_dominance_reduced_without_hard_ban',
    'P2 subcategory balancing reduces dominance relative to eligible-pool share without hardcoding labels',
    () => {
      const pool = buildSyntheticPool(90, (i) => ({
        year: 1300 + i * 5,
        answer: String(1300 + i * 5),
        main_category_id: (i % 6) + 1,
        sub_category: i < 45 ? 'large_valid_subcategory' : `alt_valid_subcategory_${i % 9}`,
        tag: `sub_prop_theme_${i % 8}`,
      }));
      const res = buildSoloAttemptDeck({ pool, levelNumber: 7, seedCount: 2, random: makeSeededRandom(502) });
      if (!res.ok) return fail(`Engine failed unexpectedly: ${res.reason}`, {
        verification: 'RUNTIME_VERIFIED',
        classification: 'REAL_PRODUCT_RISK',
        actual: res,
        actionType: ACTION_TYPES.CODE_FIX,
      });
      const subcategoryDistribution = res.meta.subcategoryDistribution || {};
      const largeCount = Number(subcategoryDistribution.large_valid_subcategory || 0);
      if (
        res.deck.length !== 16 ||
        largeCount < 5 ||
        largeCount > 10 ||
        countKeysWithValue(subcategoryDistribution, 1) < 4 ||
        res.meta.diversityFairness?.poolProportional !== true
      ) {
        return fail('P2 subcategory proportionality either over-penalized the large group or allowed avoidable dominance.', {
          verification: 'RUNTIME_VERIFIED',
          classification: 'REAL_PRODUCT_RISK',
          expected: 'large 50% subcategory remains represented but does not consume almost the whole deck',
          actual: { subcategoryDistribution, largeCount, diversityMeta: res.meta.diversityFairness },
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      return pass('Subcategory concentration is reduced generically without banning any observed label.', {
        verification: 'RUNTIME_VERIFIED',
        classification: 'RUNTIME_VERIFIED',
        actual: { subcategoryDistribution, largeCount },
      });
    },
  ),

  makeCase(
    'solo_p2_year_band_distribution_not_starved',
    'P2 year-band balancing avoids starving major eras when valid alternatives exist',
    () => {
      const bands = [
        { start: 1700, count: 40 },
        { start: 1800, count: 30 },
        { start: 1900, count: 20 },
        { start: 2000, count: 10 },
      ];
      const pool = bands.flatMap((band, bandIndex) => Array.from({ length: band.count }, (_, i) => ({
        id: 9000 + bandIndex * 100 + i,
        question: `Band ${band.start} ${i}`,
        answer: String(band.start + i),
        year: band.start + i,
        main_category_id: (i % 6) + 1,
        sub_category: `year_band_sub_${(i + bandIndex) % 12}`,
        tag: `year_band_theme_${(i + bandIndex) % 9}`,
        state: 'A',
        type: 'metin',
      })));
      const res = buildSoloAttemptDeck({ pool, levelNumber: 8, seedCount: 2, random: makeSeededRandom(503) });
      if (!res.ok) return fail(`Engine failed unexpectedly: ${res.reason}`, {
        verification: 'RUNTIME_VERIFIED',
        classification: 'REAL_PRODUCT_RISK',
        actual: res,
        actionType: ACTION_TYPES.CODE_FIX,
      });
      const yearBandDistribution = res.meta.yearBandDistribution || {};
      const majorBandsRepresented = ['year_band:1700-1749', 'year_band:1800-1849', 'year_band:1900-1949']
        .every((key) => Number(yearBandDistribution[key] || 0) >= 1);
      if (
        res.deck.length !== 16 ||
        !majorBandsRepresented ||
        Number(res.meta.maxYearBandCount) > 9 ||
        res.meta.eraSpread?.poolProportional !== true
      ) {
        return fail('P2 year-band balance starved a major era or over-clustered one band.', {
          verification: 'RUNTIME_VERIFIED',
          classification: 'REAL_PRODUCT_RISK',
          expected: 'major year bands represented, max year band <=9, 16-card deck preserved',
          actual: { yearBandDistribution, maxYearBandCount: res.meta.maxYearBandCount, eraSpread: res.meta.eraSpread },
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      return pass('Year-band distribution remains varied without weakening first-five spacing.', {
        verification: 'RUNTIME_VERIFIED',
        classification: 'RUNTIME_VERIFIED',
        actual: { yearBandDistribution, firstFiveYears: res.deck.slice(0, 5).map((question) => question.year) },
      });
    },
  ),

  makeCase(
    'solo_p2_missing_subcategory_safe_and_non_dominating',
    'P2 missing subcategory metadata is safe and does not dominate when valid metadata alternatives exist',
    () => {
      const pool = buildSyntheticPool(80, (i) => ({
        year: 1400 + i * 5,
        answer: String(1400 + i * 5),
        main_category_id: (i % 6) + 1,
        sub_category: i < 40 ? '' : `known_sub_${i % 10}`,
        tag: `missing_sub_theme_${i % 8}`,
      }));
      const res = buildSoloAttemptDeck({ pool, levelNumber: 5, seedCount: 2, random: makeSeededRandom(504) });
      if (!res.ok) return fail(`Engine failed unexpectedly: ${res.reason}`, {
        verification: 'RUNTIME_VERIFIED',
        classification: 'REAL_PRODUCT_RISK',
        actual: res,
        actionType: ACTION_TYPES.CODE_FIX,
      });
      const unknownCount = Number(res.meta.subcategoryDistribution?.['sub:unknown'] || 0);
      if (
        res.deck.length !== 16 ||
        unknownCount > 10 ||
        countKeysWithValue(res.meta.subcategoryDistribution, 1) < 4
      ) {
        return fail('Missing subcategory metadata became unsafe or over-dominant.', {
          verification: 'RUNTIME_VERIFIED',
          classification: 'REAL_PRODUCT_RISK',
          expected: 'missing subcategory tolerated as soft metadata, not a crash or deck monopoly',
          actual: { subcategoryDistribution: res.meta.subcategoryDistribution, unknownCount },
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      return pass('Missing subcategory rows are safe and remain softly balanced with known alternatives.', {
        verification: 'RUNTIME_VERIFIED',
        classification: 'RUNTIME_VERIFIED',
        actual: { subcategoryDistribution: res.meta.subcategoryDistribution, unknownCount },
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

  makeCase(
    'solo_p3_repeated_100_decks_unique_coverage',
    'P3 repeated Solo deck builds cover a broad question set with cooldown active',
    () => {
      const simulation = getP3RepeatedDeckSimulation(100);
      if (
        simulation.failures.length ||
        simulation.firstFiveGapViolations.length ||
        simulation.uniqueQuestionsSelected < 140 ||
        simulation.topQuestionSelectionCount > 18 ||
        simulation.totalSelected !== 1600
      ) {
        return fail('Repeated deck diversity guardrail detected narrow coverage or hard-rule drift.', {
          verification: 'RUNTIME_VERIFIED',
          classification: 'REAL_PRODUCT_RISK',
          expected: '100 normal decks build 1600 cards, cover >=140 unique questions, top question <=18, first-five gap holds',
          actual: {
            failures: simulation.failures.slice(0, 3),
            firstFiveGapViolations: simulation.firstFiveGapViolations.slice(0, 3),
            uniqueQuestionsSelected: simulation.uniqueQuestionsSelected,
            topQuestionSelectionCount: simulation.topQuestionSelectionCount,
            totalSelected: simulation.totalSelected,
          },
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      return pass('Repeated Solo deck builds exercise broad unique-question coverage while preserving first-five spacing.', {
        verification: 'RUNTIME_VERIFIED',
        classification: 'RUNTIME_VERIFIED',
        actual: {
          uniqueQuestionsSelected: simulation.uniqueQuestionsSelected,
          topQuestionSelectionCount: simulation.topQuestionSelectionCount,
        },
      });
    },
  ),

  makeCase(
    'solo_p3_exposure_cooldown_rotation_guardrail',
    'P3 cooldown/rotation downweights recently selected cards across repeated decks',
    () => {
      const simulation = getP3RepeatedDeckSimulation(100);
      const samples = simulation.exposureMetaSamples;
      const lastSample = samples[samples.length - 1] || {};
      const selectedRecentHits = Number(lastSample.selectedRecentHistoryHitCount) || 0;
      const candidateRecentHits = Number(lastSample.recentHistoryHitCount) || 0;
      const eligibleCandidateCount = Number(lastSample.eligibleCandidateCount) || 0;
      const selectedDeckSize = Array.isArray(lastSample.selectedDeckIds) ? lastSample.selectedDeckIds.length : 16;
      const nonRecentCandidateCount = Math.max(0, eligibleCandidateCount - candidateRecentHits);
      const minimumRecentNeeded = Math.max(0, selectedDeckSize - nonRecentCandidateCount);
      const selectedRecentRatio = Number(lastSample.selectedRecentHistoryRatio) || 0;
      const candidateRecentRatio = Number(lastSample.candidateRecentHistoryRatio) || 0;
      const ratioImprovement = Number(lastSample.recentHistorySelectionImprovement) || 0;
      const selectedAverageShownCount = Number(lastSample.selectedAverageShownCount) || 0;
      const candidateAverageShownCount = Number(lastSample.candidateAverageShownCount) || 0;
      if (
        samples.length < 100 ||
        lastSample.softCooldownOnly !== true ||
        lastSample.localRecentHistoryUsed !== true ||
        selectedRecentHits > minimumRecentNeeded + 2 ||
        selectedRecentRatio >= candidateRecentRatio - 0.18 ||
        ratioImprovement < 0.18 ||
        selectedAverageShownCount > candidateAverageShownCount ||
        Number(lastSample.cooldownPenaltyAppliedCount) <= 0 ||
        Number(lastSample.neverShownCandidateCount) < 0
      ) {
        return fail('Exposure cooldown metadata no longer proves soft rotation across attempts.', {
          verification: 'RUNTIME_VERIFIED',
          classification: 'REAL_PRODUCT_RISK',
          expected: 'every build exposes soft cooldown metadata; selected recent ratio and average shown count are meaningfully below the candidate pool when alternatives exist',
          actual: {
            sampleCount: samples.length,
            minimumRecentNeeded,
            selectedRecentHits,
            selectedRecentRatio,
            candidateRecentRatio,
            ratioImprovement,
            selectedAverageShownCount,
            candidateAverageShownCount,
            lastSample,
          },
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      return pass('Repeated deck simulation uses local recent history and exposure stats as soft rotation, not hard exclusion.', {
        verification: 'RUNTIME_VERIFIED',
        classification: 'RUNTIME_VERIFIED',
        actual: {
          sampleCount: samples.length,
          selectedRecentHits,
          minimumRecentNeeded,
          selectedRecentRatio,
          candidateRecentRatio,
          ratioImprovement,
          selectedAverageShownCount,
          candidateAverageShownCount,
          highExposurePenaltyAppliedCount: lastSample.highExposurePenaltyAppliedCount,
        },
      });
    },
  ),

  makeCase(
    'solo_p3_pool_proportional_concentration_warning_fixture',
    'P3 concentration fixture detects over-dominance without enforcing equal category counts',
    () => {
      const simulation = getP3RepeatedDeckSimulation(100);
      const poolCat1Share = getMapShare(simulation.poolCategoryCounts, 'cat:1');
      const selectedCat1Share = getMapShare(simulation.selectedCategoryCounts, 'cat:1');
      const poolHobbiesShare = getMapShare(simulation.poolSubcategoryCounts, 'hobbies_like_fixture');
      const selectedHobbiesShare = getMapShare(simulation.selectedSubcategoryCounts, 'hobbies_like_fixture');
      const selectedYearBands = getDistributionKeyCount(simulation.selectedYearBandCounts);
      const poolYearBands = getDistributionKeyCount(simulation.poolYearBandCounts);
      const selectedTotal = sumDistribution(Object.fromEntries(simulation.selectedCategoryCounts));

      if (
        selectedTotal !== simulation.totalSelected ||
        selectedCat1Share < 0.25 ||
        selectedCat1Share > poolCat1Share + 0.2 ||
        selectedHobbiesShare > poolHobbiesShare + 0.18 ||
        selectedYearBands < Math.min(14, Math.floor(poolYearBands * 0.55))
      ) {
        return fail('Pool-proportional concentration guardrail drifted toward equal-count or over-dominant selection.', {
          verification: 'RUNTIME_VERIFIED',
          classification: 'REAL_PRODUCT_RISK',
          expected: 'largest category remains largest but not excessively above pool share; dominant subcategory stays near pool share; major year bands represented',
          actual: {
            poolCat1Share,
            selectedCat1Share,
            poolHobbiesShare,
            selectedHobbiesShare,
            selectedYearBands,
            poolYearBands,
            selectedTotal,
          },
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      return pass('P3 fixture catches category/subcategory/year-band concentration while preserving pool-proportional, non-equal-count fairness.', {
        verification: 'RUNTIME_VERIFIED',
        classification: 'RUNTIME_VERIFIED',
        actual: {
          poolCat1Share,
          selectedCat1Share,
          poolHobbiesShare,
          selectedHobbiesShare,
          selectedYearBands,
          poolYearBands,
        },
      });
    },
  ),

  makeCase(
    'solo_p3_kart_degistir_reserve_uses_exposure_aware_deck_order',
    'P3 Kart Değiştir reserve inherits exposure/diversity-aware deck ordering',
    () => {
      const pool = buildP3RepresentativePool();
      const highExposureIds = pool.slice(0, 120).map((question) => String(question.id));
      const questionExposureStats = Object.fromEntries(highExposureIds.map((id, index) => [id, {
        shownCount: 20,
        lastShownAt: Date.now() - index * 1000,
        recentRank: index,
        source: 'health_fixture',
      }]));
      const result = buildSoloAttemptDeck({
        pool,
        levelNumber: 6,
        seedCount: 2,
        recentlySeenQuestionIds: highExposureIds,
        questionExposureStats,
        random: makeSeededRandom(1301),
      });
      if (!result.ok) return fail(`Engine failed unexpectedly: ${result.reason}`, {
        verification: 'RUNTIME_VERIFIED',
        classification: 'REAL_PRODUCT_RISK',
        actual: result,
        actionType: ACTION_TYPES.CODE_FIX,
      });

      const highExposureSet = new Set(highExposureIds);
      const selectedHighExposureCount = result.deck.filter((question) => highExposureSet.has(String(question.id))).length;
      const currentQuestion = result.deck[0];
      const replacement = getOrderedSoloDeckQuestion(result.deck, new Set([currentQuestion.id]), new Set(), {
        skippedQuestionIds: new Set([currentQuestion.id]),
        excludeQuestionIds: [currentQuestion.id],
        requireVisibleYearSpacing: false,
      });
      const diagnostics = getKartDegistirDiagnostics({
        deck: result.deck,
        currentQuestion,
        replacement,
        timelineYears: [],
        previousContextCards: result.deck.slice(0, 2),
      });

      if (
        selectedHighExposureCount > 3 ||
        !replacement ||
        highExposureSet.has(String(replacement.id)) ||
        diagnostics.replacementSource !== 'unused_deck_reserve' ||
        result.meta.exposureFairness?.softCooldownOnly !== true ||
        result.meta.diversityFairness?.poolProportional !== true
      ) {
        return fail('Kart Değiştir reserve can regress to high-exposure or non-diversity-aware ordering.', {
          verification: 'RUNTIME_VERIFIED',
          classification: 'REAL_PRODUCT_RISK',
          expected: 'prebuilt deck/reserve mostly avoids high-exposure half and replacement comes from unused deck reserve',
          actual: {
            selectedHighExposureCount,
            replacementId: replacement?.id,
            diagnostics,
            exposureFairness: result.meta.exposureFairness,
            diversityFairness: result.meta.diversityFairness,
          },
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      return pass('Kart Değiştir reserve consumes the same prebuilt exposure/diversity-aware deck order without mid-attempt fetch.', {
        verification: 'RUNTIME_VERIFIED',
        classification: 'RUNTIME_VERIFIED',
        actual: {
          selectedHighExposureCount,
          replacementId: replacement.id,
          replacementSource: diagnostics.replacementSource,
        },
      });
    },
  ),

  makeCase(
    'solo_category_preference_target_counts_70_30',
    'Solo category preferences target 70% selected categories and 30% global pool',
    () => {
      const selectedCategoryIds = [1, 2, 3];
      const pool = buildSyntheticPool(180, (i) => ({
        main_category_id: i < 120 ? selectedCategoryIds[i % selectedCategoryIds.length] : ((i % 3) + 4),
        sub_category: `pref_sub_${i % 18}`,
        tag: `pref_theme_${i % 12}`,
        difficulty: i < 120 ? ((i % 4) + 2) : (i % 2 === 0 ? 1 : '1'),
      }));
      const normalTargets = getSoloCategoryPreferenceTargetCounts(16);
      const specialTargets = getSoloCategoryPreferenceTargetCounts(19);
      const normal = buildSoloAttemptDeck({
        pool,
        levelNumber: 4,
        seedCount: 2,
        userSelectedCategoryIds: selectedCategoryIds,
        userCategoryPreferenceAvailable: true,
        random: makeSeededRandom(2501),
      });
      const special = buildSoloAttemptDeck({
        pool,
        levelNumber: 10,
        seedCount: 2,
        userSelectedCategoryIds: selectedCategoryIds,
        userCategoryPreferenceAvailable: true,
        random: makeSeededRandom(2502),
      });
      if (!normal.ok || !special.ok) {
        return fail('Preference-aware Solo deck failed on a rich eligible pool.', {
          verification: 'RUNTIME_VERIFIED',
          classification: 'REAL_PRODUCT_RISK',
          actual: { normal, special },
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }

      const normalMeta = normal.meta?.categoryPreferenceFairness || {};
      const specialMeta = special.meta?.categoryPreferenceFairness || {};
      const normalSelectedCount = countSelectedCategoryCards(normal.deck, selectedCategoryIds);
      const specialSelectedCount = countSelectedCategoryCards(special.deck, selectedCategoryIds);
      const normalGlobalCards = getGlobalCategoryCards(normal.deck, selectedCategoryIds);
      const specialGlobalCards = getGlobalCategoryCards(special.deck, selectedCategoryIds);
      const normalGlobalDifficultyOneCount = countDifficultyOneCards(normalGlobalCards);
      const specialGlobalDifficultyOneCount = countDifficultyOneCards(specialGlobalCards);
      const normalSelectedDifficultyOneCount = countDifficultyOneCards(
        normal.deck.filter((question) => !normalGlobalCards.includes(question)),
      );
      const firstFiveGap = minAdjacentGap(normal.deck.slice(0, 5).map((question) => question.year));
      const actual = {
        normalTargets,
        specialTargets,
        normalSelectedCount,
        specialSelectedCount,
        normalGlobalDifficultyOneCount,
        specialGlobalDifficultyOneCount,
        normalSelectedDifficultyOneCount,
        normalMeta,
        specialMeta,
        firstFiveGap,
      };

      if (
        normalTargets.selectedCategoryTargetCount !== 11 ||
        normalTargets.globalTargetCount !== 5 ||
        specialTargets.selectedCategoryTargetCount !== 13 ||
        specialTargets.globalTargetCount !== 6 ||
        normal.deck.length !== 16 ||
        special.deck.length !== 19 ||
        normalSelectedCount !== 11 ||
        specialSelectedCount !== 13 ||
        normalGlobalCards.length !== 5 ||
        specialGlobalCards.length !== 6 ||
        normalGlobalDifficultyOneCount !== 5 ||
        specialGlobalDifficultyOneCount !== 6 ||
        normalSelectedDifficultyOneCount !== 0 ||
        normalMeta.globalDifficultyTarget !== 1 ||
        specialMeta.globalDifficultyTarget !== 1 ||
        normalMeta.globalDifficultyRuleAppliesOnlyToGlobal30 !== true ||
        normalMeta.selectedCategoryDifficultyUnrestricted !== true ||
        normalMeta.preferenceRatioTarget !== '70/30' ||
        specialMeta.preferenceRatioTarget !== '70/30' ||
        normalMeta.hardFilterToSelectedCategories !== false ||
        firstFiveGap < 5
      ) {
        return fail('Solo category preference target counts or hard-rule compatibility drifted.', {
          verification: 'RUNTIME_VERIFIED',
          classification: 'REAL_PRODUCT_RISK',
          expected: 'normal 11/5 and special 13/6; global cards difficulty 1 while selected-category lane is not difficulty-1 restricted',
          actual,
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      return pass('Solo builds rich-pool normal/special decks with selected-category target unchanged and global slots difficulty 1.', {
        verification: 'RUNTIME_VERIFIED',
        classification: 'RUNTIME_VERIFIED',
        actual,
      });
    },
  ),

  makeCase(
    'solo_category_preference_shortage_fills_from_global_pool',
    'Selected-category shortage fills from global pool instead of failing',
    () => {
      const selectedCategoryIds = [1, 2, 3];
      const selectedPool = buildSyntheticPool(6, (i) => ({
        id: 9000 + i,
        year: 1900 + i * 11,
        answer: String(1900 + i * 11),
        main_category_id: selectedCategoryIds[i % selectedCategoryIds.length],
      }));
      const globalPool = buildSyntheticPool(80, (i) => ({
        id: 9100 + i,
        year: 2000 + i * 7,
        answer: String(2000 + i * 7),
        main_category_id: (i % 3) + 4,
      }));
      const result = buildSoloAttemptDeck({
        pool: [...selectedPool, ...globalPool],
        levelNumber: 5,
        seedCount: 2,
        userSelectedCategoryIds: selectedCategoryIds,
        userCategoryPreferenceAvailable: true,
        random: makeSeededRandom(2503),
      });
      if (!result.ok) {
        return fail('Selected-category shortage caused Solo deck failure instead of global fill.', {
          verification: 'RUNTIME_VERIFIED',
          classification: 'REAL_PRODUCT_RISK',
          actual: result,
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      const meta = result.meta?.categoryPreferenceFairness || {};
      const selectedCount = countSelectedCategoryCards(result.deck, selectedCategoryIds);
      if (
        result.deck.length !== 16 ||
        selectedCount > selectedPool.length ||
        meta.fallbackUsed !== true ||
        !String(meta.fallbackReason || '').includes('selected_category_shortage')
      ) {
        return fail('Selected-category shortage fallback is not clearly global-pool backed.', {
          verification: 'RUNTIME_VERIFIED',
          classification: 'REAL_PRODUCT_RISK',
          expected: 'ok 16-card deck, selected count capped by available preferred years, fallback reason visible',
          actual: { selectedCount, meta },
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      return pass('Solo fills missing selected-category quota from the full eligible pool without deck failure.', {
        verification: 'RUNTIME_VERIFIED',
        classification: 'RUNTIME_VERIFIED',
        actual: { selectedCount, meta },
      });
    },
  ),

  makeCase(
    'solo_global_pool_difficulty_one_shortage_falls_back_safely',
    'Global 30% prefers difficulty 1 and falls back when difficulty-1 global candidates are insufficient',
    () => {
      const selectedCategoryIds = [1, 2, 3];
      const pool = buildSyntheticPool(180, (i) => {
        const selectedLane = i < 120;
        const globalIndex = i - 120;
        return {
          main_category_id: selectedLane ? selectedCategoryIds[i % selectedCategoryIds.length] : ((i % 3) + 4),
          sub_category: `global_difficulty_sub_${i % 20}`,
          tag: `global_difficulty_theme_${i % 12}`,
          difficulty: selectedLane ? ((i % 4) + 2) : (globalIndex < 2 ? 1 : 3),
        };
      });
      const result = buildSoloAttemptDeck({
        pool,
        levelNumber: 4,
        seedCount: 2,
        userSelectedCategoryIds: selectedCategoryIds,
        userCategoryPreferenceAvailable: true,
        random: makeSeededRandom(2505),
      });
      if (!result.ok) {
        return fail('Difficulty-1 global shortage caused Solo deck failure.', {
          verification: 'RUNTIME_VERIFIED',
          classification: 'REAL_PRODUCT_RISK',
          actual: result,
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      const meta = result.meta?.categoryPreferenceFairness || {};
      const globalCards = getGlobalCategoryCards(result.deck, selectedCategoryIds);
      const globalDifficultyOneCount = countDifficultyOneCards(globalCards);
      const selectedDifficultyOneCount = countDifficultyOneCards(
        result.deck.filter((question) => !globalCards.includes(question)),
      );
      if (
        result.deck.length !== 16 ||
        countSelectedCategoryCards(result.deck, selectedCategoryIds) !== 11 ||
        globalCards.length !== 5 ||
        globalDifficultyOneCount !== 2 ||
        selectedDifficultyOneCount !== 0 ||
        meta.globalDifficulty1TargetCount !== 2 ||
        meta.globalDifficulty1ActualCount !== 2 ||
        meta.globalFallbackUsed !== true ||
        meta.globalFallbackReason !== 'insufficient_global_difficulty_1_candidates' ||
        meta.globalPoolHardFilteredToSelectedCategories !== false
      ) {
        return fail('Global difficulty-1 fallback metadata or deck composition drifted.', {
          verification: 'RUNTIME_VERIFIED',
          classification: 'REAL_PRODUCT_RISK',
          expected: '16-card deck, 11 selected, 5 global, 2 available difficulty-1 global cards used, then safe broader global fallback',
          actual: {
            globalDifficultyOneCount,
            selectedDifficultyOneCount,
            globalCards: globalCards.map((question) => ({ id: question.id, difficulty: question.difficulty, category: question.main_category_id })),
            meta,
          },
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      return pass('Insufficient difficulty-1 global candidates use available difficulty-1 cards, then fill safely from the broader global pool.', {
        verification: 'RUNTIME_VERIFIED',
        classification: 'RUNTIME_VERIFIED',
        actual: {
          globalDifficultyOneCount,
          globalFallbackReason: meta.globalFallbackReason,
          globalDifficultyDistribution: meta.globalDifficultyDistribution,
        },
      });
    },
  ),

  makeCase(
    'solo_category_preference_unavailable_safe_global_fallback',
    'Missing/unavailable preferences fall back to global Solo selection safely',
    () => {
      const pool = buildSyntheticPool(90, (i) => ({
        sub_category: `global_sub_${i % 15}`,
        tag: `global_theme_${i % 9}`,
      }));
      const result = buildSoloAttemptDeck({
        pool,
        levelNumber: 6,
        seedCount: 2,
        userSelectedCategoryIds: [],
        userCategoryPreferenceAvailable: false,
        userCategoryPreferenceFallbackReason: 'preference_load_failed',
        random: makeSeededRandom(2504),
      });
      const meta = result.meta?.categoryPreferenceFairness || {};
      if (!result.ok || result.deck.length !== 16 || meta.fallbackUsed !== true || meta.fallbackReason !== 'preference_load_failed') {
        return fail('Unavailable Category preferences no longer fall back to existing global Solo selection.', {
          verification: 'RUNTIME_VERIFIED',
          classification: 'REAL_PRODUCT_RISK',
          actual: { result, meta },
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      return pass('Preference load failure keeps Solo playable through global selection and diagnostic fallback metadata.', {
        verification: 'RUNTIME_VERIFIED',
        classification: 'RUNTIME_VERIFIED',
        actual: { deckSize: result.deck.length, meta },
      });
    },
  ),

  makeCase(
    'solo_empty_category_preferences_use_all_active_categories',
    'Guest or no saved Category preferences use all active categories for Solo',
    () => {
      const pool = buildSyntheticPool(96, (i) => ({
        main_category_id: (i % 6) + 1,
        sub_category: `all_cat_sub_${i % 16}`,
        tag: `all_cat_theme_${i % 8}`,
      }));
      const result = buildSoloAttemptDeck({
        pool,
        allowedMainCategoryIds: [1, 2, 3, 4, 5, 6],
        requireActiveCategoryWhitelist: true,
        levelNumber: 4,
        seedCount: 2,
        userSelectedCategoryIds: [],
        userCategoryPreferenceAvailable: false,
        userCategoryPreferenceFallbackReason: 'no_valid_user_category_preferences',
        random: makeSeededRandom(3130),
      });
      const meta = result.meta?.categoryPreferenceFairness || {};
      const categories = new Set((result.deck || []).map((question) => question.main_category_id));
      if (
        !result.ok ||
        result.deck.length !== 16 ||
        categories.size < 4 ||
        meta.fallbackUsed !== true ||
        meta.fallbackReason !== 'no_valid_user_category_preferences' ||
        meta.hardFilterToSelectedCategories !== false
      ) {
        return fail('No/empty Category preferences may still be acting as an empty Solo filter instead of all active categories.', {
          verification: 'RUNTIME_VERIFIED',
          classification: 'REAL_PRODUCT_RISK',
          actual: {
            ok: result.ok,
            deckSize: result.deck?.length || 0,
            categories: Array.from(categories),
            meta,
          },
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      return pass('Empty or unavailable Category preferences keep Solo playable with the full active category pool.', {
        verification: 'RUNTIME_VERIFIED',
        classification: 'RUNTIME_VERIFIED',
        actual: {
          deckSize: result.deck.length,
          categoryCount: categories.size,
          fallbackReason: meta.fallbackReason,
        },
      });
    },
  ),

  makeCase(
    'solo_guest_fetch_and_preference_fallback_runtime_wiring',
    'Guest fetch and no-preference fallback are wired without a login gate',
    () => {
      const gameMissing = missingTokens(gamePageSource, [
        "fallbackReason: 'missing_authenticated_user'",
        'resolveGameplayCategoryPreferenceFilter(preferences, activeCategories)',
        'userCategoryPreferenceAvailable: soloCategoryPreferenceState.available === true',
        'no saved Category preferences means all active',
      ]);
      const fetchMissing = missingTokens(useOfflineQuestionsSource, [
        'guest_question_fetch_uses_public_minimal_projection',
        "base44.functions.invoke('getQuestions'",
        'Direct Question.list fallback remains removed',
      ]);
      const helperMissing = missingTokens(userCategoryPreferenceHelperSource, [
        'guestNoAuthUsesAllActiveCategories: true',
        'noSavedPreferencesUsesAllActiveCategories: true',
        'emptyPreferencesAreNotOfflineNoCache: true',
        'saveValidationSeparateFromGameplayStart: true',
        'resolveGameplayCategoryPreferenceFilter',
      ]);
      const forbidden = [
        ...['AUTH_SESSION_UNAVAILABLE', 'Auth session unavailable while loading questions.']
          .filter((token) => useOfflineQuestionsSource.includes(token)),
      ];
      if (gameMissing.length || fetchMissing.length || helperMissing.length || forbidden.length) {
        return fail('Guest/no-preference Solo loading may still require login or map empty preferences to load failure.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          files: [
            'src/pages/Game.jsx',
            'src/hooks/useOfflineQuestions.js',
            'src/lib/userCategoryPreferences.js',
          ],
          actual: { gameMissing, fetchMissing, helperMissing, forbidden },
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      return pass('Guest Solo fetch uses the public-safe projection, and no saved preferences fall back to all active categories.', {
        verification: 'STATIC_CONTRACT',
        classification: 'STATIC_CHECK_LIMITATION',
      });
    },
  ),

  makeCase(
    'solo_category_preference_runtime_wiring_and_boundaries',
    'Solo reads current-user Category preferences while Online/getQuestions remain unchanged',
    () => {
      const gameMissing = missingTokens(gamePageSource, [
        'loadActiveCategories',
        'loadUserCategoryPreferences(currentUser)',
        'getValidActiveSelectedCategoryIds(preferences, activeCategories)',
        "status: 'loading'",
        "status: 'unavailable'",
        'userSelectedCategoryIds: soloCategoryPreferenceState.selectedCategoryIds',
        'userCategoryPreferenceAvailable: soloCategoryPreferenceState.available === true',
        'userCategoryPreferenceFallbackReason: soloCategoryPreferenceState.fallbackReason',
      ]);
      const helperMissing = missingTokens(userCategoryPreferenceHelperSource, [
        '{ user_email: userEmail }',
        'filter(isActiveCategory)',
        'filter(isActiveCategoryPreference)',
      ]);
      const getQuestionsMissing = missingTokens(getQuestionsFunctionSource, [
        'FALLBACK_ACTIVE_CATEGORY_IDS',
        'return id > 0 ? id : null',
        "Category.list('category_id', 50)",
        'filter(isActiveCategory).map(getCategoryId).filter(isKnownCategoryId)',
      ]);
      const forbidden = [
        ...['UserCategoryPreference', 'loadUserCategoryPreferences', 'userSelectedCategoryIds']
          .filter((token) => getQuestionsFunctionSource.includes(token)),
        ...['UserCategoryPreference', 'loadUserCategoryPreferences', 'userSelectedCategoryIds']
          .filter((token) => onlineGameStartSource.includes(token)),
        ...[
          'KNOWN_CATEGORY_IDS',
          'KNOWN_CATEGORY_IDS.includes(id)',
          'const KNOWN_CATEGORY_IDS = [1, 2, 3, 4, 5, 6]',
        ].filter((token) => getQuestionsFunctionSource.includes(token)),
      ];

      if (gameMissing.length || helperMissing.length || getQuestionsMissing.length || forbidden.length) {
        return fail('Solo Category preference wiring or Online/getQuestions boundary drifted.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          files: [
            'src/pages/Game.jsx',
            'src/lib/userCategoryPreferences.js',
            'base44/functions/getQuestions/entry.ts',
            'src/lib/onlineGameStart.js',
          ],
          actual: { gameMissing, helperMissing, getQuestionsMissing, forbidden },
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      return pass('Game waits for preference readiness when signed in, uses all active categories when unavailable/empty, and Online/getQuestions do not read preference rows.', {
        verification: 'STATIC_CONTRACT',
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
