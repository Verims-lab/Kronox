import { createClientFromRequest } from 'npm:@base44/sdk@0.8.34';

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

const normalizeEmail = (value: unknown) =>
  String(value ?? '').trim().toLowerCase();
const KRONOX_ID_PATTERN = /^KX-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/;

const normalizeKronoxUserId = (value: unknown) => {
  const text = String(value || '').trim().toUpperCase();
  return KRONOX_ID_PATTERN.test(text) ? text : '';
};

const getPlayerIdentityKey = (player: any) => {
  const kronoxUserId = normalizeKronoxUserId(player?.kronox_user_id);
  if (kronoxUserId) return `kronox:${kronoxUserId}`;
  const email = normalizeEmail(player?.email);
  if (email) return `email:${email}`;
  const name = String(player?.name || '').trim().toLowerCase();
  return name ? `name:${name}` : '';
};

const normalizeLobbyPlayer = (player: any) => ({
  ...player,
  kronox_user_id: normalizeKronoxUserId(player?.kronox_user_id),
  email: player?.email || '',
  name: String(player?.name || '').trim() || 'Oyuncu',
  ready: player?.ready ?? true,
  cards: Array.isArray(player?.cards) ? player.cards : [],
});

const mergePlayersByIdentity = (players: any[] = [], additions: any[] = []) => {
  const seen = new Set<string>();
  const merged: any[] = [];
  [...(Array.isArray(players) ? players : []), ...(Array.isArray(additions) ? additions : [])]
    .map(normalizeLobbyPlayer)
    .forEach((player) => {
      const key = getPlayerIdentityKey(player);
      if (!key || seen.has(key)) return;
      seen.add(key);
      merged.push(player);
    });
  return merged;
};

const hasAuthoritativeGamePayload = (lobby: any) => Boolean(
  lobby?.current_question_id &&
  Array.isArray(lobby?.online_question_deck) &&
  lobby.online_question_deck.length > 0 &&
  Array.isArray(lobby?.players) &&
  lobby.players.length >= 2
);

const getInvitePlayerName = (invite: any) =>
  String(
    invite?.to_name ||
    (invite?.to_email || '').split('@')[0] ||
    'Oyuncu',
  ).trim().slice(0, 15) || 'Oyuncu';

const loadAcceptedInvitePlayers = async (base44: any, lobbyId: string) => {
  const invites = await base44.asServiceRole.entities.GameInvite
    .filter({ lobby_id: lobbyId }, '-accepted_at', 100)
    .catch(() => []);
  return (Array.isArray(invites) ? invites : [])
    .filter((invite: any) => String(invite?.status || '').toLowerCase() === 'accepted')
    .map((invite: any) => {
      const email = normalizeEmail(invite?.to_email);
      if (!email) return null;
      return {
        kronox_user_id: normalizeKronoxUserId(invite?.to_kronox_user_id),
        email,
        name: getInvitePlayerName(invite),
        ready: true,
        cards: [],
      };
    })
    .filter(Boolean);
};

const reconcileAcceptedInvitePlayers = async (base44: any, lobby: any) => {
  const players = Array.isArray(lobby?.players) ? lobby.players : [];
  const acceptedInvitePlayers = await loadAcceptedInvitePlayers(base44, lobby.id);
  const mergedPlayers = mergePlayersByIdentity(players, acceptedInvitePlayers);
  const changed = mergedPlayers.length !== players.length;
  if (!changed) {
    return {
      lobby,
      players: mergedPlayers,
      reconciled: false,
      acceptedInviteCount: acceptedInvitePlayers.length,
    };
  }

  const currentRevision = readRevision(lobby.state_revision);
  const updatedLobby = await base44.asServiceRole.entities.Lobby.update(lobby.id, {
    players: mergedPlayers,
    last_activity_at: new Date().toISOString(),
    state_revision: currentRevision + 1,
  });
  return {
    lobby: updatedLobby || { ...lobby, players: mergedPlayers, state_revision: currentRevision + 1 },
    players: Array.isArray(updatedLobby?.players) ? updatedLobby.players : mergedPlayers,
    reconciled: true,
    acceptedInviteCount: acceptedInvitePlayers.length,
  };
};

const summarizePlayers = (players: any[] = []) =>
  players.map((player, index) => ({
    index,
    email: player?.email || null,
    name: player?.name || null,
    cardCount: Array.isArray(player?.cards) ? player.cards.length : 0,
  }));

