// Codex166 — Solo Question Selection Engine.
//
// PURPOSE
//   Replaces the previous "shuffle the whole filtered pool and pick on
//   demand" Solo question selection with a controlled, pre-computed
//   attempt deck of exactly 18 questions per Solo attempt.
//
// CORE RULES (locked in by Health suite solo_question_engine_health):
//   • Deck size               = 18
//   • Win condition           = level-aware placed-card target
//                               (1-10 → 7, 11+ → 10)
//   • Fail condition          = 8 mistakes OR time expired (unchanged)
//   • Unique question IDs     in the same deck
//   • Unique answer/year      in the same deck             (HARD rule)
//   • Active questions only   (state==='A' if field exists)
//   • Active categories only  — caller supplies the active category id
//                               whitelist (numeric main_category_id +
//                               optional legacy string `category`)
//   • Soft category balance   — at most ⌈18 / max(1,activeCount)⌉ + 1
//                               questions from the same active category
//                               when the pool is rich enough.
//   • Recently-seen aware     — prefers questions the user has not
//                               recently played, but never relaxes the
//                               unique-year rule to do so.
//
// FALLBACK ORDER (allowed → forbidden):
//   1. Ideal pool: active, year-window, unique-year, category-balanced,
//      not recently seen.
//   2. Relax recently-seen.
//   3. Relax category balance.
//   4. CLEAN FAIL — return { ok:false, reason:'insufficient_unique_years',
//      message:'Bu seviye için yeterli sayıda farklı yıla ait soru
//      bulunamadı.' }. Caller MUST surface this; do not start the level.
//
// Never relax:
//   • deck size 18
//   • unique question IDs
//   • unique answer/years
//   • active question / active category gating
//
// REPLAY
//   A fresh attempt id (timestamped + random) gives a fresh deck. Replay
//   from the Solo result popup re-mounts Game with a new attempt and
//   therefore a new deck.

const DEFAULT_DECK_SIZE = 18;
const BEGINNER_SPACING_TARGET_COUNT = 10;

export function getBeginnerYearSpacingForLevel(levelNumber) {
  const level = Math.trunc(Number(levelNumber) || 0);
  if (level >= 1 && level <= 3) {
    return { idealGap: 10, minGap: 8, targetCount: BEGINNER_SPACING_TARGET_COUNT };
  }
  if (level >= 4 && level <= 7) {
    return { idealGap: 7, minGap: 5, targetCount: BEGINNER_SPACING_TARGET_COUNT };
  }
  if (level >= 8 && level <= 10) {
    return { idealGap: 5, minGap: 3, targetCount: BEGINNER_SPACING_TARGET_COUNT };
  }
  return null;
}

export function shouldShowBeginnerPlacementHint(levelNumber) {
  const level = Math.trunc(Number(levelNumber) || 0);
  return level >= 1 && level <= 3;
}

