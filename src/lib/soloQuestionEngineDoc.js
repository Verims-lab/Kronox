// Codex167 — Runtime mirror of docs/KRONOX_SOLO_QUESTION_ENGINE.md so the
// Health Center can prove (RUNTIME_VERIFIED) that the engine's product
// contract is actually present in the app bundle, not just on disk.
//
// The canonical human-readable doc lives at:
//   docs/KRONOX_SOLO_QUESTION_ENGINE.md
//
// When you change one, change the other. The Health case
// `solo_question_engine_doc_exists` cross-checks the required rules
// against this string and FAILS if any required rule is missing.
//
// Why a JS mirror?
//   Vite's `?raw` import cannot reach outside of `src/` on this host,
//   so importing the markdown directly from `docs/` is rejected at
//   build time. Mirroring the doc as a JS module keeps the runtime
//   proof while still letting the canonical doc live under `docs/`.

export const SOLO_QUESTION_ENGINE_DOC_PATH = 'docs/KRONOX_SOLO_QUESTION_ENGINE.md';

export const SOLO_QUESTION_ENGINE_DOC = `# Kronox Solo Question Selection Engine

Status: Active product contract (Codex166).
Implementation: src/lib/soloQuestionEngine.js (buildSoloAttemptDeck).
Consumer: src/pages/Game.jsx Solo Level init effect.
Health suite: solo_question_engine_health.

## 1. Purpose
Solo question selection is controlled random, not naive random. Every
Solo attempt opens with a pre-computed deck of exactly 18 questions that
the engine produces once, at attempt start. Gameplay then walks that
deck sequentially. No live API call, no mid-attempt re-randomization,
no chance of running out of distinct years.

## 2. Core rules
- Attempt deck size: 18 questions per attempt.
- Win condition: 10 correct placements.
- Fail condition (mistakes): 8 mistakes.
- Fail condition (time): Solo level total timer expires (time expiry fail).
- Replay creates a new attempt and a new deck.

## 3. Unique year rule (HARD)
- 18 questions must have 18 unique years.
- The same year MUST NOT appear twice.
- Duplicate years are not allowed.
- If fewer than 18 distinct years are available in the active pool,
  the engine returns a clean failure with reason
  'insufficient_unique_years' and message
  'Bu seviye için yeterli sayıda farklı yıla ait soru bulunamadı.'

## 4. Active filtering
- Active questions only. question.state === 'A' is required when the
  field exists. Legacy rows without state are accepted.
- Active categories only. Caller passes allowedMainCategoryIds — a
  whitelist of Category.category_id values where category.status = "a".
- Passive categories excluded. category.status = "p" cannot enter.

## 5. Category balance rules
- perCategoryCap = ceil(deckSize / max(1, N)) + 1.
- Default 18-card deck with 6 active categories = 4 per category.
- Soft cap: relaxed by the fallback ladder when the pool is thin.
- The unique-year rule and deck size are NOT soft.

## 6. Beginner level assist
- Levels 1-3: prefer 8-10 years between neighboring visible answer years.
- Levels 4-7: prefer 5-7 years between neighboring visible answer years.
- Levels 8-10: prefer 3-5 years between neighboring visible answer years.
- Level 11+: normal existing selection behavior.
- The engine prefers the first 10 playable cards to have clearer year
  gaps because the player can win at 10 correct placements.
- If the active pool cannot satisfy the exact target, beginner spacing
  relaxes gracefully and then falls back to the normal unique-year deck.
- Beginner spacing must never fail a level by itself.
- Placement hint is levels 1-3 only: while dragging a Solo card, the
  correct drop zone may softly pulse/glow. This is visual-only and does
  not change hit testing, drag behavior, score, penalty, or placement
  validation. Level 4+ and Online mode must not show this assist.

## 7. Repeat / recently-seen avoidance plan
- Caller may pass recentlySeenQuestionIds (lib/questionHistory or a
  future SoloQuestionHistory entity).
- Engine prefers unseen questions, then relaxes this preference in
  fallback tier 2, but NEVER bypasses the unique-year rule.

## 8. Attempt deck as source of truth
- The attempt deck is created once at start, in the Solo init effect
  inside pages/Game.jsx.
- useGameActions.pickQuestion is fed the deck as its questionPool and
  cannot pull from outside it.
- No mid-attempt re-randomization. Gameplay walks the deck only.
- Replay creates a new deck. Tapping Replay or Sonraki Seviye drops
  the deck and the engine runs again with a fresh attemptId.

## 9. Fallback strategy
- Tier 1: avoid recently-seen + enforce soft category cap.
- Tier 2: allow recently-seen + enforce soft category cap.
- Tier 3: allow recently-seen + no category cap.
- Fail: clean error when fewer than 18 unique years exist.
- The fallback NEVER relaxes deck size, unique question ids, unique
  years, or active question/category gating.

## 10. Determinism
- Engine accepts an optional random function; defaults to Math.random.
- attemptId = solo_{Date.now()}_{base36(random)} so replay always
  produces a fresh attempt id (and a fresh deck).

## 11. Data model / persistence
- Today: runtime state inside pages/Game.jsx
  (soloAttemptDeck, soloAttemptId).
- Future preferred: SoloLevelAttempt + SoloQuestionHistory entities.
  Engine signature is already future-ready.

## 12. Future extensions
- Difficulty weighting using question.difficulty.
- Tags / sub_category preference.
- Month/day chronological key when answer carries month/year — the
  unique-year rule becomes a unique YYYY-MM key.
- Solo map zone themes / zone-based levels via the existing
  allowedMainCategoryIds whitelist.

## 13. What this engine MUST NOT change
- Solo scoring values, star rules, result popup behavior.
- Online scoring / Online deck.
- Unified Kronox Puan (getKronoxVisibleScore).
- Diamond economy.
- Drag/drop placement validation, timeline ordering.
- Question/Category schema beyond reading state and main_category_id.
`;
