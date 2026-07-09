import { createClientFromRequest } from 'npm:@base44/sdk@0.8.34';

const JOKER_TYPES = ['mistake_shield', 'card_swap', 'time_freeze'] as const;
const MARKET_PURCHASE_REASON = 'market_purchase';
const MARKET_SOURCE = 'market';
const DIAMOND_MARKET_PURCHASE_SOURCE = 'market_purchase';
const RELATED_ENTITY_TYPE = 'market_purchase';
const STARTER_QUANTITY = 3;
const STARTER_SOURCE = 'starter_jokers';
const STARTER_REASON = 'starter_grant';
const ECONOMY_LOCK_TTL_MS = 8_000;
const ECONOMY_LOCK_SETTLE_MS = 80;
const JOKER_NON_NEGATIVE_BALANCE_CONTRACT = Object.freeze({
  minimum: 0,
});

const JOKER_MARKET_PRODUCTS = Object.freeze({
  time_freeze: { productId: 'joker_time_freeze_1', jokerType: 'time_freeze', label: 'Zaman Dondur', price: 40 },
  card_swap: { productId: 'joker_card_swap_1', jokerType: 'card_swap', label: 'Kart Değiştir', price: 50 },
  mistake_shield: { productId: 'joker_mistake_shield_1', jokerType: 'mistake_shield', label: 'Kronokalkan', price: 60 },
});

const MARKET_DIAMOND_PRODUCTS = Object.freeze({
  joker_mistake_shield_1: {
    productId: 'joker_mistake_shield_1',
    productType: 'joker',
    label: '1 Kronokalkan',
    diamondCost: 60,
    grants: { jokers: { mistake_shield: 1 }, hints: 0 },
  },
  joker_mistake_shield_5: {
    productId: 'joker_mistake_shield_5',
    productType: 'joker',
    label: '5 Kronokalkan',
    diamondCost: 270,
    grants: { jokers: { mistake_shield: 5 }, hints: 0 },
  },
  joker_mistake_shield_15: {
    productId: 'joker_mistake_shield_15',
    productType: 'joker',
    label: '15 Kronokalkan',
    diamondCost: 720,
    grants: { jokers: { mistake_shield: 15 }, hints: 0 },
  },
  joker_time_freeze_1: {
    productId: 'joker_time_freeze_1',
    productType: 'joker',
    label: '1 Zamanı Dondur',
    diamondCost: 40,
    grants: { jokers: { time_freeze: 1 }, hints: 0 },
  },
  joker_time_freeze_5: {
    productId: 'joker_time_freeze_5',
    productType: 'joker',
    label: '5 Zamanı Dondur',
    diamondCost: 180,
    grants: { jokers: { time_freeze: 5 }, hints: 0 },
  },
  joker_time_freeze_15: {
    productId: 'joker_time_freeze_15',
    productType: 'joker',
    label: '15 Zamanı Dondur',
    diamondCost: 480,
    grants: { jokers: { time_freeze: 15 }, hints: 0 },
  },
  joker_card_swap_1: {
    productId: 'joker_card_swap_1',
    productType: 'joker',
    label: '1 Kart Değiştir',
    diamondCost: 50,
    grants: { jokers: { card_swap: 1 }, hints: 0 },
  },
  joker_card_swap_5: {
    productId: 'joker_card_swap_5',
    productType: 'joker',
    label: '5 Kart Değiştir',
    diamondCost: 225,
    grants: { jokers: { card_swap: 5 }, hints: 0 },
  },
  joker_card_swap_15: {
    productId: 'joker_card_swap_15',
    productType: 'joker',
    label: '15 Kart Değiştir',
    diamondCost: 600,
    grants: { jokers: { card_swap: 15 }, hints: 0 },
  },
  hint_5: {
    productId: 'hint_5',
    productType: 'hint',
    label: '5 İpucu',
    diamondCost: 150,
    grants: { jokers: {}, hints: 5 },
  },
  hint_15: {
    productId: 'hint_15',
    productType: 'hint',
    label: '15 İpucu',
    diamondCost: 400,
    grants: { jokers: {}, hints: 15 },
  },
  hint_40: {
    productId: 'hint_40',
    productType: 'hint',
    label: '40 İpucu',
    diamondCost: 800,
    grants: { jokers: {}, hints: 40 },
  },
  advantage_starter: {
    productId: 'advantage_starter',
    productType: 'advantage',
    label: 'Başlangıç Paketi',
    diamondCost: 250,
    grants: {
      jokers: { mistake_shield: 2, card_swap: 2, time_freeze: 2 },
      hints: 10,
    },
  },
  advantage_mega: {
    productId: 'advantage_mega',
    productType: 'advantage',
    label: 'Mega Paket',
    diamondCost: 1000,
    grants: {
      jokers: { mistake_shield: 10, card_swap: 10, time_freeze: 10 },
      hints: 30,
    },
  },
});

