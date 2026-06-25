import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  getFriendDisplayPresence,
  getPresenceLookupKeyForEmail,
  loadFriendPresence,
  PRESENCE_HEARTBEAT_MS,
} from '@/lib/presence';

export default function useFriendPresence(friends, { enabled = true, pollMs = PRESENCE_HEARTBEAT_MS } = {}) {
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
      setPresenceByKey({});
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
      await refresh();
    };
    run();
    const intervalId = window.setInterval(run, pollMs);
    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
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
