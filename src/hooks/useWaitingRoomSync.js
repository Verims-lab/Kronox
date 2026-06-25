import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { debugLog, debugWarn } from '@/lib/debugLog';
import { isHost as isLobbyHost, summarizePlayers } from '@/lib/lobbyUtils';
import { navigateToOnlineGame as navigateToOnlineGameRoute } from '@/lib/onlineGameNavigation';
import {
  createOnlineLobbyInitialState,
  onlineLobbyReducer,
  ONLINE_LOBBY_ACTIONS,
} from '@/lib/onlineLobbyReducer';

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
    currentUserEmail: user?.email || null,
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
    const fresh = await base44.entities.Lobby.get(lobby.id);
    if (fresh) applyLobbySnapshot(fresh, 'pull_to_refresh');
  }, [applyLobbySnapshot, lobby?.id]);

  const { containerRef: waitingScrollRef, pullY, refreshing } = usePullToRefresh(refreshLobby);

  useEffect(() => {
    setStartDebug(prev => ({
      ...prev,
      subscribedLobbyId: lobby?.id || null,
      localLobbyStatus: lobby?.status || null,
      currentPathname: window.location.pathname,
      currentUserEmail: user?.email || null,
      currentPlayerName: playerName || null,
    }));
  }, [lobby?.id, lobby?.status, user?.email, playerName]);

  useEffect(() => {
    debugLog('[WaitingRoom] rendered roster:', {
      lobbyId: lobby?.id || null,
      subscriptionPlayersCount: lobby?.players?.length || 0,
      renderedPlayersCount: lobby?.players?.length || 0,
      renderedPlayerNames: (lobby?.players || []).map(p => p?.name),
      renderedPlayerEmails: (lobby?.players || []).map(p => p?.email),
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
      currentUserEmail: userRef.current?.email || null,
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

    const registrationDebug = {
      lobbyId: lobby.id,
      timestamp: new Date().toISOString(),
      playerName: playerNameRef.current,
      userEmail: userRef.current?.email || null,
    };
    debugLog('[WaitingRoom] subscription registered:', registrationDebug);
    setStartDebug(prev => ({
      ...prev,
      subscribedLobbyId: lobby.id,
      localLobbyStatus: lobby.status,
      currentPathname: window.location.pathname,
      currentUserEmail: userRef.current?.email || null,
      currentPlayerName: playerNameRef.current || null,
      source: 'subscription-registered',
      error: null,
    }));

    const unsub = base44.entities.Lobby.subscribe((event) => {
      const eventType = event?.type || event?.eventType || 'update';
      const updatedLobby = event?.data || event;
      const receivedLobbyId = updatedLobby?.id || event?.id;
      const status = updatedLobby?.status;
      const playerCount = updatedLobby?.players?.length || 0;

      debugLog('[WaitingRoom] subscription event:', {
        eventType,
        receivedLobbyId,
        status,
        playerCount,
        players: summarizePlayers(updatedLobby?.players || []),
        current_question_id: updatedLobby?.current_question_id || null,
        current_player_index: updatedLobby?.current_player_index ?? null,
      });

      if (receivedLobbyId !== lobby.id) return;

      if (eventType === 'delete') {
        dispatchLobbyPhase({
          type: ONLINE_LOBBY_ACTIONS.LOBBY_CANCELLED,
          source: `subscription:${eventType}`,
        });
        setLobby(null);
        return;
      }

      const applied = applyLobbySnapshot(updatedLobby, `subscription:${eventType}`);
      if (!applied) return;

      const currentUser = userRef.current;
      const currentPlayerName = playerNameRef.current?.trim();
      const isAuthHost = isLobbyHost(updatedLobby, currentUser);
      const isGuestHost = !currentUser?.email && (
        currentPlayerName === updatedLobby?.host_name ||
        currentPlayerName === updatedLobby?.players?.[0]?.name
      );
      const isCurrentUserHost = isAuthHost || isGuestHost;
      const shouldNavigate = !isCurrentUserHost && (status === 'starting' || status === 'in_game');

      const debugData = {
        subscribedLobbyId: lobby.id,
        localLobbyStatus: updatedLobby?.status || lobby.status || null,
        lastEventAt: new Date().toISOString(),
        lastEventStatus: status || null,
        lastEventLobbyId: receivedLobbyId || null,
        shouldNavigateToGame: shouldNavigate,
        navigateCalled: false,
        currentPathname: window.location.pathname,
        currentUserEmail: currentUser?.email || null,
        currentPlayerName,
        source: `subscription:${eventType}`,
        error: null,
      };

      debugLog('[WaitingRoom] navigation decision:', {
        shouldNavigate,
        currentPathname: window.location.pathname,
        navigateCalled: false,
        status,
        isHost: isCurrentUserHost,
        playerName: currentPlayerName,
        userEmail: currentUser?.email || null,
        hostEmail: updatedLobby?.host_email || '',
      });
      debugLog('[WaitingRoom] start debug:', debugData);
      setStartDebug(debugData);

      if (shouldNavigate) {
        dispatchLobbyPhase({
          type: ONLINE_LOBBY_ACTIONS.START_CONFIRMED,
          lobby: updatedLobby,
          source: 'subscription_navigation',
        });
        navigateToOnlineGame(updatedLobby, 'subscription');
      }
    });

    return () => unsub();
  }, [applyLobbySnapshot, lobby?.id, lobby?.status, navigateToOnlineGame, setLobby]);

  useEffect(() => {
    if (!lobby?.id || lobby.status !== 'waiting') return undefined;

    const intervalId = window.setInterval(async () => {
      if (hasNavigatedToGameRef.current) return;

      try {
        const fresh = await base44.entities.Lobby.get(lobby.id);
        if (!fresh) return;

        const currentPlayers = lobby.players || [];
        const freshPlayers = fresh.players || [];
        const rosterChanged =
          currentPlayers.length !== freshPlayers.length ||
          JSON.stringify(summarizePlayers(currentPlayers)) !== JSON.stringify(summarizePlayers(freshPlayers));

        debugLog('[WaitingRoom] roster poll:', {
          lobbyId: lobby.id,
          rosterChanged,
          localPlayersCount: currentPlayers.length,
          fetchedPlayersCount: freshPlayers.length,
          fetchedPlayerNames: freshPlayers.map(p => p?.name),
          fetchedPlayerEmails: freshPlayers.map(p => p?.email),
        });

        if (rosterChanged) {
          applyLobbySnapshot(fresh, 'roster_poll');
        }
      } catch (err) {
        debugWarn('[WaitingRoom] roster poll failed:', {
          lobbyId: lobby.id,
          error: err.message,
        });
      }
    }, 3000);

    return () => window.clearInterval(intervalId);
  }, [applyLobbySnapshot, lobby?.id, lobby?.players, lobby.status]);

  useEffect(() => {
    const currentEmail = user?.email;
    const currentName = playerName?.trim();
    const roster = lobby?.players || [];
    const isCurrentPlayerVisible = currentEmail
      ? roster.some(p => p?.email === currentEmail)
      : roster.some(p => p?.name === currentName);

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
      currentUserEmail: currentEmail || null,
      currentPlayerName: currentName || null,
      rosterCount: roster.length,
      roster: summarizePlayers(roster),
    });

    base44.functions.invoke('findLobbyByCode', {
      code: lobby.code,
      playerName: currentName,
    }).then((res) => {
      const updatedLobby = res?.data?.lobby;
      debugLog('[WaitingRoom] rejoin assertion result:', {
        lobbyId: updatedLobby?.id || lobby.id,
        joined: Boolean(res?.data?.joined),
        playersCount: updatedLobby?.players?.length || 0,
        players: summarizePlayers(updatedLobby?.players || []),
      });
      if (updatedLobby) {
        const updatedRoster = updatedLobby.players || [];
        const isVisibleAfterRejoin = currentEmail
          ? updatedRoster.some(p => p?.email === currentEmail)
          : updatedRoster.some(p => p?.name === currentName);
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
  }, [applyLobbySnapshot, lobby?.id, lobby?.status, lobby?.players, lobby?.code, playerName, user?.email]);

  useEffect(() => {
    if (!lobby?.id || isHost) return undefined;

    const pollStartedAt = new Date().toISOString();
    debugLog('[WaitingRoom] start fallback polling registered:', {
      lobbyId: lobby.id,
      timestamp: pollStartedAt,
      playerName: playerNameRef.current,
      userEmail: userRef.current?.email || null,
    });

    const intervalId = window.setInterval(async () => {
      if (hasNavigatedToGameRef.current) return;

      try {
        dispatchLobbyPhase({
          type: ONLINE_LOBBY_ACTIONS.RECOVERY_REQUESTED,
          source: 'start_fallback_poll',
        });
        const fresh = await base44.entities.Lobby.get(lobby.id);
        const status = fresh?.status;
        const shouldNavigate = status === 'starting' || status === 'in_game';
        const pollDebug = {
          subscribedLobbyId: lobby.id,
          localLobbyStatus: fresh?.status || lobby.status || null,
          lastEventAt: new Date().toISOString(),
          lastEventStatus: status || null,
          lastEventLobbyId: fresh?.id || null,
          shouldNavigateToGame: shouldNavigate,
          navigateCalled: false,
          currentPathname: window.location.pathname,
          currentUserEmail: userRef.current?.email || null,
          currentPlayerName: playerNameRef.current || null,
          source: 'poll',
          error: null,
        };

        debugLog('[WaitingRoom] start fallback poll:', pollDebug);
        setStartDebug(pollDebug);

        const applied = fresh ? applyLobbySnapshot(fresh, 'start_fallback_poll') : false;
        if (shouldNavigate && (applied || fresh?.status === 'starting' || fresh?.status === 'in_game')) {
          dispatchLobbyPhase({
            type: ONLINE_LOBBY_ACTIONS.RECOVERY_SUCCEEDED,
            lobby: fresh,
            source: 'start_fallback_poll',
          });
          navigateToOnlineGame(fresh, 'poll');
        }
      } catch (err) {
        const pollErrorDebug = {
          subscribedLobbyId: lobby.id,
          localLobbyStatus: lobby.status || null,
          lastEventAt: new Date().toISOString(),
          lastEventStatus: null,
          lastEventLobbyId: null,
          shouldNavigateToGame: false,
          navigateCalled: false,
          currentPathname: window.location.pathname,
          currentUserEmail: userRef.current?.email || null,
          currentPlayerName: playerNameRef.current || null,
          source: 'poll',
          error: err.message,
        };
        debugLog('[WaitingRoom] start fallback poll error:', pollErrorDebug);
        setStartDebug(pollErrorDebug);
        dispatchLobbyPhase({
          type: ONLINE_LOBBY_ACTIONS.RECOVERY_FAILED,
          error: err.message,
          source: 'start_fallback_poll',
        });
      }
    }, 2500);

    return () => window.clearInterval(intervalId);
  }, [applyLobbySnapshot, isHost, lobby?.id, lobby?.status, navigateToOnlineGame]);

  return {
    startDebug,
    lobbyPhaseState,
    isDebugVisible: !isHost && (import.meta.env.DEV || user?.role === 'admin'),
    waitingScrollRef,
    pullY,
    refreshing,
  };
}
