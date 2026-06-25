import {
  calculateSoloAttemptResult,
  getSoloCardsRequiredForLevel,
  SOLO_CORRECT_PLACEMENTS_NEEDED,
  SOLO_INITIAL_TIMELINE_CARDS,
  SOLO_MAX_EVALUATED_MOVES,
  SOLO_NORMAL_CARD_TARGET,
  SOLO_RULES_VERSION,
} from './soloProgressHelpers';

export const SOLO_ATTEMPT_PHASES = Object.freeze({
  IDLE: 'idle',
  STARTED: 'started',
  READY: 'ready',
  RUNNING: 'running',
  SUCCEEDED: 'succeeded',
  FAILED: 'failed',
});

export const SOLO_ATTEMPT_ACTIONS = Object.freeze({
  ATTEMPT_STARTED: 'ATTEMPT_STARTED',
  DECK_READY: 'DECK_READY',
  CARD_PLACED: 'CARD_PLACED',
  MOVE_EVALUATED: 'MOVE_EVALUATED',
  JOKER_USED: 'JOKER_USED',
  TARGET_REACHED: 'TARGET_REACHED',
  ATTEMPT_FAILED: 'ATTEMPT_FAILED',
  ATTEMPT_SUCCEEDED: 'ATTEMPT_SUCCEEDED',
  PERSIST_REQUESTED: 'PERSIST_REQUESTED',
  PERSIST_SUCCEEDED: 'PERSIST_SUCCEEDED',
  PERSIST_FAILED: 'PERSIST_FAILED',
  RECORD_CONTEXT_REQUESTED: 'RECORD_CONTEXT_REQUESTED',
  RECORD_CONTEXT_RECEIVED: 'RECORD_CONTEXT_RECEIVED',
  RECORD_CONTEXT_FAILED: 'RECORD_CONTEXT_FAILED',
});

export const SOLO_PERSISTENCE_STATUS = Object.freeze({
  IDLE: 'idle',
  REQUESTED: 'requested',
  SUCCEEDED: 'succeeded',
  FAILED: 'failed',
});

export const SOLO_RECORD_CONTEXT_STATUS = Object.freeze({
  IDLE: 'idle',
  REQUESTED: 'requested',
  RECEIVED: 'received',
  FAILED: 'failed',
});

export const DEFAULT_SOLO_ATTEMPT_RULES = Object.freeze({
  rulesVersion: SOLO_RULES_VERSION,
  anchorCount: SOLO_INITIAL_TIMELINE_CARDS,
  targetTimelineCardCount: SOLO_NORMAL_CARD_TARGET,
  correctPlacementsNeeded: SOLO_CORRECT_PLACEMENTS_NEEDED,
  maxEvaluatedMoves: SOLO_MAX_EVALUATED_MOVES,
});

function nonNegativeInt(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : fallback;
}

function positiveInt(value, fallback = 1) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

function normalizeLevelNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
}

function normalizeRules(config = {}) {
  const levelNumber = normalizeLevelNumber(config.levelNumber);
  const targetTimelineCardCount = positiveInt(
    config.targetTimelineCardCount ?? config.requiredCards,
    levelNumber ? getSoloCardsRequiredForLevel(levelNumber) : DEFAULT_SOLO_ATTEMPT_RULES.targetTimelineCardCount,
  );
  const anchorCount = positiveInt(config.anchorCount, DEFAULT_SOLO_ATTEMPT_RULES.anchorCount);
  const correctPlacementsNeeded = positiveInt(
    config.correctPlacementsNeeded,
    Math.max(1, targetTimelineCardCount - anchorCount),
  );
  const maxEvaluatedMoves = positiveInt(config.maxEvaluatedMoves ?? config.maxMoves, DEFAULT_SOLO_ATTEMPT_RULES.maxEvaluatedMoves);

  return {
    levelNumber,
    levelId: config.levelId ?? null,
    rulesVersion: positiveInt(config.rulesVersion, DEFAULT_SOLO_ATTEMPT_RULES.rulesVersion),
    anchorCount,
    playableCardCount: positiveInt(config.playableCardCount, maxEvaluatedMoves),
    targetTimelineCardCount,
    correctPlacementsNeeded,
    maxEvaluatedMoves,
  };
}

