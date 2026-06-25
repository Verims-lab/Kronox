import { createClientFromRequest } from 'npm:@base44/sdk@0.8.34';

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

function normalizeJokerType(value: unknown) {
  const type = String(value || '').trim();
  return JOKER_TYPES.includes(type as typeof JOKER_TYPES[number]) ? type : '';
}

function normalizeQuantity(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.floor(number)) : 0;
}

function rowId(row: any) {
  return row?.id || row?._id || null;
}

function entityStore(base44: any, entityName: string) {
  const serviceEntity = base44?.asServiceRole?.entities ? base44.asServiceRole.entities[entityName] : null;
  const authEntity = base44?.entities ? base44.entities[entityName] : null;
  return serviceEntity || authEntity;
}

function emailVariants(email: string, rawEmail = '') {
  return Array.from(new Set([
    normalizeEmail(email),
    String(rawEmail || '').trim(),
    normalizeEmail(rawEmail),
  ].filter(Boolean)));
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
    id: rowId(row),
    jokerType: row?.joker_type || '',
    quantity: normalizeQuantity(row?.quantity),
    updatedAt: row?.updated_at || row?.created_at || null,
  };
}

async function findInventoryRows(base44: any, email: string, jokerType: string, rawEmail = '') {
  const entity = entityStore(base44, 'UserJokerInventory');
  if (!entity?.filter) return [];
  const batches = await Promise.all(emailVariants(email, rawEmail).map((ownerEmail) => entity
    .filter({ user_email: ownerEmail, joker_type: jokerType }, '-updated_at', 25)
    .catch(() => [])));
  const seen = new Set<string>();
  return batches
    .flatMap((rows) => (Array.isArray(rows) ? rows : []))
    .filter((row) => normalizeJokerType(row?.joker_type) === jokerType)
    .filter((row) => {
      const id = rowId(row) || `${row?.user_email}:${row?.joker_type}:${row?.created_at}:${row?.quantity}`;
      if (!id || seen.has(id)) return false;
      seen.add(id);
      return true;
    });
}

function selectPrimaryInventoryRow(rows: any[] = []) {
  return rows.slice().sort((a, b) => {
    const quantityDiff = normalizeQuantity(b?.quantity) - normalizeQuantity(a?.quantity);
    if (quantityDiff !== 0) return quantityDiff;
    return String(b?.updated_at || b?.created_at || '').localeCompare(String(a?.updated_at || a?.created_at || ''));
  })[0] || null;
}

function maxKnownInventoryQuantity(rows: any[] = []) {
  return rows.reduce((max, row) => Math.max(max, normalizeQuantity(row?.quantity)), 0);
}

async function findStarterTransaction(base44: any, email: string, jokerType: string, idempotencyKey: string, rawEmail = '') {
  const entity = entityStore(base44, 'JokerTransaction');
  if (!entity?.filter) return null;
  for (const ownerEmail of emailVariants(email, rawEmail)) {
    const rows = await entity
      .filter({ user_email: ownerEmail, joker_type: jokerType, idempotency_key: idempotencyKey }, '-created_at', 1)
      .catch(() => []);
    if (Array.isArray(rows) && rows.length) return rows[0];
  }
  return null;
}

async function findLatestJokerTransaction(base44: any, email: string, jokerType: string, rawEmail = '') {
  const entity = entityStore(base44, 'JokerTransaction');
  if (!entity?.filter) return null;
  const batches = await Promise.all(emailVariants(email, rawEmail).map((ownerEmail) => entity
    .filter({ user_email: ownerEmail, joker_type: jokerType }, '-created_at', 10)
    .catch(() => [])));
  const rows = batches.flatMap((items) => (Array.isArray(items) ? items : []));
  return rows.sort((a, b) => String(b?.created_at || '').localeCompare(String(a?.created_at || '')))[0] || null;
}

async function createStarterTransaction(base44: any, payload: Record<string, unknown>) {
  const existing = await findStarterTransaction(
    base44,
    String(payload.user_email || ''),
    String(payload.joker_type || ''),
    String(payload.idempotency_key || ''),
  );
  if (existing) return { row: existing, recoveredExisting: true };
  const row = await entityStore(base44, 'JokerTransaction').create(payload);
  return { row, recoveredExisting: false };
}

async function upsertInventory(base44: any, existing: any, payload: Record<string, unknown>) {
  const entity = entityStore(base44, 'UserJokerInventory');
  const id = rowId(existing);
  if (id) {
    return entity.update(id, payload).catch(() => entity.create(payload));
  }
  return entity.create(payload);
}

