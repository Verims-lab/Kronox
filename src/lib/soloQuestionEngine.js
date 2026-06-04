// Codex166/Codex180 — Solo Question Selection Engine.
//
// PURPOSE
//   Replaces the previous "shuffle the whole filtered pool and pick on
//   demand" Solo question selection with a controlled, pre-computed
//   attempt deck of level-aware size per Solo attempt.
//
// CORE RULES (locked in by Health suite solo_question_engine_health):
//   • Deck size               = normal 16, special 19
//   • Win condition           = normal 7 correct timeline cards; special 10
//                                (seed cards already count on the timeline)
//   • Special levels          = level 10, then every 5 levels
//   • Fail condition          = 10th mistake OR 180s time expired
//   • Unique question IDs     in the same deck
//   • Unique answer/year      in the same deck             (HARD rule)
//   • Active questions only   (state==='A')
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
const DEFAULT_VISIBLE_SEED_COUNT = 2;
const FIRST_FIVE_SOFT_CLUSTER_CAP = 2;
const FIRST_SEVEN_BALANCE_TARGET_COUNT = 7;
const FIRST_SEVEN_CATEGORY_CAP = 3;
const FIRST_SEVEN_SUBCATEGORY_CAP = 3;
const FIRST_SEVEN_THEME_CAP = 3;
const FULL_DECK_CATEGORY_DOMINANCE_RATIO = 0.4;
const SPORTS_CLUSTER_TOKENS = [
  'arena', 'spor', 'sport', 'football', 'futbol', 'soccer', 'basket',
  'tenis', 'tennis', 'olimpiyat', 'olympic', 'messi', 'serena',
];

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

function parseCleanNumericYear(value) {
  if (typeof value === 'number') return Number.isFinite(value) && Number.isInteger(value) ? value : null;
  if (typeof value !== 'string') return null;
  const text = value.trim();
  if (!text) return null;
  if (!/^-?\d{1,4}$/.test(text)) return null;
  const year = Number(text);
  return Number.isFinite(year) ? year : null;
}

