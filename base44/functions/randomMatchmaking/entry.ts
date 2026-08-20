import { createClientFromRequest } from 'npm:@base44/sdk@0.8.34';
import { jsonResponse as json, bytesToBase64Url, hashGuestToken } from '../../shared/onlineActorCrypto.ts';
import {
  STANDARD_RANDOM_MODE,
  SAME_QUESTION_DUEL_MODE,
  normalizeMatchmakingMode,
  readMatchmakingTime,
  isQueueRowExpired,
  selectOwnActiveQueueRow,
  selectCompatibleWaitingRow,
  selectCommittedPairingPeer,
  expiredWaitingRows,
  selectLiveLockWinner,
} from '../../shared/randomMatchmakingPolicy.js';

// Codex591 — Online Kapışma random matchmaking (RASTGELE EŞLEŞ).
// Backend-authoritative queue + pairing for linked and guest actors.
// Public responses never expose actor_key_hash, raw guest_id, email, or any
// other actor's identity — only the caller's own opaque queue_ref and,
// once matched, the matched Lobby's public_ref/code.

const RANDOM_MATCH_TIMEOUT_MS = 30 * 1000;
const MATCHED_HANDOFF_TTL_MS = 2 * 60 * 1000;
const PAIR_LOCK_TTL_MS = 8 * 1000;
const PAIRING_RECONCILE_GRACE_MS = 3 * 1000;
const QUEUE_READ_LIMIT = 100;
const LOCK_READ_LIMIT = 25;
const PAIR_READ_LIMIT = 10;
const INTERNAL_PAIRING_STATUS = 'pairing';
const MATCHMAKING_MODES = Object.freeze([STANDARD_RANDOM_MODE, SAME_QUESTION_DUEL_MODE]);
const SAFE_QUEUE_ACTIONS = new Set([
  'create_waiting',
  'find_waiting',
  'pair_waiting',
  'create_match',
  'direct_start',
  'poll_status',
  'cleanup_cancel',
  'cleanup_timeout',
]);
const normalizeMode = normalizeMatchmakingMode;
const KRONOX_ID_PATTERN = /^KX-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/;

const normalizeEmail = (value: unknown) => String(value ?? '').trim().toLowerCase();

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

const randomRef = (prefix: string) => `${prefix}_${bytesToBase64Url(crypto.getRandomValues(new Uint8Array(18)))}`;

const randomLobbyCode = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  for (let i = 0; i < 6; i += 1) code += chars[bytes[i] % chars.length];
  return code;
};

const safeCredentialText = (value: unknown, maxLength = 220) => {
  const text = String(value || '').trim();
  return text && text.length <= maxLength && /^[A-Za-z0-9_-]+$/.test(text) ? text : '';
};

const safeUsername = (value: unknown, seed: unknown) => {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (text && /^[A-Za-z0-9_]{3,24}$/.test(text) && !text.includes('@')) return text;
  const suffix = parseInt(stableOwnerKey('u', seed).replace(/^u_/, '') || '0', 36) || 0;
  return `KronoxUser${1000 + (suffix % 90000)}`;
};

const modeErrorCategory = (mode: string, suffix: string) => (
  `${mode === SAME_QUESTION_DUEL_MODE ? 'DUELLO' : 'ONLINE'}_${suffix}`
);

const safeDiagnostics = ({
  requestedMode,
  mode,
  action,
  actorKind = 'unknown',
  queueAction = 'find_waiting',
  selfMatchPrevented = false,
  staleQueueDetected = false,
  matchCreated = false,
  directGamePayloadAvailable = false,
  errorCategory = null,
}: any) => {
  const safeModeKeySent = MATCHMAKING_MODES.includes(requestedMode)
    ? requestedMode
    : (MATCHMAKING_MODES.includes(mode) ? mode : STANDARD_RANDOM_MODE);
  return ({
  modeKeySent: safeModeKeySent,
  canonicalModeKey: mode || STANDARD_RANDOM_MODE,
  queueScope: mode || STANDARD_RANDOM_MODE,
  queueAction: SAFE_QUEUE_ACTIONS.has(queueAction) ? queueAction : 'find_waiting',
  actorKind: actorKind === 'linked'
    ? 'authenticated'
    : (actorKind === 'guest' ? 'guest' : 'unknown'),
  selfMatchPrevented: Boolean(selfMatchPrevented),
  staleQueueDetected: Boolean(staleQueueDetected),
  matchedOpponentPublicSafe: Boolean(matchCreated),
  matchCreated: Boolean(matchCreated),
  directGamePayloadAvailable: Boolean(directGamePayloadAvailable),
  routeAfterMatch: mode === SAME_QUESTION_DUEL_MODE ? '/duel' : '/game',
  lobbyRouteObserved: false,
  errorCategory,
  requestAction: ['join', 'poll', 'cancel', 'consume'].includes(action) ? action : 'unknown',
  });
};

