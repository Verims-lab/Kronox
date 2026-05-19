import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const summarizePlayers = (players: any[] = []) =>
  players.map((player, index) => ({
    index,
    email: player?.email || null,
    name: player?.name || null,
    cardCount: Array.isArray(player?.cards) ? player.cards.length : 0,
  }));

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user?.email) {
      return json({ error: 'Giris yapmaniz gerekiyor.' }, 401);
    }

    const body = await req.json();
    const lobbyId = body?.lobbyId;

    if (!lobbyId) {
      return json({ error: 'lobbyId gerekli.' }, 400);
    }

    const lobby = await base44.asServiceRole.entities.Lobby.get(lobbyId);
    if (!lobby) {
      return json({ error: 'Lobi bulunamadi.' }, 404);
    }

    const lobbyPlayers = Array.isArray(lobby.players) ? lobby.players : [];
    const actorIndex = lobbyPlayers.findIndex((player) => player?.email === user.email);
    const activeIndex = lobby.current_player_index ?? 0;
    const activePlayer = lobbyPlayers[activeIndex];
    const isHost = lobby.host_email === user.email;
    const isAdmin = user.role === 'admin';
    const isLobbyPlayer = actorIndex >= 0;

    if (!isLobbyPlayer && !isHost && !isAdmin) {
      return json({
        error: 'Bu lobi icin yetkiniz yok.',
        debug: { lobbyId, actorEmail: user.email, lobbyPlayerEmails: lobbyPlayers.map((p) => p?.email) },
      }, 403);
    }

    if (!isAdmin && activePlayer?.email && activePlayer.email !== user.email) {
      return json({
        error: 'Sira sizde degil.',
        debug: {
          lobbyId,
          actorEmail: user.email,
          activePlayerEmail: activePlayer.email,
          activeIndex,
          actorIndex,
        },
      }, 409);
    }

    const incomingPlayers = Array.isArray(body.players) ? body.players : null;
    const incomingUsedIds = Array.isArray(body.used_question_ids) ? body.used_question_ids : null;
    const nextStatus = body.status || lobby.status || 'in_game';
    const nextPlayerIndex = body.current_player_index;
    const nextQuestionId = body.current_question_id;

    if (!incomingPlayers || !incomingUsedIds) {
      return json({ error: 'Eksik oyuncu veya soru gecmisi.' }, 400);
    }

    if (nextStatus !== 'finished' && (typeof nextPlayerIndex !== 'number' || !nextQuestionId)) {
      return json({ error: 'Eksik tur veya soru bilgisi.' }, 400);
    }

    const updateData: Record<string, unknown> = {
      players: incomingPlayers,
      used_question_ids: incomingUsedIds,
      status: nextStatus,
      current_player_index: typeof nextPlayerIndex === 'number' ? nextPlayerIndex : activeIndex,
    };

    if (nextQuestionId) {
      updateData.current_question_id = nextQuestionId;
    }

    if (nextStatus === 'finished' && body.winner) {
      updateData.winner = body.winner;
      if (body.winner_email) {
        updateData.winner_email = body.winner_email;
      }
    }

    const debug = {
      actorEmail: user.email,
      actorName: body.actorName || lobbyPlayers[actorIndex]?.name || user.full_name || user.email,
      lobbyId,
      current_player_index_before: lobby.current_player_index ?? 0,
      next_current_player_index: updateData.current_player_index,
      current_question_id_before: lobby.current_question_id || null,
      next_current_question_id: updateData.current_question_id || null,
      statusBefore: lobby.status,
      statusAfter: nextStatus,
      playersSummary: summarizePlayers(incomingPlayers),
      updateFields: Object.keys(updateData),
    };

    console.log('[updateLobbyGameState] applying online turn update', debug);

    const updatedLobby = await base44.asServiceRole.entities.Lobby.update(lobbyId, updateData);

    return json({
      success: true,
      lobby: updatedLobby,
      debug,
    });
  } catch (error) {
    console.error('[updateLobbyGameState] failed:', error);
    return json({
      error: error?.message || 'Online oyun durumu guncellenemedi.',
    }, 500);
  }
});
