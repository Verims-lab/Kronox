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

const GAME_INVITE_TTL_MS = 5 * 60 * 1000;
const readTime = (value: unknown) => {
  const time = value ? new Date(String(value)).getTime() : NaN;
  return Number.isFinite(time) ? time : NaN;
};
const getInviteExpiry = (invite: any) => {
  const explicit = readTime(invite?.expires_at || invite?.expiresAt);
  if (Number.isFinite(explicit)) return explicit;
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
