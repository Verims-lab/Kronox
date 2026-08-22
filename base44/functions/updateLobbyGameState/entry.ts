import { createClientFromRequest } from 'npm:@base44/sdk@0.8.34';
import {
  DUELLO_MATCH_STATE,
  DUELLO_MAX_QUESTIONS,
  DUELLO_RESULT_VISIBLE_MS,
  DUELLO_RULES_VERSION,
  DUELLO_ROUND_SECONDS,
  DUELLO_TARGET_CORRECT,
  appendDuelloTimelineCard,
  buildDuelloRoundTiming,
  duelloRoundShouldResolve,
  isDuelloAnswerLate,
  isDuelloAnswerableState,
  isDuelloPlacementCorrect,
  resolveDuelloRound,
} from '../../shared/duelloV2Rules.js';

const ONLINE_WIN_POINTS = 15;
const ONLINE_LOSS_POINTS = -6;
const ONLINE_CHECKPOINTS = [0, 100, 250, 500, 1000, 1500, 2000, 3000];
const LOCK_TTL_MS = 12 * 1000;
const LOCK_SETTLE_MS = 90;
const KRONOX_ID_PATTERN = /^KX-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/;
const VALID_ACTIONS = new Set(['place_card', 'advance_turn', 'skip_question', 'submit_duello_answer', 'sync_duello_round']);
const SAME_QUESTION_DUEL_MODE = 'same_question_duel';

const json = (body: unknown, status = 200) => Response.json(body, { status });
const rowId = (row: any) => row?.id || row?._id || '';
const normalizeEmail = (value: unknown) => String(value || '').trim().toLowerCase();
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function readRevision(value: unknown) {
  const revision = Number(value);
  return Number.isFinite(revision) && revision >= 0 ? Math.trunc(revision) : 0;
}

function safeNumber(value: unknown, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function normalizeKronoxUserId(value: unknown) {
  const text = String(value || '').trim().toUpperCase();
  return KRONOX_ID_PATTERN.test(text) ? text : '';
}

function stableOwnerKey(prefix: 'u' | 'g', value: unknown) {
  const text = String(value || '').trim().toLowerCase();
  if (!text) return '';
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `${prefix}_${(hash >>> 0).toString(36)}`;
}

function randomRef(prefix: string) {
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  let binary = '';
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return `${prefix}_${btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')}`;
}

function safeCredentialText(value: unknown, maxLength = 220) {
  const text = String(value || '').trim();
  return text && text.length <= maxLength && /^[A-Za-z0-9_-]+$/.test(text) ? text : '';
}

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = '';
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

async function hashGuestToken(guestId: string, guestToken: string) {
  const input = new TextEncoder().encode(`kronox_guest_v1:${guestId}:${guestToken}`);
  const digest = await crypto.subtle.digest('SHA-256', input);
  return bytesToBase64Url(new Uint8Array(digest));
}

function safeUsername(value: unknown, seed: unknown) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (text && /^[A-Za-z0-9_]{3,24}$/.test(text) && !text.includes('@')) return text;
  const suffix = parseInt(stableOwnerKey('u', seed).replace(/^u_/, '') || '0', 36) || 0;
  return `KronoxUser${1000 + (suffix % 90000)}`;
}

function safeAvatar(profile: any = {}) {
  const avatarUrl = String(profile?.avatar_url || '').trim();
  return {
    avatar_type: ['icon', 'photo'].includes(String(profile?.avatar_type || '')) ? profile.avatar_type : '',
    avatar_icon_id: String(profile?.avatar_icon_id || ''),
    avatar_color_id: String(profile?.avatar_color_id || 'gold'),
    avatar_url: avatarUrl.startsWith('https://') ? avatarUrl : '',
  };
}

async function resolveActor(base44: any, body: any) {
  const authUser = await base44.auth.me().catch(() => null);
  const email = normalizeEmail(authUser?.email);
  if (email) {
    const rows = await base44.asServiceRole.entities.User.filter({ email }, '-updated_date', 1).catch(() => []);
    const profile = rows?.[0] || authUser;
    return {
      ok: true,
      actor: {
        playerType: 'linked',
        actorKeyHash: stableOwnerKey('u', email),
        email,
        kronoxUserId: normalizeKronoxUserId(profile?.kronox_user_id),
        profile,
        profileEntity: base44.asServiceRole.entities.User,
        username: safeUsername(profile?.username || profile?.public_username || profile?.display_name, email),
      },
    };
  }
  const guestId = safeCredentialText(body?.guest_id, 80);
  const guestToken = safeCredentialText(body?.guest_token, 220);
  if (!guestId.startsWith('guest_') || !guestToken) {
    return { ok: false, response: json({ ok: false, code: 'unauthenticated', error: 'Oyuncu oturumu doğrulanamadı.' }, 401) };
  }
  const rows = await base44.asServiceRole.entities.GuestProfile.filter({ guest_id: guestId }, '-created_at', 5).catch(() => []);
  const profile = rows?.[0] || null;
  const providedHash = await hashGuestToken(guestId, guestToken);
  if (!profile || !profile.guest_token_hash || String(profile.guest_token_hash) !== providedHash || String(profile.status || '') === 'linked') {
    return { ok: false, response: json({ ok: false, code: 'invalid_guest_token', error: 'Misafir oturumu doğrulanamadı.' }, 401) };
  }
  return {
    ok: true,
    actor: {
      playerType: 'guest',
      actorKeyHash: stableOwnerKey('g', guestId),
      email: '',
      kronoxUserId: normalizeKronoxUserId(profile?.kronox_user_id),
      profile,
      profileEntity: base44.asServiceRole.entities.GuestProfile,
      username: safeUsername(profile?.username || profile?.display_name, guestId),
    },
  };
}

function actorMatchesPlayer(actor: any, player: any) {
  return Boolean(
    (actor?.actorKeyHash && actor.actorKeyHash === String(player?.actor_key_hash || '')) ||
    (actor?.kronoxUserId && actor.kronoxUserId === normalizeKronoxUserId(player?.kronox_user_id)) ||
    (actor?.email && actor.email === normalizeEmail(player?.email))
  );
}

function publicDuelTimelineCards(cards: any[] = []) {
  return (Array.isArray(cards) ? cards : [])
    .map((card: any, index: number) => ({
      id: `duel_timeline_${index + 1}`,
      year: Number(card?.year),
      question: String(card?.question || ''),
      type: card?.type || 'metin',
      media_url: String(card?.media_url || '').startsWith('https://') ? card.media_url : '',
    }))
    .filter((card: any) => Number.isFinite(card.year));
}

function publicDuelActiveCard(question: any, sequence: number, canAttempt: boolean, revealYear = false) {
  if (!question) return null;
  const mediaUrl = String(question?.media_url || '');
  return {
    id: `duel_card_${sequence}`,
    question: String(question?.question || ''),
    type: question?.type || 'metin',
    media_url: mediaUrl.startsWith('https://') || mediaUrl.startsWith('/assets/') ? mediaUrl : '',
    sequence_id: sequence,
    can_attempt: canAttempt,
    ...(revealYear && Number.isFinite(Number(question?.year)) ? { revealed_year: Number(question.year) } : {}),
  };
}

