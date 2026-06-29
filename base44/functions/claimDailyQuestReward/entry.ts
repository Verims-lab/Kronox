/* global Deno */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.34';

const DAILY_QUEST_REWARD_SOURCE = 'daily_quest_reward';
const RELATED_ENTITY_TYPE = 'daily_quest';
const CANONICAL_DAILY_QUEST_KEY = 'solo_level_complete';
const CANONICAL_DAILY_QUEST_TYPE = 'solo_level_complete';
const DAY_MS = 24 * 60 * 60 * 1000;
const GUEST_ID_PREFIX = 'guest_';
const ECONOMY_LOCK_TTL_MS = 8_000;
const ECONOMY_LOCK_SETTLE_MS = 80;

function json(payload: unknown, status = 200) {
  return Response.json(payload, { status });
}

function normalizeEmail(value: unknown) {
  return String(value || '').trim().toLowerCase();
}

function normalizeNumber(value: unknown, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.floor(number)) : fallback;
}

function utcDateKey(now = new Date()) {
  return now.toISOString().slice(0, 10);
}

function nextUtcMidnightIso(dateKey: string) {
  const start = Date.parse(`${dateKey}T00:00:00.000Z`);
  return new Date(start + DAY_MS).toISOString();
}

function buildClaimIdempotencyKey(email: string, dateKey: string, questKey: string) {
  return `daily_quest_reward:${email}:${dateKey}:${questKey}`;
}

function rowId(row: any) {
  return row?.id || row?._id || null;
}

function nowIso() {
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
    released_at: nowIso(),
  }).catch(() => null);
}

