// hooks/useHeaderNotifications.js
// Data + subscription layer for the shared header notification bell.
//
// Responsibilities (kept tiny and modular):
//   • Load incoming pending FriendRequest rows for the current user.
//   • Load incoming pending, non-expired GameInvite rows for the current user.
//   • Subscribe to FriendRequest / GameInvite realtime changes via the SDK.
//   • Refresh on app focus + visibilitychange.
//   • Expose totalCount, openGameInvite(invite), openFriendRequests().
//
// We DELIBERATELY DO NOT duplicate accept/expire logic — `openGameInvite`
// reuses `acceptGameInvite` from lib/inviteApi (which already enforces
// expiry + lobby-stale guards) and navigates to /lobby (lobby-first).

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import {
  loadIncomingInvites,
  openGameInvite as openGameInviteAction,
} from '@/lib/inviteApi';
import { isPendingFriendRequestForUser } from '@/lib/headerNotifications';
// Codex135 — Centralized active-invite selector. Header, Online panel,
// and toast notifier all read through this module so the badge/list
// can never disagree about whether a fresh invite is still active.
import {
  filterActiveIncomingGameInvites,
  getGameInviteActiveFilterReason,
  getInviteRecipientEmail,
  isActiveIncomingGameInvite,
  isInviteExpired,
  mergeActiveIncomingGameInvites,
  normalizeEmail,
  traceGameInviteLifecycle,
} from '@/lib/gameInviteSelectors';

const REFRESH_DEBOUNCE_MS = 250;

export function useHeaderNotifications(user) {
  const navigate = useNavigate();
  const myEmail = normalizeEmail(user?.email);

  const [friendRequests, setFriendRequests] = useState([]);
  const [gameInvites, setGameInvites] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const aliveRef = useRef(true);
  const refreshTimerRef = useRef(null);

  const fetchAll = useCallback(async ({ preserveExisting = false, source = 'fetch' } = {}) => {
    if (!myEmail) {
      setFriendRequests([]);
      setGameInvites([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [fr, gi] = await Promise.all([
        base44.entities.FriendRequest.filter(
          { to_email: myEmail, status: 'pending' },
          '-created_date',
          50,
        ).catch(() => []),
        loadIncomingInvites(myEmail).catch(() => []),
      ]);
      if (!aliveRef.current) return;
      const now = Date.now();
      setFriendRequests((fr || []).filter((r) => isPendingFriendRequestForUser(r, myEmail)));
      // Codex136 — shared active-incoming selector + merge-safe refresh.
      // Subscription events can arrive before the follow-up entity filter is
      // fully consistent, so preserve active rows during subscription follow-up.
      setGameInvites((prev) => {
        const next = preserveExisting
          ? mergeActiveIncomingGameInvites(prev, gi, myEmail, now)
          : filterActiveIncomingGameInvites(gi, myEmail, now);
        traceGameInviteLifecycle('header_badge_recalculated', { id: `count:${next.length}`, status: 'pending', to_email: myEmail }, {
          source: `useHeaderNotifications.${source}`,
          user,
          userEmail: myEmail,
          reason: preserveExisting ? 'preserve_existing_merge' : 'authoritative_replace',
        });
        return next;
      });
    } catch (err) {
      if (!aliveRef.current) return;
      setError(err?.message || 'Bildirimler yüklenemedi.');
    } finally {
      if (aliveRef.current) setLoading(false);
    }
  }, [myEmail, user]);

  const refresh = useCallback(() => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    refreshTimerRef.current = setTimeout(() => { fetchAll(); }, REFRESH_DEBOUNCE_MS);
  }, [fetchAll]);

  // Initial load + on user change.
  useEffect(() => {
    aliveRef.current = true;
    fetchAll();
    return () => {
      aliveRef.current = false;
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    };
  }, [fetchAll]);

  // Realtime subscriptions (FriendRequest + GameInvite).
  useEffect(() => {
    if (!myEmail) return undefined;
    const unsubs = [];
    try {
      const u1 = base44.entities.FriendRequest.subscribe?.(() => refresh());
      if (typeof u1 === 'function') unsubs.push(u1);
    } catch { /* subscription not available */ }
    try {
      const u2 = base44.entities.GameInvite.subscribe?.((event) => {
        const eventType = event?.type || event?.eventType || 'update';
        const invite = event?.data || event;
        if (eventType === 'delete') return;
        if (getInviteRecipientEmail(invite) !== myEmail) return;

        const reason = getGameInviteActiveFilterReason(invite, myEmail);
        traceGameInviteLifecycle(reason.startsWith('active') ? 'invite_passed_active_filter' : 'invite_failed_active_filter', invite, {
          source: `useHeaderNotifications.subscription:${eventType}`,
          user,
          userEmail: myEmail,
          reason,
        });

        if (reason.startsWith('active')) {
          setGameInvites((prev) => mergeActiveIncomingGameInvites(prev, [invite], myEmail));
          window.setTimeout(() => fetchAll({ preserveExisting: true, source: 'subscription_followup' }), 900);
        } else {
          setGameInvites((prev) => prev.filter((item) => item.id !== invite.id));
          refresh();
        }
      });
      if (typeof u2 === 'function') unsubs.push(u2);
    } catch { /* subscription not available */ }
    return () => {
      unsubs.forEach((fn) => { try { fn(); } catch { /* ignore */ } });
    };
  }, [fetchAll, myEmail, refresh, user]);

  // Focus + visibility fallback (also catches no-subscription environments).
  useEffect(() => {
    if (!myEmail) return undefined;
    const onFocus = () => refresh();
    const onVis = () => { if (document.visibilityState === 'visible') refresh(); };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [myEmail, refresh]);

  // Auto-prune expired invites every 30s so a panel left open eventually
  // drops stale entries even without an incoming push. Uses the shared
  // selector — a fresh invite (10-min TTL) will never be pruned here.
  useEffect(() => {
    if (gameInvites.length === 0) return undefined;
    const id = setInterval(() => {
      const now = Date.now();
      setGameInvites((prev) => prev.filter((i) => isActiveIncomingGameInvite(i, myEmail, now)));
    }, 30 * 1000);
    return () => clearInterval(id);
  }, [gameInvites.length, myEmail]);

  const totalCount = friendRequests.length + gameInvites.length;

  const openFriendRequests = useCallback(() => {
    navigate('/friends');
  }, [navigate]);

  const openGameInvite = useCallback(async (invite) => {
    if (!invite?.id) return { ok: false, reason: 'invalid' };
    if (isInviteExpired(invite)) {
      refresh();
      return { ok: false, reason: 'expired' };
    }
    try {
      const res = await openGameInviteAction(invite, {
        navigate,
        userEmail: myEmail,
        source: 'header_notifications',
        onAccepted: async () => refresh(),
      });
      return { ok: true, lobby: res?.lobby };
    } catch (err) {
      refresh();
      return { ok: false, reason: err?.message || 'accept_failed' };
    }
  }, [navigate, refresh]);

  return useMemo(() => ({
    friendRequests,
    gameInvites,
    totalCount,
    loading,
    error,
    refresh,
    openFriendRequests,
    openGameInvite,
  }), [friendRequests, gameInvites, totalCount, loading, error, refresh, openFriendRequests, openGameInvite]);
}
