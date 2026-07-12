/**
 * useLobbySync — Online lobi senkronizasyonu hook'u.
 * Android mimarisi önerileri: Repository pattern + reactive data source.
 * Lobby subscription ve ilk yükleme işlemlerini UI'dan ayırır.
 */
import { useEffect, useRef } from 'react';
import { addGameLog } from '@/components/game/GameDebugLog';
import { debugLog, debugWarn } from '@/lib/debugLog';
import { normalizeLobbyState, summarizeLobbyShape } from '@/lib/lobbyState';
import { getLobbySnapshot } from '@/lib/dbGateway/lobbyGateway';

const summarizePlayers = (players = []) =>
  players.map(p => ({
    name: p.name,
    participantRef: p.participant_ref || null,
    cardCount: p.cards?.length || 0,
  }));

const toWinnerState = (data) => {
  if (data?.status !== 'finished' || !data?.winner) return null;
  return {
    name: typeof data.winner === 'object' ? data.winner.name : data.winner,
    email: null,
    participantRef: data.winner_participant_ref || null,
  };
};

const normalizeLobbyCode = (code) =>
  String(code || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '')
    .replace(/[^\w]/g, '');

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

export function useLobbySync({
  lobbyId,
  lobbyCode,
  initialPlayers,
  currentQuestionIdFromState,
  setLobbyData,
  setWinner,
  setError,
  onLobbyResolved,
  initialOnlineQuestionDeck = [],
  initialOnlineDeckMeta = null,
}) {
  const unsubRef = useRef(null);
  const latestLobbyRef = useRef(null);
  // initialPlayers referansını sabitle — dependency döngüsünü önler
  const initialPlayersRef = useRef(initialPlayers);
  const currentQuestionIdRef = useRef(currentQuestionIdFromState);
  const initialOnlineQuestionDeckRef = useRef(initialOnlineQuestionDeck);
  const initialOnlineDeckMetaRef = useRef(initialOnlineDeckMeta);

  useEffect(() => {
    if (!lobbyId && !lobbyCode) return;

    let cancelled = false;
    let pollIntervalId = null;
    let focusHandler = null;
    let visibilityHandler = null;
    let activeLobbyId = lobbyId || null;

    const initPlayers = initialPlayersRef.current;
    const initQuestionId = currentQuestionIdRef.current;
    const initOnlineQuestionDeck = initialOnlineQuestionDeckRef.current;
    const initOnlineDeckMeta = initialOnlineDeckMetaRef.current;

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
        online_question_deck: Array.isArray(initOnlineQuestionDeck) ? initOnlineQuestionDeck : [],
        online_deck_meta: initOnlineDeckMeta || null,
        status: 'starting',
      };
    };

    const applyLobbyData = (data, source) => {
      const previousLobbyData = latestLobbyRef.current;
      const nextLobbyData = normalizeLobbyState(data, previousLobbyData || {});
      if (previousLobbyData) {
        const prevRevision = readLobbyRevision(previousLobbyData);
        const nextRevision = readLobbyRevision(nextLobbyData);
        const prevStatusRank = getStatusRank(previousLobbyData.status);
        const nextStatusRank = getStatusRank(nextLobbyData.status);
        if (nextRevision < prevRevision || (nextRevision === prevRevision && nextStatusRank < prevStatusRank)) {
          debugWarn('[useLobbySync] stale lobby snapshot ignored:', {
            source,
            lobbyId: nextLobbyData.id || activeLobbyId,
            prevRevision,
            nextRevision,
            previousStatus: previousLobbyData.status,
            nextStatus: nextLobbyData.status,
          });
          return;
        }
      }
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
        winner_participant_ref: nextLobbyData.winner_participant_ref || null,
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
          winner_participant_ref: winnerState.participantRef || null,
          currentScreenState: 'online-game',
          renderedGameOver: true,
        });
        addGameLog(`WINNER source=${source} winner=${winnerState.name}`);
        setWinner({ ...winnerState });
      }
    };

    const resolveInitialLobby = async () => {
      const normalizedCode = normalizeLobbyCode(lobbyCode);
      if (!activeLobbyId && !normalizedCode) return null;
      const response = await getLobbySnapshot({ lobbyId: activeLobbyId, code: normalizedCode });
      return response?.data?.lobby || null;
    };

    // Codex083 — Host bootstrap retry. The first fetch race-loses against the
    // post-start write on slow networks more often than expected; without a
    // retry the host gets a stuck loading screen while Player 2 enters fine
    // via subscription. We retry up to 4 times with light backoff before
    // giving up to the existing route-state / error paths below.
    const resolveInitialLobbyWithRetry = async () => {
      const delays = [0, 350, 700, 1200];
      for (let attempt = 0; attempt < delays.length; attempt += 1) {
        if (cancelled) return null;
        if (delays[attempt]) await new Promise(r => setTimeout(r, delays[attempt]));
        try {
          const fetched = await resolveInitialLobby();
          if (fetched) return fetched;
        } catch (err) {
          if (attempt === delays.length - 1) throw err;
          debugWarn('[useLobbySync] initial fetch attempt failed, retrying:', { attempt, error: err.message });
        }
      }
      return null;
    };

    const refreshLiveLobby = async (source) => {
      if (cancelled || !activeLobbyId) return;
      try {
        const response = await getLobbySnapshot({ lobbyId: activeLobbyId });
        const fresh = response?.data?.lobby;
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

        debugLog('[useLobbySync] live snapshot check:', {
          source,
          lobbyId: freshLobby.id,
          hasChanged,
          status: freshLobby.status,
          state_revision: freshLobby.state_revision ?? 0,
          current_player_index: freshLobby.current_player_index ?? null,
          current_question_id: freshLobby.current_question_id || null,
          used_question_count: freshLobby.used_question_ids?.length || 0,
          players: summarizePlayers(freshLobby.players || []),
        });

        if (hasChanged) applyLobbyData(freshLobby, source);
      } catch (err) {
        debugWarn(`[useLobbySync] ${source} refresh failed:`, err.message);
      }
    };

    const startSync = async () => {
      try {
        // İlk yükleme — always fetch fresh DB state to get correct current_player_index.
        // Codex083: retry with backoff so the host doesn't black-screen if the
        // first fetch races the post-start write.
        const data = await resolveInitialLobbyWithRetry();
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

      // Direct Lobby subscriptions are intentionally unavailable because
      // client entity reads are private after Hamle 2. Polling plus immediate
      // focus/visibility refreshes provide the live sanitized snapshot path.
      pollIntervalId = window.setInterval(() => {
        void refreshLiveLobby('poll');
      }, 1800);
      focusHandler = () => { void refreshLiveLobby('window-focus'); };
      visibilityHandler = () => {
        if (document.visibilityState === 'visible') {
          void refreshLiveLobby('visibility-refresh');
        }
      };
      window.addEventListener('focus', focusHandler);
      document.addEventListener('visibilitychange', visibilityHandler);
    };

    startSync();

    return () => {
      cancelled = true;
      if (unsubRef.current) unsubRef.current();
      if (pollIntervalId) window.clearInterval(pollIntervalId);
      if (focusHandler) window.removeEventListener('focus', focusHandler);
      if (visibilityHandler) document.removeEventListener('visibilitychange', visibilityHandler);
    };
  }, [lobbyId, lobbyCode, setLobbyData, setWinner, setError, onLobbyResolved]);

  return { unsubRef };
}
