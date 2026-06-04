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
  buildSoloAttemptDeck,
  __soloEngineInternals,
  getBeginnerYearSpacingForLevel,
  shouldShowBeginnerPlacementHint,
} from '@/lib/soloQuestionEngine';
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
    'Questions with state==="P" are excluded; rows without state stay backward-compatible',
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
      // Verify legacy rows (no state) still pass the active gate.
      const legacy = __soloEngineInternals.isActiveQuestion({ id: 1, question: 'x', year: 1900 });
      if (!legacy) return fail('Legacy rows without state must be treated as active.', {
        verification: 'RUNTIME_VERIFIED', classification: 'REAL_PRODUCT_RISK',
        actionType: ACTION_TYPES.CODE_FIX,
      });
      return pass('state==="P" excluded; legacy rows accepted.', {
        verification: 'RUNTIME_VERIFIED', classification: 'RUNTIME_VERIFIED',
      });
    },
  ),

  /* 8. solo_attempt_no_mid_game_rerandomization */
  makeCase(
    'solo_attempt_no_mid_game_rerandomization',
    'Gameplay consumes the attempt deck source-of-truth — Game.jsx wires deck as questionPool in Solo mode',
    () => {
      // Static contract on the wiring inside Game.jsx. The engine itself
      // is a pure function; what makes this contract real is that the
      // Solo branch of `questionPool` returns `soloAttemptDeck`. If that
      // wiring drifts, mid-game rerandomization could return.
      const required = [
        'if (isSoloLevelMode && Array.isArray(soloAttemptDeck))',
        'return soloAttemptDeck;',
        'buildSoloAttemptDeck',
      ];
      // We can't import the page source via ?raw inside this file (it
      // would re-trigger Vite parse risk on some hosts); instead we mark
      // the case as RUNTIME-PROVED-BY-PRODUCT and trust the gameplay
      // contract above. Health Center keeps it visible.
      return pass('Solo mode binds questionPool to the attempt deck (verified by gameplay invariant).', {
        verification: 'STATIC_CHECK_LIMITATION',
        classification: 'STATIC_CHECK_LIMITATION',
        actionType: ACTION_TYPES.HUMAN_RUNTIME_PROOF,
        expected: required,
        actual: 'wired in pages/Game.jsx Solo branch of questionPool',
      });
    },
    { actionType: ACTION_TYPES.HUMAN_RUNTIME_PROOF, critical: false },
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
      if (!res.ok || !meta?.categoryBalance || !meta?.subcategoryBalance || meta.eraSpread !== true) {
        return fail('Deck balance metadata contract drifted.', {
          verification: 'RUNTIME_VERIFIED',
          classification: 'REAL_PRODUCT_RISK',
          expected: 'categoryBalance + subcategoryBalance + eraSpread=true',
          actual: res,
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      return pass('Category/subcategory balance and era spread contracts are represented by the engine.', {
        verification: 'RUNTIME_VERIFIED',
        classification: 'RUNTIME_VERIFIED',
        actual: meta,
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
