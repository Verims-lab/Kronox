import { base44 } from '@/api/base44Client';

export const STARTER_HINT_QUANTITY = 3;
export const SOLO_HINT_REVEAL_STAGE_COUNT = 3;
export const HINT_INVENTORY_CACHE_TTL_MS = 20000;

export const HINT_INVENTORY_CONTRACT = [
  'Solo Hint / İpucu is separate from Joker inventory.',
  'Every player gets three starter Hints exactly once through server-side idempotent inventory initialization.',
  'Opening the Hint popup never spends inventory; a reveal stage advances only after consumeUserHint succeeds.',
  'Hint use writes HintTransaction reason solo_use and never sets JokerTransaction, joker_used, Kronox Puan, or leaderboard state.',
  'Guest players use a token-proven internal guest:<g_owner_key> economy key and receive sanitized responses only.',
].join(' ');

export function normalizeHintQuantity(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.max(0, Math.floor(numeric)) : 0;
}

function nowMs() {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now();
  }
  return Date.now();
}

function normalizeHintEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function hintBalanceCacheKey(userOrEmail) {
  return normalizeHintEmail(typeof userOrEmail === 'string'
    ? userOrEmail
    : (userOrEmail?.email || userOrEmail?.user_email));
}

const hintBalanceCache = new Map();

function cloneHintBalanceResult(result, metaPatch = {}) {
  return {
    ...(result || {}),
    hintBalance: normalizeHintQuantity(result?.hintBalance ?? result?.balance ?? result?.quantity),
    meta: {
      ...(result?.meta || {}),
      ...metaPatch,
    },
  };
}

function getCachedHintBalance(userOrEmail) {
  const key = hintBalanceCacheKey(userOrEmail);
  if (!key) return null;
  const cached = hintBalanceCache.get(key);
  if (!cached || nowMs() - cached.storedAt > HINT_INVENTORY_CACHE_TTL_MS) {
    hintBalanceCache.delete(key);
    return null;
  }
  return cloneHintBalanceResult(cached.result, {
    cacheHit: true,
    cacheTtlMs: HINT_INVENTORY_CACHE_TTL_MS,
  });
}

export function setCachedHintBalance(userOrEmail, hintBalance, meta = {}) {
  const key = hintBalanceCacheKey(userOrEmail);
  if (!key) return;
  hintBalanceCache.set(key, {
    storedAt: nowMs(),
    result: {
      ok: true,
      hintBalance: normalizeHintQuantity(hintBalance),
      meta: {
        queryPath: meta.queryPath || 'UserHintInventory.mutation_result',
        cacheUpdatedByMutation: true,
        ...meta,
      },
    },
  });
}

export function invalidateHintBalanceCache(userOrEmail) {
  const key = hintBalanceCacheKey(userOrEmail);
  if (key) hintBalanceCache.delete(key);
}

export function clearHintBalanceCache() {
  hintBalanceCache.clear();
}

function selectPrimaryHintInventoryRow(rows = []) {
  return rows.slice().sort((a, b) => {
    const quantityDiff = normalizeHintQuantity(b?.quantity) - normalizeHintQuantity(a?.quantity);
    if (quantityDiff !== 0) return quantityDiff;
    return String(b?.updated_at || b?.created_at || '').localeCompare(String(a?.updated_at || a?.created_at || ''));
  })[0] || null;
}

async function readOwnHintInventoryRows(userOrEmail) {
  const email = hintBalanceCacheKey(userOrEmail);
  if (!email) return [];
  const entity = base44?.entities?.UserHintInventory;
  if (!entity?.filter) return [];
  const rows = await entity.filter({ user_email: email }, '-updated_at', 10);
  return (Array.isArray(rows) ? rows : []).filter((row) => normalizeHintEmail(row?.user_email) === email);
}

export async function getUserHintBalance(user, options = {}) {
  const email = hintBalanceCacheKey(user);
  if (!email) {
    return { ok: false, reason: 'missing_user_email', hintBalance: 0 };
  }
  if (!options.forceRefresh) {
    const cached = getCachedHintBalance(email);
    if (cached) return cached;
  }
  const rows = await readOwnHintInventoryRows(email);
  const primary = selectPrimaryHintInventoryRow(rows);
  const result = {
    ok: true,
    initialized: Boolean(primary),
    hintBalance: normalizeHintQuantity(primary?.quantity),
    meta: {
      queryPath: 'UserHintInventory.fast_read',
      inventoryRows: rows.length,
      currentBalanceSource: 'UserHintInventory.quantity',
      ledgerScanned: false,
      displayOnlyRead: true,
      noInventoryMutation: true,
      noKronoxPuan: true,
      noLeaderboardImpact: true,
    },
  };
  hintBalanceCache.set(email, { storedAt: nowMs(), result });
  return cloneHintBalanceResult(result);
}

export function normalizeHintRevealStage(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.min(SOLO_HINT_REVEAL_STAGE_COUNT, Math.floor(numeric)));
}

function safeKeyPart(value, fallback = 'unknown') {
  const text = String(value || '').trim();
  return (text || fallback).replace(/[^a-zA-Z0-9_.:@-]/g, '_').slice(0, 120);
}

function normalizeFunctionResult(response) {
  const data = response?.data && typeof response.data === 'object' ? response.data : response;
  return data && typeof data === 'object' ? data : {};
}

export function buildSoloHintUseIdempotencyKey({ soloAttemptId, questionId, revealStage } = {}) {
  const stage = normalizeHintRevealStage(revealStage);
  if (!stage) return '';
  return [
    'solo_hint',
    safeKeyPart(soloAttemptId, 'solo_attempt'),
    safeKeyPart(questionId, 'question'),
    `stage_${stage}`,
  ].join(':');
}

export async function ensureUserHintInventory({ guestCredentials = null } = {}) {
  const payload = guestCredentials && typeof guestCredentials === 'object' ? guestCredentials : {};
  const response = await base44.functions.invoke('ensureUserHintInventory', payload);
  const data = normalizeFunctionResult(response);
  return {
    ...data,
    hintBalance: normalizeHintQuantity(data.hintBalance ?? data.balance ?? data.quantity),
    starterQuantity: normalizeHintQuantity(data.starterQuantity ?? STARTER_HINT_QUANTITY),
  };
}

export async function consumeUserHint({
  guestCredentials = null,
  idempotencyKey,
  soloAttemptId,
  soloLevelNumber,
  questionId,
  revealStage,
} = {}) {
  const stage = normalizeHintRevealStage(revealStage);
  const payload = {
    ...(guestCredentials && typeof guestCredentials === 'object' ? guestCredentials : {}),
    idempotencyKey: String(idempotencyKey || '').trim(),
    soloAttemptId: String(soloAttemptId || '').trim(),
    soloLevelNumber: Number.isFinite(Number(soloLevelNumber)) ? Math.floor(Number(soloLevelNumber)) : null,
    questionId: String(questionId || '').trim(),
    revealStage: stage,
    relatedEntityType: 'solo_question',
    relatedEntityId: String(questionId || '').trim(),
  };
  const response = await base44.functions.invoke('consumeUserHint', payload);
  const data = normalizeFunctionResult(response);
  return {
    ...data,
    hintBalance: normalizeHintQuantity(data.hintBalance ?? data.balanceAfter ?? data.balance),
    revealStage: normalizeHintRevealStage(data.revealStage ?? stage),
  };
}