function classifyMatchmakingFailure(error: any, mode: string, action: string) {
  const message = String(error?.message || '').toLowerCase();
  if (message.includes('lock_unavailable')) return modeErrorCategory(mode, 'PAIRING_RACE');
  if (message.includes('permission') || message.includes('forbidden') || message.includes('unauthorized')) {
    return modeErrorCategory(mode, 'PERMISSION_DENIED');
  }
  if (message.includes('queue_create')) return modeErrorCategory(mode, 'QUEUE_CREATE_FAILED');
  if (message.includes('queue_') || message.includes('queue store')) return modeErrorCategory(mode, 'QUEUE_READ_FAILED');
  if (message.includes('pair_commit') || message.includes('pairing')) return modeErrorCategory(mode, 'PAIRING_RACE');
  if (message.includes('lobby_') || message.includes('session_')) return modeErrorCategory(mode, 'SESSION_CREATE_FAILED');
  if (action === 'join') return modeErrorCategory(mode, 'UNKNOWN_START_FAILURE');
  return modeErrorCategory(mode, 'NETWORK_FAILURE');
}

const isRecoverablePairingContention = (error: any) => (
  String(error?.message || '').includes('random_matchmaking_lock_unavailable')
);

async function resolveOnlineActor(base44: any, body: any, diagnosticContext: any = {}) {
  const user = await base44.auth.me().catch(() => null);
  const email = normalizeEmail(user?.email);
  if (email) {
    const rows = await base44.asServiceRole.entities.User.filter({ email }, '-updated_date', 1).catch(() => []);
    const profile = rows?.[0] || user;
    return {
      ok: true,
      actor: {
        playerType: 'linked',
        actorKeyHash: stableOwnerKey('u', email),
        email,
        kronoxUserId: normalizeKronoxUserId(profile?.kronox_user_id),
        username: safeUsername(profile?.username || profile?.public_username || profile?.display_name, email),
      },
    };
  }
  const guestId = safeCredentialText(body?.guest_id, 80);
  const guestToken = safeCredentialText(body?.guest_token, 220);
  if (!guestId.startsWith('guest_') || !guestToken) {
    const errorCategory = modeErrorCategory(diagnosticContext.mode, 'PERMISSION_DENIED');
    return { ok: false, response: json({
      error: 'Oyuncu oturumu doğrulanamadı.',
      code: 'unauthenticated',
      errorCategory,
      diagnostics: safeDiagnostics({ ...diagnosticContext, errorCategory }),
    }, 401) };
  }
  const rows = await base44.asServiceRole.entities.GuestProfile.filter({ guest_id: guestId }, '-created_at', 5).catch(() => []);
  const profile = rows?.[0] || null;
  const providedHash = await hashGuestToken(guestId, guestToken);
  if (!profile || !profile.guest_token_hash || String(profile.guest_token_hash) !== providedHash || String(profile.status || '') === 'linked') {
    const errorCategory = modeErrorCategory(diagnosticContext.mode, 'PERMISSION_DENIED');
    return { ok: false, response: json({
      error: 'Misafir oturumu doğrulanamadı.',
      code: 'invalid_guest_token',
      errorCategory,
      diagnostics: safeDiagnostics({ ...diagnosticContext, errorCategory }),
    }, 401) };
  }
  return {
    ok: true,
    actor: {
      playerType: 'guest',
      actorKeyHash: stableOwnerKey('g', guestId),
      email: '',
      kronoxUserId: normalizeKronoxUserId(profile?.kronox_user_id),
      username: safeUsername(profile?.username || profile?.display_name, guestId),
    },
  };
}

const readTime = readMatchmakingTime;
const isExpired = isQueueRowExpired;

