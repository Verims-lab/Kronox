import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const JOKER_TYPES = ['mistake_shield', 'card_swap', 'time_freeze'] as const;
const MARKET_PURCHASE_REASON = 'market_purchase';
const MARKET_SOURCE = 'market';
const DIAMOND_MARKET_PURCHASE_SOURCE = 'market_purchase';
const RELATED_ENTITY_TYPE = 'joker_purchase';
const STARTER_QUANTITY = 3;
const STARTER_SOURCE = 'starter_jokers';
const STARTER_REASON = 'starter_grant';
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

function normalizePurchaseQuantity(value: unknown) {
  const number = Number(value ?? 1);
  if (!Number.isFinite(number)) return 1;
  return Math.min(25, Math.max(1, Math.floor(number)));
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

function buildStarterIdempotencyKey(email: string, jokerType: string) {
  return `${STARTER_SOURCE}:${email}:${jokerType}`;
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

async function findStarterTransaction(base44: any, email: string, jokerType: string, idempotencyKey: string) {
  const rows = await base44.asServiceRole.entities.JokerTransaction
    .filter({ user_email: email, joker_type: jokerType, idempotency_key: idempotencyKey }, '-created_at', 1)
    .catch(() => []);
  return Array.isArray(rows) && rows.length ? rows[0] : null;
}

async function upsertInventory(base44: any, existing: any, payload: Record<string, unknown>) {
  if (existing?.id) return base44.asServiceRole.entities.UserJokerInventory.update(existing.id, payload);
  return base44.asServiceRole.entities.UserJokerInventory.create(payload);
}

async function ensureStarterJokerType(base44: any, email: string, jokerType: string) {
  const timestamp = nowIso();
  const idempotencyKey = buildStarterIdempotencyKey(email, jokerType);
  const existingTransaction = await findStarterTransaction(base44, email, jokerType, idempotencyKey);
  const existingInventory = await findInventory(base44, email, jokerType);
  const currentQuantity = normalizeQuantity(existingInventory?.quantity);

  if (existingTransaction) {
    if (!existingInventory?.id) {
      await upsertInventory(base44, existingInventory, {
        user_email: email,
        joker_type: jokerType,
        quantity: normalizeQuantity(existingTransaction.balance_after) || STARTER_QUANTITY,
        created_at: timestamp,
        updated_at: timestamp,
        last_transaction_id: existingTransaction.id || null,
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
    transaction = await base44.asServiceRole.entities.JokerTransaction.create(transactionPayload);
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
    last_transaction_id: transaction?.id || null,
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
  const rows = await base44.asServiceRole.entities.DiamondTransaction
    .filter({ user_email: email, idempotency_key: idempotencyKey }, '-created_at', 1)
    .catch(() => []);
  return Array.isArray(rows) && rows.length ? rows[0] : null;
}

async function findJokerTransaction(base44: any, email: string, jokerType: string, idempotencyKey: string) {
  const rows = await base44.asServiceRole.entities.JokerTransaction
    .filter({ user_email: email, joker_type: jokerType, idempotency_key: idempotencyKey }, '-created_at', 1)
    .catch(() => []);
  return Array.isArray(rows) && rows.length ? rows[0] : null;
}

async function createDiamondTransaction(base44: any, payload: Record<string, unknown>) {
  const existing = await findDiamondTransaction(base44, String(payload.user_email || ''), String(payload.idempotency_key || ''));
  if (existing) return existing;
  return base44.asServiceRole.entities.DiamondTransaction.create(payload);
}

async function createJokerTransaction(base44: any, payload: Record<string, unknown>) {
  const existing = await findJokerTransaction(
    base44,
    String(payload.user_email || ''),
    String(payload.joker_type || ''),
    String(payload.idempotency_key || ''),
  );
  if (existing) return existing;
  return base44.asServiceRole.entities.JokerTransaction.create(payload);
}

async function rollbackState(base44: any, user: any, inventory: any, diamondBefore: number, jokerBefore: number, timestamp: string) {
  await base44.asServiceRole.entities.User.update(user.id, {
    diamonds: diamondBefore,
    economy_updated_at: timestamp,
  }).catch(() => null);
  if (inventory?.id) {
    await base44.asServiceRole.entities.UserJokerInventory.update(inventory.id, {
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

    const quantity = normalizePurchaseQuantity(body?.quantity);
    const idempotencyKey = safeText(body?.idempotencyKey || body?.idempotency_key);
    if (!idempotencyKey) {
      return json({ ok: false, code: 'missing_idempotency_key', error: 'Satın alma doğrulanamadı.' }, 400);
    }

    const userEntity = base44.asServiceRole.entities.User;
    const inventoryEntity = base44.asServiceRole.entities.UserJokerInventory;
    const diamondTransactionEntity = base44.asServiceRole.entities.DiamondTransaction;
    const jokerTransactionEntity = base44.asServiceRole.entities.JokerTransaction;
    if (!userEntity?.update || !inventoryEntity?.filter || !inventoryEntity?.create || !inventoryEntity?.update || !diamondTransactionEntity?.filter || !diamondTransactionEntity?.create || !jokerTransactionEntity?.filter || !jokerTransactionEntity?.create) {
      return json({ ok: false, code: 'market_entities_missing', error: 'Mağaza kayıtları hazır değil.' }, 500);
    }

    await ensureStarterInventory(base44, email);

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
        diamondTransactionId: existingDiamondTx.id || null,
        jokerTransactionId: existingJokerTx.id || null,
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

    await userEntity.update(latestUser.id || user.id, userPatch);
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
          diamondTransactionId: diamondTransaction?.id || null,
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

    const finalInventory = await inventoryEntity.update(updatedInventory.id || inventory?.id, {
      last_transaction_id: jokerTransaction?.id || null,
      updated_at: timestamp,
    }).catch(() => updatedInventory);

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
      diamondTransactionId: diamondTransaction?.id || null,
      jokerTransactionId: jokerTransaction?.id || null,
      inventory: publicInventoryRow(finalInventory),
      balances: await readBalances(base44, email),
      userPatch,
      purchasedAt: timestamp,
    });
  } catch (error) {
    console.error('[purchaseJokerWithDiamonds] failed', error?.message || error);
    return json({ ok: false, code: 'market_purchase_failed', error: 'Satın alma tamamlanamadı. Lütfen tekrar dene.' }, 500);
  }
});
