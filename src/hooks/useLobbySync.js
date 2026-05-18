/**
 * useLobbySync — Online lobi senkronizasyonu hook'u.
 * Android mimarisi önerileri: Repository pattern + reactive data source.
 * Lobby subscription ve ilk yükleme işlemlerini UI'dan ayırır.
 */
import { useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { addGameLog } from '@/components/game/GameDebugLog';

export function useLobbySync({
  lobbyId,
  initialPlayers,
  currentQuestionIdFromState,
  setLobbyData,
  setWinner,
  setError,
}) {
  const unsubRef = useRef(null);
  // initialPlayers referansını sabitle — dependency döngüsünü önler
  const initialPlayersRef = useRef(initialPlayers);
  const currentQuestionIdRef = useRef(currentQuestionIdFromState);

  useEffect(() => {
    if (!lobbyId) return;

    const initPlayers = initialPlayersRef.current;
    const initQuestionId = currentQuestionIdRef.current;

    // İlk yükleme — always fetch fresh DB state to get correct current_player_index
    base44.entities.Lobby.get(lobbyId)
      .then(data => {
        if (data) {
          console.log('[useLobbySync] fetched lobby:', {
            lobbyId: data.id,
            status: data.status,
            playerCount: data.players?.length || 0,
            current_question_id: data.current_question_id || null,
            current_player_index: data.current_player_index ?? null,
          });
          setLobbyData(data);
        } else if (initPlayers && initPlayers.length > 0) {
          // Fallback to route state if DB fetch returns nothing
          const usedIds = [
            initQuestionId,
            ...initPlayers.flatMap(p => p.cards?.map(c => c.id) || [])
          ].filter(Boolean);
          setLobbyData({
            players: initPlayers,
            current_player_index: 0,
            current_question_id: initQuestionId,
            used_question_ids: usedIds,
          });
        }
      })
      .catch(err => {
        // Fallback to route state on error
        if (initPlayers && initPlayers.length > 0) {
          const usedIds = [
            initQuestionId,
            ...initPlayers.flatMap(p => p.cards?.map(c => c.id) || [])
          ].filter(Boolean);
          setLobbyData({
            players: initPlayers,
            current_player_index: 0,
            current_question_id: initQuestionId,
            used_question_ids: usedIds,
          });
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
      console.log('[useLobbySync] subscription event:', {
        eventType,
        receivedLobbyId,
        status: updatedLobby?.status,
        playerCount: updatedLobby?.players?.length || 0,
        current_question_id: updatedLobby?.current_question_id || null,
        current_player_index: updatedLobby?.current_player_index ?? null,
      });

      if (eventType === 'delete') {
        setLobbyData(null);
        setError('Lobi kapatıldı.');
        return;
      }
      if (updatedLobby.status === 'finished' && updatedLobby.winner) {
        setWinner({ name: updatedLobby.winner });
      }
      setLobbyData(updatedLobby);
    });
    unsubRef.current = unsub;

    return () => {
      if (unsubRef.current) unsubRef.current();
    };
  }, [lobbyId, setLobbyData, setWinner, setError]);

  return { unsubRef };
}