const publicQueueState = (row: any, diagnosticContext: any = {}) => {
  const matched = row?.status === 'matched';
  return {
    queueRef: row?.queue_ref || '',
    mode: normalizeMode(row?.mode),
    status: matched ? 'matched' : 'waiting',
    expiresAt: row?.expires_at || null,
    serverNow: new Date().toISOString(),
    matched,
    lobbyRef: matched ? (row?.lobby_public_ref || '') : null,
    lobbyCode: matched ? (row?.lobby_code || '') : null,
    isHost: matched && Boolean(row?.is_host),
    diagnostics: safeDiagnostics({
      ...diagnosticContext,
      mode: normalizeMode(row?.mode || diagnosticContext?.mode),
      matchCreated: matched,
    }),
  };
};

// Mode-scoped pairing lock so two simultaneous "join" calls never claim the
// same waiting row while Duello and standard Online remain independent.
async function withPairingLock(base44: any, mode: string, fn: () => Promise<any>) {
  const entity = base44?.asServiceRole?.entities?.EconomyOperationLock;
  if (!entity?.filter || !entity?.create || !entity?.update) {
    throw new Error('random_matchmaking_lock_store_unavailable');
  }
  const lockKey = `random_matchmaking:pair:${mode}`;
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const now = new Date();
    // Newest-first avoids historical released lock rows starving the bounded
    // query window. Only live active rows participate in the lock election.
    const active = await entity.filter({ lock_key: lockKey, status: 'active' }, '-acquired_at', LOCK_READ_LIMIT);
    if (selectLiveLockWinner(active, now.getTime())) {
      await new Promise((resolve) => setTimeout(resolve, 90 + attempt * 80));
      continue;
    }
    const lock = await entity.create({
      lock_key: lockKey,
      actor_key: 'random_matchmaking',
      operation_scope: 'random_matchmaking_pair',
      operation_id: randomRef('rmm'),
      status: 'active',
      acquired_at: now.toISOString(),
      expires_at: new Date(now.getTime() + PAIR_LOCK_TTL_MS).toISOString(),
    }).catch(() => null);
    if (!lock) continue;
    await new Promise((resolve) => setTimeout(resolve, 70));
    const contenders = await entity.filter({ lock_key: lockKey, status: 'active' }, '-acquired_at', LOCK_READ_LIMIT);
    const winner = selectLiveLockWinner(contenders, Date.now());
    if (rowId(winner) !== rowId(lock)) {
      await entity.update(rowId(lock), { status: 'released', released_at: new Date().toISOString() }).catch(() => null);
      continue;
    }
    try {
      return await fn();
    } finally {
      await entity.update(rowId(lock), { status: 'released', released_at: new Date().toISOString() }).catch(() => null);
    }
  }
  throw new Error('random_matchmaking_lock_unavailable');
}

function queueStore(base44: any) {
  const entity = base44?.asServiceRole?.entities?.RandomMatchQueue;
  if (!entity?.filter || !entity?.create || !entity?.get || !entity?.update) {
    throw new Error('random_matchmaking_queue_store_unavailable');
  }
  return entity;
}

function lobbyStore(base44: any) {
  const entity = base44?.asServiceRole?.entities?.Lobby;
  if (!entity?.create || !entity?.update) {
    throw new Error('random_matchmaking_lobby_store_unavailable');
  }
  return entity;
}

async function findOwnActiveRow(base44: any, actorKeyHash: string, mode: string) {
  const rows = await queueStore(base44).filter(
    { actor_key_hash: actorKeyHash, mode },
    '-created_at',
    QUEUE_READ_LIMIT,
  );
  const selected = selectOwnActiveQueueRow(rows, actorKeyHash, mode);
  const duplicateWaitingRows = (rows || []).filter((row: any) => (
    rowId(row) !== rowId(selected)
    && row?.status === 'waiting'
    && normalizeMode(row?.mode) === mode
  ));
  await Promise.allSettled(duplicateWaitingRows.map((row: any) => queueStore(base44).update(rowId(row), {
    status: 'cancelled',
    cancelled_at: new Date().toISOString(),
  })));
  return selected;
}

