import { KRONOX_BUILD_MARKER } from '@/components/dev/BuildMarker';
import { purchaseJokerWithDiamonds as invokePurchaseJokerWithDiamonds } from '@/lib/dbGateway/economyGateway';
import { JOKER_TYPES, emptyJokerBalances, normalizeJokerBalances, normalizeJokerEmail, normalizeJokerQuantity } from '@/lib/jokerInventory';

export const MARKET_PHASE_1 = 'market_phase_1';
export const MARKET_PURCHASE_REASON = 'market_purchase';
export const MARKET_PURCHASE_RELATED_ENTITY_TYPE = 'joker_purchase';
export const MARKET_PHASE_1_FORBIDDEN_PRODUCT_TYPES = Object.freeze([
  'bundles',
  'subscriptions',
  'cosmetics',
  'random_boxes',
  'ads',
  'external_payments',
]);

export const MARKET_JOKER_PRODUCTS = Object.freeze([
  {
    jokerType: JOKER_TYPES.TIME_FREEZE,
    name: 'Zaman Dondur',
    description: 'Süreyi kısa süreliğine durdurur.',
    price: 40,
    accent: '#38bdf8',
  },
  {
    jokerType: JOKER_TYPES.CARD_SWAP,
    name: 'Kart Değiştir',
    description: 'Mevcut kartı yeni bir kartla değiştirir.',
    price: 50,
    accent: '#facc15',
  },
  {
    jokerType: JOKER_TYPES.MISTAKE_SHIELD,
    name: 'Kronokalkan',
    description: 'Bir hata riskine karşı koruma sağlar.',
    price: 60,
    accent: '#a78bfa',
  },
]);

const PRODUCT_BY_TYPE = Object.freeze(
  MARKET_JOKER_PRODUCTS.reduce((acc, product) => {
    acc[product.jokerType] = product;
    return acc;
  }, {}),
);

export function getMarketJokerProduct(jokerType) {
  return PRODUCT_BY_TYPE[jokerType] || null;
}

export function createMarketClientRequestId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export function buildJokerPurchaseIdempotencyKey(userEmail, jokerType, clientRequestId) {
  const email = normalizeJokerEmail(userEmail);
  const product = getMarketJokerProduct(jokerType);
  const requestId = String(clientRequestId || '').trim();
  if (!email || !product || !requestId) return '';
  return `joker_purchase:${email}:${jokerType}:${requestId}`.replace(/[^a-zA-Z0-9_.:@-]/g, '_');
}

function unwrapFunctionResponse(response) {
  if (response?.data?.data && typeof response.data.data === 'object') return response.data.data;
  if (response?.data && typeof response.data === 'object') return response.data;
  if (response && typeof response === 'object') return response;
  return {};
}

export async function purchaseMarketJoker(user, options = {}) {
  const email = normalizeJokerEmail(user?.email || user?.user_email);
  const jokerType = options.jokerType;
  const product = getMarketJokerProduct(jokerType);
  const quantity = Math.max(1, Math.floor(Number(options.quantity) || 1));
  const clientRequestId = options.clientRequestId || createMarketClientRequestId();
  const idempotencyKey = buildJokerPurchaseIdempotencyKey(email, jokerType, clientRequestId);

  if (!email) {
    return { ok: false, code: 'unauthenticated', error: 'Mağaza için giriş yapmalısın.', balances: emptyJokerBalances() };
  }
  if (!product || !idempotencyKey) {
    return { ok: false, code: 'invalid_joker_type', error: 'Joker türü geçersiz.', balances: emptyJokerBalances() };
  }

  const response = await invokePurchaseJokerWithDiamonds({
    jokerType,
    quantity,
    idempotencyKey,
    clientRequestId,
    buildMarker: KRONOX_BUILD_MARKER,
  });
  const body = unwrapFunctionResponse(response);
  return {
    ...body,
    ok: body?.ok === true,
    jokerType,
    quantity,
    product,
    clientRequestId,
    idempotencyKey,
    diamondCost: normalizeJokerQuantity(body?.diamondCost ?? product.price * quantity),
    diamondBalanceAfter: normalizeJokerQuantity(body?.diamondBalanceAfter),
    jokerBalanceAfter: normalizeJokerQuantity(body?.jokerBalanceAfter ?? body?.inventory?.quantity),
    balances: normalizeJokerBalances(body?.balances),
  };
}
