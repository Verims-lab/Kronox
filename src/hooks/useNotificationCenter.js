import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react';
import { base44 } from '@/api/base44Client';
import {
  loadIncomingInviteSnapshot,
  openGameInvite as openGameInviteAction,
  rejectGameInvite as rejectGameInviteAction,
} from '@/lib/inviteApi';
import { isPendingFriendRequestForUser } from '@/lib/headerNotifications';
import { buildNotificationViewModel } from '@/lib/notificationViewModel';
import {
  getGameInviteActiveFilterReason,
  getInviteRecipientEmail,
  getInviteSenderEmail,
  isActiveIncomingGameInvite,
  mergeActiveIncomingGameInvites,
  normalizeEmail,
  traceGameInviteLifecycle,
} from '@/lib/gameInviteSelectors';

const POLL_INTERVAL_MS = 20000;
const REFRESH_DEBOUNCE_MS = 250;
const ACTIVE_PRUNE_INTERVAL_MS = 30000;

const initialState = {
  email: '',
  currentUser: null,
  friendRequests: [],
  gameInvites: [],
  dismissedToastIds: new Set(),
  acceptedOutgoingInvites: [],
  loading: false,
  error: null,
  bootstrapped: false,
  lastFetchedAt: 0,
};

let state = initialState;
const listeners = new Set();
let stopSubscriptions = null;
let pollTimer = null;
let pruneTimer = null;
let refreshTimer = null;
let inFlightFetch = null;
const handledAcceptedOutgoingIds = new Set();

function emit(next) {
  state = next;
  listeners.forEach((listener) => listener());
}

function patchState(patch) {
  emit({ ...state, ...patch });
}

function updateState(updater) {
  emit(updater(state));
}

function stopNotificationCenter() {
  if (stopSubscriptions) {
    try { stopSubscriptions(); } catch { /* ignore cleanup */ }
    stopSubscriptions = null;
  }
  if (pollTimer) window.clearInterval(pollTimer);
  if (pruneTimer) window.clearInterval(pruneTimer);
  if (refreshTimer) window.clearTimeout(refreshTimer);
  pollTimer = null;
  pruneTimer = null;
  refreshTimer = null;
  inFlightFetch = null;
}

function removeInvite(inviteId) {
  if (!inviteId) return;
  updateState((prev) => ({
    ...prev,
    gameInvites: prev.gameInvites.filter((invite) => invite.id !== inviteId),
  }));
}

async function fetchNotificationCenter({ preserveExisting = true, source = 'fetch' } = {}) {
  const email = state.email;
  if (!email) {
    patchState({ loading: false });
    return state;
  }
  if (inFlightFetch) return inFlightFetch;

  patchState({ loading: true, error: null });
  inFlightFetch = Promise.all([
    base44.entities.FriendRequest.filter(
      { to_email: email, status: 'pending' },
      '-created_date',
      50,
    ).catch(() => []),
    loadIncomingInviteSnapshot(email),
  ]).then(([friendRows, inviteSnapshot]) => {
    const now = Date.now();
    updateState((prev) => {
      if (prev.email !== email) return prev;
      const nextInvites = mergeActiveIncomingGameInvites(
        preserveExisting ? prev.gameInvites : [],
        inviteSnapshot?.rows || [],
        email,
        now,
      );
      traceGameInviteLifecycle('notification_center_fetch_merged', { id: `count:${nextInvites.length}`, status: 'pending', to_email: email }, {
        source: `useNotificationCenter.${source}`,
        user: prev.currentUser,
        userEmail: email,
        reason: (inviteSnapshot?.rows || []).length === 0 && prev.gameInvites.length > 0
          ? 'stale_empty_fetch_preserved'
          : 'lifecycle_merge',
      });
      return {
        ...prev,
        friendRequests: (friendRows || []).filter((row) => isPendingFriendRequestForUser(row, email)),
        gameInvites: nextInvites,
        loading: false,
        error: null,
        bootstrapped: true,
        lastFetchedAt: now,
      };
    });
    return state;
  }).catch((error) => {
    updateState((prev) => ({
      ...prev,
      loading: false,
      error: error?.message || 'Bildirimler yüklenemedi.',
      bootstrapped: true,
    }));
    traceGameInviteLifecycle('notification_center_fetch_failed', { id: 'fetch:error', status: 'pending', to_email: email }, {
      source: `useNotificationCenter.${source}`,
      user: state.currentUser,
      userEmail: email,
      reason: 'fetch_error_preserve_existing',
    });
    return state;
  }).finally(() => {
    inFlightFetch = null;
  });

  return inFlightFetch;
}

