import { createClientFromRequest } from 'npm:@base44/sdk@0.8.34';

const ADMIN_GRANT_SOURCE = 'admin_adjustment';
const ADMIN_GRANT_RELATED_TYPE = 'admin_test_diamond_grant';
const ALLOWED_AMOUNTS = new Set([100, 300, 500, 1000]);
const KRONOX_ID_PATTERN = /^KX-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/;
const ECONOMY_LOCK_TTL_MS = 8_000;
const ECONOMY_LOCK_SETTLE_MS = 80;

function json(payload: unknown, status = 200) {
  return Response.json(payload, { status });
}

function normalizeEmail(value: unknown) {
  return String(value || '').trim().toLowerCase();
}

function normalizeKronoxUserId(value: unknown) {
  const text = String(value || '').trim().toUpperCase();
  return KRONOX_ID_PATTERN.test(text) ? text : '';
}

function normalizeAmount(value: unknown) {
  const amount = Math.floor(Number(value) || 0);
  return ALLOWED_AMOUNTS.has(amount) ? amount : 0;
}

function normalizeRequestId(value: unknown) {
  const text = String(value || '').trim();
  if (!text || text.length > 96) return '';
  return /^[A-Za-z0-9:_-]+$/.test(text) ? text : '';
}

function normalizeNonNegativeInteger(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.floor(number)) : 0;
}

function rowId(row: any) {
  return row?.id || row?._id || null;
}

