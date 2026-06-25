import {
  getGameInviteDedupeKey,
  isActiveIncomingGameInvite,
  mergeActiveIncomingGameInvites,
  normalizeEmail,
} from '@/lib/gameInviteSelectors';
import {
  getFriendRequestDedupeKey,
  mergePendingFriendRequests,
} from '@/lib/headerNotifications';

export const NOTIFICATION_ACTIONS = Object.freeze({
  FETCH_STARTED: 'FETCH_STARTED',
  FETCH_SUCCESS: 'FETCH_SUCCESS',
  FETCH_FAILED: 'FETCH_FAILED',
  FETCH_EMPTY_STALE: 'FETCH_EMPTY_STALE',
  SUBSCRIPTION_ROW: 'SUBSCRIPTION_ROW',
  TERMINAL_ROW: 'TERMINAL_ROW',
  TOAST_DISMISSED: 'TOAST_DISMISSED',
  INVITE_OPENED: 'INVITE_OPENED',
  INVITE_REJECTED: 'INVITE_REJECTED',
  FRIEND_REQUEST_ACCEPTED: 'FRIEND_REQUEST_ACCEPTED',
  FRIEND_REQUEST_REJECTED: 'FRIEND_REQUEST_REJECTED',
  ROW_EXPIRED: 'ROW_EXPIRED',
  ROW_INVALIDATED: 'ROW_INVALIDATED',
  OUTGOING_INVITE_ACCEPTED: 'OUTGOING_INVITE_ACCEPTED',
});

export const NOTIFICATION_ROW_TYPES = Object.freeze({
  FRIEND_REQUEST: 'friend_request',
  GAME_INVITE: 'game_invite',
});

function normalizeDismissedIds(value) {
  if (value instanceof Set) return new Set(value);
  if (Array.isArray(value)) return new Set(value);
  return new Set();
}

function safeRows(rows) {
  return Array.isArray(rows) ? rows.filter(Boolean) : [];
}

