import { useEffect, useMemo } from 'react';
import {
  PRESENCE_HEARTBEAT_MS,
  PRESENCE_STATUS,
  sendPresenceHeartbeat,
} from '@/lib/presence';

const STORAGE_KEY = 'kronox.presence.session_id';

function createSessionId() {
  try {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return `presence_${Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')}`;
  } catch {
    return `presence_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`;
  }
}

function getOrCreateSessionId() {
  try {
    const existing = localStorage.getItem(STORAGE_KEY);
    if (/^presence_[A-Za-z0-9_-]{12,80}$/.test(existing || '')) return existing;
    const created = createSessionId();
    localStorage.setItem(STORAGE_KEY, created);
    return created;
  } catch {
    return createSessionId();
  }
}

export default function usePresenceHeartbeat(user) {
  const sessionId = useMemo(() => (user?.email ? getOrCreateSessionId() : ''), [user?.email]);

  useEffect(() => {
    if (!user?.email || !sessionId) return undefined;

    let cancelled = false;
    const heartbeat = (status = PRESENCE_STATUS.ONLINE) => {
      if (cancelled) return;
      sendPresenceHeartbeat({ sessionId, status }).catch(() => {
        // Presence is best-effort; gameplay and invite flows must not block on it.
      });
    };

    heartbeat(PRESENCE_STATUS.ONLINE);
    const intervalId = window.setInterval(() => {
      if (document.visibilityState === 'visible') heartbeat(PRESENCE_STATUS.ONLINE);
    }, PRESENCE_HEARTBEAT_MS);

    const handleVisibilityChange = () => {
      heartbeat(document.visibilityState === 'hidden' ? PRESENCE_STATUS.OFFLINE : PRESENCE_STATUS.ONLINE);
    };
    const handlePageHide = () => heartbeat(PRESENCE_STATUS.OFFLINE);

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', handlePageHide);
    window.addEventListener('beforeunload', handlePageHide);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pagehide', handlePageHide);
      window.removeEventListener('beforeunload', handlePageHide);
      sendPresenceHeartbeat({ sessionId, status: PRESENCE_STATUS.OFFLINE }).catch(() => {});
    };
  }, [sessionId, user?.email]);
}
