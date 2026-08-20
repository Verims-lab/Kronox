export const MATCHMAKING_PHASE = Object.freeze({
  IDLE: 'idle',
  STARTING: 'starting',
  SEARCHING: 'searching',
  MATCHED: 'matched',
  DIRECT_STARTING: 'directStarting',
  TIMEOUT: 'timeout',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
});

export const initialRandomMatchmakingState = Object.freeze({
  phase: MATCHMAKING_PHASE.IDLE,
  expiresAt: null,
  lobbyRef: '',
  lobbyCode: '',
  errorMessage: '',
  errorCategory: null,
  diagnostics: null,
});

export function randomMatchmakingReducer(state, event) {
  switch (event?.type) {
    case 'START_REQUESTED':
      return {
        ...initialRandomMatchmakingState,
        phase: MATCHMAKING_PHASE.STARTING,
      };
    case 'SEARCH_STARTED':
      return {
        ...state,
        phase: MATCHMAKING_PHASE.SEARCHING,
        expiresAt: event.expiresAt ?? state.expiresAt,
        errorMessage: '',
        errorCategory: event.errorCategory || null,
        diagnostics: event.diagnostics || null,
      };
    case 'MATCHED':
      return {
        ...state,
        phase: MATCHMAKING_PHASE.MATCHED,
        lobbyRef: event.lobbyRef || '',
        lobbyCode: event.lobbyCode || '',
        errorMessage: '',
        errorCategory: null,
        diagnostics: event.diagnostics || null,
      };
    case 'TIMED_OUT':
      return {
        ...state,
        phase: MATCHMAKING_PHASE.TIMEOUT,
        errorMessage: 'Tekrar dene.',
        errorCategory: event.errorCategory || null,
        diagnostics: event.diagnostics || null,
      };
    case 'FAILED':
      return {
        ...state,
        phase: MATCHMAKING_PHASE.FAILED,
        errorMessage: 'Eşleşme başlatılamadı. Lütfen tekrar dene.',
        errorCategory: event.errorCategory || 'MATCHMAKING_UNKNOWN_START_FAILURE',
        diagnostics: event.diagnostics || null,
      };
    case 'CANCELLED':
      return {
        ...initialRandomMatchmakingState,
        phase: MATCHMAKING_PHASE.CANCELLED,
        diagnostics: event.diagnostics || null,
      };
    case 'RESET':
      return initialRandomMatchmakingState;
    default:
      return state;
  }
}