const CATEGORY_METADATA_POLICY = Object.freeze({
  sourceOfTruth: 'Category',
  legacyHardcodedCategoryFallbackAllowed: false,
  loadFailureBehavior: 'retryable_error_or_empty_state',
});

const ONLINE_GAME_POLICY = Object.freeze({
  categorySourceOfTruth: CATEGORY_METADATA_POLICY.sourceOfTruth,
  selectedCategoryIdsField: 'selected_category_ids',
  selectedCategoriesOnly: true,
  selectedCategoryCoverage: '100_percent_selected_active_categories',
  allowedDifficulties: [1, 2],
  difficultyRule: 'difficulty_1_or_2_only',
  soloPreferenceWeightingApplied: false,
  guestSoloPathUsed: false,
  legacyHardcodedCategoryFallbackAllowed: false,
});

const QUESTION_FETCH_PER_CATEGORY_LIMIT = 250;
const ONLINE_SHARED_DECK_MAX_QUESTIONS = 96;
const ONLINE_SHARED_DECK_MIN_QUESTIONS = 32;
const ONLINE_ALLOWED_DIFFICULTIES = new Set(ONLINE_GAME_POLICY.allowedDifficulties);
const ONLINE_DECK_SELECTION_SOURCE = 'online_shared_selected_category_deck_v1';

const normalizeMainCategoryId = (value: unknown): number | null => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  const id = Math.trunc(numeric);
  return id > 0 ? id : null;
};

const canSeeAdminDebug = (user: any) => {
  if (!user) return false;
  if (user.role === 'admin' || user.is_admin === true) return true;
  return Array.isArray(user.permissions) && user.permissions.includes('admin');
};

const normalizeDifficulty = (value: unknown): number | null => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  return Math.trunc(numeric);
};

const isOnlineDifficultyEligible = (question: any) => {
  const difficulty = normalizeDifficulty(question?.difficulty ?? question?.Difficulty);
  return ONLINE_ALLOWED_DIFFICULTIES.has(difficulty as number);
};

const resolveMainCategoryIdsFromSelectedIds = (selectedIds: any, activeMainCategoryIds?: Set<number>): Set<number> | null => {
  if (!Array.isArray(selectedIds) || selectedIds.length === 0) return null;
  const allowed = new Set<number>();
  for (const id of selectedIds) {
    const mapped = normalizeMainCategoryId(id);
    if (mapped !== null && Number.isFinite(mapped) && (!activeMainCategoryIds || activeMainCategoryIds.has(mapped))) allowed.add(mapped);
  }
  return allowed.size > 0 ? allowed : null;
};

// Codex165 — Question runtime normalizer. Mirrors functions/getQuestions
// so Online uses the SAME shape Solo already uses. Without this, the new
// Codex156 dataset (which stores year inside `answer`, no legacy `type`
// / `category` fields) was filtered out to zero rows → 400 on start.
function getTimelineYearFromAnswer(answer: unknown): number | null {
  if (typeof answer === 'number' && Number.isFinite(answer)) return answer;
  const text = String(answer ?? '').trim();
  if (!text) return null;
  const match = text.match(/\b\d{3,4}\b/);
  if (!match) return null;
  const year = Number(match[0]);
  return Number.isFinite(year) ? year : null;
}

function normalizeQuestionForRuntime(question: any): any {
  const legacyYear = Number(question?.year);
  const year = Number.isFinite(legacyYear)
    ? legacyYear
    : getTimelineYearFromAnswer(question?.answer);
  const mainCategoryId = normalizeMainCategoryId(question?.main_category_id ?? question?.category_id ?? question?.categoryid);
  const difficulty = normalizeDifficulty(question?.difficulty ?? question?.Difficulty);
  return {
    ...question,
    id: String(question?.id ?? question?.__id ?? ''),
    year,
    main_category_id: mainCategoryId ?? question?.main_category_id,
    difficulty,
    category: question?.category || 'genel',
    type: question?.type || 'metin',
    media_url: question?.media_url || '',
  };
}

const toOnlineDeckQuestion = (question: any) => ({
  id: String(question?.id ?? ''),
  year: Number(question?.year),
  question: String(question?.question ?? ''),
  type: question?.type || 'metin',
  media_url: question?.media_url || '',
  main_category_id: Number(question?.main_category_id),
  difficulty: normalizeDifficulty(question?.difficulty),
});

const countBy = (rows: any[] = [], readKey: (row: any) => unknown) => {
  const counts: Record<string, number> = {};
  for (const row of rows || []) {
    const key = String(readKey(row) ?? 'unknown');
    counts[key] = (counts[key] || 0) + 1;
  }
  return counts;
};