function publicDuelRoundResult(lobby: any, players: any[]) {
  const result = lobby?.duel_round_result;
  if (!result || !Array.isArray(result?.answers)) return null;
  return {
    question_index: Math.max(1, Math.trunc(Number(result?.question_index) || 1)),
    correct_year: Number.isFinite(Number(result?.correct_year)) ? Number(result.correct_year) : null,
    answers: players.map((player: any) => {
      const answer = result.answers.find((candidate: any) => String(candidate?.participant_ref || '') === String(player?.participant_ref || ''));
      return {
        participant_ref: String(player?.participant_ref || ''),
        answered: Boolean(answer?.answered),
        correct: Boolean(answer?.correct),
        unanswered: !answer?.answered,
      };
    }),
  };
}

function publicLobby(lobby: any, actor: any) {
  const players = Array.isArray(lobby?.players) ? lobby.players : [];
  const hostActorKey = String(lobby?.host_actor_key_hash || players[0]?.actor_key_hash || '');
  const gameMode = String(lobby?.game_mode || 'random_online');
  const duelAnswers = Array.isArray(lobby?.duel_round_answers) ? lobby.duel_round_answers : [];
  const duelSequence = Math.max(1, Math.trunc(Number(lobby?.duel_sequence) || 1));
  const duelIsActive = ['starting', 'in_game'].includes(String(lobby?.status || ''));
  const duelMatchState = String(lobby?.duel_match_state || DUELLO_MATCH_STATE.MATCHING);
  const actorAnswer = duelAnswers.find((answer: any) => String(answer?.actor_key_hash || '') === String(actor?.actorKeyHash || ''));
  const deadlineMs = Date.parse(String(lobby?.duel_question_deadline || ''));
  const canAttempt = duelIsActive
    && isDuelloAnswerableState(duelMatchState)
    && !actorAnswer
    && Number.isFinite(deadlineMs)
    && Date.now() < deadlineMs;
  const activeQuestion = gameMode === SAME_QUESTION_DUEL_MODE && duelIsActive
    ? (lobby?.online_question_deck || []).find((question: any) => String(question?.id || '') === String(lobby?.current_question_id || ''))
    : null;
  const publicActiveQuestion = publicDuelActiveCard(
    activeQuestion,
    duelSequence,
    canAttempt,
    duelMatchState === DUELLO_MATCH_STATE.ROUND_RESULT,
  );
  const sharedTimeline = publicDuelTimelineCards(lobby?.duel_shared_timeline || []);
  const roundResult = publicDuelRoundResult(lobby, players);
  return {
    id: String(lobby?.public_ref || ''),
    code: String(lobby?.code || ''),
    status: String(lobby?.status || 'waiting'),
    game_mode: gameMode,
    host_name: safeUsername(lobby?.host_name || players[0]?.name, lobby?.public_ref || lobby?.code),
    current_actor_is_host: actor?.actorKeyHash === hostActorKey,
    players: players.map((player: any) => {
      const isSelf = actorMatchesPlayer(actor, player);
      return {
        participant_ref: String(player?.participant_ref || ''),
        username: safeUsername(player?.name, player?.participant_ref),
        name: safeUsername(player?.name, player?.participant_ref),
        ...safeAvatar(player),
        ready: Boolean(player?.ready),
        correct_count: Math.max(0, Math.trunc(Number(player?.correct_count ?? player?.claimed_count) || 0)),
        claimed_count: Math.max(0, Math.trunc(Number(player?.correct_count ?? player?.claimed_count) || 0)),
        cards: gameMode === SAME_QUESTION_DUEL_MODE
          ? sharedTimeline
          : (Array.isArray(player?.cards) ? player.cards : []),
        is_self: isSelf,
        is_host: Boolean(hostActorKey && hostActorKey === String(player?.actor_key_hash || '')),
      };
    }),
    state_revision: readRevision(lobby?.state_revision),
    category: lobby?.category || 'karisik',
    selected_category_ids: Array.isArray(lobby?.selected_category_ids) ? lobby.selected_category_ids : [],
    year_start: lobby?.year_start,
    year_end: lobby?.year_end,
    turn_duration: lobby?.turn_duration,
    win_card_count: lobby?.win_card_count,
    max_players: lobby?.max_players,
    current_player_index: lobby?.current_player_index ?? 0,
    current_question_id: gameMode === SAME_QUESTION_DUEL_MODE ? publicActiveQuestion?.id || null : lobby?.current_question_id || null,
    used_question_ids: gameMode === SAME_QUESTION_DUEL_MODE ? [] : (Array.isArray(lobby?.used_question_ids) ? lobby.used_question_ids : []),
    online_question_deck: gameMode === SAME_QUESTION_DUEL_MODE
      ? (publicActiveQuestion ? [publicActiveQuestion] : [])
      : (Array.isArray(lobby?.online_question_deck) ? lobby.online_question_deck : []),
    online_deck_meta: lobby?.online_deck_meta || null,
    active_shared_card: publicActiveQuestion,
    ...(gameMode === SAME_QUESTION_DUEL_MODE ? {
      match_id: String(lobby?.public_ref || ''),
      duel_rules_version: String(lobby?.duel_rules_version || DUELLO_RULES_VERSION),
      duel_match_state: duelMatchState,
      duel_question_index: duelSequence,
      duel_max_questions: DUELLO_MAX_QUESTIONS,
      duel_target_correct: DUELLO_TARGET_CORRECT,
      duel_round_seconds: DUELLO_ROUND_SECONDS,
      duel_shared_timeline: sharedTimeline,
      duel_answer_locked: Boolean(actorAnswer),
      duel_opponent_answered: duelAnswers.some((answer: any) => String(answer?.actor_key_hash || '') !== String(actor?.actorKeyHash || '')),
      duel_question_started_at: lobby?.duel_question_started_at || null,
      duel_question_deadline: lobby?.duel_question_deadline || null,
      duel_countdown_ends_at: lobby?.duel_countdown_ends_at || null,
      duel_round_resolve_after: lobby?.duel_round_resolve_after || null,
      duel_round_result: roundResult,
      duel_sudden_death: Boolean(lobby?.duel_sudden_death),
      duel_result_type: lobby?.duel_result_type || null,
      duel_result_reason: lobby?.duel_result_reason || null,
      duel_points_awarded: Math.max(0, Math.trunc(Number(lobby?.duel_points_awarded) || 0)),
      server_now: new Date().toISOString(),
    } : {}),
    recent_claim: null,
    winner: lobby?.winner || null,
    winner_participant_ref: lobby?.winner_participant_ref || null,
    started_at: lobby?.started_at || null,
    completed_at: lobby?.completed_at || null,
    last_activity_at: lobby?.last_activity_at || null,
  };
}

