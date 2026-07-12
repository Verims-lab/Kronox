import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { debugLog, debugWarn } from '@/lib/debugLog';
import { summarizePlayers } from '@/lib/lobbyUtils';
import { navigateToOnlineGame as navigateToOnlineGameRoute } from '@/lib/onlineGameNavigation';
import {
  createOnlineLobbyInitialState,
  onlineLobbyReducer,
  ONLINE_LOBBY_ACTIONS,
} from '@/lib/onlineLobbyReducer';
import {
  getLobbySnapshot,
  joinLobbyByCode,
  LOBBY_SNAPSHOT_SCOPES,
} from '@/lib/dbGateway/lobbyGateway';
import { createAdaptivePoller } from '@/lib/adaptivePoller';

const STATUS_RANK = {
  waiting: 1,
  starting: 2,
  in_game: 3,
  finished: 4,
};

const readLobbyRevision = (lobby) => {
  const revision = Number(lobby?.state_revision);
  return Number.isFinite(revision) ? revision : 0;
};

const getStatusRank = (status) => STATUS_RANK[String(status || '')] || 0;

function isFreshLobbySnapshot(previous, next) {
  if (!previous || !next) return true;
  if (previous.id && next.id && previous.id !== next.id) return true;
  const prevRevision = readLobbyRevision(previous);
  const nextRevision = readLobbyRevision(next);
  if (nextRevision < prevRevision) return false;
  if (nextRevision === prevRevision && getStatusRank(next.status) < getStatusRank(previous.status)) return false;
  return true;
}

