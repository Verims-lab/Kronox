import { createClientFromRequest } from 'npm:@base44/sdk@0.8.34';

const DAILY_WHEEL_SOURCE = 'daily_wheel';
const STREAK_BONUS_AMOUNT = 150;
const DAY_MS = 24 * 60 * 60 * 1000;
const GUEST_ID_PREFIX = 'guest_';
const ECONOMY_LOCK_TTL_MS = 8_000;
const ECONOMY_LOCK_SETTLE_MS = 80;

const REWARD_TABLE = [
  { amount: 30, rarity: 'high', weight: 24 },
  { amount: 40, rarity: 'high', weight: 22 },
  { amount: 50, rarity: 'high', weight: 20 },
  { amount: 60, rarity: 'medium', weight: 12 },
  { amount: 75, rarity: 'medium', weight: 10 },
  { amount: 100, rarity: 'low', weight: 7 },
  { amount: 150, rarity: 'rare', weight: 4 },
  { amount: 250, rarity: 'very_rare', weight: 1 },
];

function json(payload: unknown, status = 200) {
  return Response.json(payload, { status });
}

function normalizeEmail(value: unknown) {
  return String(value || '').trim().toLowerCase();
}

function normalizeNumber(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.floor(number)) : 0;
}

function utcDateKey(now = new Date()) {
  return now.toISOString().slice(0, 10);
}

function nextUtcMidnightIso(dateKey: string) {
  const start = Date.parse(`${dateKey}T00:00:00.000Z`);
  return new Date(start + DAY_MS).toISOString();
}

function previousUtcDateKey(dateKey: string) {
  const start = Date.parse(`${dateKey}T00:00:00.000Z`);
  return new Date(start - DAY_MS).toISOString().slice(0, 10);
}

function buildIdempotencyKey(email: string, dateKey: string) {
  return `daily_wheel:${email}:${dateKey}`;
}

function rowId(row: any) {
  return String(row?.id || row?._id || '');
}

function currentIso() {
  return new Date().toISOString();
}

function safeLockText(value: unknown, maxLength = 220) {
  const text = String(value || '').trim();
  return text ? text.slice(0, maxLength) : '';
}

function isSameRow(a: any, b: any) {
  const left = rowId(a);
  const right = rowId(b);
  if (left && right) return left === right;
  return Boolean(a?.operation_id && b?.operation_id && a.operation_id === b.operation_id && a.actor_key === b.actor_key);
}

function economyOperationLockEntity(base44: any) {
  const serviceEntity = base44?.asServiceRole?.entities ? base44.asServiceRole.entities.EconomyOperationLock : null;
  const authEntity = base44?.entities ? base44.entities.EconomyOperationLock : null;
  return serviceEntity || authEntity;
}

function userEntity(base44: any) {
  const serviceEntity = base44?.asServiceRole?.entities ? base44.asServiceRole.entities.User : null;
  const authEntity = base44?.entities ? base44.entities.User : null;
  return serviceEntity || authEntity;
}

function dailyWheelSpinEntity(base44: any) {
  const serviceEntity = base44?.asServiceRole?.entities ? base44.asServiceRole.entities.DailyWheelSpin : null;
  const authEntity = base44?.entities ? base44.entities.DailyWheelSpin : null;
  return serviceEntity || authEntity;
}

function diamondTransactionEntity(base44: any, player: any = null) {
  const serviceEntity = base44?.asServiceRole?.entities ? base44.asServiceRole.entities.DiamondTransaction : null;
  const authEntity = base44?.entities ? base44.entities.DiamondTransaction : null;
  return player?.isGuest ? serviceEntity : (authEntity || serviceEntity);
}