async function resolveLobby(base44: any, lobbyRef: unknown) {
  const ref = String(lobbyRef || '').trim();
  if (!ref) return null;
  const rows = await base44.asServiceRole.entities.Lobby.filter({ public_ref: ref }, '-updated_date', 2).catch(() => []);
  return rows?.[0] || await base44.asServiceRole.entities.Lobby.get(ref).catch(() => null);
}

function parseTime(value: unknown) {
  const text = String(value || '').trim();
  if (!text) return NaN;
  return Date.parse(/(?:Z|[+-]\d{2}:?\d{2})$/i.test(text) ? text : `${text}Z`);
}

async function acquireLock(base44: any, lockKey: string, actor: any, scope: string, operationId: string) {
  const entity = base44?.asServiceRole?.entities?.EconomyOperationLock;
  if (!entity?.filter || !entity?.create || !entity?.update) {
    return {
      ok: false,
      response: json({ ok: false, code: 'lobby_lock_unavailable', error: 'Oyun durumu şu anda güncellenemiyor. Lütfen tekrar dene.' }, 503),
    };
  }
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const now = new Date();
    const rows = await entity.filter({ lock_key: lockKey }, 'acquired_at', 25).catch(() => []);
    if ((rows || []).some((row: any) => String(row?.status) === 'active' && parseTime(row?.expires_at) > now.getTime())) {
      await sleep(80 + attempt * 90);
      continue;
    }
    const lock = await entity.create({
      lock_key: lockKey,
      actor_key: actor.actorKeyHash,
      operation_scope: scope,
      operation_id: operationId || randomRef('op'),
      status: 'active',
      acquired_at: now.toISOString(),
      expires_at: new Date(now.getTime() + LOCK_TTL_MS).toISOString(),
      metadata: { backendOwned: true, deterministicWinnerAfterSettle: true },
    }).catch(() => null);
    if (!lock) continue;
    await sleep(LOCK_SETTLE_MS);
    const contenders = await entity.filter({ lock_key: lockKey }, 'acquired_at', 25).catch(() => []);
    const winner = (contenders || [])
      .filter((row: any) => String(row?.status) === 'active' && parseTime(row?.expires_at) > Date.now())
      .sort((a: any, b: any) => (parseTime(a?.acquired_at) - parseTime(b?.acquired_at)) || String(rowId(a)).localeCompare(String(rowId(b))))[0];
    if (rowId(winner) === rowId(lock)) return { ok: true, lock };
    await entity.update(rowId(lock), { status: 'released', released_at: new Date().toISOString() }).catch(() => null);
  }
  return { ok: false, response: json({ ok: false, code: 'operation_in_progress', error: 'İşlem sürüyor. Lütfen tekrar dene.' }, 409) };
}

async function releaseLock(base44: any, lock: any) {
  if (!rowId(lock)) return;
  await base44.asServiceRole.entities.EconomyOperationLock.update(rowId(lock), {
    status: 'released',
    released_at: new Date().toISOString(),
  }).catch(() => null);
}

function cardMatchesQuestion(card: any, question: any) {
  return String(card?.id || '') === String(question?.id || '') && Number(card?.year) === Number(question?.year);
}

function isCorrectPlacement(cards: any[], questionYear: number, zone: number) {
  if (!Number.isInteger(zone) || zone < 0 || zone > cards.length) return false;
  const years = cards.map((card) => Number(card?.year)).filter(Number.isFinite).sort((a, b) => a - b);
  const lower = zone === 0 ? -Infinity : years[zone - 1];
  const upper = zone === years.length ? Infinity : years[zone];
  return questionYear >= lower && questionYear <= upper;
}

function sameCards(a: any[] = [], b: any[] = []) {
  return JSON.stringify(a || []) === JSON.stringify(b || []);
}

function normalizeIncomingPlayers(lobbyPlayers: any[], incomingPlayers: any[]) {
  if (incomingPlayers.length !== lobbyPlayers.length) return null;
  const out: any[] = [];
  for (let index = 0; index < lobbyPlayers.length; index += 1) {
    const stored = lobbyPlayers[index];
    const incoming = incomingPlayers[index];
    if (String(incoming?.participant_ref || '') !== String(stored?.participant_ref || '')) return null;
    out.push({ ...stored, ready: incoming?.ready ?? stored?.ready ?? true, cards: Array.isArray(incoming?.cards) ? incoming.cards : [] });
  }
  return out;
}

function getCheckpoint(score: number) {
  let checkpoint = 0;
  for (const value of ONLINE_CHECKPOINTS) {
    if (score >= value) checkpoint = value;
    else break;
  }
  return checkpoint;
}

function applyOnlineScore(progress: any, result: 'win' | 'loss' | 'draw', authoritativeDelta: number | null = null) {
  const previousScore = safeNumber(progress?.score, 0);
  const previousPeak = Math.max(previousScore, safeNumber(progress?.peakScore, previousScore));
  const previousCheckpoint = Math.max(getCheckpoint(previousScore), safeNumber(progress?.peakCheckpoint, getCheckpoint(previousPeak)));
  const delta = authoritativeDelta !== null && Number.isFinite(Number(authoritativeDelta))
    ? Math.trunc(Number(authoritativeDelta))
    : (result === 'win' ? ONLINE_WIN_POINTS : ONLINE_LOSS_POINTS);
  const nextScore = delta < 0 ? Math.max(previousCheckpoint, previousScore + delta, 0) : previousScore + delta;
  return {
    progress: {
      score: nextScore,
      peakScore: Math.max(previousPeak, nextScore),
      peakCheckpoint: Math.max(previousCheckpoint, getCheckpoint(nextScore)),
      wins: Math.max(0, Math.trunc(safeNumber(progress?.wins))) + (result === 'win' ? 1 : 0),
      losses: Math.max(0, Math.trunc(safeNumber(progress?.losses))) + (result === 'loss' ? 1 : 0),
      lastMatchAt: new Date().toISOString(),
    },
    applied: {
      result,
      delta,
      effectiveDelta: nextScore - previousScore,
      previousScore,
      nextScore,
      checkpointBefore: previousCheckpoint,
      checkpointAfter: Math.max(previousCheckpoint, getCheckpoint(nextScore)),
    },
  };
}

function readSoloScore(profile: any, previousOnlineScore: number) {
  const explicit = safeNumber(profile?.solo_progress?.summary?.totalSoloScore, NaN);
  if (Number.isFinite(explicit)) return Math.max(0, explicit);
  const direct = safeNumber(profile?.solo_progress?.totalSoloScore, NaN);
  if (Number.isFinite(direct)) return Math.max(0, direct);
  return Math.max(0, safeNumber(profile?.kronox_puan_total, 0) - previousOnlineScore);
}

function buildOnlineMatchResultIdempotencyKey(lobbyId: string, actorKeyHash: string) {
  return `online_match_result:${lobbyId}:${actorKeyHash}`;
}

