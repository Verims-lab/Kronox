import { createClientFromRequest } from 'npm:@base44/sdk@0.8.34';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const summarizePlayers = (players: any[] = []) =>
  players.map((player, index) => ({
    index,
    cardCount: Array.isArray(player?.cards) ? player.cards.length : 0,
  }));

const VALID_STATUSES = new Set(['waiting', 'starting', 'in_game', 'finished']);
const VALID_ACTIONS = new Set(['place_card', 'advance_turn', 'skip_question']);

const reject = (message: string, debug: Record<string, unknown> = {}, status = 400, code = 'validation_error') =>
  json({ error: message, code, debug }, status);

const readRevision = (value: unknown) => {
  const revision = Number(value);
  return Number.isFinite(revision) && revision >= 0 ? Math.trunc(revision) : 0;
};

const normalizeQuestionId = (value: unknown): string | null => {
  if (value === undefined || value === null || value === '') return null;
  return String(value);
};

const normalizeCards = (player: any) => Array.isArray(player?.cards) ? player.cards : [];

const cardsEqual = (a: any[] = [], b: any[] = []) => JSON.stringify(a || []) === JSON.stringify(b || []);

const getNextPlayerIndex = (currentIndex: number, playersLength: number) => {
  if (!Number.isFinite(playersLength) || playersLength <= 0) return 0;
  if (!Number.isFinite(currentIndex) || currentIndex < 0 || currentIndex >= playersLength) return 0;
  return (currentIndex + 1) % playersLength;
};

const isValidCard = (card: any) =>
  card && typeof card === 'object' && Number.isFinite(card.year);

const containsAllPreviousIds = (previousIds: any[] = [], incomingIds: any[] = []) => {
  const incomingSet = new Set(incomingIds);
  return previousIds.every((id) => incomingSet.has(id));
};