function nowIso() {
  return new Date().toISOString();
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

function safeDisplayName(row: any) {
  const value = [
    row?.username,
    row?.display_name,
    row?.displayName,
    row?.name,
  ].map((entry) => String(entry || '').replace(/\s+/g, ' ').trim())
    .find((entry) => entry && !entry.includes('@'));
  return value ? value.slice(0, 32) : 'Oyuncu';
}

function safeLockText(value: unknown, maxLength = 220) {
  const text = String(value || '').trim();
  return text ? text.slice(0, maxLength) : '';
}

function buildIdempotencyKey(requestId: string) {
  return `${ADMIN_GRANT_RELATED_TYPE}:${requestId}`;
}

function isActiveAdminRole(role: unknown) {
  const value = String(role || '').trim().toLowerCase();
  return value === 'owner' || value === 'admin';
}

function isActiveAdminStatus(status: unknown) {
  return String(status || '').trim().toLowerCase() === 'active';
}

const ADMIN_AUTH_FIELD_CANDIDATES = {
  email: ['email', 'Email', 'user_email', 'admin_email'],
  role: ['role', 'Role', 'user_role'],
  status: ['status', 'Status'],
};

function readAdminAuthField(row: any, candidates: string[]) {
  for (const field of candidates) {
    if (row && Object.prototype.hasOwnProperty.call(row, field)) {
      return { value: row[field], field };
    }
  }
  return { value: undefined, field: '' };
}

async function getAdminAuthorization(base44: any, user: any) {
  const email = normalizeEmail(user?.email);
  if (!email) return { isAdmin: false, row: null, role: '', status: '' };

  const adminEntity = base44?.asServiceRole?.entities?.AdminUser;
  if (!adminEntity?.filter) return { isAdmin: false, row: null, role: '', status: '' };

  let rows: any[] = [];
  for (const field of ADMIN_AUTH_FIELD_CANDIDATES.email) {
    const result = await adminEntity.filter({ [field]: email }, '-updated_at', 10).catch(() => []);
    if (Array.isArray(result) && result.length > 0) {
      rows = result;
      break;
    }
  }

  const exactRows = rows
    .map((candidate) => {
      const emailField = readAdminAuthField(candidate, ADMIN_AUTH_FIELD_CANDIDATES.email);
      const roleField = readAdminAuthField(candidate, ADMIN_AUTH_FIELD_CANDIDATES.role);
      const statusField = readAdminAuthField(candidate, ADMIN_AUTH_FIELD_CANDIDATES.status);
      return {
        candidate,
        email: normalizeEmail(emailField.value),
        role: String(roleField.value || '').trim().toLowerCase(),
        status: String(statusField.value || '').trim().toLowerCase(),
      };
    })
    .filter((candidate) => candidate.email === email);

  const active = exactRows.find((candidate) => (
    isActiveAdminStatus(candidate.status) && isActiveAdminRole(candidate.role)
  )) || null;

  return {
    isAdmin: Boolean(active?.candidate),
    row: active?.candidate || null,
    role: active?.role || '',
    status: active?.status || '',
  };
}

async function requireAdmin(base44: any) {
  try {
    const user = await base44.auth.me();
    if (!user?.email) return { response: json({ ok: false, code: 'auth_required', error: 'Giris gerekli.' }, 401) };

    const authorization = await getAdminAuthorization(base44, user);
    if (!authorization.isAdmin) return { response: json({ ok: false, code: 'admin_required', error: 'Admin yetkisi gerekli.' }, 403) };

    return { user, admin: authorization.row, adminRole: authorization.role, adminActorEmail: normalizeEmail(user.email) };
  } catch (_error) {
    return { response: json({ ok: false, code: 'auth_required', error: 'Giris gerekli.' }, 401) };
  }
}

function entityStore(base44: any, entityName: string) {
  return base44?.asServiceRole?.entities?.[entityName] || base44?.entities?.[entityName] || null;
}

async function safeFilter(base44: any, entityName: string, filter: Record<string, unknown>, sort = '-updated_at', limit = 10) {
  const entity = entityStore(base44, entityName);
  if (!entity?.filter) return [];
  const rows = await entity.filter(filter, sort, limit).catch(() => []);
  return Array.isArray(rows) ? rows : [];
}

function uniqueRows(rows: any[]) {
  const seen = new Set<string>();
  return rows.filter((row) => {
    const id = String(rowId(row) || '');
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

function userTargetFromRow(row: any) {
  const email = normalizeEmail(row?.email || row?.user_email);
  if (!rowId(row) || !email) return null;
  const ownerKey = ownerKeyFromEmail(email);
  return {
    row,
    rowId: rowId(row),
    playerType: 'registered',
    economyKey: email,
    ownerKey,
    kronoxUserId: normalizeKronoxUserId(row?.kronox_user_id),
    username: safeDisplayName(row),
    balance: normalizeNonNegativeInteger(row?.diamonds),
  };
}

function guestTargetFromRow(row: any) {
  const guestId = String(row?.guest_id || '').trim();
  const ownerKey = ownerKeyFromGuestId(guestId);
  if (!rowId(row) || !guestId || !ownerKey) return null;
  return {
    row,
    rowId: rowId(row),
    playerType: 'guest',
    economyKey: `guest:${ownerKey}`,
    ownerKey,
    kronoxUserId: normalizeKronoxUserId(row?.kronox_user_id),
    username: safeDisplayName(row),
    balance: normalizeNonNegativeInteger(row?.diamonds),
  };
}

async function resolveTarget(base44: any, kronoxUserId: string) {
  const userRows = uniqueRows((await safeFilter(base44, 'User', { kronox_user_id: kronoxUserId }, '-updated_at', 10))
    .filter((row) => normalizeKronoxUserId(row?.kronox_user_id) === kronoxUserId));
  if (userRows.length > 1) {
    return { response: json({ ok: false, code: 'ambiguous_target', error: 'Bu Kullanici ID icin birden fazla kayit bulundu.' }, 409) };
  }
  if (userRows.length === 1) {
    const target = userTargetFromRow(userRows[0]);
    if (!target) return { response: json({ ok: false, code: 'invalid_target', error: 'Kullanici kaydi dogrulanamadi.' }, 409) };
    return { target };
  }

  const guestRows = uniqueRows((await safeFilter(base44, 'GuestProfile', { kronox_user_id: kronoxUserId }, '-updated_at', 10))
    .filter((row) => normalizeKronoxUserId(row?.kronox_user_id) === kronoxUserId));
  const activeGuests = guestRows.filter((row) => (
    String(row?.status || 'guest').trim().toLowerCase() !== 'linked' && !normalizeEmail(row?.linked_user_email)
  ));
  if (activeGuests.length > 1) {
    return { response: json({ ok: false, code: 'ambiguous_target', error: 'Bu Kullanici ID icin birden fazla guest kaydi bulundu.' }, 409) };
  }
  if (activeGuests.length === 1) {
    const target = guestTargetFromRow(activeGuests[0]);
    if (!target) return { response: json({ ok: false, code: 'invalid_target', error: 'Guest kaydi dogrulanamadi.' }, 409) };
    return { target };
  }
  if (guestRows.length > 0) {
    return {
      response: json({
        ok: false,
        code: 'linked_guest_canonical_user_missing',
        error: 'Bu ID bagli guest kaydinda gorunuyor; kayitli kullanici kaydi dogrulanamadi.',
      }, 409),
    };
  }
  return { response: json({ ok: false, code: 'target_not_found', error: 'Kullanici ID bulunamadi.' }, 404) };
}

function economyOperationLockEntity(base44: any) {
  return entityStore(base44, 'EconomyOperationLock');
}

function buildEconomyLockKey(target: any) {
  return `economy:user:${target.economyKey}`;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isSameRow(a: any, b: any) {
  const left = rowId(a);
  const right = rowId(b);
  if (left && right) return left === right;
  return Boolean(a?.operation_id && b?.operation_id && a.operation_id === b.operation_id && a?.actor_key === b?.actor_key);
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
      const left = Date.parse(String(a?.acquired_at || ''));
      const right = Date.parse(String(b?.acquired_at || ''));
      if (Number.isFinite(left) && Number.isFinite(right) && left !== right) return left - right;
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
    actor_key: safeLockText(context.actorKey),
    operation_scope: 'admin_diamond_grant',
    operation_id: safeLockText(context.operationId),
    status: 'active',
    acquired_at: now,
    expires_at: new Date(nowMs + ECONOMY_LOCK_TTL_MS).toISOString(),
    metadata: {
      phase: 'admin_diamond_grant_parallel_race_guard_phase_1',
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
      error: 'Ekonomi islemi isleniyor. Lutfen tekrar dene.',
    }, 409);
  }
  try {
    return await callback();
  } finally {
    await releaseEconomyOperationLock(base44, lockResult.lock);
  }
}

async function findDiamondTransactionByKey(base44: any, idempotencyKey: string) {
  const entity = entityStore(base44, 'DiamondTransaction');
  if (!entity?.filter || !idempotencyKey) return null;
  const rows = await entity.filter({ idempotency_key: idempotencyKey }, '-created_at', 5).catch(() => []);
  return Array.isArray(rows) && rows.length ? rows[0] : null;
}

function transactionMatchesRequest(tx: any, target: any, amount: number) {
  const metadata = tx?.metadata && typeof tx.metadata === 'object' ? tx.metadata : {};
  return normalizeKronoxUserId(tx?.kronox_user_id || metadata.targetKronoxUserId) === target.kronoxUserId
    && normalizeAmount(tx?.amount) === amount
    && String(tx?.source || '') === ADMIN_GRANT_SOURCE
    && String(tx?.direction || '') === 'earn';
}

async function reconcileTargetBalanceFromTransaction(base44: any, target: any, tx: any) {
  const balanceAfter = normalizeNonNegativeInteger(tx?.balance_after);
  const latestTarget = await refreshTarget(base44, target);
  const currentBalance = normalizeNonNegativeInteger(latestTarget.balance);
  if (balanceAfter > currentBalance) {
    await updateTargetBalance(base44, latestTarget, balanceAfter, nowIso()).catch(() => null);
    return balanceAfter;
  }
  return Math.max(currentBalance, balanceAfter);
}

async function responseFromExistingTransaction(base44: any, tx: any, target: any, amount: number) {
  const reconciledBalanceAfter = await reconcileTargetBalanceFromTransaction(base44, target, tx);
  return {
    ok: true,
    alreadyApplied: true,
    source: ADMIN_GRANT_RELATED_TYPE,
    kronoxUserId: target.kronoxUserId,
    targetUsername: target.username,
    targetPlayerType: target.playerType,
    amountAdded: amount,
    diamondBalanceBefore: normalizeNonNegativeInteger(tx?.balance_before),
    diamondBalanceAfter: reconciledBalanceAfter,
    grantsDiamondsOnly: true,
    noKronoxPuan: true,
    noLeaderboardImpact: true,
  };
}

async function createDiamondTransaction(base44: any, target: any, payload: Record<string, unknown>) {
  const idempotencyKey = String(payload.idempotency_key || '').trim();
  const existing = await findDiamondTransactionByKey(base44, idempotencyKey);
  if (existing) return existing;
  const created = await entityStore(base44, 'DiamondTransaction').create({
    ...payload,
    user_email: target.economyKey,
    idempotency_key: idempotencyKey,
  });
  const confirmed = await findDiamondTransactionByKey(base44, idempotencyKey);
  return confirmed || created;
}

async function updateTargetBalance(base44: any, target: any, balanceAfter: number, timestamp: string) {
  const entityName = target.playerType === 'guest' ? 'GuestProfile' : 'User';
  const entity = entityStore(base44, entityName);
  if (!entity?.update || !target.rowId) throw new Error('target_update_unavailable');
  return entity.update(target.rowId, {
    diamonds: balanceAfter,
    economy_updated_at: timestamp,
    ...(target.playerType === 'guest' ? { last_seen_at: timestamp } : {}),
  });
}

async function refreshTarget(base44: any, target: any) {
  const entityName = target.playerType === 'guest' ? 'GuestProfile' : 'User';
  const entity = entityStore(base44, entityName);
  if (!entity?.get || !target.rowId) return target;
  const row = await entity.get(target.rowId).catch(() => null);
  if (!row) return target;
  return target.playerType === 'guest' ? guestTargetFromRow(row) || target : userTargetFromRow(row) || target;
}

async function createAdminAuditLog(base44: any, adminActorEmail: string, target: any, amount: number, requestId: string, balanceBefore: number, balanceAfter: number) {
  const entity = entityStore(base44, 'AdminMaintenanceLog');
  if (!entity?.create) return null;
  return entity.create({
    action: ADMIN_GRANT_RELATED_TYPE,
    admin_email: adminActorEmail,
    target_email: target.playerType === 'registered' ? target.economyKey : `kronox:${target.kronoxUserId}`,
    result: 'success',
    metadata: {
      targetKronoxUserId: target.kronoxUserId,
      targetPlayerType: target.playerType,
      targetUsername: target.username,
      amount,
      requestId,
      balanceBefore,
      balanceAfter,
      source: ADMIN_GRANT_SOURCE,
      direction: 'earn',
      grantsDiamondsOnly: true,
      noKronoxPuan: true,
      noLeaderboardImpact: true,
      noDailyWheelImpact: true,
      noDailyQuestImpact: true,
      noMarketMutation: true,
    },
    created_at: nowIso(),
    description: ADMIN_GRANT_RELATED_TYPE,
  }).catch(() => null);
}

Deno.serve(async (req: Request) => {
  try {
    if (req.method !== 'POST') {
      return json({ ok: false, code: 'method_not_allowed', error: 'Bu islem desteklenmiyor.' }, 405);
    }

    const base44 = createClientFromRequest(req);
    const adminAuth = await requireAdmin(base44);
    if (adminAuth.response) return adminAuth.response;

    const body = await req.json().catch(() => ({}));
    const kronoxUserId = normalizeKronoxUserId(body?.kronox_user_id || body?.kronoxUserId);
    const amount = normalizeAmount(body?.amount);
    const requestId = normalizeRequestId(body?.request_id || body?.requestId || body?.idempotency_key || body?.idempotencyKey);
    if (!kronoxUserId) return json({ ok: false, code: 'invalid_kronox_user_id', error: 'Gecerli Kullanici ID gerekli.' }, 400);
    if (!amount) return json({ ok: false, code: 'invalid_amount', error: 'Yalnizca 100, 300, 500 veya 1000 Elmas yuklenebilir.' }, 400);
    if (!requestId) return json({ ok: false, code: 'missing_request_id', error: 'Istek kimligi gerekli.' }, 400);

    const resolved = await resolveTarget(base44, kronoxUserId);
    if (resolved.response) return resolved.response;
    const target = resolved.target;
    const idempotencyKey = buildIdempotencyKey(requestId);
    const existingTx = await findDiamondTransactionByKey(base44, idempotencyKey);
    if (existingTx) {
      if (!transactionMatchesRequest(existingTx, target, amount)) {
        return json({ ok: false, code: 'idempotency_key_conflict', error: 'Bu istek kimligi farkli bir islem icin kullanilmis.' }, 409);
      }
      return json(await responseFromExistingTransaction(base44, existingTx, target, amount));
    }

    return await withEconomyOperationLock(base44, buildEconomyLockKey(target), {
      actorKey: target.economyKey,
      operationId: idempotencyKey,
      metadata: {
        targetKronoxUserId: target.kronoxUserId,
        targetPlayerType: target.playerType,
        amount,
        adminActorKey: ownerKeyFromEmail(adminAuth.adminActorEmail),
      },
    }, async () => {
      const postLockTx = await findDiamondTransactionByKey(base44, idempotencyKey);
      if (postLockTx) {
        if (!transactionMatchesRequest(postLockTx, target, amount)) {
          return json({ ok: false, code: 'idempotency_key_conflict', error: 'Bu istek kimligi farkli bir islem icin kullanilmis.' }, 409);
        }
        return json(await responseFromExistingTransaction(base44, postLockTx, target, amount));
      }

      const latestTarget = await refreshTarget(base44, target);
      const timestamp = nowIso();
      const balanceBefore = normalizeNonNegativeInteger(latestTarget.balance);
      const balanceAfter = balanceBefore + amount;
      const tx = await createDiamondTransaction(base44, latestTarget, {
        user_email: latestTarget.economyKey,
        owner_key: latestTarget.ownerKey,
        kronox_user_id: latestTarget.kronoxUserId,
        player_type: latestTarget.playerType,
        amount,
        balance_before: balanceBefore,
        balance_after: balanceAfter,
        source: ADMIN_GRANT_SOURCE,
        direction: 'earn',
        related_entity_type: ADMIN_GRANT_RELATED_TYPE,
        related_entity_id: idempotencyKey,
        idempotency_key: idempotencyKey,
        metadata: {
          requestId,
          targetKronoxUserId: latestTarget.kronoxUserId,
          targetPlayerType: latestTarget.playerType,
          adminActorKey: ownerKeyFromEmail(adminAuth.adminActorEmail),
          adminRole: String(adminAuth.adminRole || ''),
          grantsDiamondsOnly: true,
          noKronoxPuan: true,
          noLeaderboardImpact: true,
          noDailyWheelImpact: true,
          noDailyQuestImpact: true,
          noMarketMutation: true,
        },
        created_at: timestamp,
        description: ADMIN_GRANT_RELATED_TYPE,
      });
      if (!tx) throw new Error('admin_diamond_transaction_missing');

      await updateTargetBalance(base44, latestTarget, balanceAfter, timestamp);
      await createAdminAuditLog(base44, adminAuth.adminActorEmail, latestTarget, amount, requestId, balanceBefore, balanceAfter);

      return json({
        ok: true,
        alreadyApplied: false,
        source: ADMIN_GRANT_RELATED_TYPE,
        kronoxUserId: latestTarget.kronoxUserId,
        targetUsername: latestTarget.username,
        targetPlayerType: latestTarget.playerType,
        amountAdded: amount,
        diamondBalanceBefore: balanceBefore,
        diamondBalanceAfter: balanceAfter,
        grantsDiamondsOnly: true,
        noKronoxPuan: true,
        noLeaderboardImpact: true,
      });
    });
  } catch (error) {
    console.error('[adminGrantDiamonds] failed', error?.message || error);
    return json({ ok: false, code: 'admin_diamond_grant_failed', error: 'Elmas yuklenemedi. Tekrar dene.' }, 500);
  }
});