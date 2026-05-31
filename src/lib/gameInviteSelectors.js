// lib/gameInviteSelectors.js
// SINGLE SOURCE OF TRUTH for "what is an active incoming game invite?"
//
// Every surface that displays or counts pending game invites — header
// notification bell, Online screen IncomingInvitesPanel, GameInviteNotifier
// toast, and any future surface — MUST use these helpers. Duplicating the
// rule in multiple components was the Codex134→135 regression: surfaces
// could disagree about whether an invite was still active and a fresh
// pending invite could appear briefly in one place and not in another.
//
// Active-incoming definition (canonical):
//   • invite.status === 'pending'
//   • normalized recipient (to_email) === normalized current user email
//   • lobby_id is present
//   • expiry timestamp is in the future (10-min TTL — see GAME_INVITE_TTL_MS)
//
// IMPORTANT: missing `expires_at` is NOT treated as expired. The fallback
// derives expiry from `created_at` / `created_date` + GAME_INVITE_TTL_MS.
// If both are missing too, we surface a debug warning ONCE and treat the
// invite as ACTIVE (better to show a usable invite than silently drop it).

import { normalizeEmail } from '@/lib/friendsApi';
import {
  GAME_INVITE_TTL_MS,
  getGameInviteCreatedAt,
  getGameInviteExpiresAt,
  isGameInviteExpired,
} from '@/lib/inviteApi';

export { GAME_INVITE_TTL_MS, normalizeEmail };

// ---------------------------------------------------------------------------
// Defensive logging — fires at most once per invite id so we never spam.
// Surfaced in the console so admins can see if the entity is missing the
// expected timestamp fields after Base44 entity creation.
// ---------------------------------------------------------------------------
const warnedMissingTimestamps = new Set();

function warnMissingTimestampsOnce(invite) {
  if (!invite?.id || warnedMissingTimestamps.has(invite.id)) return;
  warnedMissingTimestamps.add(invite.id);
  // eslint-disable-next-line no-console
  console.warn(
    '[gameInviteSelectors] invite is missing both expires_at and created_* timestamps; treating as active.',
    { inviteId: invite.id, status: invite.status, keys: Object.keys(invite || {}) },
  );
}

// ---------------------------------------------------------------------------
// Public selectors
// ---------------------------------------------------------------------------

/** True when the invite row is pending AND addressed to the given user. */
export function isIncomingInviteForUser(invite, userEmail) {
  if (!invite || invite.status !== 'pending') return false;
  const me = normalizeEmail(userEmail);
  if (!me) return false;
  return normalizeEmail(invite.to_email) === me;
}

/**
 * True when the invite's expiry timestamp is in the past.
 * Missing-timestamp safety: when BOTH expires_at and created_* are absent,
 * we return FALSE (treat as not expired) and log a one-shot warning. We
 * never let a malformed entity row silently delete a fresh invite.
 */
export function isInviteExpired(invite, now = Date.now()) {
  if (!invite) return false;
  const expiresAt = getGameInviteExpiresAt(invite);
  if (!Number.isFinite(expiresAt)) {
    const createdAt = getGameInviteCreatedAt(invite);
    if (!Number.isFinite(createdAt)) {
      warnMissingTimestampsOnce(invite);
      return false;
    }
    return false;
  }
  return expiresAt <= now;
}

/** True when the invite is a pending incoming invite that has NOT expired. */
export function isActiveIncomingGameInvite(invite, userEmail, now = Date.now()) {
  if (!isIncomingInviteForUser(invite, userEmail)) return false;
  if (!invite?.lobby_id) return false;
  return !isInviteExpired(invite, now);
}

/** Filter a list of invites to only the active incoming ones. */
export function filterActiveIncomingGameInvites(invites, userEmail, now = Date.now()) {
  if (!Array.isArray(invites)) return [];
  return invites.filter((invite) => isActiveIncomingGameInvite(invite, userEmail, now));
}

/** Remaining ms until expiry — NaN when unknown, 0 when already expired. */
export function getGameInviteRemainingMs(invite, now = Date.now()) {
  const expiresAt = getGameInviteExpiresAt(invite);
  if (!Number.isFinite(expiresAt)) return NaN;
  return Math.max(0, expiresAt - now);
}

// Re-export the canonical TTL-aware "is expired" check so callers that
// previously depended on lib/inviteApi keep working without changes.
export { isGameInviteExpired };