async function createWaitingRow(base44: any, actor: any, mode: string) {
  const createdAt = new Date();
  try {
    return await queueStore(base44).create({
      queue_ref: randomRef('rmq'),
      actor_key_hash: actor.actorKeyHash,
      mode,
      player_type: actor.playerType,
      kronox_user_id: actor.kronoxUserId || undefined,
      public_username: actor.username,
      status: 'waiting',
      created_at: createdAt.toISOString(),
      expires_at: new Date(createdAt.getTime() + RANDOM_MATCH_TIMEOUT_MS).toISOString(),
    });
  } catch {
    const concurrent = await findOwnActiveRow(base44, actor.actorKeyHash, mode).catch(() => null);
    if (concurrent) return concurrent;
    throw new Error('random_matchmaking_queue_create_failed');
  }
}

async function ensureOwnQueueRow(base44: any, actor: any, mode: string) {
  const queue = queueStore(base44);
  let row = await findOwnActiveRow(base44, actor.actorKeyHash, mode);
  let staleQueueDetected = false;
  if (row && isExpired(row, Date.now())) {
    staleQueueDetected = true;
    await queue.update(rowId(row), { status: 'expired' });
    row = null;
  }
  if (!row) row = await createWaitingRow(base44, actor, mode);
  return { row, staleQueueDetected };
}

async function resolvePairingRow(base44: any, row: any, mode: string) {
  if (row?.status !== INTERNAL_PAIRING_STATUS) return row;
  const queue = queueStore(base44);
  const pairRows = await queue.filter(
    { lobby_id: String(row?.lobby_id || ''), mode },
    '-created_at',
    PAIR_READ_LIMIT,
  );
  const peer = selectCommittedPairingPeer(pairRows, row, mode);
  if (peer) return { ...row, status: 'matched' };
  const pairingStartedAt = readTime(row?.matched_at || row?.updated_date || row?.created_at);
  if (pairingStartedAt > 0 && Date.now() - pairingStartedAt < PAIRING_RECONCILE_GRACE_MS) {
    return row;
  }

  await queue.update(rowId(row), {
    status: 'waiting',
    lobby_id: '',
    lobby_public_ref: '',
    lobby_code: '',
    paired_actor_key_hash: '',
    is_host: false,
    expires_at: new Date(Date.now() + RANDOM_MATCH_TIMEOUT_MS).toISOString(),
  });
  if (row?.lobby_id) {
    await lobbyStore(base44).update(String(row.lobby_id), {
      status: 'cancelled',
      last_activity_at: new Date().toISOString(),
    }).catch(() => null);
  }
  return { ...row, status: 'waiting', lobby_id: '', lobby_public_ref: '', lobby_code: '' };
}

async function settleExpiredWaitingRows(base44: any, rows: any[], nowMs: number) {
  const expired = expiredWaitingRows(rows, nowMs);
  await Promise.allSettled(expired.map((row: any) => queueStore(base44).update(rowId(row), {
    status: 'expired',
  })));
}