const validateGameStateUpdate = ({
  lobby,
  user,
  actorIndex,
  action,
  previousPlayerIndex,
  previousQuestionId,
  incomingPlayers,
  incomingUsedIds,
  nextStatus,
  nextPlayerIndex,
  nextQuestionId,
  winner,
  winnerEmail,
}: {
  lobby: any;
  user: any;
  actorIndex: number;
  action: string;
  previousPlayerIndex?: number;
  previousQuestionId?: string | null;
  incomingPlayers: any[];
  incomingUsedIds: any[];
  nextStatus: string;
  nextPlayerIndex: number;
  nextQuestionId: string | null;
  winner?: string;
  winnerEmail?: string;
}) => {
  const lobbyPlayers = Array.isArray(lobby.players) ? lobby.players : [];
  const activeIndex = lobby.current_player_index ?? 0;
  const activePlayer = lobbyPlayers[activeIndex];
  const previousUsedIds = Array.isArray(lobby.used_question_ids)
    ? lobby.used_question_ids.map(normalizeQuestionId).filter(Boolean) as string[]
    : [];
  const currentLobbyQuestionId = normalizeQuestionId(lobby.current_question_id);
  const winCardCount = Number(lobby.win_card_count || 10);

  if (typeof previousPlayerIndex === 'number' && previousPlayerIndex !== activeIndex) {
    return reject('Lobi durumu guncel degil. Son durum yukleniyor.', {
      expected: activeIndex,
      actual: previousPlayerIndex,
      lobbyId: lobby.id,
    }, 409, 'stale_write');
  }

  if (previousQuestionId && currentLobbyQuestionId && previousQuestionId !== currentLobbyQuestionId) {
    return reject('Soru durumu guncel degil. Son durum yukleniyor.', {
      expected: currentLobbyQuestionId,
      actual: previousQuestionId,
      lobbyId: lobby.id,
    }, 409, 'stale_write');
  }

  if (!VALID_ACTIONS.has(action)) {
    return reject('Gecersiz oyun aksiyonu.', { action }, 400);
  }

  if (!VALID_STATUSES.has(lobby.status || 'waiting')) {
    return reject('Gecersiz lobi durumu.', { status: lobby.status }, 409);
  }

  if (lobby.deleted || lobby.is_deleted) {
    return reject('Lobi artik kullanilabilir degil.', { lobbyId: lobby.id }, 410);
  }

  if (lobby.status === 'finished') {
    return reject('Oyun zaten bitti.', { lobbyId: lobby.id, status: lobby.status }, 409);
  }

  if (!VALID_STATUSES.has(nextStatus)) {
    return reject('Gecersiz hedef oyun durumu.', { nextStatus }, 400);
  }

  if (actorIndex < 0) {
    return reject('Bu lobi icin oyuncu yetkiniz yok.', {
      lobbyId: lobby.id,
      actorEmail: user.email,
      lobbyPlayerEmails: lobbyPlayers.map((p: any) => p?.email),
    }, 403);
  }

  if (activePlayer?.email && activePlayer.email !== user.email) {
    return reject('Sira sizde degil.', {
      lobbyId: lobby.id,
      actorEmail: user.email,
      activePlayerEmail: activePlayer.email,
      activeIndex,
      actorIndex,
    }, 409);
  }

  if (incomingPlayers.length !== lobbyPlayers.length) {
    return reject('Oyuncu listesi degistirilemez.', {
      expected: lobbyPlayers.length,
      actual: incomingPlayers.length,
    }, 400);
  }

  for (let index = 0; index < lobbyPlayers.length; index += 1) {
    if (incomingPlayers[index]?.email !== lobbyPlayers[index]?.email) {
      return reject('Oyuncu sirasi veya kimligi degistirilemez.', {
        index,
        expected: lobbyPlayers[index]?.email || null,
        actual: incomingPlayers[index]?.email || null,
      }, 400);
    }
  }

  if (typeof nextPlayerIndex !== 'number' || nextPlayerIndex < 0 || nextPlayerIndex >= lobbyPlayers.length) {
    return reject('Gecersiz siradaki oyuncu indeksi.', {
      expected: `0..${Math.max(lobbyPlayers.length - 1, 0)}`,
      actual: nextPlayerIndex,
    }, 400);
  }

  for (let index = 0; index < lobbyPlayers.length; index += 1) {
    const previousCards = normalizeCards(lobbyPlayers[index]);
    const incomingCards = normalizeCards(incomingPlayers[index]);

    if (!incomingCards.every(isValidCard)) {
      return reject('Gecersiz kart verisi.', { index }, 400);
    }

    if (index !== activeIndex && !cardsEqual(previousCards, incomingCards)) {
      return reject('Aktif olmayan oyuncunun kartlari degistirilemez.', { index }, 400);
    }

    if (index === activeIndex) {
      if (action === 'skip_question' && !cardsEqual(previousCards, incomingCards)) {
        return reject('Soru atlama kart durumunu degistiremez.', { activeIndex }, 400);
      }

      const delta = incomingCards.length - previousCards.length;
      if (delta < 0 || delta > 1) {
        return reject('Aktif oyuncu bir turda en fazla bir kart kazanabilir.', {
          previous: previousCards.length,
          actual: incomingCards.length,
        }, 400);
      }
      if (!incomingCards.slice(0, previousCards.length).every((card: any, cardIndex: number) => cardsEqual([card], [previousCards[cardIndex]]))) {
        return reject('Mevcut kartlar degistirilemez.', { activeIndex }, 400);
      }
    }
  }

  if (!containsAllPreviousIds(previousUsedIds, incomingUsedIds)) {
    return reject('Kullanilmis soru gecmisi eksiltilemez.', {
      expected: previousUsedIds,
      actual: incomingUsedIds,
    }, 400);
  }

  if (!incomingUsedIds.every((id) => typeof id === 'string')) {
    return reject('Kullanilmis soru IDleri metin olmali.', { incomingUsedIds }, 400);
  }

  const onlineDeckIds = new Set(
    (Array.isArray(lobby.online_question_deck) ? lobby.online_question_deck : [])
      .map((question: any) => normalizeQuestionId(question?.id))
      .filter(Boolean) as string[]
  );
  if (onlineDeckIds.size > 0) {
    const usedOutsideDeck = incomingUsedIds.filter((id) => !onlineDeckIds.has(id));
    if (usedOutsideDeck.length > 0) {
      return reject('Online soru gecmisi paylasilan deste disindan olamaz.', {
        lobbyId: lobby.id,
        usedOutsideDeck,
      }, 400);
    }
    if (nextQuestionId && !onlineDeckIds.has(nextQuestionId)) {
      return reject('Siradaki soru paylasilan Online destesinde olmali.', {
        lobbyId: lobby.id,
        nextQuestionId,
      }, 400);
    }
  }

  const previousUsedSet = new Set(previousUsedIds);
  const addedUsedIds = incomingUsedIds.filter((id) => !previousUsedSet.has(id));
  if (addedUsedIds.length > 2) {
    return reject('Bir turda beklenenden fazla soru IDsi eklenemez.', {
      expected: 'en fazla 2 yeni ID',
      actual: addedUsedIds,
    }, 400);
  }

  if (nextQuestionId && !incomingUsedIds.includes(nextQuestionId)) {
    return reject('Siradaki soru kullanilmis soru listesinde olmali.', {
      nextQuestionId,
      incomingUsedIds,
    }, 400);
  }

  if (action === 'skip_question') {
    if (nextStatus === 'finished') {
      return reject('Soru atlama oyunu bitiremez.', { nextStatus }, 400);
    }
    if (nextPlayerIndex !== activeIndex) {
      return reject('Soru atlama sira sahibini degistiremez.', {
        expected: activeIndex,
        actual: nextPlayerIndex,
      }, 400);
    }
    if (!nextQuestionId || nextQuestionId === currentLobbyQuestionId) {
      return reject('Soru atlama yeni soru gerektirir.', {
        previousQuestionId: currentLobbyQuestionId || null,
        nextQuestionId,
      }, 400);
    }
    if (currentLobbyQuestionId && !incomingUsedIds.includes(currentLobbyQuestionId)) {
      return reject('Atlanan soru kullanilmis soru listesinde kalmali.', {
        skippedQuestionId: currentLobbyQuestionId,
        incomingUsedIds,
      }, 400);
    }
    return null;
  }

  if (nextStatus !== 'finished') {
    const expectedNextIndex = getNextPlayerIndex(activeIndex, lobbyPlayers.length);
    if (nextPlayerIndex !== expectedNextIndex) {
      return reject('Tur sirasi beklenen oyuncuya ilerlemeli.', {
        expected: expectedNextIndex,
        actual: nextPlayerIndex,
      }, 400);
    }
    if (!nextQuestionId) {
      return reject('Siradaki soru bilgisi gerekli.', {}, 400);
    }
    return null;
  }

  const winnerIndex = incomingPlayers.findIndex((player) =>
    (winnerEmail && player?.email === winnerEmail) || player?.name === winner
  );

  if (!winner || winnerIndex < 0) {
    return reject('Kazanan oyuncu lobi oyuncularindan biri olmali.', {
      winner,
      winnerEmail: winnerEmail || null,
    }, 400);
  }

  if (winnerEmail && incomingPlayers[winnerIndex]?.email !== winnerEmail) {
    return reject('Kazanan e-posta bilgisi oyuncu ile eslesmiyor.', {
      winner,
      winnerEmail,
    }, 400);
  }

  if (normalizeCards(incomingPlayers[winnerIndex]).length < winCardCount) {
    return reject('Kazanan oyuncu gerekli kart sayisina ulasmadi.', {
      expected: winCardCount,
      actual: normalizeCards(incomingPlayers[winnerIndex]).length,
    }, 400);
  }

  if (nextPlayerIndex !== winnerIndex) {
    return reject('Bitis durumunda aktif indeks kazanan oyuncuda kalmali.', {
      expected: winnerIndex,
      actual: nextPlayerIndex,
    }, 400);
  }

  return null;
};

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

    const currentRevision = readRevision(lobby.state_revision);
    const expectedRevisionProvided = body.expected_state_revision !== undefined && body.expected_state_revision !== null;
    const expectedRevision = readRevision(body.expected_state_revision);
    if (expectedRevisionProvided && expectedRevision !== currentRevision) {
      return reject('Lobi durumu guncel degil. Son durum yukleniyor.', {
        lobbyId,
        expected_state_revision: expectedRevision,
        current_state_revision: currentRevision,
      }, 409, 'stale_write');
    }

    const lobbyPlayers = Array.isArray(lobby.players) ? lobby.players : [];
    const actorIndex = lobbyPlayers.findIndex((player) => player?.email === user.email);
    const activeIndex = lobby.current_player_index ?? 0;

    const incomingPlayers = Array.isArray(body.players) ? body.players : null;
    const incomingUsedIds = Array.isArray(body.used_question_ids)
      ? body.used_question_ids.map(normalizeQuestionId).filter(Boolean)
      : null;
    const nextStatus = body.status || lobby.status || 'in_game';
    const nextPlayerIndex = body.current_player_index;
    const nextQuestionId = normalizeQuestionId(body.current_question_id);
    const action = body.action || 'advance_turn';

    if (!incomingPlayers || !incomingUsedIds) {
      return json({ error: 'Eksik oyuncu veya soru gecmisi.' }, 400);
    }

    if (nextStatus !== 'finished' && (typeof nextPlayerIndex !== 'number' || !nextQuestionId)) {
      return json({ error: 'Eksik tur veya soru bilgisi.' }, 400);
    }

    const validationError = validateGameStateUpdate({
      lobby,
      user,
      actorIndex,
      action,
      previousPlayerIndex: typeof body.previous_player_index === 'number' ? body.previous_player_index : undefined,
      previousQuestionId: normalizeQuestionId(body.previous_question_id),
      incomingPlayers,
      incomingUsedIds,
      nextStatus,
      nextPlayerIndex: typeof nextPlayerIndex === 'number' ? nextPlayerIndex : activeIndex,
      nextQuestionId: nextQuestionId || null,
      winner: body.winner,
      winnerEmail: body.winner_email,
    });

    if (validationError) {
      return validationError;
    }

    const updateData: Record<string, unknown> = {
      players: incomingPlayers,
      used_question_ids: incomingUsedIds,
      status: nextStatus,
      current_player_index: typeof nextPlayerIndex === 'number' ? nextPlayerIndex : activeIndex,
      state_revision: currentRevision + 1,
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
      lobbyId,
      action,
      current_player_index_before: lobby.current_player_index ?? 0,
      next_current_player_index: updateData.current_player_index,
      current_question_id_before: lobby.current_question_id || null,
      next_current_question_id: updateData.current_question_id || null,
      state_revision_before: currentRevision,
      state_revision_after: updateData.state_revision,
      statusBefore: lobby.status,
      statusAfter: nextStatus,
      playersSummary: summarizePlayers(incomingPlayers),
      updateFields: Object.keys(updateData),
    };

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
