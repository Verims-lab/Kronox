import { useCallback, useEffect, useRef, useState } from 'react';
import {
  getLobbySnapshot,
  LOBBY_SNAPSHOT_SCOPES,
  startLobbyGame,
} from '@/lib/dbGateway/lobbyGateway';
import { consumeRandomMatchmaking } from '@/lib/randomMatchmakingApi';

const HANDOFF_POLL_MS = 900;
const HANDOFF_TIMEOUT_MS = 20 * 1000;
export const MATCH_FOUND_DISPLAY_MS = 1000;

export function hasAuthoritativeOnlineGamePayload(lobby) {
  if (!lobby?.id || !['starting', 'in_game'].includes(String(lobby?.status || ''))) return false;
  if (!Array.isArray(lobby?.players) || lobby.players.length < 2) return false;
  if (!lobby?.current_question_id) return false;
  return Array.isArray(lobby?.online_question_deck) && lobby.online_question_deck.length > 0;
}

function safeHandoffEvidence(lobby, startedAt) {
  return {
    observed: Boolean(lobby?.id),
    successful: hasAuthoritativeOnlineGamePayload(lobby),
    category: 'MATCH_FOUND_DIRECT_GAME',
    statusClass: String(lobby?.status || 'unknown'),
    safeSummary: lobby?.game_mode === 'same_question_duel'
      ? 'Duello authoritative game snapshot ready'
      : 'Online Kapış authoritative game snapshot ready',
    matchedTransitionMs: Math.max(0, Date.now() - startedAt),
  };
}

export default function useDirectOnlineGameHandoff({
  active,
  lobbyRef,
  initialLobby = null,
  queueMode = '',
  onGameReady,
}) {
  const [phase, setPhase] = useState(active ? 'matched' : 'idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [errorCategory, setErrorCategory] = useState(null);
  const [retryVersion, setRetryVersion] = useState(0);
  const readyRef = useRef(false);
  const initialLobbyRef = useRef(initialLobby);
  const onGameReadyRef = useRef(onGameReady);
  const errorPrefix = queueMode === 'same_question_duel' ? 'DUELLO' : 'ONLINE';

  useEffect(() => { initialLobbyRef.current = initialLobby; }, [initialLobby]);
  useEffect(() => { onGameReadyRef.current = onGameReady; }, [onGameReady]);

  const retry = useCallback(() => {
    readyRef.current = false;
    setErrorMessage('');
    setErrorCategory(null);
    setPhase('matched');
    setRetryVersion((value) => value + 1);
  }, []);

  useEffect(() => {
    if (!active || !lobbyRef) return undefined;

    let cancelled = false;
    let timerId = null;
    const matchedAt = Date.now();
    const deadline = matchedAt + HANDOFF_TIMEOUT_MS;
    readyRef.current = false;
    setPhase('matched');
    setErrorMessage('');
    setErrorCategory(null);

    const schedule = (task, delayMs) => {
      timerId = window.setTimeout(task, delayMs);
    };

    const finish = async (lobby) => {
      if (cancelled || readyRef.current) return;
      readyRef.current = true;
      setPhase('directStarting');
      const delayMs = Math.max(0, MATCH_FOUND_DISPLAY_MS - (Date.now() - matchedAt));
      schedule(async () => {
        if (cancelled) return;
        if (queueMode) await consumeRandomMatchmaking(queueMode).catch(() => null);
        if (cancelled) return;
        onGameReadyRef.current?.(lobby, safeHandoffEvidence(lobby, matchedAt));
      }, delayMs);
    };

    const reconcile = async () => {
      if (cancelled || readyRef.current) return;
      if (Date.now() >= deadline) {
        setPhase('failed');
        setErrorMessage('Lütfen tekrar dene.');
        setErrorCategory(`${errorPrefix}_DIRECT_START_PAYLOAD_MISSING`);
        return;
      }

      try {
        const response = await getLobbySnapshot({
          lobbyId: lobbyRef,
          scope: LOBBY_SNAPSHOT_SCOPES.GAME,
        });
        let lobby = response?.data?.lobby || initialLobbyRef.current;
        if (!lobby?.id) throw new Error('match_snapshot_missing');
        if (['cancelled', 'expired'].includes(String(lobby.status || ''))) {
          setPhase('failed');
          setErrorMessage('Lütfen tekrar dene.');
          setErrorCategory(`${errorPrefix}_DIRECT_START_PAYLOAD_MISSING`);
          return;
        }

        if (hasAuthoritativeOnlineGamePayload(lobby)) {
          await finish(lobby);
          return;
        }

        if (lobby.status === 'waiting' && lobby.current_actor_is_host === true) {
          setPhase('directStarting');
          const started = await startLobbyGame(lobby.id, lobby.state_revision);
          lobby = started?.data?.lobby || lobby;
          if (hasAuthoritativeOnlineGamePayload(lobby)) {
            await finish(lobby);
            return;
          }
        }

        schedule(reconcile, HANDOFF_POLL_MS);
      } catch {
        if (!cancelled) schedule(reconcile, HANDOFF_POLL_MS);
      }
    };

    void reconcile();
    return () => {
      cancelled = true;
      if (timerId) window.clearTimeout(timerId);
    };
  }, [active, errorPrefix, lobbyRef, queueMode, retryVersion]);

  return { phase, errorMessage, errorCategory, retry };
}
