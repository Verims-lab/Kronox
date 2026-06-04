const SOLO_TIMELINE_SEED_COUNT = 2;
const SOLO_VISIBLE_YEAR_MIN_GAP = 5;
const SPORTS_CLUSTER_TOKENS = [
  'arena', 'spor', 'sport', 'football', 'futbol', 'soccer', 'basket',
  'tenis', 'tennis', 'olimpiyat', 'olympic', 'messi', 'serena',
];

function toSet(value) {
  if (value instanceof Set) return value;
  if (Array.isArray(value)) return new Set(value);
  return new Set();
}

function toNumericYearSet(value) {
  const source = value instanceof Set || Array.isArray(value) ? Array.from(value) : [];
  return new Set(source.map(Number).filter(Number.isFinite));
}

function hasUsableId(question) {
  return question?.id !== undefined && question?.id !== null;
}

function getQuestionYear(question) {
  const year = Number(question?.year);
  return Number.isFinite(year) ? year : null;
}

function getVisibleYearGap(question, timelineYears) {
  const year = getQuestionYear(question);
  if (year === null) return -Infinity;
  const years = Array.from(toNumericYearSet(timelineYears));
  if (years.length === 0) return Infinity;
  return Math.min(...years.map((timelineYear) => Math.abs(year - timelineYear)));
}

function hasVisibleYearSpacing(question, timelineYears, minGap = SOLO_VISIBLE_YEAR_MIN_GAP) {
  return getVisibleYearGap(question, timelineYears) >= minGap;
}

function pickLeastBadVisibleYearCandidate(candidates, timelineYears) {
  let best = null;
  let bestGap = -Infinity;
  for (const question of candidates) {
    const gap = getVisibleYearGap(question, timelineYears);
    if (gap > bestGap) {
      best = question;
      bestGap = gap;
    }
  }
  return best;
}

