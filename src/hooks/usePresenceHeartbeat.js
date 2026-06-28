import { useEffect, useMemo } from 'react';
import {
  PRESENCE_HEARTBEAT_MS,
  PRESENCE_STATUS,
  sendPresenceHeartbeat,
} from '@/lib/presence';
import { getStoredGuestCredentials } from '@/lib/guestProfile';

let runtimeSessionId = '';

function createSessionId() {
  try {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return `presence_${Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')}`;
  } catch {
    return `presence_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`;
  }
}

function getOrCreateRuntimeSessionId() {
  if (!runtimeSessionId) runtimeSessionId = createSessionId();
  return runtimeSessionId;
}

function getPresenceActor(user, guestProfile) {
  if (user?.email) {
    return {
      key: `linked:${String(user.email).trim().toLowerCase()}`,
      guestCredentials: null,
    };
  }

  const credentials = getStoredGuestCredentials();
  const guestId = String(guestProfile?.guest_id || credentials?.guest_id || '').trim();
  if (guestId && credentials?.guest_id === guestId && credentials?.guest_token) {
    return {
      key: `guest:${guestId}`,
      guestCredentials: {
        guest_id: credentials.guest_id,
        guest_token: credentials.guest_token,
      },
    };
  }

  return { key: '', guestCredentials: null };
}

export default function usePresenceHeartbeat(user, guestProfile = null) {
  const actor = useMemo(
    () => getPresenceActor(user, guestProfile),
    [guestProfile?.guest_id, user?.email],
  );
  const sessionId = useMemo(() => (actor.key ? getOrCreateRuntimeSessionId() : ''), [actor.key]);

  useEffect(() => {
    if (!actor.key || !sessionId) return undefined;

    let cancelled = false;
    const heartbeat = (status = PRESENCE_STATUS.ONLINE) => {
      if (cancelled) return;
      sendPresenceHeartbeat({
        sessionId,
        status,
        guestCredentials: actor.guestCredentials,
      }).catch(() => {
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
    const handleResume = () => {
      if (document.visibilityState === 'visible') heartbeat(PRESENCE_STATUS.ONLINE);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', handlePageHide);
    window.addEventListener('beforeunload', handlePageHide);
    window.addEventListener('focus', handleResume);
    window.addEventListener('online', handleResume);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pagehide', handlePageHide);
      window.removeEventListener('beforeunload', handlePageHide);
      window.removeEventListener('focus', handleResume);
      window.removeEventListener('online', handleResume);
      sendPresenceHeartbeat({
        sessionId,
        status: PRESENCE_STATUS.OFFLINE,
        guestCredentials: actor.guestCredentials,
      }).catch(() => {});
    };
  }, [actor.guestCredentials, actor.key, sessionId]);
}