function buildEconomyLockKey(actorKey: string) {
  return `economy:user:${actorKey}`;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isActiveEconomyLock(row: any, nowMs: number) {
  if (String(row?.status || '') !== 'active') return false;
  const expiresMs = Date.parse(String(row?.expires_at || ''));
  return Number.isFinite(expiresMs) ? expiresMs > nowMs : true;
}

function selectCanonicalEconomyLock(rows: any[], nowMs: number) {
  return rows
    .filter((row) => isActiveEconomyLock(row, nowMs))
    .sort((a, b) => {
      const acquiredDiff = Date.parse(String(a?.acquired_at || '')) - Date.parse(String(b?.acquired_at || ''));
      if (Number.isFinite(acquiredDiff) && acquiredDiff !== 0) return acquiredDiff;
      return String(rowId(a) || a?.operation_id || '').localeCompare(String(rowId(b) || b?.operation_id || ''));
    })[0] || null;
}

async function findEconomyLocks(base44: any, lockKey: string) {
  const entity = economyOperationLockEntity(base44);
  if (!entity?.filter) return [];
  const rows = await entity.filter({ lock_key: lockKey }, '-acquired_at', 25).catch(() => []);
  return Array.isArray(rows) ? rows : [];
}

async function markExpiredEconomyLocks(base44: any, lockKey: string, nowMs: number) {
  const entity = economyOperationLockEntity(base44);
  if (!entity?.update) return;
  const now = new Date(nowMs).toISOString();
  const rows = await findEconomyLocks(base44, lockKey);
  await Promise.all(rows
    .filter((row) => String(row?.status || '') === 'active')
    .filter((row) => {
      const expiresMs = Date.parse(String(row?.expires_at || ''));
      return Number.isFinite(expiresMs) && expiresMs <= nowMs;
    })
    .map((row) => entity.update(rowId(row), {
      status: 'stale',
      released_at: now,
      metadata: {
        ...(row?.metadata && typeof row.metadata === 'object' ? row.metadata : {}),
        staleRecovery: true,
      },
    }).catch(() => null)));
}

async function releaseEconomyOperationLock(base44: any, lock: any, status = 'released') {
  const entity = economyOperationLockEntity(base44);
  const id = rowId(lock);
  if (!entity?.update || !id) return;
  await entity.update(id, {
    status,
    released_at: currentIso(),
  }).catch(() => null);
}

async function acquireEconomyOperationLock(base44: any, lockKey: string, context: Record<string, unknown>) {
  const entity = economyOperationLockEntity(base44);
  if (!entity?.filter || !entity?.create || !entity?.update) {
    return { ok: false, code: 'economy_lock_unavailable', lock: null };
  }
  const now = currentIso();
  const nowMs = Date.parse(now);
  await markExpiredEconomyLocks(base44, lockKey, nowMs);
  const existing = selectCanonicalEconomyLock(await findEconomyLocks(base44, lockKey), nowMs);
  if (existing) return { ok: false, code: 'economy_operation_in_progress', lock: existing };

  const created = await entity.create({
    lock_key: lockKey,
    actor_key: safeLockText(context.actorKey),
    operation_scope: safeLockText(context.operationScope, 80),
    operation_id: safeLockText(context.operationId),
    status: 'active',
    acquired_at: now,
    expires_at: new Date(nowMs + ECONOMY_LOCK_TTL_MS).toISOString(),
    metadata: {
      phase: 'economy_parallel_race_guard_phase_1',
      ttlMs: ECONOMY_LOCK_TTL_MS,
      ...(context.metadata && typeof context.metadata === 'object' ? context.metadata : {}),
    },
  });
  await sleep(ECONOMY_LOCK_SETTLE_MS);
  const canonical = selectCanonicalEconomyLock(await findEconomyLocks(base44, lockKey), Date.now());
  if (!isSameRow(canonical, created)) {
    await releaseEconomyOperationLock(base44, created, 'released');
    return { ok: false, code: 'economy_operation_in_progress', lock: canonical };
  }
  return { ok: true, code: 'locked', lock: created };
}

async function withEconomyOperationLock(base44: any, lockKey: string, context: Record<string, unknown>, callback: () => Promise<Response>) {
  const lockResult = await acquireEconomyOperationLock(base44, lockKey, context);
  if (!lockResult.ok) {
    return json({
      ok: false,
      code: lockResult.code,
      error: 'Ekonomi işlemi işleniyor. Lütfen tekrar dene.',
    }, 409);
  }
  try {
    return await callback();
  } finally {
    await releaseEconomyOperationLock(base44, lockResult.lock);
  }
}

function spinSortValue(row: any) {
  const timestamp = Date.parse(String(row?.claimed_at || row?.created_at || ''));
  return Number.isFinite(timestamp) ? timestamp : Number.MAX_SAFE_INTEGER;
}

function compareSpinRows(a: any, b: any) {
  const byTime = spinSortValue(a) - spinSortValue(b);
  if (byTime) return byTime;
  return rowId(a).localeCompare(rowId(b));
}

function dedupeSpinRows(rows: any[]) {
  const seen = new Set<string>();
  return rows
    .filter((row) => {
      const id = rowId(row);
      if (!id || seen.has(id)) return false;
      seen.add(id);
      return true;
    })
    .sort(compareSpinRows);
}

function ownerKeyFromEmail(rawEmail: unknown) {
  const email = normalizeEmail(rawEmail);
  if (!email) return '';

  let hash = 2166136261;
  for (let i = 0; i < email.length; i += 1) {
    hash ^= email.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `u_${(hash >>> 0).toString(36)}`;
}

function safeCredentialText(value: unknown, maxLength = 180) {
  const text = String(value || '').trim();
  if (!text || text.length > maxLength) return '';
  return /^[A-Za-z0-9_-]+$/.test(text) ? text : '';
}

function normalizeGuestId(value: unknown) {
  const text = safeCredentialText(value, 80);
  return text.startsWith(GUEST_ID_PREFIX) ? text : '';
}

function normalizeGuestToken(value: unknown) {
  return safeCredentialText(value, 220);
}

function ownerKeyFromGuestId(rawGuestId: unknown) {
  const guestId = String(rawGuestId || '').trim().toLowerCase();
  if (!guestId) return '';
  let hash = 2166136261;
  for (let i = 0; i < guestId.length; i += 1) {
    hash ^= guestId.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `g_${(hash >>> 0).toString(36)}`;
}

function guestPlayerKey(guestId: string) {
  const ownerKey = ownerKeyFromGuestId(guestId);
  return ownerKey ? `guest:${ownerKey}` : '';
}

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = '';
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

async function sha256Base64Url(input: string) {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return bytesToBase64Url(new Uint8Array(digest));
}

async function hashGuestToken(guestId: string, guestToken: string) {
  return sha256Base64Url(`kronox_guest_v1:${guestId}:${guestToken}`);
}

function isGuestProfileComplete(row: any) {
  const status = String(row?.onboarding_status || '').trim();
  if (status === 'onboarding_complete' || status === 'completed') return true;
  const profileCompleted = String(row?.profile_setup_status || '').trim() === 'completed' || Boolean(row?.profile_setup_completed_at);
  const categoryCompleted = String(row?.category_setup_status || '').trim() === 'completed' ||
    Boolean(row?.category_setup_completed_at || row?.onboarding_completed_at);
  return Boolean(profileCompleted && categoryCompleted);
}

async function findGuestProfile(base44: any, guestId: string) {
  const entity = base44?.asServiceRole?.entities?.GuestProfile || base44?.entities?.GuestProfile;
  if (!entity?.filter || !guestId) return null;
  const rows = await entity.filter({ guest_id: guestId }, '-created_at', 5).catch(() => []);
  return Array.isArray(rows) && rows.length ? rows[0] : null;
}

async function resolveDailyWheelPlayer(base44: any, body: any) {
  const user = await base44.auth.me().catch(() => null);
  const email = normalizeEmail(user?.email || user?.user_email);
  if (email && rowId(user)) {
    return {
      ok: true,
      isGuest: false,
      row: user,
      rowId: rowId(user),
      playerKey: email,
      ownerKey: ownerKeyFromEmail(email),
      response: null,
    };
  }

  const guestId = normalizeGuestId(body?.guest_id);
  const guestToken = normalizeGuestToken(body?.guest_token);
  if (!guestId || !guestToken) {
    return { ok: false, response: json({ ok: false, code: 'unauthenticated', error: 'Günlük Çark için profilini tamamlamalısın.' }, 401) };
  }
  const guest = await findGuestProfile(base44, guestId);
  const expectedHash = String(guest?.guest_token_hash || '');
  const providedHash = await hashGuestToken(guestId, guestToken);
  if (!guest || !expectedHash || expectedHash !== providedHash) {
    return { ok: false, response: json({ ok: false, code: 'invalid_guest_token', error: 'Misafir oturumu doğrulanamadı.' }, 401) };
  }
  if (String(guest?.status || '') === 'linked' || !isGuestProfileComplete(guest)) {
    return { ok: false, response: json({ ok: false, code: 'guest_profile_incomplete', error: 'Günlük Çark için profilini tamamlamalısın.' }, 403) };
  }
  return {
    ok: true,
    isGuest: true,
    row: guest,
    rowId: rowId(guest),
    playerKey: guestPlayerKey(guestId),
    ownerKey: ownerKeyFromGuestId(guestId),
    response: null,
  };
}

async function updateDailyWheelPlayer(base44: any, player: any, patch: Record<string, unknown>) {
  if (!player?.rowId) return null;
  if (player.isGuest) {
    const entity = base44?.asServiceRole?.entities?.GuestProfile || base44?.entities?.GuestProfile;
    if (!entity?.update) throw new Error('daily_wheel_guest_update_unavailable');
    return entity.update(player.rowId, {
      ...patch,
      last_seen_at: String(patch.economy_updated_at || new Date().toISOString()),
      metadata: {
        ...(player.row?.metadata && typeof player.row.metadata === 'object' ? player.row.metadata : {}),
        guestDailyWheelEnabled: true,
        rawGuestTokenServerStored: false,
      },
    });
  }
  const entity = userEntity(base44);
  if (!entity?.update) throw new Error('daily_wheel_user_update_unavailable');
  return entity.update(player.rowId, patch);
}

function randomUnit() {
  const bytes = new Uint32Array(1);
  crypto.getRandomValues(bytes);
  return bytes[0] / 0xffffffff;
}

function selectReward() {
  const total = REWARD_TABLE.reduce((sum, row) => sum + row.weight, 0);
  let cursor = randomUnit() * total;
  for (const row of REWARD_TABLE) {
    cursor -= row.weight;
    if (cursor <= 0) return row;
  }
  return REWARD_TABLE[0];
}

function computeStreak(user: any, todayKey: string) {
  const previousDate = previousUtcDateKey(todayKey);
  const lastDate = String(user?.daily_wheel_last_spin_date || '');
  const current = normalizeNumber(user?.daily_wheel_streak);
  const streakBefore = lastDate === previousDate ? current : 0;
  const streakAfter = streakBefore + 1;
  return { streakBefore, streakAfter };
}

async function findSpinRows(base44: any, email: string, dateKey: string, idempotencyKey: string) {
  const entity = dailyWheelSpinEntity(base44);
  if (!entity?.filter) return [];
  const [byKey, byDate] = await Promise.all([
    entity.filter({ user_email: email, idempotency_key: idempotencyKey }, '-claimed_at', 5).catch(() => []),
    entity.filter({ user_email: email, spin_date: dateKey }, '-claimed_at', 5).catch(() => []),
  ]);
  const rows = [...(Array.isArray(byKey) ? byKey : []), ...(Array.isArray(byDate) ? byDate : [])];
  return dedupeSpinRows(rows);
}

async function findSpin(base44: any, email: string, dateKey: string, idempotencyKey: string) {
  const rows = await findSpinRows(base44, email, dateKey, idempotencyKey);
  return rows[0] || null;
}

async function findDiamondTransaction(base44: any, playerOrEmail: any, idempotencyKey: string) {
  const player = playerOrEmail && typeof playerOrEmail === 'object' ? playerOrEmail : null;
  const email = normalizeEmail(player?.playerKey || playerOrEmail);
  const entity = diamondTransactionEntity(base44, player);
  if (!entity?.filter || !email || !idempotencyKey) return null;
  const rows = await entity
    .filter({ user_email: email, idempotency_key: idempotencyKey }, '-created_at', 1)
    .catch(() => []);
  return Array.isArray(rows) && rows.length ? rows[0] : null;
}

async function createDiamondTransaction(base44: any, player: any, payload: Record<string, unknown>) {
  const email = normalizeEmail(payload.user_email);
  const idempotencyKey = String(payload.idempotency_key || '').trim();
  if (!email || !idempotencyKey) return null;
  const existing = await findDiamondTransaction(base44, player || email, idempotencyKey);
  if (existing) return existing;
  const entity = diamondTransactionEntity(base44, player);
  if (!entity?.create) return null;
  const created = await entity.create({
    ...payload,
    user_email: email,
    idempotency_key: idempotencyKey,
  });
  const confirmed = await findDiamondTransaction(base44, player || email, idempotencyKey);
  return confirmed || created;
}

async function createDailyWheelSpin(base44: any, payload: Record<string, unknown>) {
  const DailyWheelSpin = dailyWheelSpinEntity(base44);
  if (!DailyWheelSpin?.create) {
    return { row: null, error: 'daily_wheel_spin_entity_unavailable', recoveredExisting: false };
  }
  try {
    const row = await DailyWheelSpin.create(payload);
    const postCreateCanonicalSpin = await findSpin(
      base44,
      String(payload.user_email || ''),
      String(payload.spin_date || ''),
      String(payload.idempotency_key || ''),
    ).catch(() => null);
    if (postCreateCanonicalSpin && rowId(postCreateCanonicalSpin) && rowId(row) && rowId(postCreateCanonicalSpin) !== rowId(row)) {
      return {
        row: postCreateCanonicalSpin,
        error: 'daily_wheel_spin_existing_after_create',
        recoveredExisting: true,
      };
    }
    return { row, error: null, recoveredExisting: false };
  } catch (error) {
    const existing = await findSpin(
      base44,
      String(payload.user_email || ''),
      String(payload.spin_date || ''),
      String(payload.idempotency_key || ''),
    ).catch(() => null);
    if (existing) {
      return {
        row: existing,
        error: 'daily_wheel_spin_existing_after_create_error',
        recoveredExisting: true,
      };
    }
    return {
      row: null,
      error: error?.message || 'daily_wheel_spin_create_failed',
      recoveredExisting: false,
    };
  }
}

function spinRowFromDiamondTransaction(tx: any, playerRow: any, playerKey: string, dateKey: string, nextAvailableAt: string) {
  const metadata = tx?.metadata && typeof tx.metadata === 'object' ? tx.metadata : {};
  const totalRewardAmount = normalizeNumber(tx?.amount);
  const streakBonusAmount = normalizeNumber(metadata.streakBonusAmount);
  const rewardAmount = normalizeNumber(metadata.rewardAmount) || Math.max(0, totalRewardAmount - streakBonusAmount);
  const streakAfter = normalizeNumber(metadata.streakAfter ?? playerRow?.daily_wheel_streak);
  const streakBefore = normalizeNumber(metadata.streakBefore ?? Math.max(0, streakAfter - 1));
  return {
    user_email: playerKey,
    spin_date: dateKey,
    reward_amount: rewardAmount,
    streak_before: streakBefore,
    streak_after: streakAfter,
    streak_bonus_amount: streakBonusAmount,
    total_reward_amount: totalRewardAmount,
    balance_before: normalizeNumber(tx?.balance_before),
    balance_after: normalizeNumber(tx?.balance_after ?? playerRow?.diamonds),
    idempotency_key: tx?.idempotency_key || buildIdempotencyKey(playerKey, dateKey),
    claimed_at: tx?.created_at || playerRow?.daily_wheel_last_spin_at || new Date().toISOString(),
    next_available_at: playerRow?.daily_wheel_next_available_at || nextAvailableAt,
    metadata: {
      spinCountAfter: normalizeNumber(playerRow?.daily_wheel_spin_count),
      recoveredFromDiamondTransaction: true,
    },
  };
}

function userPatchFromSpin(row: any, dateKey: string) {
  const claimedAt = String(row?.claimed_at || new Date().toISOString());
  return {
    diamonds: normalizeNumber(row?.balance_after),
    daily_wheel_last_spin_at: claimedAt,
    daily_wheel_last_spin_date: dateKey,
    daily_wheel_next_available_at: String(row?.next_available_at || nextUtcMidnightIso(dateKey)),
    daily_wheel_streak: normalizeNumber(row?.streak_after),
    daily_wheel_spin_count: normalizeNumber(row?.metadata?.spinCountAfter),
    economy_updated_at: claimedAt,
  };
}

function publicResult(row: any, diamondTotal: number, alreadyClaimed = false) {
  return {
    ok: true,
    available: false,
    alreadyClaimedToday: true,
    alreadyClaimed,
    serverDate: String(row?.spin_date || utcDateKey()),
    rewardAmount: normalizeNumber(row?.reward_amount),
    streakBefore: normalizeNumber(row?.streak_before),
    streakAfter: normalizeNumber(row?.streak_after),
    streakBonusAmount: normalizeNumber(row?.streak_bonus_amount),
    totalRewardAmount: normalizeNumber(row?.total_reward_amount),
    claimedAt: row?.claimed_at || null,
    nextAvailableAt: row?.next_available_at || null,
    updatedDiamondTotal: diamondTotal,
    userPatch: {
      diamonds: diamondTotal,
      daily_wheel_last_spin_at: row?.claimed_at || null,
      daily_wheel_last_spin_date: row?.spin_date || null,
      daily_wheel_next_available_at: row?.next_available_at || null,
      daily_wheel_streak: normalizeNumber(row?.streak_after),
      daily_wheel_spin_count: normalizeNumber(row?.metadata?.spinCountAfter),
    },
  };
}

async function recoverExistingSpin(base44: any, player: any, row: any, dateKey: string, idempotencyKey: string) {
  const playerKey = player.playerKey;
  const nowIso = new Date().toISOString();
  const balanceAfter = Math.max(normalizeNumber(player?.row?.diamonds), normalizeNumber(row?.balance_after));
  const patch = {
    ...userPatchFromSpin({ ...row, balance_after: balanceAfter }, dateKey),
    diamonds: balanceAfter,
  };
  await updateDailyWheelPlayer(base44, player, patch).catch(() => null);
  await createDiamondTransaction(base44, player, {
    user_email: playerKey,
    owner_key: player.ownerKey,
    player_type: player.isGuest ? 'guest' : 'registered',
    amount: normalizeNumber(row?.total_reward_amount),
    balance_before: normalizeNumber(row?.balance_before),
    balance_after: balanceAfter,
    source: DAILY_WHEEL_SOURCE,
    direction: 'earn',
    idempotency_key: idempotencyKey,
    metadata: {
      dailyWheelSpinId: row?.id || null,
      serverDate: dateKey,
      recoveredFromDailyWheelSpin: true,
      rewardAmount: normalizeNumber(row?.reward_amount),
      streakBonusAmount: normalizeNumber(row?.streak_bonus_amount),
    },
    created_at: nowIso,
    description: 'daily_wheel_recovery',
  }).catch(() => null);
  return { ...row, balance_after: balanceAfter };
}

Deno.serve(async (req: Request) => {
  try {
    if (req.method !== 'POST') {
      return json({ ok: false, code: 'method_not_allowed', error: 'Bu işlem desteklenmiyor.' }, 405);
    }

    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const player = await resolveDailyWheelPlayer(base44, body);
    if (!player.ok) return player.response;
    const playerKey = player.playerKey;

    const todayKey = utcDateKey();
    const nowIso = new Date().toISOString();
    const nextAvailableAt = nextUtcMidnightIso(todayKey);
    const idempotencyKey = buildIdempotencyKey(playerKey, todayKey);
    const existingSpin = await findSpin(base44, playerKey, todayKey, idempotencyKey);
    if (existingSpin) {
      const recovered = await recoverExistingSpin(base44, player, existingSpin, todayKey, idempotencyKey);
      return json(publicResult(recovered, normalizeNumber(recovered.balance_after), true));
    }

    const latestUser = player.isGuest
      ? (await findGuestProfile(base44, String(player.row?.guest_id || '')).catch(() => player.row)) || player.row
      : await base44.auth.me().catch(() => player.row);
    const latestPlayer = { ...player, row: latestUser || player.row, rowId: rowId(latestUser) || player.rowId };
    const latestGuardDate = String(latestPlayer.row?.daily_wheel_last_spin_date || '');
    if (latestGuardDate === todayKey) {
      const guardSpin = await findSpin(base44, playerKey, todayKey, idempotencyKey);
      if (guardSpin) {
        return json(publicResult(guardSpin, normalizeNumber(latestPlayer.row?.diamonds), true));
      }
      const guardTransaction = await findDiamondTransaction(base44, latestPlayer, idempotencyKey);
      if (guardTransaction) {
        const syntheticSpin = spinRowFromDiamondTransaction(guardTransaction, latestPlayer.row, playerKey, todayKey, nextAvailableAt);
        return json(publicResult(syntheticSpin, normalizeNumber(latestPlayer.row?.diamonds), true));
      }
      return json({
        ok: true,
        available: false,
        alreadyClaimedToday: true,
        alreadyClaimed: true,
        serverDate: todayKey,
        nextAvailableAt: latestPlayer.row?.daily_wheel_next_available_at || nextAvailableAt,
        updatedDiamondTotal: normalizeNumber(latestPlayer.row?.diamonds),
        rewardAmount: 0,
        streakBonusAmount: 0,
        totalRewardAmount: 0,
        userPatch: {
          diamonds: normalizeNumber(latestPlayer.row?.diamonds),
          daily_wheel_last_spin_date: todayKey,
          daily_wheel_next_available_at: latestPlayer.row?.daily_wheel_next_available_at || nextAvailableAt,
          daily_wheel_streak: normalizeNumber(latestPlayer.row?.daily_wheel_streak),
          daily_wheel_spin_count: normalizeNumber(latestPlayer.row?.daily_wheel_spin_count),
        },
      });
    }

    return await withEconomyOperationLock(base44, buildEconomyLockKey(playerKey), {
      actorKey: playerKey,
      operationScope: 'daily_wheel_claim',
      operationId: idempotencyKey,
      metadata: {
        playerType: latestPlayer.isGuest ? 'guest' : 'registered',
        serverDate: todayKey,
      },
    }, async () => {
    const postLockSpin = await findSpin(base44, playerKey, todayKey, idempotencyKey);
    if (postLockSpin) {
      const recovered = await recoverExistingSpin(base44, latestPlayer, postLockSpin, todayKey, idempotencyKey);
      return json(publicResult(recovered, normalizeNumber(recovered.balance_after), true));
    }
    const lockedRow = latestPlayer.isGuest
      ? (await findGuestProfile(base44, String(latestPlayer.row?.guest_id || '')).catch(() => latestPlayer.row)) || latestPlayer.row
      : await base44.auth.me().catch(() => latestPlayer.row);
    const lockedPlayer = { ...latestPlayer, row: lockedRow || latestPlayer.row, rowId: rowId(lockedRow) || latestPlayer.rowId };
    if (String(lockedPlayer.row?.daily_wheel_last_spin_date || '') === todayKey) {
      const guardTransaction = await findDiamondTransaction(base44, lockedPlayer, idempotencyKey);
      if (guardTransaction) {
        const syntheticSpin = spinRowFromDiamondTransaction(guardTransaction, lockedPlayer.row, playerKey, todayKey, nextAvailableAt);
        return json(publicResult(syntheticSpin, normalizeNumber(lockedPlayer.row?.diamonds), true));
      }
      return json({
        ok: true,
        available: false,
        alreadyClaimedToday: true,
        alreadyClaimed: true,
        serverDate: todayKey,
        nextAvailableAt: lockedPlayer.row?.daily_wheel_next_available_at || nextAvailableAt,
        updatedDiamondTotal: normalizeNumber(lockedPlayer.row?.diamonds),
        rewardAmount: 0,
        streakBonusAmount: 0,
        totalRewardAmount: 0,
        userPatch: {
          diamonds: normalizeNumber(lockedPlayer.row?.diamonds),
          daily_wheel_last_spin_date: todayKey,
          daily_wheel_next_available_at: lockedPlayer.row?.daily_wheel_next_available_at || nextAvailableAt,
          daily_wheel_streak: normalizeNumber(lockedPlayer.row?.daily_wheel_streak),
          daily_wheel_spin_count: normalizeNumber(lockedPlayer.row?.daily_wheel_spin_count),
        },
      });
    }

    const selected = selectReward();
    const { streakBefore, streakAfter } = computeStreak(lockedPlayer.row, todayKey);
    const streakBonusAmount = streakAfter % 7 === 0 ? STREAK_BONUS_AMOUNT : 0;
    const totalRewardAmount = selected.amount + streakBonusAmount;
    const balanceBefore = normalizeNumber(lockedPlayer.row?.diamonds);
    const balanceAfter = balanceBefore + totalRewardAmount;
    const spinCountAfter = normalizeNumber(latestPlayer.row?.daily_wheel_spin_count) + 1;

    const spinPayload = {
      user_email: playerKey,
      owner_key: lockedPlayer.ownerKey,
      player_type: lockedPlayer.isGuest ? 'guest' : 'registered',
      spin_date: todayKey,
      reward_amount: selected.amount,
      streak_before: streakBefore,
      streak_after: streakAfter,
      streak_bonus_amount: streakBonusAmount,
      total_reward_amount: totalRewardAmount,
      balance_before: balanceBefore,
      balance_after: balanceAfter,
      idempotency_key: idempotencyKey,
      claimed_at: nowIso,
      next_available_at: nextAvailableAt,
      build_marker: String(body?.buildMarker || '').slice(0, 40),
      metadata: {
        rewardRarity: selected.rarity,
        spinCountAfter,
        serverDayBoundary: 'UTC',
        source: DAILY_WHEEL_SOURCE,
        guestProfileReward: lockedPlayer.isGuest,
        rawGuestTokenServerStored: false,
      },
      description: 'daily_wheel_claim',
    };

    const {
      row: spin,
      error: spinLedgerError,
      recoveredExisting: recoveredExistingDailyWheelSpin,
    } = await createDailyWheelSpin(base44, spinPayload);

    if (recoveredExistingDailyWheelSpin && spin) {
      const recovered = await recoverExistingSpin(base44, lockedPlayer, spin, todayKey, idempotencyKey);
      return json(publicResult(recovered, normalizeNumber(recovered.balance_after), true));
    }

    const postReserveSpin = await findSpin(base44, playerKey, todayKey, idempotencyKey);
    if (postReserveSpin && rowId(postReserveSpin) && rowId(spin) && rowId(postReserveSpin) !== rowId(spin)) {
      const recovered = await recoverExistingSpin(base44, lockedPlayer, postReserveSpin, todayKey, idempotencyKey);
      return json(publicResult(recovered, normalizeNumber(recovered.balance_after), true));
    }

    const postReserveRow = lockedPlayer.isGuest
      ? (await findGuestProfile(base44, String(lockedPlayer.row?.guest_id || '')).catch(() => lockedPlayer.row)) || lockedPlayer.row
      : await base44.auth.me().catch(() => lockedPlayer.row);
    const postReservePlayer = { ...lockedPlayer, row: postReserveRow || lockedPlayer.row, rowId: rowId(postReserveRow) || lockedPlayer.rowId };
    if (String(postReservePlayer.row?.daily_wheel_last_spin_date || '') === todayKey) {
      const guardSpin = postReserveSpin || await findSpin(base44, playerKey, todayKey, idempotencyKey);
      if (guardSpin) {
        return json(publicResult(guardSpin, normalizeNumber(postReservePlayer.row?.diamonds), true));
      }
      const guardTransaction = await findDiamondTransaction(base44, postReservePlayer, idempotencyKey);
      if (guardTransaction) {
        const syntheticSpin = spinRowFromDiamondTransaction(guardTransaction, postReservePlayer.row, playerKey, todayKey, nextAvailableAt);
        return json(publicResult(syntheticSpin, normalizeNumber(postReservePlayer.row?.diamonds), true));
      }
      return json({
        ok: true,
        available: false,
        alreadyClaimedToday: true,
        alreadyClaimed: true,
        serverDate: todayKey,
        nextAvailableAt: postReservePlayer.row?.daily_wheel_next_available_at || nextAvailableAt,
        updatedDiamondTotal: normalizeNumber(postReservePlayer.row?.diamonds),
        rewardAmount: 0,
        streakBonusAmount: 0,
        totalRewardAmount: 0,
        userPatch: {
          diamonds: normalizeNumber(postReservePlayer.row?.diamonds),
          daily_wheel_last_spin_date: todayKey,
          daily_wheel_next_available_at: postReservePlayer.row?.daily_wheel_next_available_at || nextAvailableAt,
          daily_wheel_streak: normalizeNumber(postReservePlayer.row?.daily_wheel_streak),
          daily_wheel_spin_count: normalizeNumber(postReservePlayer.row?.daily_wheel_spin_count),
        },
      });
    }

    const postReserveTransaction = await findDiamondTransaction(base44, postReservePlayer, idempotencyKey);
    if (postReserveTransaction) {
      const recoveredBalance = Math.max(
        normalizeNumber(postReservePlayer.row?.diamonds),
        normalizeNumber(postReserveTransaction?.balance_after),
      );
      const syntheticSpin = spinRowFromDiamondTransaction(
        postReserveTransaction,
        { ...(postReservePlayer.row || {}), diamonds: recoveredBalance },
        playerKey,
        todayKey,
        nextAvailableAt,
      );
      return json(publicResult(syntheticSpin, recoveredBalance, true));
    }

    const userPatch = {
      diamonds: balanceAfter,
      daily_wheel_last_spin_at: nowIso,
      daily_wheel_last_spin_date: todayKey,
      daily_wheel_next_available_at: nextAvailableAt,
      daily_wheel_streak: streakAfter,
      daily_wheel_spin_count: spinCountAfter,
      economy_updated_at: nowIso,
    };
    await updateDailyWheelPlayer(base44, postReservePlayer, userPatch);

    let ledgerError = null;
    const transactionMetadata: Record<string, unknown> = {
      dailyWheelSpinId: spin?.id || null,
      serverDate: todayKey,
      rewardAmount: selected.amount,
      streakBefore,
      streakBonusAmount,
      streakAfter,
      noKronoxPuan: true,
      playerType: postReservePlayer.isGuest ? 'guest' : 'registered',
      guestProfileReward: postReservePlayer.isGuest,
      rawGuestTokenServerStored: false,
    };
    if (spinLedgerError) {
      transactionMetadata.dailyWheelSpinCreateError = spinLedgerError;
    }
    try {
      await createDiamondTransaction(base44, postReservePlayer, {
        user_email: playerKey,
        owner_key: postReservePlayer.ownerKey,
        player_type: postReservePlayer.isGuest ? 'guest' : 'registered',
        amount: totalRewardAmount,
        balance_before: balanceBefore,
        balance_after: balanceAfter,
        source: DAILY_WHEEL_SOURCE,
        direction: 'earn',
        idempotency_key: idempotencyKey,
        metadata: transactionMetadata,
        created_at: nowIso,
        description: 'daily_wheel_claim',
      });
    } catch (error) {
      ledgerError = error?.message || 'daily_wheel_diamond_ledger_failed';
    }

    return json({
      ...publicResult(spin || spinPayload, balanceAfter, false),
      spinLedgerError,
      ledgerError,
    });
    });
  } catch (error) {
    console.error('[claimDailyWheelReward] failed', error);
    return json({
      ok: false,
      code: 'daily_wheel_claim_failed',
      error: 'Günlük Çark ödülü alınamadı. Lütfen tekrar dene.',
    }, 500);
  }
});