function createEmptyJokerUsageSummary() {
  return {
    totalUses: 0,
    normalInventoryUses: 0,
    guidedTutorialUses: 0,
    byType: {},
    inventorySpendRequested: false,
  };
}

export function createSoloAttemptInitialState(config = {}) {
  const rules = normalizeRules(config);
  return {
    phase: SOLO_ATTEMPT_PHASES.IDLE,
    levelId: rules.levelId,
    levelNumber: rules.levelNumber,
    rulesVersion: rules.rulesVersion,
    anchorCount: rules.anchorCount,
    playableCardCount: rules.playableCardCount,
    targetTimelineCardCount: rules.targetTimelineCardCount,
    correctPlacementsNeeded: rules.correctPlacementsNeeded,
    maxEvaluatedMoves: rules.maxEvaluatedMoves,
    deckReady: false,
    placedCardIds: [],
    evaluatedMoveCount: 0,
    correctPlacementCount: 0,
    usedMoves: 0,
    remainingMoves: rules.maxEvaluatedMoves,
    stars: 0,
    passed: false,
    failed: false,
    failReason: null,
    elapsedSeconds: 0,
    elapsedTimeSource: config.elapsedTimeSource || 'external',
    jokerUsageSummary: createEmptyJokerUsageSummary(),
    persistenceStatus: SOLO_PERSISTENCE_STATUS.IDLE,
    persistenceError: null,
    recordContextStatus: SOLO_RECORD_CONTEXT_STATUS.IDLE,
    recordAchievement: null,
    recordCongratulationsEligible: false,
    completionMessageContext: null,
    attemptResult: null,
  };
}

function isTerminal(state) {
  return state.phase === SOLO_ATTEMPT_PHASES.SUCCEEDED || state.phase === SOLO_ATTEMPT_PHASES.FAILED;
}

function buildAttemptResult(state, overrides = {}) {
  const usedMoves = nonNegativeInt(overrides.usedMoves ?? state.usedMoves, state.usedMoves);
  const elapsedSeconds = Math.max(0, Number(overrides.elapsedSeconds ?? state.elapsedSeconds) || 0);
  const correctPlacementCount = nonNegativeInt(
    overrides.correctPlacementCount ?? state.correctPlacementCount,
    state.correctPlacementCount,
  );
  const completedCards = Math.max(
    state.anchorCount,
    Number(overrides.completedCards) || state.anchorCount + correctPlacementCount,
  );

  return calculateSoloAttemptResult({
    mistakes: Math.max(0, usedMoves - correctPlacementCount),
    usedMoves,
    remainingMoves: Math.max(0, state.maxEvaluatedMoves - usedMoves),
    maxMoves: state.maxEvaluatedMoves,
    completedCards,
    elapsedSeconds,
    requiredCards: state.targetTimelineCardCount,
  });
}

