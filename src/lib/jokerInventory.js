import { base44 } from '@/api/base44Client';

export const JOKER_TYPES = Object.freeze({
  MISTAKE_SHIELD: 'mistake_shield',
  CARD_SWAP: 'card_swap',
  TIME_FREEZE: 'time_freeze',
});

export const STARTER_JOKER_QUANTITY = 3;
export const JOKER_STARTER_SOURCE = 'starter_jokers';
export const JOKER_TRANSACTION_REASONS = Object.freeze({
  STARTER_GRANT: 'starter_grant',
  ADMIN_ADJUSTMENT: 'admin_adjustment',
  SOLO_USE: 'solo_use',
  MARKET_PURCHASE: 'market_purchase',
  REFUND: 'refund',
  CORRECTION: 'correction',
});

export const JOKER_DEFINITIONS = Object.freeze([
  { type: JOKER_TYPES.MISTAKE_SHIELD, label: 'Kronokalkan', shortLabel: 'Kalkan' },
  { type: JOKER_TYPES.CARD_SWAP, label: 'Kart Değiştir', shortLabel: 'Değiştir' },
  { type: JOKER_TYPES.TIME_FREEZE, label: 'Zaman Dondur', shortLabel: 'Dondur' },
]);

export const SOLO_UI_JOKER_TYPES = Object.freeze({
  MISTAKE_SHIELD: 'mistakeShield',
  CARD_SWAP: 'swapCard',
  TIME_FREEZE: 'freezeTime',
});

export const SOLO_UI_TO_INVENTORY_JOKER_TYPE = Object.freeze({
  [SOLO_UI_JOKER_TYPES.MISTAKE_SHIELD]: JOKER_TYPES.MISTAKE_SHIELD,
  [SOLO_UI_JOKER_TYPES.CARD_SWAP]: JOKER_TYPES.CARD_SWAP,
  [SOLO_UI_JOKER_TYPES.TIME_FREEZE]: JOKER_TYPES.TIME_FREEZE,
});

export const PHASE2_SOLO_JOKER_CONSUMPTION_CONTRACT = [
  'Solo joker buttons read user-owned balances.',
  'The count badge shows actual owned balance.',
  'One joker may be used per question/card.',
  'Any number of jokers may be used across a level if the user owns them.',
  'A joker spend writes JokerTransaction reason solo_use after the effect is validated.',
  'Used jokers are not refunded on fail/exit.',
].join(' ');

export function normalizeJokerEmail(value) {
  return String(value || '').trim().toLowerCase();
}

export function normalizeJokerQuantity(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.floor(numeric));
}

export function emptyJokerBalances(fill = 0) {
  return JOKER_DEFINITIONS.reduce((acc, joker) => {
    acc[joker.type] = normalizeJokerQuantity(fill);
    return acc;
  }, {});
}

export function buildStarterJokerIdempotencyKey(userEmail, jokerType) {
  const email = normalizeJokerEmail(userEmail);
  if (!email || !isKnownJokerType(jokerType)) return '';
  return `${JOKER_STARTER_SOURCE}:${email}:${jokerType}`;
}

export function isKnownJokerType(jokerType) {
  return JOKER_DEFINITIONS.some((joker) => joker.type === jokerType);
}

export function soloUiJokerTypeToInventoryType(jokerType) {
  const mapped = SOLO_UI_TO_INVENTORY_JOKER_TYPE[jokerType];
  return isKnownJokerType(mapped) ? mapped : '';
}

export function canApplyJokerTransaction(currentQuantity, quantityDelta) {
  const current = normalizeJokerQuantity(currentQuantity);
  const delta = Number(quantityDelta);
  if (!Number.isFinite(delta)) return false;
  return current + Math.trunc(delta) >= 0;
}

export function normalizeJokerBalances(input) {
  const balances = emptyJokerBalances();
  if (Array.isArray(input)) {
    input.forEach((row) => {
      const type = row?.joker_type || row?.jokerType || row?.type;
      if (isKnownJokerType(type)) balances[type] = normalizeJokerQuantity(row?.quantity);
    });
    return balances;
  }
  if (input && typeof input === 'object') {
    JOKER_DEFINITIONS.forEach((joker) => {
      balances[joker.type] = normalizeJokerQuantity(input[joker.type]);
    });
  }
  return balances;
}

