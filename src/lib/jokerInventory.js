import { base44 } from '@/api/base44Client';

export const JOKER_TYPES = Object.freeze({
  MISTAKE_SHIELD: 'mistake_shield',
  CARD_SWAP: 'card_swap',
  TIME_FREEZE: 'time_freeze',
});

export const STARTER_JOKER_QUANTITY = 3;
export const JOKER_STARTER_SOURCE = 'starter_jokers';
export const JOKER_NON_NEGATIVE_BALANCE_CONTRACT = Object.freeze({
  "minimum": 0,
});
export const JOKER_TRANSACTION_REASONS = Object.freeze({
  STARTER_GRANT: 'starter_grant',
  ADMIN_ADJUSTMENT: 'admin_adjustment',
  SOLO_USE: 'solo_use',
  MARKET_PURCHASE: 'market_purchase',
  ACCOUNT_LINK_MERGE: 'account_link_merge',
  REFUND: 'refund',
  CORRECTION: 'correction',
});

export const JOKER_DEFINITIONS = Object.freeze([
  { type: JOKER_TYPES.MISTAKE_SHIELD, label: 'Kronokalkan', shortLabel: 'Kalkan' },
  { type: JOKER_TYPES.CARD_SWAP, label: 'Kart Değiştir', shortLabel: 'Değiştir' },
  { type: JOKER_TYPES.TIME_FREEZE, label: 'Zaman Dondur', shortLabel: 'Dondur' },
]);

export const SOLO_UI_JOKER_TYPES = Object.freeze({
  MISTAKE_SHIELD: 'mistakeShield',
  CARD_SWAP: 'swapCard',
  TIME_FREEZE: 'freezeTime',
});

export const SOLO_UI_TO_INVENTORY_JOKER_TYPE = Object.freeze({
  [SOLO_UI_JOKER_TYPES.MISTAKE_SHIELD]: JOKER_TYPES.MISTAKE_SHIELD,
  [SOLO_UI_JOKER_TYPES.CARD_SWAP]: JOKER_TYPES.CARD_SWAP,
  [SOLO_UI_JOKER_TYPES.TIME_FREEZE]: JOKER_TYPES.TIME_FREEZE,
});

export const PHASE2_SOLO_JOKER_CONSUMPTION_CONTRACT = [
  'Solo joker buttons read user-owned balances.',
  'The count badge shows actual owned balance.',
  'One joker may be used per question/card.',
  'Any number of jokers may be used across a level if the user owns them.',
  'A joker spend writes JokerTransaction reason solo_use after the effect is validated.',
  'used jokers are not refunded on fail, timeout, or exit.',
  'Used jokers are not refunded on fail/exit.',
].join(' ');

export const JOKER_INVENTORY_SELF_HEAL_CONTRACT = [
  'Missing UserJokerInventory self-heals for authenticated users.',
  'Partial inventory rows self-heal missing joker types.',
  'Duplicate or malformed UserJokerInventory rows do not crash Joker Çantası.',
  'Existing joker balances are preserved and not overwritten by ensure.',
  'Profile and Solo use the same normalized user_email inventory source.',
].join(' ');

export const JOKER_INVENTORY_FAST_LOAD_CONTRACT = [
  'Profile and Solo read current balances from UserJokerInventory before self-heal.',
  'JokerTransaction is ledger only and is not scanned during render-time balance reads.',
  'Profile Joker Çantası renders the fast UserJokerInventory result before background self-heal refresh.',
  'Self-heal runs only when UserJokerInventory rows are missing or partial, or when forced.',
  'Market purchase and Solo spend update the per-user joker balance cache.',
  'The balance cache is keyed by normalized user email and is cleared on logout.',
].join(' ');

export const JOKER_ECONOMY_INDEX_GUARD_CONTRACT = [
  'UserJokerInventory logical unique key is user_email + joker_type.',
  'JokerTransaction logical unique key is idempotency_key when present.',
  'Profile normal display reads UserJokerInventory and does not read JokerTransaction.',
  'Mutation functions query idempotency_key before JokerTransaction writes.',
  'Duplicate inventory rows are tolerated by selecting the highest current quantity.',
].join(' ');

