// Codex166/Codex180 — Solo Question Selection Engine.
//
// PURPOSE
//   Replaces the previous "shuffle the whole filtered pool and pick on
//   demand" Solo question selection with a controlled, pre-computed
//   attempt deck of level-aware size per Solo attempt.
//
// CORE RULES (locked in by Health suite solo_question_engine_health):
//   • Deck size               = normal 16, special 19
//   • Win condition           = normal 7 correct cards; special 10
//   • Special levels          = level 10, then every 5 levels
//   • Fail condition          = 10th mistake OR 180s time expired
//   • Unique question IDs     in the same deck
//   • Unique answer/year      in the same deck             (HARD rule)
//   • Active questions only   (state==='A' if field exists)
//   • Active categories only  — caller supplies the active category id
//                               whitelist (numeric main_category_id +
//                               optional legacy string `category`)
//   • First-five spacing      — first 5 ordered cards must be at least
//                               5 years apart when any valid deck exists.
//   • Soft balance            — categories, subcategories, and eras are
//                               spread when the pool is rich enough.
//   • Recently-seen aware     — prefers questions the user has not
//                               recently played, but never relaxes the
//                               unique-year rule to do so.
//
// FALLBACK ORDER (allowed → forbidden):
//   1. Ideal pool: active, year-window, unique-year, category/subcategory/
//      era-balanced, first-five spaced, not recently seen.
//   2. Relax recently-seen.
//   3. Relax category/subcategory/era balance.
//   4. CLEAN FAIL — return { ok:false, reason:'insufficient_unique_years',
//      message:'Bu seviye için yeterli sayıda farklı yıla ait soru
//      bulunamadı.' }. Caller MUST surface this; do not start the level.
//
// Never relax:
//   • required deck size
//   • unique question IDs
//   • unique answer/years
//   • active question / active category gating
//   • first 5 ordered questions at least 5 years apart unless no valid
//     spaced deck exists at all, in which case the level clean-fails.
//
// REPLAY
//   A fresh attempt id (timestamped + random) gives a fresh deck. Replay
//   from the Solo result popup re-mounts Game with a new attempt and
//   therefore a new deck.

import { getSoloAttemptDeckSizeForLevel } from './soloProgressHelpers';

const DEFAULT_DECK_SIZE = getSoloAttemptDeckSizeForLevel(1);
const FIRST_FIVE_SPACING_TARGET_COUNT = 5;
const FIRST_FIVE_MIN_YEAR_GAP = 5;

