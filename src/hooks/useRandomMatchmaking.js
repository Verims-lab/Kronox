import { useCallback, useEffect, useRef, useState } from 'react';
import {
  joinRandomMatchmaking,
  pollRandomMatchmaking,
  cancelRandomMatchmaking,
} from '@/lib/randomMatchmakingApi';

// Codex591 — Random matchmaking (Rastgele Eşleş) lifecycle hook.
// Owns join → poll → matched/timeout/cancel state so the Pre-game
// Hourglass screen only needs to render the current phase.
const POLL_INTERVAL_MS = 1500;

export default function useRandomMatchmaking(mode = 'random_online') {
  const [phase, setPhase] = useState('idle'); // idle | queuing | matched | timeout | error
  const [expiresAt, setExpiresAt] = useState(null);
  const [lobbyRef, setLobbyRef] = useState('');
  const [lobbyCode, setLobbyCode] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const pollRef = useRef(null);
  const mountedRef = useRef(true);
  const sessionRef = useRef(0);
  const pollPendingRef = useRef(false);

  const stopPolling = useCallback(() => {
    sessionRef.current += 1;
    pollPendingRef.current = false;
    if (pollRef.current) {
      window.clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const applyState = useCallback((data) => {
    if (!data) return;
    if (data.matched || data.status === 'matched') {
      setLobbyRef(data.lobbyRef || '');
      setLobbyCode(data.lobbyCode || '');
      setPhase('matched');
      stopPolling();
      return;
    }
    if (['timeout', 'expired', 'cancelled'].includes(data.status)) {
      setPhase('timeout');
      stopPolling();
      return;
    }
    setExpiresAt(data.expiresAt || null);
  }, [stopPolling]);

  const start = useCallback(async () => {
    stopPolling();
    const sessionId = sessionRef.current;
    const isActiveSession = () => mountedRef.current && sessionRef.current === sessionId;
    setPhase('queuing');
    setErrorMessage('');
    setLobbyRef('');
    setLobbyCode('');
    try {
      const data = await joinRandomMatchmaking(mode);
      if (!isActiveSession()) return;
      applyState(data);
      if (data.status === 'waiting') {
        pollRef.current = window.setInterval(async () => {
          if (!isActiveSession() || pollPendingRef.current) return;
          pollPendingRef.current = true;
          try {
            const polled = await pollRandomMatchmaking(mode);
            if (isActiveSession()) applyState(polled);
          } catch {
            if (isActiveSession()) setErrorMessage('Bağlantı kurulamadı. Lütfen tekrar dene.');
          } finally {
            pollPendingRef.current = false;
          }
        }, POLL_INTERVAL_MS);
      }
    } catch {
      if (!isActiveSession()) return;
      setPhase('error');
      setErrorMessage('Rastgele eşleşme başlatılamadı. Lütfen tekrar dene.');
    }
  }, [applyState, mode, stopPolling]);

  const cancel = useCallback(async () => {
    stopPolling();
    setPhase('idle');
    await cancelRandomMatchmaking(mode).catch(() => null);
  }, [mode, stopPolling]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      stopPolling();
    };
  }, [stopPolling]);

  return { phase, expiresAt, lobbyRef, lobbyCode, errorMessage, start, cancel };
}