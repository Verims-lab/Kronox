/* global Deno */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.34';

const STARTER_QUANTITY = 3;
const STARTER_SOURCE = 'starter_hints';
const STARTER_REASON = 'starter_grant';
const SOLO_USE_REASON = 'solo_use';
const SOLO_SOURCE = 'solo_hint';
const GUEST_ID_PREFIX = 'guest_';
const ECONOMY_LOCK_TTL_MS = 8_000;
const ECONOMY_LOCK_SETTLE_MS = 80;

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

function normalizeStage(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(1, Math.min(3, Math.floor(number))) : 0;
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

function nowIso() {
  return new Date().toISOString();
}

function safeText(value: unknown, fallback = '') {
  const text = String(value || '').trim();
  return text ? text.slice(0, 180) : fallback;
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

function entityStore(base44: any, entityName: string) {
  const serviceEntity = base44?.asServiceRole?.entities ? base44.asServiceRole.entities[entityName] : null;
  const authEntity = base44?.entities ? base44.entities[entityName] : null;
  return serviceEntity || authEntity;
}

async function findGuestProfile(base44: any, guestId: string) {
  const entity = entityStore(base44, 'GuestProfile');
  if (!entity?.filter || !guestId) return null;
  const rows = await entity.filter({ guest_id: guestId }, '-created_at', 5).catch(() => []);
  return Array.isArray(rows) && rows.length ? rows[0] : null;
}

async function resolveHintPlayer(base44: any, body: any) {
  const user = await base44.auth.me().catch(() => null);
  const email = normalizeEmail(user?.email || user?.user_email);
  if (email && rowId(user)) {
    return {
      ok: true,
      isGuest: false,
      actorKey: email,
      ownerKey: ownerKeyFromEmail(email),
      playerType: 'linked',
      createdBy: email,
      response: null,
    };
  }
  const guestId = normalizeGuestId(body?.guest_id);
  const guestToken = normalizeGuestToken(body?.guest_token);
  if (!guestId || !guestToken) {
    return { ok: false, response: json({ ok: false, code: 'unauthenticated', error: 'İpucu kullanmak için profilini tamamlamalısın.' }, 401) };
  }
  const guest = await findGuestProfile(base44, guestId);
  const expectedHash = String(guest?.guest_token_hash || '');
  const providedHash = await hashGuestToken(guestId, guestToken);
  if (!guest || !expectedHash || expectedHash !== providedHash) {
    return { ok: false, response: json({ ok: false, code: 'invalid_guest_token', error: 'Misafir oturumu doğrulanamadı.' }, 401) };
  }
  if (String(guest?.status || '') === 'linked' || !isGuestProfileComplete(guest)) {
    return { ok: false, response: json({ ok: false, code: 'guest_profile_incomplete', error: 'İpucu kullanmak için profilini tamamlamalısın.' }, 403) };
  }
  return {
    ok: true,
    isGuest: true,
    actorKey: guestPlayerKey(guestId),
    ownerKey: ownerKeyFromGuestId(guestId),
    playerType: 'guest',
    createdBy: 'system:guest_hint_inventory',
    response: null,
  };
}

function buildStarterIdempotencyKey(actorKey: string) {
  return `${STARTER_SOURCE}:${actorKey}`;
}

function publicInventory(row: any) {
  return {
    quantity: normalizeQuantity(row?.quantity),
    updatedAt: row?.updated_at || row?.created_at || null,
  };
}

async function findInventoryRows(base44: any, actorKey: string) {
  const entity = entityStore(base44, 'UserHintInventory');
  if (!entity?.filter) return [];
  const rows = await entity.filter({ user_email: actorKey }, '-updated_at', 25).catch(() => []);
  return (Array.isArray(rows) ? rows : []).filter((row) => String(row?.user_email || '') === actorKey);
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

async function findTransaction(base44: any, actorKey: string, idempotencyKey: string) {
  const entity = entityStore(base44, 'HintTransaction');
  if (!entity?.filter || !idempotencyKey) return null;
  const rows = await entity.filter({ user_email: actorKey, idempotency_key: idempotencyKey }, '-created_at', 1).catch(() => []);
  return Array.isArray(rows) && rows.length ? rows[0] : null;
}

async function findLatestHintTransaction(base44: any, actorKey: string) {
  const entity = entityStore(base44, 'HintTransaction');
  if (!entity?.filter) return null;
  const rows = await entity.filter({ user_email: actorKey }, '-created_at', 10).catch(() => []);
  return Array.isArray(rows) && rows.length
    ? rows.sort((a, b) => String(b?.created_at || '').localeCompare(String(a?.created_at || '')))[0]
    : null;
}

async function upsertInventory(base44: any, existing: any, payload: Record<string, unknown>) {
  const entity = entityStore(base44, 'UserHintInventory');
  const id = rowId(existing);
  if (id) return entity.update(id, payload).catch(() => entity.create(payload));
  return entity.create(payload);
}

async function ensureStarterHints(base44: any, player: any) {
  const timestamp = nowIso();
  const actorKey = String(player.actorKey || '');
  const idempotencyKey = buildStarterIdempotencyKey(actorKey);
  const inventoryRows = await findInventoryRows(base44, actorKey);
  const existingInventory = selectPrimaryInventoryRow(inventoryRows);
  const latestLedgerTransaction = await findLatestHintTransaction(base44, actorKey);
  const currentQuantity = Math.max(maxKnownInventoryQuantity(inventoryRows), normalizeQuantity(latestLedgerTransaction?.balance_after));
  const existingTransaction = await findTransaction(base44, actorKey, idempotencyKey);

  if (existingTransaction) {
    const ledgerRecoveredQuantity = latestLedgerTransaction
      ? normalizeQuantity(latestLedgerTransaction.balance_after)
      : (normalizeQuantity(existingTransaction.balance_after) || STARTER_QUANTITY);
    const recoveredQuantity = Math.max(currentQuantity, ledgerRecoveredQuantity);
    const shouldRepair = !rowId(existingInventory)
      || normalizeQuantity(existingInventory?.quantity) !== recoveredQuantity
      || inventoryRows.length > 1;
    const row = shouldRepair
      ? await upsertInventory(base44, existingInventory, {
        user_email: actorKey,
        quantity: recoveredQuantity,
        created_at: existingInventory?.created_at || timestamp,
        updated_at: timestamp,
        last_transaction_id: rowId(latestLedgerTransaction) || rowId(existingTransaction),
        metadata: {
          ...(existingInventory?.metadata && typeof existingInventory.metadata === 'object' ? existingInventory.metadata : {}),
          starterGrantRecoveredFromLedger: true,
          duplicateRowsIgnored: Math.max(0, inventoryRows.length - 1),
          ownerKeyHashOnly: true,
        },
      })
      : existingInventory;
    return { quantityAfter: normalizeQuantity(row?.quantity), inventory: row, selfHealed: shouldRepair };
  }

  const balanceAfter = Math.max(currentQuantity, STARTER_QUANTITY);
  const transaction = await entityStore(base44, 'HintTransaction').create({
    user_email: actorKey,
    quantity_delta: Math.max(0, balanceAfter - currentQuantity),
    reason: STARTER_REASON,
    source: STARTER_SOURCE,
    related_entity_type: player.isGuest ? 'guest_profile' : 'user',
    related_entity_id: player.ownerKey,
    idempotency_key: idempotencyKey,
    balance_before: currentQuantity,
    balance_after: balanceAfter,
    created_at: timestamp,
    created_by: 'system:starter_hints',
    metadata: {
      starterQuantity: STARTER_QUANTITY,
      phase: 'solo_hint_inventory_phase_1',
      playerType: player.playerType,
      ownerKeyHashOnly: true,
    },
  });
  const row = await upsertInventory(base44, existingInventory, {
    user_email: actorKey,
    quantity: balanceAfter,
    created_at: existingInventory?.created_at || timestamp,
    updated_at: timestamp,
    last_transaction_id: rowId(transaction),
    metadata: {
      ...(existingInventory?.metadata && typeof existingInventory.metadata === 'object' ? existingInventory.metadata : {}),
      starterGrantInitialized: true,
      ownerKeyHashOnly: true,
    },
  });
  return { quantityAfter: normalizeQuantity(row?.quantity), inventory: row, selfHealed: true };
}

function economyOperationLockEntity(base44: any) {
  return entityStore(base44, 'EconomyOperationLock');
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

async function releaseEconomyOperationLock(base44: any, lock: any, status = 'released') {
  const entity = economyOperationLockEntity(base44);
  const id = rowId(lock);
  if (!entity?.update || !id) return;
  await entity.update(id, { status, released_at: nowIso() }).catch(() => null);
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
    operation_scope: 'solo_hint_spend',
    operation_id: safeText(context.operationId, ''),
    status: 'active',
    acquired_at: now,
    expires_at: new Date(nowMs + ECONOMY_LOCK_TTL_MS).toISOString(),
    metadata: {
      phase: 'solo_hint_spend_parallel_guard_phase_1',
      ttlMs: ECONOMY_LOCK_TTL_MS,
      ...(context.metadata && typeof context.metadata === 'object' ? context.metadata : {}),
    },
  });
  await sleep(ECONOMY_LOCK_SETTLE_MS);
  const canonical = selectCanonicalEconomyLock(await findEconomyLocks(base44, lockKey), Date.now());
  if (!canonical || !isSameRow(canonical, created)) {
    await releaseEconomyOperationLock(base44, created, 'released');
    return { ok: false, code: 'economy_operation_in_progress', lock: canonical };
  }
  return { ok: true, code: 'locked', lock: created };
}

async function withEconomyOperationLock(base44: any, lockKey: string, context: Record<string, unknown>, callback: () => Promise<Response>) {
  const lockResult = await acquireEconomyOperationLock(base44, lockKey, context);
  if (!lockResult.ok) {
    return json({ ok: false, code: lockResult.code, error: 'İpucu işlemi işleniyor. Lütfen tekrar dene.' }, 409);
  }
  try {
    return await callback();
  } finally {
    await releaseEconomyOperationLock(base44, lockResult.lock);
  }
}

function safeMetadata(body: any, stage: number) {
  return {
    soloAttemptId: safeText(body?.soloAttemptId || body?.solo_attempt_id),
    soloLevelNumber: Number.isFinite(Number(body?.soloLevelNumber || body?.solo_level_number))
      ? Math.floor(Number(body?.soloLevelNumber || body?.solo_level_number))
      : null,
    questionId: safeText(body?.questionId || body?.question_id),
    revealStage: stage,
    effect: 'solo_hint_reveal',
    noAnswerYearStored: true,
    noQuestionBankStored: true,
  };
}

async function repairDuplicateInventoryRowsAfterSpend(base44: any, actorKey: string, balanceAfter: number, transactionId: string, primaryInventoryId = '') {
  const entity = entityStore(base44, 'UserHintInventory');
  if (!entity?.filter || !entity?.update) return 0;
  const rows = await findInventoryRows(base44, actorKey);
  const duplicateRows = rows.filter((row) => rowId(row) && rowId(row) !== primaryInventoryId);
  const timestamp = nowIso();
  const repaired = await Promise.all(duplicateRows.map((row) => entity.update(rowId(row), {
    quantity: balanceAfter,
    updated_at: timestamp,
    last_transaction_id: transactionId,
    metadata: {
      ...(row?.metadata && typeof row.metadata === 'object' ? row.metadata : {}),
      duplicateHintSpendBalanceReconciled: true,
    },
  }).then(() => true).catch(() => false)));
  return repaired.filter(Boolean).length;
}

Deno.serve(async (req: Request) => {
  try {
    if (req.method !== 'POST') {
      return json({ ok: false, code: 'method_not_allowed', error: 'Bu işlem desteklenmiyor.' }, 405);
    }
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const player = await resolveHintPlayer(base44, body);
    if (!player.ok) return player.response;

    const action = String(body?.action || 'consume').trim().toLowerCase();
    const inventoryEntity = entityStore(base44, 'UserHintInventory');
    const transactionEntity = entityStore(base44, 'HintTransaction');
    if (!inventoryEntity?.filter || !inventoryEntity?.create || !inventoryEntity?.update || !transactionEntity?.filter || !transactionEntity?.create) {
      return json({ ok: false, code: 'hint_inventory_entity_missing', error: 'İpucu kayıtları hazır değil.' }, 500);
    }

    const starterState = await ensureStarterHints(base44, player);
    if (action === 'ensure') {
      return json({
        ok: true,
        playerType: player.playerType,
        hintBalance: normalizeQuantity(starterState?.quantityAfter),
        starterQuantity: STARTER_QUANTITY,
        selfHealed: starterState?.selfHealed === true,
        privateActorKeyReturned: false,
        rawGuestTokenServerStored: false,
        noKronoxPuan: true,
        noLeaderboardImpact: true,
      });
    }
    if (action !== 'consume') {
      return json({ ok: false, code: 'invalid_hint_action', error: 'İpucu işlemi geçersiz.' }, 400);
    }

    const idempotencyKey = safeText(body?.idempotencyKey || body?.idempotency_key);
    if (!idempotencyKey) {
      return json({ ok: false, code: 'missing_idempotency_key', error: 'İpucu işlemi doğrulanamadı.' }, 400);
    }
    const revealStage = normalizeStage(body?.revealStage || body?.reveal_stage);
    if (!revealStage) {
      return json({ ok: false, code: 'invalid_reveal_stage', error: 'İpucu aşaması geçersiz.' }, 400);
    }

    const actorKey = String(player.actorKey || '');
    const existingTransaction = await findTransaction(base44, actorKey, idempotencyKey);
    if (existingTransaction) {
      const balanceAfter = normalizeQuantity(existingTransaction.balance_after);
      await repairDuplicateInventoryRowsAfterSpend(base44, actorKey, balanceAfter, rowId(existingTransaction));
      return json({
        ok: true,
        alreadyApplied: true,
        playerType: player.playerType,
        quantityDelta: -1,
        reason: SOLO_USE_REASON,
        source: SOLO_SOURCE,
        hintBalance: balanceAfter,
        balanceAfter,
        revealStage,
        privateActorKeyReturned: false,
        rawGuestTokenServerStored: false,
        noKronoxPuan: true,
        noLeaderboardImpact: true,
      });
    }

    return await withEconomyOperationLock(base44, buildEconomyLockKey(actorKey), {
      actorKey,
      operationId: idempotencyKey,
      metadata: {
        playerType: player.playerType,
        revealStage,
        noAnswerYearStored: true,
      },
    }, async () => {
      const secondExistingTransaction = await findTransaction(base44, actorKey, idempotencyKey);
      if (secondExistingTransaction) {
        const balanceAfter = normalizeQuantity(secondExistingTransaction.balance_after);
        return json({
          ok: true,
          alreadyApplied: true,
          playerType: player.playerType,
          quantityDelta: -1,
          reason: SOLO_USE_REASON,
          source: SOLO_SOURCE,
          hintBalance: balanceAfter,
          balanceAfter,
          revealStage,
          privateActorKeyReturned: false,
          noKronoxPuan: true,
          noLeaderboardImpact: true,
        });
      }

      const inventoryRows = await findInventoryRows(base44, actorKey);
      const inventory = selectPrimaryInventoryRow(inventoryRows);
      const quantityBefore = normalizeQuantity(inventory?.quantity);
      if (!rowId(inventory) || quantityBefore <= 0) {
        return json({
          ok: false,
          code: 'insufficient_hint_balance',
          error: 'İpucu hakkın kalmadı.',
          hintBalance: quantityBefore,
          balanceAfter: quantityBefore,
          revealStage,
        }, 409);
      }

      const timestamp = nowIso();
      const balanceAfter = quantityBefore - 1;
      const updatedInventory = await inventoryEntity.update(rowId(inventory), {
        quantity: balanceAfter,
        updated_at: timestamp,
        metadata: {
          ...(inventory?.metadata && typeof inventory.metadata === 'object' ? inventory.metadata : {}),
          lastSpendSource: SOLO_SOURCE,
          lastSpendReason: SOLO_USE_REASON,
          lastRevealStage: revealStage,
        },
      });

      let transaction: any = null;
      try {
        transaction = await transactionEntity.create({
          user_email: actorKey,
          quantity_delta: -1,
          reason: SOLO_USE_REASON,
          source: SOLO_SOURCE,
          related_entity_type: 'solo_question',
          related_entity_id: safeText(body?.relatedEntityId || body?.related_entity_id || body?.questionId || body?.question_id),
          idempotency_key: idempotencyKey,
          balance_before: quantityBefore,
          balance_after: balanceAfter,
          created_at: timestamp,
          created_by: player.createdBy,
          metadata: {
            ...safeMetadata(body, revealStage),
            phase: 'solo_hint_inventory_phase_1',
            playerType: player.playerType,
            ownerKeyHashOnly: true,
          },
        });
      } catch (error) {
        await inventoryEntity.update(rowId(updatedInventory) || rowId(inventory), {
          quantity: quantityBefore,
          updated_at: nowIso(),
          metadata: {
            ...(updatedInventory?.metadata && typeof updatedInventory.metadata === 'object' ? updatedInventory.metadata : {}),
            hintSpendRollbackReason: 'ledger_create_failed',
          },
        }).catch(() => null);
        console.error('[consumeUserHint] ledger create failed', error?.message || error);
        return json({ ok: false, code: 'hint_ledger_write_failed', error: 'İpucu işlemi kaydedilemedi.' }, 500);
      }

      const finalInventory = await inventoryEntity.update(rowId(updatedInventory) || rowId(inventory), {
        last_transaction_id: rowId(transaction),
        updated_at: timestamp,
      }).catch(() => updatedInventory);
      const duplicateRowsRepaired = await repairDuplicateInventoryRowsAfterSpend(
        base44,
        actorKey,
        balanceAfter,
        rowId(transaction),
        rowId(finalInventory) || rowId(updatedInventory) || rowId(inventory) || '',
      );

      return json({
        ok: true,
        playerType: player.playerType,
        quantityDelta: -1,
        reason: SOLO_USE_REASON,
        source: SOLO_SOURCE,
        balanceBefore: quantityBefore,
        balanceAfter,
        hintBalance: balanceAfter,
        revealStage,
        inventory: publicInventory(finalInventory),
        duplicateRowsRepaired,
        appliedAt: timestamp,
        privateActorKeyReturned: false,
        rawGuestTokenServerStored: false,
        noKronoxPuan: true,
        noLeaderboardImpact: true,
      });
    });
  } catch (error) {
    console.error('[consumeUserHint] failed', error?.message || error);
    return json({ ok: false, code: 'hint_consume_failed', error: 'İpucu kullanılamadı. Lütfen tekrar dene.' }, 500);
  }
});
