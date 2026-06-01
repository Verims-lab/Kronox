import { base44 } from '@/api/base44Client';

export const DIAMOND_BALANCE_FIELD = 'diamonds';
export const DIAMOND_STARTER_BONUS_AMOUNT = 100;
export const DIAMOND_DAILY_LOGIN_AMOUNT = 20;
export const DIAMOND_DAY_BOUNDARY = 'UTC';
export const DIAMOND_STARTER_BONUS_IDEMPOTENCY_PREFIX = 'starter_bonus:';
export const DIAMOND_DAILY_LOGIN_IDEMPOTENCY_PREFIX = 'daily_login:';

export const DIAMOND_REWARD_SOURCES = Object.freeze({
  STARTER_BONUS: 'starter_bonus',
  DAILY_LOGIN: 'daily_login',
  WHEEL_SPIN_FUTURE: 'wheel_spin_future',
  REWARDED_AD_FUTURE: 'rewarded_ad_future',
  QUEST_REWARD_FUTURE: 'quest_reward_future',
  PURCHASE_FUTURE: 'purchase_future',
  ACHIEVEMENT_FUTURE: 'achievement_future',
  SPECIAL_EVENT_FUTURE: 'special_event_future',
  ADMIN_ADJUSTMENT: 'admin_adjustment',
});

const EARN_DIRECTION = 'earn';

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
  return dateKey ? `${source}:${email}:${dateKey}` : `${source}:${email}`;
}