const isActiveQuestion = (question: any) => {
  const state = String(question?.state ?? 'A').trim().toUpperCase();
  return state === 'A';
};

const isActiveCategory = (category: any) => {
  const status = String(category?.status ?? '').trim().toLowerCase();
  return status === '' || status === 'a' || status === 'active' || status === 'aktif';
};

const loadActiveMainCategoryIds = async (base44: any): Promise<Set<number>> => {
  const rows = await base44.asServiceRole.entities.Category.list('category_id', 1000).catch(() => []);
  if (!Array.isArray(rows) || rows.length === 0) return new Set();
  const active = rows
    .filter(isActiveCategory)
    .map((row: any) => normalizeMainCategoryId(row?.category_id ?? row?.categoryid))
    .filter((id: number | null) => id !== null) as number[];
  return active.length ? new Set(active) : new Set();
};

const dedupeQuestions = (rows: any[] = []) => {
  const seen = new Set<string>();
  const out: any[] = [];
  for (const row of rows || []) {
    const key = String(row?.id ?? row?.__id ?? row?.question ?? '');
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }
  return out;
};

const getQueryMainCategoryIdsForSettings = (settings: any, activeMainCategoryIds: Set<number>) => {
  const hasSelectedCategoryIds = Array.isArray(settings?.selected_category_ids) && settings.selected_category_ids.length > 0;
  if (!hasSelectedCategoryIds) return [];
  const selected = resolveMainCategoryIdsFromSelectedIds(settings.selected_category_ids, activeMainCategoryIds);
  return selected ? Array.from(selected) : [];
};

const loadActiveQuestionCandidates = async (base44: any, categoryIds: number[]) => {
  const batches: any[] = [];
  for (const categoryId of categoryIds) {
    const rows = await base44.asServiceRole.entities.Question
      .filter({ main_category_id: categoryId, state: 'A' }, '-created_date', QUESTION_FETCH_PER_CATEGORY_LIMIT)
      .catch(() => []);
    if (Array.isArray(rows) && rows.length > 0) batches.push(...rows);
  }
  return dedupeQuestions(batches);
};

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

  // Online category selection is authoritative and must come from the current
  // lobby-selected Category.category_id values. Missing/invalid selected ids
  // clean-fail; no stale hardcoded category fallback is allowed.
  const selectedCategoryIds = Array.isArray(incoming.selected_category_ids)
    ? incoming.selected_category_ids
    : (Array.isArray(lobby.selected_category_ids) ? lobby.selected_category_ids : []);

  return {
    category,
    selected_category_ids: selectedCategoryIds,
    year_start: Math.max(0, yearStart),
    year_end: yearEnd,
    turn_duration: turnDuration,
    win_card_count: winCardCount,
  };
};

const filterQuestionsForLobbySettings = (questions: any[] = [], settings: any = {}, activeMainCategoryIds: Set<number> = new Set()) => {
  // Codex165 — normalize every Question once so the new Codex156 dataset
  // (year inside `answer`, no legacy `type` field) is honored. Then keep
  // only rows with a usable year inside the host's year window.
  const baseFiltered = (questions || [])
    .map(normalizeQuestionForRuntime)
    .filter(isActiveQuestion)
    .filter(q => q?.type === 'metin')
    .filter(isOnlineDifficultyEligible)
    .filter(q => Number.isFinite(Number(q?.year))
      && Number(q?.year) >= settings.year_start
      && Number(q?.year) <= settings.year_end)
    .filter(q => {
      const mid = normalizeMainCategoryId(q?.main_category_id);
      return mid !== null && activeMainCategoryIds.has(mid);
    });

  // Codex168 — Strict selected-category path. If the host selected
  // categories, the game may only use those active categories. We no
  // longer fall back to all categories when content tagging is missing.
  const hasSelectedCategoryIds = Array.isArray(settings.selected_category_ids) && settings.selected_category_ids.length > 0;
  const mainIdsAllowed = resolveMainCategoryIdsFromSelectedIds(settings.selected_category_ids, activeMainCategoryIds);
  if (hasSelectedCategoryIds) {
    if (!mainIdsAllowed || mainIdsAllowed.size === 0) return [];
    const byMainId = baseFiltered.filter(q => {
      const mid = Number(q?.main_category_id);
      return Number.isFinite(mid) && mainIdsAllowed.has(mid);
    });
    if (byMainId.length > 0) return byMainId;
    return [];
  }

  return [];
};

