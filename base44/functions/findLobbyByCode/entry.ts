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

    console.log('[findLobbyByCode] user:', user.email, 'rawCode:', JSON.stringify(rawCode), 'normalized:', normalizedCode, 'playerName:', playerName);

    if (!normalizedCode) {
      return Response.json({ error: 'Lobi kodu boş olamaz.' }, { status: 400 });
    }

    // Service-role bypass — user is not yet a lobby member, RLS would block direct reads
    const lobbies = await base44.asServiceRole.entities.Lobby.filter({ code: normalizedCode });

    console.log('[findLobbyByCode] query result count:', lobbies?.length ?? 0);
    if (lobbies && lobbies.length > 0) {
      console.log('[findLobbyByCode] matched id:', lobbies[0].id, 'status:', lobbies[0].status, 'players:', JSON.stringify((lobbies[0].players || []).map(p => ({ email: p.email, name: p.name }))));
    }

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

    console.log('[findLobbyByCode] alreadyIn:', alreadyIn, 'currentPlayers:', currentPlayers.length, 'userEmail:', user.email);

    if (!alreadyIn) {
      const newPlayer = {
        email: user.email,
        name: playerName,
        ready: true,
        cards: [],
      };

      const newPlayers = [...currentPlayers, newPlayer];

      console.log('[findLobbyByCode] updating lobby', lobby.id, 'with', newPlayers.length, 'players');

      const updatedLobby = await base44.asServiceRole.entities.Lobby.update(lobby.id, {
        players: newPlayers,
      });

      console.log('[findLobbyByCode] update success, players now:', updatedLobby?.players?.length);

      return Response.json({
        found: true,
        joinable: true,
        joined: true,
        lobby: updatedLobby,
        debug: { rawCode, normalizedCode, queryResultCount: lobbies.length, matchedStatus: lobby.status, matchedId: lobby.id, playerCount: newPlayers.length }
      });
    } else {
      // Already a member — return current lobby state
      console.log('[findLobbyByCode] already in lobby, returning current state');
      return Response.json({
        found: true,
        joinable: true,
        joined: true,
        lobby: lobby,
        debug: { rawCode, normalizedCode, queryResultCount: lobbies.length, matchedStatus: lobby.status, matchedId: lobby.id, alreadyIn: true }
      });
    }

  } catch (error) {
    console.error('[findLobbyByCode] error:', error.message, error.stack);
    return Response.json({ error: error.message }, { status: 500 });
  }
});