function canUseQuestion(question, usedIds, timelineYears, excludedIds) {
  const questionYear = getQuestionYear(question);
  const exactTimelineYears = toNumericYearSet(timelineYears);
  return hasUsableId(question)
    && questionYear !== null
    && !usedIds.has(question.id)
    && !excludedIds.has(question.id)
    && !exactTimelineYears.has(questionYear);
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

function getThemeKey(question) {
  const sportsKey = getSportsClusterKey(question);
  if (sportsKey) return 'theme:sports';
  const tag = String(question?.tag || '').trim().toLowerCase();
  if (tag) return `theme:${tag.split(/[,\s/|]+/).filter(Boolean)[0] || tag}`;
  const subcategoryKey = getSubcategoryKey(question);
  if (subcategoryKey && subcategoryKey !== 'sub:unknown') return subcategoryKey.replace(/^sub:/, 'theme:');
  return getCategoryKey(question).replace(/^cat:/, 'theme:cat:');
}

function getDecadeKey(question) {
  const year = getQuestionYear(question);
  if (year === null) return 'decade:unknown';
  return `decade:${Math.floor(year / 10) * 10}`;
}

function countMatching(items, selector, expected) {
  return items.reduce((count, item) => count + (selector(item) === expected ? 1 : 0), 0);
}

function scoreRuntimeCandidate(question, contextCards, sourceOrder, timelineYears) {
  const categoryKey = getCategoryKey(question);
  const subcategoryKey = getSubcategoryKey(question);
  const themeKey = getThemeKey(question);
  const decadeKey = getDecadeKey(question);
  const sourceIndex = sourceOrder.findIndex((item) => item?.id === question?.id);
  let score = 0;
  score += countMatching(contextCards, getCategoryKey, categoryKey) * 14;
  score += countMatching(contextCards, getSubcategoryKey, subcategoryKey) * 16;
  score += countMatching(contextCards, getThemeKey, themeKey) * 14;
  score += countMatching(contextCards, getDecadeKey, decadeKey) * 8;
  const last = contextCards[contextCards.length - 1] || null;
  if (last) {
    if (getCategoryKey(last) === categoryKey) score += 25;
    if (getSubcategoryKey(last) === subcategoryKey && subcategoryKey !== 'sub:unknown') score += 70;
    if (getThemeKey(last) === themeKey) score += 55;
    if (getDecadeKey(last) === decadeKey) score += 35;
  }
  const gap = getVisibleYearGap(question, timelineYears);
  score -= Math.min(20, Number.isFinite(gap) ? gap : 20);
  if (sourceIndex >= 0) score += sourceIndex * 0.05;
  return score;
}

function pickBalancedRuntimeCandidate(candidates, deck, usedIds, timelineYears) {
  const contextCards = deck.filter((question) => usedIds.has(question?.id));
  let best = null;
  let bestScore = Infinity;
  for (const question of candidates) {
    const score = scoreRuntimeCandidate(question, contextCards, deck, timelineYears);
    if (score < bestScore) {
      best = question;
      bestScore = score;
    }
  }
  return best;
}

export function getSoloSeedQuestions(deck = [], seedCount = SOLO_TIMELINE_SEED_COUNT) {
  const count = Math.max(0, Math.trunc(Number(seedCount) || 0));
  if (!Array.isArray(deck) || count === 0) return [];
  return deck.slice(Math.max(0, deck.length - count));
}

export function getOrderedSoloDeckQuestion(
  deck = [],
  usedQuestionIds = new Set(),
  currentTimelineYears = new Set(),
  options = {},
) {
  if (!Array.isArray(deck) || deck.length === 0) return null;

  const usedIds = toSet(usedQuestionIds);
  const timelineYears = toSet(currentTimelineYears);
  const skippedIds = toSet(options.skippedQuestionIds);
  const excludedIds = toSet(options.excludeQuestionIds);
  const allowSkippedFallback = options.allowSkippedFallback !== false;
  const visibleYearMinGap = Number.isFinite(Number(options.visibleYearMinGap))
    ? Number(options.visibleYearMinGap)
    : SOLO_VISIBLE_YEAR_MIN_GAP;
  const requireVisibleYearSpacing = options.requireVisibleYearSpacing === true;

  const usableCandidates = deck.filter((question) =>
    canUseQuestion(question, usedIds, timelineYears, excludedIds)
  );
  const primaryCandidates = usableCandidates.filter((question) => !skippedIds.has(question.id));

  const primarySafeCandidates = primaryCandidates.filter((question) =>
    hasVisibleYearSpacing(question, timelineYears, visibleYearMinGap)
  );
  const primary = pickBalancedRuntimeCandidate(primarySafeCandidates, deck, usedIds, timelineYears);
  if (primary) return primary;

  if (allowSkippedFallback) {
    const skippedSafeCandidates = usableCandidates.filter((question) =>
      hasVisibleYearSpacing(question, timelineYears, visibleYearMinGap)
    );
    const skippedSafeFallback = pickBalancedRuntimeCandidate(skippedSafeCandidates, deck, usedIds, timelineYears);
    if (skippedSafeFallback) return skippedSafeFallback;
  }

  if (requireVisibleYearSpacing) return null;

  const fallback = pickLeastBadVisibleYearCandidate(primaryCandidates, timelineYears);
  if (fallback) return fallback;

  if (!allowSkippedFallback) return null;
  return pickLeastBadVisibleYearCandidate(usableCandidates, timelineYears) || null;
}

export function getDisplayedSoloQuestionDeck(deck = [], seedCount = SOLO_TIMELINE_SEED_COUNT) {
  const seedIds = new Set(getSoloSeedQuestions(deck, seedCount).map((question) => question?.id));
  return (Array.isArray(deck) ? deck : []).filter((question) => !seedIds.has(question?.id));
}

export { SOLO_TIMELINE_SEED_COUNT, SOLO_VISIBLE_YEAR_MIN_GAP };
