import { buildLobbyStartPayload } from '@/lib/lobbyUtils';
import { ONLINE_GAME_POLICY } from '@/lib/categoryPolicy';

export const ONLINE_SHARED_DECK_MAX_QUESTIONS = 96;
export const ONLINE_SHARED_DECK_MIN_QUESTIONS = 32;
export const ONLINE_DECK_SELECTION_SOURCE = 'online_shared_selected_category_deck_v1';
const ONLINE_ALLOWED_DIFFICULTIES = new Set(ONLINE_GAME_POLICY.allowedDifficulties);

const normalizeNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? Math.trunc(number) : null;
};

const normalizeQuestionId = (value) => {
  if (value === undefined || value === null || value === '') return null;
  return String(value);
};

const getQuestionCategoryId = (question) =>
  normalizeNumber(question?.main_category_id ?? question?.category_id ?? question?.categoryid);

const getTimelineYearFromAnswer = (answer) => {
  if (typeof answer === 'number' && Number.isFinite(answer)) return answer;
  const text = String(answer ?? '').trim();
  if (!text) return null;
  const match = text.match(/\b\d{3,4}\b/);
  if (!match) return null;
  const year = Number(match[0]);
  return Number.isFinite(year) ? year : null;
};

const normalizeQuestionForOnline = (question = {}) => {
  const legacyYear = Number(question.year);
  const year = Number.isFinite(legacyYear) ? legacyYear : getTimelineYearFromAnswer(question.answer);
  return {
    ...question,
    id: normalizeQuestionId(question.id ?? question.__id),
    year,
    type: question.type || 'metin',
    media_url: question.media_url || '',
    main_category_id: getQuestionCategoryId(question),
    difficulty: normalizeNumber(question?.difficulty ?? question?.Difficulty),
  };
};

const isOnlineDifficultyEligible = (question) => {
  const difficulty = normalizeNumber(question?.difficulty ?? question?.Difficulty);
  return ONLINE_ALLOWED_DIFFICULTIES.has(difficulty);
};

const isActiveQuestion = (question) => {
  const state = String(question?.state ?? 'A').trim().toUpperCase();
  return state === 'A';
};

const getSelectedCategoryIds = (settings = {}) => {
  const selectedIds = Array.isArray(settings.selected_category_ids)
    ? settings.selected_category_ids
    : [];
  return new Set(selectedIds.map(normalizeNumber).filter(Number.isFinite));
};

const toOnlineDeckQuestion = (question) => ({
  id: normalizeQuestionId(question?.id),
  year: Number(question?.year),
  question: String(question?.question ?? ''),
  type: question?.type || 'metin',
  media_url: question?.media_url || '',
  main_category_id: getQuestionCategoryId(question),
  difficulty: normalizeNumber(question?.difficulty ?? question?.Difficulty),
});

const countBy = (rows = [], readKey) =>
  rows.reduce((counts, row) => {
    const key = String(readKey(row) ?? 'unknown');
    counts[key] = (counts[key] || 0) + 1;
    return counts;
  }, {});

export function filterQuestionsForLobbySettings(questions = [], settings = {}) {
  const selectedCategoryIds = getSelectedCategoryIds(settings);
  const baseFiltered = (questions || [])
    .map(normalizeQuestionForOnline)
    .filter(isActiveQuestion)
    .filter(q => q.type === 'metin')
    .filter(isOnlineDifficultyEligible)
    .filter(q => q.year >= settings.year_start && q.year <= settings.year_end)
    .filter(q => Number.isFinite(getQuestionCategoryId(q)));
  if (selectedCategoryIds.size > 0) {
    return baseFiltered.filter(q => selectedCategoryIds.has(getQuestionCategoryId(q)));
  }
  return baseFiltered.filter(q => settings.category === 'karisik' || q.category === settings.category);
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
  const requestedDeckCount = Math.min(
    ONLINE_SHARED_DECK_MAX_QUESTIONS,
    Math.max(
      ONLINE_SHARED_DECK_MIN_QUESTIONS,
      neededCount,
      startPlayers.length * Math.max(6, Number(settings.win_card_count) || 10) + startPlayers.length + 8,
    ),
  );
  const onlineQuestionDeck = shuffled
    .slice(0, requestedDeckCount)
    .map(toOnlineDeckQuestion)
    .filter(question =>
      question.id &&
      Number.isFinite(question.year) &&
      Number.isFinite(question.main_category_id) &&
      ONLINE_ALLOWED_DIFFICULTIES.has(question.difficulty)
    );
  const onlineDeckMeta = {
    source: ONLINE_DECK_SELECTION_SOURCE,
    selectedCategoryIds: Array.from(getSelectedCategoryIds(settings)),
    selectedCategoriesOnly: ONLINE_GAME_POLICY.selectedCategoriesOnly,
    soloPreferenceWeightingApplied: ONLINE_GAME_POLICY.soloPreferenceWeightingApplied,
    guestSoloPathUsed: ONLINE_GAME_POLICY.guestSoloPathUsed,
    difficultyRule: ONLINE_GAME_POLICY.difficultyRule,
    deckQuestionCount: onlineQuestionDeck.length,
    maxDeckQuestionCount: ONLINE_SHARED_DECK_MAX_QUESTIONS,
    categoryCounts: countBy(onlineQuestionDeck, question => question.main_category_id),
    difficultyCounts: countBy(onlineQuestionDeck, question => question.difficulty),
  };

  if (startPlayers.length < 2) {
    return {
      ok: false,
      reason: 'not_enough_players',
      message: 'Oyun başlatmak için en az 2 oyuncu gerekli',
      neededCount,
      availableCount: onlineQuestionDeck.length,
    };
  }

  if (onlineQuestionDeck.length === 0) {
    return {
      ok: false,
      reason: 'no_questions',
      message: 'Soru bulunamadı',
      neededCount,
      availableCount: 0,
    };
  }

  if (onlineQuestionDeck.length < neededCount) {
    return {
      ok: false,
      reason: 'not_enough_questions',
      message: `Yeterli soru yok. Gerekli: ${neededCount}, mevcut: ${onlineQuestionDeck.length}`,
      neededCount,
      availableCount: onlineQuestionDeck.length,
    };
  }

  let cursor = 0;
  const used = new Set();

  const playersWithCards = startPlayers.map(player => {
    const cards = [];
    for (let i = 0; i < 2; i += 1) {
      const question = onlineQuestionDeck[cursor];
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

  const firstQuestion = onlineQuestionDeck[cursor];
  used.add(firstQuestion.id);

  return {
    ok: true,
    playersWithCards,
    firstQuestion,
    usedQuestionIds: used,
    onlineQuestionDeck,
    onlineDeckMeta,
    updateData: buildLobbyStartPayload({
      firstQuestionId: firstQuestion.id,
      playersWithCards,
      usedQuestionIds: used,
      onlineQuestionDeck,
      onlineDeckMeta,
    }),
    neededCount,
    availableCount: onlineQuestionDeck.length,
  };
}