async function acquireEconomyOperationLock(base44: any, lockKey: string, context: Record<string, unknown>) {
  const entity = economyOperationLockEntity(base44);
  if (!entity?.filter || !entity?.create || !entity?.update) {
    return { ok: false, code: 'economy_lock_unavailable', lock: null };
  }
  const now = nowIso();
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

async function resolveDailyQuestPlayer(base44: any, body: any) {
  const user = await base44.auth.me().catch(() => null);
  const email = normalizeEmail(user?.email) || normalizeEmail(user?.user_email);
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
    return { ok: false, response: json({ ok: false, code: 'unauthenticated', error: 'Günlük görev ödülü için profilini tamamlamalısın.' }, 401) };
  }
  const guest = await findGuestProfile(base44, guestId);
  const expectedHash = String(guest?.guest_token_hash || '');
  const providedHash = await hashGuestToken(guestId, guestToken);
  if (!guest || !expectedHash || expectedHash !== providedHash) {
    return { ok: false, response: json({ ok: false, code: 'invalid_guest_token', error: 'Misafir oturumu doğrulanamadı.' }, 401) };
  }
  if (String(guest?.status || '') === 'linked' || !isGuestProfileComplete(guest)) {
    return { ok: false, response: json({ ok: false, code: 'guest_profile_incomplete', error: 'Günlük görev ödülü için profilini tamamlamalısın.' }, 403) };
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

function progressEntity(base44: any, player: any = null) {
  // Runtime/deployability contract: Daily Quest claim binds
  // entities.UserDailyQuestProgress. The progress row's RLS update rule is
  // owner-scoped (data.user_email == user.email) with NO admin clause, so
  // updates must run as the authenticated owner. We therefore prefer the
  // authenticated-user client (which satisfies owner RLS) and only fall back
  // to the service-role client when the auth client is unavailable. This
  // mirrors recordDailyQuestProgress, the proven working progress writer.
  const authEntity = base44?.entities ? base44.entities.UserDailyQuestProgress : null;
  const serviceEntity = base44?.asServiceRole?.entities ? base44.asServiceRole.entities.UserDailyQuestProgress : null;
  return player?.isGuest ? serviceEntity : (authEntity || serviceEntity);
}

function publicProgress(row: any) {
  const targetValue = Math.max(1, normalizeNumber(row?.target_value, 1));
  const progressValue = Math.min(targetValue, normalizeNumber(row?.progress_value, 0));
  return {
    id: rowId(row),
    questKey: String(row?.quest_key || ''),
    questDate: String(row?.quest_date || ''),
    title: String(row?.title || row?.quest_key || ''),
    description: String(row?.description || ''),
    questType: String(row?.quest_type || ''),
    progressValue,
    targetValue,
    rewardDiamonds: Math.max(1, normalizeNumber(row?.reward_diamonds, 1)),
    status: String(row?.status || (progressValue >= targetValue ? 'completed' : 'active')),
    completedAt: row?.completed_at || null,
    claimedAt: row?.claimed_at || null,
  };
}

function isCanonicalDailyQuest(row: any) {
  return String(row?.quest_key || '') === CANONICAL_DAILY_QUEST_KEY ||
    String(row?.quest_type || '') === CANONICAL_DAILY_QUEST_TYPE;
}

function isProgressRowOwnedByPlayer(row: any, player: any) {
  const email = normalizeEmail(player?.row?.email) || normalizeEmail(player?.row?.user_email);
  if (!player?.isGuest && email) return normalizeEmail(row?.user_email) === email;
  return normalizeEmail(row?.user_email) === player.playerKey;
}

async function findProgressById(base44: any, player: any, progressId: string) {
  const entity = progressEntity(base44, player);
  if (!entity || !progressId) return null;
  if (typeof entity.get === 'function') {
    const row = await entity.get(progressId).catch(() => null);
    if (rowId(row) && isProgressRowOwnedByPlayer(row, player)) return row;
  }
  if (typeof entity.filter === 'function') {
    for (const field of ['id', '_id']) {
      const rows = await entity.filter({ [field]: progressId }, '-created_at', 1).catch(() => []);
      const row = Array.isArray(rows) && rows.length ? rows[0] : null;
      if (rowId(row) && isProgressRowOwnedByPlayer(row, player)) return row;
    }
  }
  return null;
}

async function findProgress(base44: any, player: any, body: any) {
  const progressId = String(body?.progressId || body?.progress_id || '').trim();
  if (progressId) {
    const row = await findProgressById(base44, player, progressId);
    if (rowId(row)) return row;
  }
  const questKey = String(body?.questKey || body?.quest_key || '').trim();
  const questDate = String(body?.questDate || body?.quest_date || utcDateKey()).slice(0, 10);
  if (!questKey) return null;
  const rows = await progressEntity(base44, player)
    .filter({ user_email: player.playerKey, quest_date: questDate, quest_key: questKey }, '-created_at', 1)
    .catch(() => []);
  const row = Array.isArray(rows) && rows.length ? rows[0] : null;
  return rowId(row) && isProgressRowOwnedByPlayer(row, player) ? row : null;
}

function diamondTransactionEntity(base44: any, player: any = null) {
  // DiamondTransaction RLS create is owner-scoped
  // (created_by_id == user.id AND data.user_email == user.email) with NO admin
  // clause, so the ledger row must be created by the authenticated owner.
  // Prefer the auth client; fall back to service role only if unavailable.
  const authEntity = base44?.entities ? base44.entities.DiamondTransaction : null;
  const serviceEntity = base44?.asServiceRole?.entities ? base44.asServiceRole.entities.DiamondTransaction : null;
  return player?.isGuest ? serviceEntity : (authEntity || serviceEntity);
}

async function findDiamondTransaction(base44: any, player: any, idempotencyKey: string) {
  const rows = await diamondTransactionEntity(base44, player)
    .filter({ user_email: player.playerKey, idempotency_key: idempotencyKey }, '-created_at', 1)
    .catch(() => []);
  return Array.isArray(rows) && rows.length ? rows[0] : null;
}

async function createDiamondTransaction(base44: any, player: any, payload: Record<string, unknown>) {
  const email = normalizeEmail(payload.user_email);
  const idempotencyKey = String(payload.idempotency_key || '').trim();
  if (!email || !idempotencyKey) return null;
  const existing = await findDiamondTransaction(base44, player, idempotencyKey);
  if (existing) return existing;
  const created = await diamondTransactionEntity(base44, player).create({
    ...payload,
    user_email: email,
    idempotency_key: idempotencyKey,
  });
  const confirmed = await findDiamondTransaction(base44, player, idempotencyKey);
  return confirmed || created;
}

async function markProgressClaimed(base44: any, player: any, row: any, claimedAt: string, tx: any) {
  const id = rowId(row);
  if (!id) return row;
  if (String(row?.status || '') === 'claimed' && row?.claimed_at) return row;
  return progressEntity(base44, player).update(id, {
    status: 'claimed',
    claimed_at: claimedAt,
    updated_at: claimedAt,
    metadata: {
      ...(row?.metadata && typeof row.metadata === 'object' ? row.metadata : {}),
      claimTransactionId: tx?.id || null,
      claimSource: DAILY_QUEST_REWARD_SOURCE,
      noKronoxPuan: true,
      noLeaderboardImpact: true,
      guestProfileQuest: player?.isGuest === true,
      rawGuestTokenServerStored: false,
    },
  });
}

async function updateDailyQuestPlayer(base44: any, player: any, patch: Record<string, unknown>) {
  if (!player?.rowId) return null;
  if (player.isGuest) {
    const entity = base44?.asServiceRole?.entities?.GuestProfile || base44?.entities?.GuestProfile;
    return entity?.update?.(player.rowId, {
      ...patch,
      last_seen_at: String(patch.economy_updated_at || new Date().toISOString()),
      metadata: {
        ...(player.row?.metadata && typeof player.row.metadata === 'object' ? player.row.metadata : {}),
        guestDailyQuestEnabled: true,
        rawGuestTokenServerStored: false,
      },
    });
  }
  return base44.asServiceRole.entities.User.update(player.rowId, patch);
}

async function reconcileVisibleDiamondBalance(base44: any, player: any, balanceAfter: number, timestamp: string) {
  const currentBalance = normalizeNumber(player?.row?.diamonds, 0);
  const nextBalance = Math.max(currentBalance, balanceAfter);
  if (player?.rowId && nextBalance !== currentBalance) {
    await updateDailyQuestPlayer(base44, player, {
      diamonds: nextBalance,
      economy_updated_at: timestamp,
    }).catch(() => null);
  }
  return nextBalance;
}

Deno.serve(async (req: Request) => {
  try {
    if (req.method !== 'POST') {
      return json({ ok: false, code: 'method_not_allowed', error: 'Bu işlem desteklenmiyor.' }, 405);
    }

    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const player = await resolveDailyQuestPlayer(base44, body);
    if (!player.ok) return player.response;
    const progressStore = progressEntity(base44, player);
    if (!progressStore?.filter || !progressStore?.update) {
      return json({ ok: false, code: 'daily_quest_entities_missing', error: 'Günlük görev kayıtları hazır değil.' }, 500);
    }
    let progress = await findProgress(base44, player, body);
    if (!rowId(progress)) {
      return json({ ok: false, code: 'daily_quest_not_found', error: 'Günlük görev bulunamadı.' }, 404);
    }

    const questDate = String(progress.quest_date || '').slice(0, 10);
    const todayKey = utcDateKey();
    if (questDate !== todayKey) {
      return json({ ok: false, code: 'daily_quest_not_claimable_today', error: 'Bu görev bugün için alınamaz.' }, 409);
    }
    if (!isCanonicalDailyQuest(progress)) {
      return json({ ok: false, code: 'daily_quest_legacy_not_claimable', error: 'Bu görev artık geçerli değil.' }, 409);
    }

    const targetValue = Math.max(1, normalizeNumber(progress.target_value, 1));
    const progressValue = Math.min(targetValue, normalizeNumber(progress.progress_value, 0));
    const progressStatus = String(progress.status || '');
    if (progressStatus !== 'completed' && progressStatus !== 'claimed') {
      return json({ ok: false, code: 'daily_quest_not_completed', error: 'Görev henüz tamamlanmadı.' }, 409);
    }
    if (progressValue < targetValue) {
      return json({ ok: false, code: 'daily_quest_not_completed', error: 'Görev henüz tamamlanmadı.' }, 409);
    }

    const rewardDiamonds = Math.max(1, normalizeNumber(progress.reward_diamonds, 1));
    const idempotencyKey = buildClaimIdempotencyKey(player.playerKey, questDate, String(progress.quest_key || rowId(progress)));
    const existingTx = await findDiamondTransaction(base44, player, idempotencyKey);
    const timestamp = new Date().toISOString();
    const nextAvailableAt = nextUtcMidnightIso(todayKey);
    const latestRow = player.isGuest
      ? (await findGuestProfile(base44, String(player.row?.guest_id || '')).catch(() => player.row)) || player.row
      : await base44.auth.me().catch(() => player.row);
    const latestPlayer = { ...player, row: latestRow || player.row, rowId: rowId(latestRow) || player.rowId };

    if (existingTx) {
      const claimedProgress = await markProgressClaimed(base44, latestPlayer, progress, progress.claimed_at || existingTx.created_at || timestamp, existingTx);
      const diamondBalanceAfter = await reconcileVisibleDiamondBalance(
        base44,
        latestPlayer,
        normalizeNumber(existingTx.balance_after ?? latestPlayer.row?.diamonds),
        timestamp,
      );
      return json({
        ok: true,
        alreadyClaimed: true,
        source: DAILY_QUEST_REWARD_SOURCE,
        quest: publicProgress(claimedProgress),
        rewardDiamonds: normalizeNumber(existingTx.amount, rewardDiamonds),
        diamondBalanceAfter,
        questStatus: 'claimed',
        idempotencyKey,
        transactionId: existingTx.id || null,
        playerType: latestPlayer.isGuest ? 'guest' : 'registered',
        guestProfile: latestPlayer.isGuest,
        userPatch: {
          diamonds: diamondBalanceAfter,
          daily_quest_last_claim_at: claimedProgress.claimed_at || existingTx.created_at || timestamp,
          daily_quest_last_claim_date: questDate,
          daily_quest_next_available_at: nextAvailableAt,
        },
      });
    }

    if (String(progress.status || '') === 'claimed' || progress.claimed_at) {
      return json({ ok: false, code: 'daily_quest_already_claimed', error: 'Bu görev ödülü zaten alındı.' }, 409);
    }

    return await withEconomyOperationLock(base44, buildEconomyLockKey(player.playerKey), {
      actorKey: player.playerKey,
      operationScope: 'daily_quest_claim',
      operationId: idempotencyKey,
      metadata: {
        questKey: progress.quest_key,
        questDate,
        playerType: latestPlayer.isGuest ? 'guest' : 'registered',
      },
    }, async () => {
    const postLockTx = await findDiamondTransaction(base44, latestPlayer, idempotencyKey);
    if (postLockTx) {
      const claimedProgress = await markProgressClaimed(base44, latestPlayer, progress, progress.claimed_at || postLockTx.created_at || timestamp, postLockTx);
      const diamondBalanceAfter = await reconcileVisibleDiamondBalance(
        base44,
        latestPlayer,
        normalizeNumber(postLockTx.balance_after ?? latestPlayer.row?.diamonds),
        timestamp,
      );
      return json({
        ok: true,
        alreadyClaimed: true,
        source: DAILY_QUEST_REWARD_SOURCE,
        quest: publicProgress(claimedProgress),
        rewardDiamonds: normalizeNumber(postLockTx.amount, rewardDiamonds),
        diamondBalanceAfter,
        questStatus: 'claimed',
        idempotencyKey,
        transactionId: postLockTx.id || null,
        playerType: latestPlayer.isGuest ? 'guest' : 'registered',
        guestProfile: latestPlayer.isGuest,
        userPatch: {
          diamonds: diamondBalanceAfter,
          daily_quest_last_claim_at: claimedProgress.claimed_at || postLockTx.created_at || timestamp,
          daily_quest_last_claim_date: questDate,
          daily_quest_next_available_at: nextAvailableAt,
        },
      });
    }

    const lockedRow = latestPlayer.isGuest
      ? (await findGuestProfile(base44, String(latestPlayer.row?.guest_id || '')).catch(() => latestPlayer.row)) || latestPlayer.row
      : await base44.auth.me().catch(() => latestPlayer.row);
    const lockedPlayer = { ...latestPlayer, row: lockedRow || latestPlayer.row, rowId: rowId(lockedRow) || latestPlayer.rowId };
    const lockedProgress = rowId(progress)
      ? (await findProgressById(base44, lockedPlayer, rowId(progress)).catch(() => null)) || progress
      : progress;
    if (String(lockedProgress.status || '') === 'claimed' || lockedProgress.claimed_at) {
      return json({ ok: false, code: 'daily_quest_already_claimed', error: 'Bu görev ödülü zaten alındı.' }, 409);
    }
    if (!isCanonicalDailyQuest(lockedProgress)) {
      return json({ ok: false, code: 'daily_quest_legacy_not_claimable', error: 'Bu görev artık geçerli değil.' }, 409);
    }
    const lockedTargetValue = Math.max(1, normalizeNumber(lockedProgress.target_value, 1));
    const lockedProgressValue = Math.min(lockedTargetValue, normalizeNumber(lockedProgress.progress_value, 0));
    if (String(lockedProgress.status || '') !== 'completed' || lockedProgressValue < lockedTargetValue) {
      return json({ ok: false, code: 'daily_quest_not_completed', error: 'Görev henüz tamamlanmadı.' }, 409);
    }

    const balanceBefore = normalizeNumber(lockedPlayer.row?.diamonds, 0);
    const balanceAfter = balanceBefore + rewardDiamonds;
    const claimCount = normalizeNumber(lockedPlayer.row?.daily_quest_claim_count, 0) + 1;
    const userPatch = {
      diamonds: balanceAfter,
      daily_quest_last_claim_at: timestamp,
      daily_quest_last_claim_date: questDate,
      daily_quest_next_available_at: nextAvailableAt,
      daily_quest_claim_count: claimCount,
      economy_updated_at: timestamp,
    };

    const tx = await createDiamondTransaction(base44, lockedPlayer, {
      user_email: lockedPlayer.playerKey,
      owner_key: lockedPlayer.ownerKey,
      player_type: lockedPlayer.isGuest ? 'guest' : 'registered',
      amount: rewardDiamonds,
      balance_before: balanceBefore,
      balance_after: balanceAfter,
      source: DAILY_QUEST_REWARD_SOURCE,
      direction: 'earn',
      related_entity_type: RELATED_ENTITY_TYPE,
      related_entity_id: rowId(lockedProgress),
      idempotency_key: idempotencyKey,
      metadata: {
        questProgressId: rowId(lockedProgress),
        questKey: lockedProgress.quest_key,
        questDate,
        questType: lockedProgress.quest_type,
        source: DAILY_QUEST_REWARD_SOURCE,
        grantsDiamondsOnly: true,
        noKronoxPuan: true,
        noLeaderboardImpact: true,
        clientRewardIgnored: true,
        playerType: lockedPlayer.isGuest ? 'guest' : 'registered',
        guestProfileReward: lockedPlayer.isGuest,
        rawGuestTokenServerStored: false,
      },
      created_at: timestamp,
      description: 'daily_quest_reward',
    });
    if (!tx) throw new Error('daily_quest_reward_transaction_missing');

    await updateDailyQuestPlayer(base44, lockedPlayer, userPatch);

    // Mark the quest claimed only after the reward grant succeeded.
    const claimedProgress = await markProgressClaimed(base44, lockedPlayer, lockedProgress, timestamp, tx);

    return json({
      ok: true,
      alreadyClaimed: false,
      source: DAILY_QUEST_REWARD_SOURCE,
      quest: publicProgress(claimedProgress),
      rewardDiamonds,
      diamondBalanceBefore: balanceBefore,
      diamondBalanceAfter: balanceAfter,
      questStatus: 'claimed',
      idempotencyKey,
      transactionId: tx?.id || null,
      userPatch,
      playerType: lockedPlayer.isGuest ? 'guest' : 'registered',
      guestProfile: lockedPlayer.isGuest,
      grantsDiamondsOnly: true,
      noKronoxPuan: true,
      noLeaderboardImpact: true,
    });
    });
  } catch (error) {
    console.error('[claimDailyQuestReward] failed', error?.message || error);
    return json({
      ok: false,
      code: 'daily_quest_claim_failed',
      error: 'Ödül alınamadı. Tekrar dene.',
    }, 500);
  }
});