export const JOKER_INVENTORY_CACHE_TTL_MS = 20000;

const jokerBalanceCache = new Map();
const jokerBalanceInflight = new Map();

export function normalizeJokerEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function jokerEmailVariants(userOrEmail) {
  const raw = typeof userOrEmail === 'string'
    ? userOrEmail
    : (userOrEmail?.email || userOrEmail?.user_email || '');
  return Array.from(new Set([
    String(raw || '').trim(),
    normalizeJokerEmail(raw),
  ].filter(Boolean)));
}

export function normalizeJokerQuantity(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return JOKER_NON_NEGATIVE_BALANCE_CONTRACT["minimum"];
  return Math.max(JOKER_NON_NEGATIVE_BALANCE_CONTRACT["minimum"], Math.floor(numeric));
}

export function emptyJokerBalances(fill = 0) {
  return JOKER_DEFINITIONS.reduce((acc, joker) => {
    acc[joker.type] = normalizeJokerQuantity(fill);
    return acc;
  }, {});
}

export function buildStarterJokerIdempotencyKey(userEmail, jokerType) {
  const email = normalizeJokerEmail(userEmail);
  if (!email || !isKnownJokerType(jokerType)) return '';
  return `${JOKER_STARTER_SOURCE}:${email}:${jokerType}`;
}

export function isKnownJokerType(jokerType) {
  return JOKER_DEFINITIONS.some((joker) => joker.type === jokerType);
}

export function soloUiJokerTypeToInventoryType(jokerType) {
  const mapped = SOLO_UI_TO_INVENTORY_JOKER_TYPE[jokerType];
  return isKnownJokerType(mapped) ? mapped : '';
}

export function canApplyJokerTransaction(currentQuantity, quantityDelta) {
  const current = normalizeJokerQuantity(currentQuantity);
  const delta = Number(quantityDelta);
  if (!Number.isFinite(delta)) return false;
  return current + Math.trunc(delta) >= 0;
}

function normalizeLedgerDelta(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.trunc(numeric) : 0;
}

function jokerReconciliationKey(userEmail, jokerType) {
  const email = normalizeJokerEmail(userEmail);
  return email && isKnownJokerType(jokerType) ? `${email}:${jokerType}` : '';
}

export function buildJokerInventoryLedgerReconciliation(inventoryRows = [], transactionRows = []) {
  const inventoryByKey = new Map();
  const ledgerByKey = new Map();

  (Array.isArray(inventoryRows) ? inventoryRows : []).forEach((row) => {
    const jokerType = row?.joker_type || row?.jokerType;
    const key = jokerReconciliationKey(row?.user_email || row?.userEmail, jokerType);
    if (!key) return;
    const quantity = normalizeJokerQuantity(row?.quantity);
    const existing = inventoryByKey.get(key);
    if (!existing || quantity > existing.quantity) {
      inventoryByKey.set(key, {
        userEmail: normalizeJokerEmail(row?.user_email || row?.userEmail),
        jokerType,
        quantity,
        rowId: row?.id || row?._id || null,
      });
    }
  });

  (Array.isArray(transactionRows) ? transactionRows : []).forEach((row) => {
    const jokerType = row?.joker_type || row?.jokerType;
    const key = jokerReconciliationKey(row?.user_email || row?.userEmail, jokerType);
    if (!key) return;
    const bucket = ledgerByKey.get(key) || {
      userEmail: normalizeJokerEmail(row?.user_email || row?.userEmail),
      jokerType,
      summedDelta: 0,
      latestBalanceAfter: null,
      latestCreatedAt: '',
      transactionCount: 0,
    };
    bucket.summedDelta += normalizeLedgerDelta(row?.quantity_delta);
    bucket.transactionCount += 1;
    const createdAt = String(row?.created_at || row?.createdAt || '');
    if (!bucket.latestCreatedAt || createdAt >= bucket.latestCreatedAt) {
      bucket.latestCreatedAt = createdAt;
      bucket.latestBalanceAfter = normalizeJokerQuantity(row?.balance_after);
    }
    ledgerByKey.set(key, bucket);
  });

  const rows = Array.from(new Set([...inventoryByKey.keys(), ...ledgerByKey.keys()]))
    .sort()
    .map((key) => {
      const inventory = inventoryByKey.get(key) || null;
      const ledger = ledgerByKey.get(key) || null;
      const inventoryQuantity = normalizeJokerQuantity(inventory?.quantity);
      const ledgerBalanceAfter = ledger?.latestBalanceAfter;
      const ledgerSummedDelta = normalizeJokerQuantity(ledger?.summedDelta);
      const matchesLatestLedger = ledgerBalanceAfter === null || inventoryQuantity === ledgerBalanceAfter;
      const matchesDeltaSum = !ledger || inventoryQuantity === ledgerSummedDelta;
      return {
        key,
        userEmail: inventory?.userEmail || ledger?.userEmail || '',
        jokerType: inventory?.jokerType || ledger?.jokerType || '',
        inventoryQuantity,
        ledgerBalanceAfter,
        ledgerSummedDelta,
        transactionCount: ledger?.transactionCount || 0,
        matchesLatestLedger,
        matchesDeltaSum,
        ok: Boolean(inventory) && Boolean(ledger) && matchesLatestLedger && matchesDeltaSum,
      };
    });

  return {
    ok: rows.every((row) => row.ok),
    checkedCount: rows.length,
    mismatches: rows.filter((row) => !row.ok),
    rows,
  };
}

