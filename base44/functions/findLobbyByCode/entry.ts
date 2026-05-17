/**
 * findLobbyByCode — Service-role lobby lookup.
 * RLS on Lobby blocks non-members from reading lobbies.
 * This function bypasses RLS to allow join-by-code flow.
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

    // Must be authenticated to join
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Giriş yapmanız gerekiyor.' }, { status: 401 });
    }

    const body = await req.json();
    const rawCode = body.code || '';
    const normalizedCode = normalizeCode(rawCode);

    console.log('[findLobbyByCode] user:', user.email);
    console.log('[findLobbyByCode] rawCode:', JSON.stringify(rawCode));
    console.log('[findLobbyByCode] normalizedCode:', normalizedCode);

    if (!normalizedCode) {
      return Response.json({ error: 'Lobi kodu boş olamaz.' }, { status: 400 });
    }

    // Use service role to bypass RLS — user is not yet a member of this lobby
    const lobbies = await base44.asServiceRole.entities.Lobby.filter({ code: normalizedCode });

    console.log('[findLobbyByCode] query result count:', lobbies?.length ?? 0);
    if (lobbies && lobbies.length > 0) {
      console.log('[findLobbyByCode] matched lobby id:', lobbies[0].id, 'status:', lobbies[0].status);
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

    // Return only safe public fields needed to join
    return Response.json({
      found: true,
      joinable: true,
      lobby: {
        id: lobby.id,
        code: lobby.code,
        status: lobby.status,
        host_name: lobby.host_name,
        player_count: lobby.players?.length ?? 0,
      },
      debug: { rawCode, normalizedCode, queryResultCount: lobbies.length, matchedStatus: lobby.status, matchedId: lobby.id }
    });

  } catch (error) {
    console.error('[findLobbyByCode] error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});