function json(payload: unknown, status = 200) {
  return Response.json(payload, { status });
}

function normalizeEmail(value: unknown) {
  return String(value || '').trim().toLowerCase();
}

function normalizeQuantity(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number)
    ? Math.max(JOKER_NON_NEGATIVE_BALANCE_CONTRACT.minimum, Math.floor(number))
    : JOKER_NON_NEGATIVE_BALANCE_CONTRACT.minimum;
}

function normalizeDiamondBalance(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.floor(number)) : 0;
}

function normalizeJokerType(value: unknown) {
  const type = String(value || '').trim();
  return JOKER_TYPES.includes(type as typeof JOKER_TYPES[number]) ? type : '';
}

function parsePurchaseQuantity(value: unknown) {
  if (value == null || value === '') {
    return { quantity: 1, error: '' };
  }
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) {
    return { quantity: 0, error: 'invalid_quantity' };
  }
  return { quantity: Math.min(25, Math.floor(number)), error: '' };
}

function safeText(value: unknown, fallback = '') {
  const text = String(value || '').trim();
  return text ? text.slice(0, 220) : fallback;
}

function nowIso() {
  return new Date().toISOString();
}

function emptyBalances() {
  return Object.fromEntries(JOKER_TYPES.map((jokerType) => [jokerType, 0]));
}

function rowId(row: any) {
  return row?.id || row?._id || null;
}

function isSameRow(a: any, b: any) {
  const left = rowId(a);
  const right = rowId(b);
  if (left && right) return left === right;
  return Boolean(a?.operation_id && b?.operation_id && a.operation_id === b.operation_id && a.actor_key === b.actor_key);
}

function normalizeProductId(value: unknown) {
  const productId = String(value || '').trim();
  return Object.prototype.hasOwnProperty.call(MARKET_DIAMOND_PRODUCTS, productId) ? productId : '';
}

function legacyProductIdFromBody(body: any) {
  const jokerType = normalizeJokerType(body?.jokerType || body?.joker_type);
  if (!jokerType) return '';
  const quantityResult = parsePurchaseQuantity(body?.quantity);
  if (quantityResult.error || quantityResult.quantity <= 0) return '';
  const quantity = [1, 5, 15].includes(quantityResult.quantity) ? quantityResult.quantity : 1;
  return `joker_${jokerType}_${quantity}`;
}

function getMarketProduct(body: any) {
  const productId = normalizeProductId(body?.productId || body?.product_id)
    || normalizeProductId(legacyProductIdFromBody(body));
  return productId ? MARKET_DIAMOND_PRODUCTS[productId as keyof typeof MARKET_DIAMOND_PRODUCTS] : null;
}

function normalizeJokerGrants(product: any) {
  const grants = product?.grants?.jokers && typeof product.grants.jokers === 'object'
    ? product.grants.jokers
    : {};
  return JOKER_TYPES
    .map((jokerType) => [jokerType, normalizeQuantity(grants[jokerType])] as const)
    .filter(([, quantity]) => quantity > 0);
}

function normalizeHintGrant(product: any) {
  return normalizeQuantity(product?.grants?.hints);
}

function userEntity(base44: any) {
  const serviceEntity = base44?.asServiceRole?.entities ? base44.asServiceRole.entities.User : null;
  const authEntity = base44?.entities ? base44.entities.User : null;
  return serviceEntity || authEntity;
}

function inventoryEntity(base44: any) {
  const serviceEntity = base44?.asServiceRole?.entities ? base44.asServiceRole.entities.UserJokerInventory : null;
  const authEntity = base44?.entities ? base44.entities.UserJokerInventory : null;
  return serviceEntity || authEntity;
}

function hintInventoryEntity(base44: any) {
  const serviceEntity = base44?.asServiceRole?.entities ? base44.asServiceRole.entities.UserHintInventory : null;
  const authEntity = base44?.entities ? base44.entities.UserHintInventory : null;
  return serviceEntity || authEntity;
}

