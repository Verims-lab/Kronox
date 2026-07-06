/* global Deno */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.34';

// claimLoginBonuses — Codex564. Server-side starter_bonus (+100 once) and
// daily_login (+20 per UTC day) Diamond grants for authenticated users.
//
// These grants were moved out of the race-prone client bootstrap after a
// post-cleanup starter_bonus duplicate proved the client path could still
// write duplicate DiamondTransaction rows. The client may only invoke this
// function; it must not create DiamondTransaction rows or mutate the Diamond
// balance for these grants.
//
// Guard pattern (same as other economy mutations):
//   • find-before-create by idempotency_key (EARLIEST row is canonical)
//   • EconomyOperationLock (operation_scope login_bonus_grant) + post-lock
//     re-check before any write
//   • confirm-after-write re-read of the ledger row
//   • persisted User guard fields (starter_bonus_granted_at /
//     last_daily_diamond_reward_date) with ledger/guard recovery that never
//     re-grants
//   • grants Diamonds only: no Kronox Puan, no leaderboard impact
//   • sanitized response: no internal row ids, provider ids, or other users

const STARTER_BONUS_AMOUNT = 100;
const DAILY_LOGIN_AMOUNT = 20;
const RUNTIME_VERSION = 'login-bonus-server-v1';
const ECONOMY_LOCK_TTL_MS = 8_000;
const ECONOMY_LOCK_SETTLE_MS = 80;

function json(payload: unknown, status = 200) {
  return Response.json(payload, { status });
}

function normalizeEmail(value: unknown) {
  return String(value || '').trim().toLowerCase();
}

function normalizeNumber(value: unknown, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.floor(number)) : fallback;
}

function rowId(row: any) {
  return row?.id || row?._id || null;
}

function nowIso() {
  return new Date().toISOString();
}

function utcDateKey(now = new Date()) {
  return now.toISOString().slice(0, 10);
}

function diamondTransactionEntity(base44: any) {
  return base44?.entities?.DiamondTransaction || base44?.asServiceRole?.entities?.DiamondTransaction || null;
}

function userEntity(base44: any) {
  return base44?.asServiceRole?.entities?.User || base44?.entities?.User || null;
}

function economyOperationLockEntity(base44: any) {
  return base44?.asServiceRole?.entities?.EconomyOperationLock || base44?.entities?.EconomyOperationLock || null;
}

async function findDiamondTransaction(base44: any, email: string, idempotencyKey: string) {
  const entity = diamondTransactionEntity(base44);
  if (!entity?.filter || !email || !idempotencyKey) return null;
  // Canonical-row semantics: the EARLIEST ledger row per idempotency_key is
  // canonical (ascending created_at); any historical duplicate is ignored.
  const rows = await entity
    .filter({ user_email: email, idempotency_key: idempotencyKey }, 'created_at', 1)
    .catch(() => []);
  return Array.isArray(rows) && rows.length ? rows[0] : null;
}

async function createDiamondTransaction(base44: any, email: string, idempotencyKey: string, payload: Record<string, unknown>) {
  const existing = await findDiamondTransaction(base44, email, idempotencyKey);
  if (existing) return existing;
  const entity = diamondTransactionEntity(base44);
  if (!entity?.create) return null;
  await entity.create(payload);
  const confirmed = await findDiamondTransaction(base44, email, idempotencyKey);
  return confirmed;
}

async function findUserRow(base44: any, fallback: any, email: string) {
  const entity = userEntity(base44);
  if (!entity?.filter) return fallback;
  const rows = await entity.filter({ email }, '-updated_date', 1).catch(() => []);
  return (Array.isArray(rows) && rows[0]) || fallback;
}

function buildGrantSpecs(email: string, dateKey: string) {
  return [
    {
      source: 'starter_bonus',
      amount: STARTER_BONUS_AMOUNT,
      idempotencyKey: `starter_bonus:${email}`,
      hasGuard: (row: any) => Boolean(row?.starter_bonus_granted_at),
      guardPatch: (timestamp: string) => ({ starter_bonus_granted_at: timestamp }),
    },
    {
      source: 'daily_login',
      amount: DAILY_LOGIN_AMOUNT,
      idempotencyKey: `daily_login:${email}:${dateKey}`,
      hasGuard: (row: any) => String(row?.last_daily_diamond_reward_date || '') === dateKey,
      guardPatch: () => ({ last_daily_diamond_reward_date: dateKey }),
    },
  ];
}

function grantMetadata(dateKey: string, source: string, extra: Record<string, unknown> = {}) {
  return {
    runtimeVersion: RUNTIME_VERSION,
    dayBoundary: 'UTC',
    dateKey: source === 'daily_login' ? dateKey : undefined,
    grantsDiamondsOnly: true,
    noKronoxPuan: true,
    noLeaderboardImpact: true,
    ...extra,
  };
}

function alreadyGrant(spec: any) {
  return {
    source: spec.source,
    granted: false,
    alreadyGranted: true,
    reason: 'already_recorded',
    amount: spec.amount,
  };
}

function buildResponse(grants: any[], balanceAfter: number, totalGranted: number, userPatch: Record<string, unknown> | null) {
  return {
    ok: true,
    runtimeVersion: RUNTIME_VERSION,
    grants,
    totalGranted,
    diamondBalanceAfter: balanceAfter,
    userPatch,
    grantsDiamondsOnly: true,
    noKronoxPuan: true,
    noLeaderboardImpact: true,
  };
}

