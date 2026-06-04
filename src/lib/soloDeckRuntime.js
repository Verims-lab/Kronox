const SOLO_TIMELINE_SEED_COUNT = 2;
const SOLO_VISIBLE_YEAR_MIN_GAP = 5;

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

  const primary = primaryCandidates.find((question) =>
    hasVisibleYearSpacing(question, timelineYears, visibleYearMinGap)
  );
  if (primary) return primary;

  if (allowSkippedFallback) {
    const skippedSafeFallback = usableCandidates.find((question) =>
      hasVisibleYearSpacing(question, timelineYears, visibleYearMinGap)
    );
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
