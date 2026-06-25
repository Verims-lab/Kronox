export const ONLINE_LOBBY_PHASES = Object.freeze({
  IDLE: 'idle',
  CREATING: 'creating',
  WAITING: 'waiting',
  JOINING: 'joining',
  JOINED: 'joined',
  STARTING: 'starting',
  STARTED: 'started',
  RECOVERING: 'recovering',
  EXPIRED: 'expired',
  ERROR: 'error',
});

export const ONLINE_LOBBY_ACTIONS = Object.freeze({
  CREATE_REQUESTED: 'CREATE_REQUESTED',
  CREATE_SUCCEEDED: 'CREATE_SUCCEEDED',
  CREATE_FAILED: 'CREATE_FAILED',
  JOIN_REQUESTED: 'JOIN_REQUESTED',
  JOIN_SUCCEEDED: 'JOIN_SUCCEEDED',
  JOIN_FAILED: 'JOIN_FAILED',
  INVITE_ACCEPTED: 'INVITE_ACCEPTED',
  LOBBY_REFRESHED: 'LOBBY_REFRESHED',
  SUBSCRIPTION_UPDATE_RECEIVED: 'SUBSCRIPTION_UPDATE_RECEIVED',
  START_REQUESTED: 'START_REQUESTED',
  START_CONFIRMED: 'START_CONFIRMED',
  START_FAILED: 'START_FAILED',
  RECOVERY_REQUESTED: 'RECOVERY_REQUESTED',
  RECOVERY_SUCCEEDED: 'RECOVERY_SUCCEEDED',
  RECOVERY_FAILED: 'RECOVERY_FAILED',
  LOBBY_EXPIRED: 'LOBBY_EXPIRED',
  LOBBY_CANCELLED: 'LOBBY_CANCELLED',
});

const STATUS_RANK = Object.freeze({
  waiting: 1,
  starting: 2,
  in_game: 3,
  finished: 4,
  expired: 5,
  cancelled: 5,
});

function normalizeRevision(value) {
  const revision = Number(value);
  return Number.isFinite(revision) && revision >= 0 ? Math.trunc(revision) : 0;
}

function statusRank(status) {
  return STATUS_RANK[String(status || '')] || 0;
}

function normalizeQuestionId(value) {
  if (value === undefined || value === null || value === '') return null;
  return String(value);
}

function normalizeOnlineDeck(deck) {
  return Array.isArray(deck)
    ? deck.filter((question) => question && normalizeQuestionId(question.id))
    : [];
}

function normalizePlayers(players) {
  return Array.isArray(players)
    ? players.filter(Boolean).map((player, index) => ({
      ...player,
      name: typeof player?.name === 'string' && player.name.trim() ? player.name : `Player ${index + 1}`,
      email: typeof player?.email === 'string' ? player.email : null,
      cards: Array.isArray(player?.cards) ? [...player.cards] : [],
    }))
    : [];
}

export function hasOnlineSharedGameState(lobby) {
  return Boolean(
    lobby?.id &&
    lobby?.current_question_id &&
    Array.isArray(lobby?.online_question_deck) &&
    lobby.online_question_deck.length > 0 &&
    Array.isArray(lobby?.players) &&
    lobby.players.length >= 2,
  );
}

function normalizeLobbySnapshot(lobby, previousLobby = null) {
  if (!lobby || typeof lobby !== 'object') return null;
  const previous = previousLobby && typeof previousLobby === 'object' ? previousLobby : {};
  const source = lobby && typeof lobby === 'object' ? lobby : {};
  const merged = { ...previous, ...source };
  const sourceHasRevision = Object.prototype.hasOwnProperty.call(source, 'state_revision');
  const players = normalizePlayers(Array.isArray(source.players) ? source.players : previous.players);
  const onlineQuestionDeck = normalizeOnlineDeck(
    Array.isArray(source.online_question_deck) ? source.online_question_deck : previous.online_question_deck,
  );

  return {
    ...merged,
    players,
    status: String(merged.status || previous.status || 'waiting'),
    current_question_id: normalizeQuestionId(merged.current_question_id),
    online_question_deck: onlineQuestionDeck,
    state_revision: sourceHasRevision
      ? normalizeRevision(source.state_revision)
      : normalizeRevision(previous.state_revision),
  };
}

