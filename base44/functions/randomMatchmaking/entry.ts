import { createClientFromRequest } from 'npm:@base44/sdk@0.8.34';
import { jsonResponse as json, bytesToBase64Url, hashGuestToken } from '../../shared/onlineActorCrypto.ts';

// Codex591 — Online Kapışma random matchmaking (RASTGELE EŞLEŞ).
// Backend-authoritative queue + pairing for linked and guest actors.
// Public responses never expose actor_key_hash, raw guest_id, email, or any
// other actor's identity — only the caller's own opaque queue_ref and,
// once matched, the matched Lobby's public_ref/code.

const RANDOM_MATCH_TIMEOUT_MS = 30 * 1000;
const PAIR_LOCK_TTL_MS = 8 * 1000;
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

async function resolveOnlineActor(base44: any, body: any) {
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
    actor: {
      playerType: 'guest',
      actorKeyHash: stableOwnerKey('g', guestId),
      email: '',
      kronoxUserId: normalizeKronoxUserId(profile?.kronox_user_id),
      username: safeUsername(profile?.username || profile?.display_name, guestId),
    },
  };
}

const readTime = (value: unknown) => {
  const text = String(value || '').trim();
  if (!text) return NaN;
  return Date.parse(/(?:Z|[+-]\d{2}:?\d{2})$/i.test(text) ? text : `${text}Z`);
};

const isExpired = (row: any, nowMs: number) => {
  const expiresAt = readTime(row?.expires_at);
  return Number.isFinite(expiresAt) && expiresAt <= nowMs;
};

const publicQueueState = (row: any) => ({
  queueRef: row?.queue_ref || '',
  status: row?.status || 'waiting',
  expiresAt: row?.expires_at || null,
  matched: row?.status === 'matched',
  lobbyRef: row?.status === 'matched' ? (row?.lobby_public_ref || '') : null,
  lobbyCode: row?.status === 'matched' ? (row?.lobby_code || '') : null,
  isHost: Boolean(row?.is_host),
});

