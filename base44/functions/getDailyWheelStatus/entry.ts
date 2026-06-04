import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

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
  return new Date(start + 24 * 60 * 60 * 1000).toISOString();
}

function previousUtcDateKey(dateKey: string) {
  const start = Date.parse(`${dateKey}T00:00:00.000Z`);
  return new Date(start - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function buildIdempotencyKey(email: string, dateKey: string) {
  return `daily_wheel:${email}:${dateKey}`;
}

function currentAvailableStreak(user: any, todayKey: string) {
  const lastDate = String(user?.daily_wheel_last_spin_date || '');
  const stored = normalizeNumber(user?.daily_wheel_streak);
  return lastDate && lastDate === previousUtcDateKey(todayKey) ? stored : 0;
}

async function findTodaySpin(base44: any, email: string, dateKey: string, idempotencyKey: string) {
  const entity = base44.asServiceRole.entities.DailyWheelSpin;
  if (!entity?.filter) return null;
  const [byKey, byDate] = await Promise.all([
    entity.filter({ user_email: email, idempotency_key: idempotencyKey }, '-claimed_at', 1).catch(() => []),
    entity.filter({ user_email: email, spin_date: dateKey }, '-claimed_at', 1).catch(() => []),
  ]);
  const rows = [...(Array.isArray(byKey) ? byKey : []), ...(Array.isArray(byDate) ? byDate : [])];
  return rows.find((row: any) => row?.id) || null;
}

function publicSpinResult(row: any) {
  if (!row) return null;
  return {
    rewardAmount: normalizeNumber(row.reward_amount),
    streakBefore: normalizeNumber(row.streak_before),
    streakAfter: normalizeNumber(row.streak_after),
    streakBonusAmount: normalizeNumber(row.streak_bonus_amount),
    totalRewardAmount: normalizeNumber(row.total_reward_amount),
    claimedAt: row.claimed_at || null,
    nextAvailableAt: row.next_available_at || null,
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
      return json({ ok: false, code: 'unauthenticated', error: 'Günlük Çark için giriş yapmalısın.' }, 401);
    }

    const email = normalizeEmail(user?.email);
    if (!email) {
      return json({ ok: false, code: 'unauthenticated', error: 'Günlük Çark için giriş yapmalısın.' }, 401);
    }

    const todayKey = utcDateKey();
    const nextAvailableAt = nextUtcMidnightIso(todayKey);
    const idempotencyKey = buildIdempotencyKey(email, todayKey);
    const todaySpin = await findTodaySpin(base44, email, todayKey, idempotencyKey);
    const userGuardClaimed = String(user?.daily_wheel_last_spin_date || '') === todayKey;
    const alreadyClaimedToday = Boolean(todaySpin || userGuardClaimed);
    const lastReward = todaySpin ? publicSpinResult(todaySpin) : null;

    return json({
      ok: true,
      available: !alreadyClaimedToday,
      alreadyClaimedToday,
      serverDate: todayKey,
      nextAvailableAt: todaySpin?.next_available_at || user?.daily_wheel_next_available_at || nextAvailableAt,
      currentStreak: alreadyClaimedToday
        ? normalizeNumber(todaySpin?.streak_after ?? user?.daily_wheel_streak)
        : currentAvailableStreak(user, todayKey),
      lastReward,
      diamondTotal: normalizeNumber(user?.diamonds),
    });
  } catch (error) {
    console.error('[getDailyWheelStatus] failed', error);
    return json({
      ok: false,
      code: 'daily_wheel_status_failed',
      error: 'Günlük Çark durumu alınamadı. Lütfen tekrar dene.',
    }, 500);
  }
});
