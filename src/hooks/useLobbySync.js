/**
 * useLobbySync — Online lobi senkronizasyonu hook'u.
 * Android mimarisi önerileri: Repository pattern + reactive data source.
 * Lobby subscription ve ilk yükleme işlemlerini UI'dan ayırır.
 */
import { useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { addGameLog } from '@/components/game/GameDebugLog';
import { debugLog, debugWarn } from '@/lib/debugLog';
import { normalizeLobbyState, summarizeLobbyShape } from '@/lib/lobbyState';

const summarizePlayers = (players = []) =>
  players.map(p => ({
    name: p.name,
    email: p.email,
    cardCount: p.cards?.length || 0,
  }));

const toWinnerState = (data) => {
  if (data?.status !== 'finished' || !data?.winner) return null;
  return {
    name: typeof data.winner === 'object' ? data.winner.name : data.winner,
    email: data.winner_email || (typeof data.winner === 'object' ? data.winner.email : null),
  };
};

const normalizeLobbyCode = (code) =>
  String(code || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '')
    .replace(/[^\w]/g, '');

export function useLobbySync({
  lobbyId,
  lobbyCode,
  initialPlayers,
  currentQuestionIdFromState,
  setLobbyData,
  setWinner,
  setError,
  onLobbyResolved,
}) {
  const unsubRef = useRef(null);
  const latestLobbyRef = useRef(null);
  // initialPlayers referansını sabitle — dependency döngüsünü önler
  const initialPlayersRef = useRef(initialPlayers);
  const currentQuestionIdRef = useRef(currentQuestionIdFromState);

  useEffect(() => {
    if (!lobbyId && !lobbyCode) return;

    let cancelled = false;
    let pollIntervalId = null;
    let activeLobbyId = lobbyId || null;

    const initPlayers = initialPlayersRef.current;
    const initQuestionId = currentQuestionIdRef.current;

    const buildRouteFallback = () => {
      const usedIds = [
        initQuestionId,
        ...initPlayers.flatMap(p => p.cards?.map(c => c.id) || [])
      ].filter(Boolean);

      return {
        id: activeLobbyId || lobbyId || null,
        code: normalizeLobbyCode(lobbyCode) || null,
        players: initPlayers,
        current_player_index: 0,
        current_question_id: initQuestionId,
        used_question_ids: usedIds,
        status: 'starting',
      };
    };

    const applyLobbyData = (data, source) => {
      const nextLobbyData = normalizeLobbyState(data, latestLobbyRef.current || {});
      latestLobbyRef.current = nextLobbyData;
      if (nextLobbyData.id) {
        activeLobbyId = nextLobbyData.id;
        onLobbyResolved?.(nextLobbyData.id);
      }

      debugLog('[useLobbySync] applying lobby data:', {
        source,
        setLobbyDataCalled: true,
        lobbyId: nextLobbyData.id || activeLobbyId,
        status: nextLobbyData.status,
        winner: nextLobbyData.winner || null,
        winner_email: nextLobbyData.winner_email || null,
        state_revision: nextLobbyData.state_revision ?? 0,
        current_player_index: nextLobbyData.current_player_index,
        current_question_id: nextLobbyData.current_question_id,
        used_question_count: nextLobbyData.used_question_ids?.length || 0,
        players: summarizePlayers(nextLobbyData.players),
        shape: summarizeLobbyShape(nextLobbyData),
      });
      addGameLog(`APPLY source=${source} idx=${nextLobbyData.current_player_index} q=${nextLobbyData.current_question_id}`);
      setLobbyData(nextLobbyData);

      const winnerState = toWinnerState(nextLobbyData);
      if (winnerState?.name) {
        debugLog('[useLobbySync] finished lobby observed:', {
          source,
          lobbyId: nextLobbyData.id || activeLobbyId,
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

    const resolveInitialLobby = async () => {
      if (activeLobbyId) {
        return base44.entities.Lobby.get(activeLobbyId);
      }

      const normalizedCode = normalizeLobbyCode(lobbyCode);
      if (!normalizedCode) return null;

      const matches = await base44.entities.Lobby.filter({ code: normalizedCode }, '-created_date', 1);
      return matches?.[0] || null;
    };

    const startSync = async () => {
      try {
        // İlk yükleme — always fetch fresh DB state to get correct current_player_index
        const data = await resolveInitialLobby();
        if (cancelled) return;
        if (data) {
          debugLog('[useLobbySync] fetched lobby:', {
            lobbyId: data.id,
            status: data.status,
            state_revision: data.state_revision ?? 0,
            playerCount: data.players?.length || 0,
            current_question_id: data.current_question_id || null,
            current_player_index: data.current_player_index ?? null,
          });
          applyLobbyData(data, 'initial-fetch');
        } else if (!latestLobbyRef.current && activeLobbyId && initPlayers && initPlayers.length > 0) {
          // Route state is bootstrap-only and only applies before any live lobby data exists.
          applyLobbyData(buildRouteFallback(), 'route-state-fallback');
        } else if (latestLobbyRef.current) {
          debugWarn('[useLobbySync] initial fetch returned empty after live data; ignoring route fallback');
        } else {
          setError('Lobi yüklenemedi: canlı lobi bulunamadı.');
        }
      } catch (err) {
        if (cancelled) return;
        // Route state is bootstrap-only and must not replace already fetched/subscribed lobby data.
        if (!latestLobbyRef.current && activeLobbyId && initPlayers && initPlayers.length > 0) {
          applyLobbyData(buildRouteFallback(), 'route-state-error-fallback');
        } else if (!latestLobbyRef.current) {
          setError('Lobi yüklenemedi: ' + err.message);
        } else {
          debugWarn('[useLobbySync] initial fetch failed after live data; preserving latest lobby:', err.message);
        }
      }

      if (cancelled || !activeLobbyId) return;

      // Realtime subscription — Android Flow'a eşdeğer
      if (unsubRef.current) unsubRef.current();
      const unsub = base44.entities.Lobby.subscribe((event) => {
        const eventType = event?.type || event?.eventType || 'update';
        const updatedLobby = event?.data || event;
        const receivedLobbyId = updatedLobby?.id || event?.id;
        if (receivedLobbyId !== activeLobbyId) return;

        addGameLog(`SUB event=${eventType} idx=${updatedLobby?.current_player_index} status=${updatedLobby?.status}`);
        debugLog('[useLobbySync] subscription event:', {
          subscriptionEventReceived: true,
          eventType,
          receivedLobbyId,
          status: updatedLobby?.status,
          state_revision: updatedLobby?.state_revision ?? null,
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

      pollIntervalId = window.setInterval(async () => {
        try {
          const fresh = await base44.entities.Lobby.get(activeLobbyId);
          if (!fresh) return;

          const previous = latestLobbyRef.current;
          const freshLobby = normalizeLobbyState(fresh, previous || {});
          const hasChanged =
            !previous ||
            previous.state_revision !== freshLobby.state_revision ||
            previous.current_player_index !== freshLobby.current_player_index ||
            previous.current_question_id !== freshLobby.current_question_id ||
            previous.status !== freshLobby.status ||
            JSON.stringify(previous.used_question_ids || []) !== JSON.stringify(freshLobby.used_question_ids || []) ||
            JSON.stringify(summarizePlayers(previous.players || [])) !== JSON.stringify(summarizePlayers(freshLobby.players || []));

          debugLog('[useLobbySync] poll check:', {
            lobbyId: freshLobby.id,
            hasChanged,
            status: freshLobby.status,
            state_revision: freshLobby.state_revision ?? 0,
            current_player_index: freshLobby.current_player_index ?? null,
            current_question_id: freshLobby.current_question_id || null,
            used_question_count: freshLobby.used_question_ids?.length || 0,
            players: summarizePlayers(freshLobby.players || []),
          });

          if (hasChanged) {
            applyLobbyData(freshLobby, 'poll');
          }
        } catch (err) {
          debugWarn('[useLobbySync] poll failed:', err.message);
        }
      }, 1500);
    };

    startSync();

    return () => {
      cancelled = true;
      if (unsubRef.current) unsubRef.current();
      if (pollIntervalId) window.clearInterval(pollIntervalId);
    };
  }, [lobbyId, lobbyCode, setLobbyData, setWinner, setError, onLobbyResolved]);

  return { unsubRef };
}
