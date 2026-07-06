/* global Deno */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.34';

const STARTER_QUANTITY = 3;
const STARTER_SOURCE = 'starter_hints';
const STARTER_REASON = 'starter_grant';
const GUEST_ID_PREFIX = 'guest_';

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

function rowId(row: any) {
  return row?.id || row?._id || null;
}

function nowIso() {
  return new Date().toISOString();
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
    return { ok: false, response: json({ ok: false, code: 'unauthenticated', error: 'İpucu için profilini tamamlamalısın.' }, 401) };
  }
  const guest = await findGuestProfile(base44, guestId);
  const expectedHash = String(guest?.guest_token_hash || '');
  const providedHash = await hashGuestToken(guestId, guestToken);
  if (!guest || !expectedHash || expectedHash !== providedHash) {
    return { ok: false, response: json({ ok: false, code: 'invalid_guest_token', error: 'Misafir oturumu doğrulanamadı.' }, 401) };
  }
  if (String(guest?.status || '') === 'linked' || !isGuestProfileComplete(guest)) {
    return { ok: false, response: json({ ok: false, code: 'guest_profile_incomplete', error: 'İpucu için profilini tamamlamalısın.' }, 403) };
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
  const seen = new Set<string>();
  return (Array.isArray(rows) ? rows : [])
    .filter((row) => String(row?.user_email || '') === actorKey)
    .filter((row) => {
      const id = rowId(row) || `${row?.user_email}:${row?.created_at}:${row?.quantity}`;
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

async function findStarterTransaction(base44: any, actorKey: string, idempotencyKey: string) {
  const entity = entityStore(base44, 'HintTransaction');
  if (!entity?.filter) return null;
  const rows = await entity
    .filter({ user_email: actorKey, idempotency_key: idempotencyKey }, '-created_at', 1)
    .catch(() => []);
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
  const currentQuantity = Math.max(
    maxKnownInventoryQuantity(inventoryRows),
    normalizeQuantity(latestLedgerTransaction?.balance_after),
  );
  const existingTransaction = await findStarterTransaction(base44, actorKey, idempotencyKey);

  if (existingTransaction) {
    const ledgerRecoveredQuantity = latestLedgerTransaction
      ? normalizeQuantity(latestLedgerTransaction.balance_after)
      : (normalizeQuantity(existingTransaction.balance_after) || STARTER_QUANTITY);
    const recoveredQuantity = Math.max(currentQuantity, ledgerRecoveredQuantity);
    const shouldRepair = !rowId(existingInventory)
      || String(existingInventory?.user_email || '') !== actorKey
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
    return {
      granted: false,
      alreadyGranted: true,
      idempotencyKey,
      quantityBefore: currentQuantity,
      quantityAfter: normalizeQuantity(row?.quantity),
      inventory: publicInventory(row),
      transactionId: rowId(latestLedgerTransaction) || rowId(existingTransaction),
      selfHealed: shouldRepair,
    };
  }

  const balanceAfter = Math.max(currentQuantity, STARTER_QUANTITY);
  const quantityDelta = Math.max(0, balanceAfter - currentQuantity);
  const transactionPayload = {
    user_email: actorKey,
    quantity_delta: quantityDelta,
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
  };
  const existingRecovered = await findStarterTransaction(base44, actorKey, idempotencyKey);
  const transaction = existingRecovered
    ? existingRecovered
    : await entityStore(base44, 'HintTransaction').create(transactionPayload);
  const latestInventoryRows = await findInventoryRows(base44, actorKey);
  const latestInventory = selectPrimaryInventoryRow(latestInventoryRows) || existingInventory;
  const finalQuantity = Math.max(
    maxKnownInventoryQuantity(latestInventoryRows),
    normalizeQuantity(transaction?.balance_after),
    balanceAfter,
  );
  const row = await upsertInventory(base44, latestInventory || existingInventory, {
    user_email: actorKey,
    quantity: finalQuantity,
    created_at: (latestInventory || existingInventory)?.created_at || timestamp,
    updated_at: timestamp,
    last_transaction_id: rowId(transaction),
    metadata: {
      ...(latestInventory?.metadata && typeof latestInventory.metadata === 'object' ? latestInventory.metadata : {}),
      starterGrantInitialized: true,
      recoveredExistingTransaction: Boolean(existingRecovered),
      duplicateRowsIgnored: Math.max(0, latestInventoryRows.length - 1),
      ownerKeyHashOnly: true,
    },
  });

  return {
    granted: !existingRecovered && quantityDelta > 0,
    alreadyGranted: Boolean(existingRecovered),
    idempotencyKey,
    quantityBefore: currentQuantity,
    quantityDelta,
    quantityAfter: finalQuantity,
    inventory: publicInventory(row),
    transactionId: rowId(transaction),
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
    const body = await req.json().catch(() => ({}));
    const player = await resolveHintPlayer(base44, body);
    if (!player.ok) return player.response;

    const inventoryEntity = entityStore(base44, 'UserHintInventory');
    const transactionEntity = entityStore(base44, 'HintTransaction');
    if (!inventoryEntity?.filter || !inventoryEntity?.create || !inventoryEntity?.update || !transactionEntity?.filter || !transactionEntity?.create) {
      return json({ ok: false, code: 'hint_inventory_entity_missing', error: 'İpucu kayıtları hazır değil.' }, 500);
    }

    const result = await ensureStarterHints(base44, player);
    return json({
      ok: true,
      playerType: player.playerType,
      hintBalance: normalizeQuantity(result.quantityAfter ?? result.inventory?.quantity),
      inventory: result.inventory,
      starterQuantity: STARTER_QUANTITY,
      starterReason: STARTER_REASON,
      starterSource: STARTER_SOURCE,
      initialized: Boolean(result.granted),
      alreadyGranted: Boolean(result.alreadyGranted),
      selfHealed: Boolean(result.selfHealed),
      rawGuestTokenServerStored: false,
      privateActorKeyReturned: false,
      noKronoxPuan: true,
      noLeaderboardImpact: true,
      performance: {
        durationMs: Math.max(0, Date.now() - startedAt),
      },
    });
  } catch (error) {
    console.error('[ensureUserHintInventory] failed', error?.message || error);
    return json({ ok: false, code: 'hint_inventory_init_failed', error: 'İpucu hazırlanamadı. Lütfen tekrar dene.' }, 500);
  }
});
