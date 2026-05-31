export const GAME_INVITE_TTL_MS = 10 * 60 * 1000;

export const TERMINAL_GAME_INVITE_STATUSES = new Set([
  'accepted',
  'declined',
  'rejected',
  'expired',
  'cancelled',
  'completed',
]);

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

export function getInviteStatus(invite) {
  return String(invite?.status || '').trim().toLowerCase();
}

export function isInvitePending(invite) {
  return getInviteStatus(invite) === 'pending';
}

export function getInviteCreatedAt(invite) {
  const raw = invite?.created_at || invite?.createdAt || invite?.created_date || invite?.createdDate;
  const time = raw ? new Date(raw).getTime() : NaN;
  return Number.isFinite(time) ? time : NaN;
}

export function parseInviteExpiresAt(invite) {
  const raw = invite?.expires_at || invite?.expiresAt;
  const explicit = raw ? new Date(raw).getTime() : NaN;
  if (Number.isFinite(explicit)) return explicit;

  const created = getInviteCreatedAt(invite);
  return Number.isFinite(created) ? created + GAME_INVITE_TTL_MS : NaN;
}

export function getInviteRemainingMs(invite, now = Date.now()) {
  const expiresAt = parseInviteExpiresAt(invite);
  if (!Number.isFinite(expiresAt)) return null;
  return Math.max(0, expiresAt - now);
}

export function isInviteExpired(invite, now = Date.now()) {
  if (!isInvitePending(invite)) return false;
  const expiresAt = parseInviteExpiresAt(invite);
  return Number.isFinite(expiresAt) && expiresAt <= now;
}

export function isIncomingInviteForUser(invite, userEmail) {
  const me = normalizeEmail(userEmail);
  if (!me) return false;
  return getInviteRecipientEmail(invite) === me;
}

export function getGameInviteActiveFilterReason(invite, userEmail, now = Date.now()) {
  if (!invite) return 'missing_invite';
  if (!invite.id) return 'missing_id';

  const status = getInviteStatus(invite);
  if (status !== 'pending') return TERMINAL_GAME_INVITE_STATUSES.has(status) ? `terminal_${status}` : `status_${status || 'missing'}`;

  const recipientEmail = getInviteRecipientEmail(invite);
  if (!recipientEmail) return 'missing_recipient';

  const me = normalizeEmail(userEmail);
  if (me && recipientEmail !== me) return 'recipient_mismatch';

  if (isInviteExpired(invite, now)) return 'expired';

  if (!Number.isFinite(parseInviteExpiresAt(invite))) return 'active_missing_expiry';
  if (!getInviteLobbyId(invite)) return 'active_missing_lobby';
  return 'active';
}

export function isActiveIncomingGameInvite(invite, userEmail, now = Date.now()) {
  return getGameInviteActiveFilterReason(invite, userEmail, now).startsWith('active');
}

export function filterActiveIncomingGameInvites(invites = [], userEmail, now = Date.now()) {
  return (invites || []).filter((invite) => isActiveIncomingGameInvite(invite, userEmail, now));
}

export function mergeActiveIncomingGameInvites(existing = [], incoming = [], userEmail, now = Date.now()) {
  const byId = new Map();

  filterActiveIncomingGameInvites(existing, userEmail, now).forEach((invite) => {
    byId.set(invite.id, invite);
  });

  (incoming || []).forEach((invite) => {
    if (!invite?.id) return;
    if (isActiveIncomingGameInvite(invite, userEmail, now)) {
      byId.set(invite.id, invite);
    } else {
      byId.delete(invite.id);
    }
  });

  return Array.from(byId.values()).sort((a, b) => (
    (getInviteCreatedAt(b) || 0) - (getInviteCreatedAt(a) || 0)
  ));
}

export function summarizeGameInviteForDiagnostics(invite, userEmail, now = Date.now(), source = 'unknown', reason = '') {
  return {
    source,
    reason,
    inviteId: invite?.id || null,
    lobby_id: invite?.lobby_id || invite?.lobbyId || null,
    from_email: invite?.from_email || invite?.sender_email || invite?.fromEmail || null,
    to_email: invite?.to_email || invite?.recipient_email || invite?.toEmail || null,
    status: invite?.status || null,
    created_at: invite?.created_at || invite?.createdAt || invite?.created_date || null,
    expires_at: invite?.expires_at || invite?.expiresAt || null,
    now: new Date(now).toISOString(),
    remainingMs: getInviteRemainingMs(invite, now),
    currentUserEmail: userEmail || null,
    normalizedRecipientMatch: normalizeEmail(userEmail) ? isIncomingInviteForUser(invite, userEmail) : null,
  };
}

export function isGameInviteTraceEnabled(user) {
  const userEmail = normalizeEmail(user?.email);
  const isAdmin = user?.role === 'admin' || userEmail === 'sariverim@gmail.com';
  if (import.meta.env.DEV || isAdmin) return true;
  if (typeof window === 'undefined') return false;
  try {
    const params = new URLSearchParams(window.location.search);
    return params.get('inviteDebug') === '1' || window.localStorage?.getItem('kx_invite_debug') === '1';
  } catch (_) {
    return false;
  }
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
