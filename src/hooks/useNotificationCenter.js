import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react';
import { base44 } from '@/api/base44Client';
import {
  loadIncomingInviteSnapshot,
  openGameInvite as openGameInviteAction,
  rejectGameInvite as rejectGameInviteAction,
} from '@/lib/inviteApi';
import { getFriendRequestDedupeKey } from '@/lib/headerNotifications';
import { buildNotificationViewModel } from '@/lib/notificationViewModel';
import {
  createNotificationInitialState,
  notificationReducer,
  NOTIFICATION_ACTIONS,
  NOTIFICATION_ROW_TYPES,
} from '@/lib/notificationReducer';
import {
  getGameInviteActiveFilterReason,
  getInviteRecipientEmail,
  getInviteSenderEmail,
  normalizeEmail,
  traceGameInviteLifecycle,
} from '@/lib/gameInviteSelectors';

const POLL_INTERVAL_MS = 20000;
const REFRESH_DEBOUNCE_MS = 250;
const ACTIVE_PRUNE_INTERVAL_MS = 30000;

// Phase 1: notificationReducer owns the mergeActiveIncomingGameInvites and
// mergePendingFriendRequests lifecycle transitions while this hook remains the
// shared subscription/fetch ViewModel for header, toast, and Online surfaces.
const initialState = createNotificationInitialState();

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

function dispatchNotification(action) {
  updateState((prev) => notificationReducer(prev, action));
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

async function fetchNotificationCenter({ preserveExisting = true, source = 'fetch' } = {}) {
  const email = state.email;
  if (!email) {
    patchState({ loading: false });
    return state;
  }
  if (inFlightFetch) return inFlightFetch;

  dispatchNotification({ type: NOTIFICATION_ACTIONS.FETCH_STARTED, source });
  inFlightFetch = Promise.all([
    base44.entities.FriendRequest.filter(
      { to_email: email },
      '-updated_date',
      50,
    ).catch(() => []),
    loadIncomingInviteSnapshot(email),
  ]).then(([friendRows, inviteSnapshot]) => {
    const now = Date.now();
    updateState((prev) => {
      if (prev.email !== email) return prev;
      const next = notificationReducer(prev, {
        type: (inviteSnapshot?.rows || []).length === 0 && (friendRows || []).length === 0 && preserveExisting
          ? NOTIFICATION_ACTIONS.FETCH_EMPTY_STALE
          : NOTIFICATION_ACTIONS.FETCH_SUCCESS,
        email,
        currentUser: prev.currentUser,
        friendRequestRows: friendRows || [],
        gameInviteRows: inviteSnapshot?.rows || [],
        preserveExisting,
        now,
        source,
      });
      traceGameInviteLifecycle('notification_center_fetch_merged', { id: `count:${next.gameInvites.length}`, status: 'pending', to_email: email }, {
        source: `useNotificationCenter.${source}`,
        user: prev.currentUser,
        userEmail: email,
        reason: (inviteSnapshot?.rows || []).length === 0 && prev.gameInvites.length > 0
          ? 'stale_empty_fetch_preserved'
          : 'lifecycle_merge',
      });
      return next;
    });
    return state;
  }).catch((error) => {
    dispatchNotification({
      type: NOTIFICATION_ACTIONS.FETCH_FAILED,
      error: error?.message || 'Bildirimler yüklenemedi.',
      source,
    });
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
    const unsubFriend = base44.entities.FriendRequest.subscribe?.((event) => {
      const eventType = event?.type || event?.eventType || 'update';
      const request = event?.data || event;
      const oldRequest = event?.old_data || event?.oldData || {};
      const requestId = request?.id || oldRequest?.id;
      const toEmail = normalizeEmail(request?.to_email || oldRequest?.to_email);
      const fromEmail = normalizeEmail(request?.from_email || oldRequest?.from_email);
      if (!toEmail && !fromEmail) {
        scheduleRefresh({ preserveExisting: true, source: 'friend_request_subscription' });
        return;
      }
      if (toEmail !== email && fromEmail !== email) return;

      if (toEmail === email) {
        if (eventType === 'delete' && requestId) {
          dispatchNotification({
            type: NOTIFICATION_ACTIONS.TERMINAL_ROW,
            rowType: NOTIFICATION_ROW_TYPES.FRIEND_REQUEST,
            rowId: requestId,
            source: 'friend_request_subscription_delete',
          });
        } else if (requestId || getFriendRequestDedupeKey(request)) {
          dispatchNotification({
            type: NOTIFICATION_ACTIONS.SUBSCRIPTION_ROW,
            rowType: NOTIFICATION_ROW_TYPES.FRIEND_REQUEST,
            row: request,
            email,
            source: 'friend_request_subscription',
          });
        }
      }
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
        dispatchNotification({
          type: NOTIFICATION_ACTIONS.OUTGOING_INVITE_ACCEPTED,
          invite,
          source: `game_invite_subscription:${eventType}`,
        });
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
        dispatchNotification({
          type: NOTIFICATION_ACTIONS.SUBSCRIPTION_ROW,
          rowType: NOTIFICATION_ROW_TYPES.GAME_INVITE,
          row: invite,
          email,
          now: Date.now(),
          source: `game_invite_subscription:${eventType}`,
        });
        scheduleRefresh({ preserveExisting: true, source: 'game_invite_subscription_followup' });
      } else {
        dispatchNotification({
          type: NOTIFICATION_ACTIONS.TERMINAL_ROW,
          rowType: NOTIFICATION_ROW_TYPES.GAME_INVITE,
          rowId: invite.id,
          source: `game_invite_subscription:${eventType}`,
        });
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
    ...createNotificationInitialState(),
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
    updateState((prev) => notificationReducer(prev, {
      type: NOTIFICATION_ACTIONS.FETCH_SUCCESS,
      email,
      currentUser: prev.currentUser,
      friendRequestRows: [],
      gameInviteRows: [],
      preserveExisting: true,
      now: Date.now(),
      source: 'active_prune',
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
    return notificationReducer(prev, {
      type: NOTIFICATION_ACTIONS.TOAST_DISMISSED,
      inviteId,
      source: 'toast_dismiss',
    });
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
  dispatchNotification({
    type: NOTIFICATION_ACTIONS.INVITE_OPENED,
    inviteId: invite.id,
    source,
  });
  try {
    const res = await openGameInviteAction(invite, {
      navigate,
      userEmail,
      source,
      onAccepted,
    });
    const verifiedLobby = res?.verifiedLobby || res?.joinedLobby || res?.lobby || null;
    const joinedLobby = verifiedLobby || null;
    scheduleRefresh({ preserveExisting: true, source: `${source}_accepted_followup` });
    return { ok: true, lobby: joinedLobby, joinedLobby, verifiedLobby, result: res };
  } catch (error) {
    scheduleRefresh({ preserveExisting: true, source: `${source}_failed_followup` });
    return { ok: false, reason: error?.message || 'accept_failed', error };
  }
}

export async function rejectNotificationCenterGameInvite(inviteId) {
  if (!inviteId) return { ok: false, reason: 'invalid' };
  dispatchNotification({
    type: NOTIFICATION_ACTIONS.INVITE_REJECTED,
    inviteId,
    source: 'reject_invite',
  });
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
