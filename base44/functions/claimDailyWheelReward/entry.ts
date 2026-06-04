import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const DAILY_WHEEL_SOURCE = 'daily_wheel';
const STREAK_BONUS_AMOUNT = 100;
const DAY_MS = 24 * 60 * 60 * 1000;

const REWARD_TABLE = [
  { amount: 10, rarity: 'common', weight: 20 },
  { amount: 15, rarity: 'common', weight: 20 },
  { amount: 20, rarity: 'common', weight: 18 },
  { amount: 25, rarity: 'uncommon', weight: 12 },
  { amount: 30, rarity: 'uncommon', weight: 12 },
  { amount: 40, rarity: 'rare', weight: 7 },
  { amount: 50, rarity: 'rare', weight: 7 },
  { amount: 100, rarity: 'very_rare', weight: 4 },
];

function json(payload: unknown, status = 200) {
  return Response.json(payload, { status });
}

function normalizeEmail(value: unknown) {
  return String(value || '').trim().toLowerCase();
}

function normalizeNumber(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.floor(number)) : 0;
}

function utcDateKey(now = new Date()) {
  return now.toISOString().slice(0, 10);
}

function nextUtcMidnightIso(dateKey: string) {
  const start = Date.parse(`${dateKey}T00:00:00.000Z`);
  return new Date(start + DAY_MS).toISOString();
}

function previousUtcDateKey(dateKey: string) {
  const start = Date.parse(`${dateKey}T00:00:00.000Z`);
  return new Date(start - DAY_MS).toISOString().slice(0, 10);
}

function buildIdempotencyKey(email: string, dateKey: string) {
  return `daily_wheel:${email}:${dateKey}`;
}

