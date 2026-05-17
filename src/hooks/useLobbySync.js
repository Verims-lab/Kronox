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
      if (event.id !== lobbyId) return;
      addGameLog(`SUB event=${event.type} idx=${event.data?.current_player_index} status=${event.data?.status}`);

      if (event.type === 'delete') {
        setLobbyData(null);
        setError('Lobi kapatıldı.');
        return;
      }
      if (event.data.status === 'finished' && event.data.winner) {
        setWinner({ name: event.data.winner });
      }
      setLobbyData(event.data);
    });
    unsubRef.current = unsub;

    return () => {
      if (unsubRef.current) unsubRef.current();
    };
  }, [lobbyId, setLobbyData, setWinner, setError]);

  return { unsubRef };
}