export function normalizeJokerBalances(input) {
  const balances = emptyJokerBalances();
  if (Array.isArray(input)) {
    input.forEach((row) => {
      const type = row?.joker_type || row?.jokerType || row?.type;
      if (isKnownJokerType(type)) {
        balances[type] = Math.max(balances[type], normalizeJokerQuantity(row?.quantity));
      }
    });
    return balances;
  }
  if (input && typeof input === 'object') {
    JOKER_DEFINITIONS.forEach((joker) => {
      balances[joker.type] = normalizeJokerQuantity(input[joker.type]);
    });
  }
  return balances;
}

function unwrapFunctionResponse(response) {
  if (response?.data?.data && typeof response.data.data === 'object') return response.data.data;
  if (response?.data && typeof response.data === 'object') return response.data;
  if (response && typeof response === 'object') return response;
  return {};
}

function unwrapInvokeError(error) {
  if (error?.body && typeof error.body === 'object') return error.body;
  if (error?.response) return unwrapFunctionResponse(error.response);
  if (error?.data) return unwrapFunctionResponse({ data: error.data });
  return {};
}

function safeJokerSpendError(errorOrBody, fallback = 'Joker kullanılamadı. Lütfen tekrar dene.') {
  const body = errorOrBody?.response || errorOrBody?.body || errorOrBody?.data
    ? unwrapInvokeError(errorOrBody)
    : errorOrBody;
  const code = String(body?.code || '').trim();
  if (code === 'insufficient_joker_balance') return 'Bu jokerden kalmadı.';
  if (code === 'invalid_joker_type') return 'Joker türü geçersiz.';
  if (code === 'invalid_joker_context') return 'Joker yalnızca Solo modda kullanılabilir.';
  if (code === 'missing_idempotency_key') return 'Joker işlemi doğrulanamadı.';
  if (code === 'unauthenticated' || code === 'missing_user_email') return 'Joker kullanmak için giriş yapmalısın.';
  if (code === 'joker_inventory_entity_missing') return 'Joker kayıtları hazır değil.';
  return fallback;
}

function nowMs() {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now();
  }
  return Date.now();
}

function elapsedMs(startedAt) {
  return Math.max(0, Math.round(nowMs() - startedAt));
}

function completeKnownInventoryRows(rows) {
  if (!Array.isArray(rows)) return false;
  const knownRows = rows.filter((row) => isKnownJokerType(row?.joker_type));
  if (knownRows.length !== JOKER_DEFINITIONS.length) return false;
  return JOKER_DEFINITIONS.every((joker) => knownRows.filter((row) => row?.joker_type === joker.type).length === 1);
}

