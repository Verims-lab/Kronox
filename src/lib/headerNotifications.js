// lib/headerNotifications.js
// Pure helpers for the shared header notification system. No SDK calls
// here — those live in `hooks/useHeaderNotifications.js`. Keeping these
// helpers stateless makes the filters trivially testable from Health.
//
// Source of truth:
//   • Friend requests:  `pending`, recipient (`to_email`) matches me.
//   • Game invites:    `pending`, recipient (`to_email`) matches me,
//                       expiry timestamp still in the future
//                       (10-min TTL — see lib/gameInviteSelectors.GAME_INVITE_TTL_MS).
//
// Outgoing rows, resolved rows (accepted/declined/rejected/cancelled/
// expired/completed) are never counted.

import {
  GAME_INVITE_TTL_MS,
  getInviteRemainingMs,
  isActiveIncomingGameInvite,
  isInviteExpired,
  normalizeEmail,
} from '@/lib/gameInviteSelectors';

// Re-export the shared 10-minute TTL helpers so Header notification code
// has a single import surface. `isInviteExpired` is the canonical expiry
// predicate used by both the badge counter and openGameInvite guard.
export { GAME_INVITE_TTL_MS, isInviteExpired };

/** Returns true when the FriendRequest row is a pending request addressed to me. */
export function isPendingFriendRequestForUser(row, myEmail) {
  if (!row || row.status !== 'pending') return false;
  const me = normalizeEmail(myEmail);
  if (!me) return false;
  return normalizeEmail(row.to_email) === me;
}

/** Returns true when the GameInvite row is pending, addressed to me, and not yet expired. */
export function isActiveGameInviteForUser(row, myEmail, now = Date.now()) {
  return isActiveIncomingGameInvite(row, myEmail, now);
}

/** Remaining time in milliseconds until the invite expires. NaN when unknown. */
export function getGameInviteRemainingMs(row, now = Date.now()) {
  return getInviteRemainingMs(row, now);
}

/** Format remaining milliseconds as "Xm Ys" / "Ys". Returns '' when unknown. */
export function formatRemaining(ms) {
  if (!Number.isFinite(ms) || ms <= 0) return '';
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

/** Clamp badge display: 0 hides, 1-9 raw, 10+ → "9+". */
export function formatBadgeCount(count) {
  const n = Number(count);
  if (!Number.isFinite(n) || n <= 0) return '';
  if (n > 9) return '9+';
  return String(Math.floor(n));
}