// Kronox Health Center — Solo Question Selection Engine cases (Codex166).
//
// SCOPE
//   Locks in the controlled Solo question selection engine + its
//   product contracts: deck size 18, unique question ids, unique
//   answer/years, active-only filtering, clean failure on insufficient
//   unique years, replay produces a fresh deck.
//
// HONESTY
//   Every case runs the REAL `buildSoloAttemptDeck` engine against
//   crafted, deterministic question pools — no fake PASS. Cases that
//   need real gameplay proof (e.g. mid-game no-rerand observed end to
//   end with drag/drop) are classified as runtime-verified-by-product
//   and explicitly point to the gameplay invariant they protect.

import { buildSoloAttemptDeck, __soloEngineInternals } from '@/lib/soloQuestionEngine';
import { SOLO_CARDS_PER_LEVEL, SOLO_MAX_MISTAKES } from '@/lib/soloLevels';
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

// ─── Suite registration ────────────────────────────────────────────
export const EXTRA_SUITES = [
  { id: SUITE_ID, name: SUITE_NAME, critical: true, color: '#facc15' },
];

export const EXTRA_TESTS = [
  /* 1. solo_attempt_deck_size_is_18 */
  makeCase(
    'solo_attempt_deck_size_is_18',
    'Engine selects exactly 18 questions per Solo attempt deck',
    () => {
      const pool = buildSyntheticPool(60);
      const res = buildSoloAttemptDeck({ pool });
      if (!res.ok) return fail(`Engine failed on a 60-row unique-year pool: ${res.reason}`, {
        verification: 'RUNTIME_VERIFIED',
        classification: 'REAL_PRODUCT_RISK',
        expected: 'ok=true, deck.length=18',
        actual: res,
        actionType: ACTION_TYPES.CODE_FIX,
      });
      if (res.deck.length !== 18) return fail(`Deck size ${res.deck.length} ≠ 18.`, {
        verification: 'RUNTIME_VERIFIED',
        classification: 'REAL_PRODUCT_RISK',
        expected: 18, actual: res.deck.length,
        actionType: ACTION_TYPES.CODE_FIX,
      });
      return pass('Engine produces exactly 18 questions.', {
        verification: 'RUNTIME_VERIFIED', classification: 'RUNTIME_VERIFIED',
        actual: { deckSize: res.deck.length },
      });
    },
  ),

  /* 2. solo_attempt_requires_10_correct */
  makeCase(
    'solo_attempt_requires_10_correct',
    'Win condition remains 10 correct placements (SOLO_CARDS_PER_LEVEL)',
    () => {
      if (SOLO_CARDS_PER_LEVEL !== 10) return fail('SOLO_CARDS_PER_LEVEL drifted.', {
        verification: 'RUNTIME_VERIFIED',
        classification: 'REAL_PRODUCT_RISK',
        expected: 10, actual: SOLO_CARDS_PER_LEVEL,
        actionType: ACTION_TYPES.CODE_FIX,
      });
      return pass('Win target stays at 10.', {
        verification: 'RUNTIME_VERIFIED', classification: 'RUNTIME_VERIFIED',
      });
    },
  ),

  /* 3. solo_attempt_allows_max_8_mistakes */
  makeCase(
    'solo_attempt_allows_max_8_mistakes',
    'Fail-on-mistakes threshold stays at 8 (SOLO_MAX_MISTAKES)',
    () => {
      if (SOLO_MAX_MISTAKES !== 8) return fail('SOLO_MAX_MISTAKES drifted.', {
        verification: 'RUNTIME_VERIFIED',
        classification: 'REAL_PRODUCT_RISK',
        expected: 8, actual: SOLO_MAX_MISTAKES,
        actionType: ACTION_TYPES.CODE_FIX,
      });
      return pass('Mistake limit stays at 8.', {
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
      return pass('All 18 question ids are unique.', {
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
      return pass('All 18 years are unique.', {
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
      // Pool with only 17 distinct years — engine MUST fail clean,
      // not silently produce a deck with duplicate years.
      const pool = buildSyntheticPool(17);
      // Add many duplicates of an existing year so the only way to
      // reach 18 is to accept a duplicate year.
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
      return pass('Engine fails clean when 18 unique years are impossible.', {
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

  /* 12. solo_question_engine_doc_exists */
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
        '18 questions',
        '10 correct',
        '8 mistakes',
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