function isActiveLock(row: any, nowMs: number) {
  if (String(row?.status || '') !== 'active') return false;
  const expiresMs = Date.parse(String(row?.expires_at || ''));
  return Number.isFinite(expiresMs) ? expiresMs > nowMs : true;
}

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withEconomyLock(base44: any, lockKey: string, operationId: string, callback: () => Promise<Response>) {
  const entity = economyOperationLockEntity(base44);
  if (!entity?.filter || !entity?.create || !entity?.update) return callback();
  const now = nowIso();
  const nowMs = Date.parse(now);
  const existingRows = await entity.filter({ lock_key: lockKey }, '-acquired_at', 20).catch(() => []);
  const active = Array.isArray(existingRows) ? existingRows.find((row: any) => isActiveLock(row, nowMs)) : null;
  if (active) {
    return json({ ok: false, code: 'economy_operation_in_progress', error: 'Ekonomi işlemi işleniyor. Lütfen tekrar dene.' }, 409);
  }
  const lock = await entity.create({
    lock_key: lockKey,
    actor_key: lockKey.slice(0, 220),
    operation_scope: 'login_bonus_grant',
    operation_id: operationId.slice(0, 220),
    status: 'active',
    acquired_at: now,
    expires_at: new Date(nowMs + ECONOMY_LOCK_TTL_MS).toISOString(),
    metadata: { runtimeVersion: RUNTIME_VERSION, ttlMs: ECONOMY_LOCK_TTL_MS },
  }).catch(() => null);
  await sleep(ECONOMY_LOCK_SETTLE_MS);
  try {
    return await callback();
  } finally {
    if (rowId(lock)) {
      await entity.update(rowId(lock), { status: 'released', released_at: nowIso() }).catch(() => null);
    }
  }
}

Deno.serve(async (req: Request) => {
  try {
    if (req.method !== 'POST') {
      return json({ ok: false, code: 'method_not_allowed', error: 'Bu işlem desteklenmiyor.' }, 405);
    }
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    const email = normalizeEmail(user?.email || user?.user_email);
    if (!email) {
      return json({ ok: false, code: 'auth_required', error: 'Giriş yapmanız gerekiyor.' }, 401);
    }

    const dateKey = utcDateKey();
    const specs = buildGrantSpecs(email, dateKey);
    const userRow = await findUserRow(base44, user, email);

    // Fast path — every grant already has both its canonical ledger row and
    // its persisted guard field: nothing to mutate, no lock needed.
    const preChecks: any[] = [];
    for (const spec of specs) {
      const existing = await findDiamondTransaction(base44, email, spec.idempotencyKey);
      preChecks.push({ spec, existing });
    }
    if (preChecks.every(({ spec, existing }) => existing && spec.hasGuard(userRow))) {
      return json(buildResponse(specs.map(alreadyGrant), normalizeNumber(userRow?.diamonds), 0, null));
    }

    return await withEconomyLock(base44, `economy:user:${email}`, `login_bonus:${email}:${dateKey}`, async () => {
      const freshRow = await findUserRow(base44, userRow, email);
      const timestamp = nowIso();
      let balance = normalizeNumber(freshRow?.diamonds, 0);
      let totalGranted = 0;
      const guardPatch: Record<string, unknown> = {};
      const grants: any[] = [];

      for (const spec of specs) {
        const postLockExisting = await findDiamondTransaction(base44, email, spec.idempotencyKey);
        if (postLockExisting) {
          // Ledger exists: never re-grant. Recover a missing guard field and
          // keep the balance at least as high as the recorded balance_after.
          balance = Math.max(balance, normalizeNumber(postLockExisting.balance_after));
          if (!spec.hasGuard(freshRow)) Object.assign(guardPatch, spec.guardPatch(timestamp));
          grants.push(alreadyGrant(spec));
          continue;
        }
        if (spec.hasGuard(freshRow)) {
          // Guard exists but ledger row is missing: create a recovery ledger
          // row without changing the balance; never grant again.
          await createDiamondTransaction(base44, email, spec.idempotencyKey, {
            user_email: email,
            amount: spec.amount,
            balance_before: Math.max(0, balance - spec.amount),
            balance_after: balance,
            source: spec.source,
            direction: 'earn',
            idempotency_key: spec.idempotencyKey,
            metadata: grantMetadata(dateKey, spec.source, { recoveredFromPersistedGuard: true }),
            created_at: timestamp,
          });
          grants.push(alreadyGrant(spec));
          continue;
        }

        const balanceBefore = balance;
        balance = balanceBefore + spec.amount;
        const tx = await createDiamondTransaction(base44, email, spec.idempotencyKey, {
          user_email: email,
          amount: spec.amount,
          balance_before: balanceBefore,
          balance_after: balance,
          source: spec.source,
          direction: 'earn',
          idempotency_key: spec.idempotencyKey,
          metadata: grantMetadata(dateKey, spec.source),
          created_at: timestamp,
        });
        if (!tx) throw new Error('login_bonus_transaction_missing');
        Object.assign(guardPatch, spec.guardPatch(timestamp));
        totalGranted += spec.amount;
        grants.push({ source: spec.source, granted: true, alreadyGranted: false, amount: spec.amount });
      }

      let userPatch: Record<string, unknown> | null = null;
      if (totalGranted > 0 || Object.keys(guardPatch).length > 0) {
        userPatch = { diamonds: balance, economy_updated_at: timestamp, ...guardPatch };
        const entity = userEntity(base44);
        if (entity?.update && rowId(freshRow)) {
          await entity.update(rowId(freshRow), userPatch);
        }
      }
      return json(buildResponse(grants, balance, totalGranted, userPatch));
    });
  } catch (error) {
    console.error('[claimLoginBonuses] failed', (error as any)?.message || error);
    return json({ ok: false, code: 'login_bonus_grant_failed', error: 'Giriş ödülü alınamadı. Tekrar dene.' }, 500);
  }
});