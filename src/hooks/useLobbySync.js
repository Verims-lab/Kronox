/**
 * useLobbySync — Online lobi senkronizasyonu hook'u.
 * Android mimarisi önerileri: Repository pattern + reactive data source.
 * Lobby subscription ve ilk yükleme işlemlerini UI'dan ayırır.
 */
import { useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { addGameLog } from '@/components/game/GameDebugLog';
import { debugLog, debugWarn } from '@/lib/debugLog';

const summarizePlayers = (players = []) =>
  players.map(p => ({
    name: p.name,
    email: p.email,
    cardCount: p.cards?.length || 0,
  }));

const toLobbyState = (data, fallback = {}) => ({
  ...fallback,
  ...data,
  players: Array.isArray(data?.players) ? data.players : (fallback.players || []),
  current_player_index: data?.current_player_index ?? fallback.current_player_index ?? 0,
  current_question_id: data?.current_question_id ?? fallback.current_question_id ?? null,
  used_question_ids: Array.isArray(data?.used_question_ids) ? data.used_question_ids : (fallback.used_question_ids || []),
  status: data?.status ?? fallback.status,
  winner: data?.winner ?? fallback.winner,
  winner_email: data?.winner_email ?? fallback.winner_email ?? null,
});

const toWinnerState = (data) => {
  if (data?.status !== 'finished' || !data?.winner) return null;
  return {
    name: typeof data.winner === 'object' ? data.winner.name : data.winner,
    email: data.winner_email || (typeof data.winner === 'object' ? data.winner.email : null),
  };
};

export function useLobbySync({
  lobbyId,
  initialPlayers,
  currentQuestionIdFromState,
  setLobbyData,
  setWinner,
  setError,
}) {
  const unsubRef = useRef(null);
  const latestLobbyRef = useRef(null);
  // initialPlayers referansını sabitle — dependency döngüsünü önler
  const initialPlayersRef = useRef(initialPlayers);
  const currentQuestionIdRef = useRef(currentQuestionIdFromState);

  useEffect(() => {
    if (!lobbyId) return;

    const initPlayers = initialPlayersRef.current;
    const initQuestionId = currentQuestionIdRef.current;

    const applyLobbyData = (data, source) => {
      const nextLobbyData = toLobbyState(data, latestLobbyRef.current || {});
      latestLobbyRef.current = nextLobbyData;

      debugLog('[useLobbySync] applying lobby data:', {
        source,
        setLobbyDataCalled: true,
        lobbyId: nextLobbyData.id || lobbyId,
        status: nextLobbyData.status,
        winner: nextLobbyData.winner || null,
        winner_email: nextLobbyData.winner_email || null,
        current_player_index: nextLobbyData.current_player_index,
        current_question_id: nextLobbyData.current_question_id,
        used_question_count: nextLobbyData.used_question_ids?.length || 0,
        players: summarizePlayers(nextLobbyData.players),
      });
      addGameLog(`APPLY source=${source} idx=${nextLobbyData.current_player_index} q=${nextLobbyData.current_question_id}`);
      setLobbyData(nextLobbyData);

      const winnerState = toWinnerState(nextLobbyData);
      if (winnerState?.name) {
        debugLog('[useLobbySync] finished lobby observed:', {
          source,
          lobbyId: nextLobbyData.id || lobbyId,
          setWinnerCalled: true,
          winner: winnerState.name,
          winner_email: winnerState.email || null,
          currentScreenState: 'online-game',
          renderedGameOver: true,
        });
        addGameLog(`WINNER source=${source} winner=${winnerState.name}`);
        setWinner({ ...winnerState });
      }
    };

    // İlk yükleme — always fetch fresh DB state to get correct current_player_index
    base44.entities.Lobby.get(lobbyId)
      .then(data => {
        if (data) {
          debugLog('[useLobbySync] fetched lobby:', {
            lobbyId: data.id,
            status: data.status,
            playerCount: data.players?.length || 0,
            current_question_id: data.current_question_id || null,
            current_player_index: data.current_player_index ?? null,
          });
          applyLobbyData(data, 'initial-fetch');
        } else if (initPlayers && initPlayers.length > 0) {
          // Fallback to route state if DB fetch returns nothing
          const usedIds = [
            initQuestionId,
            ...initPlayers.flatMap(p => p.cards?.map(c => c.id) || [])
          ].filter(Boolean);
          applyLobbyData({
            players: initPlayers,
            current_player_index: 0,
            current_question_id: initQuestionId,
            used_question_ids: usedIds,
          }, 'route-state-fallback');
        }
      })
      .catch(err => {
        // Fallback to route state on error
        if (initPlayers && initPlayers.length > 0) {
          const usedIds = [
            initQuestionId,
            ...initPlayers.flatMap(p => p.cards?.map(c => c.id) || [])
          ].filter(Boolean);
          applyLobbyData({
            players: initPlayers,
            current_player_index: 0,
            current_question_id: initQuestionId,
            used_question_ids: usedIds,
          }, 'route-state-error-fallback');
        } else {
          setError('Lobi yüklenemedi: ' + err.message);
        }
      });

    // Realtime subscription — Android Flow'a eşdeğer
    if (unsubRef.current) unsubRef.current();
    const unsub = base44.entities.Lobby.subscribe((event) => {
      const eventType = event?.type || event?.eventType || 'update';
      const updatedLobby = event?.data || event;
      const receivedLobbyId = updatedLobby?.id || event?.id;
      if (receivedLobbyId !== lobbyId) return;

      addGameLog(`SUB event=${eventType} idx=${updatedLobby?.current_player_index} status=${updatedLobby?.status}`);
      debugLog('[useLobbySync] subscription event:', {
        subscriptionEventReceived: true,
        eventType,
        receivedLobbyId,
        status: updatedLobby?.status,
        playerCount: updatedLobby?.players?.length || 0,
        current_question_id: updatedLobby?.current_question_id || null,
        current_player_index: updatedLobby?.current_player_index ?? null,
        used_question_count: updatedLobby?.used_question_ids?.length || 0,
        players: summarizePlayers(updatedLobby?.players || []),
      });

      if (eventType === 'delete') {
        setLobbyData(null);
        setError('Lobi kapatıldı.');
        return;
      }
      applyLobbyData(updatedLobby, `subscription:${eventType}`);
    });
    unsubRef.current = unsub;

    const pollIntervalId = window.setInterval(async () => {
      try {
        const fresh = await base44.entities.Lobby.get(lobbyId);
        if (!fresh) return;

        const previous = latestLobbyRef.current;
        const hasChanged =
          !previous ||
          previous.current_player_index !== fresh.current_player_index ||
          previous.current_question_id !== fresh.current_question_id ||
          previous.status !== fresh.status ||
          JSON.stringify(previous.used_question_ids || []) !== JSON.stringify(fresh.used_question_ids || []) ||
          JSON.stringify(summarizePlayers(previous.players || [])) !== JSON.stringify(summarizePlayers(fresh.players || []));

        debugLog('[useLobbySync] poll check:', {
          lobbyId: fresh.id,
          hasChanged,
          status: fresh.status,
          current_player_index: fresh.current_player_index ?? null,
          current_question_id: fresh.current_question_id || null,
          used_question_count: fresh.used_question_ids?.length || 0,
          players: summarizePlayers(fresh.players || []),
        });

        if (hasChanged) {
          applyLobbyData(fresh, 'poll');
        }
      } catch (err) {
        debugWarn('[useLobbySync] poll failed:', err.message);
      }
    }, 1500);

    return () => {
      if (unsubRef.current) unsubRef.current();
      window.clearInterval(pollIntervalId);
    };
  }, [lobbyId, setLobbyData, setWinner, setError]);

  return { unsubRef };
}
