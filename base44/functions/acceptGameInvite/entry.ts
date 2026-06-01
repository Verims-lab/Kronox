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
    const lobbyTouchedAt = readTime(lobby?.updated_date || lobby?.created_date);
    if (Number.isFinite(lobbyTouchedAt) && (Date.now() - lobbyTouchedAt) > LOBBY_STALE_AFTER_MS) {
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
    if (!alreadyIn) {
      const newPlayer = {
        email: user.email,
        name: (user.full_name || (user.email || '').split('@')[0] || 'Oyuncu').trim().slice(0, 15),
        ready: true,
        cards: [],
      };
      const newPlayers = [...currentPlayers, newPlayer];
      updatedLobby = await base44.asServiceRole.entities.Lobby.update(lobby.id, { players: newPlayers });

      // Verify (defensive — same as findLobbyByCode).
      const verified = await base44.asServiceRole.entities.Lobby.get(lobby.id);
      const verifiedPlayers = Array.isArray(verified?.players) ? verified.players : [];
      const persisted = verifiedPlayers.some((p) => String(p?.email || '').toLowerCase() === myEmail);
      if (!persisted) {
        const retryPlayers = [...verifiedPlayers.filter((p) => String(p?.email || '').toLowerCase() !== myEmail), newPlayer];
        updatedLobby = await base44.asServiceRole.entities.Lobby.update(lobby.id, { players: retryPlayers });
      } else {
        updatedLobby = verified || updatedLobby;
      }
    }

    await base44.asServiceRole.entities.GameInvite.update(inviteId, {
      status: 'accepted',
      accepted_at: new Date().toISOString(),
    });

    return Response.json({
      success: true,
      lobby: updatedLobby,
      debug: {
        inviteId,
        lobbyId: lobby.id,
        alreadyIn,
        playerCount: updatedLobby?.players?.length || 0,
      },
    });
  } catch (error) {
    console.error('[acceptGameInvite] error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});