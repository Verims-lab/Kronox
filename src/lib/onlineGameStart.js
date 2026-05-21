import { buildLobbyStartPayload } from '@/lib/lobbyUtils';

export function filterQuestionsForLobbySettings(questions = [], settings = {}) {
  return (questions || [])
    .filter(q => q.type === 'metin')
    .filter(q => q.year >= settings.year_start && q.year <= settings.year_end)
    .filter(q => settings.category === 'karisik' || q.category === settings.category);
}

export function shuffleQuestions(questions = [], random = Math.random) {
  const shuffled = [...questions];
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export function buildInitialOnlineGameState({
  players = [],
  questions = [],
  settings = {},
  random = Math.random,
} = {}) {
  const startPlayers = Array.isArray(players) ? players : [];
  const filteredQuestions = filterQuestionsForLobbySettings(questions, settings);
  const shuffled = shuffleQuestions(filteredQuestions, random);
  const neededCount = startPlayers.length * 2 + 1;

  if (startPlayers.length < 2) {
    return {
      ok: false,
      reason: 'not_enough_players',
      message: 'Oyun başlatmak için en az 2 oyuncu gerekli',
      neededCount,
      availableCount: shuffled.length,
    };
  }

  if (filteredQuestions.length === 0) {
    return {
      ok: false,
      reason: 'no_questions',
      message: 'Soru bulunamadı',
      neededCount,
      availableCount: 0,
    };
  }

  if (shuffled.length < neededCount) {
    return {
      ok: false,
      reason: 'not_enough_questions',
      message: `Yeterli soru yok. Gerekli: ${neededCount}, mevcut: ${shuffled.length}`,
      neededCount,
      availableCount: shuffled.length,
    };
  }

  let cursor = 0;
  const used = new Set();

  const playersWithCards = startPlayers.map(player => {
    const cards = [];
    for (let i = 0; i < 2; i += 1) {
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
    return { ...player, cards };
  });

  const firstQuestion = shuffled[cursor];
  used.add(firstQuestion.id);

  return {
    ok: true,
    playersWithCards,
    firstQuestion,
    usedQuestionIds: used,
    updateData: buildLobbyStartPayload({
      firstQuestionId: firstQuestion.id,
      playersWithCards,
      usedQuestionIds: used,
    }),
    neededCount,
    availableCount: shuffled.length,
  };
}