async function publishLeaderboardProjection(base44: any, actor: any, onlineProgress: any, totalScore: number, soloScore: number) {
  const entity = base44.asServiceRole.entities.SoloLeaderboardEntry;
  const rows = await entity.filter({ owner_key: actor.actorKeyHash }, '-updated_at', 5).catch(() => []);
  const existing = rows?.[0] || null;
  const profile = actor.profile || {};
  const payload = {
    owner_key: actor.actorKeyHash,
    kronox_user_id: actor.kronoxUserId || undefined,
    username: actor.username,
    display_name: actor.username,
    initial: actor.username.charAt(0).toLocaleUpperCase('tr-TR') || 'K',
    ...safeAvatar(profile),
    total_kronox_score: totalScore,
    total_solo_score: soloScore,
    online_score: safeNumber(onlineProgress?.score, 0),
    current_level: Math.max(1, Math.trunc(safeNumber(existing?.current_level || profile?.solo_progress?.summary?.currentLevel, 1))),
    unlocked_level: Math.max(1, Math.trunc(safeNumber(existing?.unlocked_level || profile?.solo_progress?.summary?.unlockedLevel, 1))),
    total_stars: Math.max(0, Math.trunc(safeNumber(existing?.total_stars || profile?.solo_progress?.summary?.totalStars, 0))),
    completed_level_count: Math.max(0, Math.trunc(safeNumber(existing?.completed_level_count || profile?.solo_progress?.summary?.completedLevelCount, 0))),
    updated_at: new Date().toISOString(),
  };
  if (existing) return entity.update(rowId(existing), payload);
  return entity.create(payload);
}

function publicResult(row: any, alreadyApplied = false) {
  return {
    ok: true,
    alreadyApplied,
    result: row?.result,
    delta: safeNumber(row?.delta),
    effectiveDelta: safeNumber(row?.effective_delta),
    scoreBefore: safeNumber(row?.score_before),
    scoreAfter: safeNumber(row?.score_after),
    appliedAt: row?.applied_at || null,
    saved: String(row?.status || '') === 'applied',
  };
}

async function readFreshActorProfile(actor: any) {
  const id = rowId(actor?.profile);
  if (id && actor?.profileEntity?.get) {
    const fresh = await actor.profileEntity.get(id).catch(() => null);
    if (fresh) return fresh;
  }
  return actor?.profile || {};
}

async function commitOnlineResult(base44: any, lobby: any, actor: any, body: any) {
  const players = Array.isArray(lobby?.players) ? lobby.players : [];
  const actorPlayer = players.find((player: any) => actorMatchesPlayer(actor, player));
  if (!actorPlayer) return json({ ok: false, code: 'not_lobby_participant', error: 'Bu maçın oyuncusu değilsin.' }, 403);
  const isDuello = String(lobby?.game_mode || '') === SAME_QUESTION_DUEL_MODE;
  const isDraw = isDuello && String(lobby?.duel_result_type || '') === 'draw';
  if (lobby?.status !== 'finished' || (!isDraw && !lobby?.winner_actor_key_hash)) {
    return json({ ok: false, code: 'match_not_finished', error: 'Maç sonucu henüz doğrulanmadı.' }, 409);
  }
  const result: 'win' | 'loss' | 'draw' = isDraw
    ? 'draw'
    : (String(lobby.winner_actor_key_hash) === actor.actorKeyHash ? 'win' : 'loss');
  const duelloDelta = isDuello
    ? (result === 'win' ? Math.max(0, Math.trunc(safeNumber(lobby?.duel_points_awarded, 0))) : 0)
    : null;
  const idempotencyKey = buildOnlineMatchResultIdempotencyKey(rowId(lobby), actor.actorKeyHash);
  const resultEntity = base44.asServiceRole.entities.OnlineMatchResult;
  const existingRows = await resultEntity.filter({ idempotency_key: idempotencyKey }, 'created_at', 10).catch(() => []);
  const appliedExisting = (existingRows || []).find((row: any) => String(row?.status || '') === 'applied');
  if (appliedExisting) {
    const freshProfile = await readFreshActorProfile(actor);
    return json({ ...publicResult(appliedExisting, true), userPatch: { online_progress: freshProfile?.online_progress, kronox_puan_total: freshProfile?.kronox_puan_total } });
  }

  const lock = await acquireLock(base44, `online-result:${rowId(lobby)}:${actor.actorKeyHash}`, actor, 'online_match_result', idempotencyKey);
  if (!lock.ok) return lock.response;
  try {
    const freshExisting = await resultEntity.filter({ idempotency_key: idempotencyKey }, 'created_at', 10).catch(() => []);
    const canonicalApplied = (freshExisting || []).find((row: any) => String(row?.status || '') === 'applied');
    if (canonicalApplied) {
      const freshProfile = await readFreshActorProfile(actor);
      return json({ ...publicResult(canonicalApplied, true), userPatch: { online_progress: freshProfile?.online_progress, kronox_puan_total: freshProfile?.kronox_puan_total } });
    }

    const freshProfile = await readFreshActorProfile(actor);
    actor.profile = freshProfile;
    const currentProgress = freshProfile?.online_progress && typeof freshProfile.online_progress === 'object'
      ? freshProfile.online_progress
      : {};
    const reservation = (freshExisting || []).find((row: any) => String(row?.status || '') === 'reserved') || null;
    const reservedScoreAfter = safeNumber(reservation?.score_after, NaN);
    const currentScore = safeNumber(currentProgress?.score, 0);
    const matchRef = String(lobby.public_ref || '');
    const reservationAlreadyWritten = Boolean(
      reservation
      && Number.isFinite(reservedScoreAfter)
      && currentScore === reservedScoreAfter
      && String(currentProgress?.lastMatchId || '') === matchRef,
    );
    if (reservationAlreadyWritten) {
      const soloScore = readSoloScore(freshProfile, currentScore);
      const totalScore = Math.max(0, Math.trunc(soloScore + currentScore));
      await publishLeaderboardProjection(base44, actor, currentProgress, totalScore, soloScore);
      const reconciledRow = await resultEntity.update(rowId(reservation), {
        status: 'applied',
        applied_at: new Date().toISOString(),
        metadata: {
          ...(reservation?.metadata && typeof reservation.metadata === 'object' ? reservation.metadata : {}),
          reconciledAfterPartialWrite: true,
          reconciled_from_audit: true,
        },
      });
      return json({
        ...publicResult(reconciledRow || { ...reservation, status: 'applied' }, true),
        userPatch: { online_progress: currentProgress, kronox_puan_total: totalScore },
      });
    }
    if (reservation && currentScore !== safeNumber(reservation?.score_before, currentScore)) {
      return json({ ok: false, code: 'online_result_reconciliation_conflict', error: 'Maç puanı güvenli biçimde uzlaştırılamadı.' }, 409);
    }
    const { progress, applied } = applyOnlineScore(currentProgress, result, duelloDelta);
    progress.lastMatchId = matchRef;
    const soloScore = readSoloScore(freshProfile, applied.previousScore);
    const totalScore = Math.max(0, Math.trunc(soloScore + applied.nextScore));
    const timestamp = new Date().toISOString();
    let resultReservation = reservation;
    if (!resultReservation) {
      try {
        resultReservation = await resultEntity.create({
          idempotency_key: idempotencyKey,
          actor_key_hash: actor.actorKeyHash,
          player_type: actor.playerType,
          lobby_ref: lobby.public_ref || '',
          lobby_id: rowId(lobby),
          player_email: actor.email,
          player_kronox_user_id: actor.kronoxUserId,
          result,
          delta: applied.delta,
          effective_delta: applied.effectiveDelta,
          score_before: applied.previousScore,
          score_after: applied.nextScore,
          elapsed_seconds: Math.max(0, Math.trunc(safeNumber(body?.durationSeconds || body?.duration_seconds, 0))),
          checkpoint_before: applied.checkpointBefore,
          checkpoint_after: applied.checkpointAfter,
          status: 'reserved',
          created_at: timestamp,
          source: String(body?.source || 'online_game').slice(0, 80),
          metadata: {
            backendAuthoritative: true,
            scoreRule: isDuello ? 'duello_v2_backend_50_25_0' : 'winner_15_loser_minus_6',
            speedBonus: false,
          },
        });
      } catch (_reservationError) {
        return json({
          ok: false,
          code: 'online_result_audit_reservation_failed',
          error: 'Maç puanı kaydedilemedi; puan uygulanmadı.',
          retryable: true,
          where: 'audit',
          scoreApplied: false,
        }, 503);
      }
    }
    await actor.profileEntity.update(rowId(actor.profile), {
      online_progress: progress,
      kronox_puan_total: totalScore,
    });
    await publishLeaderboardProjection(base44, actor, progress, totalScore, soloScore);
    const finalRow = await resultEntity.update(rowId(resultReservation), {
      status: 'applied',
      applied_at: timestamp,
      score_after: applied.nextScore,
      effective_delta: applied.effectiveDelta,
    });
    return json({
      ...publicResult(finalRow || { ...resultReservation, status: 'applied', applied_at: timestamp }, false),
      userPatch: { online_progress: progress, kronox_puan_total: totalScore },
    });
  } finally {
    await releaseLock(base44, lock.lock);
  }
}

