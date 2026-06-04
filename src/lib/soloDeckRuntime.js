const SOLO_TIMELINE_SEED_COUNT = 2;

function toSet(value) {
  if (value instanceof Set) return value;
  if (Array.isArray(value)) return new Set(value);
  return new Set();
}

function hasUsableId(question) {
  return question?.id !== undefined && question?.id !== null;
}

function canUseQuestion(question, usedIds, timelineYears, excludedIds) {
  return hasUsableId(question)
    && !usedIds.has(question.id)
    && !excludedIds.has(question.id)
    && !timelineYears.has(question.year);
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

  const primary = deck.find((question) =>
    canUseQuestion(question, usedIds, timelineYears, excludedIds)
      && !skippedIds.has(question.id)
  );
  if (primary) return primary;

  if (!allowSkippedFallback) return null;
  return deck.find((question) => canUseQuestion(question, usedIds, timelineYears, excludedIds)) || null;
}

export function getDisplayedSoloQuestionDeck(deck = [], seedCount = SOLO_TIMELINE_SEED_COUNT) {
  const seedIds = new Set(getSoloSeedQuestions(deck, seedCount).map((question) => question?.id));
  return (Array.isArray(deck) ? deck : []).filter((question) => !seedIds.has(question?.id));
}

export { SOLO_TIMELINE_SEED_COUNT };
