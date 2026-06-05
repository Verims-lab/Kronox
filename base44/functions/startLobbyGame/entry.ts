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

// Codex165 — Online category multi-select wiring.
//
// The Online UI offers 6 stable category ids:
//   chronicle=1, flashback=2, kult=3, viral=4, arena=5, level_up=6
//
// The Question dataset evolved in Codex156: rows now carry numeric
// `main_category_id` (1..6) matching the same Category lookup table the
// UI uses. They do NOT carry the legacy string `category` / `type` /
// `year` fields anymore — `year` is encoded inside `answer` (e.g. "2006").
//
// So we:
//   1. Normalize every Question into runtime shape (year extracted from
//      answer, default type=metin, default category=genel) — same logic
//      getQuestions already applies for Solo.
//   2. Filter by `main_category_id` against the host's selected Online
//      category ids. Legacy string `category` rows are still honored as
//      a fallback so old content keeps working.
const ONLINE_ID_TO_MAIN_CATEGORY_ID: Record<string, number> = {
  chronicle: 1,
  flashback: 2,
  kult: 3,
  viral: 4,
  arena: 5,
  level_up: 6,
};

const KNOWN_MAIN_CATEGORY_IDS = new Set([1, 2, 3, 4, 5, 6]);
const QUESTION_FETCH_PER_CATEGORY_LIMIT = 250;

const LEGACY_ONLINE_TO_LEGACY_CATEGORY_MAP: Record<string, string[]> = {
  flashback: ['tarih', 'genel'],
  kult: ['sanat', 'genel'],
  viral: ['teknoloji', 'genel'],
  arena: ['spor'],
  level_up: ['teknoloji', 'genel'],
  chronicle: ['tarih', 'genel'],
};

const normalizeMainCategoryId = (value: unknown): number | null => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  const id = Math.trunc(numeric);
  return KNOWN_MAIN_CATEGORY_IDS.has(id) ? id : null;
};

const canSeeAdminDebug = (user: any) => {
  if (!user) return false;
  if (user.role === 'admin' || user.is_admin === true) return true;
  return Array.isArray(user.permissions) && user.permissions.includes('admin');
};

const normalizeEmail = (value: unknown) =>
  String(value ?? '').trim().toLowerCase();

const resolveMainCategoryIdsFromSelectedIds = (selectedIds: any, activeMainCategoryIds?: Set<number>): Set<number> | null => {
  if (!Array.isArray(selectedIds) || selectedIds.length === 0) return null;
  const allowed = new Set<number>();
  for (const id of selectedIds) {
    const mapped = typeof id === 'string'
      ? (ONLINE_ID_TO_MAIN_CATEGORY_ID[id] ?? normalizeMainCategoryId(id))
      : normalizeMainCategoryId(id);
    if (mapped !== null && Number.isFinite(mapped) && (!activeMainCategoryIds || activeMainCategoryIds.has(mapped))) allowed.add(mapped);
  }
  return allowed.size > 0 ? allowed : null;
};

const resolveLegacyCategoriesFromSelectedIds = (selectedIds: any): string[] | null => {
  if (!Array.isArray(selectedIds) || selectedIds.length === 0) return null;
  const allowed = new Set<string>();
  for (const id of selectedIds) {
    if (typeof id !== 'string') continue;
    const mapped = LEGACY_ONLINE_TO_LEGACY_CATEGORY_MAP[id];
    if (Array.isArray(mapped)) {
      for (const legacy of mapped) allowed.add(legacy);
    }
  }
  return allowed.size > 0 ? Array.from(allowed) : null;
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
  return {
    ...question,
    year,
    category: question?.category || 'genel',
    type: question?.type || 'metin',
    media_url: question?.media_url || '',
  };
}

const isActiveQuestion = (question: any) => {
  const state = String(question?.state ?? 'A').trim().toUpperCase();
  return state === 'A';
};

const isActiveCategory = (category: any) => {
  const status = String(category?.status ?? '').trim().toLowerCase();
  return status === '' || status === 'a';
};

const loadActiveMainCategoryIds = async (base44: any): Promise<Set<number>> => {
  const rows = await base44.asServiceRole.entities.Category.list('category_id', 50).catch(() => []);
  if (!Array.isArray(rows) || rows.length === 0) return new Set(KNOWN_MAIN_CATEGORY_IDS);
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
  if (!hasSelectedCategoryIds) return Array.from(activeMainCategoryIds);
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

  // Codex091 — prefer the Online multi-select selected_category_ids over the
  // legacy single-`category` field. Fallback chain:
  //   1. incoming.selected_category_ids (if host changed in waiting room)
  //   2. lobby.selected_category_ids (persisted at create time)
  //   3. lobby.category (legacy single-category — old lobbies keep working)
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

const filterQuestionsForLobbySettings = (questions: any[] = [], settings: any = {}, activeMainCategoryIds: Set<number> = new Set(KNOWN_MAIN_CATEGORY_IDS)) => {
  // Codex165 — normalize every Question once so the new Codex156 dataset
  // (year inside `answer`, no legacy `type` field) is honored. Then keep
  // only rows with a usable year inside the host's year window.
  const baseFiltered = (questions || [])
    .map(normalizeQuestionForRuntime)
    .filter(isActiveQuestion)
    .filter(q => q?.type === 'metin')
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

  // Legacy single-category path for old lobbies without selected ids.
  // `karisik` means all active categories; legacy string categories are
  // still honored only for old content paths.
  if (settings.category === 'karisik') return baseFiltered;
  const legacyAllowed = resolveLegacyCategoriesFromSelectedIds([settings.category]);
  if (legacyAllowed && legacyAllowed.length > 0) {
    const allowSet = new Set(legacyAllowed);
    return baseFiltered.filter(q => allowSet.has(q?.category));
  }
  return baseFiltered.filter(q => settings.category === 'karisik' || q?.category === settings.category);
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
      message: 'Seçilen kategoriler için yeterli aktif soru bulunamadı.',
      reason: 'insufficient_active_questions_for_selected_categories',
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

    const players = Array.isArray(lobby.players) ? lobby.players : [];
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
      return json(withDebug({
        error: 'Lobi bekleme durumunda degil.',
      }, { lobbyId, status: lobby.status }), 409);
    }

    if (players.length < 2) {
      return json({ error: 'Oyun baslatmak icin en az 2 oyuncu gerekli' }, 400);
    }

    // Codex131 — In-lobby settings panel removed. We no longer accept any
    // `body.settings` payload; all game config (category multi-select,
    // year window, turn duration, win-card count) is sourced from the
    // persisted lobby row only. Old callers that still send settings are
    // silently ignored — RLS already prevents non-host writes elsewhere.
    const settings = normalizeSettings(lobby, {});
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

    return json(withDebug({
      success: true,
      lobby: updatedLobby,
    }, {
        lobbyId,
        statusBefore: lobby.status,
        statusAfter: updateData.status,
        state_revision_before: currentRevision,
        state_revision_after: updateData.state_revision,
        current_question_id: updateData.current_question_id,
        used_question_count: updateData.used_question_ids.length,
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
