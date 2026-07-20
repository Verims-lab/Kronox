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

export default function useRandomMatchmaking() {
  const [phase, setPhase] = useState('idle'); // idle | queuing | matched | timeout | error
  const [expiresAt, setExpiresAt] = useState(null);
  const [lobbyRef, setLobbyRef] = useState('');
  const [lobbyCode, setLobbyCode] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const pollRef = useRef(null);

  const stopPolling = useCallback(() => {
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
    setPhase('queuing');
    setErrorMessage('');
    setLobbyRef('');
    setLobbyCode('');
    try {
      const data = await joinRandomMatchmaking();
      applyState(data);
      if (data.status === 'waiting') {
        pollRef.current = window.setInterval(async () => {
          try {
            const polled = await pollRandomMatchmaking();
            applyState(polled);
          } catch (err) {
            setErrorMessage(err?.message || 'Eşleşme kontrol edilemedi.');
          }
        }, POLL_INTERVAL_MS);
      }
    } catch (err) {
      setPhase('error');
      setErrorMessage(err?.message || 'Eşleşme başlatılamadı.');
    }
  }, [applyState, stopPolling]);

  const cancel = useCallback(async () => {
    stopPolling();
    setPhase('idle');
    await cancelRandomMatchmaking().catch(() => null);
  }, [stopPolling]);

  useEffect(() => () => stopPolling(), [stopPolling]);

  return { phase, expiresAt, lobbyRef, lobbyCode, errorMessage, start, cancel };
}