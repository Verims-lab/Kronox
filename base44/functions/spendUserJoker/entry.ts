import { createClientFromRequest } from 'npm:@base44/sdk@0.8.34';

const JOKER_TYPES = ['mistake_shield', 'card_swap', 'time_freeze'] as const;
const SOLO_USE_REASON = 'solo_use';
const SOLO_SOURCE = 'solo';
const ECONOMY_LOCK_TTL_MS = 8_000;
const ECONOMY_LOCK_SETTLE_MS = 80;
const JOKER_NON_NEGATIVE_BALANCE_CONTRACT = Object.freeze({
  "minimum": 0,
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

function hasPositiveSpendableQuantity(value: unknown) {
  return normalizeQuantity(value) > JOKER_NON_NEGATIVE_BALANCE_CONTRACT["minimum"];
}

function normalizeJokerType(value: unknown) {
  const type = String(value || '').trim();
  return JOKER_TYPES.includes(type as typeof JOKER_TYPES[number]) ? type : '';
}

function nowIso() {
  return new Date().toISOString();
}

function emptyBalances() {
  return Object.fromEntries(JOKER_TYPES.map((jokerType) => [jokerType, 0]));
}

function publicInventoryRow(row: any) {
  return {
    id: rowId(row),
    jokerType: row?.joker_type || '',
    quantity: normalizeQuantity(row?.quantity),
    updatedAt: row?.updated_at || row?.created_at || null,
  };
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

function entityStore(base44: any, entityName: string) {
  // Base44 deploy/runtime contract: spendUserJoker explicitly binds
  // entities.UserJokerInventory and entities.JokerTransaction while retaining
  // service-role preference. Some function runtimes expose only entities.*.
  const serviceEntity = base44?.asServiceRole?.entities ? base44.asServiceRole.entities[entityName] : null;
  const authEntity = base44?.entities ? base44.entities[entityName] : null;
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

function safeText(value: unknown, fallback = '') {
  const text = String(value || '').trim();
  return text ? text.slice(0, 180) : fallback;
}

function safeMetadata(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const allowedKeys = [
    'soloAttemptId',
    'soloLevelNumber',
    'questionId',
    'decisionKey',
    'uiJokerType',
    'effect',
  ];
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([key]) => allowedKeys.includes(key))
      .map(([key, item]) => [key, safeText(item)]),
  );
}

async function findInventory(base44: any, email: string, jokerType: string) {
  const entity = entityStore(base44, 'UserJokerInventory');
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


async function findTransaction(base44: any, email: string, jokerType: string, idempotencyKey: string) {
  const entity = entityStore(base44, 'JokerTransaction');
  if (!entity?.filter) return null;
  const rows = await entity
    .filter({ user_email: email, joker_type: jokerType, idempotency_key: idempotencyKey }, '-created_at', 1)
    .catch(() => []);
  return Array.isArray(rows) && rows.length ? rows[0] : null;
}

async function readBalances(base44: any, email: string) {
  const entity = entityStore(base44, 'UserJokerInventory');
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
      return json({ ok: false, code: 'unauthenticated', error: 'Joker kullanmak için giriş yapmalısın.' }, 401);
    }

    const email = normalizeEmail(user?.email);
    if (!email) {
      return json({ ok: false, code: 'unauthenticated', error: 'Joker kullanmak için giriş yapmalısın.' }, 401);
    }

    let body: any = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    const jokerType = normalizeJokerType(body?.jokerType || body?.joker_type);
    if (!jokerType) {
      return json({ ok: false, code: 'invalid_joker_type', error: 'Joker türü geçersiz.' }, 400);
    }

    const idempotencyKey = safeText(body?.idempotencyKey || body?.idempotency_key);
    if (!idempotencyKey) {
      return json({ ok: false, code: 'missing_idempotency_key', error: 'Joker işlemi doğrulanamadı.' }, 400);
    }

    const relatedEntityType = safeText(body?.relatedEntityType || body?.related_entity_type, 'solo_question');
    const relatedEntityId = safeText(body?.relatedEntityId || body?.related_entity_id, '');
    const mode = safeText(body?.mode || body?.gameMode || body?.source, '');
    const isSoloContext = relatedEntityType.startsWith('solo') && (!mode || mode === SOLO_SOURCE);
    if (!isSoloContext) {
      return json({
        ok: false,
        code: 'invalid_joker_context',
        error: 'Joker yalnızca Solo modda kullanılabilir.',
        jokerType,
        balances: await readBalances(base44, email),
      }, 400);
    }

    const inventoryEntity = entityStore(base44, 'UserJokerInventory');
    const transactionEntity = entityStore(base44, 'JokerTransaction');
    if (!inventoryEntity?.filter || !inventoryEntity?.update || !transactionEntity?.filter || !transactionEntity?.create) {
      return json({ ok: false, code: 'joker_inventory_entity_missing', error: 'Joker kayıtları hazır değil.' }, 500);
    }

    const existingTransaction = await findTransaction(base44, email, jokerType, idempotencyKey);
    if (existingTransaction) {
      return json({
        ok: true,
        alreadyApplied: true,
        userEmail: email,
        jokerType,
        quantityDelta: -1,
        reason: SOLO_USE_REASON,
        source: SOLO_SOURCE,
        idempotencyKey,
        transactionId: rowId(existingTransaction),
        balanceAfter: normalizeQuantity(existingTransaction.balance_after),
        balances: await readBalances(base44, email),
      });
    }

    return await withEconomyOperationLock(base44, buildEconomyLockKey(email), {
      actorKey: email,
      operationScope: 'solo_joker_spend',
      operationId: idempotencyKey,
      metadata: {
        jokerType,
        relatedEntityType,
        guidedTutorialSpendBypass: false,
      },
    }, async () => {
    const inventory = await findInventory(base44, email, jokerType);
    const quantityBefore = normalizeQuantity(inventory?.quantity);
    const insufficientBalance = quantityBefore <= 0 || !hasPositiveSpendableQuantity(quantityBefore);
    if (!rowId(inventory) || insufficientBalance) {
      return json({
        ok: false,
        code: 'insufficient_joker_balance',
        error: 'Bu jokerden kalmadı.',
        jokerType,
        balanceAfter: quantityBefore,
        balances: await readBalances(base44, email),
      }, 409);
    }

    const secondExistingTransaction = await findTransaction(base44, email, jokerType, idempotencyKey);
    if (secondExistingTransaction) {
      return json({
        ok: true,
        alreadyApplied: true,
        userEmail: email,
        jokerType,
        quantityDelta: -1,
        reason: SOLO_USE_REASON,
        source: SOLO_SOURCE,
        idempotencyKey,
        transactionId: rowId(secondExistingTransaction),
        balanceAfter: normalizeQuantity(secondExistingTransaction.balance_after),
        balances: await readBalances(base44, email),
      });
    }

    const timestamp = nowIso();
    const balanceAfter = quantityBefore - 1;

    const updatedInventory = await inventoryEntity.update(rowId(inventory), {
      quantity: balanceAfter,
      updated_at: timestamp,
      metadata: {
        ...(inventory.metadata && typeof inventory.metadata === 'object' ? inventory.metadata : {}),
        lastSpendSource: SOLO_SOURCE,
        lastSpendReason: SOLO_USE_REASON,
      },
    });

    let transaction: any = null;
    try {
      transaction = await transactionEntity.create({
        user_email: email,
        joker_type: jokerType,
        quantity_delta: -1,
        reason: SOLO_USE_REASON,
        source: SOLO_SOURCE,
        related_entity_type: relatedEntityType,
        related_entity_id: relatedEntityId,
        idempotency_key: idempotencyKey,
        balance_before: quantityBefore,
        balance_after: balanceAfter,
        created_at: timestamp,
        created_by: email,
        metadata: {
          ...safeMetadata(body?.metadata),
          phase: 'joker_inventory_phase_2',
        },
      });
    } catch (error) {
      const latest = await findInventory(base44, email, jokerType).catch(() => null);
      if (rowId(latest) && normalizeQuantity(latest.quantity) === balanceAfter) {
        await inventoryEntity.update(rowId(latest), {
          quantity: quantityBefore,
          updated_at: nowIso(),
          metadata: {
            ...(latest.metadata && typeof latest.metadata === 'object' ? latest.metadata : {}),
            spendRollbackReason: 'ledger_create_failed',
          },
        }).catch(() => null);
      }
      console.error('[spendUserJoker] ledger create failed', error?.message || error);
      return json({ ok: false, code: 'joker_ledger_write_failed', error: 'Joker işlemi kaydedilemedi.' }, 500);
    }

    const finalInventory = await inventoryEntity.update(rowId(updatedInventory) || rowId(inventory), {
      last_transaction_id: rowId(transaction),
      updated_at: timestamp,
    }).catch(() => updatedInventory);

    return json({
      ok: true,
      userEmail: email,
      jokerType,
      quantityDelta: -1,
      reason: SOLO_USE_REASON,
      source: SOLO_SOURCE,
      idempotencyKey,
      transactionId: rowId(transaction),
      balanceBefore: quantityBefore,
      balanceAfter,
      inventory: publicInventoryRow(finalInventory),
      balances: await readBalances(base44, email),
      appliedAt: timestamp,
    });
    });
  } catch (error) {
    console.error('[spendUserJoker] failed', error?.message || error);
    return json({ ok: false, code: 'joker_spend_failed', error: 'Joker kullanılamadı. Lütfen tekrar dene.' }, 500);
  }
});
