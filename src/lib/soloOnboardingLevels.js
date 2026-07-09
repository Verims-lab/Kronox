import {
  SOLO_LEVEL_TYPES,
  SOLO_ONBOARDING_CARD_TARGET,
  getSoloMaxEvaluatedMovesForLevel,
  getSoloLevelType,
  getSoloReferenceCardCountForLevel,
  isSoloOnboardingLevel,
} from './soloProgressHelpers';

export const SOLO_ONBOARDING_SLOT_LABELS = Object.freeze({
  before: 'ÖNCESİ',
  middle: 'ARASI',
  after: 'SONRASI',
});

export const SOLO_ONBOARDING_TUTORIAL_LEVELS = Object.freeze([1, 2, 3, 4, 7]);

function normalizeYear(question) {
  const year = Number(question?.year);
  return Number.isFinite(year) ? year : null;
}

function hasUsableQuestion(question) {
  return question && question.id !== undefined && question.id !== null && normalizeYear(question) !== null;
}

function uniqueYearQuestions(deck = []) {
  const seenIds = new Set();
  const seenYears = new Set();
  return (Array.isArray(deck) ? deck : [])
    .filter(hasUsableQuestion)
    .filter((question) => {
      const id = String(question.id);
      const year = normalizeYear(question);
      if (seenIds.has(id) || seenYears.has(year)) return false;
      seenIds.add(id);
      seenYears.add(year);
      return true;
    })
    .sort((a, b) => normalizeYear(a) - normalizeYear(b));
}

function withoutQuestions(source = [], excluded = []) {
  const excludedIds = new Set(excluded.map((question) => String(question?.id)));
  return source.filter((question) => !excludedIds.has(String(question?.id)));
}

function takeClosestBefore(cards, year, count) {
  return cards
    .filter((card) => normalizeYear(card) < year)
    .sort((a, b) => normalizeYear(b) - normalizeYear(a))
    .slice(0, count)
    .sort((a, b) => normalizeYear(a) - normalizeYear(b));
}

function takeClosestAfter(cards, year, count) {
  return cards
    .filter((card) => normalizeYear(card) > year)
    .sort((a, b) => normalizeYear(a) - normalizeYear(b))
    .slice(0, count);
}

function fillToCount(primary = [], candidates = [], count = SOLO_ONBOARDING_CARD_TARGET) {
  const chosen = [...primary];
  const chosenIds = new Set(chosen.map((question) => String(question?.id)));
  for (const candidate of candidates) {
    if (chosen.length >= count) break;
    const id = String(candidate?.id);
    if (chosenIds.has(id)) continue;
    chosenIds.add(id);
    chosen.push(candidate);
  }
  return chosen.slice(0, count);
}

function buildBeforeAfterConfig(deck, levelNumber) {
  const sorted = uniqueYearQuestions(deck);
  const attemptQuestionCount = getSoloMaxEvaluatedMovesForLevel(levelNumber);
  if (sorted.length < attemptQuestionCount + 1) return null;

  let bestAnchor = null;
  let bestScore = -Infinity;
  sorted.forEach((candidate, index) => {
    const beforeCount = index;
    const afterCount = sorted.length - index - 1;
    const balanced = Math.min(beforeCount, 3) + Math.min(afterCount, 3);
    const medianPenalty = Math.abs(index - Math.floor(sorted.length / 2)) * 0.01;
    const score = balanced - medianPenalty;
    if (score > bestScore && beforeCount > 0 && afterCount > 0) {
      bestAnchor = candidate;
      bestScore = score;
    }
  });

  const anchor = bestAnchor || sorted[Math.floor(sorted.length / 2)];
  const anchorYear = normalizeYear(anchor);
  const preferred = [
    ...takeClosestBefore(sorted, anchorYear, 3),
    ...takeClosestAfter(sorted, anchorYear, 3),
  ];
  const selectedQuestions = fillToCount(
    preferred,
    withoutQuestions(sorted, [anchor, ...preferred]),
    attemptQuestionCount,
  );
  if (selectedQuestions.length < attemptQuestionCount) return null;

  const reserveQuestions = withoutQuestions(sorted, [anchor, ...selectedQuestions]);
  return {
    levelType: SOLO_LEVEL_TYPES.BEFORE_AFTER,
    levelNumber,
    anchors: [anchor],
    referenceCards: [anchor],
    questionCards: selectedQuestions,
    reserveCards: reserveQuestions,
    targetQuestionCount: SOLO_ONBOARDING_CARD_TARGET,
    attemptQuestionCount,
    slotLabels: [SOLO_ONBOARDING_SLOT_LABELS.before, SOLO_ONBOARDING_SLOT_LABELS.after],
  };
}

