import { useCallback, useEffect, useReducer, useRef } from 'react';
import {
  joinRandomMatchmaking,
  pollRandomMatchmaking,
  cancelRandomMatchmaking,
} from '@/lib/randomMatchmakingApi';
import { STANDARD_RANDOM_MODE } from '@/lib/onlineModeDisplay';
import {
  initialRandomMatchmakingState,
  MATCHMAKING_PHASE,
  randomMatchmakingReducer,
} from '@/lib/randomMatchmakingState';

const POLL_INTERVAL_MS = 1250;
const JOIN_RETRY_DELAYS_MS = Object.freeze([0, 450, 900]);

function localExpiryFromServer(data) {
  const expiresAt = Date.parse(data?.expiresAt || '');
  const serverNow = Date.parse(data?.serverNow || '');
  if (!Number.isFinite(expiresAt)) return null;
  if (!Number.isFinite(serverNow)) return data.expiresAt;
  return new Date(Date.now() + Math.max(0, expiresAt - serverNow)).toISOString();
}

function requestErrorCategory(error, fallback) {
  return String(error?.category || fallback || 'MATCHMAKING_UNKNOWN_START_FAILURE');
}

export default function useRandomMatchmaking(mode = STANDARD_RANDOM_MODE) {
  const [state, dispatch] = useReducer(randomMatchmakingReducer, initialRandomMatchmakingState);
  const stateRef = useRef(initialRandomMatchmakingState);
  const pollRef = useRef(null);
  const retryWaitRef = useRef(null);
  const mountedRef = useRef(true);
  const sessionRef = useRef(0);
  const pollPendingRef = useRef(false);

  const send = useCallback((event) => {
    stateRef.current = randomMatchmakingReducer(stateRef.current, event);
    dispatch(event);
  }, []);

  const clearPollTimer = useCallback(() => {
    if (pollRef.current) {
      window.clearTimeout(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const clearRetryWait = useCallback(() => {
    if (!retryWaitRef.current) return;
    window.clearTimeout(retryWaitRef.current.id);
    retryWaitRef.current.resolve(false);
    retryWaitRef.current = null;
  }, []);

  const waitForRetry = useCallback((ms) => new Promise((resolve) => {
    if (!ms) {
      resolve(true);
      return;
    }
    const id = window.setTimeout(() => {
      retryWaitRef.current = null;
      resolve(true);
    }, ms);
    retryWaitRef.current = { id, resolve };
  }), []);

  const stopPolling = useCallback(() => {
    sessionRef.current += 1;
    pollPendingRef.current = false;
    clearPollTimer();
    clearRetryWait();
  }, [clearPollTimer, clearRetryWait]);

  const applyState = useCallback((data) => {
    if (!data) return 'unknown';
    if (data.matched || data.status === 'matched') {
      send({
        type: 'MATCHED',
        lobbyRef: data.lobbyRef,
        lobbyCode: data.lobbyCode,
        diagnostics: data.diagnostics,
      });
      stopPolling();
      return MATCHMAKING_PHASE.MATCHED;
    }
    if (['timeout', 'expired', 'cancelled'].includes(data.status)) {
      send({
        type: 'TIMED_OUT',
        errorCategory: data?.diagnostics?.errorCategory,
        diagnostics: data.diagnostics,
      });
      stopPolling();
      return MATCHMAKING_PHASE.TIMEOUT;
    }
    send({
      type: 'SEARCH_STARTED',
      expiresAt: localExpiryFromServer(data),
      errorCategory: data?.recoverable ? data?.diagnostics?.errorCategory : null,
      diagnostics: data.diagnostics,
    });
    return MATCHMAKING_PHASE.SEARCHING;
  }, [send, stopPolling]);

  const pollOnce = useCallback(async (sessionId) => {
    if (!mountedRef.current || sessionRef.current !== sessionId || pollPendingRef.current) return null;
    pollPendingRef.current = true;
    let shouldContinue = false;
    try {
      const data = await pollRandomMatchmaking(mode);
      if (!mountedRef.current || sessionRef.current !== sessionId) return data;
      shouldContinue = applyState(data) === MATCHMAKING_PHASE.SEARCHING;
      return data;
    } catch (error) {
      if (!mountedRef.current || sessionRef.current !== sessionId) return null;
      if (error?.recoverable) {
        send({
          type: 'SEARCH_STARTED',
          errorCategory: requestErrorCategory(error),
          diagnostics: error?.diagnostics,
        });
        shouldContinue = true;
        return null;
      }
      send({
        type: 'FAILED',
        errorCategory: requestErrorCategory(error),
        diagnostics: error?.diagnostics,
      });
      stopPolling();
      return null;
    } finally {
      pollPendingRef.current = false;
      if (shouldContinue && mountedRef.current && sessionRef.current === sessionId) {
        clearPollTimer();
        pollRef.current = window.setTimeout(() => {
          void pollOnce(sessionId);
        }, POLL_INTERVAL_MS);
      }
    }
  }, [applyState, clearPollTimer, mode, send, stopPolling]);

  const start = useCallback(async () => {
    const previousPhase = stateRef.current.phase;
    stopPolling();
    const sessionId = sessionRef.current;
    const isActiveSession = () => mountedRef.current && sessionRef.current === sessionId;
    send({ type: 'START_REQUESTED' });

    if ([
      MATCHMAKING_PHASE.STARTING,
      MATCHMAKING_PHASE.SEARCHING,
      MATCHMAKING_PHASE.TIMEOUT,
      MATCHMAKING_PHASE.FAILED,
      MATCHMAKING_PHASE.CANCELLED,
    ].includes(previousPhase)) {
      try {
        const cleanup = await cancelRandomMatchmaking(mode);
        if (!isActiveSession()) return false;
        if (cleanup?.matched || cleanup?.status === 'matched') {
          applyState(cleanup);
          return true;
        }
        if (cleanup?.cancelled !== true) {
          send({
            type: 'FAILED',
            errorCategory: cleanup?.diagnostics?.errorCategory,
            diagnostics: cleanup?.diagnostics,
          });
          return false;
        }
      } catch (error) {
        if (!isActiveSession()) return false;
        send({
          type: 'FAILED',
          errorCategory: requestErrorCategory(error),
          diagnostics: error?.diagnostics,
        });
        return false;
      }
    }

    for (let attempt = 0; attempt < JOIN_RETRY_DELAYS_MS.length; attempt += 1) {
      const retryReady = await waitForRetry(JOIN_RETRY_DELAYS_MS[attempt]);
      if (!retryReady) return false;
      if (!isActiveSession()) return false;
      try {
        const data = await joinRandomMatchmaking(mode);
        if (!isActiveSession()) return false;
        const nextPhase = applyState(data);
        if (nextPhase === MATCHMAKING_PHASE.SEARCHING) {
          pollRef.current = window.setTimeout(() => {
            void pollOnce(sessionId);
          }, POLL_INTERVAL_MS);
        }
        return true;
      } catch (error) {
        if (!isActiveSession()) return false;
        const canRetry = error?.recoverable && attempt < JOIN_RETRY_DELAYS_MS.length - 1;
        if (canRetry) continue;
        send({
          type: 'FAILED',
          errorCategory: requestErrorCategory(error),
          diagnostics: error?.diagnostics,
        });
        return false;
      }
    }
    return false;
  }, [applyState, mode, pollOnce, send, stopPolling, waitForRetry]);

  const cancel = useCallback(async () => {
    stopPolling();
    try {
      const data = await cancelRandomMatchmaking(mode);
      if (!mountedRef.current) return false;
      if (data?.matched || data?.status === 'matched') {
        applyState(data);
        return false;
      }
      if (data?.cancelled !== true) {
        send({
          type: 'FAILED',
          errorCategory: data?.diagnostics?.errorCategory,
          diagnostics: data?.diagnostics,
        });
        return false;
      }
      send({ type: 'CANCELLED', diagnostics: data?.diagnostics });
      return true;
    } catch (error) {
      if (mountedRef.current) {
        send({
          type: 'FAILED',
          errorCategory: requestErrorCategory(error),
          diagnostics: error?.diagnostics,
        });
      }
      return false;
    }
  }, [applyState, mode, send, stopPolling]);

  const resolveTimeout = useCallback(async () => {
    if (stateRef.current.phase === MATCHMAKING_PHASE.MATCHED) return true;
    stopPolling();
    const sessionId = sessionRef.current;
    send({ type: 'START_REQUESTED' });
    try {
      const data = await pollRandomMatchmaking(mode);
      if (!mountedRef.current || sessionRef.current !== sessionId) return false;
      if (data?.matched || data?.status === 'matched') {
        applyState(data);
        return true;
      }
    } catch (error) {
      if (!error?.recoverable) {
        send({
          type: 'FAILED',
          errorCategory: requestErrorCategory(error),
          diagnostics: error?.diagnostics,
        });
        return false;
      }
    }

    try {
      const cleanup = await cancelRandomMatchmaking(mode);
      if (!mountedRef.current || sessionRef.current !== sessionId) return false;
      if (cleanup?.matched || cleanup?.status === 'matched') {
        applyState(cleanup);
        return true;
      }
      if (cleanup?.cancelled !== true) {
        send({
          type: 'FAILED',
          errorCategory: cleanup?.diagnostics?.errorCategory,
          diagnostics: cleanup?.diagnostics,
        });
        return false;
      }
      send({
        type: 'TIMED_OUT',
        errorCategory: cleanup?.diagnostics?.errorCategory,
        diagnostics: cleanup?.diagnostics,
      });
      return false;
    } catch (error) {
      if (mountedRef.current && sessionRef.current === sessionId) {
        send({
          type: 'FAILED',
          errorCategory: requestErrorCategory(error),
          diagnostics: error?.diagnostics,
        });
      }
      return false;
    }
  }, [applyState, mode, send, stopPolling]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      const phase = stateRef.current.phase;
      mountedRef.current = false;
      stopPolling();
      if ([MATCHMAKING_PHASE.STARTING, MATCHMAKING_PHASE.SEARCHING].includes(phase)) {
        void cancelRandomMatchmaking(mode).catch(() => null);
      }
    };
  }, [mode, stopPolling]);

  return { ...state, start, cancel, resolveTimeout };
}