function scheduleRefresh(options) {
  if (refreshTimer) window.clearTimeout(refreshTimer);
  refreshTimer = window.setTimeout(() => {
    fetchNotificationCenter(options);
  }, REFRESH_DEBOUNCE_MS);
}

function startSubscriptions(email, currentUser) {
  const unsubs = [];

  try {
    const unsubFriend = base44.entities.FriendRequest.subscribe?.(() => {
      scheduleRefresh({ preserveExisting: true, source: 'friend_request_subscription' });
    });
    if (typeof unsubFriend === 'function') unsubs.push(unsubFriend);
  } catch { /* realtime optional */ }

  try {
    const unsubInvite = base44.entities.GameInvite.subscribe?.((event) => {
      const eventType = event?.type || event?.eventType || 'update';
      const invite = event?.data || event;
      if (eventType === 'delete') return;

      const toEmail = getInviteRecipientEmail(invite);
      const fromEmail = getInviteSenderEmail(invite);
      if (
        fromEmail === email
        && invite?.status === 'accepted'
        && invite?.id
        && !handledAcceptedOutgoingIds.has(invite.id)
      ) {
        handledAcceptedOutgoingIds.add(invite.id);
        updateState((prev) => ({
          ...prev,
          acceptedOutgoingInvites: [...prev.acceptedOutgoingInvites, invite],
        }));
        return;
      }
      if (toEmail !== email) return;

      const reason = getGameInviteActiveFilterReason(invite, email);
      traceGameInviteLifecycle(reason.startsWith('active') ? 'invite_passed_active_filter' : 'invite_failed_active_filter', invite, {
        source: `useNotificationCenter.subscription:${eventType}`,
        user: currentUser,
        userEmail: email,
        reason,
      });

      if (reason.startsWith('active')) {
        updateState((prev) => ({
          ...prev,
          gameInvites: mergeActiveIncomingGameInvites(prev.gameInvites, [invite], email),
        }));
        scheduleRefresh({ preserveExisting: true, source: 'game_invite_subscription_followup' });
      } else {
        removeInvite(invite.id);
        scheduleRefresh({ preserveExisting: true, source: 'game_invite_terminal_followup' });
      }
    });
    if (typeof unsubInvite === 'function') unsubs.push(unsubInvite);
  } catch { /* realtime optional */ }

  const onFocus = () => scheduleRefresh({ preserveExisting: true, source: 'window_focus' });
  const onVisibility = () => {
    if (document.visibilityState === 'visible') {
      scheduleRefresh({ preserveExisting: true, source: 'visibilitychange' });
    }
  };
  window.addEventListener('focus', onFocus);
  document.addEventListener('visibilitychange', onVisibility);
  unsubs.push(() => window.removeEventListener('focus', onFocus));
  unsubs.push(() => document.removeEventListener('visibilitychange', onVisibility));

  return () => {
    unsubs.forEach((unsub) => {
      try { unsub(); } catch { /* ignore cleanup */ }
    });
  };
}

