// lib/inviteApi.js
// Thin client wrapper around GameInvite. Mirrors the friendsApi shape:
// reads/creates go through the entities SDK (RLS-gated), and the accept path
// goes through a service-role backend function because joining a Lobby you are
// not yet a member of would be blocked by Lobby RLS.

import { base44 } from '@/api/base44Client';
import {
  GAME_INVITE_TTL_MS,
  filterActiveIncomingGameInvites,
  getGameInviteActiveFilterReason,
  getInviteCreatedAt,
  getInviteRecipientEmail,
  getInviteRemainingMs,
  isActiveIncomingGameInvite,
  isInviteExpired,
  isInvitePending,
  mergeActiveIncomingGameInvites,
  normalizeEmail,
  parseInviteExpiresAt,
  traceGameInviteLifecycle,
} from '@/lib/gameInviteSelectors';

// Codex130 — Game invite + lobby staleness TTL: 10 minutes.
// This mirrors the Base44 function constants in acceptGameInvite and
// sendGameInvitePush. Keep the client copy aligned with those server guards.
export { GAME_INVITE_TTL_MS };
export const LOBBY_STALE_AFTER_MS = 10 * 60 * 1000;

export {
  filterActiveIncomingGameInvites,
  getGameInviteActiveFilterReason,
  getInviteRemainingMs,
  isActiveIncomingGameInvite,
  mergeActiveIncomingGameInvites,
};

export function isLobbyStale(lobby, now = Date.now()) {
  if (!lobby || lobby.status !== 'waiting') return false;
  const raw = lobby.updated_date || lobby.created_date || lobby.created_at;
  const time = raw ? new Date(raw).getTime() : NaN;
  if (!Number.isFinite(time)) return false;
  return (now - time) > LOBBY_STALE_AFTER_MS;
}

export function getGameInviteCreatedAt(invite) {
  return getInviteCreatedAt(invite);
}

export function getGameInviteExpiresAt(invite) {
  return parseInviteExpiresAt(invite);
}

export function isGameInviteExpired(invite, now = Date.now()) {
  return isInviteExpired(invite, now);
}

async function expirePendingInvite(invite, { source = 'cleanup' } = {}) {
  if (!invite?.id || invite.status !== 'pending') return invite;
  traceGameInviteLifecycle('invite_expired_by_cleanup', invite, { source, reason: 'ttl_elapsed' });
  await base44.entities.GameInvite.update(invite.id, {
    status: 'expired',
    expired_at: new Date().toISOString(),
  }).catch(() => null);
  return { ...invite, status: 'expired' };
}

/** Load incoming pending invites for the current user. */
export async function loadIncomingInvites(myEmail) {
  const me = normalizeEmail(myEmail);
  if (!me) return [];
  const rows = await base44.entities.GameInvite.filter(
    { to_email: me },
    '-created_date',
    50,
  );
  const now = Date.now();
  traceGameInviteLifecycle('invite_loaded_by_fetch_batch', { id: `count:${rows?.length || 0}`, status: 'pending', to_email: me }, {
    source: 'loadIncomingInvites',
    userEmail: me,
    reason: 'batch_count',
  });
  const settled = await Promise.all((rows || []).map(async (invite) => {
    const reason = getGameInviteActiveFilterReason(invite, me, now);
    traceGameInviteLifecycle(reason.startsWith('active') ? 'invite_passed_active_filter' : 'invite_failed_active_filter', invite, {
      source: 'loadIncomingInvites',
      userEmail: me,
      reason,
      now,
    });
    return isGameInviteExpired(invite, now) ? expirePendingInvite(invite, { source: 'loadIncomingInvites' }) : invite;
  }));
  return filterActiveIncomingGameInvites(settled, me, now);
}

/** Load outgoing invites the host sent for a specific lobby (any status). */
export async function loadOutgoingInvitesForLobby(myEmail, lobbyId) {
  const me = normalizeEmail(myEmail);
  if (!me || !lobbyId) return [];
  const rows = await base44.entities.GameInvite.filter(
    { from_email: me, lobby_id: lobbyId },
    '-created_date',
    50,
  );
  const now = Date.now();
  const settled = await Promise.all((rows || []).map(async (invite) => (
    isGameInviteExpired(invite, now) ? expirePendingInvite(invite, { source: 'loadOutgoingInvitesForLobby' }) : invite
  )));
  return settled || [];
}

/**
 * Create pending invites for the given friend emails. Caller is responsible for
 * ensuring `toEmails` only contains real friends (UI enforces this).
 *
 * Best-effort: a single failed row does NOT abort the rest — we collect errors
 * and return a small summary so the host can be told which invites failed.
 */
