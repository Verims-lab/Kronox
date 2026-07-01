// lib/inviteApi.js
// Thin client wrapper around GameInvite. Mirrors the friendsApi shape:
// reads/updates go through user-scoped entity RLS; creates and accept/join
// mutations go through backend functions because GameInvite create is
// service-role owned and joining a Lobby you are not yet a member of would be
// blocked by Lobby RLS.

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
  mergeActiveIncomingGameInvites,
  normalizeEmail,
  parseKronoxTimestamp,
  parseInviteExpiresAt,
  traceGameInviteLifecycle,
} from '@/lib/gameInviteSelectors';
import { normalizeInviteTargetRef } from '@/lib/onlinePlayerSelection';

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
  const expiresAt = getLobbyExpiresAt(lobby);
  if (!Number.isFinite(expiresAt)) return false;
  return expiresAt <= now;
}

export function getLobbyTouchedAt(lobby) {
  return parseKronoxTimestamp(
    lobby?.last_activity_at ||
    lobby?.lastActivityAt ||
    lobby?.updated_at ||
    lobby?.updated_date ||
    lobby?.created_at ||
    lobby?.created_date,
  );
}

export function getLobbyExpiresAt(lobby) {
  const explicit = parseKronoxTimestamp(lobby?.expires_at || lobby?.expiresAt);
  const touched = getLobbyTouchedAt(lobby);
  const derived = Number.isFinite(touched) ? touched + LOBBY_STALE_AFTER_MS : NaN;
  if (Number.isFinite(explicit) && Number.isFinite(derived)) {
    return Math.max(explicit, derived);
  }
  return Number.isFinite(explicit) ? explicit : derived;
}