function currentDuelloQuestion(lobby: any) {
  return (Array.isArray(lobby?.online_question_deck) ? lobby.online_question_deck : [])
    .find((question: any) => String(question?.id || '') === String(lobby?.current_question_id || '')) || null;
}

function buildDuelloRoundResolutionUpdate(lobby: any, answers: any[], currentQuestion: any, nowMs: number, processedKeys: string[]) {
  const sequence = Math.max(1, Math.trunc(safeNumber(lobby?.duel_sequence, 1)));
  const resolution = resolveDuelloRound({
    players: lobby?.players,
    answers,
    questionIndex: sequence,
    suddenDeath: Boolean(lobby?.duel_sudden_death),
  });
  const sharedTimeline = appendDuelloTimelineCard(lobby?.duel_shared_timeline, currentQuestion);
  const timestamp = new Date(nowMs).toISOString();
  const nextPlayers = resolution.players.map((player: any) => ({ ...player, cards: sharedTimeline.map((card: any) => ({ ...card })) }));
  return {
    status: 'in_game',
    players: nextPlayers,
    duel_shared_timeline: sharedTimeline,
    duel_round_answers: answers,
    duel_round_attempts: answers.map((answer: any) => answer.actor_key_hash).filter(Boolean),
    duel_round_result: {
      question_index: sequence,
      correct_year: Number(currentQuestion?.year),
      answers: resolution.answers,
      resolved_at: timestamp,
    },
    duel_round_resolve_after: new Date(nowMs + DUELLO_RESULT_VISIBLE_MS).toISOString(),
    duel_match_state: DUELLO_MATCH_STATE.ROUND_RESULT,
    duel_sudden_death: resolution.suddenDeath,
    duel_pending_finish: resolution.finished ? {
      result_type: resolution.resultType,
      result_reason: resolution.resultReason,
      winner_participant_ref: resolution.winnerParticipantRef,
      points_awarded: resolution.pointsAwarded,
    } : null,
    duel_processed_operation_keys: processedKeys.slice(-80),
    recent_claim: null,
    last_activity_at: timestamp,
    state_revision: readRevision(lobby?.state_revision) + 1,
  };
}

function buildDuelloFinishUpdate(lobby: any, nowMs: number) {
  const pending = lobby?.duel_pending_finish;
  if (!pending) return null;
  const players = Array.isArray(lobby?.players) ? lobby.players : [];
  const winnerPlayer = players.find((player: any) => String(player?.participant_ref || '') === String(pending?.winner_participant_ref || '')) || null;
  const timestamp = new Date(nowMs).toISOString();
  return {
    status: 'finished',
    current_question_id: null,
    duel_match_state: DUELLO_MATCH_STATE.MATCH_FINISHED,
    duel_pending_finish: null,
    duel_result_type: pending?.result_type || 'draw',
    duel_result_reason: pending?.result_reason || 'draw',
    duel_points_awarded: Math.max(0, Math.trunc(safeNumber(pending?.points_awarded, 0))),
    winner: winnerPlayer ? safeUsername(winnerPlayer?.name, winnerPlayer?.participant_ref) : null,
    winner_participant_ref: winnerPlayer?.participant_ref || null,
    winner_actor_key_hash: winnerPlayer?.actor_key_hash || null,
    winner_email: winnerPlayer?.email || null,
    winner_kronox_user_id: winnerPlayer?.kronox_user_id || null,
    completed_at: timestamp,
    last_activity_at: timestamp,
    state_revision: readRevision(lobby?.state_revision) + 1,
  };
}

function buildNextDuelloRoundUpdate(lobby: any, nowMs: number) {
  const sequence = Math.max(1, Math.trunc(safeNumber(lobby?.duel_sequence, 1)));
  if (sequence >= DUELLO_MAX_QUESTIONS) return null;
  const used = new Set((Array.isArray(lobby?.used_question_ids) ? lobby.used_question_ids : []).map(String));
  const nextQuestion = (Array.isArray(lobby?.online_question_deck) ? lobby.online_question_deck : [])
    .find((question: any) => !used.has(String(question?.id || '')));
  if (!nextQuestion) return null;
  used.add(String(nextQuestion.id));
  const timing = buildDuelloRoundTiming(nowMs);
  return {
    status: 'in_game',
    current_question_id: String(nextQuestion.id),
    used_question_ids: Array.from(used),
    duel_sequence: sequence + 1,
    duel_match_state: lobby?.duel_sudden_death ? DUELLO_MATCH_STATE.SUDDEN_DEATH : DUELLO_MATCH_STATE.QUESTION_ACTIVE,
    duel_round_answers: [],
    duel_round_attempts: [],
    duel_round_result: null,
    duel_round_resolve_after: null,
    duel_pending_finish: null,
    duel_question_started_at: timing.questionStartedAt,
    duel_question_deadline: timing.questionDeadline,
    duel_countdown_ends_at: null,
    recent_claim: null,
    last_activity_at: new Date(nowMs).toISOString(),
    state_revision: readRevision(lobby?.state_revision) + 1,
  };
}

