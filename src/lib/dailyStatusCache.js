// Shared Daily status cache/scheduling helpers (Codex559).
//
// Single source of truth for the Daily Wheel and Daily Calendar status
// caching contract:
//   • 60s TTL in-memory status cache keyed per linked-or-guest actor per
//     UTC day, so reopening Home/Daily within the TTL renders instantly
//     from cache while a background refresh revalidates.
//   • Idle-scheduled (post-paint) status refresh so Home first render is
//     never blocked on Daily Wheel / Daily Calendar network status.
//
// These helpers are pure/config-only. Reward source of truth stays
// server-side; caching here is display-freshness only and must never be
// used to grant/claim anything client-side.

export const DAILY_STATUS_CACHE_TTL_MS = 60 * 1000;

export function todayFallbackKey() {
  return new Date().toISOString().slice(0, 10);
}

export function buildDailyStatusCacheKey(user, guestCredentials) {
  const email = String(user?.email || user?.user_email || '').trim().toLowerCase();
  const guestId = String(guestCredentials?.guest_id || '').trim();
  if (email) return `auth:${email}:${todayFallbackKey()}`;
  if (guestId) return `guest:${guestId}:${todayFallbackKey()}`;
  return null;
}

export function createDailyStatusStore(ttlMs = DAILY_STATUS_CACHE_TTL_MS) {
  const store = new Map();
  return {
    read(cacheKey) {
      if (!cacheKey) return null;
      const cached = store.get(cacheKey);
      if (!cached) return null;
      if (Date.now() - cached.cachedAt > ttlMs) {
        store.delete(cacheKey);
        return null;
      }
      return cached.body || null;
    },
    write(cacheKey, body) {
      if (!cacheKey || !body) return;
      store.set(cacheKey, { cachedAt: Date.now(), body });
    },
    invalidate(cacheKey = '') {
      if (cacheKey) {
        store.delete(cacheKey);
        return;
      }
      store.clear();
    },
  };
}

// Post-paint refresh scheduling: requestIdleCallback when available so the
// status fetch never competes with first render; setTimeout fallback keeps
// older WebViews working. Returns a cancel function for unmount cleanup.
export function scheduleIdleStatusRefresh(callback) {
  if (typeof window === 'undefined') {
    callback();
    return () => {};
  }
  if (typeof window.requestIdleCallback === 'function') {
    const id = window.requestIdleCallback(callback, { timeout: 2200 });
    return () => window.cancelIdleCallback?.(id);
  }
  const id = window.setTimeout(callback, 650);
  return () => window.clearTimeout(id);
}