// Deterministic-capable shuffler. If `random` is omitted, falls back to
// Math.random so existing callers stay non-deterministic.
function fisherYatesShuffle(items, random = Math.random) {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function normalizeRecentIds(recentIds) {
  if (!recentIds) return new Set();
  if (recentIds instanceof Set) return recentIds;
  if (Array.isArray(recentIds)) return new Set(recentIds);
  return new Set();
}

function normalizeAllowedCategoryIds(allowedMainCategoryIds) {
  if (!allowedMainCategoryIds) return null;
  if (allowedMainCategoryIds instanceof Set) return allowedMainCategoryIds;
  if (Array.isArray(allowedMainCategoryIds)) return new Set(allowedMainCategoryIds);
  return null;
}

// Question is considered "active" only when explicitly NOT passive. The
// field is optional today: missing `state` is treated as active for
// backward compatibility with existing rows, but state==='P' is always
// excluded (Codex158 contract).
function isActiveQuestion(question) {
  if (!question) return false;
  const state = question.state;
  if (state === undefined || state === null || state === '') return true;
  return String(state).toUpperCase() === 'A';
}

// Categories: caller supplies an active main_category_id whitelist (the
// engine does NOT consult Category.status itself — that responsibility
// stays with the data layer that builds the whitelist).
function isInAllowedCategory(question, allowedMainCategoryIds) {
  if (!allowedMainCategoryIds || allowedMainCategoryIds.size === 0) return true;
  const mid = Number(question?.main_category_id);
  if (Number.isFinite(mid)) return allowedMainCategoryIds.has(mid);
  // Backward compat: rows without numeric main_category_id are accepted
  // only when the caller doesn't enforce a strict whitelist — but we are
  // here, so reject. The caller should backfill main_category_id during
  // its data layer.
  return false;
}

// Year normalization is data-layer's job (questionRuntimeAdapter parses
// year out of the answer when missing). The engine only requires a
// finite integer year here.
function hasUsableYear(question) {
  const y = Number(question?.year);
  return Number.isFinite(y);
}

// Question text + id sanity.
function hasUsableContent(question) {
  if (!question || question.id === undefined || question.id === null) return false;
  if (typeof question.question !== 'string') return false;
  return question.question.trim().length > 0;
}

// Pure filter: returns the subset of `pool` that survives every HARD
// gate. Unique-year deduplication happens later inside the selector.
function filterCandidatePool(pool, allowedMainCategoryIds) {
  return (pool || []).filter((q) =>
    hasUsableContent(q)
    && hasUsableYear(q)
    && isActiveQuestion(q)
    && isInAllowedCategory(q, allowedMainCategoryIds),
  );
}

// Group candidates by year so we can guarantee unique years by picking
// at most one from each bucket. We keep all rows per year so soft
// category balance can still pick the most balancing card.
function groupByYear(candidates) {
  const buckets = new Map();
  for (const q of candidates) {
    const y = Number(q.year);
    if (!buckets.has(y)) buckets.set(y, []);
    buckets.get(y).push(q);
  }
  return buckets;
}

function isSpacedFromAll(year, selectedYears, minGap) {
  return selectedYears.every((selectedYear) => Math.abs(Number(selectedYear) - Number(year)) >= minGap);
}

function orderYearsForBeginnerSpacing(years, levelNumber) {
  const spacing = getBeginnerYearSpacingForLevel(levelNumber);
  if (!spacing || years.length === 0) return years;

  const targetCount = Math.min(spacing.targetCount, years.length);
  for (let gap = spacing.idealGap; gap >= spacing.minGap; gap -= 1) {
    const priorityYears = [];
    const prioritySet = new Set();

    for (const year of years) {
      if (priorityYears.length >= targetCount) break;
      if (!Number.isFinite(Number(year))) continue;
      if (!isSpacedFromAll(year, priorityYears, gap)) continue;
      priorityYears.push(year);
      prioritySet.add(year);
    }

    if (priorityYears.length >= targetCount) {
      return [
        ...priorityYears,
        ...years.filter((year) => !prioritySet.has(year)),
      ];
    }
  }

  return years;
}

function orderDeckForBeginnerSpacing(deck, levelNumber, random) {
  const spacing = getBeginnerYearSpacingForLevel(levelNumber);
  const shuffled = fisherYatesShuffle(deck, random);
  if (!spacing || shuffled.length === 0) return shuffled;

  const targetCount = Math.min(spacing.targetCount, shuffled.length);
  for (let gap = spacing.idealGap; gap >= spacing.minGap; gap -= 1) {
    const front = [];
    const frontIds = new Set();

    for (const question of shuffled) {
      const year = Number(question?.year);
      if (front.length >= targetCount) break;
      if (!Number.isFinite(year)) continue;
      if (!isSpacedFromAll(year, front.map((q) => Number(q.year)), gap)) continue;
      front.push(question);
      frontIds.add(question.id);
    }

    if (front.length >= targetCount) {
      const rest = shuffled.filter((question) => !frontIds.has(question.id));
      return [...front, ...fisherYatesShuffle(rest, random)];
    }
  }

  return shuffled;
}

// Pick one question per year, optionally preferring non-recently-seen
// and balancing categories.
//
// Strategy: walk years in shuffled order. From each year-bucket pick the
// best candidate using a tiered preference:
//   tier A — not in recentIds AND in an under-quota category
//   tier B — not in recentIds
//   tier C — first available
// Soft cap: at most `perCategoryCap` cards from the same numeric
// main_category_id when alternatives exist.
function selectUniqueYearDeck({
  candidates,
  deckSize,
  recentIds,
  random,
  perCategoryCap,
  levelNumber,
}) {
  const buckets = groupByYear(candidates);
  if (buckets.size < deckSize) return null; // not enough distinct years

  const years = orderYearsForBeginnerSpacing(
    fisherYatesShuffle(Array.from(buckets.keys()), random),
    levelNumber,
  );
  const deck = [];
  const usedIds = new Set();
  const categoryCounts = new Map();

  for (const year of years) {
    if (deck.length >= deckSize) break;
    const bucket = buckets.get(year).filter((q) => !usedIds.has(q.id));
    if (bucket.length === 0) continue;
    const shuffled = fisherYatesShuffle(bucket, random);

    // Tier A: not recently seen + under category cap
    let pick = shuffled.find((q) => {
      if (recentIds.has(q.id)) return false;
      const cid = Number(q.main_category_id);
      const count = Number.isFinite(cid) ? (categoryCounts.get(cid) || 0) : 0;
      return count < perCategoryCap;
    });
    // Tier B: not recently seen (any category)
    if (!pick) pick = shuffled.find((q) => !recentIds.has(q.id));
    // Tier C: anything
    if (!pick) pick = shuffled[0];
    if (!pick) continue;

    deck.push(pick);
    usedIds.add(pick.id);
    const cid = Number(pick.main_category_id);
    if (Number.isFinite(cid)) categoryCounts.set(cid, (categoryCounts.get(cid) || 0) + 1);
  }

  return deck.length === deckSize ? deck : null;
}

/**
 * buildSoloAttemptDeck — Public entry point.
 *
 * @param {Object} args
 * @param {Array}  args.pool                  Normalized question pool
 *                                            (questionRuntimeAdapter shape).
 * @param {Iterable<number>=} args.allowedMainCategoryIds
 *                                            Numeric main_category_id
 *                                            whitelist (active categories).
 *                                            Omit / empty → no category gate.
 * @param {Iterable<string|number>=} args.recentlySeenQuestionIds
 *                                            Question ids the user has
 *                                            recently seen (cross-attempt).
 * @param {number=} args.deckSize             Defaults to 18. Engine does
 *                                            not relax this; passed in
 *                                            only for tests.
 * @param {Function=} args.random             Random source (0..1). Defaults
 *                                            to Math.random.
 * @param {number=} args.levelNumber          Solo level number. Levels 1-10
 *                                            apply a soft beginner spacing
 *                                            preference; level 11+ unchanged.
 *
 * @returns {{ ok:true, deck:Array, attemptId:string, meta:Object }
 *         | { ok:false, reason:string, message:string, meta:Object }}
 *   On success, `deck` contains exactly `deckSize` questions with unique
 *   ids AND unique years, all from active categories (per the caller's
 *   whitelist) and active questions. On failure, `message` is a Turkish
 *   user-safe string the UI may render directly.
 */
export function buildSoloAttemptDeck(args = {}) {
  const deckSize = Number.isFinite(args.deckSize) ? Math.trunc(args.deckSize) : DEFAULT_DECK_SIZE;
  const random = typeof args.random === 'function' ? args.random : Math.random;
  const allowedCats = normalizeAllowedCategoryIds(args.allowedMainCategoryIds);
  const recentIds = normalizeRecentIds(args.recentlySeenQuestionIds);

  const candidates = filterCandidatePool(args.pool, allowedCats);
  const distinctYears = new Set(candidates.map((q) => Number(q.year))).size;

  // Soft category balance cap. When the active category whitelist has N
  // categories, cap any single category at ⌈deckSize/N⌉ + 1 so deck
  // distribution stays diverse without becoming impossible on small pools.
  const activeCount = allowedCats ? Math.max(1, allowedCats.size) : 1;
  const perCategoryCap = Math.max(1, Math.ceil(deckSize / activeCount) + 1);

  // Tier 1 — ideal: respects recently-seen AND category balance.
  let deck = selectUniqueYearDeck({
    candidates,
    deckSize,
    recentIds,
    random,
    perCategoryCap,
    levelNumber: args.levelNumber,
  });

  // Tier 2 — relax recently-seen.
  if (!deck) {
    deck = selectUniqueYearDeck({
      candidates, deckSize,
      recentIds: new Set(),
      random,
      perCategoryCap,
      levelNumber: args.levelNumber,
    });
  }

  // Tier 3 — relax category balance.
  if (!deck) {
    deck = selectUniqueYearDeck({
      candidates, deckSize,
      recentIds: new Set(),
      random,
      perCategoryCap: deckSize, // effectively no cap
      levelNumber: args.levelNumber,
    });
  }

  if (!deck) {
    return {
      ok: false,
      reason: 'insufficient_unique_years',
      message: 'Bu seviye için yeterli sayıda farklı yıla ait soru bulunamadı.',
      meta: { candidateCount: candidates.length, distinctYears, deckSize },
    };
  }

  // Final order: level 11+ keeps the old full shuffle. Beginner levels keep
  // the same 18 unique years but prefer the first 10 playable cards to be
  // easier to place on the timeline by spacing their answer years apart.
  const beginnerSpacing = getBeginnerYearSpacingForLevel(args.levelNumber);
  const finalDeck = orderDeckForBeginnerSpacing(deck, args.levelNumber, random);
  return {
    ok: true,
    deck: finalDeck,
    attemptId: `solo_${Date.now()}_${Math.floor(random() * 1e9).toString(36)}`,
    meta: {
      candidateCount: candidates.length,
      distinctYears,
      deckSize,
      categoriesUsed: new Set(
        finalDeck
          .map((q) => Number(q?.main_category_id))
          .filter((n) => Number.isFinite(n)),
      ).size,
      beginnerYearSpacing: beginnerSpacing
        ? {
          levelNumber: Math.trunc(Number(args.levelNumber) || 0),
          idealGap: beginnerSpacing.idealGap,
          minGap: beginnerSpacing.minGap,
          targetCount: beginnerSpacing.targetCount,
          relaxedWhenNeeded: true,
        }
        : null,
    },
  };
}

// Internal exports for the Health suite — kept on the named export
// surface so tests can call them without re-implementing rules.
export const __soloEngineInternals = {
  filterCandidatePool,
  isActiveQuestion,
  isInAllowedCategory,
  hasUsableYear,
  hasUsableContent,
  getBeginnerYearSpacingForLevel,
  shouldShowBeginnerPlacementHint,
  DEFAULT_DECK_SIZE,
};
