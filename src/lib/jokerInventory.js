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

export const PHASE2_SOLO_JOKER_CONSUMPTION_TODO = [
  'Solo joker buttons should read user-owned balances.',
  'The number currently shown as 1 should later show actual balance.',
  'One joker may be used per question/card.',
  'Any number of jokers may be used across a level if the user owns them.',
  'A joker is consumed only after its effect is successfully applied.',
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

export async function applyJokerTransaction() {
  throw new Error('joker_transaction_server_only_phase_1');
}
