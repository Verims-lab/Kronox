import {
  filterActiveIncomingGameInvites,
  getGameInviteActiveFilterReason,
  getGameInviteDedupeKey,
  normalizeEmail,
} from '@/lib/gameInviteSelectors';
import { isPendingFriendRequestForUser } from '@/lib/headerNotifications';

function normalizeDismissedIds(dismissedToastIds) {
  if (!dismissedToastIds) return new Set();
  if (dismissedToastIds instanceof Set) return dismissedToastIds;
  if (Array.isArray(dismissedToastIds)) return new Set(dismissedToastIds);
  return new Set();
}

export function getNotificationExclusionReasons({
  currentUser,
  gameInvites = [],
  dismissedToastIds,
  now = Date.now(),
} = {}) {
  const userEmail = normalizeEmail(currentUser?.email);
  const dismissed = normalizeDismissedIds(dismissedToastIds);
  return (gameInvites || []).map((invite) => {
    const reason = userEmail
      ? getGameInviteActiveFilterReason(invite, userEmail, now)
      : 'user_not_loaded';
    return {
      inviteId: invite?.id || null,
      dedupeKey: getGameInviteDedupeKey(invite),
      reason,
      dismissedToastOnly: Boolean(invite?.id && dismissed.has(invite.id)),
    };
  });
}

export function buildNotificationViewModel({
  currentUser,
  friendRequests = [],
  gameInvites = [],
  dismissedToastIds,
  now = Date.now(),
} = {}) {
  const userEmail = normalizeEmail(currentUser?.email);
  const dismissed = normalizeDismissedIds(dismissedToastIds);
  const pendingFriendRequests = userEmail
    ? (friendRequests || []).filter((row) => isPendingFriendRequestForUser(row, userEmail))
    : [];
  const activeIncomingGameInvites = userEmail
    ? filterActiveIncomingGameInvites(gameInvites, userEmail, now)
    : [];
  const bannerCandidates = activeIncomingGameInvites.filter((invite) => (
    !invite?.id || !dismissed.has(invite.id)
  ));
  const headerItems = [
    ...pendingFriendRequests.map((row) => ({ type: 'friend_request', row })),
    ...activeIncomingGameInvites.map((row) => ({ type: 'game_invite', row })),
  ];

  return {
    badgeCount: pendingFriendRequests.length + activeIncomingGameInvites.length,
    headerItems,
    activeIncomingGameInvites,
    pendingFriendRequests,
    bannerCandidates,
    exclusionReasons: getNotificationExclusionReasons({
      currentUser,
      gameInvites,
      dismissedToastIds,
      now,
    }),
  };
}