function missingKnownJokerTypes(rows) {
  const rowTypes = new Set((Array.isArray(rows) ? rows : [])
    .map((row) => row?.joker_type)
    .filter((type) => isKnownJokerType(type)));
  return JOKER_DEFINITIONS
    .map((joker) => joker.type)
    .filter((type) => !rowTypes.has(type));
}

function publicInventoryRows(rows) {
  return (Array.isArray(rows) ? rows : [])
    .filter((row) => isKnownJokerType(row?.joker_type))
    .map((row) => ({
      id: row.id,
      jokerType: row.joker_type,
      quantity: normalizeJokerQuantity(row.quantity),
      updatedAt: row.updated_at || row.created_at || null,
    }));
}

function cloneInventoryResult(result, metaPatch = {}) {
  const balances = normalizeJokerBalances(result?.balances || result?.items);
  return {
    ...(result || {}),
    balances,
    items: Array.isArray(result?.items) ? result.items.map((item) => ({ ...item })) : [],
    meta: {
      ...(result?.meta || {}),
      ...metaPatch,
    },
  };
}

function cacheKeyFor(userOrEmail) {
  return normalizeJokerEmail(typeof userOrEmail === 'string'
    ? userOrEmail
    : (userOrEmail?.email || userOrEmail?.user_email));
}

function getCachedJokerInventory(email) {
  const key = cacheKeyFor(email);
  if (!key) return null;
  const cached = jokerBalanceCache.get(key);
  if (!cached || nowMs() - cached.storedAt > JOKER_INVENTORY_CACHE_TTL_MS) {
    jokerBalanceCache.delete(key);
    return null;
  }
  return cloneInventoryResult(cached.result, {
    cacheHit: true,
    cacheTtlMs: JOKER_INVENTORY_CACHE_TTL_MS,
    queryPath: 'UserJokerInventory.cache',
  });
}

function setCachedJokerInventory(email, result) {
  const key = cacheKeyFor(email);
  if (!key || !result) return;
  jokerBalanceCache.set(key, {
    storedAt: nowMs(),
    result: cloneInventoryResult(result, {
      cacheHit: false,
      cacheKeyUserScoped: true,
    }),
  });
}

export function setCachedJokerBalances(userOrEmail, balances, meta = {}) {
  const email = cacheKeyFor(userOrEmail);
  if (!email) return;
  setCachedJokerInventory(email, {
    ok: true,
    initialized: false,
    balances: normalizeJokerBalances(balances),
    items: [],
    meta: {
      queryPath: meta.queryPath || 'UserJokerInventory.mutation_result',
      invalidatedBy: meta.invalidatedBy || '',
      cacheUpdatedByMutation: true,
      ...meta,
    },
  });
}

export function invalidateJokerInventoryCache(userOrEmail) {
  const key = cacheKeyFor(userOrEmail);
  if (key) jokerBalanceCache.delete(key);
}

export function clearJokerInventoryCache() {
  jokerBalanceCache.clear();
  jokerBalanceInflight.clear();
}

async function readOwnInventoryRows(userOrEmail, options = {}) {
  const normalized = cacheKeyFor(userOrEmail);
  const variants = options.includeLegacyVariants ? jokerEmailVariants(userOrEmail) : [normalized].filter(Boolean);
  if (!variants.length) return [];
  const entity = base44?.entities?.UserJokerInventory;
  if (!entity?.filter) return [];
  const batches = await Promise.all(variants.map((email) => entity
    .filter({ user_email: email }, '-updated_at', 20)
    .catch(() => [])));
  const seen = new Set();
  return batches
    .flatMap((rows) => (Array.isArray(rows) ? rows : []))
    .filter((row) => {
      const id = row?.id || row?._id || `${row?.user_email}:${row?.joker_type}:${row?.updated_at}:${row?.quantity}`;
      if (!id || seen.has(id)) return false;
      seen.add(id);
      return true;
    });
}

