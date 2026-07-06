/* global Deno */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.34';

const DAILY_CALENDAR_RUNTIME_VERSION = 'daily-calendar-streak-v1';
const DAILY_CALENDAR_TASKS_PER_DAY = 3;
const DAILY_STREAK_REWARD_DAYS = 7;
const DAILY_STREAK_REWARD_DIAMONDS = 200;
const DAILY_CALENDAR_REWARD_SOURCE = 'daily_calendar_streak_reward';
const RELATED_ENTITY_TYPE = 'daily_calendar_streak_reward';
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

function rowId(row: any) {
  return row?.id || row?._id || null;
}

function nowIso() {
  return new Date().toISOString();
}

function utcDateKey(now = new Date()) {
  return now.toISOString().slice(0, 10);
}

function addDays(dateKey: string, amount: number) {
  const ms = Date.parse(`${dateKey}T00:00:00.000Z`);
  return new Date(ms + amount * DAY_MS).toISOString().slice(0, 10);
}

function nextUtcMidnightIso(dateKey: string) {
  const ms = Date.parse(`${dateKey}T00:00:00.000Z`);
  return new Date(ms + DAY_MS).toISOString();
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

function ownerKeyFromText(prefix: string, rawValue: unknown) {
  const value = String(rawValue || '').trim().toLowerCase();
  if (!value) return '';
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `${prefix}_${(hash >>> 0).toString(36)}`;
}

function ownerKeyFromEmail(value: unknown) {
  return ownerKeyFromText('u', normalizeEmail(value));
}

function ownerKeyFromGuestId(value: unknown) {
  return ownerKeyFromText('g', value);
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

async function resolveDailyCalendarPlayer(base44: any, body: any) {
  const user = await base44.auth.me().catch(() => null);
  const email = normalizeEmail(user?.email || user?.user_email);
  if (email && rowId(user)) {
    return { ok: true, isGuest: false, row: user, rowId: rowId(user), playerKey: email, ownerKey: ownerKeyFromEmail(email), response: null };
  }
  const guestId = normalizeGuestId(body?.guest_id);
  const guestToken = normalizeGuestToken(body?.guest_token);
  if (!guestId || !guestToken) {
    return { ok: false, response: json({ ok: false, code: 'unauthenticated', error: 'Günlük ödül için profilini tamamlamalısın.' }, 401) };
  }
  const guest = await findGuestProfile(base44, guestId);
  const expectedHash = String(guest?.guest_token_hash || '');
  const providedHash = await hashGuestToken(guestId, guestToken);
  if (!guest || !expectedHash || expectedHash !== providedHash) {
    return { ok: false, response: json({ ok: false, code: 'invalid_guest_token', error: 'Misafir oturumu doğrulanamadı.' }, 401) };
  }
  if (String(guest?.status || '') === 'linked' || !isGuestProfileComplete(guest)) {
    return { ok: false, response: json({ ok: false, code: 'guest_profile_incomplete', error: 'Günlük ödül için profilini tamamlamalısın.' }, 403) };
  }
  return { ok: true, isGuest: true, row: guest, rowId: rowId(guest), playerKey: guestPlayerKey(guestId), ownerKey: ownerKeyFromGuestId(guestId), response: null };
}

function progressEntity(base44: any, player: any = null) {
  const serviceEntity = base44?.asServiceRole?.entities?.UserDailyQuestProgress || null;
  const authEntity = base44?.entities?.UserDailyQuestProgress || null;
  return player?.isGuest ? serviceEntity : (authEntity || serviceEntity);
}

function playerEntity(base44: any, player: any) {
  if (player?.isGuest) return base44?.asServiceRole?.entities?.GuestProfile || base44?.entities?.GuestProfile || null;
  return base44?.asServiceRole?.entities?.User || base44?.entities?.User || null;
}

function diamondTransactionEntity(base44: any, player: any = null) {
  const serviceEntity = base44?.asServiceRole?.entities?.DiamondTransaction || null;
  const authEntity = base44?.entities?.DiamondTransaction || null;
  return player?.isGuest ? serviceEntity : (authEntity || serviceEntity);
}

function economyOperationLockEntity(base44: any) {
  return base44?.asServiceRole?.entities?.EconomyOperationLock || base44?.entities?.EconomyOperationLock || null;
}

function isDailyCalendarRow(row: any) {
  return String(row?.quest_key || '').startsWith('daily_calendar:') ||
    String(row?.metadata?.runtimeVersion || '') === DAILY_CALENDAR_RUNTIME_VERSION;
}

function publicProgress(row: any) {
  const targetValue = Math.max(1, normalizeNumber(row?.target_value, 1));
  const progressValue = Math.min(targetValue, normalizeNumber(row?.progress_value, 0));
  return {
    id: rowId(row),
    questKey: String(row?.quest_key || ''),
    questDate: String(row?.quest_date || ''),
    questType: String(row?.quest_type || ''),
    progressValue,
    targetValue,
    completed: progressValue >= targetValue || String(row?.status || '') === 'completed',
  };
}

function isDayCompleted(rows: any[] = []) {
  const calendarRows = rows.filter(isDailyCalendarRow);
  if (calendarRows.length < DAILY_CALENDAR_TASKS_PER_DAY) return false;
  return calendarRows.slice(0, DAILY_CALENDAR_TASKS_PER_DAY).every((row) => publicProgress(row).completed);
}

function groupRowsByDate(rows: any[] = []) {
  const grouped = new Map<string, any[]>();
  for (const row of rows) {
    const key = String(row?.quest_date || '').slice(0, 10);
    if (!key) continue;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)?.push(row);
  }
  return grouped;
}

async function readPlayerCalendarRows(base44: any, player: any, limit = 420) {
  const entity = progressEntity(base44, player);
  if (!entity?.filter) return [];
  const rows = await entity.filter({ user_email: player.playerKey }, '-quest_date', limit).catch(() => []);
  return Array.isArray(rows) ? rows.filter(isDailyCalendarRow) : [];
}

function computeCurrentStreak(groupedRows: Map<string, any[]>, serverDate: string) {
  const todayCompleted = isDayCompleted(groupedRows.get(serverDate) || []);
  let cursor = todayCompleted ? serverDate : addDays(serverDate, -1);
  let streak = 0;
  while (isDayCompleted(groupedRows.get(cursor) || [])) {
    streak += 1;
    cursor = addDays(cursor, -1);
    if (streak > 365) break;
  }
  return { todayCompleted, currentStreak: streak };
}

function buildRewardState(player: any, groupedRows: Map<string, any[]>, serverDate: string) {
  const { todayCompleted, currentStreak } = computeCurrentStreak(groupedRows, serverDate);
  const streakAnchorDate = currentStreak > 0 ? addDays(todayCompleted ? serverDate : addDays(serverDate, -1), -(currentStreak - 1)) : serverDate;
  const storedAnchor = String(player.row?.daily_calendar_streak_anchor_date || '');
  const storedClaimCount = storedAnchor === streakAnchorDate
    ? normalizeNumber(player.row?.daily_calendar_streak_reward_claim_count, 0)
    : 0;
  const earnedRewardCount = Math.floor(currentStreak / DAILY_STREAK_REWARD_DAYS);
  const ready = currentStreak >= DAILY_STREAK_REWARD_DAYS && earnedRewardCount > storedClaimCount;
  const claimNumber = storedClaimCount + 1;
  const cycleId = `daily_calendar_streak:${player.playerKey}:${streakAnchorDate}:${claimNumber}`;
  const idempotencyKey = `${cycleId}:${DAILY_STREAK_REWARD_DIAMONDS}`;
  return {
    todayCompleted,
    currentStreak,
    streakAnchorDate,
    storedClaimCount,
    earnedRewardCount,
    ready,
    claimNumber,
    cycleId,
    idempotencyKey,
  };
}

async function findDiamondTransaction(base44: any, player: any, idempotencyKey: string) {
  const entity = diamondTransactionEntity(base44, player);
  if (!entity?.filter) return null;
  const rows = await entity.filter({ user_email: player.playerKey, idempotency_key: idempotencyKey }, '-created_at', 1).catch(() => []);
  return Array.isArray(rows) && rows.length ? rows[0] : null;
}

async function createDiamondTransaction(base44: any, player: any, payload: Record<string, unknown>) {
  const existing = await findDiamondTransaction(base44, player, String(payload.idempotency_key || ''));
  if (existing) return existing;
  const entity = diamondTransactionEntity(base44, player);
  if (!entity?.create) return null;
  await entity.create(payload);
  return await findDiamondTransaction(base44, player, String(payload.idempotency_key || ''));
}

async function updateDailyCalendarPlayer(base44: any, player: any, patch: Record<string, unknown>) {
  const entity = playerEntity(base44, player);
  if (!entity?.update || !player?.rowId) return null;
  return entity.update(player.rowId, patch);
}

function safeLockText(value: unknown, maxLength = 220) {
  const text = String(value || '').trim();
  return text ? text.slice(0, maxLength) : '';
}

function buildEconomyLockKey(actorKey: string) {
  return `economy:user:${actorKey}`;
}

function isActiveLock(row: any, nowMs: number) {
  if (String(row?.status || '') !== 'active') return false;
  const expiresMs = Date.parse(String(row?.expires_at || ''));
  return Number.isFinite(expiresMs) ? expiresMs > nowMs : true;
}

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withEconomyLock(base44: any, lockKey: string, context: Record<string, unknown>, callback: () => Promise<Response>) {
  const entity = economyOperationLockEntity(base44);
  if (!entity?.filter || !entity?.create || !entity?.update) return callback();
  const now = nowIso();
  const nowMs = Date.parse(now);
  const existingRows = await entity.filter({ lock_key: lockKey }, '-acquired_at', 20).catch(() => []);
  const active = Array.isArray(existingRows) ? existingRows.find((row: any) => isActiveLock(row, nowMs)) : null;
  if (active) {
    return json({ ok: false, code: 'economy_operation_in_progress', error: 'Ekonomi işlemi işleniyor. Lütfen tekrar dene.' }, 409);
  }
  const lock = await entity.create({
    lock_key: lockKey,
    actor_key: safeLockText(context.actorKey),
    operation_scope: 'daily_calendar_streak_claim',
    operation_id: safeLockText(context.operationId),
    status: 'active',
    acquired_at: now,
    expires_at: new Date(nowMs + ECONOMY_LOCK_TTL_MS).toISOString(),
    metadata: {
      runtimeVersion: DAILY_CALENDAR_RUNTIME_VERSION,
      ttlMs: ECONOMY_LOCK_TTL_MS,
    },
  }).catch(() => null);
  await sleep(ECONOMY_LOCK_SETTLE_MS);
  try {
    return await callback();
  } finally {
    if (rowId(lock)) {
      await entity.update(rowId(lock), { status: 'released', released_at: nowIso() }).catch(() => null);
    }
  }
}

function claimResponse(player: any, tx: any, rewardState: any, balanceAfter: number, alreadyClaimed: boolean, timestamp: string) {
  return {
    ok: true,
    alreadyClaimed,
    source: DAILY_CALENDAR_REWARD_SOURCE,
    rewardDiamonds: DAILY_STREAK_REWARD_DIAMONDS,
    diamondBalanceAfter: balanceAfter,
    idempotencyKey: rewardState.idempotencyKey,
    transactionId: rowId(tx),
    streakRewardCycleId: rewardState.cycleId,
    currentStreak: rewardState.currentStreak,
    claimNumber: rewardState.claimNumber,
    playerType: player.isGuest ? 'guest' : 'registered',
    guestProfile: player.isGuest,
    userPatch: {
      diamonds: balanceAfter,
      daily_calendar_current_streak: rewardState.currentStreak,
      daily_calendar_streak_anchor_date: rewardState.streakAnchorDate,
      daily_calendar_streak_reward_claim_count: rewardState.claimNumber,
      daily_calendar_last_reward_claim_at: timestamp,
      daily_quest_last_claim_at: timestamp,
      daily_quest_last_claim_date: utcDateKey(),
      daily_quest_next_available_at: nextUtcMidnightIso(utcDateKey()),
      economy_updated_at: timestamp,
    },
    grantsDiamondsOnly: true,
    noKronoxPuan: true,
    noLeaderboardImpact: true,
    rawGuestTokenServerStored: false,
  };
}

Deno.serve(async (req: Request) => {
  try {
    if (req.method !== 'POST') {
      return json({ ok: false, code: 'method_not_allowed', error: 'Bu işlem desteklenmiyor.' }, 405);
    }

    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const player = await resolveDailyCalendarPlayer(base44, body);
    if (!player.ok) return player.response;

    const serverDate = utcDateKey();
    const groupedRows = groupRowsByDate(await readPlayerCalendarRows(base44, player));
    const rewardState = buildRewardState(player, groupedRows, serverDate);
    if (!rewardState.ready) {
      return json({
        ok: false,
        code: 'daily_calendar_streak_not_ready',
        error: 'Hediye Kutusu için 7 günlük seri tamamlanmalı.',
        currentStreak: rewardState.currentStreak,
        requiredStreak: DAILY_STREAK_REWARD_DAYS,
      }, 409);
    }

    const existingTx = await findDiamondTransaction(base44, player, rewardState.idempotencyKey);
    const timestamp = nowIso();
    if (existingTx) {
      const balanceAfter = Math.max(normalizeNumber(existingTx.balance_after), normalizeNumber(player.row?.diamonds));
      await updateDailyCalendarPlayer(base44, player, claimResponse(player, existingTx, rewardState, balanceAfter, true, timestamp).userPatch).catch(() => null);
      return json(claimResponse(player, existingTx, rewardState, balanceAfter, true, timestamp));
    }

    return await withEconomyLock(base44, buildEconomyLockKey(player.playerKey), {
      actorKey: player.playerKey,
      operationId: rewardState.idempotencyKey,
    }, async () => {
      const postLockExisting = await findDiamondTransaction(base44, player, rewardState.idempotencyKey);
      if (postLockExisting) {
        const balanceAfter = Math.max(normalizeNumber(postLockExisting.balance_after), normalizeNumber(player.row?.diamonds));
        await updateDailyCalendarPlayer(base44, player, claimResponse(player, postLockExisting, rewardState, balanceAfter, true, timestamp).userPatch).catch(() => null);
        return json(claimResponse(player, postLockExisting, rewardState, balanceAfter, true, timestamp));
      }

      const balanceBefore = normalizeNumber(player.row?.diamonds, 0);
      const balanceAfter = balanceBefore + DAILY_STREAK_REWARD_DIAMONDS;
      const tx = await createDiamondTransaction(base44, player, {
        user_email: player.playerKey,
        owner_key: player.ownerKey,
        player_type: player.isGuest ? 'guest' : 'registered',
        amount: DAILY_STREAK_REWARD_DIAMONDS,
        balance_before: balanceBefore,
        balance_after: balanceAfter,
        source: DAILY_CALENDAR_REWARD_SOURCE,
        direction: 'earn',
        related_entity_type: RELATED_ENTITY_TYPE,
        related_entity_id: rewardState.cycleId,
        idempotency_key: rewardState.idempotencyKey,
        metadata: {
          runtimeVersion: DAILY_CALENDAR_RUNTIME_VERSION,
          rewardCycleId: rewardState.cycleId,
          streakAnchorDate: rewardState.streakAnchorDate,
          streakDaysRequired: DAILY_STREAK_REWARD_DAYS,
          currentStreak: rewardState.currentStreak,
          claimNumber: rewardState.claimNumber,
          rewardDiamonds: DAILY_STREAK_REWARD_DIAMONDS,
          clientRewardIgnored: true,
          grantsDiamondsOnly: true,
          noKronoxPuan: true,
          noLeaderboardImpact: true,
          rawGuestTokenServerStored: false,
        },
        created_at: timestamp,
        description: DAILY_CALENDAR_REWARD_SOURCE,
      });
      if (!tx) throw new Error('daily_calendar_streak_reward_transaction_missing');
      const response = claimResponse(player, tx, rewardState, balanceAfter, false, timestamp);
      await updateDailyCalendarPlayer(base44, player, response.userPatch);
      return json(response);
    });
  } catch (error) {
    console.error('[claimDailyQuestReward] failed', error?.message || error);
    return json({
      ok: false,
      code: 'daily_calendar_streak_claim_failed',
      error: 'Hediye Kutusu alınamadı. Tekrar dene.',
    }, 500);
  }
});