export function getLobbyStaleDiagnostics(lobby, now = Date.now()) {
  const touchedAt = getLobbyTouchedAt(lobby);
  const expiresAt = getLobbyExpiresAt(lobby);
  return {
    lobbyId: lobby?.id || null,
    status: lobby?.status || null,
    created_at: lobby?.created_at || lobby?.created_date || null,
    updated_at: lobby?.updated_at || lobby?.updated_date || null,
    last_activity_at: lobby?.last_activity_at || null,
    expires_at: lobby?.expires_at || null,
    touchedAt,
    expiresAt,
    now,
    remainingMs: Number.isFinite(expiresAt) ? expiresAt - now : NaN,
    stale: Number.isFinite(expiresAt) ? expiresAt <= now : false,
  };
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

/** Load incoming invite lifecycle rows for the current user. */
export async function loadIncomingInviteSnapshot(myEmail) {
  const me = normalizeEmail(myEmail);
  if (!me) return { rows: [], activeInvites: [], fetchedAt: Date.now() };
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
  return {
    rows: settled,
    activeInvites: filterActiveIncomingGameInvites(settled, me, now),
    fetchedAt: now,
  };
}

/** Load incoming pending invites for the current user. */
export async function loadIncomingInvites(myEmail) {
  const snapshot = await loadIncomingInviteSnapshot(myEmail);
  return snapshot.activeInvites;
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

function normalizeInviteTargets(value) {
  return Array.from(new Set(
    (Array.isArray(value) ? value : [])
      .map((item) => normalizeInviteTargetRef(item?.target_ref || item?.targetRef || item))
      .filter(Boolean),
  )).slice(0, 3);
}

function summarizePushResults(results) {
  return results.reduce((acc, result) => {
    if (result.status !== 'fulfilled') {
      acc.attempted += 1;
      acc.failed += 1;
      acc.errors.push(result.reason?.message || 'push_failed');
      return acc;
    }
    const item = result.value?.push || result.value?.data?.push || result.value?.data || {};
    acc.attempted += item.attempted ? 1 : 0;
    acc.sent += Number(item.sent || 0);
    acc.failed += Number(item.failed || 0);
    acc.expired += Number(item.expired || 0);
    acc.subscriptionCount += Number(item.subscriptionCount || 0);
    const itemSkippedReasons = item.skippedReasons && typeof item.skippedReasons === 'object' ? item.skippedReasons : null;
    if (item.skipped) {
      acc.skipped += 1;
      if (!itemSkippedReasons) {
        acc.skippedReasons[item.skipped] = (acc.skippedReasons[item.skipped] || 0) + 1;
      }
    }
    if (itemSkippedReasons) {
      Object.entries(itemSkippedReasons).forEach(([reason, count]) => {
        acc.skippedReasons[reason] = (acc.skippedReasons[reason] || 0) + Number(count || 0);
      });
    }
    if (item.missingConfig) acc.missingConfig += 1;
    if (item.error) acc.errors.push(item.error);
    if (Array.isArray(item.failedReasons)) acc.failedReasons.push(...item.failedReasons);
    return acc;
  }, { attempted: 0, sent: 0, failed: 0, expired: 0, skipped: 0, missingConfig: 0, subscriptionCount: 0, skippedReasons: {}, errors: [], failedReasons: [] });
}

async function pushCreatedInvites(invites) {
  const inviteIds = (Array.isArray(invites) ? invites : [])
    .map((invite) => invite?.id)
    .filter(Boolean);
  if (!inviteIds.length) {
    return { attempted: 0, sent: 0, failed: 0, expired: 0, skipped: 0, missingConfig: 0, subscriptionCount: 0, skippedReasons: {}, errors: [], failedReasons: [] };
  }
  const results = await Promise.allSettled(inviteIds.map(async (inviteId) => {
    try {
      return await base44.functions.invoke('sendGameInvitePush', { inviteId });
    } catch (error) {
      return { push: { attempted: true, sent: 0, failed: 1, error: error?.message || 'push_failed' } };
    }
  }));
  return summarizePushResults(results);
}

/**
 * Create pending invites for selected players. New Online player selection
 * sends opaque inviteTargets and resolves recipient email server-side. Direct
 * client GameInvite.create is intentionally disabled; GameInvite creation is
 * backend-owned so RLS create can stay admin/service-role only.
 *
 * Best-effort: a single failed row does NOT abort the rest — we collect errors
 * and return a small summary so the host can be told which invites failed.
 */
export async function createGameInvites({ host, lobby, toEmails, inviteTargets, playerCount }) {
  const fromEmail = normalizeEmail(host?.email);
  if (!fromEmail) throw new Error('Önce giriş yapmalısın.');
  if (!lobby?.id) throw new Error('Lobi eksik.');

  const unique = normalizeInviteTargets(inviteTargets);
  if (unique.length) {
    const response = await base44.functions.invoke('createGameInvitesForTargets', {
      lobby_id: lobby.id,
      target_refs: unique,
      player_count: typeof playerCount === 'number' ? playerCount : undefined,
    });
    const data = response?.data || {};
    if (data?.error) throw new Error(data.error);
    const push = await pushCreatedInvites(data.invites || []);
    const created = Number(data.created || 0);
    const failed = Array.isArray(data.failed) ? data.failed : [];
    return { created, failed, attempted: unique.length, push };
  }

  const legacyEmailTargets = Array.from(new Set(
    (toEmails || [])
      .map(normalizeEmail)
      .filter(Boolean)
      .filter((email) => email !== fromEmail),
  ));
  const push = { attempted: 0, sent: 0, failed: 0, expired: 0, skipped: 0, missingConfig: 0, subscriptionCount: 0, skippedReasons: {}, errors: [], failedReasons: [] };
  return {
    created: 0,
    failed: legacyEmailTargets.map(() => ({ code: 'backend_target_ref_required' })),
    attempted: legacyEmailTargets.length,
    push,
    privacy: {
      targetEmailReturned: false,
      backendOwnedCreateRequired: true,
    },
  };
}

/**
 * Accept an incoming invite. Goes through the service-role function because
 * Lobby RLS blocks non-member updates.
 */
export async function acceptGameInvite(inviteId) {
  if (!inviteId) throw new Error('Geçersiz davet.');
  const res = await base44.functions.invoke('acceptGameInvite', { inviteId });
  if (res?.data?.error) {
    const error = new Error(res.data.error);
    error.code = res.data.code || 'accept_failed';
    error.payload = res.data;
    throw error;
  }
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
    : getGameInviteActiveFilterReason(invite, getInviteRecipientEmail(invite), now);

  traceGameInviteLifecycle('invite_open_accept_attempted', invite, {
    source,
    userEmail,
    reason,
    now,
  });

  if (reason === 'expired') throw new Error('Davetin süresi doldu.');
  if (reason === 'missing_lobby') throw new Error('Lobi artık mevcut değil.');
  if (reason === 'recipient_mismatch') throw new Error('Bu davet sana ait değil');
  if (!reason.startsWith('active')) throw new Error('Bu davet artık geçerli değil.');

  const res = await acceptGameInvite(invite.id);
  traceGameInviteLifecycle('invite_status_changed', { ...invite, status: 'accepted' }, {
    source,
    userEmail,
    reason: 'accepted',
  });

  if (typeof navigate === 'function') {
    const verifiedLobby = res?.verifiedLobby || res?.joinedLobby || res?.lobby;
    const joinedLobby = verifiedLobby;
    if (joinedLobby?.id) {
      traceGameInviteLifecycle('lobby_navigation_started', invite, {
        source,
        userEmail,
        reason: res?.verifiedLobby ? 'accepted_verified_lobby_payload' : 'accepted_lobby_payload',
      });
      navigate('/lobby', {
        state: {
          joinedLobby,
          verifiedLobby,
          lobbyId: res.lobbyId || joinedLobby.id,
          lobbyCode: res.lobbyCode || joinedLobby.code || '',
        },
      });
    } else {
      traceGameInviteLifecycle('lobby_navigation_started', invite, {
        source,
        userEmail,
        reason: 'accepted_without_lobby_payload',
      });
      navigate('/lobby');
    }
  }
  const verifiedLobby = res?.verifiedLobby || res?.joinedLobby || res?.lobby || null;
  const joinedLobby = verifiedLobby || null;
  const acceptedResult = {
    ...res,
    joinedLobby,
    verifiedLobby,
  };
  await onAccepted?.(acceptedResult);
  return acceptedResult;
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
