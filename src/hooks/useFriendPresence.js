import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  getFriendDisplayPresence,
  getPresenceLookupKeyForEmail,
  loadFriendPresence,
  PRESENCE_REFRESH_MS,
} from '@/lib/presence';

export default function useFriendPresence(friends, { enabled = true, pollMs = PRESENCE_REFRESH_MS } = {}) {
  const [presenceByKey, setPresenceByKey] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const friendPresenceKeys = useMemo(() => {
    return (Array.isArray(friends) ? friends : [])
      .map((friend) => friend?.presence_key || getPresenceLookupKeyForEmail(friend?.friend_email))
      .filter(Boolean)
      .sort()
      .join('|');
  }, [friends]);

  const refresh = useCallback(async () => {
    if (!enabled || !friendPresenceKeys) {
      setPresenceByKey({});
      setLoading(false);
      setError('');
      return {};
    }

    setLoading(true);
    setError('');
    try {
      const next = await loadFriendPresence(friends);
      setPresenceByKey(next);
      return next;
    } catch (err) {
      setError(err?.message || 'Arkadaş durumu yüklenemedi.');
      return {};
    } finally {
      setLoading(false);
    }
  }, [enabled, friendPresenceKeys, friends]);

  useEffect(() => {
    let cancelled = false;
    if (!enabled || !friendPresenceKeys) {
      setPresenceByKey({});
      setLoading(false);
      setError('');
      return undefined;
    }

    const run = async () => {
      if (cancelled) return;
      if (document.visibilityState !== 'visible') return;
      await refresh();
    };
    run();
    const intervalId = window.setInterval(run, pollMs);
    const handleResume = () => { run(); };
    document.addEventListener('visibilitychange', handleResume);
    window.addEventListener('focus', handleResume);
    window.addEventListener('online', handleResume);
    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleResume);
      window.removeEventListener('focus', handleResume);
      window.removeEventListener('online', handleResume);
    };
  }, [enabled, friendPresenceKeys, pollMs, refresh]);

  const getPresenceForFriend = useCallback((friend) => {
    return getFriendDisplayPresence(friend, presenceByKey);
  }, [presenceByKey]);

  return {
    presenceByKey,
    loading,
    error,
    refresh,
    getPresenceForFriend,
  };
}