function completeAttempt(state, passed, action = {}) {
  const correctPlacementCount = passed
    ? Math.max(state.correctPlacementsNeeded, nonNegativeInt(action.correctPlacementCount, state.correctPlacementCount))
    : nonNegativeInt(action.correctPlacementCount, state.correctPlacementCount);
  const completedCards = passed
    ? state.targetTimelineCardCount
    : Math.min(state.targetTimelineCardCount - 1, state.anchorCount + correctPlacementCount);
  const attemptResult = buildAttemptResult(state, {
    usedMoves: action.usedMoves ?? state.usedMoves,
    elapsedSeconds: action.elapsedSeconds ?? state.elapsedSeconds,
    correctPlacementCount,
    completedCards,
  });
  const didPass = Boolean(passed && attemptResult.passed);
  const evaluatedMoveCount = Math.min(
    state.maxEvaluatedMoves,
    nonNegativeInt(action.evaluatedMoveCount, Math.max(state.evaluatedMoveCount, attemptResult.usedMoves)),
  );

  return {
    ...state,
    phase: didPass ? SOLO_ATTEMPT_PHASES.SUCCEEDED : SOLO_ATTEMPT_PHASES.FAILED,
    correctPlacementCount,
    usedMoves: attemptResult.usedMoves,
    evaluatedMoveCount,
    remainingMoves: attemptResult.remainingMoves,
    elapsedSeconds: attemptResult.elapsedSeconds,
    stars: attemptResult.stars,
    passed: didPass,
    failed: !didPass,
    failReason: didPass ? null : (action.failReason || attemptResult.failReason || 'incomplete'),
    attemptResult,
    recordCongratulationsEligible: didPass,
    completionMessageContext: {
      levelNumber: state.levelNumber,
      passed: didPass,
      stars: attemptResult.stars,
      usedMoves: attemptResult.usedMoves,
      elapsedSeconds: attemptResult.elapsedSeconds,
      failReason: didPass ? null : (action.failReason || attemptResult.failReason || 'incomplete'),
    },
  };
}

function withMoveEvaluation(state, action = {}) {
  if (isTerminal(state)) return state;

  const countsAsMove = action.countsAsMove !== false;
  const nextEvaluatedMoveCount = countsAsMove
    ? Math.min(state.maxEvaluatedMoves, state.evaluatedMoveCount + 1)
    : state.evaluatedMoveCount;
  const nextUsedMoves = countsAsMove
    ? Math.min(state.maxEvaluatedMoves, state.usedMoves + 1)
    : state.usedMoves;
  const nextCorrectPlacementCount = action.correct
    ? Math.min(state.correctPlacementsNeeded, state.correctPlacementCount + 1)
    : state.correctPlacementCount;
  const elapsedSeconds = Math.max(0, Number(action.elapsedSeconds ?? state.elapsedSeconds) || 0);

  const nextState = {
    ...state,
    phase: SOLO_ATTEMPT_PHASES.RUNNING,
    evaluatedMoveCount: nextEvaluatedMoveCount,
    correctPlacementCount: nextCorrectPlacementCount,
    usedMoves: nextUsedMoves,
    remainingMoves: Math.max(0, state.maxEvaluatedMoves - nextUsedMoves),
    elapsedSeconds,
    lastMove: {
      cardId: action.cardId ?? null,
      correct: Boolean(action.correct),
      protectedByJoker: Boolean(action.protectedByJoker),
    },
  };

  if (nextCorrectPlacementCount >= state.correctPlacementsNeeded) {
    return completeAttempt(nextState, true, { elapsedSeconds, correctPlacementCount: nextCorrectPlacementCount });
  }

  if (nextEvaluatedMoveCount >= state.maxEvaluatedMoves || nextUsedMoves >= state.maxEvaluatedMoves) {
    return completeAttempt(nextState, false, {
      elapsedSeconds,
      correctPlacementCount: nextCorrectPlacementCount,
      failReason: 'moves',
    });
  }

  return nextState;
}

function withJokerUsage(state, action = {}) {
  const jokerType = String(action.jokerType || 'unknown');
  const source = String(action.source || '');
  const guided = Boolean(action.guided || action.tutorial || source === 'guided_tutorial' || source === 'tutorial');
  const summary = state.jokerUsageSummary || createEmptyJokerUsageSummary();
  const byType = {
    ...(summary.byType || {}),
    [jokerType]: nonNegativeInt(summary.byType?.[jokerType], 0) + 1,
  };

  return {
    ...state,
    jokerUsageSummary: {
      totalUses: nonNegativeInt(summary.totalUses, 0) + 1,
      normalInventoryUses: nonNegativeInt(summary.normalInventoryUses, 0) + (guided ? 0 : 1),
      guidedTutorialUses: nonNegativeInt(summary.guidedTutorialUses, 0) + (guided ? 1 : 0),
      byType,
      inventorySpendRequested: false,
    },
  };
}