function scoreTimelineBasicAnchors(sorted, firstIndex, secondIndex) {
  const beforeCount = firstIndex;
  const middleCount = secondIndex - firstIndex - 1;
  const afterCount = sorted.length - secondIndex - 1;
  if (beforeCount <= 0 || middleCount <= 0 || afterCount <= 0) return -Infinity;
  const coverage = Math.min(beforeCount, 2) + Math.min(middleCount, 2) + Math.min(afterCount, 2);
  const firstTarget = sorted.length / 3;
  const secondTarget = (sorted.length * 2) / 3;
  const balancePenalty = (Math.abs(firstIndex - firstTarget) + Math.abs(secondIndex - secondTarget)) * 0.01;
  return coverage - balancePenalty;
}

function buildTimelineBasicConfig(deck, levelNumber) {
  const sorted = uniqueYearQuestions(deck);
  const attemptQuestionCount = getSoloMaxEvaluatedMovesForLevel(levelNumber);
  if (sorted.length < attemptQuestionCount + 2) return null;

  let anchorIndexes = [Math.max(1, Math.floor(sorted.length / 3)), Math.min(sorted.length - 2, Math.floor((sorted.length * 2) / 3))];
  let bestScore = -Infinity;
  for (let firstIndex = 1; firstIndex < sorted.length - 2; firstIndex += 1) {
    for (let secondIndex = firstIndex + 1; secondIndex < sorted.length - 1; secondIndex += 1) {
      const score = scoreTimelineBasicAnchors(sorted, firstIndex, secondIndex);
      if (score > bestScore) {
        bestScore = score;
        anchorIndexes = [firstIndex, secondIndex];
      }
    }
  }

  const anchors = [sorted[anchorIndexes[0]], sorted[anchorIndexes[1]]]
    .sort((a, b) => normalizeYear(a) - normalizeYear(b));
  const firstYear = normalizeYear(anchors[0]);
  const secondYear = normalizeYear(anchors[1]);
  const before = takeClosestBefore(sorted, firstYear, 2);
  const middle = sorted
    .filter((card) => normalizeYear(card) > firstYear && normalizeYear(card) < secondYear)
    .sort((a, b) => {
      const aDistance = Math.min(Math.abs(normalizeYear(a) - firstYear), Math.abs(normalizeYear(a) - secondYear));
      const bDistance = Math.min(Math.abs(normalizeYear(b) - firstYear), Math.abs(normalizeYear(b) - secondYear));
      return bDistance - aDistance;
    })
    .slice(0, 2)
    .sort((a, b) => normalizeYear(a) - normalizeYear(b));
  const after = takeClosestAfter(sorted, secondYear, 2);
  const preferred = [...before, ...middle, ...after];
  const selectedQuestions = fillToCount(
    preferred,
    withoutQuestions(sorted, [...anchors, ...preferred]),
    attemptQuestionCount,
  );
  if (selectedQuestions.length < attemptQuestionCount) return null;

  const reserveQuestions = withoutQuestions(sorted, [...anchors, ...selectedQuestions]);
  return {
    levelType: SOLO_LEVEL_TYPES.TIMELINE_BASIC,
    levelNumber,
    anchors,
    referenceCards: anchors,
    questionCards: selectedQuestions,
    reserveCards: reserveQuestions,
    targetQuestionCount: SOLO_ONBOARDING_CARD_TARGET,
    attemptQuestionCount,
    slotLabels: [
      SOLO_ONBOARDING_SLOT_LABELS.before,
      SOLO_ONBOARDING_SLOT_LABELS.middle,
      SOLO_ONBOARDING_SLOT_LABELS.after,
    ],
  };
}

export function buildSoloOnboardingAttemptConfig(deck = [], levelNumber = 1) {
  const levelType = getSoloLevelType(levelNumber);
  if (levelType === SOLO_LEVEL_TYPES.BEFORE_AFTER) return buildBeforeAfterConfig(deck, levelNumber);
  if (levelType === SOLO_LEVEL_TYPES.TIMELINE_BASIC) return buildTimelineBasicConfig(deck, levelNumber);
  return null;
}