export function getBeginnerYearSpacingForLevel(levelNumber) {
  const level = Math.trunc(Number(levelNumber) || 0);
  if (level < 1) return null;
  return {
    idealGap: FIRST_FIVE_MIN_YEAR_GAP,
    minGap: FIRST_FIVE_MIN_YEAR_GAP,
    targetCount: FIRST_FIVE_SPACING_TARGET_COUNT,
    hard: true,
  };
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

function canPickSpacedYears(years, targetCount = FIRST_FIVE_SPACING_TARGET_COUNT, minGap = FIRST_FIVE_MIN_YEAR_GAP) {
  const picked = [];
  for (const year of [...years].sort((a, b) => Number(a) - Number(b))) {
    if (!Number.isFinite(Number(year))) continue;
    if (!isSpacedFromAll(year, picked, minGap)) continue;
    picked.push(year);
    if (picked.length >= targetCount) return true;
  }
  return false;
}

function orderYearsForEraSpread(years, random) {
  const sorted = [...years].sort((a, b) => Number(a) - Number(b));
  if (sorted.length <= 1) return sorted;
  const bucketCount = Math.min(4, sorted.length);
  const buckets = Array.from({ length: bucketCount }, () => []);
  sorted.forEach((year, index) => {
    const bucketIndex = Math.min(bucketCount - 1, Math.floor((index * bucketCount) / sorted.length));
    buckets[bucketIndex].push(year);
  });
  const shuffledBuckets = buckets.map((bucket) => fisherYatesShuffle(bucket, random));
  const out = [];
  let cursor = 0;
  while (out.length < sorted.length) {
    const bucket = shuffledBuckets[cursor % bucketCount];
    if (bucket.length) out.push(bucket.shift());
    cursor += 1;
  }
  return out;
}

function orderYearsForBeginnerSpacing(years, levelNumber) {
  const spacing = getBeginnerYearSpacingForLevel(levelNumber);
  if (!spacing || years.length === 0) return years;

  const targetCount = Math.min(spacing.targetCount, years.length);
  const priorityYears = [];
  const prioritySet = new Set();

  const collectPriorityYears = (orderedYears) => {
    priorityYears.length = 0;
    prioritySet.clear();
    for (const year of orderedYears) {
      if (priorityYears.length >= targetCount) break;
      if (!Number.isFinite(Number(year))) continue;
      if (!isSpacedFromAll(year, priorityYears, spacing.minGap)) continue;
      priorityYears.push(year);
      prioritySet.add(year);
    }
    return priorityYears.length >= targetCount;
  };

  if (!collectPriorityYears(years)) {
    collectPriorityYears([...years].sort((a, b) => Number(a) - Number(b)));
  }

  if (priorityYears.length >= targetCount) {
    return [
      ...priorityYears,
      ...years.filter((year) => !prioritySet.has(year)),
    ];
  }

  return null;
}

function orderDeckForBeginnerSpacing(deck, levelNumber, random) {
  const spacing = getBeginnerYearSpacingForLevel(levelNumber);
  const shuffled = fisherYatesShuffle(deck, random);
  if (!spacing || shuffled.length === 0) return shuffled;

  const targetCount = Math.min(spacing.targetCount, shuffled.length);
  const front = [];
  const frontIds = new Set();

  const collectFront = (orderedDeck) => {
    front.length = 0;
    frontIds.clear();
    for (const question of orderedDeck) {
      const year = Number(question?.year);
      if (front.length >= targetCount) break;
      if (!Number.isFinite(year)) continue;
      if (!isSpacedFromAll(year, front.map((q) => Number(q.year)), spacing.minGap)) continue;
      front.push(question);
      frontIds.add(question.id);
    }
    return front.length >= targetCount;
  };

  if (!collectFront(shuffled)) {
    collectFront([...shuffled].sort((a, b) => Number(a?.year) - Number(b?.year)));
  }

  if (front.length >= targetCount) {
    const rest = shuffled.filter((question) => !frontIds.has(question.id));
    return [...front, ...fisherYatesShuffle(rest, random)];
  }

  return null;
}

function getCategoryKey(question) {
  const cid = Number(question?.main_category_id);
  return Number.isFinite(cid) ? `cat:${cid}` : 'cat:unknown';
}

function getSubcategoryKey(question) {
  const raw = question?.sub_category ?? question?.subcategory ?? question?.tag ?? '';
  const key = String(raw || '').trim().toLowerCase();
  return key || 'sub:unknown';
}

function countDistinctBy(candidates, selector) {
  return new Set(candidates.map(selector).filter(Boolean)).size;
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
// main_category_id and `perSubcategoryCap` from the same subcategory
// when alternatives exist.
function selectUniqueYearDeck({
  candidates,
  deckSize,
  recentIds,
  random,
  perCategoryCap,
  perSubcategoryCap,
  levelNumber,
}) {
  const buckets = groupByYear(candidates);
  if (buckets.size < deckSize) return null; // not enough distinct years

  const years = orderYearsForBeginnerSpacing(
    orderYearsForEraSpread(Array.from(buckets.keys()), random),
    levelNumber,
  );
  if (!years) return null;
  const deck = [];
  const usedIds = new Set();
  const categoryCounts = new Map();
  const subcategoryCounts = new Map();

  for (const year of years) {
    if (deck.length >= deckSize) break;
    const bucket = buckets.get(year).filter((q) => !usedIds.has(q.id));
    if (bucket.length === 0) continue;
    const shuffled = fisherYatesShuffle(bucket, random);

    // Tier A: not recently seen + under category cap
    let pick = shuffled.find((q) => {
      if (recentIds.has(q.id)) return false;
      const categoryKey = getCategoryKey(q);
      const subcategoryKey = getSubcategoryKey(q);
      const categoryCount = categoryCounts.get(categoryKey) || 0;
      const subcategoryCount = subcategoryCounts.get(subcategoryKey) || 0;
      return categoryCount < perCategoryCap && subcategoryCount < perSubcategoryCap;
    });
    // Tier B: not recently seen + under category cap
    if (!pick) {
      pick = shuffled.find((q) => {
        if (recentIds.has(q.id)) return false;
        const categoryCount = categoryCounts.get(getCategoryKey(q)) || 0;
        return categoryCount < perCategoryCap;
      });
    }
    // Tier C: not recently seen (any category/subcategory)
    if (!pick) pick = shuffled.find((q) => !recentIds.has(q.id));
    // Tier C: anything
    if (!pick) pick = shuffled[0];
    if (!pick) continue;

    deck.push(pick);
    usedIds.add(pick.id);
    const categoryKey = getCategoryKey(pick);
    const subcategoryKey = getSubcategoryKey(pick);
    categoryCounts.set(categoryKey, (categoryCounts.get(categoryKey) || 0) + 1);
    subcategoryCounts.set(subcategoryKey, (subcategoryCounts.get(subcategoryKey) || 0) + 1);
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
 * @param {number=} args.deckSize             Defaults from the Solo rules:
 *                                            normal 16, special 19. Engine
 *                                            does not relax this; passed in
 *                                            only for tests.
 * @param {Function=} args.random             Random source (0..1). Defaults
 *                                            to Math.random.
 * @param {number=} args.levelNumber          Solo level number. All Solo
 *                                            attempts enforce the first-five
 *                                            5-year spacing rule.
 *
 * @returns {{ ok:true, deck:Array, attemptId:string, meta:Object }
 *         | { ok:false, reason:string, message:string, meta:Object }}
 *   On success, `deck` contains exactly `deckSize` questions with unique
 *   ids AND unique years, all from active categories (per the caller's
 *   whitelist) and active questions. On failure, `message` is a Turkish
 *   user-safe string the UI may render directly.
 */
export function buildSoloAttemptDeck(args = {}) {
  const deckSize = Number.isFinite(args.deckSize)
    ? Math.trunc(args.deckSize)
    : getSoloAttemptDeckSizeForLevel(args.levelNumber);
  const random = typeof args.random === 'function' ? args.random : Math.random;
  const allowedCats = normalizeAllowedCategoryIds(args.allowedMainCategoryIds);
  const recentIds = normalizeRecentIds(args.recentlySeenQuestionIds);

  const candidates = filterCandidatePool(args.pool, allowedCats);
  const distinctYears = new Set(candidates.map((q) => Number(q.year))).size;
  const years = Array.from(new Set(candidates.map((q) => Number(q.year)).filter(Number.isFinite)));
  const firstFiveSpacingPossible = canPickSpacedYears(years);

  if (distinctYears >= deckSize && !firstFiveSpacingPossible) {
    return {
      ok: false,
      reason: 'insufficient_first_five_spacing',
      message: 'Bu seviye için ilk 5 kart arasında en az 5 yıl aralığı sağlayacak yeterli soru yok.',
      meta: { candidateCount: candidates.length, distinctYears, deckSize },
    };
  }

  // Soft balance caps. When there are N categories/subcategories, cap any
  // single bucket at ceil(deckSize/N)+1 so the deck stays diverse without
  // becoming impossible on small pools.
  const categoryCount = allowedCats
    ? Math.max(1, allowedCats.size)
    : Math.max(1, countDistinctBy(candidates, getCategoryKey));
  const subcategoryCount = Math.max(1, countDistinctBy(candidates, getSubcategoryKey));
  const perCategoryCap = Math.max(1, Math.ceil(deckSize / categoryCount) + 1);
  const perSubcategoryCap = Math.max(1, Math.ceil(deckSize / subcategoryCount) + 1);

  // Tier 1 — ideal: respects recently-seen AND category balance.
  let deck = selectUniqueYearDeck({
    candidates,
    deckSize,
    recentIds,
    random,
    perCategoryCap,
    perSubcategoryCap,
    levelNumber: args.levelNumber,
  });

  // Tier 2 — relax recently-seen.
  if (!deck) {
    deck = selectUniqueYearDeck({
      candidates, deckSize,
      recentIds: new Set(),
      random,
      perCategoryCap,
      perSubcategoryCap,
      levelNumber: args.levelNumber,
    });
  }

  // Tier 3 — relax category/subcategory balance.
  if (!deck) {
    deck = selectUniqueYearDeck({
      candidates, deckSize,
      recentIds: new Set(),
      random,
      perCategoryCap: deckSize, // effectively no cap
      perSubcategoryCap: deckSize, // effectively no cap
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

  // Final order: the first 5 playable questions must be at least 5 years
  // apart. If a selected deck somehow cannot be ordered that way, fail
  // cleanly instead of starting an invalid attempt.
  const beginnerSpacing = getBeginnerYearSpacingForLevel(args.levelNumber);
  const finalDeck = orderDeckForBeginnerSpacing(deck, args.levelNumber, random);
  if (!finalDeck) {
    return {
      ok: false,
      reason: 'insufficient_first_five_spacing',
      message: 'Bu seviye için ilk 5 kart arasında en az 5 yıl aralığı sağlayacak yeterli soru yok.',
      meta: { candidateCount: candidates.length, distinctYears, deckSize },
    };
  }
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
          hard: true,
        }
        : null,
      categoryBalance: { categoryCount, perCategoryCap },
      subcategoryBalance: { subcategoryCount, perSubcategoryCap },
      eraSpread: true,
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
  canPickSpacedYears,
  orderYearsForEraSpread,
  DEFAULT_DECK_SIZE,
};
