import {
  calculateSoloAttemptResult,
  getSoloCardsRequiredForLevel,
  getSoloLevelType,
  getSoloMaxEvaluatedMovesForLevel,
  getSoloPlayableCardCountForLevel,
  getSoloReferenceCardCountForLevel,
  isSoloOnboardingLevel,
  SOLO_RULES_VERSION,
} from '@/lib/soloProgressHelpers';

function positiveInt(value, fallback = 1) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.floor(number) : fallback;
}

/** @param {{ levelNumber?: number, maxMoves?: number }} [soloLevel] */
export function buildSoloRuntimeConfig(soloLevel = {}) {
  const levelNumber = positiveInt(soloLevel?.levelNumber, 1);
  const canonicalMaxMoves = getSoloMaxEvaluatedMovesForLevel(levelNumber);
  const configuredMaxMoves = positiveInt(soloLevel?.maxMoves, canonicalMaxMoves);
  const maxMoves = isSoloOnboardingLevel(levelNumber)
    ? canonicalMaxMoves
    : Math.max(canonicalMaxMoves, configuredMaxMoves);
  const referenceCardCount = getSoloReferenceCardCountForLevel(levelNumber);
  const cardTarget = getSoloCardsRequiredForLevel(levelNumber);
  const onboarding = isSoloOnboardingLevel(levelNumber);

  return Object.freeze({
    levelNumber,
    levelType: getSoloLevelType(levelNumber),
    rulesVersion: SOLO_RULES_VERSION,
    maxMoves,
    referenceCardCount,
    playableCardTarget: getSoloPlayableCardCountForLevel(levelNumber),
    cardTarget,
    correctPlacementsNeeded: onboarding
      ? getSoloPlayableCardCountForLevel(levelNumber)
      : Math.max(1, cardTarget - referenceCardCount),
    onboarding,
    trainingConsumables: onboarding,
  });
}

/**
 * @param {{ result?: string, cardId?: string | number, questionId?: string | number }} feedback
 * @param {{ protectedByJoker?: boolean }} [options]
 */
export function mapSoloPlacementFeedback(feedback, { protectedByJoker = false } = {}) {
  const result = String(feedback?.result || '');
  if (result !== 'correct' && result !== 'wrong') return null;
  return {
    cardId: feedback?.cardId ?? feedback?.questionId ?? null,
    correct: result === 'correct',
    countsAsMove: !(result === 'wrong' && protectedByJoker),
    protectedByJoker: result === 'wrong' && protectedByJoker,
  };
}

/**
 * @param {{
 *   cardsCompleted?: number,
 *   cardTarget?: number,
 *   elapsedSeconds?: number,
 *   maxMoves?: number,
 *   mistakeCount?: number,
 *   usedMoveCount?: number,
 *   failReason?: string | null,
 * }} [options]
 */
export function buildSoloRuntimeResult({
  cardsCompleted,
  cardTarget,
  elapsedSeconds,
  maxMoves,
  mistakeCount,
  usedMoveCount,
  failReason = null,
} = {}) {
  const attempt = calculateSoloAttemptResult({
    mistakes: mistakeCount,
    usedMoves: usedMoveCount,
    remainingMoves: Math.max(0, Number(maxMoves) - Number(usedMoveCount)),
    maxMoves,
    completedCards: cardsCompleted,
    elapsedSeconds,
    requiredCards: cardTarget,
  });

  return {
    passed: attempt.passed,
    stars: attempt.stars,
    mistakes: attempt.mistakes,
    usedMoves: attempt.usedMoves,
    remainingMoves: attempt.remainingMoves,
    maxMoves: attempt.maxMoves,
    timeSeconds: attempt.timeSeconds,
    baseScore: attempt.baseScore,
    timeBonus: attempt.timeBonus,
    levelScore: attempt.levelScore,
    cardsCompleted: attempt.cardsCompleted,
    cardTarget: positiveInt(cardTarget, attempt.cardsCompleted || 1),
    failReason: attempt.failReason || failReason,
    soloRulesVersion: SOLO_RULES_VERSION,
  };
}

/**
 * @param {{
 *   enabled?: boolean,
 *   rawElapsedSeconds?: number,
 *   frozen?: boolean,
 *   frozenAtSeconds?: number,
 *   offsets?: number[],
 * }} [options]
 */
export function calculateSoloEffectiveElapsedSeconds({
  enabled,
  rawElapsedSeconds,
  frozen,
  frozenAtSeconds,
  offsets = [],
} = {}) {
  const raw = Math.max(0, Number(rawElapsedSeconds) || 0);
  if (!enabled) return raw;
  if (frozen) return Math.max(0, Number(frozenAtSeconds ?? raw) || 0);
  const pausedSeconds = (Array.isArray(offsets) ? offsets : [])
    .reduce((sum, value) => sum + Math.max(0, Number(value) || 0), 0);
  return Math.max(0, raw - pausedSeconds);
}