export function soloAttemptReducer(state = createSoloAttemptInitialState(), action = {}) {
  switch (action.type) {
    case SOLO_ATTEMPT_ACTIONS.ATTEMPT_STARTED: {
      return {
        ...createSoloAttemptInitialState({
          levelId: action.levelId,
          levelNumber: action.levelNumber,
          rulesVersion: action.rulesVersion,
          anchorCount: action.anchorCount,
          playableCardCount: action.playableCardCount,
          targetTimelineCardCount: action.targetTimelineCardCount,
          correctPlacementsNeeded: action.correctPlacementsNeeded,
          maxEvaluatedMoves: action.maxEvaluatedMoves,
          elapsedTimeSource: action.elapsedTimeSource,
        }),
        phase: SOLO_ATTEMPT_PHASES.STARTED,
      };
    }
    case SOLO_ATTEMPT_ACTIONS.DECK_READY:
      return {
        ...state,
        phase: SOLO_ATTEMPT_PHASES.READY,
        deckReady: true,
        playableCardCount: positiveInt(action.playableCardCount, state.playableCardCount),
        anchorCount: positiveInt(action.anchorCount, state.anchorCount),
      };
    case SOLO_ATTEMPT_ACTIONS.CARD_PLACED:
      if (isTerminal(state)) return state;
      return {
        ...state,
        phase: SOLO_ATTEMPT_PHASES.RUNNING,
        placedCardIds: action.cardId == null ? state.placedCardIds : [...state.placedCardIds, action.cardId],
        lastPlacedCardId: action.cardId ?? null,
      };
    case SOLO_ATTEMPT_ACTIONS.MOVE_EVALUATED:
      return withMoveEvaluation(state, action);
    case SOLO_ATTEMPT_ACTIONS.JOKER_USED:
      return withJokerUsage(state, action);
    case SOLO_ATTEMPT_ACTIONS.TARGET_REACHED:
    case SOLO_ATTEMPT_ACTIONS.ATTEMPT_SUCCEEDED:
      if (state.failed) return state;
      return completeAttempt(state, true, action);
    case SOLO_ATTEMPT_ACTIONS.ATTEMPT_FAILED:
      if (state.passed) return state;
      return completeAttempt(state, false, action);
    case SOLO_ATTEMPT_ACTIONS.PERSIST_REQUESTED:
      return {
        ...state,
        persistenceStatus: SOLO_PERSISTENCE_STATUS.REQUESTED,
        persistenceError: null,
      };
    case SOLO_ATTEMPT_ACTIONS.PERSIST_SUCCEEDED:
      return {
        ...state,
        persistenceStatus: SOLO_PERSISTENCE_STATUS.SUCCEEDED,
        persistenceError: null,
      };
    case SOLO_ATTEMPT_ACTIONS.PERSIST_FAILED:
      return {
        ...state,
        persistenceStatus: SOLO_PERSISTENCE_STATUS.FAILED,
        persistenceError: action.error || 'persist_failed',
      };
    case SOLO_ATTEMPT_ACTIONS.RECORD_CONTEXT_REQUESTED:
      if (!state.passed || !state.recordCongratulationsEligible) return state;
      return {
        ...state,
        recordContextStatus: SOLO_RECORD_CONTEXT_STATUS.REQUESTED,
      };
    case SOLO_ATTEMPT_ACTIONS.RECORD_CONTEXT_RECEIVED:
      if (!state.passed || !state.recordCongratulationsEligible) return state;
      return {
        ...state,
        recordContextStatus: SOLO_RECORD_CONTEXT_STATUS.RECEIVED,
        recordAchievement: action.recordAchievement || null,
      };
    case SOLO_ATTEMPT_ACTIONS.RECORD_CONTEXT_FAILED:
      if (!state.passed || !state.recordCongratulationsEligible) return state;
      return {
        ...state,
        recordContextStatus: SOLO_RECORD_CONTEXT_STATUS.FAILED,
      };
    default:
      return state;
  }
}
