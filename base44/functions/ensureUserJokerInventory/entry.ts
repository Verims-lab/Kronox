import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const STARTER_QUANTITY = 3;
const JOKER_TYPES = ['mistake_shield', 'card_swap', 'time_freeze'] as const;
const STARTER_SOURCE = 'starter_jokers';
const STARTER_REASON = 'starter_grant';

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

function nowIso() {
  return new Date().toISOString();
}

function buildStarterIdempotencyKey(email: string, jokerType: string) {
  return `${STARTER_SOURCE}:${email}:${jokerType}`;
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

async function findInventory(base44: any, email: string, jokerType: string) {
  const rows = await base44.asServiceRole.entities.UserJokerInventory
    .filter({ user_email: email, joker_type: jokerType }, '-updated_at', 10)
    .catch(() => []);
  return Array.isArray(rows) && rows.length ? rows[0] : null;
}

async function findStarterTransaction(base44: any, email: string, jokerType: string, idempotencyKey: string) {
  const rows = await base44.asServiceRole.entities.JokerTransaction
    .filter({ user_email: email, joker_type: jokerType, idempotency_key: idempotencyKey }, '-created_at', 1)
    .catch(() => []);
  return Array.isArray(rows) && rows.length ? rows[0] : null;
}

async function createStarterTransaction(base44: any, payload: Record<string, unknown>) {
  const existing = await findStarterTransaction(
    base44,
    String(payload.user_email || ''),
    String(payload.joker_type || ''),
    String(payload.idempotency_key || ''),
  );
  if (existing) return { row: existing, recoveredExisting: true };
  const row = await base44.asServiceRole.entities.JokerTransaction.create(payload);
  return { row, recoveredExisting: false };
}

async function upsertInventory(base44: any, existing: any, payload: Record<string, unknown>) {
  if (existing?.id) {
    return base44.asServiceRole.entities.UserJokerInventory.update(existing.id, payload);
  }
  return base44.asServiceRole.entities.UserJokerInventory.create(payload);
}

async function ensureStarterJokerType(base44: any, email: string, jokerType: string) {
  const timestamp = nowIso();
  const idempotencyKey = buildStarterIdempotencyKey(email, jokerType);
  const existingTransaction = await findStarterTransaction(base44, email, jokerType, idempotencyKey);
  const existingInventory = await findInventory(base44, email, jokerType);
  const currentQuantity = normalizeQuantity(existingInventory?.quantity);

  if (existingTransaction) {
    const recoveredQuantity = normalizeQuantity(existingTransaction.balance_after) || STARTER_QUANTITY;
    const row = existingInventory?.id
      ? existingInventory
      : await upsertInventory(base44, existingInventory, {
        user_email: email,
        joker_type: jokerType,
        quantity: recoveredQuantity,
        created_at: timestamp,
        updated_at: timestamp,
        last_transaction_id: existingTransaction.id || null,
        metadata: {
          starterGrantRecoveredFromLedger: true,
        },
      });
    const quantityAfter = normalizeQuantity(row?.quantity);
    return {
      jokerType,
      granted: false,
      alreadyGranted: true,
      idempotencyKey,
      quantityBefore: currentQuantity,
      quantityAfter,
      inventory: publicInventoryRow(row),
      transactionId: existingTransaction.id || null,
    };
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
      phase: 'joker_inventory_phase_1',
      partialStarterRepair: currentQuantity > 0 && currentQuantity < STARTER_QUANTITY,
      ledgerRecoveryOnly: quantityDelta === 0,
    },
  };
  const createdTransaction = await createStarterTransaction(base44, transactionPayload);
  const latestTransaction = createdTransaction.row;
  const latestInventory = await findInventory(base44, email, jokerType);
  const latestQuantity = normalizeQuantity(latestInventory?.quantity ?? currentQuantity);
  const finalQuantity = Math.max(latestQuantity, normalizeQuantity(latestTransaction?.balance_after), STARTER_QUANTITY);
  const row = await upsertInventory(base44, latestInventory || existingInventory, {
    user_email: email,
    joker_type: jokerType,
    quantity: finalQuantity,
    created_at: (latestInventory || existingInventory)?.created_at || timestamp,
    updated_at: timestamp,
    last_transaction_id: latestTransaction?.id || null,
    metadata: {
      starterGrantInitialized: true,
      recoveredExistingTransaction: Boolean(createdTransaction.recoveredExisting),
    },
  });

  return {
    jokerType,
    granted: !createdTransaction.recoveredExisting && quantityDelta > 0,
    alreadyGranted: Boolean(createdTransaction.recoveredExisting),
    idempotencyKey,
    quantityBefore: currentQuantity,
    quantityDelta,
    quantityAfter: finalQuantity,
    inventory: publicInventoryRow(row),
    transactionId: latestTransaction?.id || null,
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
      return json({ ok: false, code: 'unauthenticated', error: 'Joker Çantası için giriş yapmalısın.' }, 401);
    }

    const email = normalizeEmail(user?.email);
    if (!email) {
      return json({ ok: false, code: 'unauthenticated', error: 'Joker Çantası için giriş yapmalısın.' }, 401);
    }

    const inventoryEntity = base44.asServiceRole.entities.UserJokerInventory;
    const transactionEntity = base44.asServiceRole.entities.JokerTransaction;
    if (!inventoryEntity?.filter || !inventoryEntity?.create || !inventoryEntity?.update || !transactionEntity?.filter || !transactionEntity?.create) {
      return json({ ok: false, code: 'joker_inventory_entity_missing', error: 'Joker kayıtları hazır değil.' }, 500);
    }

    const grants = [];
    const balances = emptyBalances();
    for (const jokerType of JOKER_TYPES) {
      const result = await ensureStarterJokerType(base44, email, jokerType);
      grants.push(result);
      balances[jokerType] = normalizeQuantity(result?.quantityAfter ?? result?.inventory?.quantity);
    }

    return json({
      ok: true,
      userEmail: email,
      balances,
      items: grants.map((grant) => grant.inventory).filter(Boolean),
      grants,
      starterQuantity: STARTER_QUANTITY,
      starterReason: STARTER_REASON,
      starterSource: STARTER_SOURCE,
      idempotencyKeys: grants.map((grant) => grant.idempotencyKey),
      initialized: grants.some((grant) => grant.granted),
      alreadyGranted: grants.every((grant) => grant.alreadyGranted || !grant.granted),
    });
  } catch (error) {
    console.error('[ensureUserJokerInventory] failed', error?.message || error);
    return json({
      ok: false,
      code: 'joker_inventory_init_failed',
      error: 'Joker Çantası hazırlanamadı. Lütfen tekrar dene.',
    }, 500);
  }
});
