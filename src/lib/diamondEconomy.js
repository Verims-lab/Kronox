import { base44 } from '@/api/base44Client';

// Codex564 — Starter/daily login Diamond grants are BACKEND-ONLY.
// The client never creates DiamondTransaction rows and never mutates the
// Diamond balance for starter_bonus / daily_login. It only invokes the
// server-side claimLoginBonuses function (EconomyOperationLock +
// idempotency_key find-before-create + confirm-after-write) and merges the
// sanitized userPatch into local state. A read-only local guard pre-check
// skips the backend call when both grants are already settled.

export const DIAMOND_BALANCE_FIELD = 'diamonds';
export const DIAMOND_STARTER_BONUS_AMOUNT = 100;
export const DIAMOND_DAILY_LOGIN_AMOUNT = 20;
export const DIAMOND_DAILY_WHEEL_STREAK_BONUS_AMOUNT = 150;
export const DIAMOND_DAY_BOUNDARY = 'UTC';
export const DIAMOND_STARTER_BONUS_IDEMPOTENCY_PREFIX = 'starter_bonus:';
export const DIAMOND_DAILY_LOGIN_IDEMPOTENCY_PREFIX = 'daily_login:';
export const DIAMOND_DAILY_WHEEL_IDEMPOTENCY_PREFIX = 'daily_wheel:';

export const DIAMOND_REWARD_SOURCES = Object.freeze({
  STARTER_BONUS: 'starter_bonus',
  FIRST_LOGIN_REWARD: 'first_login_reward',
  DAILY_LOGIN: 'daily_login',
  DAILY_WHEEL: 'daily_wheel',
  MARKET_PURCHASE: 'market_purchase',
  DAILY_CALENDAR_STREAK_REWARD: 'daily_calendar_streak_reward',
  DAILY_QUEST_REWARD: 'daily_quest_reward',
  DAILY_QUEST_FUTURE: 'daily_quest_future',
  WHEEL_SPIN_FUTURE: 'wheel_spin_future',
  REWARDED_AD_FUTURE: 'rewarded_ad_future',
  QUEST_REWARD_FUTURE: 'quest_reward_future',
  PURCHASE_FUTURE: 'purchase_future',
  ACHIEVEMENT_FUTURE: 'achievement_future',
  SPECIAL_EVENT_FUTURE: 'special_event_future',
  ADMIN_ADJUSTMENT: 'admin_adjustment',
});
export const DIAMOND_MARKET_PURCHASE_RELATED_ENTITY_TYPE = 'joker_purchase';

export function normalizeEconomyEmail(email) {
  return String(email || '').trim().toLowerCase();
}

export function normalizeDiamondBalance(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.floor(numeric));
}

export function getDiamondBalance(user) {
  return normalizeDiamondBalance(user?.[DIAMOND_BALANCE_FIELD]);
}

export function getDiamondDailyKey(now = new Date()) {
  const date = now instanceof Date ? now : new Date(now);
  if (Number.isNaN(date.getTime())) return new Date().toISOString().slice(0, 10);
  return date.toISOString().slice(0, 10);
}

export function buildDiamondIdempotencyKey(userEmail, source, dateKey = '') {
  const email = normalizeEconomyEmail(userEmail);
  if (!email || !source) return '';
  if (source === DIAMOND_REWARD_SOURCES.STARTER_BONUS) {
    return `${DIAMOND_STARTER_BONUS_IDEMPOTENCY_PREFIX}${email}`;
  }
  if (source === DIAMOND_REWARD_SOURCES.DAILY_LOGIN) {
    return dateKey ? `${DIAMOND_DAILY_LOGIN_IDEMPOTENCY_PREFIX}${email}:${dateKey}` : '';
  }
  if (source === DIAMOND_REWARD_SOURCES.DAILY_WHEEL) {
    return dateKey ? `${DIAMOND_DAILY_WHEEL_IDEMPOTENCY_PREFIX}${email}:${dateKey}` : '';
  }
  return dateKey ? `${source}:${email}:${dateKey}` : `${source}:${email}`;
}

// Read-only persisted guard check. Used ONLY to skip a redundant backend
// call; the authoritative decision is always made server-side inside
// claimLoginBonuses under the economy lock.
export function hasPersistedGrantGuard(user, source, dateKey) {
  if (source === DIAMOND_REWARD_SOURCES.STARTER_BONUS) {
    return Boolean(user?.starter_bonus_granted_at);
  }
  if (source === DIAMOND_REWARD_SOURCES.DAILY_LOGIN) {
    return String(user?.last_daily_diamond_reward_date || '') === dateKey;
  }
  return false;
}