function ensureNotificationCenter(user) {
  const email = normalizeEmail(user?.email);
  if (!email) {
    patchState({ currentUser: user || null, loading: false });
    return;
  }
  if (state.email === email) {
    patchState({ currentUser: user || state.currentUser });
    return;
  }

  stopNotificationCenter();
  handledAcceptedOutgoingIds.clear();
  emit({
    ...initialState,
    email,
    currentUser: user || null,
    loading: true,
    dismissedToastIds: new Set(),
  });
  stopSubscriptions = startSubscriptions(email, user);
  fetchNotificationCenter({ preserveExisting: false, source: 'initial_load' });
  pollTimer = window.setInterval(() => {
    fetchNotificationCenter({ preserveExisting: true, source: 'poll' });
  }, POLL_INTERVAL_MS);
  pruneTimer = window.setInterval(() => {
    updateState((prev) => ({
      ...prev,
      gameInvites: prev.gameInvites.filter((invite) => isActiveIncomingGameInvite(invite, email)),
    }));
  }, ACTIVE_PRUNE_INTERVAL_MS);
}

function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return state;
}

export function rememberDismissedInviteToast(inviteId) {
  if (!inviteId) return;
  updateState((prev) => {
    const dismissedToastIds = new Set(prev.dismissedToastIds);
    dismissedToastIds.add(inviteId);
    return { ...prev, dismissedToastIds };
  });
}

export function forgetDismissedInviteToast(inviteId) {
  if (!inviteId) return;
  updateState((prev) => {
    const dismissedToastIds = new Set(prev.dismissedToastIds);
    dismissedToastIds.delete(inviteId);
    return { ...prev, dismissedToastIds };
  });
}

export async function openNotificationCenterGameInvite(invite, {
  navigate,
  userEmail = '',
  source = 'notification_center',
  onAccepted,
} = {}) {
  if (!invite?.id) return { ok: false, reason: 'invalid' };
  removeInvite(invite.id);
  try {
    const res = await openGameInviteAction(invite, {
      navigate,
      userEmail,
      source,
      onAccepted,
    });
    scheduleRefresh({ preserveExisting: true, source: `${source}_accepted_followup` });
    return { ok: true, lobby: res?.lobby, result: res };
  } catch (error) {
    scheduleRefresh({ preserveExisting: true, source: `${source}_failed_followup` });
    return { ok: false, reason: error?.message || 'accept_failed', error };
  }
}

export async function rejectNotificationCenterGameInvite(inviteId) {
  if (!inviteId) return { ok: false, reason: 'invalid' };
  removeInvite(inviteId);
  try {
    await rejectGameInviteAction(inviteId);
    scheduleRefresh({ preserveExisting: true, source: 'rejected_followup' });
    return { ok: true };
  } catch (error) {
    scheduleRefresh({ preserveExisting: true, source: 'reject_failed_followup' });
    return { ok: false, reason: error?.message || 'reject_failed', error };
  }
}

export function markAcceptedOutgoingInviteHandled(inviteId) {
  if (!inviteId) return;
  updateState((prev) => ({
    ...prev,
    acceptedOutgoingInvites: prev.acceptedOutgoingInvites.filter((invite) => invite.id !== inviteId),
  }));
}

export function useNotificationCenter(user) {
  const userEmail = user?.email;
  useEffect(() => {
    ensureNotificationCenter(user);
  }, [userEmail]);

  const raw = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const notificationViewModel = useMemo(() => buildNotificationViewModel({
    currentUser: user || raw.currentUser,
    friendRequests: raw.friendRequests,
    gameInvites: raw.gameInvites,
    dismissedToastIds: raw.dismissedToastIds,
  }), [raw.dismissedToastIds, raw.friendRequests, raw.gameInvites, raw.currentUser, user]);

  const refresh = useCallback((options) => fetchNotificationCenter(options), []);

  return useMemo(() => ({
    ...raw,
    friendRequests: notificationViewModel.pendingFriendRequests,
    gameInvites: notificationViewModel.activeIncomingGameInvites,
    totalCount: notificationViewModel.badgeCount,
    notificationViewModel,
    refresh,
  }), [notificationViewModel, raw, refresh]);
}
