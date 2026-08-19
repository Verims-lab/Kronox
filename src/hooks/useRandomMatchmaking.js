import { useCallback, useEffect, useRef, useState } from 'react';
import {
  joinRandomMatchmaking,
  pollRandomMatchmaking,
  cancelRandomMatchmaking,
} from '@/lib/randomMatchmakingApi';
import { STANDARD_RANDOM_MODE } from '@/lib/onlineModeDisplay';

// Codex591 — Random matchmaking (Rastgele Eşleş) lifecycle hook.
// Owns join → poll → matched/timeout/cancel state so the Pre-game
// Hourglass screen only needs to render the current phase.
const POLL_INTERVAL_MS = 1250;

function localExpiryFromServer(data) {
  const expiresAt = Date.parse(data?.expiresAt || '');
  const serverNow = Date.parse(data?.serverNow || '');
  if (!Number.isFinite(expiresAt)) return null;
  if (!Number.isFinite(serverNow)) return data.expiresAt;
  return new Date(Date.now() + Math.max(0, expiresAt - serverNow)).toISOString();
}

export default function useRandomMatchmaking(mode = STANDARD_RANDOM_MODE) {
  const [phase, setPhase] = useState('idle'); // idle | joining | waiting | checking | matched | timeout | error
  const [expiresAt, setExpiresAt] = useState(null);
  const [lobbyRef, setLobbyRef] = useState('');
  const [lobbyCode, setLobbyCode] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const pollRef = useRef(null);
  const mountedRef = useRef(true);
  const sessionRef = useRef(0);
  const pollPendingRef = useRef(false);
  const phaseRef = useRef('idle');

  const updatePhase = useCallback((nextPhase) => {
    phaseRef.current = nextPhase;
    setPhase(nextPhase);
  }, []);

  const clearPollTimer = useCallback(() => {
    if (pollRef.current) {
      window.clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const stopPolling = useCallback(() => {
    sessionRef.current += 1;
    pollPendingRef.current = false;
    clearPollTimer();
  }, [clearPollTimer]);

  const applyState = useCallback((data) => {
    if (!data) return 'unknown';
    if (data.matched || data.status === 'matched') {
      setLobbyRef(data.lobbyRef || '');
      setLobbyCode(data.lobbyCode || '');
      setErrorMessage('');
      updatePhase('matched');
      stopPolling();
      return 'matched';
    }
    if (['timeout', 'expired', 'cancelled'].includes(data.status)) {
      setErrorMessage('Eşleşme bulunamadı, tekrar dene.');
      updatePhase('timeout');
      stopPolling();
      return 'timeout';
    }
    setExpiresAt(localExpiryFromServer(data));
    setErrorMessage('');
    updatePhase('waiting');
    return 'waiting';
  }, [stopPolling, updatePhase]);

  const pollOnce = useCallback(async (sessionId) => {
    if (!mountedRef.current || sessionRef.current !== sessionId || pollPendingRef.current) return null;
    pollPendingRef.current = true;
    try {
      const data = await pollRandomMatchmaking(mode);
      if (!mountedRef.current || sessionRef.current !== sessionId) return data;
      applyState(data);
      return data;
    } catch {
      if (mountedRef.current && sessionRef.current === sessionId) {
        updatePhase('checking');
        setErrorMessage('Bağlantı kontrol ediliyor.');
      }
      return null;
    } finally {
      pollPendingRef.current = false;
    }
  }, [applyState, mode, updatePhase]);

  const start = useCallback(async () => {
    stopPolling();
    const sessionId = sessionRef.current;
    const isActiveSession = () => mountedRef.current && sessionRef.current === sessionId;
    updatePhase('joining');
    setErrorMessage('');
    setExpiresAt(null);
    setLobbyRef('');
    setLobbyCode('');
    try {
      const data = await joinRandomMatchmaking(mode);
      if (!isActiveSession()) return;
      const next = applyState(data);
      if (next === 'waiting') {
        await pollOnce(sessionId);
        if (isActiveSession() && phaseRef.current !== 'matched' && phaseRef.current !== 'timeout') {
          pollRef.current = window.setInterval(() => {
            void pollOnce(sessionId);
          }, POLL_INTERVAL_MS);
        }
      }
    } catch {
      if (!isActiveSession()) return;
      updatePhase('error');
      setErrorMessage('Eşleşme başlatılamadı. Lütfen tekrar dene.');
    }
  }, [applyState, mode, pollOnce, stopPolling, updatePhase]);

  const cancel = useCallback(async () => {
    stopPolling();
    updatePhase('idle');
    setErrorMessage('');
    await cancelRandomMatchmaking(mode).catch(() => null);
  }, [mode, stopPolling, updatePhase]);

  const resolveTimeout = useCallback(async () => {
    if (phaseRef.current === 'matched') return true;
    stopPolling();
    const sessionId = sessionRef.current;
    updatePhase('checking');
    setErrorMessage('Bağlantı kontrol ediliyor.');
    try {
      const data = await pollRandomMatchmaking(mode);
      if (!mountedRef.current || sessionRef.current !== sessionId) return phaseRef.current === 'matched';
      if (data?.matched || data?.status === 'matched') {
        applyState(data);
        return true;
      }
    } catch {
      // A final failed read is followed by best-effort backend cleanup and a
      // retry state; raw transport details never reach the public screen.
    }
    await cancelRandomMatchmaking(mode).catch(() => null);
    if (mountedRef.current && sessionRef.current === sessionId) {
      updatePhase('timeout');
      setErrorMessage('Eşleşme bulunamadı, tekrar dene.');
    }
    return false;
  }, [applyState, mode, stopPolling, updatePhase]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      stopPolling();
    };
  }, [stopPolling]);

  return { phase, expiresAt, lobbyRef, lobbyCode, errorMessage, start, cancel, resolveTimeout };
}
