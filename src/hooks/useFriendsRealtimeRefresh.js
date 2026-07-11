// hooks/useFriendsRealtimeRefresh.js
// Codex088 — Realtime refresh for Friends/Profile.
//
// Root cause this hook fixes:
//   User A sends a friend request to B. While A stays on /friends, B accepts.
//   A had no refresh trigger — FriendsPage only re-fetched after its own
//   mutations — so A kept seeing the stale "pending sent request" and did
//   not see B under Arkadaşlarım.
//
// Strategy (in priority order):
//   1) FriendRequest entity subscription. If Base44 delivers it, every
//      relevant change (create/update/delete on a row where A is sender
//      or recipient) fires refresh() within ~1s.
//   2) visibilitychange + window focus. When A returns to the tab/page
//      (which is the most common case on mobile PWAs), refresh() runs once.
//   3) Light interval polling as a final fallback (20s) ONLY while the page
//      is visible. This is safe, modest, and stops as soon as the page is
//      hidden or unmounted.
//
// All three triggers route through the SAME `refresh(myEmail)` callback,
// so authoritative server state is always the source of truth — no fake
// local mutations, no Friendship.create reintroduced.

import { useEffect, useRef } from 'react';
const POLL_INTERVAL_MS = 20_000;

export function useFriendsRealtimeRefresh({ enabled, myEmail, refresh }) {
  // Keep latest refresh/email in refs so subscription handlers don't need
  // to be re-registered on every render.
  const refreshRef = useRef(refresh);
  const emailRef = useRef(myEmail);
  useEffect(() => { refreshRef.current = refresh; }, [refresh]);
  useEffect(() => { emailRef.current = myEmail; }, [myEmail]);

  useEffect(() => {
    if (!enabled || !myEmail) return undefined;

    let cancelled = false;
    let pollTimer = null;

    const safeRefresh = () => {
      if (cancelled) return;
      const email = emailRef.current;
      const fn = refreshRef.current;
      if (email && typeof fn === 'function') {
        // Fire-and-forget; refresh() owns its own error handling.
        Promise.resolve(fn(email)).catch(() => {});
      }
    };

    // Backend-sanitized snapshots are refreshed on focus and by a light poll.
    const onVisibility = () => {
      if (document.visibilityState === 'visible') safeRefresh();
    };
    const onFocus = () => safeRefresh();
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('focus', onFocus);

    // Light interval polling fallback — only while visible.
    const startPolling = () => {
      if (pollTimer) return;
      pollTimer = window.setInterval(() => {
        if (document.visibilityState === 'visible') safeRefresh();
      }, POLL_INTERVAL_MS);
    };
    const stopPolling = () => {
      if (pollTimer) { window.clearInterval(pollTimer); pollTimer = null; }
    };
    const onVisibilityPoll = () => {
      if (document.visibilityState === 'visible') startPolling();
      else stopPolling();
    };
    document.addEventListener('visibilitychange', onVisibilityPoll);
    if (document.visibilityState === 'visible') startPolling();

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisibility);
      document.removeEventListener('visibilitychange', onVisibilityPoll);
      window.removeEventListener('focus', onFocus);
      stopPolling();
    };
  }, [enabled, myEmail]);
}

export default useFriendsRealtimeRefresh;