const shuffleQuestions = (questions: any[] = []) => {
  const shuffled = [...questions];
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

const buildInitialState = ({ players, questions, settings, activeMainCategoryIds }: { players: any[]; questions: any[]; settings: any; activeMainCategoryIds: Set<number> }) => {
  const filteredQuestions = filterQuestionsForLobbySettings(questions, settings, activeMainCategoryIds);
  const shuffled = shuffleQuestions(filteredQuestions);
  const neededCount = players.length * 2 + 1;
  const requestedDeckCount = Math.min(
    ONLINE_SHARED_DECK_MAX_QUESTIONS,
    Math.max(
      ONLINE_SHARED_DECK_MIN_QUESTIONS,
      neededCount,
      players.length * Math.max(6, Number(settings.win_card_count) || 10) + players.length + 8,
    ),
  );
  const sharedDeck = shuffled
    .slice(0, requestedDeckCount)
    .map(toOnlineDeckQuestion)
    .filter((question) =>
      question.id &&
      Number.isFinite(question.year) &&
      Number.isFinite(question.main_category_id) &&
      ONLINE_ALLOWED_DIFFICULTIES.has(question.difficulty as number)
    );

  if (players.length < 2) {
    return {
      ok: false,
      message: 'Oyun baslatmak icin en az 2 oyuncu gerekli',
      reason: 'not_enough_players',
      neededCount,
      availableCount: sharedDeck.length,
    };
  }

  if (filteredQuestions.length === 0) {
    return {
      ok: false,
      message: 'Seçilen kategoriler için yeterli aktif soru bulunamadı.',
      reason: 'insufficient_active_questions_for_selected_categories',
      neededCount,
      availableCount: 0,
    };
  }

  if (sharedDeck.length < neededCount) {
    return {
      ok: false,
      message: `Yeterli soru yok. Gerekli: ${neededCount}, mevcut: ${sharedDeck.length}`,
      reason: 'not_enough_questions',
      neededCount,
      availableCount: sharedDeck.length,
    };
  }

  let cursor = 0;
  const used = new Set<string>();
  const playersWithCards = players.map((player) => {
    const cards = [];
    for (let index = 0; index < 2; index += 1) {
      const question = sharedDeck[cursor];
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

  const firstQuestion = sharedDeck[cursor];
  used.add(firstQuestion.id);

  return {
    ok: true,
    playersWithCards,
    firstQuestion,
    usedQuestionIds: [...used],
    onlineQuestionDeck: sharedDeck,
    onlineDeckMeta: {
      source: ONLINE_DECK_SELECTION_SOURCE,
      selectedCategoryIds: settings.selected_category_ids,
      queriedMainCategoryIds: getQueryMainCategoryIdsForSettings(settings, activeMainCategoryIds),
      deckQuestionCount: sharedDeck.length,
      neededOpeningQuestionCount: neededCount,
      maxDeckQuestionCount: ONLINE_SHARED_DECK_MAX_QUESTIONS,
      selectedCategoriesOnly: ONLINE_GAME_POLICY.selectedCategoriesOnly,
      soloPreferenceWeightingApplied: ONLINE_GAME_POLICY.soloPreferenceWeightingApplied,
      guestSoloPathUsed: ONLINE_GAME_POLICY.guestSoloPathUsed,
      difficultyRule: ONLINE_GAME_POLICY.difficultyRule,
      categorySourceOfTruth: ONLINE_GAME_POLICY.categorySourceOfTruth,
      legacyHardcodedCategoryFallbackAllowed: ONLINE_GAME_POLICY.legacyHardcodedCategoryFallbackAllowed,
      categoryCounts: countBy(sharedDeck, (question) => question.main_category_id),
      difficultyCounts: countBy(sharedDeck, (question) => question.difficulty),
      createdAt: new Date().toISOString(),
    },
    neededCount,
    availableCount: sharedDeck.length,
  };
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    let user: any = null;
    try {
      user = await base44.auth.me();
    } catch (_authError) {
      return json({ error: 'Oturum gerekli.', code: 'unauthenticated' }, 401);
    }
    const actorEmail = normalizeEmail(user?.email);
    if (!actorEmail) {
      return json({ error: 'Oturum gerekli.', code: 'unauthenticated' }, 401);
    }

    const body = await req.json().catch(() => ({}));
    const lobbyId = body?.lobbyId;

    if (!lobbyId) {
      return json({ error: 'lobbyId gerekli.' }, 400);
    }

    const lobby = await base44.asServiceRole.entities.Lobby.get(lobbyId);
    if (!lobby) {
      return json({ error: 'Lobi bulunamadi.' }, 404);
    }

    const hostEmail = normalizeEmail(lobby.host_email);
    const authenticatedHost = Boolean(hostEmail && actorEmail === hostEmail);
    const canSeeDebug = canSeeAdminDebug(user);
    const withDebug = (payload: Record<string, unknown>, debug: Record<string, unknown>) =>
      canSeeDebug ? { ...payload, debug } : payload;

    if (!authenticatedHost) {
      return json(withDebug({
        error: 'Sadece host oyunu baslatabilir.',
      }, {
          lobbyId,
          actorEmail,
          hostEmail,
      }), 403);
    }

    if (lobby.status !== 'waiting') {
      if ((lobby.status === 'starting' || lobby.status === 'in_game') && hasAuthoritativeGamePayload(lobby)) {
        return json(withDebug({
          success: true,
          idempotent: true,
          lobby,
        }, {
            lobbyId,
            status: lobby.status,
            state_revision: readRevision(lobby.state_revision),
            current_question_id: lobby.current_question_id || null,
            online_question_deck_count: lobby.online_question_deck?.length || 0,
            players: summarizePlayers(lobby.players || []),
        }));
      }
      return json(withDebug({
        error: 'Lobi bekleme durumunda degil.',
      }, { lobbyId, status: lobby.status }), 409);
    }

    const participantState = await reconcileAcceptedInvitePlayers(base44, lobby);
    const startLobby = participantState.lobby || lobby;
    const players = Array.isArray(participantState.players) ? participantState.players : [];

    if (players.length < 2) {
      return json({ error: 'Oyun baslatmak icin en az 2 oyuncu gerekli' }, 400);
    }

    // Codex131 — In-lobby settings panel removed. We no longer accept any
    // `body.settings` payload; all game config (category multi-select,
    // year window, turn duration, win-card count) is sourced from the
    // persisted lobby row only. Old callers that still send settings are
    // silently ignored — RLS already prevents non-host writes elsewhere.
    const settings = normalizeSettings(startLobby, {});
    const activeMainCategoryIds = await loadActiveMainCategoryIds(base44);
    const queryMainCategoryIds = getQueryMainCategoryIdsForSettings(settings, activeMainCategoryIds);
    const questions = queryMainCategoryIds.length > 0
      ? await loadActiveQuestionCandidates(base44, queryMainCategoryIds)
      : [];
    const initialState = buildInitialState({
      players,
      questions: questions || [],
      settings,
      activeMainCategoryIds,
    });

    if (!initialState.ok) {
      const contentStatus = ['insufficient_active_questions_for_selected_categories', 'not_enough_questions']
        .includes(initialState.reason)
        ? 422
        : 400;
      return json(withDebug({
        error: initialState.message,
        code: initialState.reason,
      }, {
          neededCount: initialState.neededCount,
          availableCount: initialState.availableCount,
          selected_category_ids: settings.selected_category_ids,
          activeMainCategoryIds: Array.from(activeMainCategoryIds),
          queriedMainCategoryIds: queryMainCategoryIds,
      }), contentStatus);
    }

    const currentRevision = readRevision(startLobby.state_revision);
    const updateData = {
      ...settings,
      status: 'starting',
      current_question_id: initialState.firstQuestion.id,
      used_question_ids: initialState.usedQuestionIds,
      online_question_deck: initialState.onlineQuestionDeck,
      online_deck_meta: initialState.onlineDeckMeta,
      current_player_index: 0,
      players: initialState.playersWithCards,
      winner: null,
      winner_email: null,
      started_at: new Date().toISOString(),
      state_revision: currentRevision + 1,
    };

    const updatedLobby = await base44.asServiceRole.entities.Lobby.update(lobbyId, updateData);

    return json(withDebug({
      success: true,
      lobby: updatedLobby,
    }, {
        lobbyId,
        statusBefore: lobby.status,
        statusAfter: updateData.status,
        state_revision_before: currentRevision,
        state_revision_after: updateData.state_revision,
        participant_reconciliation_applied: participantState.reconciled,
        accepted_invite_count: participantState.acceptedInviteCount,
        current_question_id: updateData.current_question_id,
        used_question_count: updateData.used_question_ids.length,
        online_question_deck_count: updateData.online_question_deck.length,
        online_deck_meta: updateData.online_deck_meta,
        players: summarizePlayers(updateData.players),
        settings,
    }));
  } catch (error) {
    console.error('[startLobbyGame] failed:', error);
    return json({
      error: 'Online oyun baslatilamadi.',
    }, 500);
  }
});