async function ensureStarterJokerType(base44: any, email: string, jokerType: string, rawEmail = '') {
  const timestamp = nowIso();
  const idempotencyKey = buildStarterIdempotencyKey(email, jokerType);
  const existingTransaction = await findStarterTransaction(base44, email, jokerType, idempotencyKey, rawEmail);
  const inventoryRows = await findInventoryRows(base44, email, jokerType, rawEmail);
  const existingInventory = selectPrimaryInventoryRow(inventoryRows);
  const latestLedgerTransaction = await findLatestJokerTransaction(base44, email, jokerType, rawEmail);
  const currentQuantity = Math.max(
    maxKnownInventoryQuantity(inventoryRows),
    normalizeQuantity(latestLedgerTransaction?.balance_after),
  );

  if (existingTransaction) {
    const ledgerRecoveredQuantity = latestLedgerTransaction
      ? normalizeQuantity(latestLedgerTransaction.balance_after)
      : (normalizeQuantity(existingTransaction.balance_after) || STARTER_QUANTITY);
    const recoveredQuantity = Math.max(
      currentQuantity,
      ledgerRecoveredQuantity,
    );
    const shouldRepair = !rowId(existingInventory)
      || normalizeEmail(existingInventory?.user_email) !== email
      || normalizeQuantity(existingInventory?.quantity) !== recoveredQuantity
      || inventoryRows.length > 1;
    const row = shouldRepair
      ? await upsertInventory(base44, existingInventory, {
        user_email: email,
        joker_type: jokerType,
        quantity: recoveredQuantity,
        created_at: existingInventory?.created_at || timestamp,
        updated_at: timestamp,
        last_transaction_id: rowId(latestLedgerTransaction) || rowId(existingTransaction),
        metadata: {
          ...(existingInventory?.metadata && typeof existingInventory.metadata === 'object' ? existingInventory.metadata : {}),
          selfHealedMissingOrPartialInventory: true,
          starterGrantRecoveredFromLedger: true,
          duplicateRowsIgnored: Math.max(0, inventoryRows.length - 1),
          normalizedOwnerKey: email,
        },
      })
      : existingInventory;
    const quantityAfter = normalizeQuantity(row?.quantity);
    return {
      jokerType,
      granted: false,
      alreadyGranted: true,
      idempotencyKey,
      quantityBefore: currentQuantity,
      quantityAfter,
      inventory: publicInventoryRow(row),
      transactionId: rowId(latestLedgerTransaction) || rowId(existingTransaction),
      selfHealed: shouldRepair,
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
  const latestInventoryRows = await findInventoryRows(base44, email, jokerType, rawEmail);
  const latestInventory = selectPrimaryInventoryRow(latestInventoryRows) || existingInventory;
  const latestQuantity = Math.max(maxKnownInventoryQuantity(latestInventoryRows), currentQuantity);
  const finalQuantity = Math.max(latestQuantity, normalizeQuantity(latestTransaction?.balance_after), STARTER_QUANTITY);
  const row = await upsertInventory(base44, latestInventory || existingInventory, {
    user_email: email,
    joker_type: jokerType,
    quantity: finalQuantity,
    created_at: (latestInventory || existingInventory)?.created_at || timestamp,
    updated_at: timestamp,
    last_transaction_id: rowId(latestTransaction),
    metadata: {
      ...(latestInventory?.metadata && typeof latestInventory.metadata === 'object' ? latestInventory.metadata : {}),
      starterGrantInitialized: true,
      recoveredExistingTransaction: Boolean(createdTransaction.recoveredExisting),
      selfHealedMissingOrPartialInventory: true,
      duplicateRowsIgnored: Math.max(0, latestInventoryRows.length - 1),
      normalizedOwnerKey: email,
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
    transactionId: rowId(latestTransaction),
    selfHealed: true,
  };
}

Deno.serve(async (req: Request) => {
  const startedAt = Date.now();
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

    const rawEmail = String(user?.email || '').trim();
    const email = normalizeEmail(rawEmail);
    if (!email) {
      return json({ ok: false, code: 'unauthenticated', error: 'Joker Çantası için giriş yapmalısın.' }, 401);
    }

    const inventoryEntity = entityStore(base44, 'UserJokerInventory');
    const transactionEntity = entityStore(base44, 'JokerTransaction');
    if (!inventoryEntity?.filter || !inventoryEntity?.create || !inventoryEntity?.update || !transactionEntity?.filter || !transactionEntity?.create) {
      return json({ ok: false, code: 'joker_inventory_entity_missing', error: 'Joker kayıtları hazır değil.' }, 500);
    }

    const balances = emptyBalances();
    const grants = await Promise.all(JOKER_TYPES.map((jokerType) => ensureStarterJokerType(base44, email, jokerType, rawEmail)));
    for (const grant of grants) {
      const jokerType = normalizeJokerType(grant?.jokerType);
      if (jokerType) balances[jokerType] = normalizeQuantity(grant?.quantityAfter ?? grant?.inventory?.quantity);
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
      selfHealed: grants.some((grant) => grant.selfHealed),
      normalizedOwnerKey: email,
      performance: {
        durationMs: Math.max(0, Date.now() - startedAt),
        jokerTypesChecked: JOKER_TYPES.length,
        parallelSelfHeal: true,
      },
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
