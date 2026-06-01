/**
 * findLobbyByCode / joinLobbyByCode
 * 
 * Lobby RLS blocks non-members from reading OR updating lobbies.
 * This function uses service-role to:
 * 1. Look up lobby by code
 * 2. Validate status === "waiting"
 * 3. Append the joining player atomically
 * 4. Return the full updated lobby to the client
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const normalizeCode = (code) =>
  String(code || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '')
    .replace(/[^\w]/g, '');

const readTime = (value) => {
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

const getLobbyTouchedAt = (lobby) => readTime(
  lobby?.last_activity_at ||
  lobby?.lastActivityAt ||
  lobby?.updated_at ||
  lobby?.updated_date ||
  lobby?.created_at ||
  lobby?.created_date,
);

const getLobbyExpiry = (lobby, staleAfterMs) => {
  const explicit = readTime(lobby?.expires_at || lobby?.expiresAt);
  const touched = getLobbyTouchedAt(lobby);
  const derived = Number.isFinite(touched) ? touched + staleAfterMs : NaN;
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

    const body = await req.json();
    const rawCode = body.code || '';
    const normalizedCode = normalizeCode(rawCode);
    const playerName = (body.playerName || '').trim();

    if (!normalizedCode) {
      return Response.json({ error: 'Lobi kodu boş olamaz.' }, { status: 400 });
    }

    // Service-role bypass — user is not yet a lobby member, RLS would block direct reads
    const lobbies = await base44.asServiceRole.entities.Lobby.filter({ code: normalizedCode });

    if (!lobbies || lobbies.length === 0) {
      return Response.json({
        found: false,
        error: 'Lobi bulunamadı. Kod hatalı olabilir.',
        debug: { rawCode, normalizedCode, queryResultCount: 0 }
      });
    }

    const lobby = lobbies[0];

    if (lobby.status !== 'waiting') {
      return Response.json({
        found: true,
        joinable: false,
        error: 'Bu lobi artık katılıma kapalı.',
        debug: { rawCode, normalizedCode, queryResultCount: lobbies.length, matchedStatus: lobby.status, matchedId: lobby.id }
      });
    }

    // Codex130 — Stale waiting lobby guard. A lobby that has been idle in
    // 'waiting' state for longer than 10 minutes is no longer joinable.
    // This blocks code-based joins on lobbies the host abandoned.
    const LOBBY_STALE_AFTER_MS = 10 * 60 * 1000;
    const lobbyExpiresAt = getLobbyExpiry(lobby, LOBBY_STALE_AFTER_MS);
    if (Number.isFinite(lobbyExpiresAt) && lobbyExpiresAt <= Date.now()) {
      return Response.json({
        found: true,
        joinable: false,
        error: 'Lobi süresi doldu. Yeni bir meydan okuma başlatabilirsin.',
        debug: {
          rawCode, normalizedCode, queryResultCount: lobbies.length,
          matchedStatus: lobby.status, matchedId: lobby.id,
          stale: true, lobbyExpiresAt,
        },
      });
    }

    // If no playerName provided, this is a lookup-only call — return lobby info without joining
    if (!playerName) {
      return Response.json({
        found: true,
        joinable: true,
        joined: false,
        lobby: {
          id: lobby.id,
          code: lobby.code,
          status: lobby.status,
          host_name: lobby.host_name,
          player_count: lobby.players?.length ?? 0,
        },
        debug: { rawCode, normalizedCode, queryResultCount: lobbies.length, matchedStatus: lobby.status, matchedId: lobby.id }
      });
    }

    // --- Perform the join atomically via service role ---
    const currentPlayers = lobby.players || [];
    const alreadyIn = currentPlayers.some(p => p.email === user.email);

    if (!alreadyIn) {
      const newPlayer = {
        email: user.email,
        name: playerName,
        ready: true,
        cards: [],
      };

      const newPlayers = [...currentPlayers, newPlayer];

      const nowIso = new Date().toISOString();
      const updatedLobby = await base44.asServiceRole.entities.Lobby.update(lobby.id, {
        players: newPlayers,
        last_activity_at: nowIso,
      });

      const verifiedLobby = await base44.asServiceRole.entities.Lobby.get(lobby.id);
      const verifiedPlayers = Array.isArray(verifiedLobby?.players) ? verifiedLobby.players : [];
      const joinPersisted = verifiedPlayers.some((p) => p?.email === user.email);

      if (!joinPersisted) {
        const retryPlayers = [...verifiedPlayers.filter((p) => p?.email !== user.email), newPlayer];
        console.warn('[findLobbyByCode] join verification failed, retrying merge append:', {
          lobbyId: lobby.id,
          verifiedPlayersCount: verifiedPlayers.length,
          retryPlayersCount: retryPlayers.length,
        });
        const retryLobby = await base44.asServiceRole.entities.Lobby.update(lobby.id, {
          players: retryPlayers,
          last_activity_at: nowIso,
        });

        return Response.json({
          found: true,
          joinable: true,
          joined: true,
          lobby: retryLobby,
          debug: {
            rawCode,
            normalizedCode,
            queryResultCount: lobbies.length,
            matchedStatus: lobby.status,
            matchedId: lobby.id,
            existingPlayersCount: currentPlayers.length,
            playerCount: retryLobby?.players?.length || retryPlayers.length,
            retryApplied: true,
          }
        });
      }

      return Response.json({
        found: true,
        joinable: true,
        joined: true,
        lobby: verifiedLobby || updatedLobby,
        debug: {
          rawCode,
          normalizedCode,
          queryResultCount: lobbies.length,
          matchedStatus: lobby.status,
          matchedId: lobby.id,
          existingPlayersCount: currentPlayers.length,
          playerCount: verifiedPlayers.length || newPlayers.length,
          retryApplied: false,
        }
      });
    } else {
      // Already a member — return current lobby state
      return Response.json({
        found: true,
        joinable: true,
        joined: true,
        lobby: lobby,
        debug: { rawCode, normalizedCode, queryResultCount: lobbies.length, matchedStatus: lobby.status, matchedId: lobby.id, alreadyIn: true }
      });
    }

  } catch (error) {
    console.error('[findLobbyByCode] error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
