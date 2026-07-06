import { base44 } from '@/api/base44Client';

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
  if (source === DIAMOND_REWARD_SOURCES.DAILY_WHEEL) {
    return dateKey ? `${DIAMOND_DAILY_WHEEL_IDEMPOTENCY_PREFIX}${email}:${dateKey}` : '';
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
  const email = normalizeEconomyEmail(row?.user_email);
  const idempotencyKey = String(row?.idempotency_key || '').trim();
  if (!email || !idempotencyKey) return null;
  const existing = await findDiamondTransaction(email, idempotencyKey);
  if (existing) return existing;
  const created = await base44.entities.DiamondTransaction.create({
    ...row,
    user_email: email,
    idempotency_key: idempotencyKey,
  });
  const confirmed = await findDiamondTransaction(email, idempotencyKey);
  return confirmed || created;
}

function buildRecoveryTransactionPayload({ user, amount, source, idempotencyKey, metadata, nowIso, dateKey }) {
  const balanceAfter = getDiamondBalance(user);
  const normalizedAmount = Math.max(0, Math.floor(Number(amount) || 0));
  return {
    user_email: normalizeEconomyEmail(user?.email || user?.user_email),
    amount: normalizedAmount,
    balance_before: Math.max(0, balanceAfter - normalizedAmount),
    balance_after: balanceAfter,
    source,
    direction: EARN_DIRECTION,
    idempotency_key: idempotencyKey,
    metadata: {
      ...metadata,
      recoveredFromPersistedGuard: true,
      dayBoundary: DIAMOND_DAY_BOUNDARY,
      dateKey: source === DIAMOND_REWARD_SOURCES.DAILY_LOGIN ? dateKey : undefined,
    },
    created_at: nowIso,
  };
}

async function recoverMissingDiamondTransaction({ user, amount, source, idempotencyKey, metadata, nowIso, dateKey }) {
  try {
    const payload = buildRecoveryTransactionPayload({ user, amount, source, idempotencyKey, metadata, nowIso, dateKey });
    if (!payload.user_email || !payload.idempotency_key) return null;
    return await createDiamondTransaction(payload);
  } catch (error) {
    return { recoveryError: error?.message || 'diamond_transaction_recovery_failed' };
  }
}

async function recoverUserGuardFromTransaction({ user, source, transaction, nowIso, dateKey }) {
  if (!transaction) return null;
  try {
    const guardPatch = getSourceGuardPatch(source, nowIso, dateKey);
    if (!Object.keys(guardPatch).length) return null;
    const nextBalance = Math.max(getDiamondBalance(user), normalizeDiamondBalance(transaction.balance_after));
    await base44.auth.updateMe({
      [DIAMOND_BALANCE_FIELD]: nextBalance,
      economy_updated_at: nowIso,
      ...guardPatch,
    });
    return await base44.auth.me().catch(() => ({
      ...user,
      [DIAMOND_BALANCE_FIELD]: nextBalance,
      economy_updated_at: nowIso,
      ...guardPatch,
    }));
  } catch (error) {
    return { recoveryError: error?.message || 'diamond_guard_recovery_failed' };
  }
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

  const existing = await findDiamondTransaction(email, idempotencyKey);
  if (existing) {
    const recoveredUser = hasPersistedGrantGuard(user, source, dateKey)
      ? user
      : await recoverUserGuardFromTransaction({ user, source, transaction: existing, nowIso, dateKey });
    return {
      ok: !recoveredUser?.recoveryError,
      granted: false,
      alreadyGranted: true,
      reason: 'already_recorded',
      transaction: existing,
      user: recoveredUser?.recoveryError ? user : (recoveredUser || user),
      recovery: recoveredUser?.recoveryError ? recoveredUser : { guardRecoveredFromTransaction: !hasPersistedGrantGuard(user, source, dateKey) },
    };
  }

  if (hasPersistedGrantGuard(user, source, dateKey)) {
    const recoveredTransaction = await recoverMissingDiamondTransaction({
      user,
      amount: normalizedAmount,
      source,
      idempotencyKey,
      metadata,
      nowIso,
      dateKey,
    });
    return {
      ok: !recoveredTransaction?.recoveryError,
      granted: false,
      alreadyGranted: true,
      reason: 'already_recorded',
      transaction: recoveredTransaction?.recoveryError ? null : recoveredTransaction,
      user,
      recovery: recoveredTransaction?.recoveryError
        ? recoveredTransaction
        : { ledgerRecoveredFromGuard: Boolean(recoveredTransaction) },
    };
  }

  const latestUser = await base44.auth.me().catch(() => user);
  const sourceUser = latestUser || user;

  if (hasPersistedGrantGuard(sourceUser, source, dateKey)) {
    const recoveredTransaction = await recoverMissingDiamondTransaction({
      user: sourceUser,
      amount: normalizedAmount,
      source,
      idempotencyKey,
      metadata,
      nowIso,
      dateKey,
    });
    return {
      ok: !recoveredTransaction?.recoveryError,
      granted: false,
      alreadyGranted: true,
      reason: 'already_recorded',
      transaction: recoveredTransaction?.recoveryError ? null : recoveredTransaction,
      user: sourceUser,
      recovery: recoveredTransaction?.recoveryError
        ? recoveredTransaction
        : { ledgerRecoveredFromGuard: Boolean(recoveredTransaction) },
    };
  }

  const existingAfterRefresh = await findDiamondTransaction(email, idempotencyKey);
  if (existingAfterRefresh) {
    const recoveredUser = hasPersistedGrantGuard(sourceUser, source, dateKey)
      ? sourceUser
      : await recoverUserGuardFromTransaction({ user: sourceUser, source, transaction: existingAfterRefresh, nowIso, dateKey });
    return {
      ok: !recoveredUser?.recoveryError,
      granted: false,
      alreadyGranted: true,
      reason: 'already_recorded',
      transaction: existingAfterRefresh,
      user: recoveredUser?.recoveryError ? sourceUser : (recoveredUser || sourceUser),
      recovery: recoveredUser?.recoveryError ? recoveredUser : { guardRecoveredFromTransaction: !hasPersistedGrantGuard(sourceUser, source, dateKey) },
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
