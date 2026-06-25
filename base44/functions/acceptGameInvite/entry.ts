/**
 * acceptGameInvite
 *
 * Recipient-only accept. Adds the recipient to Lobby.players via service role
 * (RLS forbids the client from updating a Lobby they are not yet a member of)
 * and marks the GameInvite as accepted.
 *
 * Mirrors the safe append pattern already used in findLobbyByCode.js so
 * multiplayer authority assumptions stay intact.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Codex130 — Game invite + lobby staleness TTL: 10 minutes.
const GAME_INVITE_TTL_MS = 10 * 60 * 1000;
const LOBBY_STALE_AFTER_MS = 10 * 60 * 1000;
// Codex139 — Naive ISO timestamp guard.
// Base44 server `created_date` / `expires_at` are sometimes serialized
// WITHOUT a timezone suffix (e.g. "2026-05-31T14:33:11.992000"). `new Date()`
// then treats it as LOCAL time, breaking the 10-min TTL math on any non-UTC
// host (Europe/Istanbul is UTC+3 → a fresh invite parses ~3h in the past
// and is instantly flagged as expired).
//
// Server timestamps are always UTC, so `parseInviteTimestamp` appends `Z`
// to naive ISO strings before parsing. `readTime` is kept as a numeric
// wrapper used by the existing TTL math + stale-lobby guard call sites.
function parseInviteTimestamp(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  const str = String(value).trim();
  if (!str) return null;
  const hasZone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(str);
  const normalized = hasZone ? str : `${str}Z`;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}
const readTime = (value: unknown) => {
  const d = parseInviteTimestamp(value);
  return d ? d.getTime() : NaN;
};
const getInviteExpiry = (invite: any) => {
  // Codex139 — expires_at is parsed through the safe parser so naive ISO
  // strings (no zone) are treated as UTC, not local time.
  const explicitDate = parseInviteTimestamp(invite?.expires_at || invite?.expiresAt);
  if (explicitDate) return explicitDate.getTime();
  const created = readTime(invite?.created_at || invite?.createdAt || invite?.created_date || invite?.createdDate);
  return Number.isFinite(created) ? created + GAME_INVITE_TTL_MS : NaN;
};
const getLobbyTouchedAt = (lobby: any) => readTime(
  lobby?.last_activity_at ||
  lobby?.lastActivityAt ||
  lobby?.updated_at ||
  lobby?.updated_date ||
  lobby?.created_at ||
  lobby?.created_date,
);
const getLobbyExpiry = (lobby: any) => {
  const explicit = readTime(lobby?.expires_at || lobby?.expiresAt);
  const touched = getLobbyTouchedAt(lobby);
  const derived = Number.isFinite(touched) ? touched + LOBBY_STALE_AFTER_MS : NaN;
  if (Number.isFinite(explicit) && Number.isFinite(derived)) return Math.max(explicit, derived);
  return Number.isFinite(explicit) ? explicit : derived;
};

const normalizeEmail = (value: unknown) => String(value || '').trim().toLowerCase();

const readRevision = (value: unknown) => {
  const revision = Number(value);
  return Number.isFinite(revision) && revision >= 0 ? Math.trunc(revision) : 0;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const getPlayerIdentityKey = (player: any) => {
  const email = normalizeEmail(player?.email);
  if (email) return `email:${email}`;
  const name = String(player?.name || '').trim().toLowerCase();
  return name ? `name:${name}` : '';
};

const normalizeLobbyPlayer = (player: any) => ({
  ...player,
  email: player?.email || '',
  name: String(player?.name || '').trim() || 'Oyuncu',
  ready: player?.ready ?? true,
  cards: Array.isArray(player?.cards) ? player.cards : [],
});

const mergePlayersByIdentity = (players: any[] = [], additions: any[] = []) => {
  const seen = new Set<string>();
  const merged: any[] = [];
  [...(Array.isArray(players) ? players : []), ...(Array.isArray(additions) ? additions : [])]
    .map(normalizeLobbyPlayer)
    .forEach((player) => {
      const key = getPlayerIdentityKey(player);
      if (!key || seen.has(key)) return;
      seen.add(key);
      merged.push(player);
    });
  return merged;
};

const hasPlayer = (players: any[] = [], player: any) => {
  const key = getPlayerIdentityKey(player);
  return Boolean(key && players.some((candidate) => getPlayerIdentityKey(candidate) === key));
};

const getInvitePlayerName = (user: any, invite: any) =>
  String(
    user?.full_name ||
    invite?.to_name ||
    (user?.email || invite?.to_email || '').split('@')[0] ||
    'Oyuncu',
  ).trim().slice(0, 15) || 'Oyuncu';

const appendPlayerWithMergeRetry = async (base44: any, lobby: any, newPlayer: any) => {
  const delays = [0, 120, 260];
  let latest = lobby;
  let updatedLobby = lobby;
  let retryApplied = false;

  for (let attempt = 0; attempt < delays.length; attempt += 1) {
    if (delays[attempt]) await sleep(delays[attempt]);
    latest = attempt === 0 ? latest : await base44.asServiceRole.entities.Lobby.get(lobby.id);
    if (!latest || latest.status !== 'waiting') {
      return { lobby: latest || updatedLobby || lobby, joined: false, retryApplied, statusChanged: true };
    }

    const currentPlayers = Array.isArray(latest.players) ? latest.players : [];
    const mergedPlayers = mergePlayersByIdentity(currentPlayers, [newPlayer]);
    if (hasPlayer(currentPlayers, newPlayer) && mergedPlayers.length === currentPlayers.length) {
      return { lobby: latest, joined: true, retryApplied, alreadyIn: true };
    }

    retryApplied = attempt > 0 || retryApplied;
    updatedLobby = await base44.asServiceRole.entities.Lobby.update(lobby.id, {
      players: mergedPlayers,
      last_activity_at: new Date().toISOString(),
      state_revision: readRevision(latest.state_revision) + 1,
    });

    const verified = await base44.asServiceRole.entities.Lobby.get(lobby.id);
    const verifiedPlayers = Array.isArray(verified?.players) ? verified.players : [];
    if (hasPlayer(verifiedPlayers, newPlayer)) {
      return { lobby: verified || updatedLobby, joined: true, retryApplied };
    }
  }

  return { lobby: updatedLobby || latest || lobby, joined: hasPlayer(updatedLobby?.players || [], newPlayer), retryApplied: true };
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Giriş yapmanız gerekiyor.' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const inviteId = String(body?.inviteId || '').trim();
    if (!inviteId) {
      return Response.json({ error: 'inviteId is required' }, { status: 400 });
    }

    const invite = await base44.asServiceRole.entities.GameInvite.get(inviteId);
    if (!invite) {
      return Response.json({ code: 'invite_not_found', error: 'Davet bulunamadı.' }, { status: 404 });
    }

    const myEmail = String(user.email || '').trim().toLowerCase();
    const toEmail = String(invite.to_email || '').trim().toLowerCase();

    if (toEmail !== myEmail) {
      return Response.json({ code: 'unauthorized', error: 'Bu davet sana ait değil' }, { status: 403 });
    }
    if (invite.status !== 'pending') {
      if (invite.status === 'accepted' && invite.lobby_id) {
        const acceptedLobby = await base44.asServiceRole.entities.Lobby.get(invite.lobby_id).catch(() => null);
        if (acceptedLobby) {
          let returnLobby = acceptedLobby;
          if (acceptedLobby.status === 'waiting') {
            const restored = await appendPlayerWithMergeRetry(base44, acceptedLobby, {
              email: user.email,
              name: getInvitePlayerName(user, invite),
              ready: true,
              cards: [],
            });
            returnLobby = restored.lobby || acceptedLobby;
          }
          return Response.json({
            ok: true,
            success: true,
            alreadyAccepted: true,
            invite,
            lobby: returnLobby,
            lobbyId: returnLobby.id,
            lobbyCode: returnLobby.code || invite.lobby_code || '',
          });
        }
        return Response.json({ code: 'lobby_not_found', error: 'Lobi artık mevcut değil.' }, { status: 404 });
      }
      return Response.json({ code: `already_${invite.status}`, error: `Davet zaten ${invite.status}.` }, { status: 409 });
    }
    const expiresAt = getInviteExpiry(invite);
    if (Number.isFinite(expiresAt) && expiresAt <= Date.now()) {
      await base44.asServiceRole.entities.GameInvite.update(inviteId, {
        status: 'expired',
        expired_at: new Date().toISOString(),
      }).catch(() => {});
      return Response.json({ code: 'invite_expired', error: 'Davetin süresi doldu.' }, { status: 409 });
    }

    if (!invite.lobby_id) {
      return Response.json({ code: 'lobby_not_found', error: 'Lobi artık mevcut değil.' }, { status: 404 });
    }

    const lobby = await base44.asServiceRole.entities.Lobby.get(invite.lobby_id);
    if (!lobby) {
      return Response.json({ code: 'lobby_not_found', error: 'Lobi artık mevcut değil.' }, { status: 404 });
    }
    if (lobby.status !== 'waiting') {
      // Mark expired so the recipient stops seeing it.
      await base44.asServiceRole.entities.GameInvite.update(inviteId, { status: 'expired' }).catch(() => {});
      return Response.json({ code: 'lobby_not_joinable', error: 'Bu davet artık geçerli değil — oyun başlamış olabilir.' }, { status: 409 });
    }

    // Codex130 — Stale waiting lobby guard. If a lobby has been sitting in
    // 'waiting' state for longer than LOBBY_STALE_AFTER_MS (10 min) without
    // anyone starting the game, the invite is no longer joinable. We mark
    // the invite expired and bail. The lobby itself is left as-is — the
    // host (or a later cleanup pass) can delete it; we only block join.
    const lobbyExpiresAt = getLobbyExpiry(lobby);
    if (Number.isFinite(lobbyExpiresAt) && lobbyExpiresAt <= Date.now()) {
      await base44.asServiceRole.entities.GameInvite.update(inviteId, {
        status: 'expired',
        expired_at: new Date().toISOString(),
      }).catch(() => {});
      return Response.json({
        code: 'lobby_expired',
        error: 'Lobi süresi doldu. Yeni bir meydan okuma başlatabilirsin.',
      }, { status: 409 });
    }

    // Merge/retry append (same pattern as findLobbyByCode).
    const currentPlayers = Array.isArray(lobby.players) ? lobby.players : [];
    const alreadyIn = currentPlayers.some((p) => normalizeEmail(p?.email) === myEmail);

    let updatedLobby = lobby;
    const nowIso = new Date().toISOString();
    const acceptedPlayerName = getInvitePlayerName(user, invite);
    if (!alreadyIn) {
      const newPlayer = {
        email: user.email,
        name: acceptedPlayerName,
        ready: true,
        cards: [],
      };
      const mergeResult = await appendPlayerWithMergeRetry(base44, lobby, newPlayer);
      updatedLobby = mergeResult.lobby || updatedLobby;
      if (mergeResult.statusChanged) {
        await base44.asServiceRole.entities.GameInvite.update(inviteId, { status: 'expired' }).catch(() => {});
        return Response.json({ code: 'lobby_not_joinable', error: 'Bu davet artık geçerli değil — oyun başlamış olabilir.' }, { status: 409 });
      }
    }

    const updatedInvite = await base44.asServiceRole.entities.GameInvite.update(inviteId, {
      status: 'accepted',
      accepted_at: nowIso,
      to_name: acceptedPlayerName,
    });

    return Response.json({
      ok: true,
      success: true,
      invite: updatedInvite,
      lobby: updatedLobby,
      lobbyId: updatedLobby?.id || lobby.id,
      lobbyCode: updatedLobby?.code || lobby.code || invite.lobby_code || '',
      debug: {
        inviteId,
        lobbyId: lobby.id,
        lobbyExpiresAt: Number.isFinite(lobbyExpiresAt) ? new Date(lobbyExpiresAt).toISOString() : null,
        alreadyIn,
        playerCount: updatedLobby?.players?.length || 0,
      },
    });
  } catch (error) {
    console.error('[acceptGameInvite] error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
