// lib/gameInviteSelectors.js
// SINGLE SOURCE OF TRUTH for "what is an active incoming game invite?"
//
// Every surface that displays or counts pending game invites — header
// notification bell, Online screen IncomingInvitesPanel, GameInviteNotifier
// toast, and any future surface — MUST use these helpers. Duplicating the
// rule in multiple components caused invite surfaces to disagree about
// whether a fresh pending invite was still actionable.
//
// Active-incoming definition:
//   - invite.status === 'pending'
//   - normalized recipient matches the current user email
//   - expiry timestamp is in the future under the 10-minute TTL
//
// Missing `expires_at` is not treated as instantly expired. If `created_at`
// exists, expiry is derived from it. If all timestamps are missing, the invite
// is not counted as active and emits diagnostics instead of becoming an
// immortal actionable invite.

export const GAME_INVITE_TTL_MS = 10 * 60 * 1000;

export const TERMINAL_GAME_INVITE_STATUSES = new Set([
  'accepted',
  'declined',
  'rejected',
  'expired',
  'cancelled',
  'completed',
]);

const warnedMissingTimestamps = new Set();

export function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

export function getInviteRecipientEmail(invite) {
  return normalizeEmail(
    invite?.to_email ||
    invite?.recipient_email ||
    invite?.toEmail ||
    invite?.recipientEmail,
  );
}

export function getInviteSenderEmail(invite) {
  return normalizeEmail(
    invite?.from_email ||
    invite?.sender_email ||
    invite?.fromEmail ||
    invite?.senderEmail,
  );
}

export function getInviteLobbyId(invite) {
  return String(invite?.lobby_id || invite?.lobbyId || '').trim();
}

export function getGameInviteDedupeKey(invite) {
  if (!invite) return '';
  if (invite.id) return `id:${invite.id}`;
  const lobbyId = getInviteLobbyId(invite);
  const sender = invite?.sender_name || invite?.from_name || getInviteSenderEmail(invite);
  const recipient = invite?.recipient_name || invite?.to_name || getInviteRecipientEmail(invite);
  return [lobbyId, sender, recipient].filter(Boolean).join('|');
}

export function getInviteStatus(invite) {
  return String(invite?.status || '').trim().toLowerCase();
}

export function isInvitePending(invite) {
  return getInviteStatus(invite) === 'pending';
}