function isFreshLobbySnapshot(previousLobby, nextLobby) {
  if (!nextLobby) return false;
  if (!previousLobby) return true;
  if (previousLobby.id && nextLobby.id && previousLobby.id !== nextLobby.id) return true;

  const prevRevision = normalizeRevision(previousLobby.state_revision);
  const nextRevision = normalizeRevision(nextLobby.state_revision);
  if (statusRank(nextLobby.status) < statusRank(previousLobby.status)) return false;
  if (nextRevision < prevRevision) return false;
  return true;
}

function summarizeLobby(lobby) {
  const normalized = normalizeLobbySnapshot(lobby);
  if (!normalized) {
    return {
      lobby: null,
      lobbyId: null,
      lobbyCode: null,
      status: null,
      stateRevision: 0,
      players: [],
      playerCount: 0,
      sharedGameStateReady: false,
      currentQuestionId: null,
      onlineDeckCount: 0,
    };
  }

  return {
    lobby: normalized,
    lobbyId: normalized.id || null,
    lobbyCode: normalized.code || null,
    status: normalized.status || null,
    stateRevision: normalizeRevision(normalized.state_revision),
    players: normalized.players || [],
    playerCount: normalized.players?.length || 0,
    sharedGameStateReady: hasOnlineSharedGameState(normalized),
    currentQuestionId: normalized.current_question_id || null,
    onlineDeckCount: normalized.online_question_deck?.length || 0,
  };
}

function withLobby(state, lobby, phase, source) {
  const previousLobby = state.lobby || null;
  const normalized = normalizeLobbySnapshot(lobby, previousLobby);
  if (!normalized) return state;
  if (!isFreshLobbySnapshot(previousLobby, normalized)) {
    return {
      ...state,
      ignoredStaleSnapshot: {
        source: source || null,
        status: normalized.status || null,
        stateRevision: normalizeRevision(normalized.state_revision),
      },
    };
  }

  const summary = summarizeLobby(normalized);
  const nextPhase = summary.sharedGameStateReady
    ? ONLINE_LOBBY_PHASES.STARTED
    : phase;

  return {
    ...state,
    ...summary,
    phase: nextPhase,
    error: null,
    lastEventSource: source || state.lastEventSource || null,
    ignoredStaleSnapshot: null,
  };
}

export function createOnlineLobbyInitialState(config = {}) {
  const summary = summarizeLobby(config.lobby || null);
  const initialPhase = summary.sharedGameStateReady
    ? ONLINE_LOBBY_PHASES.STARTED
    : summary.lobby
      ? ONLINE_LOBBY_PHASES.WAITING
      : ONLINE_LOBBY_PHASES.IDLE;

  return {
    phase: config.phase || initialPhase,
    ...summary,
    error: null,
    lastEventSource: null,
    recoveryAttempts: 0,
    ignoredStaleSnapshot: null,
    joinedVia: null,
  };
}