function inventoryRowsResult(email, rows, meta = {}) {
  const rowList = Array.isArray(rows) ? rows : [];
  return {
    ok: true,
    initialized: false,
    balances: normalizeJokerBalances(rowList),
    items: publicInventoryRows(rowList),
    meta: {
      queryPath: 'UserJokerInventory.fast_read',
      entityCallCount: 1,
      inventoryRows: rowList.length,
      completeInventory: completeKnownInventoryRows(rowList),
      missingTypes: missingKnownJokerTypes(rowList),
      selfHealNeeded: !completeKnownInventoryRows(rowList),
      normalizedOwnerKey: Boolean(email),
      ...meta,
    },
  };
}

export async function ensureStarterJokers(user, options = {}) {
  const email = normalizeJokerEmail(user?.email || user?.user_email);
  if (!email) {
    return {
      ok: false,
      initialized: false,
      reason: 'missing_user_email',
      balances: emptyJokerBalances(),
      items: [],
    };
  }

  const startedAt = nowMs();
  if (!options.forceRefresh) {
    const cached = getCachedJokerInventory(email);
    if (cached?.meta?.completeInventory) {
      return cloneInventoryResult(cached, {
        ...cached.meta,
        durationMs: elapsedMs(startedAt),
        ensureSkipped: true,
      });
    }
  }

  const inflightKey = `ensure:${email}`;
  if (!options.forceRefresh && jokerBalanceInflight.has(inflightKey)) {
    const shared = await jokerBalanceInflight.get(inflightKey);
    return cloneInventoryResult(shared, {
      ...shared.meta,
      durationMs: elapsedMs(startedAt),
      sharedRequest: true,
    });
  }

  const promise = (async () => {
    const rows = await readOwnInventoryRows(email);
    const missingTypes = missingKnownJokerTypes(rows);
    if (!options.forceEnsure && completeKnownInventoryRows(rows)) {
      const result = inventoryRowsResult(email, rows, {
        durationMs: elapsedMs(startedAt),
        ensureSkipped: true,
        selfHealNeeded: false,
      });
      setCachedJokerInventory(email, result);
      return result;
    }

    const response = await base44.functions.invoke('ensureUserJokerInventory', {});
    const body = unwrapFunctionResponse(response);
    if (body?.ok === false) {
      const error = new Error(body?.error || body?.code || 'joker_inventory_init_failed');
      error.body = body;
      throw error;
    }
    const result = {
      ok: true,
      ...body,
      balances: normalizeJokerBalances(body?.balances || body?.items),
      meta: {
        queryPath: 'ensureUserJokerInventory.self_heal',
        entityCallCount: 1,
        inventoryRows: Array.isArray(body?.items) ? body.items.length : 0,
        completeInventory: true,
        missingTypes,
        selfHealNeeded: false,
        selfHealed: Boolean(body?.selfHealed),
        initialized: Boolean(body?.initialized),
        backendDurationMs: body?.performance?.durationMs,
        parallelSelfHeal: Boolean(body?.performance?.parallelSelfHeal),
        durationMs: elapsedMs(startedAt),
      },
    };
    setCachedJokerInventory(email, result);
    return result;
  })();

  jokerBalanceInflight.set(inflightKey, promise);
  try {
    return await promise;
  } finally {
    jokerBalanceInflight.delete(inflightKey);
  }
}