function buildDueDuelloUpdate(lobby: any, nowMs = Date.now()) {
  const matchState = String(lobby?.duel_match_state || '');
  if (matchState === DUELLO_MATCH_STATE.COUNTDOWN) {
    const startsAt = Date.parse(String(lobby?.duel_question_started_at || ''));
    if (Number.isFinite(startsAt) && nowMs >= startsAt) {
      return {
        status: 'in_game',
        duel_match_state: lobby?.duel_sudden_death ? DUELLO_MATCH_STATE.SUDDEN_DEATH : DUELLO_MATCH_STATE.QUESTION_ACTIVE,
        duel_countdown_ends_at: null,
        last_activity_at: new Date(nowMs).toISOString(),
        state_revision: readRevision(lobby?.state_revision) + 1,
      };
    }
    return null;
  }
  if ([DUELLO_MATCH_STATE.QUESTION_ACTIVE, DUELLO_MATCH_STATE.WAITING_FOR_OPPONENT, DUELLO_MATCH_STATE.SUDDEN_DEATH].includes(matchState)) {
    const answers = Array.isArray(lobby?.duel_round_answers) ? lobby.duel_round_answers : [];
    if (!duelloRoundShouldResolve({
      answers,
      playerCount: 2,
      questionDeadline: lobby?.duel_question_deadline,
      serverNowMs: nowMs,
    })) return null;
    const question = currentDuelloQuestion(lobby);
    if (!question) return null;
    return buildDuelloRoundResolutionUpdate(
      lobby,
      answers,
      question,
      nowMs,
      Array.isArray(lobby?.duel_processed_operation_keys) ? lobby.duel_processed_operation_keys : [],
    );
  }
  if (matchState === DUELLO_MATCH_STATE.ROUND_RESULT) {
    const resolveAfter = Date.parse(String(lobby?.duel_round_resolve_after || ''));
    if (!Number.isFinite(resolveAfter) || nowMs < resolveAfter) return null;
    return lobby?.duel_pending_finish
      ? buildDuelloFinishUpdate(lobby, nowMs)
      : buildNextDuelloRoundUpdate(lobby, nowMs);
  }
  return null;
}

async function submitSameQuestionDuelAnswer(base44: any, lobby: any, actor: any, body: any) {
  if (String(lobby?.game_mode || '') !== SAME_QUESTION_DUEL_MODE) {
    return json({ ok: false, code: 'wrong_game_mode', error: 'Bu işlem bu Online modu için kullanılamaz.' }, 400);
  }
  const players = Array.isArray(lobby?.players) ? lobby.players : [];
  if (players.length !== 2 || Number(lobby?.max_players) !== 2) {
    return json({ ok: false, code: 'same_question_duel_requires_two_players', error: 'Duello tam olarak 2 oyuncu gerektirir.' }, 409);
  }
  const actorIndex = players.findIndex((player: any) => actorMatchesPlayer(actor, player));
  if (actorIndex < 0) return json({ ok: false, code: 'not_lobby_participant', error: 'Bu maçın oyuncusu değilsin.' }, 403);

  const requestedSequence = Math.max(1, Math.trunc(safeNumber(body?.sequence_id, 0)));
  const clientOperationKey = String(body?.operation_key || `sequence:${requestedSequence}`)
    .replace(/[^A-Za-z0-9:_-]/g, '')
    .slice(0, 160);
  const operationKey = `duel_answer:${rowId(lobby)}:${requestedSequence}:${actor.actorKeyHash}:${clientOperationKey}`;
  const processed = Array.isArray(lobby?.duel_processed_operation_keys) ? lobby.duel_processed_operation_keys : [];
  if (processed.includes(operationKey)) {
    return json({ success: true, idempotent: true, answer_result: 'already_processed', lobby: publicLobby(lobby, actor) });
  }

  const lock = await acquireLock(
    base44,
    `same-question-duel:${rowId(lobby)}:${requestedSequence}`,
    actor,
    'lobby_turn',
    operationKey,
  );
  if (!lock.ok) return lock.response;

  try {
    const fresh = await base44.asServiceRole.entities.Lobby.get(rowId(lobby));
    if (!fresh || String(fresh?.game_mode || '') !== SAME_QUESTION_DUEL_MODE) {
      return json({ ok: false, code: 'wrong_game_mode', error: 'Duello durumu doğrulanamadı.' }, 409);
    }
    if (!['starting', 'in_game'].includes(String(fresh?.status || ''))) {
      return json({ ok: false, code: 'invalid_lobby_status', error: 'Oyun aktif değil.' }, 409);
    }
    const freshProcessed = Array.isArray(fresh?.duel_processed_operation_keys) ? fresh.duel_processed_operation_keys : [];
    if (freshProcessed.includes(operationKey)) {
      return json({ success: true, idempotent: true, answer_result: 'already_processed', lobby: publicLobby(fresh, actor) });
    }
    const currentSequence = Math.max(1, Math.trunc(safeNumber(fresh?.duel_sequence, 1)));
    if (requestedSequence !== currentSequence) {
      return json({
        success: true,
        idempotent: true,
        answer_result: 'round_already_resolved',
        lobby: publicLobby(fresh, actor),
      });
    }

    const storedPlayers = Array.isArray(fresh?.players) ? fresh.players : [];
    if (storedPlayers.length !== 2 || Number(fresh?.max_players) !== 2) {
      return json({ ok: false, code: 'same_question_duel_requires_two_players', error: 'Duello tam olarak 2 oyuncu gerektirir.' }, 409);
    }
    const freshActorIndex = storedPlayers.findIndex((player: any) => actorMatchesPlayer(actor, player));
    if (freshActorIndex < 0) return json({ ok: false, code: 'not_lobby_participant', error: 'Bu maçın oyuncusu değilsin.' }, 403);
    const nowMs = Date.now();
    const dueUpdate = buildDueDuelloUpdate(fresh, nowMs);
    if (dueUpdate && (
      String(dueUpdate?.duel_match_state || '') === DUELLO_MATCH_STATE.ROUND_RESULT
      || String(fresh?.duel_match_state || '') === DUELLO_MATCH_STATE.ROUND_RESULT
    )) {
      await base44.asServiceRole.entities.Lobby.update(rowId(fresh), dueUpdate);
      const updated = await base44.asServiceRole.entities.Lobby.get(rowId(fresh));
      return json({ success: true, accepted: false, answer_result: 'round_already_resolved', lobby: publicLobby(updated, actor) });
    }
    const working = dueUpdate
      ? { ...fresh, ...dueUpdate, state_revision: readRevision(fresh?.state_revision) }
      : fresh;
    const matchState = String(working?.duel_match_state || '');
    if (!isDuelloAnswerableState(matchState)) {
      return json({ ok: false, code: 'duel_round_not_active', error: 'Bu Duello turu henüz aktif değil.' }, 409);
    }
    if (isDuelloAnswerLate(working?.duel_question_deadline, nowMs)) {
      const lateUpdate = buildDueDuelloUpdate(working, nowMs);
      if (lateUpdate) await base44.asServiceRole.entities.Lobby.update(rowId(fresh), lateUpdate);
      const updated = await base44.asServiceRole.entities.Lobby.get(rowId(fresh));
      return json({ success: true, accepted: false, answer_result: 'late', lobby: publicLobby(updated, actor) });
    }
    const answers = Array.isArray(working?.duel_round_answers) ? working.duel_round_answers : [];
    if (answers.some((answer: any) => String(answer?.actor_key_hash || '') === actor.actorKeyHash)) {
      return json({ success: true, idempotent: true, accepted: true, answer_result: 'locked', lobby: publicLobby(working, actor) });
    }

    const currentQuestion = currentDuelloQuestion(working);
    if (!currentQuestion) return json({ ok: false, code: 'question_not_in_deck', error: 'Aktif soru doğrulanamadı.' }, 409);
    const sharedTimeline = Array.isArray(working?.duel_shared_timeline) ? working.duel_shared_timeline : [];
    const placementZone = Math.trunc(Number(body?.placement_zone));
    const correct = isDuelloPlacementCorrect(sharedTimeline, Number(currentQuestion.year), placementZone);
    const nextProcessed = [...freshProcessed, operationKey].slice(-80);
    const startedAtMs = Date.parse(String(working?.duel_question_started_at || ''));
    const responseMs = Number.isFinite(startedAtMs) ? Math.max(0, Math.min(DUELLO_ROUND_SECONDS * 1000, nowMs - startedAtMs)) : 0;
    const nextAnswers = [...answers, {
      actor_key_hash: actor.actorKeyHash,
      participant_ref: String(storedPlayers[freshActorIndex]?.participant_ref || ''),
      placement_zone: placementZone,
      answered_at: new Date(nowMs).toISOString(),
      response_ms: responseMs,
      correct,
    }];

    const shouldResolve = duelloRoundShouldResolve({
      answers: nextAnswers,
      playerCount: 2,
      questionDeadline: working?.duel_question_deadline,
      serverNowMs: nowMs,
    });
    const updateData = shouldResolve
      ? buildDuelloRoundResolutionUpdate(working, nextAnswers, currentQuestion, nowMs, nextProcessed)
      : {
          status: 'in_game',
          duel_match_state: DUELLO_MATCH_STATE.WAITING_FOR_OPPONENT,
          duel_round_answers: nextAnswers,
          duel_round_attempts: nextAnswers.map((answer: any) => answer.actor_key_hash).filter(Boolean),
          duel_processed_operation_keys: nextProcessed,
          last_operation_key: operationKey,
          last_activity_at: new Date(nowMs).toISOString(),
          state_revision: readRevision(working?.state_revision) + 1,
        };
    await base44.asServiceRole.entities.Lobby.update(rowId(fresh), updateData);
    const updated = await base44.asServiceRole.entities.Lobby.get(rowId(fresh));
    return json({
      success: true,
      accepted: true,
      answer_result: shouldResolve ? 'round_resolved' : 'locked',
      lobby: publicLobby(updated, actor),
    });
  } finally {
    await releaseLock(base44, lock.lock);
  }
}

