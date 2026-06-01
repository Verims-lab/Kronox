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
// Codex138 — Base44 server `created_date` may be serialized WITHOUT a
// timezone suffix (e.g. "2026-05-31T14:33:11.992000"). `new Date()` then
// treats it as local time, breaking the 10-min TTL math. Server timestamps
// are always UTC, so we append `Z` to naive ISO strings before parsing.
const readTime = (value: unknown) => {
  if (value == null) return NaN;
  if (value instanceof Date) {
    const t = value.getTime();
    return Number.isFinite(t) ? t : NaN;
  }
  const str = String(value).trim();
  if (!str) return NaN;
  const hasZone = /Z$/i.test(str) || /[+-]\d{2}:?\d{2}$/.test(str);
  const t = new Date(hasZone ? str : `${str}Z`).getTime();
  return Number.isFinite(t) ? t : NaN;
};
const getInviteExpiry = (invite: any) => {
  const explicit = readTime(invite?.expires_at || invite?.expiresAt);
  if (Number.isFinite(explicit)) return explicit;
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
      return Response.json({ error: 'Davet bulunamadı.' }, { status: 404 });
    }

    const myEmail = String(user.email || '').toLowerCase();
    const toEmail = String(invite.to_email || '').toLowerCase();

    if (toEmail !== myEmail) {
      return Response.json({ error: 'Bu davet sana ait değil.' }, { status: 403 });
    }
    if (invite.status !== 'pending') {
      return Response.json({ error: `Davet zaten ${invite.status}.` }, { status: 409 });
    }
    const expiresAt = getInviteExpiry(invite);
    if (Number.isFinite(expiresAt) && expiresAt <= Date.now()) {
      await base44.asServiceRole.entities.GameInvite.update(inviteId, {
        status: 'expired',
        expired_at: new Date().toISOString(),
      }).catch(() => {});
      return Response.json({ error: 'Davetin süresi doldu. Yeni bir davet iste.' }, { status: 409 });
    }

    if (!invite.lobby_id) {
      return Response.json({ error: 'Davet eksik: lobi bilgisi yok.' }, { status: 400 });
    }

    const lobby = await base44.asServiceRole.entities.Lobby.get(invite.lobby_id);
    if (!lobby) {
      return Response.json({ error: 'Lobi artık mevcut değil.' }, { status: 404 });
    }
    if (lobby.status !== 'waiting') {
      // Mark expired so the recipient stops seeing it.
      await base44.asServiceRole.entities.GameInvite.update(inviteId, { status: 'expired' }).catch(() => {});
      return Response.json({ error: 'Bu davet artık geçerli değil — oyun başlamış olabilir.' }, { status: 409 });
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
        error: 'Lobi süresi doldu. Yeni bir meydan okuma başlatabilirsin.',
      }, { status: 409 });
    }

    // Atomic append (same pattern as findLobbyByCode).
    const currentPlayers = Array.isArray(lobby.players) ? lobby.players : [];
    const alreadyIn = currentPlayers.some((p) => String(p?.email || '').toLowerCase() === myEmail);

    let updatedLobby = lobby;
    const nowIso = new Date().toISOString();
    if (!alreadyIn) {
      const newPlayer = {
        email: user.email,
        name: (user.full_name || (user.email || '').split('@')[0] || 'Oyuncu').trim().slice(0, 15),
        ready: true,
        cards: [],
      };
      const newPlayers = [...currentPlayers, newPlayer];
      updatedLobby = await base44.asServiceRole.entities.Lobby.update(lobby.id, {
        players: newPlayers,
        last_activity_at: nowIso,
      });

      // Verify (defensive — same as findLobbyByCode).
      const verified = await base44.asServiceRole.entities.Lobby.get(lobby.id);
      const verifiedPlayers = Array.isArray(verified?.players) ? verified.players : [];
      const persisted = verifiedPlayers.some((p) => String(p?.email || '').toLowerCase() === myEmail);
      if (!persisted) {
        const retryPlayers = [...verifiedPlayers.filter((p) => String(p?.email || '').toLowerCase() !== myEmail), newPlayer];
        updatedLobby = await base44.asServiceRole.entities.Lobby.update(lobby.id, {
          players: retryPlayers,
          last_activity_at: nowIso,
        });
      } else {
        updatedLobby = verified || updatedLobby;
      }
    }

    await base44.asServiceRole.entities.GameInvite.update(inviteId, {
      status: 'accepted',
      accepted_at: nowIso,
    });

    return Response.json({
      success: true,
      lobby: updatedLobby,
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