// Codex138 — Base44 sometimes serializes `created_date` WITHOUT a timezone
// suffix (e.g. "2026-05-31T14:33:11.992000" instead of "...992Z" or "...+00:00").
// In that case `new Date(naiveString)` interprets the value as LOCAL time,
// which on Europe/Istanbul (UTC+3) shifts the timestamp 3h into the past.
// Adding the 10-minute TTL then lands in the past and the invite is wrongly
// flipped to expired ~1s after creation — exactly the bug shown in the video.
//
// Base44 server timestamps are always UTC. Any naive ISO-like string from
// Base44 MUST be interpreted as UTC. We append `Z` to a string that looks
// like an ISO datetime but has no timezone suffix before handing it to
// `new Date()`. Strings that already have `Z` / `+hh:mm` / `-hh:mm` /
// `space + offset` are left alone.
export function parseBase44Timestamp(raw) {
  if (raw == null) return null;
  if (raw instanceof Date) {
    return Number.isNaN(raw.getTime()) ? null : raw;
  }
  if (typeof raw === 'number') {
    if (!Number.isFinite(raw)) return null;
    const date = new Date(raw);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const str = String(raw).trim();
  if (!str) return null;
  // Already has a timezone suffix → safe to parse as-is.
  const hasZone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(str);
  const normalized = hasZone ? str : `${str}Z`;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function parseKronoxTimestamp(raw) {
  const date = parseBase44Timestamp(raw);
  return date ? date.getTime() : NaN;
}

export function getInviteCreatedAt(invite) {
  const raw = invite?.created_at || invite?.createdAt || invite?.created_date || invite?.createdDate;
  return parseKronoxTimestamp(raw);
}

export function parseInviteExpiresAt(invite) {
  const explicitRaw = invite?.expires_at || invite?.expiresAt;
  const explicit = parseKronoxTimestamp(explicitRaw);
  if (Number.isFinite(explicit)) return explicit;

  const created = getInviteCreatedAt(invite);
  return Number.isFinite(created) ? created + GAME_INVITE_TTL_MS : NaN;
}

export function getInviteRemainingMs(invite, now = Date.now()) {
  const expiresAt = parseInviteExpiresAt(invite);
  if (!Number.isFinite(expiresAt)) return NaN;
  return Math.max(0, expiresAt - now);
}

function warnMissingTimestampsOnce(invite) {
  if (!invite?.id || warnedMissingTimestamps.has(invite.id)) return;
  warnedMissingTimestamps.add(invite.id);
  // eslint-disable-next-line no-console
  console.warn(
    '[gameInviteSelectors] invite is missing expires_at and created_* timestamps; not counting it as active.',
    { inviteId: invite.id, status: invite.status, keys: Object.keys(invite || {}) },
  );
}

export function isInviteExpired(invite, now = Date.now()) {
  if (!isInvitePending(invite)) return false;
  const expiresAt = parseInviteExpiresAt(invite);
  if (!Number.isFinite(expiresAt)) {
    warnMissingTimestampsOnce(invite);
    return false;
  }
  return expiresAt <= now;
}

export function isIncomingInviteForUser(invite, userEmail) {
  if (invite?.recipient_is_self === true || invite?.direction === 'incoming') return true;
  const me = normalizeEmail(userEmail);
  if (!me) return false;
  return getInviteRecipientEmail(invite) === me;
}

export function getGameInviteActiveFilterReason(invite, userEmail, now = Date.now()) {
  if (!invite) return 'missing_invite';

  const status = getInviteStatus(invite);
  if (status !== 'pending') return TERMINAL_GAME_INVITE_STATUSES.has(status) ? `terminal_${status}` : `status_${status || 'missing'}`;

  const recipientIsSelf = invite?.recipient_is_self === true || invite?.direction === 'incoming';
  if (!recipientIsSelf) {
    const recipientEmail = getInviteRecipientEmail(invite);
    if (!recipientEmail) return 'missing_recipient';
    const me = normalizeEmail(userEmail);
    if (me && recipientEmail !== me) return 'recipient_mismatch';
  }

  if (isInviteExpired(invite, now)) return 'expired';

  if (!Number.isFinite(parseInviteExpiresAt(invite))) return 'missing_expiry';
  if (!getInviteLobbyId(invite)) return 'missing_lobby';
  return 'active';
}

export function isActiveIncomingGameInvite(invite, userEmail, now = Date.now()) {
  return getGameInviteActiveFilterReason(invite, userEmail, now) === 'active';
}

export function filterActiveIncomingGameInvites(invites = [], userEmail, now = Date.now()) {
  return (invites || []).filter((invite) => isActiveIncomingGameInvite(invite, userEmail, now));
}

export function mergeActiveIncomingGameInvites(existing = [], incoming = [], userEmail, now = Date.now()) {
  const byId = new Map();

  filterActiveIncomingGameInvites(existing, userEmail, now).forEach((invite) => {
    const key = getGameInviteDedupeKey(invite);
    if (key) byId.set(key, invite);
  });

  (incoming || []).forEach((invite) => {
    const key = getGameInviteDedupeKey(invite);
    if (!key) return;
    if (isActiveIncomingGameInvite(invite, userEmail, now)) {
      byId.set(key, invite);
    } else {
      byId.delete(key);
    }
  });

  return Array.from(byId.values()).sort((a, b) => (
    (getInviteCreatedAt(b) || 0) - (getInviteCreatedAt(a) || 0)
  ));
}

export function getGameInviteActionability(invite, userEmail, now = Date.now()) {
  const reason = getGameInviteActiveFilterReason(invite, userEmail, now);
  return {
    actionable: reason === 'active',
    reason,
    inviteId: invite?.id || null,
    lobbyId: getInviteLobbyId(invite) || null,
    remainingMs: getInviteRemainingMs(invite, now),
    recipientMatches: isIncomingInviteForUser(invite, userEmail),
  };
}

export function summarizeGameInviteForDiagnostics(invite, userEmail, now = Date.now(), source = 'unknown', reason = '') {
  return {
    source,
    reason,
    inviteId: invite?.id || null,
    lobby_id: invite?.lobby_id || invite?.lobbyId || null,
    direction: invite?.direction || null,
    sender_name: invite?.sender_name || invite?.from_name || null,
    status: invite?.status || null,
    created_at: invite?.created_at || invite?.createdAt || invite?.created_date || null,
    expires_at: invite?.expires_at || invite?.expiresAt || null,
    now: new Date(now).toISOString(),
    remainingMs: getInviteRemainingMs(invite, now),
    recipientIsSelf: isIncomingInviteForUser(invite, userEmail),
  };
}

export function isGameInviteTraceEnabled(user) {
  const isAdmin = (
    user?.role === 'admin' ||
    user?.is_admin === true ||
    (Array.isArray(user?.permissions) && user.permissions.includes('admin'))
  );
  return Boolean(import.meta.env.DEV || isAdmin);
}

export function traceGameInviteLifecycle(eventName, invite, context = {}) {
  const user = context.user || null;
  if (!isGameInviteTraceEnabled(user)) return;
  const now = context.now || Date.now();
  const payload = summarizeGameInviteForDiagnostics(
    invite,
    context.userEmail || user?.email || '',
    now,
    context.source || 'unknown',
    context.reason || '',
  );
  // eslint-disable-next-line no-console
  console.debug(`[GameInvite:${eventName}]`, payload);
}

// Backwards-compatible aliases used by older UI helpers.
export const getGameInviteCreatedAt = getInviteCreatedAt;
export const getGameInviteExpiresAt = parseInviteExpiresAt;
export const getGameInviteRemainingMs = getInviteRemainingMs;
export const isGameInviteExpired = isInviteExpired;