// Global pairing lock so two simultaneous "join" calls never claim the same
// waiting row. Volume for random matchmaking is expected to be low, so a
// single serialized critical section is a safe, simple correctness guard.
async function withPairingLock(base44: any, fn: () => Promise<any>) {
  const entity = base44.asServiceRole.entities.EconomyOperationLock;
  const lockKey = 'random_matchmaking:pair';
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const now = new Date();
    const active = await entity.filter({ lock_key: lockKey }, 'acquired_at', 10).catch(() => []);
    if ((active || []).some((row: any) => String(row?.status) === 'active' && readTime(row?.expires_at) > now.getTime())) {
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
    const contenders = await entity.filter({ lock_key: lockKey }, 'acquired_at', 10).catch(() => []);
    const winner = (contenders || [])
      .filter((row: any) => String(row?.status) === 'active' && readTime(row?.expires_at) > Date.now())
      .sort((a: any, b: any) => (readTime(a?.acquired_at) - readTime(b?.acquired_at)) || String(rowId(a)).localeCompare(String(rowId(b))))[0];
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

async function findOwnActiveRow(base44: any, actorKeyHash: string) {
  const rows = await base44.asServiceRole.entities.RandomMatchQueue
    .filter({ actor_key_hash: actorKeyHash }, '-created_at', 5)
    .catch(() => []);
  return (rows || []).find((row: any) => row.status === 'waiting' || row.status === 'matched') || null;
}

async function handleJoin(base44: any, actor: any) {
  const nowMs = Date.now();

  // Idempotent: if the actor already has an active (waiting/matched) row,
  // return it instead of creating a duplicate queue entry.
  const existing = await findOwnActiveRow(base44, actor.actorKeyHash);
  if (existing && !isExpired(existing, nowMs)) {
    return json({ ok: true, ...publicQueueState(existing) });
  }
  if (existing && isExpired(existing, nowMs)) {
    await base44.asServiceRole.entities.RandomMatchQueue.update(rowId(existing), { status: 'expired' }).catch(() => null);
  }

  return withPairingLock(base44, async () => {
    // Look for another actor's fresh waiting row.
    const waitingRows = await base44.asServiceRole.entities.RandomMatchQueue
      .filter({ status: 'waiting' }, 'created_at', 50)
      .catch(() => []);
    const candidate = (waitingRows || []).find((row: any) =>
      String(row?.actor_key_hash || '') !== actor.actorKeyHash && !isExpired(row, Date.now()));

    if (!candidate) {
      const createdAt = new Date();
      const created = await base44.asServiceRole.entities.RandomMatchQueue.create({
        queue_ref: randomRef('rmq'),
        actor_key_hash: actor.actorKeyHash,
        player_type: actor.playerType,
        kronox_user_id: actor.kronoxUserId || undefined,
        status: 'waiting',
        created_at: createdAt.toISOString(),
        expires_at: new Date(createdAt.getTime() + RANDOM_MATCH_TIMEOUT_MS).toISOString(),
      });
      return json({ ok: true, ...publicQueueState(created) });
    }

    // Re-verify the candidate is still actually waiting before claiming it
    // (defense against a race won by another concurrent lock holder).
    const freshCandidate = await base44.asServiceRole.entities.RandomMatchQueue.get(rowId(candidate)).catch(() => null);
    if (!freshCandidate || freshCandidate.status !== 'waiting' || isExpired(freshCandidate, Date.now())) {
      const createdAt = new Date();
      const created = await base44.asServiceRole.entities.RandomMatchQueue.create({
        queue_ref: randomRef('rmq'),
        actor_key_hash: actor.actorKeyHash,
        player_type: actor.playerType,
        kronox_user_id: actor.kronoxUserId || undefined,
        status: 'waiting',
        created_at: createdAt.toISOString(),
        expires_at: new Date(createdAt.getTime() + RANDOM_MATCH_TIMEOUT_MS).toISOString(),
      });
      return json({ ok: true, ...publicQueueState(created) });
    }

    // Pair. The actor performing this join call becomes host of the new
    // Lobby (it is the side that will call startLobbyGame once it navigates
    // to the waiting screen). Online has no category selection — the Lobby
    // is created with no selected_category_ids so startLobbyGame draws from
    // all active categories.
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
      name: safeUsername(null, freshCandidate.actor_key_hash),
      ready: true,
      cards: [],
    };
    const lobby = await base44.asServiceRole.entities.Lobby.create({
      public_ref: randomRef('lobby'),
      code,
      host_actor_key_hash: actor.actorKeyHash,
      host_name: actor.username,
      players: [selfPlayer, opponentPlayer],
      status: 'waiting',
      selected_category_ids: [],
      max_players: 2,
      last_activity_at: new Date().toISOString(),
      state_revision: 0,
    });

    const matchedAt = new Date().toISOString();
    await base44.asServiceRole.entities.RandomMatchQueue.update(rowId(freshCandidate), {
      status: 'matched',
      lobby_id: rowId(lobby),
      lobby_public_ref: lobby.public_ref,
      lobby_code: lobby.code,
      is_host: false,
      paired_actor_key_hash: actor.actorKeyHash,
      matched_at: matchedAt,
    });

    const selfCreatedAt = new Date();
    const selfRow = await base44.asServiceRole.entities.RandomMatchQueue.create({
      queue_ref: randomRef('rmq'),
      actor_key_hash: actor.actorKeyHash,
      player_type: actor.playerType,
      kronox_user_id: actor.kronoxUserId || undefined,
      status: 'matched',
      lobby_id: rowId(lobby),
      lobby_public_ref: lobby.public_ref,
      lobby_code: lobby.code,
      is_host: true,
      paired_actor_key_hash: freshCandidate.actor_key_hash,
      created_at: selfCreatedAt.toISOString(),
      expires_at: new Date(selfCreatedAt.getTime() + RANDOM_MATCH_TIMEOUT_MS).toISOString(),
      matched_at: matchedAt,
    });

    return json({ ok: true, ...publicQueueState(selfRow) });
  });
}

async function handlePoll(base44: any, actor: any) {
  const row = await findOwnActiveRow(base44, actor.actorKeyHash);
  if (!row) return json({ ok: true, status: 'timeout', queueRef: '', matched: false });
  if (row.status === 'waiting' && isExpired(row, Date.now())) {
    await base44.asServiceRole.entities.RandomMatchQueue.update(rowId(row), { status: 'expired' }).catch(() => null);
    return json({ ok: true, status: 'timeout', queueRef: row.queue_ref || '', matched: false });
  }
  return json({ ok: true, ...publicQueueState(row) });
}

async function handleCancel(base44: any, actor: any) {
  const row = await findOwnActiveRow(base44, actor.actorKeyHash);
  if (!row || row.status !== 'waiting') return json({ ok: true, cancelled: true });
  await base44.asServiceRole.entities.RandomMatchQueue.update(rowId(row), {
    status: 'cancelled',
    cancelled_at: new Date().toISOString(),
  });
  return json({ ok: true, cancelled: true });
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || 'join');

    const resolved = await resolveOnlineActor(base44, body);
    if (!resolved.ok) return resolved.response;
    const actor = resolved.actor;

    if (action === 'join') return await handleJoin(base44, actor);
    if (action === 'poll') return await handlePoll(base44, actor);
    if (action === 'cancel') return await handleCancel(base44, actor);
    return json({ error: 'Geçersiz işlem.' }, 400);
  } catch (error) {
    console.error('[randomMatchmaking] failed:', error);
    return json({ error: 'Rastgele eşleşme işlenemedi.' }, 500);
  }
});