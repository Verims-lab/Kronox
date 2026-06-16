const VALID_STATUSES = new Set(['waiting', 'starting', 'in_game', 'finished']);

const toFiniteNumber = (value, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

const toNonNegativeInt = (value, fallback = 0) => {
  const number = Math.trunc(toFiniteNumber(value, fallback));
  return number >= 0 ? number : fallback;
};

const normalizeQuestionId = (value) => {
  if (value === undefined || value === null || value === '') return null;
  return String(value);
};

const normalizeCard = (card) => {
  if (!card || typeof card !== 'object') return null;
  const id = normalizeQuestionId(card.id);
  if (!id) return null;
  return {
    ...card,
    id,
    year: toFiniteNumber(card.year, card.year),
  };
};

export function normalizeOnlineQuestionDeck(deck = []) {
  if (!Array.isArray(deck)) return [];
  return deck
    .map((question) => {
      if (!question || typeof question !== 'object') return null;
      const id = normalizeQuestionId(question.id);
      const year = toFiniteNumber(question.year, NaN);
      if (!id || !Number.isFinite(year)) return null;
      return {
        ...question,
        id,
        year,
        question: typeof question.question === 'string' ? question.question : String(question.question ?? ''),
        type: question.type || 'metin',
        media_url: question.media_url || '',
      };
    })
    .filter(Boolean);
}

export function normalizeLobbyPlayers(players = []) {
  if (!Array.isArray(players)) return [];

  return players
    .filter(Boolean)
    .map((player, index) => ({
      ...player,
      name: typeof player?.name === 'string' && player.name.trim()
        ? player.name
        : `Player ${index + 1}`,
      email: typeof player?.email === 'string' ? player.email : null,
      ready: player?.ready ?? true,
      cards: Array.isArray(player?.cards)
        ? player.cards.map(normalizeCard).filter(Boolean)
        : [],
    }));
}

export function getLobbyStateRevision(lobby) {
  return toNonNegativeInt(lobby?.state_revision, 0);
}

export function normalizeLobbyState(data, fallback = {}) {
  const source = data && typeof data === 'object' ? data : {};
  const base = fallback && typeof fallback === 'object' ? fallback : {};
  const merged = { ...base, ...source };
  const players = normalizeLobbyPlayers(
    Array.isArray(source.players) ? source.players : base.players
  );
  const rawPlayerIndex = toNonNegativeInt(merged.current_player_index, 0);
  const currentPlayerIndex = players.length > 0
    ? Math.min(rawPlayerIndex, players.length - 1)
    : 0;
  const usedQuestionIds = Array.isArray(source.used_question_ids)
    ? source.used_question_ids
    : (Array.isArray(base.used_question_ids) ? base.used_question_ids : []);
  const status = VALID_STATUSES.has(merged.status) ? merged.status : (base.status || 'waiting');
  const onlineQuestionDeck = normalizeOnlineQuestionDeck(
    Array.isArray(source.online_question_deck) ? source.online_question_deck : base.online_question_deck
  );

  return {
    ...merged,
    players,
    current_player_index: currentPlayerIndex,
    current_question_id: normalizeQuestionId(merged.current_question_id),
    used_question_ids: [...new Set(usedQuestionIds.map(normalizeQuestionId).filter(Boolean))],
    online_question_deck: onlineQuestionDeck,
    online_deck_meta: merged.online_deck_meta && typeof merged.online_deck_meta === 'object'
      ? merged.online_deck_meta
      : null,
    status,
    winner: merged.winner ?? null,
    winner_email: merged.winner_email ?? null,
    year_start: toFiniteNumber(merged.year_start, base.year_start ?? 1900),
    year_end: toFiniteNumber(merged.year_end, base.year_end ?? new Date().getFullYear()),
    turn_duration: toFiniteNumber(merged.turn_duration, base.turn_duration ?? 60),
    win_card_count: toFiniteNumber(merged.win_card_count, base.win_card_count ?? 10),
    state_revision: Math.max(getLobbyStateRevision(base), getLobbyStateRevision(source)),
  };
}

export function summarizeLobbyShape(lobby) {
  const normalized = normalizeLobbyState(lobby);
  return {
    id: normalized.id || null,
    status: normalized.status,
    state_revision: normalized.state_revision,
    playersCount: normalized.players.length,
    current_player_index: normalized.current_player_index,
    current_question_id: normalized.current_question_id,
    used_question_count: normalized.used_question_ids.length,
  };
}
