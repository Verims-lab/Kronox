import { KRONOX_BUILD_MARKER } from '@/components/dev/BuildMarker';
import { purchaseJokerWithDiamonds as invokePurchaseJokerWithDiamonds } from '@/lib/dbGateway/economyGateway';
import { JOKER_TYPES, emptyJokerBalances, normalizeJokerBalances, normalizeJokerEmail, normalizeJokerQuantity, setCachedJokerBalances } from '@/lib/jokerInventory';

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
export const MARKET_CATALOG_CACHE_STALE_MS = 10 * 60 * 1000;

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

export function getMarketCatalog() {
  return MARKET_JOKER_PRODUCTS;
}

export function getMarketPurchaseReadiness({
  product,
  user,
  authLoading = false,
  diamonds = 0,
  pending = false,
  anyPending = false,
} = {}) {
  if (pending) {
    return { disabled: true, reason: 'purchase_in_flight', label: 'İşleniyor' };
  }
  if (anyPending) {
    return { disabled: true, reason: 'another_purchase_in_flight', label: 'Bekle' };
  }
  if (!product) {
    return { disabled: true, reason: 'missing_item_data', label: 'Hazırlanıyor' };
  }
  if (authLoading) {
    return { disabled: true, reason: 'auth_loading', label: 'Hazırlanıyor' };
  }
  if (!user?.email) {
    return { disabled: false, reason: 'login_required', label: 'Giriş Yap' };
  }
  if (Number(diamonds) < Number(product.price)) {
    return { disabled: true, reason: 'insufficient_diamonds', label: 'Yeterli elmas yok' };
  }
  return { disabled: false, reason: 'ready', label: 'Satın Al' };
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

function unwrapInvokeError(error) {
  if (error?.body && typeof error.body === 'object') return error.body;
  if (error?.response) return unwrapFunctionResponse(error.response);
  if (error?.data) return unwrapFunctionResponse({ data: error.data });
  return {};
}

function safeMarketPurchaseError(errorOrBody, fallback = 'Satın alma tamamlanamadı. Tekrar dene.') {
  const body = errorOrBody?.response || errorOrBody?.body || errorOrBody?.data
    ? unwrapInvokeError(errorOrBody)
    : errorOrBody;
  const code = String(body?.code || '').trim();
  if (code === 'insufficient_diamonds') return 'Yeterli elmas yok.';
  if (code === 'invalid_joker_type') return 'Joker türü geçersiz.';
  if (code === 'invalid_quantity') return 'Satın alma adedi geçersiz.';
  if (code === 'unauthenticated') return 'Mağaza için giriş yapmalısın.';
  if (code === 'duplicate_purchase_in_progress') return 'Bu satın alma zaten işleniyor.';
  return fallback;
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

  let response;
  try {
    response = await invokePurchaseJokerWithDiamonds({
      jokerType,
      quantity,
      idempotencyKey,
      clientRequestId,
      buildMarker: KRONOX_BUILD_MARKER,
    });
  } catch (error) {
    const body = unwrapInvokeError(error);
    return {
      ok: false,
      code: body?.code || 'market_purchase_request_failed',
      error: safeMarketPurchaseError(error),
      jokerType,
      quantity,
      product,
      clientRequestId,
      idempotencyKey,
      diamondCost: product.price * quantity,
      diamondBalanceAfter: 0,
      jokerBalanceAfter: 0,
      balances: normalizeJokerBalances(body?.balances),
    };
  }
  const body = unwrapFunctionResponse(response);
  if (body?.ok === false) {
    return {
      ...body,
      ok: false,
      error: safeMarketPurchaseError(body),
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
  const balances = normalizeJokerBalances(body?.balances);
  setCachedJokerBalances(email, balances, {
    queryPath: 'purchaseJokerWithDiamonds.mutation_result',
    invalidatedBy: 'market_purchase',
  });
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
    balances,
  };
}
