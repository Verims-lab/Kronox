import { createClientFromRequest } from 'npm:@base44/sdk@0.8.34';

const JOKER_TYPES = ['mistake_shield', 'card_swap', 'time_freeze'] as const;
const MARKET_PURCHASE_REASON = 'market_purchase';
const MARKET_SOURCE = 'market';
const DIAMOND_MARKET_PURCHASE_SOURCE = 'market_purchase';
const RELATED_ENTITY_TYPE = 'joker_purchase';
const STARTER_QUANTITY = 3;
const STARTER_SOURCE = 'starter_jokers';
const STARTER_REASON = 'starter_grant';
const ECONOMY_LOCK_TTL_MS = 8_000;
const ECONOMY_LOCK_SETTLE_MS = 80;
const JOKER_NON_NEGATIVE_BALANCE_CONTRACT = Object.freeze({
  "minimum": 0,
});
const JOKER_MARKET_PRODUCTS = Object.freeze({
  time_freeze: { jokerType: 'time_freeze', label: 'Zaman Dondur', price: 40 },
  card_swap: { jokerType: 'card_swap', label: 'Kart Değiştir', price: 50 },
  mistake_shield: { jokerType: 'mistake_shield', label: 'Kronokalkan', price: 60 },
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
    ? Math.max(JOKER_NON_NEGATIVE_BALANCE_CONTRACT["minimum"], Math.floor(number))
    : JOKER_NON_NEGATIVE_BALANCE_CONTRACT["minimum"];
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

function userEntity(base44: any) {
  // Runtime/deployability contract: Mağaza purchase explicitly binds
  // entities.User while retaining service-role preference for the balance write.
  const serviceEntity = base44?.asServiceRole?.entities ? base44.asServiceRole.entities.User : null;
  const authEntity = base44?.entities ? base44.entities.User : null;
  return serviceEntity || authEntity;
}

function inventoryEntity(base44: any) {
  // Runtime/deployability contract: Mağaza purchase explicitly binds
  // entities.UserJokerInventory while retaining service-role preference.
  const serviceEntity = base44?.asServiceRole?.entities ? base44.asServiceRole.entities.UserJokerInventory : null;
  const authEntity = base44?.entities ? base44.entities.UserJokerInventory : null;
  return serviceEntity || authEntity;
}

function diamondTransactionEntity(base44: any) {
  // Runtime/deployability contract: Mağaza purchase explicitly binds
  // entities.DiamondTransaction while retaining service-role preference.
  const serviceEntity = base44?.asServiceRole?.entities ? base44.asServiceRole.entities.DiamondTransaction : null;
  const authEntity = base44?.entities ? base44.entities.DiamondTransaction : null;
  return serviceEntity || authEntity;
}

function jokerTransactionEntity(base44: any) {
  // Runtime/deployability contract: Mağaza purchase explicitly binds
  // entities.JokerTransaction while retaining service-role preference.
  const serviceEntity = base44?.asServiceRole?.entities ? base44.asServiceRole.entities.JokerTransaction : null;
  const authEntity = base44?.entities ? base44.entities.JokerTransaction : null;
  return serviceEntity || authEntity;
}

function economyOperationLockEntity(base44: any) {
  // EconomyOperationLock is backend-owned. It is a function-level concurrency
  // guard, not a replacement for DB unique/transactional proof.
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

function publicInventoryRow(row: any) {
  return {
    id: rowId(row),
    jokerType: row?.joker_type || '',
    quantity: normalizeQuantity(row?.quantity),
    updatedAt: row?.updated_at || row?.created_at || null,
  };
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
  for (const jokerType of JOKER_TYPES) {
    await ensureStarterJokerType(base44, email, jokerType);
  }
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

async function rollbackState(base44: any, user: any, inventory: any, diamondBefore: number, jokerBefore: number, timestamp: string) {
  await updateCurrentUser(base44, user, {
    diamonds: diamondBefore,
    economy_updated_at: timestamp,
  }).catch(() => null);
  const id = rowId(inventory);
  if (id) {
    await inventoryEntity(base44).update(id, {
      quantity: jokerBefore,
      updated_at: timestamp,
      metadata: {
        ...(inventory.metadata && typeof inventory.metadata === 'object' ? inventory.metadata : {}),
        marketRollbackReason: 'ledger_create_failed',
      },
    }).catch(() => null);
  }
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


    const jokerType = normalizeJokerType(body?.jokerType || body?.joker_type);
    const product = jokerType ? JOKER_MARKET_PRODUCTS[jokerType as keyof typeof JOKER_MARKET_PRODUCTS] : null;
    if (!jokerType || !product) {
      return json({ ok: false, code: 'invalid_joker_type', error: 'Joker türü geçersiz.' }, 400);
    }

    const quantityResult = parsePurchaseQuantity(body?.quantity);
    if (quantityResult.error || quantityResult.quantity <= 0) {
      return json({ ok: false, code: 'invalid_quantity', error: 'Satın alma adedi geçersiz.' }, 400);
    }
    const quantity = quantityResult.quantity;
    const idempotencyKey = safeText(body?.idempotencyKey || body?.idempotency_key);
    if (!idempotencyKey) {
      return json({ ok: false, code: 'missing_idempotency_key', error: 'Satın alma doğrulanamadı.' }, 400);
    }

    const userStore = userEntity(base44);
    const inventoryStore = inventoryEntity(base44);
    const diamondTransactionStore = diamondTransactionEntity(base44);
    const jokerTransactionStore = jokerTransactionEntity(base44);
    const canUpdateCurrentUser = Boolean(userStore?.update || base44?.auth?.updateMe);
    if (!canUpdateCurrentUser || !inventoryStore?.filter || !inventoryStore?.create || !inventoryStore?.update || !diamondTransactionStore?.filter || !diamondTransactionStore?.create || !jokerTransactionStore?.filter || !jokerTransactionStore?.create) {
      return json({ ok: false, code: 'market_entities_missing', error: 'Mağaza kayıtları hazır değil.' }, 500);
    }

    await ensureStarterInventory(base44, email).catch((error: Error) => {
      console.warn('[purchaseJokerWithDiamonds] starter self-heal skipped', error?.message || 'unknown');
    });

    const existingDiamondTx = await findDiamondTransaction(base44, email, idempotencyKey);
    const existingJokerTx = await findJokerTransaction(base44, email, jokerType, idempotencyKey);
    if (existingDiamondTx && existingJokerTx) {
      return json({
        ok: true,
        alreadyApplied: true,
        userEmail: email,
        jokerType,
        quantity,
        diamondCost: normalizeDiamondBalance(existingDiamondTx.amount),
        diamondBalanceAfter: normalizeDiamondBalance(existingDiamondTx.balance_after),
        jokerBalanceAfter: normalizeQuantity(existingJokerTx.balance_after),
        idempotencyKey,
        purchaseId: idempotencyKey,
        diamondTransactionId: rowId(existingDiamondTx),
        jokerTransactionId: rowId(existingJokerTx),
        balances: await readBalances(base44, email),
      });
    }
    if (existingDiamondTx || existingJokerTx) {
      return json({
        ok: false,
        code: 'purchase_idempotency_partial',
        error: 'Satın alma kaydı doğrulanamadı. Lütfen destek iste.',
        idempotencyKey,
        hasDiamondTransaction: Boolean(existingDiamondTx),
        hasJokerTransaction: Boolean(existingJokerTx),
      }, 409);
    }

    return await withEconomyOperationLock(base44, buildEconomyLockKey(email), {
      actorKey: email,
      operationScope: 'market_purchase',
      operationId: idempotencyKey,
      metadata: {
        jokerType,
        quantity,
        pricePerUnit: product.price,
      },
    }, async () => {
    const latestUser = await base44.auth.me().catch(() => user);
    const diamondBefore = normalizeDiamondBalance(latestUser?.diamonds);
    const diamondCost = product.price * quantity;
    if (diamondBefore < diamondCost) {
      return json({
        ok: false,
        code: 'insufficient_diamonds',
        error: 'Yeterli elmas yok.',
        jokerType,
        quantity,
        diamondCost,
        diamondBalanceAfter: diamondBefore,
        balances: await readBalances(base44, email),
      }, 409);
    }

    const secondExistingDiamondTx = await findDiamondTransaction(base44, email, idempotencyKey);
    const secondExistingJokerTx = await findJokerTransaction(base44, email, jokerType, idempotencyKey);
    if (secondExistingDiamondTx || secondExistingJokerTx) {
      return json({
        ok: false,
        code: 'duplicate_purchase_in_progress',
        error: 'Bu satın alma zaten işleniyor.',
        idempotencyKey,
      }, 409);
    }

    const inventory = await findInventory(base44, email, jokerType);
    const jokerBefore = normalizeQuantity(inventory?.quantity);
    const diamondAfter = diamondBefore - diamondCost;
    const jokerAfter = jokerBefore + quantity;
    const timestamp = nowIso();
    const userPatch = {
      diamonds: diamondAfter,
      economy_updated_at: timestamp,
    };

    await updateCurrentUser(base44, rowId(latestUser) ? latestUser : user, userPatch);
    const updatedInventory = await upsertInventory(base44, inventory, {
      user_email: email,
      joker_type: jokerType,
      quantity: jokerAfter,
      created_at: inventory?.created_at || timestamp,
      updated_at: timestamp,
      metadata: {
        ...(inventory?.metadata && typeof inventory.metadata === 'object' ? inventory.metadata : {}),
        lastPurchaseSource: MARKET_SOURCE,
        lastPurchaseReason: MARKET_PURCHASE_REASON,
      },
    });

    let diamondTransaction: any = null;
    let jokerTransaction: any = null;
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
          jokerType,
          quantity,
          pricePerUnit: product.price,
          purchaseReason: MARKET_PURCHASE_REASON,
          clientPriceIgnored: true,
          phase: 'market_phase_1',
        },
        created_at: timestamp,
        description: 'joker_purchase',
      });
      jokerTransaction = await createJokerTransaction(base44, {
        user_email: email,
        joker_type: jokerType,
        quantity_delta: quantity,
        reason: MARKET_PURCHASE_REASON,
        source: MARKET_SOURCE,
        related_entity_type: RELATED_ENTITY_TYPE,
        related_entity_id: idempotencyKey,
        idempotency_key: idempotencyKey,
        balance_before: jokerBefore,
        balance_after: jokerAfter,
        created_at: timestamp,
        created_by: email,
        metadata: {
          diamondCost,
          pricePerUnit: product.price,
          diamondTransactionId: rowId(diamondTransaction),
          phase: 'market_phase_1',
        },
      });
    } catch (error) {
      await rollbackState(base44, latestUser, updatedInventory || inventory, diamondBefore, jokerBefore, nowIso());
      console.error('[purchaseJokerWithDiamonds] ledger create failed', error?.message || error);
      return json({
        ok: false,
        code: 'market_ledger_write_failed',
        error: 'Satın alma kaydedilemedi. Lütfen tekrar dene.',
      }, 500);
    }

    const finalInventoryId = rowId(updatedInventory) || rowId(inventory);
    const finalInventory = finalInventoryId ? await inventoryStore.update(finalInventoryId, {
      last_transaction_id: rowId(jokerTransaction),
      updated_at: timestamp,
    }).catch(() => updatedInventory) : updatedInventory;

    return json({
      ok: true,
      userEmail: email,
      jokerType,
      jokerLabel: product.label,
      quantity,
      diamondCost,
      diamondBalanceBefore: diamondBefore,
      diamondBalanceAfter: diamondAfter,
      jokerBalanceBefore: jokerBefore,
      jokerBalanceAfter: jokerAfter,
      idempotencyKey,
      purchaseId: idempotencyKey,
      diamondTransactionId: rowId(diamondTransaction),
      jokerTransactionId: rowId(jokerTransaction),
      inventory: publicInventoryRow(finalInventory),
      balances: await readBalances(base44, email),
      userPatch,
      purchasedAt: timestamp,
    });
    });
  } catch (error) {
    console.error('[purchaseJokerWithDiamonds] failed', error?.message || error);
    return json({ ok: false, code: 'market_purchase_failed', error: 'Satın alma tamamlanamadı. Tekrar dene.' }, 500);
  }
});
