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
const LOBBY_LOCK_TTL_MS = 12 * 1000;
const LOBBY_LOCK_SETTLE_MS = 90;

const normalizeKronoxUserId = (value: unknown) => {
  const text = String(value || '').trim().toUpperCase();
  return KRONOX_ID_PATTERN.test(text) ? text : '';
};

const rowId = (row: any) => row?.id || row?._id || '';

const stableOwnerKey = (prefix: 'u' | 'g', value: unknown) => {
  const text = String(value || '').trim().toLowerCase();
  if (!text) return '';
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `${prefix}_${(hash >>> 0).toString(36)}`;
};

const randomRef = (prefix: string) => {
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  let binary = '';
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return `${prefix}_${btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')}`;
};

const safeCredentialText = (value: unknown, maxLength = 220) => {
  const text = String(value || '').trim();
  return text && text.length <= maxLength && /^[A-Za-z0-9_-]+$/.test(text) ? text : '';
};

const bytesToBase64Url = (bytes: Uint8Array) => {
  let binary = '';
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
};

async function hashGuestToken(guestId: string, guestToken: string) {
  const data = new TextEncoder().encode(`kronox_guest_v1:${guestId}:${guestToken}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return bytesToBase64Url(new Uint8Array(digest));
}

const safeUsername = (value: unknown, seed: unknown) => {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (text && /^[A-Za-z0-9_]{3,24}$/.test(text) && !text.includes('@')) return text;
  const suffix = parseInt(stableOwnerKey('u', seed).replace(/^u_/, '') || '0', 36) || 0;
  return `KronoxUser${1000 + (suffix % 90000)}`;
};

async function resolveOnlineActor(base44: any, body: any) {
  const user = await base44.auth.me().catch(() => null);
  const email = normalizeEmail(user?.email);
  if (email) {
    const rows = await base44.asServiceRole.entities.User.filter({ email }, '-updated_date', 1).catch(() => []);
    const profile = rows?.[0] || user;
    return {
      ok: true,
      authUser: user,
      actor: {
        playerType: 'linked',
        actorKeyHash: stableOwnerKey('u', email),
        email,
        kronoxUserId: normalizeKronoxUserId(profile?.kronox_user_id),
      },
    };
  }
  const guestId = safeCredentialText(body?.guest_id, 80);
  const guestToken = safeCredentialText(body?.guest_token, 220);
  if (!guestId.startsWith('guest_') || !guestToken) {
    return { ok: false, response: json({ error: 'Oyuncu oturumu doğrulanamadı.', code: 'unauthenticated' }, 401) };
  }
  const rows = await base44.asServiceRole.entities.GuestProfile.filter({ guest_id: guestId }, '-created_at', 5).catch(() => []);
  const profile = rows?.[0] || null;
  const providedHash = await hashGuestToken(guestId, guestToken);
  if (!profile || !profile.guest_token_hash || String(profile.guest_token_hash) !== providedHash || String(profile.status || '') === 'linked') {
    return { ok: false, response: json({ error: 'Misafir oturumu doğrulanamadı.', code: 'invalid_guest_token' }, 401) };
  }
  return {
    ok: true,
    authUser: null,
    actor: {
      playerType: 'guest',
      actorKeyHash: stableOwnerKey('g', guestId),
      email: '',
      kronoxUserId: normalizeKronoxUserId(profile?.kronox_user_id),
    },
  };
}

const actorMatchesPlayer = (actor: any, player: any) => Boolean(
  (actor?.actorKeyHash && actor.actorKeyHash === String(player?.actor_key_hash || '')) ||
  (actor?.kronoxUserId && actor.kronoxUserId === normalizeKronoxUserId(player?.kronox_user_id)) ||
  (actor?.email && actor.email === normalizeEmail(player?.email))
);

const actorIsHost = (actor: any, lobby: any) => Boolean(
  (actor?.actorKeyHash && actor.actorKeyHash === String(lobby?.host_actor_key_hash || '')) ||
  (actor?.kronoxUserId && actor.kronoxUserId === normalizeKronoxUserId(lobby?.host_kronox_user_id)) ||
  (actor?.email && actor.email === normalizeEmail(lobby?.host_email))
);

const publicLobby = (lobby: any, actor: any) => {
  const players = Array.isArray(lobby?.players) ? lobby.players : [];
  const hostActorKey = String(lobby?.host_actor_key_hash || players[0]?.actor_key_hash || '');
  return {
    id: String(lobby?.public_ref || ''),
    code: String(lobby?.code || ''),
    status: String(lobby?.status || 'waiting'),
    host_name: safeUsername(lobby?.host_name || players[0]?.name, lobby?.public_ref || lobby?.code),
    current_actor_is_host: actorIsHost(actor, lobby),
    players: players.map((player: any) => ({
      participant_ref: String(player?.participant_ref || ''),
      username: safeUsername(player?.name, player?.participant_ref),
      name: safeUsername(player?.name, player?.participant_ref),
      avatar_type: player?.avatar_type || '',
      avatar_icon_id: player?.avatar_icon_id || '',
      avatar_color_id: player?.avatar_color_id || 'gold',
      avatar_url: String(player?.avatar_url || '').startsWith('https://') ? player.avatar_url : '',
      ready: Boolean(player?.ready),
      cards: Array.isArray(player?.cards) ? player.cards : [],
      is_self: actorMatchesPlayer(actor, player),
      is_host: Boolean(hostActorKey && hostActorKey === String(player?.actor_key_hash || '')),
    })),
    state_revision: readRevision(lobby?.state_revision),
    category: lobby?.category || 'karisik',
    selected_category_ids: Array.isArray(lobby?.selected_category_ids) ? lobby.selected_category_ids : [],
    year_start: lobby?.year_start,
    year_end: lobby?.year_end,
    turn_duration: lobby?.turn_duration,
    win_card_count: lobby?.win_card_count,
    max_players: lobby?.max_players,
    current_player_index: lobby?.current_player_index ?? 0,
    current_question_id: lobby?.current_question_id || null,
    used_question_ids: Array.isArray(lobby?.used_question_ids) ? lobby.used_question_ids : [],
    online_question_deck: Array.isArray(lobby?.online_question_deck) ? lobby.online_question_deck : [],
    online_deck_meta: lobby?.online_deck_meta || null,
    winner: lobby?.winner || null,
    winner_participant_ref: lobby?.winner_participant_ref || null,
    started_at: lobby?.started_at || null,
    completed_at: lobby?.completed_at || null,
    last_activity_at: lobby?.last_activity_at || null,
    expires_at: lobby?.expires_at || null,
  };
};

async function resolveLobbyByPublicRef(base44: any, lobbyRef: unknown) {
  const ref = String(lobbyRef || '').trim();
  if (!ref) return null;
  const rows = await base44.asServiceRole.entities.Lobby.filter({ public_ref: ref }, '-updated_date', 2).catch(() => []);
  return rows?.[0] || await base44.asServiceRole.entities.Lobby.get(ref).catch(() => null);
}

const getPlayerIdentityKey = (player: any) => {
  const actorKeyHash = String(player?.actor_key_hash || '').trim();
  if (actorKeyHash) return `actor:${actorKeyHash}`;
  const kronoxUserId = normalizeKronoxUserId(player?.kronox_user_id);
  if (kronoxUserId) return `kronox:${kronoxUserId}`;
  const email = normalizeEmail(player?.email);
  if (email) return `email:${email}`;
  const name = String(player?.name || '').trim().toLowerCase();
  return name ? `name:${name}` : '';
};

const normalizeLobbyPlayer = (player: any) => ({
  ...player,
  actor_key_hash: String(player?.actor_key_hash || '') || (
    normalizeEmail(player?.email) ? stableOwnerKey('u', normalizeEmail(player?.email)) : ''
  ),
  participant_ref: String(player?.participant_ref || '') || randomRef('player'),
  player_type: player?.player_type || (normalizeEmail(player?.email) ? 'linked' : 'guest'),
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
        actor_key_hash: stableOwnerKey('u', email),
        participant_ref: randomRef('player'),
        player_type: 'linked',
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
  const changed = mergedPlayers.length !== players.length || players.some((player: any) => (
    !player?.participant_ref || !player?.actor_key_hash
  ));
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
    name: player?.name || null,
    participantRef: player?.participant_ref || null,
    cardCount: Array.isArray(player?.cards) ? player.cards.length : 0,
  }));

const CATEGORY_METADATA_POLICY = Object.freeze({
  sourceOfTruth: 'Category',
  legacyHardcodedCategoryFallbackAllowed: false,
  loadFailureBehavior: 'retryable_error_or_empty_state',
});

// Codex591 — Online Kapışma redesign: category selection was removed from
// the client. Online games always draw randomly from ALL active categories;
// selected_category_ids is no longer read from the client or the lobby row.
const ONLINE_GAME_POLICY = Object.freeze({
  categorySourceOfTruth: CATEGORY_METADATA_POLICY.sourceOfTruth,
  selectedCategoryIdsField: 'selected_category_ids',
  selectedCategoriesOnly: false,
  allCategoriesRandom: true,
  selectedCategoryCoverage: 'all_active_categories_random',
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
const ONLINE_DECK_SELECTION_SOURCE = 'online_shared_all_active_random_deck_v1';

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

const getQueryMainCategoryIdsForSettings = (_settings: any, activeMainCategoryIds: Set<number>) => {
  // Codex591 — Online has no category selection anymore: query every active category.
  return Array.from(activeMainCategoryIds);
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

  // Codex591 — Online no longer supports category selection. Any incoming or
  // persisted selected_category_ids (from old lobbies) is intentionally
  // ignored; Online always draws from every active category.
  const selectedCategoryIds: number[] = [];

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

  // Codex591 — Online has no category selection anymore: questions are
  // random from ALL active categories. Legacy selected_category_ids values
  // are compatibility-only and never narrow the Online deck.
  return baseFiltered;
};

const seededRandom = (seed: string) => {
  let state = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    state ^= seed.charCodeAt(index);
    state = Math.imul(state, 16777619);
  }
  return () => {
    state += 0x6D2B79F5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
};

const shuffleQuestions = (questions: any[] = [], seed = 'kronox-online') => {
  const shuffled = [...questions];
  const random = seededRandom(seed);
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

const buildInitialState = ({ players, questions, settings, activeMainCategoryIds, seed }: { players: any[]; questions: any[]; settings: any; activeMainCategoryIds: Set<number>; seed: string }) => {
  const filteredQuestions = filterQuestionsForLobbySettings(questions, settings, activeMainCategoryIds);
  const shuffled = shuffleQuestions(filteredQuestions, seed);
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
      message: 'Tüm aktif kategoriler için yeterli aktif soru bulunamadı.',
      reason: 'insufficient_active_online_questions',
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
      allCategoriesRandom: ONLINE_GAME_POLICY.allCategoriesRandom,
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

const readTime = (value: unknown) => {
  const text = String(value || '').trim();
  if (!text) return NaN;
  return Date.parse(/(?:Z|[+-]\d{2}:?\d{2})$/i.test(text) ? text : `${text}Z`);
};

async function acquireStartLock(base44: any, lobby: any, actor: any) {
  const entity = base44?.asServiceRole?.entities?.EconomyOperationLock;
  if (!entity?.filter || !entity?.create || !entity?.update) {
    return {
      ok: false,
      response: json({ error: 'Lobi şu anda başlatılamıyor. Lütfen tekrar dene.', code: 'lobby_lock_unavailable' }, 503),
    };
  }
  const lockKey = `lobby:start:${rowId(lobby)}:${readRevision(lobby?.state_revision)}`;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const now = new Date();
    const active = await entity.filter({ lock_key: lockKey }, 'acquired_at', 20).catch(() => []);
    if ((active || []).some((row: any) => String(row?.status) === 'active' && readTime(row?.expires_at) > now.getTime())) {
      await new Promise((resolve) => setTimeout(resolve, 80 + attempt * 90));
      continue;
    }
    const lock = await entity.create({
      lock_key: lockKey,
      actor_key: actor.actorKeyHash,
      operation_scope: 'lobby_start',
      operation_id: randomRef('start'),
      status: 'active',
      acquired_at: now.toISOString(),
      expires_at: new Date(now.getTime() + LOBBY_LOCK_TTL_MS).toISOString(),
      metadata: { lobbyPublicRef: lobby?.public_ref || null, expectedRevision: readRevision(lobby?.state_revision) },
    }).catch(() => null);
    if (!lock) continue;
    await new Promise((resolve) => setTimeout(resolve, LOBBY_LOCK_SETTLE_MS));
    const contenders = await entity.filter({ lock_key: lockKey }, 'acquired_at', 20).catch(() => []);
    const winner = (contenders || [])
      .filter((row: any) => String(row?.status) === 'active' && readTime(row?.expires_at) > Date.now())
      .sort((a: any, b: any) => (readTime(a?.acquired_at) - readTime(b?.acquired_at)) || String(rowId(a)).localeCompare(String(rowId(b))))[0];
    if (rowId(winner) === rowId(lock)) return { ok: true, lock };
    await entity.update(rowId(lock), { status: 'released', released_at: new Date().toISOString() }).catch(() => null);
  }
  return { ok: false, response: json({ error: 'Lobi başlatılıyor. Lütfen bekle.', code: 'lobby_start_in_progress' }, 409) };
}

async function releaseStartLock(base44: any, lock: any) {
  if (!rowId(lock)) return;
  await base44.asServiceRole.entities.EconomyOperationLock.update(rowId(lock), {
    status: 'released',
    released_at: new Date().toISOString(),
  }).catch(() => null);
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const lobbyId = body?.lobbyId;
    if (!lobbyId) {
      return json({ error: 'lobbyId gerekli.' }, 400);
    }
    const resolved = await resolveOnlineActor(base44, body);
    if (!resolved.ok) return resolved.response;
    const actor = resolved.actor;
    const user = resolved.authUser;
    const lobby = await resolveLobbyByPublicRef(base44, lobbyId);
    if (!lobby) {
      return json({ error: 'Lobi bulunamadi.' }, 404);
    }
    const canSeeDebug = canSeeAdminDebug(user);
    const withDebug = (payload: Record<string, unknown>, debug: Record<string, unknown>) =>
      canSeeDebug ? { ...payload, debug } : payload;

    if (!actorIsHost(actor, lobby)) {
      return json(withDebug({
        error: 'Sadece host oyunu baslatabilir.',
      }, {
          lobbyRef: lobby?.public_ref || null,
      }), 403);
    }

    const expectedRevisionProvided = body?.expected_state_revision !== undefined && body?.expected_state_revision !== null;
    const expectedRevision = readRevision(body?.expected_state_revision);
    if (expectedRevisionProvided && expectedRevision !== readRevision(lobby?.state_revision)) {
      return json({ error: 'Lobi durumu güncel değil. Son durum yükleniyor.', code: 'stale_write' }, 409);
    }

    if (lobby.status !== 'waiting') {
      if ((lobby.status === 'starting' || lobby.status === 'in_game') && hasAuthoritativeGamePayload(lobby)) {
        return json(withDebug({
          success: true,
          idempotent: true,
          lobby: publicLobby(lobby, actor),
        }, {
            lobbyRef: lobby?.public_ref || null,
            status: lobby.status,
            state_revision: readRevision(lobby.state_revision),
            current_question_id: lobby.current_question_id || null,
            online_question_deck_count: lobby.online_question_deck?.length || 0,
            players: summarizePlayers(lobby.players || []),
        }));
      }
      return json(withDebug({
        error: 'Lobi bekleme durumunda degil.',
      }, { lobbyRef: lobby?.public_ref || null, status: lobby.status }), 409);
    }

    const startLock = await acquireStartLock(base44, lobby, actor);
    if (!startLock.ok) return startLock.response;

    try {
      const lockedLobby = await base44.asServiceRole.entities.Lobby.get(rowId(lobby));
      if ((lockedLobby.status === 'starting' || lockedLobby.status === 'in_game') && hasAuthoritativeGamePayload(lockedLobby)) {
        return json({ success: true, idempotent: true, lobby: publicLobby(lockedLobby, actor) });
      }
      if (lockedLobby.status !== 'waiting') {
        return json({ error: 'Lobi bekleme durumunda degil.', code: 'lobby_not_waiting' }, 409);
      }

    const participantState = await reconcileAcceptedInvitePlayers(base44, lockedLobby);
    const startLobby = participantState.lobby || lockedLobby;
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
      seed: `${startLobby.public_ref || rowId(startLobby)}:${readRevision(startLobby.state_revision)}:all-active-random`,
    });

    if (!initialState.ok) {
      const contentStatus = ['insufficient_active_online_questions', 'not_enough_questions']
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
      winner_actor_key_hash: null,
      winner_participant_ref: null,
      started_at: new Date().toISOString(),
      last_activity_at: new Date().toISOString(),
      state_revision: currentRevision + 1,
    };

    await base44.asServiceRole.entities.Lobby.update(rowId(startLobby), updateData);
    const updatedLobby = await base44.asServiceRole.entities.Lobby.get(rowId(startLobby));

    return json(withDebug({
      success: true,
      lobby: publicLobby(updatedLobby, actor),
    }, {
        lobbyRef: startLobby.public_ref || null,
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
    } finally {
      await releaseStartLock(base44, startLock.lock);
    }
  } catch (error) {
    console.error('[startLobbyGame] failed:', error);
    return json({
      error: 'Online oyun baslatilamadi.',
    }, 500);
  }
});