export async function getUserJokerBalances(user, options = {}) {
  const email = normalizeJokerEmail(user?.email || user?.user_email);
  const startedAt = nowMs();
  if (!email) {
    return { ok: false, reason: 'missing_user_email', balances: emptyJokerBalances(), items: [] };
  }

  if (!options.forceRefresh) {
    const cached = getCachedJokerInventory(email);
    if (cached) {
      return cloneInventoryResult(cached, {
        ...cached.meta,
        durationMs: elapsedMs(startedAt),
      });
    }
  }

  if (options.ensureStarter !== false) {
    try {
      return await ensureStarterJokers(user, options);
    } catch (error) {
      const rows = await readOwnInventoryRows(user).catch(() => []);
      if (rows.length > 0) {
        const result = {
          ok: true,
          initialized: false,
          ensureFailedButReadable: true,
          reason: error?.body?.code || error?.message || 'joker_inventory_ensure_failed',
          balances: normalizeJokerBalances(rows),
          items: publicInventoryRows(rows),
          meta: {
            queryPath: 'UserJokerInventory.fast_read_after_ensure_error',
            entityCallCount: 2,
            inventoryRows: rows.length,
            completeInventory: completeKnownInventoryRows(rows),
            missingTypes: missingKnownJokerTypes(rows),
            selfHealNeeded: !completeKnownInventoryRows(rows),
            durationMs: elapsedMs(startedAt),
          },
        };
        setCachedJokerInventory(email, result);
        return result;
      }
      throw error;
    }
  }

  const rows = await readOwnInventoryRows(user);
  const result = inventoryRowsResult(email, rows, {
    durationMs: elapsedMs(startedAt),
    selfHealSkipped: true,
  });
  setCachedJokerInventory(email, result);
  return result;
}

export function buildSoloJokerUseIdempotencyKey(userEmail, attemptId, questionKey, jokerType) {
  const email = normalizeJokerEmail(userEmail);
  const type = soloUiJokerTypeToInventoryType(jokerType) || jokerType;
  if (!email || !isKnownJokerType(type)) return '';
  const attempt = String(attemptId || 'solo_attempt').trim() || 'solo_attempt';
  const key = String(questionKey || 'question').trim() || 'question';
  return `solo_use:${email}:${attempt}:${key}:${type}`.replace(/[^a-zA-Z0-9_.:@-]/g, '_');
}

export async function spendUserJoker(user, options = {}) {
  const email = normalizeJokerEmail(user?.email || user?.user_email);
  const jokerType = soloUiJokerTypeToInventoryType(options.jokerType) || options.jokerType;
  if (!email) {
    return { ok: false, code: 'missing_user_email', error: 'Joker kullanmak için giriş yapmalısın.', balances: emptyJokerBalances() };
  }
  if (!isKnownJokerType(jokerType)) {
    return { ok: false, code: 'invalid_joker_type', error: 'Joker türü geçersiz.', balances: emptyJokerBalances() };
  }

  let response;
  try {
    response = await base44.functions.invoke('spendUserJoker', {
      mode: 'solo',
      jokerType,
      idempotencyKey: options.idempotencyKey,
      relatedEntityType: options.relatedEntityType,
      relatedEntityId: options.relatedEntityId,
      metadata: options.metadata,
    });
  } catch (error) {
    const body = unwrapInvokeError(error);
    invalidateJokerInventoryCache(email);
    return {
      ok: false,
      code: body?.code || 'joker_spend_request_failed',
      error: safeJokerSpendError(error),
      jokerType,
      balances: normalizeJokerBalances(body?.balances),
      balanceAfter: normalizeJokerQuantity(body?.balanceAfter),
    };
  }
  const body = unwrapFunctionResponse(response);
  const result = {
    ...body,
    ok: body?.ok !== false,
    error: body?.ok === false ? safeJokerSpendError(body) : body?.error,
    jokerType,
    balances: normalizeJokerBalances(body?.balances),
    balanceAfter: normalizeJokerQuantity(body?.balanceAfter ?? body?.inventory?.quantity),
  };
  if (result.ok) {
    setCachedJokerBalances(email, result.balances, {
      queryPath: 'spendUserJoker.mutation_result',
      invalidatedBy: 'solo_spend',
    });
  } else {
    invalidateJokerInventoryCache(email);
  }
  return result;
}

export async function applyJokerTransaction(user, jokerType, quantityDelta, reason, options = {}) {
  if (Number(quantityDelta) === -1 && reason === JOKER_TRANSACTION_REASONS.SOLO_USE) {
    return spendUserJoker(user, { ...options, jokerType });
  }
  throw new Error('joker_transaction_server_only_for_non_solo_spends');
}