function ownerKeyFromEmail(rawEmail: unknown) {
  const email = normalizeEmail(rawEmail);
  if (!email) return '';

  let hash = 2166136261;
  for (let i = 0; i < email.length; i += 1) {
    hash ^= email.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `u_${(hash >>> 0).toString(36)}`;
}

function randomUnit() {
  const bytes = new Uint32Array(1);
  crypto.getRandomValues(bytes);
  return bytes[0] / 0xffffffff;
}

function selectReward() {
  const total = REWARD_TABLE.reduce((sum, row) => sum + row.weight, 0);
  let cursor = randomUnit() * total;
  for (const row of REWARD_TABLE) {
    cursor -= row.weight;
    if (cursor <= 0) return row;
  }
  return REWARD_TABLE[0];
}

function computeStreak(user: any, todayKey: string) {
  const previousDate = previousUtcDateKey(todayKey);
  const lastDate = String(user?.daily_wheel_last_spin_date || '');
  const current = normalizeNumber(user?.daily_wheel_streak);
  const streakBefore = lastDate === previousDate ? current : 0;
  const streakAfter = streakBefore + 1;
  return { streakBefore, streakAfter };
}

async function findSpin(base44: any, email: string, dateKey: string, idempotencyKey: string) {
  const entity = base44.asServiceRole.entities.DailyWheelSpin;
  if (!entity?.filter) return null;
  const [byKey, byDate] = await Promise.all([
    entity.filter({ user_email: email, idempotency_key: idempotencyKey }, '-claimed_at', 1).catch(() => []),
    entity.filter({ user_email: email, spin_date: dateKey }, '-claimed_at', 1).catch(() => []),
  ]);
  const rows = [...(Array.isArray(byKey) ? byKey : []), ...(Array.isArray(byDate) ? byDate : [])];
  return rows.find((row: any) => row?.id) || null;
}

async function findDiamondTransaction(base44: any, email: string, idempotencyKey: string) {
  const rows = await base44.asServiceRole.entities.DiamondTransaction
    .filter({ user_email: email, idempotency_key: idempotencyKey }, '-created_at', 1)
    .catch(() => []);
  return Array.isArray(rows) && rows.length ? rows[0] : null;
}

async function createDiamondTransaction(base44: any, payload: Record<string, unknown>) {
  const existing = await findDiamondTransaction(base44, String(payload.user_email || ''), String(payload.idempotency_key || ''));
  if (existing) return existing;
  return base44.asServiceRole.entities.DiamondTransaction.create(payload);
}

async function createDailyWheelSpin(base44: any, payload: Record<string, unknown>) {
  const entity = base44.asServiceRole.entities.DailyWheelSpin;
  if (!entity?.create) {
    return { row: null, error: 'daily_wheel_spin_entity_unavailable' };
  }
  try {
    const row = await entity.create(payload);
    return { row, error: null };
  } catch (error) {
    return { row: null, error: error?.message || 'daily_wheel_spin_create_failed' };
  }
}

function spinRowFromDiamondTransaction(tx: any, user: any, dateKey: string, nextAvailableAt: string) {
  const metadata = tx?.metadata && typeof tx.metadata === 'object' ? tx.metadata : {};
  const totalRewardAmount = normalizeNumber(tx?.amount);
  const streakBonusAmount = normalizeNumber(metadata.streakBonusAmount);
  const rewardAmount = normalizeNumber(metadata.rewardAmount) || Math.max(0, totalRewardAmount - streakBonusAmount);
  const streakAfter = normalizeNumber(metadata.streakAfter ?? user?.daily_wheel_streak);
  const streakBefore = normalizeNumber(metadata.streakBefore ?? Math.max(0, streakAfter - 1));
  return {
    user_email: normalizeEmail(user?.email),
    spin_date: dateKey,
    reward_amount: rewardAmount,
    streak_before: streakBefore,
    streak_after: streakAfter,
    streak_bonus_amount: streakBonusAmount,
    total_reward_amount: totalRewardAmount,
    balance_before: normalizeNumber(tx?.balance_before),
    balance_after: normalizeNumber(tx?.balance_after ?? user?.diamonds),
    idempotency_key: tx?.idempotency_key || buildIdempotencyKey(normalizeEmail(user?.email), dateKey),
    claimed_at: tx?.created_at || user?.daily_wheel_last_spin_at || new Date().toISOString(),
    next_available_at: user?.daily_wheel_next_available_at || nextAvailableAt,
    metadata: {
      spinCountAfter: normalizeNumber(user?.daily_wheel_spin_count),
      recoveredFromDiamondTransaction: true,
    },
  };
}

function userPatchFromSpin(row: any, dateKey: string) {
  const claimedAt = String(row?.claimed_at || new Date().toISOString());
  return {
    diamonds: normalizeNumber(row?.balance_after),
    daily_wheel_last_spin_at: claimedAt,
    daily_wheel_last_spin_date: dateKey,
    daily_wheel_next_available_at: String(row?.next_available_at || nextUtcMidnightIso(dateKey)),
    daily_wheel_streak: normalizeNumber(row?.streak_after),
    daily_wheel_spin_count: normalizeNumber(row?.metadata?.spinCountAfter),
    economy_updated_at: claimedAt,
  };
}

function publicResult(row: any, diamondTotal: number, alreadyClaimed = false) {
  return {
    ok: true,
    available: false,
    alreadyClaimedToday: true,
    alreadyClaimed,
    serverDate: String(row?.spin_date || utcDateKey()),
    rewardAmount: normalizeNumber(row?.reward_amount),
    streakBefore: normalizeNumber(row?.streak_before),
    streakAfter: normalizeNumber(row?.streak_after),
    streakBonusAmount: normalizeNumber(row?.streak_bonus_amount),
    totalRewardAmount: normalizeNumber(row?.total_reward_amount),
    claimedAt: row?.claimed_at || null,
    nextAvailableAt: row?.next_available_at || null,
    updatedDiamondTotal: diamondTotal,
    userPatch: {
      diamonds: diamondTotal,
      daily_wheel_last_spin_at: row?.claimed_at || null,
      daily_wheel_last_spin_date: row?.spin_date || null,
      daily_wheel_next_available_at: row?.next_available_at || null,
      daily_wheel_streak: normalizeNumber(row?.streak_after),
      daily_wheel_spin_count: normalizeNumber(row?.metadata?.spinCountAfter),
    },
  };
}

async function recoverExistingSpin(base44: any, user: any, row: any, dateKey: string, idempotencyKey: string) {
  const email = normalizeEmail(user?.email);
  const nowIso = new Date().toISOString();
  const balanceAfter = Math.max(normalizeNumber(user?.diamonds), normalizeNumber(row?.balance_after));
  const patch = {
    ...userPatchFromSpin({ ...row, balance_after: balanceAfter }, dateKey),
    diamonds: balanceAfter,
  };
  await base44.asServiceRole.entities.User.update(user.id, patch).catch(() => null);
  await createDiamondTransaction(base44, {
    user_email: email,
    amount: normalizeNumber(row?.total_reward_amount),
    balance_before: normalizeNumber(row?.balance_before),
    balance_after: balanceAfter,
    source: DAILY_WHEEL_SOURCE,
    direction: 'earn',
    idempotency_key: idempotencyKey,
    metadata: {
      dailyWheelSpinId: row?.id || null,
      serverDate: dateKey,
      recoveredFromDailyWheelSpin: true,
      rewardAmount: normalizeNumber(row?.reward_amount),
      streakBonusAmount: normalizeNumber(row?.streak_bonus_amount),
    },
    created_at: nowIso,
    description: 'daily_wheel_recovery',
  }).catch(() => null);
  return { ...row, balance_after: balanceAfter };
}

Deno.serve(async (req: Request) => {
  try {
    if (req.method !== 'POST') {
      return json({ ok: false, code: 'method_not_allowed', error: 'Bu işlem desteklenmiyor.' }, 405);
    }

    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    let user: any = null;
    try {
      user = await base44.auth.me();
    } catch {
      return json({ ok: false, code: 'unauthenticated', error: 'Günlük Çark için giriş yapmalısın.' }, 401);
    }

    const email = normalizeEmail(user?.email);
    if (!email || !user?.id) {
      return json({ ok: false, code: 'unauthenticated', error: 'Günlük Çark için giriş yapmalısın.' }, 401);
    }

    const todayKey = utcDateKey();
    const nowIso = new Date().toISOString();
    const nextAvailableAt = nextUtcMidnightIso(todayKey);
    const idempotencyKey = buildIdempotencyKey(email, todayKey);
    const existingSpin = await findSpin(base44, email, todayKey, idempotencyKey);
    if (existingSpin) {
      const recovered = await recoverExistingSpin(base44, user, existingSpin, todayKey, idempotencyKey);
      return json(publicResult(recovered, normalizeNumber(recovered.balance_after), true));
    }

    const latestUser = await base44.auth.me().catch(() => user);
    const latestGuardDate = String(latestUser?.daily_wheel_last_spin_date || '');
    if (latestGuardDate === todayKey) {
      const guardSpin = await findSpin(base44, email, todayKey, idempotencyKey);
      if (guardSpin) {
        return json(publicResult(guardSpin, normalizeNumber(latestUser?.diamonds), true));
      }
      const guardTransaction = await findDiamondTransaction(base44, email, idempotencyKey);
      if (guardTransaction) {
        const syntheticSpin = spinRowFromDiamondTransaction(guardTransaction, latestUser, todayKey, nextAvailableAt);
        return json(publicResult(syntheticSpin, normalizeNumber(latestUser?.diamonds), true));
      }
      return json({
        ok: true,
        available: false,
        alreadyClaimedToday: true,
        alreadyClaimed: true,
        serverDate: todayKey,
        nextAvailableAt: latestUser?.daily_wheel_next_available_at || nextAvailableAt,
        updatedDiamondTotal: normalizeNumber(latestUser?.diamonds),
        rewardAmount: 0,
        streakBonusAmount: 0,
        totalRewardAmount: 0,
        userPatch: {
          diamonds: normalizeNumber(latestUser?.diamonds),
          daily_wheel_last_spin_date: todayKey,
          daily_wheel_next_available_at: latestUser?.daily_wheel_next_available_at || nextAvailableAt,
          daily_wheel_streak: normalizeNumber(latestUser?.daily_wheel_streak),
          daily_wheel_spin_count: normalizeNumber(latestUser?.daily_wheel_spin_count),
        },
      });
    }

    const selected = selectReward();
    const { streakBefore, streakAfter } = computeStreak(latestUser, todayKey);
    const streakBonusAmount = streakAfter % 7 === 0 ? STREAK_BONUS_AMOUNT : 0;
    const totalRewardAmount = selected.amount + streakBonusAmount;
    const balanceBefore = normalizeNumber(latestUser?.diamonds);
    const balanceAfter = balanceBefore + totalRewardAmount;
    const spinCountAfter = normalizeNumber(latestUser?.daily_wheel_spin_count) + 1;

    const spinPayload = {
      user_email: email,
      owner_key: ownerKeyFromEmail(email),
      spin_date: todayKey,
      reward_amount: selected.amount,
      streak_before: streakBefore,
      streak_after: streakAfter,
      streak_bonus_amount: streakBonusAmount,
      total_reward_amount: totalRewardAmount,
      balance_before: balanceBefore,
      balance_after: balanceAfter,
      idempotency_key: idempotencyKey,
      claimed_at: nowIso,
      next_available_at: nextAvailableAt,
      build_marker: String(body?.buildMarker || '').slice(0, 40),
      metadata: {
        rewardRarity: selected.rarity,
        spinCountAfter,
        serverDayBoundary: 'UTC',
        source: DAILY_WHEEL_SOURCE,
      },
      description: 'daily_wheel_claim',
    };

    const { row: spin, error: spinLedgerError } = await createDailyWheelSpin(base44, spinPayload);

    const userPatch = {
      diamonds: balanceAfter,
      daily_wheel_last_spin_at: nowIso,
      daily_wheel_last_spin_date: todayKey,
      daily_wheel_next_available_at: nextAvailableAt,
      daily_wheel_streak: streakAfter,
      daily_wheel_spin_count: spinCountAfter,
      economy_updated_at: nowIso,
    };
    await base44.asServiceRole.entities.User.update(latestUser.id || user.id, userPatch);

    let ledgerError = null;
    const transactionMetadata: Record<string, unknown> = {
      dailyWheelSpinId: spin?.id || null,
      serverDate: todayKey,
      rewardAmount: selected.amount,
      streakBefore,
      streakBonusAmount,
      streakAfter,
      noKronoxPuan: true,
    };
    if (spinLedgerError) {
      transactionMetadata.dailyWheelSpinCreateError = spinLedgerError;
    }
    try {
      await createDiamondTransaction(base44, {
        user_email: email,
        amount: totalRewardAmount,
        balance_before: balanceBefore,
        balance_after: balanceAfter,
        source: DAILY_WHEEL_SOURCE,
        direction: 'earn',
        idempotency_key: idempotencyKey,
        metadata: transactionMetadata,
        created_at: nowIso,
        description: 'daily_wheel_claim',
      });
    } catch (error) {
      ledgerError = error?.message || 'daily_wheel_diamond_ledger_failed';
    }

    return json({
      ...publicResult(spin || spinPayload, balanceAfter, false),
      spinLedgerError,
      ledgerError,
    });
  } catch (error) {
    console.error('[claimDailyWheelReward] failed', error);
    return json({
      ok: false,
      code: 'daily_wheel_claim_failed',
      error: 'Günlük Çark ödülü alınamadı. Lütfen tekrar dene.',
    }, 500);
  }
});