function safeNowIso(now = new Date()) {
  const date = now instanceof Date ? now : new Date(now);
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

function getSourceGuardPatch(source, nowIso, dateKey) {
  if (source === DIAMOND_REWARD_SOURCES.STARTER_BONUS) {
    return { starter_bonus_granted_at: nowIso };
  }
  if (source === DIAMOND_REWARD_SOURCES.DAILY_LOGIN) {
    return { last_daily_diamond_reward_date: dateKey };
  }
  return {};
}

function hasPersistedGrantGuard(user, source, dateKey) {
  if (source === DIAMOND_REWARD_SOURCES.STARTER_BONUS) {
    return Boolean(user?.starter_bonus_granted_at);
  }
  if (source === DIAMOND_REWARD_SOURCES.DAILY_LOGIN) {
    return String(user?.last_daily_diamond_reward_date || '') === dateKey;
  }
  return false;
}

async function findDiamondTransaction(userEmail, idempotencyKey) {
  const email = normalizeEconomyEmail(userEmail);
  if (!email || !idempotencyKey) return null;
  const rows = await base44.entities.DiamondTransaction
    .filter({ user_email: email, idempotency_key: idempotencyKey }, '-created_at', 1)
    .catch(() => []);
  return Array.isArray(rows) && rows.length ? rows[0] : null;
}

async function createDiamondTransaction(row) {
  return base44.entities.DiamondTransaction.create(row);
}

export async function grantDiamondsOnce({
  user,
  amount,
  source,
  idempotencyKey,
  metadata = {},
  now = new Date(),
}) {
  const email = normalizeEconomyEmail(user?.email || user?.user_email);
  const normalizedAmount = Math.max(0, Math.floor(Number(amount) || 0));
  const dateKey = getDiamondDailyKey(now);
  const nowIso = safeNowIso(now);

  if (!email || !normalizedAmount || !source || !idempotencyKey) {
    return { ok: false, granted: false, reason: 'invalid_reward_request', user };
  }

  if (hasPersistedGrantGuard(user, source, dateKey)) {
    return { ok: true, granted: false, alreadyGranted: true, reason: 'already_recorded', user };
  }

  const existing = await findDiamondTransaction(email, idempotencyKey);
  if (existing) {
    return { ok: true, granted: false, alreadyGranted: true, reason: 'already_recorded', transaction: existing, user };
  }

  const latestUser = await base44.auth.me().catch(() => user);
  const sourceUser = latestUser || user;

  if (hasPersistedGrantGuard(sourceUser, source, dateKey)) {
    return { ok: true, granted: false, alreadyGranted: true, reason: 'already_recorded', user: sourceUser };
  }

  const existingAfterRefresh = await findDiamondTransaction(email, idempotencyKey);
  if (existingAfterRefresh) {
    return {
      ok: true,
      granted: false,
      alreadyGranted: true,
      reason: 'already_recorded',
      transaction: existingAfterRefresh,
      user: sourceUser,
    };
  }

  const balanceBefore = getDiamondBalance(sourceUser);
  const balanceAfter = balanceBefore + normalizedAmount;
  const guardPatch = getSourceGuardPatch(source, nowIso, dateKey);

  await base44.auth.updateMe({
    [DIAMOND_BALANCE_FIELD]: balanceAfter,
    economy_updated_at: nowIso,
    ...guardPatch,
  });

  const refreshedUser = await base44.auth.me().catch(() => ({
    ...sourceUser,
    [DIAMOND_BALANCE_FIELD]: balanceAfter,
    economy_updated_at: nowIso,
    ...guardPatch,
  }));

  const transactionPayload = {
    user_email: email,
    amount: normalizedAmount,
    balance_before: balanceBefore,
    balance_after: balanceAfter,
    source,
    direction: EARN_DIRECTION,
    idempotency_key: idempotencyKey,
    metadata: {
      ...metadata,
      dayBoundary: DIAMOND_DAY_BOUNDARY,
      dateKey: source === DIAMOND_REWARD_SOURCES.DAILY_LOGIN ? dateKey : undefined,
    },
    created_at: nowIso,
  };

  let transaction = null;
  let ledgerError = null;
  try {
    transaction = await createDiamondTransaction(transactionPayload);
  } catch (error) {
    ledgerError = error?.message || 'diamond_transaction_create_failed';
  }

  return {
    ok: !ledgerError,
    granted: true,
    alreadyGranted: false,
    amount: normalizedAmount,
    source,
    idempotencyKey,
    balanceBefore,
    balanceAfter,
    user: refreshedUser,
    transaction,
    ledgerError,
  };
}

export async function grantStarterBonusIfNeeded(user, options = {}) {
  const email = normalizeEconomyEmail(user?.email || user?.user_email);
  const idempotencyKey = buildDiamondIdempotencyKey(email, DIAMOND_REWARD_SOURCES.STARTER_BONUS);
  return grantDiamondsOnce({
    user,
    amount: DIAMOND_STARTER_BONUS_AMOUNT,
    source: DIAMOND_REWARD_SOURCES.STARTER_BONUS,
    idempotencyKey,
    metadata: { reward: 'Kronox starter diamond bonus' },
    now: options.now || new Date(),
  });
}

export async function grantDailyLoginRewardIfNeeded(user, options = {}) {
  const now = options.now || new Date();
  const email = normalizeEconomyEmail(user?.email || user?.user_email);
  const dateKey = getDiamondDailyKey(now);
  const idempotencyKey = buildDiamondIdempotencyKey(email, DIAMOND_REWARD_SOURCES.DAILY_LOGIN, dateKey);
  return grantDiamondsOnce({
    user,
    amount: DIAMOND_DAILY_LOGIN_AMOUNT,
    source: DIAMOND_REWARD_SOURCES.DAILY_LOGIN,
    idempotencyKey,
    metadata: { reward: 'Kronox daily login diamond reward', dateKey },
    now,
  });
}

export async function ensureDiamondEconomyForUser(user, options = {}) {
  if (!user?.email && !user?.user_email) {
    return { ok: false, user, grants: [], totalGranted: 0, reason: 'missing_user_email' };
  }

  const now = options.now || new Date();
  const grants = [];
  let currentUser = user;

  const starter = await grantStarterBonusIfNeeded(currentUser, { now });
  grants.push(starter);
  if (starter?.user) currentUser = starter.user;

  const daily = await grantDailyLoginRewardIfNeeded(currentUser, { now });
  grants.push(daily);
  if (daily?.user) currentUser = daily.user;

  const totalGranted = grants.reduce((sum, grant) => sum + (grant?.granted ? Number(grant.amount) || 0 : 0), 0);

  return {
    ok: grants.every((grant) => grant?.ok !== false),
    user: currentUser,
    grants,
    totalGranted,
    firstDayTotalCanBe120: DIAMOND_STARTER_BONUS_AMOUNT + DIAMOND_DAILY_LOGIN_AMOUNT === 120,
  };
}
