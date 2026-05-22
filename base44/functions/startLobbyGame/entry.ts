import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const readRevision = (value: unknown) => {
  const revision = Number(value);
  return Number.isFinite(revision) && revision >= 0 ? Math.trunc(revision) : 0;
};

const readNumber = (value: unknown, fallback: number) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

const summarizePlayers = (players: any[] = []) =>
  players.map((player, index) => ({
    index,
    email: player?.email || null,
    name: player?.name || null,
    cardCount: Array.isArray(player?.cards) ? player.cards.length : 0,
  }));

const normalizeSettings = (lobby: any, incoming: any = {}) => {
  const currentYear = new Date().getFullYear();
  const category = typeof incoming.category === 'string'
    ? incoming.category
    : (lobby.category || 'karisik');
  const yearStart = Math.trunc(readNumber(incoming.year_start, lobby.year_start ?? 1900));
  const rawYearEnd = Math.trunc(readNumber(incoming.year_end, lobby.year_end ?? currentYear));
  const yearEnd = Math.max(yearStart + 1, Math.min(rawYearEnd, currentYear));
  const turnDuration = Math.max(10, Math.trunc(readNumber(incoming.turn_duration, lobby.turn_duration ?? 60)));
  const winCardCount = Math.max(1, Math.trunc(readNumber(incoming.win_card_count, lobby.win_card_count ?? 10)));

  return {
    category,
    year_start: Math.max(0, yearStart),
    year_end: yearEnd,
    turn_duration: turnDuration,
    win_card_count: winCardCount,
  };
};

const filterQuestionsForLobbySettings = (questions: any[] = [], settings: any = {}) =>
  (questions || [])
    .filter(q => q?.type === 'metin')
    .filter(q => Number(q?.year) >= settings.year_start && Number(q?.year) <= settings.year_end)
    .filter(q => settings.category === 'karisik' || q?.category === settings.category);

const shuffleQuestions = (questions: any[] = []) => {
  const shuffled = [...questions];
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

const buildInitialState = ({ players, questions, settings }: { players: any[]; questions: any[]; settings: any }) => {
  const filteredQuestions = filterQuestionsForLobbySettings(questions, settings);
  const shuffled = shuffleQuestions(filteredQuestions);
  const neededCount = players.length * 2 + 1;

  if (players.length < 2) {
    return {
      ok: false,
      message: 'Oyun baslatmak icin en az 2 oyuncu gerekli',
      reason: 'not_enough_players',
      neededCount,
      availableCount: shuffled.length,
    };
  }

  if (filteredQuestions.length === 0) {
    return {
      ok: false,
      message: 'Soru bulunamadi',
      reason: 'no_questions',
      neededCount,
      availableCount: 0,
    };
  }

  if (shuffled.length < neededCount) {
    return {
      ok: false,
      message: `Yeterli soru yok. Gerekli: ${neededCount}, mevcut: ${shuffled.length}`,
      reason: 'not_enough_questions',
      neededCount,
      availableCount: shuffled.length,
    };
  }

  let cursor = 0;
  const used = new Set<string>();
  const playersWithCards = players.map((player) => {
    const cards = [];
    for (let index = 0; index < 2; index += 1) {
      const question = shuffled[cursor];
      cursor += 1;
      cards.push({
        id: question.id,
        year: question.year,
        question: question.question,
        type: question.type,
        media_url: question.media_url,
      });
      used.add(question.id);
    }
    return { ...player, ready: true, cards };
  });

  const firstQuestion = shuffled[cursor];
  used.add(firstQuestion.id);

  return {
    ok: true,
    playersWithCards,
    firstQuestion,
    usedQuestionIds: [...used],
    neededCount,
    availableCount: shuffled.length,
  };
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    let user: any = null;
    try {
      user = await base44.auth.me();
    } catch (_authError) {
      user = null;
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

    const players = Array.isArray(lobby.players) ? lobby.players : [];
    const hostEmail = lobby.host_email || null;
    const actorEmail = user?.email || null;
    const actorName = body?.playerName || user?.full_name || user?.email || null;
    const authenticatedHost = Boolean(actorEmail && hostEmail === actorEmail);
    const guestHost = Boolean(!actorEmail && hostEmail?.startsWith('guest_') && players[0]?.name === actorName);

    if (!authenticatedHost && !guestHost) {
      return json({
        error: 'Sadece host oyunu baslatabilir.',
        debug: {
          lobbyId,
          actorEmail,
          actorName,
          hostEmail,
          firstPlayerName: players[0]?.name || null,
        },
      }, 403);
    }

    if (lobby.status !== 'waiting') {
      return json({
        error: 'Lobi bekleme durumunda degil.',
        debug: { lobbyId, status: lobby.status },
      }, 409);
    }

    if (players.length < 2) {
      return json({ error: 'Oyun baslatmak icin en az 2 oyuncu gerekli' }, 400);
    }

    const settings = normalizeSettings(lobby, body?.settings || {});
    const questions = await base44.asServiceRole.entities.Question.list('-created_date', 500);
    const initialState = buildInitialState({
      players,
      questions: questions || [],
      settings,
    });

    if (!initialState.ok) {
      return json({
        error: initialState.message,
        code: initialState.reason,
        debug: {
          neededCount: initialState.neededCount,
          availableCount: initialState.availableCount,
          settings,
        },
      }, 400);
    }

    const currentRevision = readRevision(lobby.state_revision);
    const updateData = {
      ...settings,
      status: 'starting',
      current_question_id: initialState.firstQuestion.id,
      used_question_ids: initialState.usedQuestionIds,
      current_player_index: 0,
      players: initialState.playersWithCards,
      winner: null,
      winner_email: null,
      state_revision: currentRevision + 1,
    };

    const updatedLobby = await base44.asServiceRole.entities.Lobby.update(lobbyId, updateData);

    return json({
      success: true,
      lobby: updatedLobby,
      debug: {
        lobbyId,
        statusBefore: lobby.status,
        statusAfter: updateData.status,
        state_revision_before: currentRevision,
        state_revision_after: updateData.state_revision,
        current_question_id: updateData.current_question_id,
        used_question_count: updateData.used_question_ids.length,
        players: summarizePlayers(updateData.players),
        settings,
      },
    });
  } catch (error) {
    console.error('[startLobbyGame] failed:', error);
    return json({
      error: error?.message || 'Online oyun baslatilamadi.',
    }, 500);
  }
});