function diamondTransactionEntity(base44: any) {
  const serviceEntity = base44?.asServiceRole?.entities ? base44.asServiceRole.entities.DiamondTransaction : null;
  const authEntity = base44?.entities ? base44.entities.DiamondTransaction : null;
  return serviceEntity || authEntity;
}

function jokerTransactionEntity(base44: any) {
  const serviceEntity = base44?.asServiceRole?.entities ? base44.asServiceRole.entities.JokerTransaction : null;
  const authEntity = base44?.entities ? base44.entities.JokerTransaction : null;
  return serviceEntity || authEntity;
}

function hintTransactionEntity(base44: any) {
  const serviceEntity = base44?.asServiceRole?.entities ? base44.asServiceRole.entities.HintTransaction : null;
  const authEntity = base44?.entities ? base44.entities.HintTransaction : null;
  return serviceEntity || authEntity;
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
    actor_key: safeText(context.actorKey, ''),
    operation_scope: safeText(context.operationScope, ''),
    operation_id: safeText(context.operationId, ''),
    status: 'active',
    acquired_at: now,
    expires_at: new Date(nowMs + ECONOMY_LOCK_TTL_MS).toISOString(),
    metadata: {
      phase: 'market_catalog_phase_2_economy_guard',
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

async function updateCurrentUser(base44: any, user: any, patch: Record<string, unknown>) {
  const entity = userEntity(base44);
  const id = rowId(user);
  if (entity?.update && id) return entity.update(id, patch);
  if (base44?.auth?.updateMe) return base44.auth.updateMe(patch);
  throw new Error('market_user_update_unavailable');
}

function buildStarterIdempotencyKey(email: string, jokerType: string) {
  return `${STARTER_SOURCE}:${email}:${jokerType}`;
}

function buildJokerGrantIdempotencyKey(product: any, purchaseKey: string, jokerType: string) {
  const jokerGrants = normalizeJokerGrants(product);
  const hintGrant = normalizeHintGrant(product);
  return jokerGrants.length === 1 && hintGrant === 0
    ? purchaseKey
    : `${purchaseKey}:joker:${jokerType}`;
}

function buildHintGrantIdempotencyKey(purchaseKey: string) {
  return `${purchaseKey}:hint`;
}

async function findInventory(base44: any, email: string, jokerType: string) {
  const entity = inventoryEntity(base44);
  if (!entity?.filter) return null;
  const rows = await entity
    .filter({ user_email: email, joker_type: jokerType }, '-updated_at', 10)
    .catch(() => []);
  return Array.isArray(rows) && rows.length
    ? rows.slice().sort((a, b) => {
      const quantityDiff = normalizeQuantity(b?.quantity) - normalizeQuantity(a?.quantity);
      if (quantityDiff !== 0) return quantityDiff;
      return String(b?.updated_at || b?.created_at || '').localeCompare(String(a?.updated_at || a?.created_at || ''));
    })[0]
    : null;
}

async function findHintInventory(base44: any, email: string) {
  const entity = hintInventoryEntity(base44);
  if (!entity?.filter) return null;
  const rows = await entity
    .filter({ user_email: email }, '-updated_at', 10)
    .catch(() => []);
  return Array.isArray(rows) && rows.length
    ? rows.slice().sort((a, b) => {
      const quantityDiff = normalizeQuantity(b?.quantity) - normalizeQuantity(a?.quantity);
      if (quantityDiff !== 0) return quantityDiff;
      return String(b?.updated_at || b?.created_at || '').localeCompare(String(a?.updated_at || a?.created_at || ''));
    })[0]
    : null;
}

async function readBalances(base44: any, email: string) {
  const entity = inventoryEntity(base44);
  if (!entity?.filter) return emptyBalances();
  const rows = await entity
    .filter({ user_email: email }, '-updated_at', 20)
    .catch(() => []);
  const balances = emptyBalances();
  if (Array.isArray(rows)) {
    rows.forEach((row) => {
      const type = normalizeJokerType(row?.joker_type);
      if (type) balances[type] = Math.max(balances[type], normalizeQuantity(row?.quantity));
    });
  }
  return balances;
}

async function readHintBalance(base44: any, email: string) {
  const row = await findHintInventory(base44, email);
  return normalizeQuantity(row?.quantity);
}

async function findStarterTransaction(base44: any, email: string, jokerType: string, idempotencyKey: string) {
  const entity = jokerTransactionEntity(base44);
  if (!entity?.filter) return null;
  const rows = await entity
    .filter({ user_email: email, joker_type: jokerType, idempotency_key: idempotencyKey }, '-created_at', 1)
    .catch(() => []);
  return Array.isArray(rows) && rows.length ? rows[0] : null;
}

async function upsertInventory(base44: any, existing: any, payload: Record<string, unknown>) {
  const entity = inventoryEntity(base44);
  const id = rowId(existing);
  if (id) return entity.update(id, payload);
  return entity.create(payload);
}

async function upsertHintInventory(base44: any, existing: any, payload: Record<string, unknown>) {
  const entity = hintInventoryEntity(base44);
  const id = rowId(existing);
  if (id) return entity.update(id, payload);
  return entity.create(payload);
}

async function ensureStarterJokerType(base44: any, email: string, jokerType: string) {
  const timestamp = nowIso();
  const idempotencyKey = buildStarterIdempotencyKey(email, jokerType);
  const existingTransaction = await findStarterTransaction(base44, email, jokerType, idempotencyKey);
  const existingInventory = await findInventory(base44, email, jokerType);
  const currentQuantity = normalizeQuantity(existingInventory?.quantity);

  if (existingTransaction) {
    if (!rowId(existingInventory)) {
      await upsertInventory(base44, existingInventory, {
        user_email: email,
        joker_type: jokerType,
        quantity: normalizeQuantity(existingTransaction.balance_after) || STARTER_QUANTITY,
        created_at: timestamp,
        updated_at: timestamp,
        last_transaction_id: rowId(existingTransaction),
        metadata: { starterGrantRecoveredFromLedger: true, source: MARKET_SOURCE },
      });
    }
    return;
  }

  const balanceAfter = Math.max(currentQuantity, STARTER_QUANTITY);
  const quantityDelta = Math.max(0, balanceAfter - currentQuantity);
  const transactionPayload = {
    user_email: email,
    joker_type: jokerType,
    quantity_delta: quantityDelta,
    reason: STARTER_REASON,
    source: STARTER_SOURCE,
    related_entity_type: 'user',
    related_entity_id: email,
    idempotency_key: idempotencyKey,
    balance_before: currentQuantity,
    balance_after: balanceAfter,
    created_at: timestamp,
    created_by: 'system:starter_jokers',
    metadata: {
      starterQuantity: STARTER_QUANTITY,
      phase: 'market_phase_1_lazy_starter_repair',
      invokedBy: 'purchaseJokerWithDiamonds',
    },
  };
  let transaction: any = null;
  try {
    transaction = await jokerTransactionEntity(base44).create(transactionPayload);
  } catch {
    transaction = await findStarterTransaction(base44, email, jokerType, idempotencyKey);
  }
  const latestInventory = await findInventory(base44, email, jokerType);
  const latestQuantity = normalizeQuantity(latestInventory?.quantity ?? currentQuantity);
  const finalQuantity = Math.max(latestQuantity, normalizeQuantity(transaction?.balance_after), STARTER_QUANTITY);
  await upsertInventory(base44, latestInventory || existingInventory, {
    user_email: email,
    joker_type: jokerType,
    quantity: finalQuantity,
    created_at: (latestInventory || existingInventory)?.created_at || timestamp,
    updated_at: timestamp,
    last_transaction_id: rowId(transaction),
    metadata: {
      starterGrantInitialized: true,
      invokedBy: 'purchaseJokerWithDiamonds',
    },
  });
}

async function ensureStarterInventory(base44: any, email: string) {
  await Promise.all(JOKER_TYPES.map((jokerType) => ensureStarterJokerType(base44, email, jokerType)));
}

async function findDiamondTransaction(base44: any, email: string, idempotencyKey: string) {
  const entity = diamondTransactionEntity(base44);
  if (!entity?.filter) return null;
  const rows = await entity
    .filter({ user_email: email, idempotency_key: idempotencyKey }, '-created_at', 1)
    .catch(() => []);
  return Array.isArray(rows) && rows.length ? rows[0] : null;
}

async function findJokerTransaction(base44: any, email: string, jokerType: string, idempotencyKey: string) {
  const entity = jokerTransactionEntity(base44);
  if (!entity?.filter) return null;
  const rows = await entity
    .filter({ user_email: email, joker_type: jokerType, idempotency_key: idempotencyKey }, '-created_at', 1)
    .catch(() => []);
  return Array.isArray(rows) && rows.length ? rows[0] : null;
}

async function findHintTransaction(base44: any, email: string, idempotencyKey: string) {
  const entity = hintTransactionEntity(base44);
  if (!entity?.filter) return null;
  const rows = await entity
    .filter({ user_email: email, idempotency_key: idempotencyKey }, '-created_at', 1)
    .catch(() => []);
  return Array.isArray(rows) && rows.length ? rows[0] : null;
}

async function createDiamondTransaction(base44: any, payload: Record<string, unknown>) {
  const email = normalizeEmail(payload.user_email);
  const idempotencyKey = String(payload.idempotency_key || '').trim();
  if (!email || !idempotencyKey) return null;
  const existing = await findDiamondTransaction(base44, email, idempotencyKey);
  if (existing) return existing;
  const created = await diamondTransactionEntity(base44).create({
    ...payload,
    user_email: email,
    idempotency_key: idempotencyKey,
  });
  const confirmed = await findDiamondTransaction(base44, email, idempotencyKey);
  return confirmed || created;
}

async function createJokerTransaction(base44: any, payload: Record<string, unknown>) {
  const existing = await findJokerTransaction(
    base44,
    String(payload.user_email || ''),
    String(payload.joker_type || ''),
    String(payload.idempotency_key || ''),
  );
  if (existing) return existing;
  return jokerTransactionEntity(base44).create(payload);
}

async function createHintTransaction(base44: any, payload: Record<string, unknown>) {
  const existing = await findHintTransaction(
    base44,
    String(payload.user_email || ''),
    String(payload.idempotency_key || ''),
  );
  if (existing) return existing;
  return hintTransactionEntity(base44).create(payload);
}

async function findGrantTransactions(base44: any, email: string, product: any, idempotencyKey: string) {
  const jokerEntries = normalizeJokerGrants(product);
  const hintQuantity = normalizeHintGrant(product);
  const jokerTransactions = await Promise.all(jokerEntries.map(async ([jokerType]) => ({
    jokerType,
    transaction: await findJokerTransaction(base44, email, jokerType, buildJokerGrantIdempotencyKey(product, idempotencyKey, jokerType)),
  })));
  const hintTransaction = hintQuantity > 0
    ? await findHintTransaction(base44, email, buildHintGrantIdempotencyKey(idempotencyKey))
    : null;
  const expectedCount = jokerEntries.length + (hintQuantity > 0 ? 1 : 0);
  const appliedCount = jokerTransactions.filter((item) => item.transaction).length + (hintQuantity > 0 && hintTransaction ? 1 : 0);
  return {
    jokerTransactions,
    hintTransaction,
    expectedCount,
    appliedCount,
    allApplied: expectedCount > 0 && appliedCount === expectedCount,
    anyApplied: appliedCount > 0,
  };
}

async function rollbackState(
  base44: any,
  user: any,
  jokerRollbacks: Array<{ inventory: any; quantity: number }>,
  hintRollback: { inventory: any; quantity: number } | null,
  diamondBefore: number,
  timestamp: string,
) {
  await updateCurrentUser(base44, user, {
    diamonds: diamondBefore,
    economy_updated_at: timestamp,
  }).catch(() => null);
  await Promise.all(jokerRollbacks.map((rollback) => {
    const id = rowId(rollback.inventory);
    if (!id) return null;
    return inventoryEntity(base44).update(id, {
      quantity: rollback.quantity,
      updated_at: timestamp,
      metadata: {
        ...(rollback.inventory?.metadata && typeof rollback.inventory.metadata === 'object' ? rollback.inventory.metadata : {}),
        marketRollbackReason: 'ledger_create_failed',
      },
    }).catch(() => null);
  }));
  if (hintRollback) {
    const id = rowId(hintRollback.inventory);
    if (id) {
      await hintInventoryEntity(base44).update(id, {
        quantity: hintRollback.quantity,
        updated_at: timestamp,
        metadata: {
          ...(hintRollback.inventory?.metadata && typeof hintRollback.inventory.metadata === 'object' ? hintRollback.inventory.metadata : {}),
          marketRollbackReason: 'ledger_create_failed',
        },
      }).catch(() => null);
    }
  }
}

function publicGrants(product: any) {
  return {
    jokers: Object.fromEntries(normalizeJokerGrants(product)),
    hints: normalizeHintGrant(product),
  };
}

Deno.serve(async (req: Request) => {
  try {
    if (req.method !== 'POST') {
      return json({ ok: false, code: 'method_not_allowed', error: 'Bu işlem desteklenmiyor.' }, 405);
    }

    const base44 = createClientFromRequest(req);
    let user: any = null;
    try {
      user = await base44.auth.me();
    } catch {
      return json({ ok: false, code: 'unauthenticated', error: 'Mağaza için giriş yapmalısın.' }, 401);
    }

    const email = normalizeEmail(user?.email);
    if (!email || !user?.id) {
      return json({ ok: false, code: 'unauthenticated', error: 'Mağaza için giriş yapmalısın.' }, 401);
    }

    let body: any = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    const legacyJokerType = normalizeJokerType(body?.jokerType || body?.joker_type);
    const product = getMarketProduct(body);
    if (!product) {
      return json({
        ok: false,
        code: legacyJokerType ? 'invalid_quantity' : 'invalid_product_id',
        error: legacyJokerType ? 'Satın alma adedi geçersiz.' : 'Ürün geçersiz.',
      }, 400);
    }

    const idempotencyKey = safeText(body?.idempotencyKey || body?.idempotency_key);
    if (!idempotencyKey) {
      return json({ ok: false, code: 'missing_idempotency_key', error: 'Satın alma doğrulanamadı.' }, 400);
    }

    const jokerEntries = normalizeJokerGrants(product);
    const hintQuantity = normalizeHintGrant(product);
    const needsJokerEntities = jokerEntries.length > 0;
    const needsHintEntities = hintQuantity > 0;
    const userStore = userEntity(base44);
    const inventoryStore = inventoryEntity(base44);
    const hintInventoryStore = hintInventoryEntity(base44);
    const diamondTransactionStore = diamondTransactionEntity(base44);
    const jokerTransactionStore = jokerTransactionEntity(base44);
    const hintTransactionStore = hintTransactionEntity(base44);
    const canUpdateCurrentUser = Boolean(userStore?.update || base44?.auth?.updateMe);
    const jokerReady = !needsJokerEntities || (inventoryStore?.filter && inventoryStore?.create && inventoryStore?.update && jokerTransactionStore?.filter && jokerTransactionStore?.create);
    const hintReady = !needsHintEntities || (hintInventoryStore?.filter && hintInventoryStore?.create && hintInventoryStore?.update && hintTransactionStore?.filter && hintTransactionStore?.create);
    if (!canUpdateCurrentUser || !diamondTransactionStore?.filter || !diamondTransactionStore?.create || !jokerReady || !hintReady) {
      return json({ ok: false, code: 'market_entities_missing', error: 'Mağaza kayıtları hazır değil.' }, 500);
    }

    if (needsJokerEntities) {
      await ensureStarterInventory(base44, email).catch((error: any) => {
        console.warn('[purchaseJokerWithDiamonds] starter self-heal skipped', error?.message || 'unknown');
      });
    }

    const existingDiamondTx = await findDiamondTransaction(base44, email, idempotencyKey);
    const grantState = await findGrantTransactions(base44, email, product, idempotencyKey);
    if (existingDiamondTx && grantState.allApplied) {
      const firstJokerType = jokerEntries[0]?.[0] || '';
      const balances = await readBalances(base44, email);
      return json({
        ok: true,
        alreadyApplied: true,
        productId: product.productId,
        productType: product.productType,
        productLabel: product.label,
        grants: publicGrants(product),
        jokerType: firstJokerType,
        quantity: jokerEntries[0]?.[1] || 0,
        diamondCost: normalizeDiamondBalance(existingDiamondTx.amount),
        diamondBalanceAfter: normalizeDiamondBalance(existingDiamondTx.balance_after),
        jokerBalanceAfter: firstJokerType ? normalizeQuantity(balances[firstJokerType]) : 0,
        hintBalanceAfter: await readHintBalance(base44, email),
        purchaseId: idempotencyKey,
        balances,
      });
    }
    if (existingDiamondTx || grantState.anyApplied) {
      return json({
        ok: false,
        code: 'purchase_idempotency_partial',
        error: 'Satın alma kaydı doğrulanamadı. Lütfen destek iste.',
        purchaseId: idempotencyKey,
        hasDiamondTransaction: Boolean(existingDiamondTx),
        appliedGrantRows: grantState.appliedCount,
        expectedGrantRows: grantState.expectedCount,
      }, 409);
    }

    return await withEconomyOperationLock(base44, buildEconomyLockKey(email), {
      actorKey: email,
      operationScope: 'market_purchase',
      operationId: idempotencyKey,
      metadata: {
        productId: product.productId,
        productType: product.productType,
        diamondCost: product.diamondCost,
      },
    }, async () => {
      const latestUser = await base44.auth.me().catch(() => user);
      const diamondBefore = normalizeDiamondBalance(latestUser?.diamonds);
      const diamondCost = normalizeDiamondBalance(product.diamondCost);
      if (diamondBefore < diamondCost) {
        return json({
          ok: false,
          code: 'insufficient_diamonds',
          error: 'Yeterli elmas yok.',
          productId: product.productId,
          diamondCost,
          diamondBalanceAfter: diamondBefore,
          balances: await readBalances(base44, email),
          hintBalanceAfter: await readHintBalance(base44, email),
        }, 409);
      }

      const secondExistingDiamondTx = await findDiamondTransaction(base44, email, idempotencyKey);
      const secondGrantState = await findGrantTransactions(base44, email, product, idempotencyKey);
      if (secondExistingDiamondTx || secondGrantState.anyApplied) {
        return json({
          ok: false,
          code: 'duplicate_purchase_in_progress',
          error: 'Bu satın alma zaten işleniyor.',
          purchaseId: idempotencyKey,
        }, 409);
      }

      const timestamp = nowIso();
      const diamondAfter = diamondBefore - diamondCost;
      const userPatch = {
        diamonds: diamondAfter,
        economy_updated_at: timestamp,
      };
      const jokerRollbacks: Array<{ inventory: any; quantity: number }> = [];
      let hintRollback: { inventory: any; quantity: number } | null = null;
      let hintBalanceAfter = 0;

      await updateCurrentUser(base44, rowId(latestUser) ? latestUser : user, userPatch);

      const jokerGrantResults = [];
      for (const [jokerType, quantity] of jokerEntries) {
        const inventory = await findInventory(base44, email, jokerType);
        const before = normalizeQuantity(inventory?.quantity);
        const after = before + quantity;
        const updatedInventory = await upsertInventory(base44, inventory, {
          user_email: email,
          joker_type: jokerType,
          quantity: after,
          created_at: inventory?.created_at || timestamp,
          updated_at: timestamp,
          metadata: {
            ...(inventory?.metadata && typeof inventory.metadata === 'object' ? inventory.metadata : {}),
            lastPurchaseSource: MARKET_SOURCE,
            lastPurchaseReason: MARKET_PURCHASE_REASON,
            lastPurchaseProductId: product.productId,
          },
        });
        jokerRollbacks.push({ inventory: updatedInventory || inventory, quantity: before });
        jokerGrantResults.push({ jokerType, quantity, before, after, inventory: updatedInventory || inventory });
      }

      if (hintQuantity > 0) {
        const hintInventory = await findHintInventory(base44, email);
        const before = normalizeQuantity(hintInventory?.quantity);
        const after = before + hintQuantity;
        const updatedHintInventory = await upsertHintInventory(base44, hintInventory, {
          user_email: email,
          quantity: after,
          created_at: hintInventory?.created_at || timestamp,
          updated_at: timestamp,
          metadata: {
            ...(hintInventory?.metadata && typeof hintInventory.metadata === 'object' ? hintInventory.metadata : {}),
            lastPurchaseSource: MARKET_SOURCE,
            lastPurchaseReason: MARKET_PURCHASE_REASON,
            lastPurchaseProductId: product.productId,
          },
        });
        hintRollback = { inventory: updatedHintInventory || hintInventory, quantity: before };
        hintBalanceAfter = after;
      } else {
        hintBalanceAfter = await readHintBalance(base44, email);
      }

      let diamondTransaction: any = null;
      const jokerTransactions: any[] = [];
      let hintTransaction: any = null;
      try {
        diamondTransaction = await createDiamondTransaction(base44, {
          user_email: email,
          amount: diamondCost,
          balance_before: diamondBefore,
          balance_after: diamondAfter,
          source: DIAMOND_MARKET_PURCHASE_SOURCE,
          direction: 'spend',
          related_entity_type: RELATED_ENTITY_TYPE,
          related_entity_id: idempotencyKey,
          idempotency_key: idempotencyKey,
          metadata: {
            productId: product.productId,
            productType: product.productType,
            productLabel: product.label,
            grants: publicGrants(product),
            clientPriceIgnored: true,
            noKronoxPuan: true,
            noLeaderboardImpact: true,
            phase: 'market_catalog_phase_2',
          },
          created_at: timestamp,
          description: 'market_purchase',
        });

        for (const grant of jokerGrantResults) {
          const transaction = await createJokerTransaction(base44, {
            user_email: email,
            joker_type: grant.jokerType,
            quantity_delta: grant.quantity,
            reason: MARKET_PURCHASE_REASON,
            source: MARKET_SOURCE,
            related_entity_type: RELATED_ENTITY_TYPE,
            related_entity_id: idempotencyKey,
            idempotency_key: buildJokerGrantIdempotencyKey(product, idempotencyKey, grant.jokerType),
            balance_before: grant.before,
            balance_after: grant.after,
            created_at: timestamp,
            created_by: email,
            metadata: {
              productId: product.productId,
              diamondCost,
              diamondTransactionId: rowId(diamondTransaction),
              phase: 'market_catalog_phase_2',
            },
          });
          jokerTransactions.push(transaction);
        }

        if (hintQuantity > 0) {
          hintTransaction = await createHintTransaction(base44, {
            user_email: email,
            quantity_delta: hintQuantity,
            reason: MARKET_PURCHASE_REASON,
            source: MARKET_SOURCE,
            related_entity_type: RELATED_ENTITY_TYPE,
            related_entity_id: idempotencyKey,
            idempotency_key: buildHintGrantIdempotencyKey(idempotencyKey),
            balance_before: hintRollback?.quantity || 0,
            balance_after: hintBalanceAfter,
            created_at: timestamp,
            created_by: email,
            metadata: {
              productId: product.productId,
              diamondCost,
              diamondTransactionId: rowId(diamondTransaction),
              phase: 'market_catalog_phase_2',
            },
          });
        }
      } catch (error: any) {
        await rollbackState(base44, latestUser, jokerRollbacks, hintRollback, diamondBefore, nowIso());
        console.error('[purchaseJokerWithDiamonds] ledger create failed', error?.message || error);
        return json({
          ok: false,
          code: 'market_ledger_write_failed',
          error: 'Satın alma kaydedilemedi. Lütfen tekrar dene.',
        }, 500);
      }

      await Promise.all(jokerGrantResults.map((grant, index) => {
        const finalInventoryId = rowId(grant.inventory);
        if (!finalInventoryId) return null;
        return inventoryStore.update(finalInventoryId, {
          last_transaction_id: rowId(jokerTransactions[index]),
          updated_at: timestamp,
        }).catch(() => null);
      }));
      if (hintQuantity > 0 && hintRollback?.inventory) {
        const hintInventoryId = rowId(hintRollback.inventory);
        if (hintInventoryId) {
          await hintInventoryStore.update(hintInventoryId, {
            last_transaction_id: rowId(hintTransaction),
            updated_at: timestamp,
          }).catch(() => null);
        }
      }

      const firstJokerType = jokerGrantResults[0]?.jokerType || '';
      const balances = await readBalances(base44, email);
      return json({
        ok: true,
        productId: product.productId,
        productType: product.productType,
        productLabel: product.label,
        grants: publicGrants(product),
        jokerType: firstJokerType,
        quantity: jokerGrantResults[0]?.quantity || 0,
        diamondCost,
        diamondBalanceBefore: diamondBefore,
        diamondBalanceAfter: diamondAfter,
        jokerBalanceAfter: firstJokerType ? normalizeQuantity(balances[firstJokerType]) : 0,
        hintBalanceAfter,
        purchaseId: idempotencyKey,
        balances,
        userPatch,
        purchasedAt: timestamp,
      });
    });
  } catch (error: any) {
    console.error('[purchaseJokerWithDiamonds] failed', error?.message || error);
    return json({ ok: false, code: 'market_purchase_failed', error: 'Satın alma tamamlanamadı. Tekrar dene.' }, 500);
  }
});
