import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const JOKER_TYPES = ['mistake_shield', 'card_swap', 'time_freeze'] as const;
const SOLO_USE_REASON = 'solo_use';
const SOLO_SOURCE = 'solo';

function json(payload: unknown, status = 200) {
  return Response.json(payload, { status });
}

function normalizeEmail(value: unknown) {
  return String(value || '').trim().toLowerCase();
}

function normalizeQuantity(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.floor(number)) : 0;
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
    id: row?.id || null,
    jokerType: row?.joker_type || '',
    quantity: normalizeQuantity(row?.quantity),
    updatedAt: row?.updated_at || row?.created_at || null,
  };
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
  const rows = await base44.asServiceRole.entities.UserJokerInventory
    .filter({ user_email: email, joker_type: jokerType }, '-updated_at', 10)
    .catch(() => []);
  return Array.isArray(rows) && rows.length ? rows[0] : null;
}

async function findTransaction(base44: any, email: string, jokerType: string, idempotencyKey: string) {
  const rows = await base44.asServiceRole.entities.JokerTransaction
    .filter({ user_email: email, joker_type: jokerType, idempotency_key: idempotencyKey }, '-created_at', 1)
    .catch(() => []);
  return Array.isArray(rows) && rows.length ? rows[0] : null;
}

async function readBalances(base44: any, email: string) {
  const rows = await base44.asServiceRole.entities.UserJokerInventory
    .filter({ user_email: email }, '-updated_at', 20)
    .catch(() => []);
  const balances = emptyBalances();
  if (Array.isArray(rows)) {
    rows.forEach((row) => {
      const type = normalizeJokerType(row?.joker_type);
      if (type) balances[type] = normalizeQuantity(row?.quantity);
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

    const inventoryEntity = base44.asServiceRole.entities.UserJokerInventory;
    const transactionEntity = base44.asServiceRole.entities.JokerTransaction;
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
        transactionId: existingTransaction.id || null,
        balanceAfter: normalizeQuantity(existingTransaction.balance_after),
        balances: await readBalances(base44, email),
      });
    }

    const inventory = await findInventory(base44, email, jokerType);
    const quantityBefore = normalizeQuantity(inventory?.quantity);
    if (!inventory?.id || quantityBefore <= 0) {
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
        transactionId: secondExistingTransaction.id || null,
        balanceAfter: normalizeQuantity(secondExistingTransaction.balance_after),
        balances: await readBalances(base44, email),
      });
    }

    const timestamp = nowIso();
    const balanceAfter = quantityBefore - 1;
    const relatedEntityType = safeText(body?.relatedEntityType || body?.related_entity_type, 'solo_question');
    const relatedEntityId = safeText(body?.relatedEntityId || body?.related_entity_id, '');

    const updatedInventory = await inventoryEntity.update(inventory.id, {
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
      if (latest?.id && normalizeQuantity(latest.quantity) === balanceAfter) {
        await inventoryEntity.update(latest.id, {
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

    const finalInventory = await inventoryEntity.update(updatedInventory.id || inventory.id, {
      last_transaction_id: transaction?.id || null,
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
      transactionId: transaction?.id || null,
      balanceBefore: quantityBefore,
      balanceAfter,
      inventory: publicInventoryRow(finalInventory),
      balances: await readBalances(base44, email),
      appliedAt: timestamp,
    });
  } catch (error) {
    console.error('[spendUserJoker] failed', error?.message || error);
    return json({ ok: false, code: 'joker_spend_failed', error: 'Joker kullanılamadı. Lütfen tekrar dene.' }, 500);
  }
});
