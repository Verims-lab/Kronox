export function getNextPlayerIndex(currentIndex, playersLength) {
  if (!Number.isFinite(playersLength) || playersLength <= 0) return 0;
  if (!Number.isFinite(currentIndex) || currentIndex < 0 || currentIndex >= playersLength) return 0;
  return (currentIndex + 1) % playersLength;
}

export function getTimelineYears(cards = []) {
  return new Set((cards || []).map(card => card?.year).filter(year => year !== undefined && year !== null));
}

export function hasDuplicateTimelineYear(cards = [], year) {
  return getTimelineYears(cards).has(year);
}

export function isCorrectPlacement(cards = [], questionYear, zoneIndex) {
  const years = [...(cards || [])].sort((a, b) => a.year - b.year).map(card => card.year);

  if (zoneIndex === 0) {
    return years.length === 0 || questionYear <= years[0];
  }

  if (zoneIndex === years.length) {
    return questionYear >= years[years.length - 1];
  }

  return questionYear >= years[zoneIndex - 1] && questionYear <= years[zoneIndex];
}

export function getTimelineCardCount(player) {
  return Array.isArray(player?.cards) ? player.cards.length : 0;
}

export function hasPlayerWon(player, winCardCount) {
  return getTimelineCardCount(player) >= winCardCount;
}

export function getQuestionSelectionPool(
  questionPool = [],
  usedQuestionIds = new Set(),
  currentTimelineYears = new Set(),
  options = {}
) {
  const usedIds = usedQuestionIds instanceof Set ? usedQuestionIds : new Set(usedQuestionIds || []);
  const timelineYears = currentTimelineYears instanceof Set ? currentTimelineYears : new Set(currentTimelineYears || []);
  const recentIds = options.recentQuestionIds instanceof Set
    ? options.recentQuestionIds
    : new Set(options.recentQuestionIds || []);

  const sessionFiltered = (questionPool || []).filter(question => !usedIds.has(question.id));
  if (sessionFiltered.length === 0) return [];

  let pool = sessionFiltered.filter(question =>
    !timelineYears.has(question.year) && !recentIds.has(question.id)
  );

  if (pool.length === 0) {
    pool = sessionFiltered.filter(question => !timelineYears.has(question.year));
  }

  if (pool.length === 0) {
    pool = sessionFiltered;
  }

  return pool;
}

export function selectNextQuestion(
  questionPool = [],
  usedQuestionIds = new Set(),
  currentTimelineYears = new Set(),
  options = {}
) {
  const pool = getQuestionSelectionPool(questionPool, usedQuestionIds, currentTimelineYears, options);
  if (pool.length === 0) return null;

  const shuffled = [...pool];
  const random = options.random || Math.random;
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  return shuffled[0] || null;
}