export function useWaitingRoomSync({ lobby, setLobby, playerName, user, isHost, navigate }) {
  const [startDebug, setStartDebug] = useState({
    subscribedLobbyId: lobby?.id || null,
    localLobbyStatus: lobby?.status || null,
    lastEventAt: null,
    lastEventStatus: null,
    lastEventLobbyId: null,
    shouldNavigateToGame: false,
    navigateCalled: false,
    currentPathname: window.location.pathname,
    currentActorResolved: Boolean(user),
    currentPlayerName: playerName || null,
    source: null,
    error: null,
  });

  const playerNameRef = useRef(playerName);
  const userRef = useRef(user);
  const latestLobbyRef = useRef(lobby);
  const hasNavigatedToGameRef = useRef(false);
  const rejoinAttemptRef = useRef(false);
  const [lobbyPhaseState, dispatchLobbyPhase] = useReducer(
    onlineLobbyReducer,
    lobby,
    (initialLobby) => createOnlineLobbyInitialState({ lobby: initialLobby }),
  );

  useEffect(() => { playerNameRef.current = playerName; }, [playerName]);
  useEffect(() => { userRef.current = user; }, [user]);
  useEffect(() => { latestLobbyRef.current = lobby; }, [lobby]);

  const setAuthoritativeLobby = useCallback((updatedLobby, source) => {
    if (!updatedLobby) return false;
    const previous = latestLobbyRef.current;
    if (!isFreshLobbySnapshot(previous, updatedLobby)) {
      debugWarn('[WaitingRoom] stale lobby snapshot ignored:', {
        source,
        lobbyId: updatedLobby.id,
        previousRevision: readLobbyRevision(previous),
        nextRevision: readLobbyRevision(updatedLobby),
        previousStatus: previous?.status || null,
        nextStatus: updatedLobby.status || null,
      });
      return false;
    }
    latestLobbyRef.current = updatedLobby;
    setLobby(updatedLobby);
    dispatchLobbyPhase({
      type: (updatedLobby.status === 'starting' || updatedLobby.status === 'in_game')
        ? ONLINE_LOBBY_ACTIONS.START_CONFIRMED
        : ONLINE_LOBBY_ACTIONS.LOBBY_REFRESHED,
      lobby: updatedLobby,
      source,
    });
    return true;
  }, [setLobby]);

  const applyLobbySnapshot = useCallback((nextLobby, source) => {
    return setAuthoritativeLobby(nextLobby, source);
  }, [setAuthoritativeLobby]);

  const refreshLobby = useCallback(async () => {
    if (!lobby?.id) return;
    const response = await getLobbySnapshot({
      lobbyId: lobby.id,
      scope: LOBBY_SNAPSHOT_SCOPES.WAITING_ROOM,
    });
    const fresh = response?.data?.lobby;
    if (fresh) applyLobbySnapshot(fresh, 'pull_to_refresh');
  }, [applyLobbySnapshot, lobby?.id]);

  const { containerRef: waitingScrollRef, pullY, refreshing } = usePullToRefresh(refreshLobby);

  useEffect(() => {
    setStartDebug(prev => ({
      ...prev,
      subscribedLobbyId: lobby?.id || null,
      localLobbyStatus: lobby?.status || null,
      currentPathname: window.location.pathname,
      currentActorResolved: Boolean(user),
      currentPlayerName: playerName || null,
    }));
  }, [lobby?.id, lobby?.status, user, playerName]);

  useEffect(() => {
    debugLog('[WaitingRoom] rendered roster:', {
      lobbyId: lobby?.id || null,
      subscriptionPlayersCount: lobby?.players?.length || 0,
      renderedPlayersCount: lobby?.players?.length || 0,
      renderedPlayerNames: (lobby?.players || []).map(p => p?.name),
      isHost,
    });
  }, [lobby?.id, lobby?.players, isHost]);

  const navigateToOnlineGame = useCallback((nextLobby, source) => {
    const targetLobbyId = nextLobby?.id || lobby?.id;
    if (!targetLobbyId || hasNavigatedToGameRef.current) return;

    hasNavigatedToGameRef.current = true;
    const nextDebug = {
      subscribedLobbyId: lobby?.id || null,
      localLobbyStatus: nextLobby?.status || lobby?.status || null,
      lastEventAt: new Date().toISOString(),
      lastEventStatus: nextLobby?.status || null,
      lastEventLobbyId: targetLobbyId,
      shouldNavigateToGame: true,
      navigateCalled: true,
      currentPathname: window.location.pathname,
      currentActorResolved: Boolean(userRef.current),
      currentPlayerName: playerNameRef.current || null,
      source,
      error: null,
    };
    debugLog('[WaitingRoom] start debug:', nextDebug);
    setStartDebug(nextDebug);

    navigateToOnlineGameRoute(navigate, nextLobby || lobby, {
      currentUser: userRef.current,
      playerName: playerNameRef.current,
    });
  }, [lobby?.id, lobby?.status, navigate]);

  useEffect(() => {
    if (!lobby?.id) return undefined;
    const activeLobbyId = lobby.id;

    const poller = createAdaptivePoller({
      minDelayMs: 2200,
      maxDelayMs: 12000,
      task: async (source) => {
        if (hasNavigatedToGameRef.current) return;
        if (!isHost) {
          dispatchLobbyPhase({
            type: ONLINE_LOBBY_ACTIONS.RECOVERY_REQUESTED,
            source: 'waiting_room_snapshot',
          });
        }

        const response = await getLobbySnapshot({
          lobbyId: activeLobbyId,
          scope: LOBBY_SNAPSHOT_SCOPES.WAITING_ROOM,
        });
        const fresh = response?.data?.lobby;
        if (!fresh) return;

        const current = latestLobbyRef.current || lobby;
        const currentPlayers = current?.players || [];
        const freshPlayers = fresh.players || [];
        const rosterChanged =
          currentPlayers.length !== freshPlayers.length ||
          JSON.stringify(summarizePlayers(currentPlayers)) !== JSON.stringify(summarizePlayers(freshPlayers));
        const statusChanged = fresh.status !== current?.status;
        const revisionChanged = readLobbyRevision(fresh) !== readLobbyRevision(current);
        const shouldNavigate = fresh.status === 'starting' || fresh.status === 'in_game';

        debugLog('[WaitingRoom] consolidated snapshot poll:', {
          source,
          lobbyId: activeLobbyId,
          rosterChanged,
          statusChanged,
          revisionChanged,
          shouldNavigate,
          localPlayersCount: currentPlayers.length,
          fetchedPlayersCount: freshPlayers.length,
        });

        const applied = (rosterChanged || statusChanged || revisionChanged)
          ? applyLobbySnapshot(fresh, 'waiting_room_snapshot')
          : true;
        if (!isHost && shouldNavigate && applied) {
          dispatchLobbyPhase({
            type: ONLINE_LOBBY_ACTIONS.RECOVERY_SUCCEEDED,
            lobby: fresh,
            source: 'waiting_room_snapshot',
          });
          navigateToOnlineGame(fresh, source);
        }
      },
      onError: (err, source, failureCount) => {
        const current = latestLobbyRef.current || lobby;
        debugWarn('[WaitingRoom] snapshot poll failed:', {
          source,
          failureCount,
          lobbyId: activeLobbyId,
          error: err?.message || String(err),
        });
        setStartDebug((previous) => ({
          ...previous,
          subscribedLobbyId: activeLobbyId,
          localLobbyStatus: current?.status || null,
          lastEventAt: new Date().toISOString(),
          source,
          error: err?.message || String(err),
        }));
        if (!isHost) {
          dispatchLobbyPhase({
            type: ONLINE_LOBBY_ACTIONS.RECOVERY_FAILED,
            error: err?.message || String(err),
            source: 'waiting_room_snapshot',
          });
        }
      },
    });
    poller.start();
    return () => poller.stop();
  }, [applyLobbySnapshot, isHost, lobby?.id, navigateToOnlineGame]);

  useEffect(() => {
    const currentName = playerName?.trim();
    const roster = lobby?.players || [];
    const isCurrentPlayerVisible = roster.some(p => p?.is_self) || roster.some(p => p?.name === currentName);

    if (isCurrentPlayerVisible) {
      rejoinAttemptRef.current = false;
    }

    if (!lobby?.id || lobby.status !== 'waiting' || isCurrentPlayerVisible || rejoinAttemptRef.current) {
      return;
    }

    rejoinAttemptRef.current = true;
    debugWarn('[WaitingRoom] current player missing from waiting roster, reasserting join:', {
      lobbyId: lobby.id,
      code: lobby.code,
      currentPlayerName: currentName || null,
      rosterCount: roster.length,
      roster: summarizePlayers(roster),
    });

    joinLobbyByCode(lobby.code, currentName).then((res) => {
      const updatedLobby = res?.data?.lobby;
      debugLog('[WaitingRoom] rejoin assertion result:', {
        lobbyId: updatedLobby?.id || lobby.id,
        joined: Boolean(res?.data?.joined),
        playersCount: updatedLobby?.players?.length || 0,
        players: summarizePlayers(updatedLobby?.players || []),
      });
      if (updatedLobby) {
        const updatedRoster = updatedLobby.players || [];
        const isVisibleAfterRejoin = updatedRoster.some(p => p?.is_self) || updatedRoster.some(p => p?.name === currentName);
        if (!isVisibleAfterRejoin) rejoinAttemptRef.current = false;
        applyLobbySnapshot(updatedLobby, 'rejoin_assertion');
      }
    }).catch((err) => {
      debugWarn('[WaitingRoom] rejoin assertion failed:', {
        lobbyId: lobby.id,
        error: err.message,
      });
      rejoinAttemptRef.current = false;
    });
  }, [applyLobbySnapshot, lobby?.id, lobby?.status, lobby?.players, lobby?.code, playerName]);

  return {
    startDebug,
    lobbyPhaseState,
    isDebugVisible: !isHost && (import.meta.env.DEV || user?.role === 'admin'),
    waitingScrollRef,
    pullY,
    refreshing,
  };
}