function safeNow(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function removeByDedupeKey(rows, rowId, getKey) {
  if (!rowId) return rows;
  return safeRows(rows).filter((row) => row?.id !== rowId && getKey(row) !== rowId);
}

function removeFriendRequest(state, rowId) {
  return {
    ...state,
    friendRequests: removeByDedupeKey(state.friendRequests, rowId, getFriendRequestDedupeKey),
  };
}

function removeGameInvite(state, rowId) {
  return {
    ...state,
    gameInvites: removeByDedupeKey(state.gameInvites, rowId, getGameInviteDedupeKey),
  };
}

function closeRow(state, action) {
  const rowType = action.rowType || action.notificationType;
  const rowId = action.rowId || action.inviteId || action.requestId || action.id;
  if (rowType === NOTIFICATION_ROW_TYPES.FRIEND_REQUEST) return removeFriendRequest(state, rowId);
  if (rowType === NOTIFICATION_ROW_TYPES.GAME_INVITE) return removeGameInvite(state, rowId);
  return removeGameInvite(removeFriendRequest(state, rowId), rowId);
}

export function createNotificationInitialState(config = {}) {
  return {
    email: normalizeEmail(config.email),
    currentUser: config.currentUser || null,
    friendRequests: safeRows(config.friendRequests),
    gameInvites: safeRows(config.gameInvites),
    dismissedToastIds: normalizeDismissedIds(config.dismissedToastIds),
    acceptedOutgoingInvites: safeRows(config.acceptedOutgoingInvites),
    loading: Boolean(config.loading),
    error: config.error || null,
    bootstrapped: Boolean(config.bootstrapped),
    lastFetchedAt: Number(config.lastFetchedAt) || 0,
    lastLifecycleEvent: config.lastLifecycleEvent || null,
  };
}

function mergeFetchSuccess(state, action) {
  const email = normalizeEmail(action.email || state.email);
  const now = safeNow(action.now);
  const preserveExisting = action.preserveExisting !== false;
  const incomingFriendRows = safeRows(action.friendRequestRows || action.friendRows);
  const incomingInviteRows = safeRows(action.gameInviteRows || action.inviteRows);
  const emptyStaleFetch = preserveExisting &&
    incomingFriendRows.length === 0 &&
    incomingInviteRows.length === 0 &&
    (state.friendRequests.length > 0 || state.gameInvites.length > 0);

  return {
    ...state,
    email,
    currentUser: action.currentUser || state.currentUser || null,
    friendRequests: mergePendingFriendRequests(
      preserveExisting ? state.friendRequests : [],
      incomingFriendRows,
      email,
      { preserveExisting },
    ),
    gameInvites: mergeActiveIncomingGameInvites(
      preserveExisting ? state.gameInvites : [],
      incomingInviteRows,
      email,
      now,
    ),
    loading: false,
    error: null,
    bootstrapped: true,
    lastFetchedAt: now || state.lastFetchedAt,
    lastLifecycleEvent: {
      type: emptyStaleFetch ? NOTIFICATION_ACTIONS.FETCH_EMPTY_STALE : NOTIFICATION_ACTIONS.FETCH_SUCCESS,
      source: action.source || 'fetch',
    },
  };
}

function applySubscriptionRow(state, action) {
  const email = normalizeEmail(action.email || state.email);
  const rowType = action.rowType || action.notificationType;
  const row = action.row || action.invite || action.request;
  const now = safeNow(action.now);

  if (rowType === NOTIFICATION_ROW_TYPES.FRIEND_REQUEST) {
    return {
      ...state,
      friendRequests: mergePendingFriendRequests(state.friendRequests, [row], email, { preserveExisting: true }),
      lastLifecycleEvent: { type: NOTIFICATION_ACTIONS.SUBSCRIPTION_ROW, rowType, source: action.source || null },
    };
  }

  if (rowType === NOTIFICATION_ROW_TYPES.GAME_INVITE) {
    if (!isActiveIncomingGameInvite(row, email, now)) {
      return {
        ...removeGameInvite(state, row?.id || getGameInviteDedupeKey(row)),
        lastLifecycleEvent: { type: NOTIFICATION_ACTIONS.TERMINAL_ROW, rowType, source: action.source || null },
      };
    }
    return {
      ...state,
      gameInvites: mergeActiveIncomingGameInvites(state.gameInvites, [row], email, now),
      lastLifecycleEvent: { type: NOTIFICATION_ACTIONS.SUBSCRIPTION_ROW, rowType, source: action.source || null },
    };
  }

  return state;
}

export function notificationReducer(state = createNotificationInitialState(), action = {}) {
  switch (action.type) {
    case NOTIFICATION_ACTIONS.FETCH_STARTED:
      return {
        ...state,
        loading: true,
        error: null,
        lastLifecycleEvent: { type: NOTIFICATION_ACTIONS.FETCH_STARTED, source: action.source || null },
      };

    case NOTIFICATION_ACTIONS.FETCH_SUCCESS:
    case NOTIFICATION_ACTIONS.FETCH_EMPTY_STALE:
      return mergeFetchSuccess(state, action);

    case NOTIFICATION_ACTIONS.FETCH_FAILED:
      return {
        ...state,
        loading: false,
        error: action.error || 'notifications_fetch_failed',
        bootstrapped: true,
        lastLifecycleEvent: { type: NOTIFICATION_ACTIONS.FETCH_FAILED, source: action.source || null },
      };

    case NOTIFICATION_ACTIONS.SUBSCRIPTION_ROW:
      return applySubscriptionRow(state, action);

    case NOTIFICATION_ACTIONS.TERMINAL_ROW:
    case NOTIFICATION_ACTIONS.ROW_EXPIRED:
    case NOTIFICATION_ACTIONS.ROW_INVALIDATED:
      return {
        ...closeRow(state, action),
        lastLifecycleEvent: {
          type: action.type,
          rowType: action.rowType || action.notificationType || null,
          source: action.source || null,
        },
      };

    case NOTIFICATION_ACTIONS.TOAST_DISMISSED: {
      const inviteId = action.inviteId || action.rowId || action.id;
      if (!inviteId) return state;
      const dismissedToastIds = normalizeDismissedIds(state.dismissedToastIds);
      dismissedToastIds.add(inviteId);
      return {
        ...state,
        dismissedToastIds,
        lastLifecycleEvent: { type: NOTIFICATION_ACTIONS.TOAST_DISMISSED, source: action.source || null },
      };
    }

    case NOTIFICATION_ACTIONS.INVITE_OPENED:
    case NOTIFICATION_ACTIONS.INVITE_REJECTED:
      return {
        ...removeGameInvite(state, action.inviteId || action.rowId || action.id),
        lastLifecycleEvent: { type: action.type, rowType: NOTIFICATION_ROW_TYPES.GAME_INVITE, source: action.source || null },
      };

    case NOTIFICATION_ACTIONS.FRIEND_REQUEST_ACCEPTED:
    case NOTIFICATION_ACTIONS.FRIEND_REQUEST_REJECTED:
      return {
        ...removeFriendRequest(state, action.requestId || action.rowId || action.id),
        lastLifecycleEvent: { type: action.type, rowType: NOTIFICATION_ROW_TYPES.FRIEND_REQUEST, source: action.source || null },
      };

    case NOTIFICATION_ACTIONS.OUTGOING_INVITE_ACCEPTED:
      if (!action.invite?.id) return state;
      if (state.acceptedOutgoingInvites.some((invite) => invite.id === action.invite.id)) return state;
      return {
        ...state,
        acceptedOutgoingInvites: [...state.acceptedOutgoingInvites, action.invite],
        lastLifecycleEvent: { type: NOTIFICATION_ACTIONS.OUTGOING_INVITE_ACCEPTED, source: action.source || null },
      };

    default:
      return state;
  }
}