async function pairWaitingRows(base44: any, actor: any, mode: string, ownRow: any, candidate: any) {
  const queue = queueStore(base44);
  const lobbies = lobbyStore(base44);
  const [freshOwn, freshCandidate] = await Promise.all([
    queue.get(rowId(ownRow)),
    queue.get(rowId(candidate)),
  ]);
  const nowMs = Date.now();
  if (freshOwn?.status === 'matched' && !isExpired(freshOwn, nowMs)) return freshOwn;
  if (
    freshOwn?.status !== 'waiting'
    || normalizeMode(freshOwn?.mode) !== mode
    || isExpired(freshOwn, nowMs)
    || freshCandidate?.status !== 'waiting'
    || normalizeMode(freshCandidate?.mode) !== mode
    || String(freshCandidate?.actor_key_hash || '') === actor.actorKeyHash
    || isExpired(freshCandidate, nowMs)
  ) {
    return freshOwn?.status === 'waiting' ? freshOwn : null;
  }

  const code = randomLobbyCode();
  const selfPlayer = {
    actor_key_hash: actor.actorKeyHash,
    participant_ref: randomRef('player'),
    player_type: actor.playerType,
    kronox_user_id: actor.kronoxUserId || undefined,
    name: actor.username,
    ready: true,
    cards: [],
  };
  const opponentPlayer = {
    actor_key_hash: freshCandidate.actor_key_hash,
    participant_ref: randomRef('player'),
    player_type: freshCandidate.player_type,
    kronox_user_id: freshCandidate.kronox_user_id || undefined,
    name: safeUsername(freshCandidate.public_username, freshCandidate.actor_key_hash),
    ready: true,
    cards: [],
  };
  const lobby = await lobbies.create({
    public_ref: randomRef('lobby'),
    code,
    host_actor_key_hash: actor.actorKeyHash,
    host_name: actor.username,
    game_mode: mode,
    players: [selfPlayer, opponentPlayer],
    status: 'waiting',
    selected_category_ids: [],
    max_players: 2,
    last_activity_at: new Date().toISOString(),
    state_revision: 0,
  }).catch(() => {
    throw new Error('random_matchmaking_session_create_failed');
  });

  const matchedAt = new Date();
  const matchedUntil = new Date(matchedAt.getTime() + MATCHED_HANDOFF_TTL_MS).toISOString();
  let candidateStaged = false;
  let ownStaged = false;
  try {
    await queue.update(rowId(freshCandidate), {
      status: INTERNAL_PAIRING_STATUS,
      lobby_id: rowId(lobby),
      lobby_public_ref: lobby.public_ref,
      lobby_code: lobby.code,
      is_host: false,
      paired_actor_key_hash: actor.actorKeyHash,
      matched_at: matchedAt.toISOString(),
      expires_at: matchedUntil,
    });
    candidateStaged = true;
    const stagedOwn = await queue.update(rowId(freshOwn), {
      status: INTERNAL_PAIRING_STATUS,
      lobby_id: rowId(lobby),
      lobby_public_ref: lobby.public_ref,
      lobby_code: lobby.code,
      is_host: true,
      paired_actor_key_hash: freshCandidate.actor_key_hash,
      matched_at: matchedAt.toISOString(),
      expires_at: matchedUntil,
    });
    ownStaged = true;

    // Reciprocal pairing is already committed. Finalize both rows best-effort;
    // a failed final status write remains safe because later reads verify the
    // reciprocal pairing row before deriving the public matched state.
    await Promise.allSettled([
      queue.update(rowId(freshCandidate), { status: 'matched' }),
      queue.update(rowId(freshOwn), { status: 'matched' }),
    ]);
    return {
      ...freshOwn,
      ...(stagedOwn || {}),
      status: 'matched',
      lobby_id: rowId(lobby),
      lobby_public_ref: lobby.public_ref,
      lobby_code: lobby.code,
      paired_actor_key_hash: freshCandidate.actor_key_hash,
      is_host: true,
      matched_at: matchedAt.toISOString(),
      expires_at: matchedUntil,
    };
  } catch (error) {
    if (candidateStaged) {
      await queue.update(rowId(freshCandidate), {
        status: 'waiting',
        lobby_id: '',
        lobby_public_ref: '',
        lobby_code: '',
        paired_actor_key_hash: '',
        is_host: false,
        expires_at: new Date(Date.now() + RANDOM_MATCH_TIMEOUT_MS).toISOString(),
      }).catch(() => null);
    }
    if (ownStaged) {
      await queue.update(rowId(freshOwn), {
        status: 'waiting',
        lobby_id: '',
        lobby_public_ref: '',
        lobby_code: '',
        paired_actor_key_hash: '',
        is_host: false,
        expires_at: new Date(Date.now() + RANDOM_MATCH_TIMEOUT_MS).toISOString(),
      }).catch(() => null);
    }
    await lobbies.update(rowId(lobby), {
      status: 'cancelled',
      last_activity_at: new Date().toISOString(),
    }).catch(() => null);
    throw new Error(`random_matchmaking_pair_commit_failed:${String(error?.name || 'error')}`);
  }
}

async function reconcileWaitingActor(base44: any, actor: any, mode: string, createIfMissing: boolean) {
  const queue = queueStore(base44);
  let ownRow = await findOwnActiveRow(base44, actor.actorKeyHash, mode);
  if (ownRow?.status === INTERNAL_PAIRING_STATUS && !isExpired(ownRow, Date.now())) {
    return resolvePairingRow(base44, ownRow, mode);
  }
  if (ownRow?.status === 'matched' && !isExpired(ownRow, Date.now())) return ownRow;
  if (!ownRow && !createIfMissing) return null;
  if (!ownRow) ownRow = await createWaitingRow(base44, actor, mode);

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const waitingRows = await queue.filter(
      { status: 'waiting', mode },
      '-created_at',
      QUEUE_READ_LIMIT,
    );
    await settleExpiredWaitingRows(base44, waitingRows, Date.now());
    const candidate = selectCompatibleWaitingRow(waitingRows, actor.actorKeyHash, mode, Date.now());
    if (!candidate) return ownRow;
    const paired = await pairWaitingRows(base44, actor, mode, ownRow, candidate);
    if (paired?.status === 'matched') return paired;
  }
  return ownRow;
}