export async function createGameInvites({ host, lobby, toEmails, playerCount }) {
  const fromEmail = normalizeEmail(host?.email);
  if (!fromEmail) throw new Error('Önce giriş yapmalısın.');
  if (!lobby?.id) throw new Error('Lobi eksik.');

  const unique = Array.from(new Set(
    (toEmails || [])
      .map(normalizeEmail)
      .filter(Boolean)
      .filter((email) => email !== fromEmail),
  ));

  const results = await Promise.allSettled(unique.map(async (toEmail) => {
    const createdAt = new Date();
    const expiresAt = new Date(createdAt.getTime() + GAME_INVITE_TTL_MS);
    const invite = await base44.entities.GameInvite.create({
      lobby_id: lobby.id,
      lobby_code: lobby.code || '',
      from_email: fromEmail,
      from_name: host?.full_name || '',
      to_email: toEmail,
      status: 'pending',
      created_at: createdAt.toISOString(),
      expires_at: expiresAt.toISOString(),
      game_mode: 'online_challenge',
      player_count: typeof playerCount === 'number' ? playerCount : undefined,
    });
    traceGameInviteLifecycle('invite_created', invite, {
      source: 'createGameInvites',
      user: host,
      userEmail: fromEmail,
      reason: 'row_created',
    });

    let push = { attempted: false, sent: 0, failed: 0, skipped: 'not_attempted' };
    try {
      const pushRes = await base44.functions.invoke('sendGameInvitePush', { inviteId: invite.id });
      push = pushRes?.data?.push || pushRes?.data || push;
    } catch (error) {
      push = { attempted: true, sent: 0, failed: 1, error: error?.message || 'push_failed' };
    }
    return { invite, push };
  }));

  const created = results.filter((r) => r.status === 'fulfilled').length;
  const failed = results
    .map((r, i) => (r.status === 'rejected' ? unique[i] : null))
    .filter(Boolean);
  const push = results.reduce((acc, result) => {
    if (result.status !== 'fulfilled') return acc;
    const item = result.value?.push || {};
    acc.attempted += item.attempted ? 1 : 0;
    acc.sent += Number(item.sent || 0);
    acc.failed += Number(item.failed || 0);
    acc.expired += Number(item.expired || 0);
    acc.subscriptionCount += Number(item.subscriptionCount || 0);
    if (item.skipped) {
      acc.skipped += 1;
      acc.skippedReasons[item.skipped] = (acc.skippedReasons[item.skipped] || 0) + 1;
    }
    if (item.error) acc.errors.push(item.error);
    if (Array.isArray(item.failedReasons)) acc.failedReasons.push(...item.failedReasons);
    return acc;
  }, { attempted: 0, sent: 0, failed: 0, expired: 0, skipped: 0, subscriptionCount: 0, skippedReasons: {}, errors: [], failedReasons: [] });

  return { created, failed, attempted: unique.length, push };
}

/**
 * Accept an incoming invite. Goes through the service-role function because
 * Lobby RLS blocks non-member updates.
 */
export async function acceptGameInvite(inviteId) {
  if (!inviteId) throw new Error('Geçersiz davet.');
  const res = await base44.functions.invoke('acceptGameInvite', { inviteId });
  if (res?.data?.error) throw new Error(res.data.error);
  return res?.data;
}

export async function openGameInvite(invite, {
  navigate,
  userEmail = '',
  source = 'openGameInvite',
  onAccepted,
} = {}) {
  if (!invite?.id) throw new Error('Geçersiz davet.');

  const now = Date.now();
  const reason = userEmail
    ? getGameInviteActiveFilterReason(invite, userEmail, now)
    : (isInvitePending(invite) && !isInviteExpired(invite, now) ? 'active' : getGameInviteActiveFilterReason(invite, getInviteRecipientEmail(invite), now));

  traceGameInviteLifecycle('invite_open_accept_attempted', invite, {
    source,
    userEmail,
    reason,
    now,
  });

  if (reason === 'expired') throw new Error('Davetin süresi doldu. Yeni bir davet iste.');
  if (!reason.startsWith('active')) throw new Error('Bu davet artık geçerli değil.');

  const res = await acceptGameInvite(invite.id);
  traceGameInviteLifecycle('invite_status_changed', { ...invite, status: 'accepted' }, {
    source,
    userEmail,
    reason: 'accepted',
  });

  if (typeof navigate === 'function') {
    if (res?.lobby?.id) {
      navigate('/lobby', { state: { joinedLobby: res.lobby } });
    } else {
      navigate('/lobby');
    }
  }
  await onAccepted?.(res);
  return res;
}

/**
 * Reject an incoming invite. RLS already lets the recipient update their own
 * invite rows, so a direct entities call is safe.
 */
export async function rejectGameInvite(inviteId) {
  if (!inviteId) throw new Error('Geçersiz davet.');
  await base44.entities.GameInvite.update(inviteId, {
    status: 'declined',
    declined_at: new Date().toISOString(),
  });
}
