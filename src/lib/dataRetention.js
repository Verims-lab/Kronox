import { base44 } from '@/api/base44Client';
import {
  GAME_INVITE_TTL_MS,
  isGameInviteExpired,
  normalizeEmail,
} from '@/lib/gameInviteSelectors';
import { LOBBY_STALE_AFTER_MS } from '@/lib/inviteApi';

function parseBase44Timestamp(raw) {
  if (raw == null) return NaN;
  if (raw instanceof Date) {
    const t = raw.getTime();
    return Number.isFinite(t) ? t : NaN;
  }
  const str = String(raw).trim();
  if (!str) return NaN;
  const hasZone = /Z$/i.test(str) || /[+-]\d{2}:?\d{2}$/.test(str);
  const t = new Date(hasZone ? str : `${str}Z`).getTime();
  return Number.isFinite(t) ? t : NaN;
}

function isWaitingLobbyStale(lobby, now = Date.now()) {
  if (!lobby || lobby.status !== 'waiting') return false;
  const explicitExpiry = parseBase44Timestamp(lobby.expires_at || lobby.expiresAt);
  const touched = parseBase44Timestamp(
    lobby.last_activity_at ||
    lobby.lastActivityAt ||
    lobby.updated_at ||
    lobby.updated_date ||
    lobby.created_at ||
    lobby.created_date,
  );
  const derivedExpiry = Number.isFinite(touched) ? touched + LOBBY_STALE_AFTER_MS : NaN;
  const expiresAt = Number.isFinite(explicitExpiry) && Number.isFinite(derivedExpiry)
    ? Math.max(explicitExpiry, derivedExpiry)
    : (Number.isFinite(explicitExpiry) ? explicitExpiry : derivedExpiry);
  return Number.isFinite(expiresAt) && expiresAt <= now;
}

export async function cleanupExpiredGameInvites({
  userEmail = '',
  now = Date.now(),
  limit = 100,
} = {}) {
  const me = normalizeEmail(userEmail);
  const filter = me ? { to_email: me, status: 'pending' } : { status: 'pending' };
  const rows = await base44.entities.GameInvite.filter(filter, '-created_date', limit).catch(() => []);
  let marked = 0;
  const checked = rows?.length || 0;

  await Promise.all((rows || []).map(async (invite) => {
    if (!isGameInviteExpired(invite, now)) return;
    await base44.entities.GameInvite.update(invite.id, {
      status: 'expired',
      expired_at: new Date(now).toISOString(),
    }).catch(() => null);
    marked += 1;
  }));

  return {
    ok: true,
    checked,
    marked,
    deleted: 0,
    ttlMs: GAME_INVITE_TTL_MS,
  };
}

export async function cleanupStaleWaitingLobbies({
  userEmail = '',
  now = Date.now(),
  limit = 100,
} = {}) {
  const me = normalizeEmail(userEmail);
  const filter = me ? { host_email: me, status: 'waiting' } : { status: 'waiting' };
  const rows = await base44.entities.Lobby.filter(filter, '-created_date', limit).catch(() => []);
  let marked = 0;
  const checked = rows?.length || 0;

  await Promise.all((rows || []).map(async (lobby) => {
    if (!isWaitingLobbyStale(lobby, now)) return;
    await base44.entities.Lobby.update(lobby.id, {
      status: 'cancelled',
      cancelled_at: new Date(now).toISOString(),
      last_activity_at: new Date(now).toISOString(),
    }).catch(() => null);
    marked += 1;
  }));

  return {
    ok: true,
    checked,
    marked,
    deleted: 0,
    staleAfterMs: LOBBY_STALE_AFTER_MS,
  };
}

export async function cleanupExpiredPushSubscriptions({
  userEmail = '',
  limit = 100,
} = {}) {
  const me = normalizeEmail(userEmail);
  const filter = me ? { user_email: me, status: 'expired' } : { status: 'expired' };
  const rows = await base44.entities.PushSubscription.filter(filter, '-disabled_at', limit).catch(() => []);

  // Policy for Phase 5: do not delete subscription rows from the client.
  // sendGameInvitePush already marks 404/410 endpoints as expired. This
  // helper only reports the cleanup candidate count until a server-side
  // retention job is introduced.
  return {
    ok: true,
    checked: rows?.length || 0,
    marked: 0,
    deleted: 0,
    policy: 'report_only_client_safe',
  };
}

export async function cleanupOldFriendRequests() {
  // FriendRequest rows are relationship history and accepted rows are the
  // normalized friendship source. Phase 5 intentionally does not delete them
  // from client code.
  return {
    ok: true,
    checked: 0,
    marked: 0,
    deleted: 0,
    policy: 'not_deleted_client_side',
  };
}

export const retentionPolicy = Object.freeze({
  gameInvites: 'mark_expired_never_delete_by_default',
  waitingLobbies: 'mark_cancelled_when_stale_never_delete_by_default',
  pushSubscriptions: 'send_push_marks_404_410_expired; client helper is report-only',
  friendRequests: 'retain relationship history; no client deletion',
});