export function orderSoloDeckForOnboarding(deck = [], levelNumber = 1) {
  const config = buildSoloOnboardingAttemptConfig(deck, levelNumber);
  if (!config) return { ok: false, reason: 'invalid_onboarding_deck', deck, config: null };
  return {
    ok: true,
    deck: [...config.questionCards, ...config.reserveCards, ...config.referenceCards],
    config,
  };
}

export function getSoloOnboardingSlotLabels(levelNumber) {
  const levelType = getSoloLevelType(levelNumber);
  if (levelType === SOLO_LEVEL_TYPES.BEFORE_AFTER) {
    return [SOLO_ONBOARDING_SLOT_LABELS.before, SOLO_ONBOARDING_SLOT_LABELS.after];
  }
  if (levelType === SOLO_LEVEL_TYPES.TIMELINE_BASIC) {
    return [
      SOLO_ONBOARDING_SLOT_LABELS.before,
      SOLO_ONBOARDING_SLOT_LABELS.middle,
      SOLO_ONBOARDING_SLOT_LABELS.after,
    ];
  }
  return null;
}

export function getSoloOnboardingCorrectSlotIndex(levelNumber, referenceCards = [], questionYear) {
  if (!isSoloOnboardingLevel(levelNumber)) return null;
  const year = Number(questionYear);
  if (!Number.isFinite(year)) return null;
  const references = uniqueYearQuestions(referenceCards).slice(0, getSoloReferenceCardCountForLevel(levelNumber));
  if (getSoloLevelType(levelNumber) === SOLO_LEVEL_TYPES.BEFORE_AFTER) {
    const anchorYear = normalizeYear(references[0]);
    if (!Number.isFinite(anchorYear) || year === anchorYear) return null;
    return year < anchorYear ? 0 : 1;
  }
  const firstYear = normalizeYear(references[0]);
  const secondYear = normalizeYear(references[1]);
  if (!Number.isFinite(firstYear) || !Number.isFinite(secondYear)) return null;
  if (year === firstYear || year === secondYear) return null;
  if (year < firstYear) return 0;
  if (year > secondYear) return 2;
  return 1;
}

export function isCorrectSoloOnboardingPlacement(levelNumber, referenceCards = [], questionYear, zoneIndex) {
  const expected = getSoloOnboardingCorrectSlotIndex(levelNumber, referenceCards, questionYear);
  return expected !== null && expected === Math.trunc(Number(zoneIndex));
}

export function getSoloLevelStartTutorialConfig(levelNumber) {
  const level = Math.max(1, Math.trunc(Number(levelNumber) || 1));
  if (level === 1) {
    return {
      key: 'before_after_intro',
      eventType: 'before_after_tutorial_skip',
      title: 'Önce mi, sonra mı?',
      copy: 'Kartı referans olayın öncesine ya da sonrasına bırak.',
      videoLabel: 'Before / After demo',
    };
  }
  if (level === 2) {
    return {
      key: 'joker_training_intro',
      eventType: 'before_after_joker_tutorial_skip',
      title: 'Jokerleri dene',
      copy: 'Bu eğitim seviyesinde joker kullanımı gerçek çantandan hak harcamaz.',
      videoLabel: 'Joker demo',
    };
  }
  if (level === 3) {
    return {
      key: 'hint_training_intro',
      eventType: 'before_after_hint_tutorial_skip',
      title: 'İpucunu dene',
      copy: 'İpucu yıl bilgisini kademe kademe açar; eğitimde gerçek hakkını harcamaz.',
      videoLabel: 'Hint demo',
    };
  }
  if (level === 4) {
    return {
      key: 'timeline_basic_intro',
      eventType: 'timeline_basic_tutorial_skip',
      title: 'İki referans',
      copy: 'Kartı önce, arası ya da sonrası alanına yerleştir.',
      videoLabel: 'Timeline basic demo',
    };
  }
  if (level === 7) {
    return {
      key: 'normal_timeline_intro',
      eventType: 'normal_timeline_tutorial_skip',
      title: 'Tam zaman çizgisi',
      copy: 'Artık doğru kartlar zaman çizgisine eklenir. Joker ve İpucu gerçek haklarından kullanılır.',
      videoLabel: 'Normal timeline demo',
    };
  }
  return null;
}
