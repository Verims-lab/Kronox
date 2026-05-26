import { useCallback, useEffect, useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { debugLog, debugWarn } from '@/lib/debugLog';
import { isHost as isLobbyHost, summarizePlayers } from '@/lib/lobbyUtils';
import { navigateToOnlineGame as navigateToOnlineGameRoute } from '@/lib/onlineGameNavigation';

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

  const refreshLobby = useCallback(async () => {
    if (!lobby?.id) return;
    const fresh = await base44.entities.Lobby.get(lobby.id);
    if (fresh) setLobby(fresh);
  }, [lobby?.id, setLobby]);

  const { containerRef: waitingScrollRef, pullY, refreshing } = usePullToRefresh(refreshLobby);

  const playerNameRef = useRef(playerName);
  const userRef = useRef(user);
  const hasNavigatedToGameRef = useRef(false);
  const rejoinAttemptRef = useRef(false);

  useEffect(() => { playerNameRef.current = playerName; }, [playerName]);
  useEffect(() => { userRef.current = user; }, [user]);

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
        setLobby(null);
        return;
      }

      setLobby(updatedLobby);

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
        navigateToOnlineGame(updatedLobby, 'subscription');
      }
    });

    return () => unsub();
  }, [lobby?.id, lobby?.status, navigateToOnlineGame, setLobby]);

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
          setLobby(fresh);
        }
      } catch (err) {
        debugWarn('[WaitingRoom] roster poll failed:', {
          lobbyId: lobby.id,
          error: err.message,
        });
      }
    }, 2000);

    return () => window.clearInterval(intervalId);
  }, [lobby?.id, lobby?.players, lobby.status, setLobby]);

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
        setLobby(updatedLobby);
      }
    }).catch((err) => {
      debugWarn('[WaitingRoom] rejoin assertion failed:', {
        lobbyId: lobby.id,
        error: err.message,
      });
      rejoinAttemptRef.current = false;
    });
  }, [lobby?.id, lobby?.status, lobby?.players, lobby?.code, playerName, user?.email, setLobby]);

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

        if (fresh) setLobby(fresh);
        if (shouldNavigate) navigateToOnlineGame(fresh, 'poll');
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
      }
    }, 1500);

    return () => window.clearInterval(intervalId);
  }, [isHost, lobby?.id, lobby?.status, navigateToOnlineGame, setLobby]);

  return {
    startDebug,
    isDebugVisible: !isHost && (import.meta.env.DEV || user?.role === 'admin'),
    waitingScrollRef,
    pullY,
    refreshing,
  };
}