async function syncSameQuestionDuelRound(base44: any, lobby: any, actor: any) {
  if (String(lobby?.game_mode || '') !== SAME_QUESTION_DUEL_MODE) {
    return json({ ok: false, code: 'wrong_game_mode', error: 'Bu işlem bu Online modu için kullanılamaz.' }, 400);
  }
  const players = Array.isArray(lobby?.players) ? lobby.players : [];
  if (players.length !== 2 || !players.some((player: any) => actorMatchesPlayer(actor, player))) {
    return json({ ok: false, code: 'not_lobby_participant', error: 'Bu maçın oyuncusu değilsin.' }, 403);
  }
  if (!buildDueDuelloUpdate(lobby, Date.now())) {
    return json({ success: true, state_changed: false, lobby: publicLobby(lobby, actor) });
  }
  const sequence = Math.max(1, Math.trunc(safeNumber(lobby?.duel_sequence, 1)));
  const operationKey = `duel_sync:${rowId(lobby)}:${sequence}:${String(lobby?.duel_match_state || '')}`;
  const lock = await acquireLock(base44, `same-question-duel:${rowId(lobby)}:${sequence}`, actor, 'lobby_turn', operationKey);
  if (!lock.ok) return lock.response;
  try {
    const fresh = await base44.asServiceRole.entities.Lobby.get(rowId(lobby));
    if (!fresh || String(fresh?.game_mode || '') !== SAME_QUESTION_DUEL_MODE) {
      return json({ ok: false, code: 'wrong_game_mode', error: 'Duello durumu doğrulanamadı.' }, 409);
    }
    const updateData = buildDueDuelloUpdate(fresh, Date.now());
    if (!updateData) return json({ success: true, state_changed: false, lobby: publicLobby(fresh, actor) });
    await base44.asServiceRole.entities.Lobby.update(rowId(fresh), updateData);
    const updated = await base44.asServiceRole.entities.Lobby.get(rowId(fresh));
    return json({ success: true, state_changed: true, lobby: publicLobby(updated, actor) });
  } finally {
    await releaseLock(base44, lock.lock);
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const resolved = await resolveActor(base44, body);
    if (!resolved.ok) return resolved.response;
    const actor = resolved.actor;
    const lobby = await resolveLobby(base44, body?.lobbyId || body?.lobby_id);
    if (!lobby) return json({ ok: false, code: 'lobby_not_found', error: 'Lobi bulunamadı.' }, 404);

    if (body?.action === 'commit_result') {
      return commitOnlineResult(base44, lobby, actor, body);
    }

    const lobbyPlayers = Array.isArray(lobby?.players) ? lobby.players : [];
    const actorIndex = lobbyPlayers.findIndex((player: any) => actorMatchesPlayer(actor, player));
    if (actorIndex < 0) return json({ ok: false, code: 'not_lobby_participant', error: 'Bu lobi için oyuncu yetkin yok.' }, 403);
    if (!VALID_ACTIONS.has(String(body?.action || ''))) return json({ ok: false, code: 'invalid_action', error: 'Geçersiz oyun aksiyonu.' }, 400);
    if (!['starting', 'in_game'].includes(String(lobby?.status || ''))) {
      return json({ ok: false, code: 'invalid_lobby_status', error: 'Oyun aktif değil.' }, 409);
    }

    if (body?.action === 'submit_duello_answer') {
      return submitSameQuestionDuelAnswer(base44, lobby, actor, body);
    }
    if (body?.action === 'sync_duello_round') {
      return syncSameQuestionDuelRound(base44, lobby, actor);
    }

    const expectedRevision = readRevision(body?.expected_state_revision);
    const operationKey = String(body?.operation_key || '').trim().slice(0, 220) ||
      `lobby_turn:${lobby.public_ref}:${expectedRevision}:${body.action}:${lobby.current_question_id}`;
    if (lobby?.last_operation_key === operationKey) {
      return json({ success: true, idempotent: true, lobby: publicLobby(lobby, actor) });
    }
    if (expectedRevision !== readRevision(lobby?.state_revision)) {
      return json({ ok: false, code: 'stale_write', error: 'Lobi durumu güncel değil. Son durum yükleniyor.' }, 409);
    }

    const lock = await acquireLock(base44, `lobby:turn:${rowId(lobby)}:${expectedRevision}`, actor, 'lobby_turn', operationKey);
    if (!lock.ok) return lock.response;
    try {
      const fresh = await base44.asServiceRole.entities.Lobby.get(rowId(lobby));
      if (fresh?.last_operation_key === operationKey) {
        return json({ success: true, idempotent: true, lobby: publicLobby(fresh, actor) });
      }
      if (readRevision(fresh?.state_revision) !== expectedRevision) {
        return json({ ok: false, code: 'stale_write', error: 'Lobi durumu güncel değil. Son durum yükleniyor.' }, 409);
      }
      const storedPlayers = Array.isArray(fresh.players) ? fresh.players : [];
      const activeIndex = Number(fresh.current_player_index) || 0;
      if (!actorMatchesPlayer(actor, storedPlayers[activeIndex])) {
        return json({ ok: false, code: 'not_your_turn', error: 'Sıra sende değil.' }, 409);
      }
      const incomingPlayers = Array.isArray(body?.players) ? normalizeIncomingPlayers(storedPlayers, body.players) : null;
      if (!incomingPlayers) return json({ ok: false, code: 'invalid_roster', error: 'Oyuncu listesi değiştirilemez.' }, 400);

      const action = String(body.action);
      const currentQuestionId = String(fresh.current_question_id || '');
      const deck = Array.isArray(fresh.online_question_deck) ? fresh.online_question_deck : [];
      const currentQuestion = deck.find((question: any) => String(question?.id || '') === currentQuestionId);
      if (!currentQuestion) return json({ ok: false, code: 'question_not_in_deck', error: 'Aktif soru doğrulanamadı.' }, 409);
      const previousCards = Array.isArray(storedPlayers[activeIndex]?.cards) ? storedPlayers[activeIndex].cards : [];
      const nextCards = Array.isArray(incomingPlayers[activeIndex]?.cards) ? incomingPlayers[activeIndex].cards : [];
      for (let index = 0; index < storedPlayers.length; index += 1) {
        if (index !== activeIndex && !sameCards(storedPlayers[index]?.cards || [], incomingPlayers[index]?.cards || [])) {
          return json({ ok: false, code: 'other_player_cards_changed', error: 'Diğer oyuncunun kartları değiştirilemez.' }, 400);
        }
      }

      if (action === 'skip_question') {
        if (!sameCards(previousCards, nextCards)) return json({ ok: false, code: 'skip_changed_cards', error: 'Soru değiştirme kartları değiştiremez.' }, 400);
      } else {
        const zone = Math.trunc(Number(body?.placement_zone));
        const correct = isCorrectPlacement(previousCards, Number(currentQuestion.year), zone);
        const delta = nextCards.length - previousCards.length;
        if ((correct && delta !== 1) || (!correct && delta !== 0)) {
          return json({ ok: false, code: 'placement_result_mismatch', error: 'Kart yerleşimi sunucu sonucuyla eşleşmiyor.' }, 400);
        }
        if (delta === 1 && !cardMatchesQuestion(nextCards[nextCards.length - 1], currentQuestion)) {
          return json({ ok: false, code: 'placed_card_mismatch', error: 'Yerleştirilen kart aktif soruyla eşleşmiyor.' }, 400);
        }
        if (!nextCards.slice(0, previousCards.length).every((card: any, index: number) => sameCards([card], [previousCards[index]]))) {
          return json({ ok: false, code: 'existing_cards_changed', error: 'Mevcut kartlar değiştirilemez.' }, 400);
        }
      }

      const incomingUsedIds = Array.isArray(body?.used_question_ids)
        ? [...new Set(body.used_question_ids.map((value: unknown) => String(value || '')).filter(Boolean))]
        : [];
      const previousUsedIds = Array.isArray(fresh.used_question_ids) ? fresh.used_question_ids.map(String) : [];
      if (!previousUsedIds.every((id: string) => incomingUsedIds.includes(id)) || incomingUsedIds.some((id: string) => !deck.some((question: any) => String(question?.id || '') === id))) {
        return json({ ok: false, code: 'invalid_question_history', error: 'Soru geçmişi doğrulanamadı.' }, 400);
      }

      const winCardCount = Math.max(1, Math.trunc(safeNumber(fresh.win_card_count, 10)));
      const hasWon = nextCards.length >= winCardCount;
      const requestedStatus = String(body?.status || 'in_game');
      if ((requestedStatus === 'finished') !== hasWon) {
        return json({ ok: false, code: 'winner_state_mismatch', error: 'Maç bitişi sunucu kart durumuyla eşleşmiyor.' }, 400);
      }
      const expectedNextIndex = hasWon ? activeIndex : (action === 'skip_question' ? activeIndex : (activeIndex + 1) % storedPlayers.length);
      if (Math.trunc(Number(body?.current_player_index)) !== expectedNextIndex) {
        return json({ ok: false, code: 'turn_order_mismatch', error: 'Tur sırası doğrulanamadı.' }, 400);
      }
      const nextQuestionId = String(body?.current_question_id || '');
      if (!hasWon && (!nextQuestionId || !deck.some((question: any) => String(question?.id || '') === nextQuestionId))) {
        return json({ ok: false, code: 'next_question_invalid', error: 'Sonraki soru doğrulanamadı.' }, 400);
      }

      const updateData: Record<string, unknown> = {
        players: incomingPlayers,
        used_question_ids: incomingUsedIds,
        status: hasWon ? 'finished' : 'in_game',
        current_player_index: expectedNextIndex,
        current_question_id: hasWon ? currentQuestionId : nextQuestionId,
        state_revision: expectedRevision + 1,
        last_operation_key: operationKey,
        last_activity_at: new Date().toISOString(),
      };
      if (hasWon) {
        const winnerPlayer = storedPlayers[activeIndex];
        updateData.winner = safeUsername(winnerPlayer?.name, winnerPlayer?.participant_ref);
        updateData.winner_participant_ref = winnerPlayer?.participant_ref || null;
        updateData.winner_actor_key_hash = winnerPlayer?.actor_key_hash || actor.actorKeyHash;
        updateData.winner_email = winnerPlayer?.email || null;
        updateData.winner_kronox_user_id = winnerPlayer?.kronox_user_id || null;
        updateData.completed_at = new Date().toISOString();
      }
      await base44.asServiceRole.entities.Lobby.update(rowId(fresh), updateData);
      const updated = await base44.asServiceRole.entities.Lobby.get(rowId(fresh));
      return json({ success: true, lobby: publicLobby(updated, actor), stateRevision: readRevision(updated?.state_revision) });
    } finally {
      await releaseLock(base44, lock.lock);
    }
  } catch (error) {
    console.error('[updateLobbyGameState] failed', error?.message || error);
    return json({ ok: false, code: 'online_state_update_failed', error: 'Online oyun durumu güncellenemedi.' }, 500);
  }
});
