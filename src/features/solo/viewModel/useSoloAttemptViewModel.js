import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react';
import {
  createSoloAttemptInitialState,
  soloAttemptReducer,
  SOLO_ATTEMPT_ACTIONS,
} from '@/lib/soloAttemptReducer';
import {
  buildSoloRuntimeConfig,
  mapSoloPlacementFeedback,
} from '../model/soloRuntimeModel';

/** @param {any} state @param {any} action */
function reduceSoloAttemptState(state, action) {
  return soloAttemptReducer(state, action);
}

/** @param {{ enabled?: boolean, soloLevel?: { levelNumber?: number, maxMoves?: number } }} [options] */
export function useSoloAttemptViewModel({ enabled, soloLevel } = {}) {
  const config = useMemo(() => buildSoloRuntimeConfig(soloLevel), [soloLevel]);
  const [state, dispatch] = useReducer(
    reduceSoloAttemptState,
    config,
    createSoloAttemptInitialState,
  );
  const stateRef = useRef(state);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  /** @param {any} action */
  const dispatchRuntimeAction = useCallback((action) => {
    stateRef.current = soloAttemptReducer(stateRef.current, action);
    dispatch(action);
    return stateRef.current;
  }, []);

  const startAttempt = useCallback(() => {
    return dispatchRuntimeAction({
      type: SOLO_ATTEMPT_ACTIONS.ATTEMPT_STARTED,
      levelNumber: config.levelNumber,
      rulesVersion: config.rulesVersion,
      anchorCount: config.referenceCardCount,
      playableCardCount: config.playableCardTarget,
      targetTimelineCardCount: config.cardTarget,
      correctPlacementsNeeded: config.correctPlacementsNeeded,
      maxEvaluatedMoves: config.maxMoves,
      elapsedTimeSource: 'game_timer',
    });
  }, [config, dispatchRuntimeAction]);

  useEffect(() => {
    if (enabled) startAttempt();
  }, [enabled, startAttempt]);

  const evaluatePlacement = useCallback((feedback, options = {}) => {
    const evaluation = mapSoloPlacementFeedback(feedback, options);
    if (!evaluation) return;
    return dispatchRuntimeAction({
      type: SOLO_ATTEMPT_ACTIONS.MOVE_EVALUATED,
      ...evaluation,
      elapsedSeconds: options.elapsedSeconds,
    });
  }, [dispatchRuntimeAction]);

  const recordJokerUse = useCallback((jokerType, options = {}) => {
    return dispatchRuntimeAction({
      type: SOLO_ATTEMPT_ACTIONS.JOKER_USED,
      jokerType,
      source: options.source || 'solo',
      guided: options.guided === true,
      tutorial: options.tutorial === true,
    });
  }, [dispatchRuntimeAction]);

  const markSucceeded = useCallback((result = {}) => {
    return dispatchRuntimeAction({ type: SOLO_ATTEMPT_ACTIONS.ATTEMPT_SUCCEEDED, ...result });
  }, [dispatchRuntimeAction]);

  const markFailed = useCallback((result = {}) => {
    return dispatchRuntimeAction({ type: SOLO_ATTEMPT_ACTIONS.ATTEMPT_FAILED, ...result });
  }, [dispatchRuntimeAction]);

  const markPersistRequested = useCallback(() => {
    return dispatchRuntimeAction({ type: SOLO_ATTEMPT_ACTIONS.PERSIST_REQUESTED });
  }, [dispatchRuntimeAction]);

  const markPersistSucceeded = useCallback(() => {
    return dispatchRuntimeAction({ type: SOLO_ATTEMPT_ACTIONS.PERSIST_SUCCEEDED });
  }, [dispatchRuntimeAction]);

  const markPersistFailed = useCallback((error) => {
    return dispatchRuntimeAction({ type: SOLO_ATTEMPT_ACTIONS.PERSIST_FAILED, error });
  }, [dispatchRuntimeAction]);

  const getCurrentState = useCallback(() => stateRef.current, []);

  return useMemo(() => ({
    state,
    config,
    usedMoveCount: state.usedMoves,
    mistakeCount: Math.max(0, state.usedMoves - state.correctPlacementCount),
    remainingMoveCount: state.remainingMoves,
    evaluatePlacement,
    recordJokerUse,
    markSucceeded,
    markFailed,
    markPersistRequested,
    markPersistSucceeded,
    markPersistFailed,
    getCurrentState,
    resetAttempt: startAttempt,
  }), [
    config,
    evaluatePlacement,
    getCurrentState,
    markFailed,
    markPersistFailed,
    markPersistRequested,
    markPersistSucceeded,
    markSucceeded,
    recordJokerUse,
    startAttempt,
    state,
  ]);
}