async function handleJoin(base44: any, actor: any, mode: string, diagnosticContext: any) {
  const admitted = await ensureOwnQueueRow(base44, actor, mode);
  if (admitted.row?.status === 'matched' && !isExpired(admitted.row, Date.now())) {
    return json({
      ok: true,
      ...publicQueueState(admitted.row, {
        ...diagnosticContext,
        queueAction: 'direct_start',
        staleQueueDetected: admitted.staleQueueDetected,
      }),
    });
  }

  try {
    const row = await withPairingLock(base44, mode, () => (
      reconcileWaitingActor(base44, actor, mode, false)
    ));
    return json({
      ok: true,
      ...publicQueueState(row || admitted.row, {
        ...diagnosticContext,
        queueAction: row?.status === 'matched' ? 'create_match' : 'find_waiting',
        selfMatchPrevented: true,
        staleQueueDetected: admitted.staleQueueDetected,
      }),
    });
  } catch (error) {
    if (!isRecoverablePairingContention(error)) throw error;
    return json({
      ok: true,
      recoverable: true,
      ...publicQueueState(admitted.row, {
        ...diagnosticContext,
        queueAction: 'find_waiting',
        selfMatchPrevented: true,
        staleQueueDetected: admitted.staleQueueDetected,
        errorCategory: modeErrorCategory(mode, 'PAIRING_RACE'),
      }),
    });
  }
}

async function handlePoll(base44: any, actor: any, mode: string, diagnosticContext: any) {
  const row = await findOwnActiveRow(base44, actor.actorKeyHash, mode);
  if (!row) return json({
    ok: true,
    status: 'timeout',
    queueRef: '',
    matched: false,
    diagnostics: safeDiagnostics({ ...diagnosticContext, queueAction: 'poll_status' }),
  });
  if (row.status === 'matched' && !isExpired(row, Date.now())) {
    return json({ ok: true, ...publicQueueState(row, { ...diagnosticContext, queueAction: 'direct_start' }) });
  }
  if (isExpired(row, Date.now())) {
    await queueStore(base44).update(rowId(row), { status: 'expired' });
    return json({
      ok: true,
      status: 'timeout',
      queueRef: row.queue_ref || '',
      matched: false,
      diagnostics: safeDiagnostics({
        ...diagnosticContext,
        queueAction: 'cleanup_timeout',
        staleQueueDetected: true,
        errorCategory: modeErrorCategory(mode, 'TIMEOUT'),
      }),
    });
  }
  try {
    const reconciled = await withPairingLock(base44, mode, () => (
      reconcileWaitingActor(base44, actor, mode, false)
    ));
    return reconciled
      ? json({
        ok: true,
        ...publicQueueState(reconciled, {
          ...diagnosticContext,
          queueAction: reconciled?.status === 'matched' ? 'pair_waiting' : 'poll_status',
          selfMatchPrevented: true,
        }),
      })
      : json({
        ok: true,
        status: 'timeout',
        queueRef: '',
        matched: false,
        diagnostics: safeDiagnostics({ ...diagnosticContext, queueAction: 'poll_status' }),
      });
  } catch (error) {
    if (!isRecoverablePairingContention(error)) throw error;
    return json({
      ok: true,
      recoverable: true,
      ...publicQueueState(row, {
        ...diagnosticContext,
        queueAction: 'poll_status',
        selfMatchPrevented: true,
        errorCategory: modeErrorCategory(mode, 'PAIRING_RACE'),
      }),
    });
  }
}