export function onlineLobbyReducer(state = createOnlineLobbyInitialState(), action = {}) {
  switch (action.type) {
    case ONLINE_LOBBY_ACTIONS.CREATE_REQUESTED:
      return {
        ...state,
        phase: ONLINE_LOBBY_PHASES.CREATING,
        error: null,
        lastEventSource: action.source || 'create_requested',
      };

    case ONLINE_LOBBY_ACTIONS.CREATE_SUCCEEDED:
      return withLobby(state, action.lobby, ONLINE_LOBBY_PHASES.WAITING, action.source || 'create_succeeded');

    case ONLINE_LOBBY_ACTIONS.CREATE_FAILED:
      return {
        ...state,
        phase: ONLINE_LOBBY_PHASES.ERROR,
        error: action.error || 'create_failed',
        lastEventSource: action.source || 'create_failed',
      };

    case ONLINE_LOBBY_ACTIONS.JOIN_REQUESTED:
      return {
        ...state,
        phase: ONLINE_LOBBY_PHASES.JOINING,
        error: null,
        lastEventSource: action.source || 'join_requested',
      };

    case ONLINE_LOBBY_ACTIONS.JOIN_SUCCEEDED:
      return {
        ...withLobby(state, action.lobby || action.joinedLobby || action.verifiedLobby, ONLINE_LOBBY_PHASES.JOINED, action.source || 'join_succeeded'),
        joinedVia: action.joinedVia || 'code',
      };

    case ONLINE_LOBBY_ACTIONS.INVITE_ACCEPTED: {
      const joinedLobby = action.verifiedLobby || action.joinedLobby || action.lobby;
      return {
        ...withLobby(state, joinedLobby, ONLINE_LOBBY_PHASES.JOINED, action.source || 'invite_accepted'),
        joinedVia: 'invite',
      };
    }

    case ONLINE_LOBBY_ACTIONS.JOIN_FAILED:
      return {
        ...state,
        phase: ONLINE_LOBBY_PHASES.ERROR,
        error: action.error || 'join_failed',
        lastEventSource: action.source || 'join_failed',
      };

    case ONLINE_LOBBY_ACTIONS.LOBBY_REFRESHED:
    case ONLINE_LOBBY_ACTIONS.SUBSCRIPTION_UPDATE_RECEIVED:
      return withLobby(
        state,
        action.lobby,
        state.phase === ONLINE_LOBBY_PHASES.JOINING ? ONLINE_LOBBY_PHASES.JOINED : ONLINE_LOBBY_PHASES.WAITING,
        action.source || action.type,
      );

    case ONLINE_LOBBY_ACTIONS.START_REQUESTED:
      if (state.phase === ONLINE_LOBBY_PHASES.EXPIRED) return state;
      return {
        ...state,
        phase: ONLINE_LOBBY_PHASES.STARTING,
        error: null,
        lastEventSource: action.source || 'start_requested',
      };

    case ONLINE_LOBBY_ACTIONS.START_CONFIRMED: {
      if (state.phase === ONLINE_LOBBY_PHASES.EXPIRED) return state;
      const next = withLobby(state, action.lobby, ONLINE_LOBBY_PHASES.STARTING, action.source || 'start_confirmed');
      if (!next.sharedGameStateReady) {
        return {
          ...next,
          phase: ONLINE_LOBBY_PHASES.STARTING,
          error: action.error || 'missing_shared_game_state',
        };
      }
      return {
        ...next,
        phase: ONLINE_LOBBY_PHASES.STARTED,
        error: null,
      };
    }

    case ONLINE_LOBBY_ACTIONS.START_FAILED:
      return {
        ...state,
        phase: ONLINE_LOBBY_PHASES.ERROR,
        error: action.error || 'start_failed',
        lastEventSource: action.source || 'start_failed',
      };

    case ONLINE_LOBBY_ACTIONS.RECOVERY_REQUESTED:
      if (state.phase === ONLINE_LOBBY_PHASES.EXPIRED) return state;
      return {
        ...state,
        phase: ONLINE_LOBBY_PHASES.RECOVERING,
        recoveryAttempts: state.recoveryAttempts + 1,
        error: null,
        lastEventSource: action.source || 'recovery_requested',
      };

    case ONLINE_LOBBY_ACTIONS.RECOVERY_SUCCEEDED:
      return withLobby(state, action.lobby, ONLINE_LOBBY_PHASES.WAITING, action.source || 'recovery_succeeded');

    case ONLINE_LOBBY_ACTIONS.RECOVERY_FAILED:
      return {
        ...state,
        phase: ONLINE_LOBBY_PHASES.ERROR,
        error: action.error || 'recovery_failed',
        lastEventSource: action.source || 'recovery_failed',
      };

    case ONLINE_LOBBY_ACTIONS.LOBBY_EXPIRED:
    case ONLINE_LOBBY_ACTIONS.LOBBY_CANCELLED:
      return {
        ...state,
        phase: ONLINE_LOBBY_PHASES.EXPIRED,
        status: action.type === ONLINE_LOBBY_ACTIONS.LOBBY_CANCELLED ? 'cancelled' : 'expired',
        error: action.error || null,
        lastEventSource: action.source || action.type,
      };

    default:
      return state;
  }
}