// Question is considered playable only when runtime data marks it active.
// The authenticated getQuestions path now projects playable rows with
// state==='A'; missing state should be normalized before the deck engine.
function isActiveQuestion(question) {
  if (!question) return false;
  const state = question.state;
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
  return parseCleanNumericYear(question?.year) !== null;
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

function hasMinimumYearGap(years, minGap = FIRST_FIVE_MIN_YEAR_GAP) {
  const numericYears = years.map(Number).filter(Number.isFinite);
  for (let i = 0; i < numericYears.length; i += 1) {
    for (let j = i + 1; j < numericYears.length; j += 1) {
      if (Math.abs(numericYears[i] - numericYears[j]) < minGap) return false;
    }
  }
  return true;
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

function getQuestionYear(question) {
  const year = Number(question?.year);
  return Number.isFinite(year) ? year : null;
}

function orderDeckForBeginnerSpacing(deck, levelNumber, random, options = {}) {
  const spacing = getBeginnerYearSpacingForLevel(levelNumber);
  const shuffled = fisherYatesShuffle(deck, random);
  if (!spacing || shuffled.length === 0) return shuffled;

  const targetCount = Math.min(spacing.targetCount, shuffled.length);
  const requestedSeedCount = Number(options.seedCount);
  const seedCount = Math.max(0, Math.min(
    Math.trunc(Number.isFinite(requestedSeedCount) ? requestedSeedCount : DEFAULT_VISIBLE_SEED_COUNT),
    Math.max(0, shuffled.length - targetCount),
  ));
  const front = [];
  const frontIds = new Set();

  const collectFront = (orderedDeck, useSoftClusterGuard = true) => {
    front.length = 0;
    frontIds.clear();
    const remaining = orderedDeck.slice();
    while (front.length < targetCount && remaining.length > 0) {
      const candidates = remaining.filter((question) => {
        const year = Number(question?.year);
        if (!Number.isFinite(year)) return false;
        if (!isSpacedFromAll(year, front.map((q) => Number(q.year)), spacing.minGap)) return false;
        if (useSoftClusterGuard && exceedsFirstFiveSoftClusterCap(question, front)) return false;
        return true;
      });
      if (candidates.length === 0) break;
      const question = pickBestBalanceCandidate(candidates, front, orderedDeck, {
        targets: options.balanceTargets,
      });
      front.push(question);
      frontIds.add(question.id);
      const removeIndex = remaining.findIndex((item) => item.id === question.id);
      if (removeIndex >= 0) remaining.splice(removeIndex, 1);
    }
    return front.length >= targetCount;
  };

  const composeOrderedDeck = (orderedDeck, useSoftClusterGuard) => {
    if (!collectFront(orderedDeck, useSoftClusterGuard)) return null;
    const rest = fisherYatesShuffle(orderedDeck.filter((question) => !frontIds.has(question.id)), random);
    const seedTail = [];
    const seedIds = new Set();
    const earlyYears = front.map((question) => Number(question.year));
    for (const question of rest) {
      if (seedTail.length >= seedCount) break;
      const year = Number(question?.year);
      if (!Number.isFinite(year)) continue;
      if (!isSpacedFromAll(year, [...earlyYears, ...seedTail.map((q) => Number(q.year))], spacing.minGap)) continue;
      seedTail.push(question);
      seedIds.add(question.id);
    }
    if (seedTail.length < seedCount) return null;
    const middle = rest.filter((question) => !seedIds.has(question.id));
    const orderedMiddle = orderCardsForBalance(middle, front, random, {
      targets: options.balanceTargets,
    });
    return [...front, ...orderedMiddle, ...seedTail];
  };

  const sorted = [...shuffled].sort((a, b) => Number(a?.year) - Number(b?.year));
  for (const [orderedDeck, useSoftClusterGuard] of [
    [shuffled, true],
    [sorted, true],
    [shuffled, false],
    [sorted, false],
  ]) {
    const ordered = composeOrderedDeck(orderedDeck, useSoftClusterGuard);
    if (ordered) return ordered;
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

function getThemeKey(question) {
  const sportsKey = getSportsClusterKey(question);
  if (sportsKey) return 'theme:sports';
  const tag = String(question?.tag || '').trim().toLowerCase();
  if (tag) return `theme:${tag.split(/[,\s/|]+/).filter(Boolean)[0] || tag}`;
  const subcategoryKey = getSubcategoryKey(question);
  if (isKnownSubcategoryKey(subcategoryKey)) return subcategoryKey.replace(/^sub:/, 'theme:');
  return getCategoryKey(question).replace(/^cat:/, 'theme:cat:');
}

function getDecadeKey(question) {
  const year = getQuestionYear(question);
  if (year === null) return 'decade:unknown';
  return `decade:${Math.floor(year / 10) * 10}`;
}

function isKnownSubcategoryKey(key) {
  return key && key !== 'sub:unknown';
}

function getSportsClusterKey(question) {
  const cid = Number(question?.main_category_id);
  if (Number.isFinite(cid) && cid === 5) return 'sports';
  const text = [
    question?.sub_category,
    question?.subcategory,
    question?.tag,
    question?.category,
    question?.question,
  ].map((value) => String(value || '').toLowerCase()).join(' ');
  return SPORTS_CLUSTER_TOKENS.some((token) => text.includes(token)) ? 'sports' : null;
}

function countMatching(items, selector, expected) {
  return items.reduce((count, item) => count + (selector(item) === expected ? 1 : 0), 0);
}

function exceedsFirstFiveSoftClusterCap(question, selectedFront) {
  const subcategoryKey = getSubcategoryKey(question);
  if (
    isKnownSubcategoryKey(subcategoryKey) &&
    countMatching(selectedFront, getSubcategoryKey, subcategoryKey) >= FIRST_FIVE_SOFT_CLUSTER_CAP
  ) {
    return true;
  }

  const sportsKey = getSportsClusterKey(question);
  if (
    sportsKey &&
    countMatching(selectedFront, getSportsClusterKey, sportsKey) >= FIRST_FIVE_SOFT_CLUSTER_CAP
  ) {
    return true;
  }

  return false;
}

function buildDistribution(items, selector) {
  const distribution = {};
  for (const item of items || []) {
    const key = selector(item);
    if (!key) continue;
    distribution[key] = (distribution[key] || 0) + 1;
  }
  return distribution;
}

function getMaxDistributionCount(distribution) {
  return Math.max(0, ...Object.values(distribution || {}).map((value) => Number(value) || 0));
}

function getMaxConsecutiveCount(items, selector) {
  let max = 0;
  let current = 0;
  let previous = null;
  for (const item of items || []) {
    const key = selector(item);
    if (key && key === previous) current += 1;
    else current = key ? 1 : 0;
    previous = key;
    max = Math.max(max, current);
  }
  return max;
}

function countDistinctBy(candidates, selector) {
  return new Set(candidates.map(selector).filter(Boolean)).size;
}

function makeBalanceTargets(candidates, deckSize) {
  const categoryCount = Math.max(1, countDistinctBy(candidates, getCategoryKey));
  const subcategoryCount = Math.max(1, countDistinctBy(candidates, getSubcategoryKey));
  const themeCount = Math.max(1, countDistinctBy(candidates, getThemeKey));
  const decadeCount = Math.max(1, countDistinctBy(candidates, getDecadeKey));
  const richCategoryCap = Math.ceil(deckSize * FULL_DECK_CATEGORY_DOMINANCE_RATIO);
  const categoryCap = categoryCount >= 3
    ? Math.max(2, Math.min(richCategoryCap, Math.ceil(deckSize / categoryCount) + 1))
    : Math.max(richCategoryCap, Math.ceil(deckSize / categoryCount) + 1);
  return {
    categoryCount,
    subcategoryCount,
    themeCount,
    decadeCount,
    categoryCap,
    subcategoryCap: Math.max(2, Math.ceil(deckSize / subcategoryCount) + 1),
    themeCap: Math.max(2, Math.ceil(deckSize / themeCount) + 1),
    decadeCap: Math.max(3, Math.ceil(deckSize / decadeCount) + 1),
  };
}

function scoreCandidateForBalance(question, selected, sourceOrder = [], options = {}) {
  const position = selected.length;
  const targets = options.targets || makeBalanceTargets([...selected, question], Math.max(position + 1, DEFAULT_DECK_SIZE));
  const categoryKey = getCategoryKey(question);
  const subcategoryKey = getSubcategoryKey(question);
  const themeKey = getThemeKey(question);
  const decadeKey = getDecadeKey(question);
  const categoryCount = countMatching(selected, getCategoryKey, categoryKey);
  const subcategoryCount = countMatching(selected, getSubcategoryKey, subcategoryKey);
  const themeCount = countMatching(selected, getThemeKey, themeKey);
  const decadeCount = countMatching(selected, getDecadeKey, decadeKey);
  const sportsCount = countMatching(selected, getThemeKey, 'theme:sports');
  const last = selected[selected.length - 1] || null;
  const previous = selected[selected.length - 2] || null;
  const sourceIndex = sourceOrder.findIndex((item) => item?.id === question?.id);
  let score = 0;

  if (options.recentIds?.has(question.id)) score += 45;
  score += categoryCount * 16;
  score += (isKnownSubcategoryKey(subcategoryKey) ? subcategoryCount : Math.max(0, subcategoryCount - 1)) * 14;
  score += themeCount * 12;
  score += decadeCount * 9;

  if (categoryCount >= targets.categoryCap) score += 85;
  if (isKnownSubcategoryKey(subcategoryKey) && subcategoryCount >= targets.subcategoryCap) score += 80;
  if (themeCount >= targets.themeCap) score += 70;
  if (decadeCount >= targets.decadeCap) score += 45;

  if (position < FIRST_SEVEN_BALANCE_TARGET_COUNT && categoryCount >= FIRST_SEVEN_CATEGORY_CAP) score += 140;
  if (position < FIRST_SEVEN_BALANCE_TARGET_COUNT && isKnownSubcategoryKey(subcategoryKey) && subcategoryCount >= FIRST_SEVEN_SUBCATEGORY_CAP) score += 150;
  if (position < FIRST_SEVEN_BALANCE_TARGET_COUNT && themeCount >= FIRST_SEVEN_THEME_CAP) score += 130;
  if (position < FIRST_FIVE_SPACING_TARGET_COUNT && themeKey === 'theme:sports' && sportsCount >= FIRST_FIVE_SOFT_CLUSTER_CAP) score += 180;

  if (last) {
    if (getCategoryKey(last) === categoryKey) score += 35;
    if (isKnownSubcategoryKey(subcategoryKey) && getSubcategoryKey(last) === subcategoryKey) score += 95;
    if (getThemeKey(last) === themeKey) score += 80;
    if (getDecadeKey(last) === decadeKey) score += 45;
  }
  if (last && previous) {
    if (getThemeKey(last) === themeKey && getThemeKey(previous) === themeKey) score += 220;
    if (isKnownSubcategoryKey(subcategoryKey) && getSubcategoryKey(last) === subcategoryKey && getSubcategoryKey(previous) === subcategoryKey) score += 220;
  }

  if (sourceIndex >= 0) score += sourceIndex * 0.01;
  return score;
}

function pickBestBalanceCandidate(candidates, selected, sourceOrder, options = {}) {
  let best = null;
  let bestScore = Infinity;
  for (const question of candidates) {
    const score = scoreCandidateForBalance(question, selected, sourceOrder, options);
    if (score < bestScore) {
      best = question;
      bestScore = score;
    }
  }
  return best;
}

function orderCardsForBalance(cards, prefix = [], random = Math.random, options = {}) {
  const remaining = fisherYatesShuffle(cards || [], random);
  const ordered = [];
  const sourceOrder = [...prefix, ...remaining];
  while (remaining.length > 0) {
    const selected = [...prefix, ...ordered];
    const pick = pickBestBalanceCandidate(remaining, selected, sourceOrder, options);
    if (!pick) break;
    ordered.push(pick);
    const index = remaining.findIndex((item) => item.id === pick.id);
    if (index >= 0) remaining.splice(index, 1);
    else break;
  }
  return ordered;
}

// Pick one question per year using soft P1 balance scoring. The scoring
// prefers category/subcategory/theme/decade spread, recently unseen cards,
// and varied ordering, while unique years remain a hard selector rule.
function selectUniqueYearDeck({
  candidates,
  deckSize,
  recentIds,
  random,
  levelNumber,
  balanceTargets,
}) {
  const buckets = groupByYear(candidates);
  if (buckets.size < deckSize) return null; // not enough distinct years

  const years = orderYearsForBeginnerSpacing(orderYearsForEraSpread(Array.from(buckets.keys()), random), levelNumber);
  if (!years) return null;
  const deck = [];
  const usedIds = new Set();
  const usedYears = new Set();
  const sourceOrder = fisherYatesShuffle(
    candidates
      .filter((question) => buckets.has(Number(question.year)))
      .sort((a, b) => years.indexOf(Number(a.year)) - years.indexOf(Number(b.year))),
    random,
  );
  const priorityYears = years.slice(0, Math.min(FIRST_FIVE_SPACING_TARGET_COUNT, deckSize));

  for (const year of priorityYears) {
    const bucket = buckets.get(year).filter((q) => !usedIds.has(q.id));
    if (bucket.length === 0) continue;
    const pick = pickBestBalanceCandidate(fisherYatesShuffle(bucket, random), deck, sourceOrder, {
      recentIds,
      targets: balanceTargets || makeBalanceTargets(candidates, deckSize),
    });
    if (!pick) continue;
    deck.push(pick);
    usedIds.add(pick.id);
    usedYears.add(Number(pick.year));
  }

  while (deck.length < deckSize) {
    const available = sourceOrder.filter((question) => {
      const year = Number(question.year);
      return !usedIds.has(question.id) && !usedYears.has(year);
    });
    if (available.length === 0) break;
    const pick = pickBestBalanceCandidate(available, deck, sourceOrder, {
      recentIds,
      targets: balanceTargets || makeBalanceTargets(candidates, deckSize),
    });
    if (!pick) break;
    deck.push(pick);
    usedIds.add(pick.id);
    usedYears.add(Number(pick.year));
  }

  // If scoring cannot fill from the full source order for any unexpected
  // reason, fall back to the era-spread year walk without changing hard rules.
  for (const year of years) {
    if (deck.length >= deckSize) break;
    if (usedYears.has(Number(year))) continue;
    const bucket = buckets.get(year).filter((q) => !usedIds.has(q.id));
    if (bucket.length === 0) continue;
    const pick = pickBestBalanceCandidate(fisherYatesShuffle(bucket, random), deck, sourceOrder, {
      recentIds,
      targets: balanceTargets || makeBalanceTargets(candidates, deckSize),
    });
    if (!pick) continue;

    deck.push(pick);
    usedIds.add(pick.id);
    usedYears.add(Number(pick.year));
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
 * @param {boolean=} args.requireActiveCategoryWhitelist
 *                                            When true, empty/missing active
 *                                            category metadata clean-fails
 *                                            instead of building from a stale
 *                                            broad pool.
 * @param {Iterable<string|number>=} args.recentlySeenQuestionIds
 *                                            Question ids the user has
 *                                            recently seen (cross-attempt).
 * @param {number=} args.deckSize             Defaults from the Solo rules:
 *                                            normal 16, special 19. Engine
 *                                            does not relax this; passed in
 *                                            only for tests.
 * @param {number=} args.seedCount            Visible seed/preplaced timeline
 *                                            cards that should stay spaced
 *                                            from the first five active
 *                                            player cards. Defaults to 2.
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
  const requestedSeedCount = Number(args.seedCount);
  const seedCount = Math.max(0, Math.trunc(Number.isFinite(requestedSeedCount) ? requestedSeedCount : DEFAULT_VISIBLE_SEED_COUNT));
  const random = typeof args.random === 'function' ? args.random : Math.random;
  const allowedCats = normalizeAllowedCategoryIds(args.allowedMainCategoryIds);
  const recentIds = normalizeRecentIds(args.recentlySeenQuestionIds);

  if (args.requireActiveCategoryWhitelist === true && (!allowedCats || allowedCats.size === 0)) {
    return {
      ok: false,
      reason: 'missing_active_category_whitelist',
      message: 'Aktif kategori bilgisi alınamadı. Lütfen tekrar dene.',
      meta: { deckSize, seedCount },
    };
  }

  const candidates = filterCandidatePool(args.pool, allowedCats);
  const distinctYears = new Set(candidates.map((q) => Number(q.year))).size;
  const years = Array.from(new Set(candidates.map((q) => Number(q.year)).filter(Number.isFinite)));
  const firstFiveSpacingPossible = canPickSpacedYears(years);

  if (distinctYears >= deckSize && !firstFiveSpacingPossible) {
    return {
      ok: false,
      reason: 'insufficient_first_five_spacing',
      message: 'Bu seviye için ilk 5 kart arasında en az 5 yıl aralığı sağlayacak yeterli soru yok.',
      meta: { candidateCount: candidates.length, distinctYears, deckSize, seedCount },
    };
  }

  const balanceTargets = makeBalanceTargets(candidates, deckSize);
  let fallbackTier = 'ideal';

  // Tier 1 — ideal: balances category/subcategory/theme/decade and keeps
  // recently-seen questions as a soft penalty rather than a hard blocker.
  let deck = selectUniqueYearDeck({
    candidates,
    deckSize,
    recentIds,
    random,
    balanceTargets,
    levelNumber: args.levelNumber,
  });

  // Tier 2 — relax recently-seen.
  if (!deck) {
    fallbackTier = 'recently_seen_relaxed';
    deck = selectUniqueYearDeck({
      candidates, deckSize,
      recentIds: new Set(),
      random,
      balanceTargets,
      levelNumber: args.levelNumber,
    });
  }

  // Tier 3 — relax balance scoring. Hard rules are still enforced by the
  // candidate pool, unique-year selector, and final ordering checks.
  if (!deck) {
    fallbackTier = 'balance_relaxed';
    deck = selectUniqueYearDeck({
      candidates, deckSize,
      recentIds: new Set(),
      random,
      balanceTargets: {
        categoryCap: deckSize,
        subcategoryCap: deckSize,
        themeCap: deckSize,
        decadeCap: deckSize,
        categoryCount: balanceTargets.categoryCount,
        subcategoryCount: balanceTargets.subcategoryCount,
        themeCount: balanceTargets.themeCount,
        decadeCount: balanceTargets.decadeCount,
      },
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
  const finalDeck = orderDeckForBeginnerSpacing(deck, args.levelNumber, random, {
    seedCount,
    balanceTargets,
  });
  if (!finalDeck) {
    return {
      ok: false,
      reason: 'insufficient_first_five_spacing',
      message: 'Bu seviye için ilk 5 kart arasında en az 5 yıl aralığı sağlayacak yeterli soru yok.',
      meta: { candidateCount: candidates.length, distinctYears, deckSize, seedCount },
    };
  }
  const firstFiveCards = finalDeck.slice(0, FIRST_FIVE_SPACING_TARGET_COUNT);
  const firstSevenCards = finalDeck.slice(0, FIRST_SEVEN_BALANCE_TARGET_COUNT);
  const visibleSeedCards = seedCount > 0 ? finalDeck.slice(-seedCount) : [];
  const earlyVisibleCards = [...firstFiveCards, ...visibleSeedCards];
  const categoryDistribution = buildDistribution(finalDeck, getCategoryKey);
  const subcategoryDistribution = buildDistribution(finalDeck, getSubcategoryKey);
  const themeDistribution = buildDistribution(finalDeck, getThemeKey);
  const decadeDistribution = buildDistribution(finalDeck, getDecadeKey);
  const firstFiveCategoryDistribution = buildDistribution(firstFiveCards, getCategoryKey);
  const firstFiveSubcategoryDistribution = buildDistribution(firstFiveCards, getSubcategoryKey);
  const firstFiveThemeDistribution = buildDistribution(firstFiveCards, getThemeKey);
  const firstSevenCategoryDistribution = buildDistribution(firstSevenCards, getCategoryKey);
  const firstSevenSubcategoryDistribution = buildDistribution(firstSevenCards, getSubcategoryKey);
  const firstSevenThemeDistribution = buildDistribution(firstSevenCards, getThemeKey);
  return {
    ok: true,
    deck: finalDeck,
    attemptId: `solo_${Date.now()}_${Math.floor(random() * 1e9).toString(36)}`,
    meta: {
      candidateCount: candidates.length,
      distinctYears,
      deckSize,
      seedCount,
      categoriesUsed: new Set(
        finalDeck
          .map((q) => Number(q?.main_category_id))
          .filter((n) => Number.isFinite(n)),
      ).size,
      fallbackTier,
      categoryDistribution,
      subcategoryDistribution,
      themeDistribution,
      decadeDistribution,
      firstFiveCategoryDistribution,
      firstFiveSubcategoryDistribution,
      firstFiveThemeDistribution,
      firstSevenCategoryDistribution,
      firstSevenSubcategoryDistribution,
      firstSevenThemeDistribution,
      firstFiveSportsClusterCount: firstFiveCards.filter((q) => getSportsClusterKey(q) === 'sports').length,
      firstSevenSportsClusterCount: firstSevenCards.filter((q) => getSportsClusterKey(q) === 'sports').length,
      maxCategoryCount: getMaxDistributionCount(categoryDistribution),
      maxSubcategoryCount: getMaxDistributionCount(subcategoryDistribution),
      maxThemeCount: getMaxDistributionCount(themeDistribution),
      maxDecadeCount: getMaxDistributionCount(decadeDistribution),
      maxFirstSevenCategoryCount: getMaxDistributionCount(firstSevenCategoryDistribution),
      maxFirstSevenSubcategoryCount: getMaxDistributionCount(firstSevenSubcategoryDistribution),
      maxConsecutiveCategoryCount: getMaxConsecutiveCount(finalDeck, getCategoryKey),
      maxConsecutiveSubcategoryCount: getMaxConsecutiveCount(finalDeck, getSubcategoryKey),
      maxConsecutiveThemeCount: getMaxConsecutiveCount(finalDeck, getThemeKey),
      maxConsecutiveDecadeCount: getMaxConsecutiveCount(finalDeck, getDecadeKey),
      earlyVisibleYears: earlyVisibleCards.map((q) => Number(q?.year)).filter(Number.isFinite),
      earlyVisibleMinimumGapOk: hasMinimumYearGap(earlyVisibleCards.map((q) => Number(q?.year)), FIRST_FIVE_MIN_YEAR_GAP),
      beginnerYearSpacing: beginnerSpacing
        ? {
          levelNumber: Math.trunc(Number(args.levelNumber) || 0),
          idealGap: beginnerSpacing.idealGap,
          minGap: beginnerSpacing.minGap,
          targetCount: beginnerSpacing.targetCount,
          hard: true,
        }
        : null,
      categoryBalance: { categoryCount: balanceTargets.categoryCount, perCategoryCap: balanceTargets.categoryCap },
      subcategoryBalance: { subcategoryCount: balanceTargets.subcategoryCount, perSubcategoryCap: balanceTargets.subcategoryCap },
      themeBalance: { themeCount: balanceTargets.themeCount, perThemeCap: balanceTargets.themeCap },
      eraSpread: { decadeCount: balanceTargets.decadeCount, perDecadeCap: balanceTargets.decadeCap },
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
  getCategoryKey,
  getSubcategoryKey,
  getThemeKey,
  getDecadeKey,
  DEFAULT_DECK_SIZE,
};