async function handleCancel(base44: any, actor: any, mode: string, diagnosticContext: any) {
  let result = { ok: true, cancelled: true };
  await withPairingLock(base44, mode, async () => {
    let row = await findOwnActiveRow(base44, actor.actorKeyHash, mode);
    if (!row) return;
    if (row.status === INTERNAL_PAIRING_STATUS && !isExpired(row, Date.now())) {
      row = await resolvePairingRow(base44, row, mode);
    }
    if (row.status === 'matched' && !isExpired(row, Date.now())) {
      result = {
        ok: true,
        cancelled: false,
        ...publicQueueState(row, { ...diagnosticContext, queueAction: 'direct_start' }),
      };
      return;
    }
    if (row.status === 'matched') {
      await queueStore(base44).update(rowId(row), { status: 'expired' });
      return;
    }
    if (row.status !== 'waiting') return;
    await queueStore(base44).update(rowId(row), {
      status: 'cancelled',
      cancelled_at: new Date().toISOString(),
    });
  });
  return json({
    ...result,
    diagnostics: result?.diagnostics || safeDiagnostics({ ...diagnosticContext, queueAction: 'cleanup_cancel' }),
  });
}

async function handleConsume(base44: any, actor: any, mode: string, diagnosticContext: any) {
  await withPairingLock(base44, mode, async () => {
    const row = await findOwnActiveRow(base44, actor.actorKeyHash, mode);
    if (!row || !['matched', INTERNAL_PAIRING_STATUS].includes(row.status)) return;
    await queueStore(base44).update(rowId(row), {
      status: 'consumed',
      consumed_at: new Date().toISOString(),
    });
  });
  return json({
    ok: true,
    consumed: true,
    diagnostics: safeDiagnostics({
      ...diagnosticContext,
      queueAction: 'direct_start',
      matchCreated: true,
      directGamePayloadAvailable: true,
    }),
  });
}

Deno.serve(async (req) => {
  let diagnosticContext: any = {
    requestedMode: STANDARD_RANDOM_MODE,
    mode: STANDARD_RANDOM_MODE,
    action: 'unknown',
    actorKind: 'unknown',
  };
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || 'join');
    const requestedMode = String(body?.mode || STANDARD_RANDOM_MODE).trim().toLowerCase();
    diagnosticContext = { ...diagnosticContext, requestedMode, action };
    if (!MATCHMAKING_MODES.includes(requestedMode)) {
      return json({
        error: 'Geçersiz eşleşme modu.',
        code: 'invalid_matchmaking_mode',
        errorCategory: 'INVALID_MATCHMAKING_MODE',
        diagnostics: safeDiagnostics(diagnosticContext),
      }, 400);
    }
    const mode = normalizeMode(requestedMode);
    diagnosticContext = { ...diagnosticContext, mode };

    const resolved = await resolveOnlineActor(base44, body, diagnosticContext);
    if (!resolved.ok) return resolved.response;
    const actor = resolved.actor;
    diagnosticContext = { ...diagnosticContext, actorKind: actor.playerType };

    if (action === 'join') return await handleJoin(base44, actor, mode, diagnosticContext);
    if (action === 'poll') return await handlePoll(base44, actor, mode, diagnosticContext);
    if (action === 'cancel') return await handleCancel(base44, actor, mode, diagnosticContext);
    if (action === 'consume') return await handleConsume(base44, actor, mode, diagnosticContext);
    return json({
      error: 'Geçersiz işlem.',
      code: 'invalid_matchmaking_action',
      errorCategory: 'INVALID_MATCHMAKING_ACTION',
      diagnostics: safeDiagnostics(diagnosticContext),
    }, 400);
  } catch (error) {
    const errorCategory = classifyMatchmakingFailure(
      error,
      diagnosticContext.mode,
      diagnosticContext.action,
    );
    const unavailable = errorCategory.endsWith('_PAIRING_RACE')
      || String(error?.message || '').includes('_unavailable');
    console.error('[randomMatchmaking] classified failure', JSON.stringify({
      errorCategory,
      canonicalModeKey: diagnosticContext.mode,
      requestAction: diagnosticContext.action,
      actorKind: diagnosticContext.actorKind,
    }));
    return json({
      error: unavailable
        ? 'Eşleşme servisine ulaşılamadı. Lütfen tekrar dene.'
        : 'Eşleşme tamamlanamadı. Lütfen tekrar dene.',
      code: unavailable ? 'matchmaking_unavailable' : 'matchmaking_failed',
      errorCategory,
      diagnostics: safeDiagnostics({
        ...diagnosticContext,
        queueAction: diagnosticContext.action === 'join' ? 'create_waiting' : 'poll_status',
        errorCategory,
      }),
    }, unavailable ? 503 : 500);
  }
});