function unwrapFunctionResponse(response) {
  if (response?.data?.data && typeof response.data.data === 'object') return response.data.data;
  if (response?.data && typeof response.data === 'object') return response.data;
  if (response && typeof response === 'object') return response;
  return {};
}

async function readOwnInventoryRows(email) {
  if (!email) return [];
  const rows = await base44.entities.UserJokerInventory
    .filter({ user_email: email }, '-updated_at', 20)
    .catch(() => []);
  return Array.isArray(rows) ? rows : [];
}

export async function ensureStarterJokers(user) {
  const email = normalizeJokerEmail(user?.email || user?.user_email);
  if (!email) {
    return {
      ok: false,
      initialized: false,
      reason: 'missing_user_email',
      balances: emptyJokerBalances(),
      items: [],
    };
  }

  const response = await base44.functions.invoke('ensureUserJokerInventory', {});
  const body = unwrapFunctionResponse(response);
  if (body?.ok === false) {
    const error = new Error(body?.error || body?.code || 'joker_inventory_init_failed');
    error.body = body;
    throw error;
  }
  return {
    ok: true,
    ...body,
    balances: normalizeJokerBalances(body?.balances || body?.items),
  };
}

export async function getUserJokerBalances(user, options = {}) {
  const email = normalizeJokerEmail(user?.email || user?.user_email);
  if (!email) {
    return { ok: false, reason: 'missing_user_email', balances: emptyJokerBalances(), items: [] };
  }

  if (options.ensureStarter !== false) {
    return ensureStarterJokers(user);
  }

  const rows = await readOwnInventoryRows(email);
  return {
    ok: true,
    initialized: false,
    balances: normalizeJokerBalances(rows),
    items: rows.map((row) => ({
      id: row.id,
      jokerType: row.joker_type,
      quantity: normalizeJokerQuantity(row.quantity),
      updatedAt: row.updated_at || row.created_at || null,
    })),
  };
}

export function buildSoloJokerUseIdempotencyKey(userEmail, attemptId, questionKey, jokerType) {
  const email = normalizeJokerEmail(userEmail);
  const type = soloUiJokerTypeToInventoryType(jokerType) || jokerType;
  if (!email || !isKnownJokerType(type)) return '';
  const attempt = String(attemptId || 'solo_attempt').trim() || 'solo_attempt';
  const key = String(questionKey || 'question').trim() || 'question';
  return `solo_use:${email}:${attempt}:${key}:${type}`.replace(/[^a-zA-Z0-9_.:@-]/g, '_');
}

export async function spendUserJoker(user, options = {}) {
  const email = normalizeJokerEmail(user?.email || user?.user_email);
  const jokerType = soloUiJokerTypeToInventoryType(options.jokerType) || options.jokerType;
  if (!email) {
    return { ok: false, code: 'missing_user_email', error: 'Joker kullanmak için giriş yapmalısın.', balances: emptyJokerBalances() };
  }
  if (!isKnownJokerType(jokerType)) {
    return { ok: false, code: 'invalid_joker_type', error: 'Joker türü geçersiz.', balances: emptyJokerBalances() };
  }

  const response = await base44.functions.invoke('spendUserJoker', {
    jokerType,
    idempotencyKey: options.idempotencyKey,
    relatedEntityType: options.relatedEntityType,
    relatedEntityId: options.relatedEntityId,
    metadata: options.metadata,
  });
  const body = unwrapFunctionResponse(response);
  return {
    ...body,
    ok: body?.ok !== false,
    jokerType,
    balances: normalizeJokerBalances(body?.balances),
    balanceAfter: normalizeJokerQuantity(body?.balanceAfter ?? body?.inventory?.quantity),
  };
}

export async function applyJokerTransaction(user, jokerType, quantityDelta, reason, options = {}) {
  if (Number(quantityDelta) === -1 && reason === JOKER_TRANSACTION_REASONS.SOLO_USE) {
    return spendUserJoker(user, { ...options, jokerType });
  }
  throw new Error('joker_transaction_server_only_for_non_solo_spends');
}