function alreadyRecordedGrant(source, amount) {
  return {
    ok: true,
    granted: false,
    alreadyGranted: true,
    reason: 'already_recorded',
    source,
    amount,
  };
}

async function claimLoginBonusesViaBackend() {
  const res = await base44.functions.invoke('claimLoginBonuses', {});
  return res?.data || null;
}

export async function ensureDiamondEconomyForUser(user, options = {}) {
  const email = normalizeEconomyEmail(user?.email || user?.user_email);
  if (!email) {
    return { ok: false, user, grants: [], totalGranted: 0, reason: 'missing_user_email' };
  }

  const dateKey = getDiamondDailyKey(options.now || new Date());
  const starterSettled = hasPersistedGrantGuard(user, DIAMOND_REWARD_SOURCES.STARTER_BONUS, dateKey);
  const dailySettled = hasPersistedGrantGuard(user, DIAMOND_REWARD_SOURCES.DAILY_LOGIN, dateKey);
  if (starterSettled && dailySettled) {
    return {
      ok: true,
      user,
      grants: [
        alreadyRecordedGrant(DIAMOND_REWARD_SOURCES.STARTER_BONUS, DIAMOND_STARTER_BONUS_AMOUNT),
        alreadyRecordedGrant(DIAMOND_REWARD_SOURCES.DAILY_LOGIN, DIAMOND_DAILY_LOGIN_AMOUNT),
      ],
      totalGranted: 0,
      firstDayTotalCanBe120: DIAMOND_STARTER_BONUS_AMOUNT + DIAMOND_DAILY_LOGIN_AMOUNT === 120,
    };
  }

  let data = null;
  try {
    data = await claimLoginBonusesViaBackend();
  } catch (error) {
    return { ok: false, user, grants: [], totalGranted: 0, reason: error?.message || 'login_bonus_backend_unavailable' };
  }
  if (!data?.ok) {
    return { ok: false, user, grants: [], totalGranted: 0, reason: data?.code || 'login_bonus_backend_rejected' };
  }

  const mergedUser = data.userPatch && typeof data.userPatch === 'object'
    ? { ...user, ...data.userPatch }
    : user;
  return {
    ok: true,
    user: mergedUser,
    grants: Array.isArray(data.grants) ? data.grants : [],
    totalGranted: normalizeDiamondBalance(data.totalGranted),
    firstDayTotalCanBe120: DIAMOND_STARTER_BONUS_AMOUNT + DIAMOND_DAILY_LOGIN_AMOUNT === 120,
  };
}

function pickGrantResult(result, source, amount) {
  const grant = Array.isArray(result?.grants)
    ? result.grants.find((entry) => entry?.source === source)
    : null;
  if (grant) return { ...grant, ok: result?.ok !== false, user: result?.user };
  return {
    ...alreadyRecordedGrant(source, amount),
    ok: result?.ok !== false,
    reason: result?.ok === false ? (result?.reason || 'login_bonus_backend_unavailable') : 'already_recorded',
    user: result?.user,
  };
}

export async function grantStarterBonusIfNeeded(user, options = {}) {
  const result = await ensureDiamondEconomyForUser(user, options);
  return pickGrantResult(result, DIAMOND_REWARD_SOURCES.STARTER_BONUS, DIAMOND_STARTER_BONUS_AMOUNT);
}

export async function grantDailyLoginRewardIfNeeded(user, options = {}) {
  const result = await ensureDiamondEconomyForUser(user, options);
  return pickGrantResult(result, DIAMOND_REWARD_SOURCES.DAILY_LOGIN, DIAMOND_DAILY_LOGIN_AMOUNT);
}

// Legacy generic granter — retained for import compatibility only.
// starter_bonus / daily_login route to the backend claim; every other Diamond
// source is server-side only and must never be granted from client code.
export async function grantDiamondsOnce({ user, source } = {}) {
  if (source === DIAMOND_REWARD_SOURCES.STARTER_BONUS) return grantStarterBonusIfNeeded(user);
  if (source === DIAMOND_REWARD_SOURCES.DAILY_LOGIN) return grantDailyLoginRewardIfNeeded(user);
  return { ok: false, granted: false, alreadyGranted: false, reason: 'server_side_source_only', user };
}