import { KRONOX_BUILD_MARKER } from '@/components/dev/BuildMarker';
import { purchaseMarketProductWithDiamonds as invokePurchaseMarketProductWithDiamonds } from '@/lib/dbGateway/economyGateway';
import {
  JOKER_TYPES,
  emptyJokerBalances,
  normalizeJokerBalances,
  normalizeJokerEmail,
  normalizeJokerQuantity,
  setCachedJokerBalances,
} from '@/lib/jokerInventory';

export const MARKET_PHASE_1 = 'market_phase_1';
export const MARKET_CATALOG_PHASE = 'market_catalog_phase_2';
export const MARKET_PURCHASE_REASON = 'market_purchase';
export const MARKET_PURCHASE_RELATED_ENTITY_TYPE = 'market_purchase';
export const MARKET_CATALOG_CACHE_STALE_MS = 10 * 60 * 1000;
export const MARKET_REAL_MONEY_IAP_AVAILABLE = false;

export const MARKET_PRICE_TYPES = Object.freeze({
  REAL_MONEY: 'real_money',
  DIAMONDS: 'diamonds',
  FUTURE_REAL_MONEY: 'future_real_money',
});

export const MARKET_PRODUCT_TYPES = Object.freeze({
  DIAMOND_PACK: 'diamond_pack',
  JOKER: 'joker',
  HINT: 'hint',
  ADVANTAGE: 'advantage',
  KRONO_CLUB: 'krono_club',
  REMOVE_ADS: 'remove_ads',
});

export const MARKET_PHASE_1_FORBIDDEN_PRODUCT_TYPES = Object.freeze([
  'cosmetics',
  'random_boxes',
  'client_granted_diamonds',
  'client_granted_inventory',
  'leaderboard_boosts',
  'kronox_puan',
]);

export const MARKET_SECTION_DEFINITIONS = Object.freeze([
  {
    id: 'diamonds',
    title: 'Elmas Satın Al',
    eyebrow: 'Gerçek para paketleri',
    description: 'Elmas paketleri hazır; onaylı ödeme akışı gelene kadar ödül vermez.',
  },
  {
    id: 'jokers',
    title: 'Jokerler',
    eyebrow: 'Elmas ile güçlen',
    description: 'Solo joker paketleri sunucu tarafında elmas harcar.',
  },
  {
    id: 'hints',
    title: 'İpuçları',
    eyebrow: 'Elmas ile ipucu',
    description: 'İpucu bakiyesi sunucuda tutulur; Solo ipucu kullanımı ayrı sunucu tüketimiyle çalışır.',
  },
  {
    id: 'advantages',
    title: 'Avantaj Paketleri',
    eyebrow: 'Karma paketler',
    description: 'Joker ve ipuçlarını tek güvenli market işlemiyle verir.',
  },
  {
    id: 'future',
    title: 'Yakında',
    eyebrow: 'Gelecek özellikler',
    description: 'KronoClub ve Reklamları Kaldır satın alma/avantaj vermez.',
  },
]);

export const MARKET_DIAMOND_PACKAGES = Object.freeze([
  {
    id: 'diamonds_360',
    section: 'diamonds',
    type: MARKET_PRODUCT_TYPES.DIAMOND_PACK,
    priceType: MARKET_PRICE_TYPES.REAL_MONEY,
    title: '360 ELMAS',
    description: 'Birim Fiyat: ₺0,22',
    amount: 360,
    displayPrice: '₺79,99',
    unitPrice: '₺0,22',
    assetKind: 'diamond_pile',
    available: false,
  },
  {
    id: 'diamonds_1100',
    section: 'diamonds',
    type: MARKET_PRODUCT_TYPES.DIAMOND_PACK,
    priceType: MARKET_PRICE_TYPES.REAL_MONEY,
    title: '1.100 ELMAS',
    description: 'Birim Fiyat: ₺0,18',
    amount: 1100,
    displayPrice: '₺199,99',
    unitPrice: '₺0,18',
    badge: 'EN POPÜLER',
    assetKind: 'diamond_bag',
    available: false,
  },
  {
    id: 'diamonds_2400',
    section: 'diamonds',
    type: MARKET_PRODUCT_TYPES.DIAMOND_PACK,
    priceType: MARKET_PRICE_TYPES.REAL_MONEY,
    title: '2.400 ELMAS',
    description: 'Birim Fiyat: ₺0,15',
    amount: 2400,
    displayPrice: '₺349,99',
    unitPrice: '₺0,15',
    assetKind: 'diamond_chest',
    available: false,
  },
  {
    id: 'diamonds_6200',
    section: 'diamonds',
    type: MARKET_PRODUCT_TYPES.DIAMOND_PACK,
    priceType: MARKET_PRICE_TYPES.REAL_MONEY,
    title: '6.200 ELMAS',
    description: 'Birim Fiyat: ₺0,13',
    amount: 6200,
    displayPrice: '₺799,99',
    unitPrice: '₺0,13',
    assetKind: 'diamond_chest_large',
    available: false,
  },
  {
    id: 'diamonds_13000',
    section: 'diamonds',
    type: MARKET_PRODUCT_TYPES.DIAMOND_PACK,
    priceType: MARKET_PRICE_TYPES.REAL_MONEY,
    title: '13.000 ELMAS',
    description: 'Birim Fiyat: ₺0,12',
    amount: 13000,
    displayPrice: '₺1.499,99',
    unitPrice: '₺0,12',
    badge: 'EN İYİ DEĞER',
    assetKind: 'diamond_vault',
    available: false,
  },
]);

function makeJokerProduct({ id, jokerType, name, quantity, diamondCost, accent }) {
  return Object.freeze({
    id,
    section: 'jokers',
    type: MARKET_PRODUCT_TYPES.JOKER,
    priceType: MARKET_PRICE_TYPES.DIAMONDS,
    jokerType,
    name,
    title: `${quantity} ${name}`,
    description: `${quantity} adet ${name}`,
    quantity,
    price: diamondCost,
    diamondCost,
    displayPrice: `💎 ${diamondCost.toLocaleString('tr-TR')}`,
    assetKind: jokerType,
    accent,
    grants: Object.freeze({
      jokers: Object.freeze({ [jokerType]: quantity }),
      hints: 0,
    }),
    available: true,
  });
}

export const MARKET_JOKER_PRODUCTS = Object.freeze([
  makeJokerProduct({ id: 'joker_mistake_shield_1', jokerType: JOKER_TYPES.MISTAKE_SHIELD, name: 'Kronokalkan', quantity: 1, diamondCost: 60, accent: '#60a5fa' }),
  makeJokerProduct({ id: 'joker_mistake_shield_5', jokerType: JOKER_TYPES.MISTAKE_SHIELD, name: 'Kronokalkan', quantity: 5, diamondCost: 270, accent: '#60a5fa' }),
  makeJokerProduct({ id: 'joker_mistake_shield_15', jokerType: JOKER_TYPES.MISTAKE_SHIELD, name: 'Kronokalkan', quantity: 15, diamondCost: 720, accent: '#60a5fa' }),
  makeJokerProduct({ id: 'joker_time_freeze_1', jokerType: JOKER_TYPES.TIME_FREEZE, name: 'Zamanı Dondur', quantity: 1, diamondCost: 40, accent: '#38bdf8' }),
  makeJokerProduct({ id: 'joker_time_freeze_5', jokerType: JOKER_TYPES.TIME_FREEZE, name: 'Zamanı Dondur', quantity: 5, diamondCost: 180, accent: '#38bdf8' }),
  makeJokerProduct({ id: 'joker_time_freeze_15', jokerType: JOKER_TYPES.TIME_FREEZE, name: 'Zamanı Dondur', quantity: 15, diamondCost: 480, accent: '#38bdf8' }),
  makeJokerProduct({ id: 'joker_card_swap_1', jokerType: JOKER_TYPES.CARD_SWAP, name: 'Kart Değiştir', quantity: 1, diamondCost: 50, accent: '#84cc16' }),
  makeJokerProduct({ id: 'joker_card_swap_5', jokerType: JOKER_TYPES.CARD_SWAP, name: 'Kart Değiştir', quantity: 5, diamondCost: 225, accent: '#84cc16' }),
  makeJokerProduct({ id: 'joker_card_swap_15', jokerType: JOKER_TYPES.CARD_SWAP, name: 'Kart Değiştir', quantity: 15, diamondCost: 600, accent: '#84cc16' }),
]);

export const MARKET_HINT_PRODUCTS = Object.freeze([
  {
    id: 'hint_5',
    section: 'hints',
    type: MARKET_PRODUCT_TYPES.HINT,
    priceType: MARKET_PRICE_TYPES.DIAMONDS,
    title: '5 İPUCU',
    description: '5 adet ipucu bakiyesi',
    quantity: 5,
    diamondCost: 40,
    displayPrice: '💎 40',
    assetKind: 'hint',
    grants: Object.freeze({ jokers: Object.freeze({}), hints: 5 }),
    available: true,
  },
  {
    id: 'hint_15',
    section: 'hints',
    type: MARKET_PRODUCT_TYPES.HINT,
    priceType: MARKET_PRICE_TYPES.DIAMONDS,
    title: '15 İPUCU',
    description: '15 adet ipucu bakiyesi',
    quantity: 15,
    diamondCost: 100,
    displayPrice: '💎 100',
    assetKind: 'hint_stack',
    grants: Object.freeze({ jokers: Object.freeze({}), hints: 15 }),
    available: true,
  },
  {
    id: 'hint_40',
    section: 'hints',
    type: MARKET_PRODUCT_TYPES.HINT,
    priceType: MARKET_PRICE_TYPES.DIAMONDS,
    title: '40 İPUCU',
    description: '40 adet ipucu bakiyesi',
    quantity: 40,
    diamondCost: 240,
    displayPrice: '💎 240',
    assetKind: 'hint_bundle',
    grants: Object.freeze({ jokers: Object.freeze({}), hints: 40 }),
    available: true,
  },
]);

export const MARKET_ADVANTAGE_PRODUCTS = Object.freeze([
  {
    id: 'advantage_starter',
    section: 'advantages',
    type: MARKET_PRODUCT_TYPES.ADVANTAGE,
    priceType: MARKET_PRICE_TYPES.DIAMONDS,
    title: 'BAŞLANGIÇ PAKETİ',
    description: '2 Kronokalkan + 2 Kart Değiştir + 2 Zamanı Dondur + 10 İpucu',
    diamondCost: 250,
    displayPrice: '💎 250',
    assetKind: 'starter_pack',
    grants: Object.freeze({
      jokers: Object.freeze({
        [JOKER_TYPES.MISTAKE_SHIELD]: 2,
        [JOKER_TYPES.CARD_SWAP]: 2,
        [JOKER_TYPES.TIME_FREEZE]: 2,
      }),
      hints: 10,
    }),
    available: true,
  },
  {
    id: 'advantage_mega',
    section: 'advantages',
    type: MARKET_PRODUCT_TYPES.ADVANTAGE,
    priceType: MARKET_PRICE_TYPES.DIAMONDS,
    title: 'MEGA PAKET',
    description: '10 Kronokalkan + 10 Kart Değiştir + 10 Zamanı Dondur + 30 İpucu',
    diamondCost: 1000,
    displayPrice: '💎 1.000',
    assetKind: 'mega_pack',
    grants: Object.freeze({
      jokers: Object.freeze({
        [JOKER_TYPES.MISTAKE_SHIELD]: 10,
        [JOKER_TYPES.CARD_SWAP]: 10,
        [JOKER_TYPES.TIME_FREEZE]: 10,
      }),
      hints: 30,
    }),
    available: true,
  },
]);

export const MARKET_FUTURE_PRODUCTS = Object.freeze([
  {
    id: 'krono_club_future',
    section: 'future',
    type: MARKET_PRODUCT_TYPES.KRONO_CLUB,
    priceType: MARKET_PRICE_TYPES.FUTURE_REAL_MONEY,
    title: 'KRONOCLUB',
    description: 'Üyelik avantajları yakında.',
    displayPrice: 'Yakında',
    assetKind: 'club',
    available: false,
  },
  {
    id: 'remove_ads_future',
    section: 'future',
    type: MARKET_PRODUCT_TYPES.REMOVE_ADS,
    priceType: MARKET_PRICE_TYPES.FUTURE_REAL_MONEY,
    title: 'REKLAMLARI KALDIR',
    description: 'Reklamsız deneyim yakında.',
    displayPrice: 'Yakında',
    assetKind: 'remove_ads',
    available: false,
  },
]);

export const MARKET_CATALOG = Object.freeze([
  ...MARKET_DIAMOND_PACKAGES,
  ...MARKET_JOKER_PRODUCTS,
  ...MARKET_HINT_PRODUCTS,
  ...MARKET_ADVANTAGE_PRODUCTS,
  ...MARKET_FUTURE_PRODUCTS,
]);

const PRODUCT_BY_ID = Object.freeze(
  MARKET_CATALOG.reduce((acc, product) => {
    acc[product.id] = product;
    return acc;
  }, {}),
);

const SINGLE_JOKER_PRODUCT_BY_TYPE = Object.freeze(
  MARKET_JOKER_PRODUCTS
    .filter((product) => product.quantity === 1)
    .reduce((acc, product) => {
      acc[product.jokerType] = product;
      return acc;
    }, {}),
);

export function getMarketProduct(productId) {
  return PRODUCT_BY_ID[String(productId || '').trim()] || null;
}

export function getMarketJokerProduct(jokerType, quantity = 1) {
  const normalizedQuantity = Math.max(1, Math.floor(Number(quantity) || 1));
  return MARKET_JOKER_PRODUCTS.find((product) => (
    product.jokerType === jokerType && product.quantity === normalizedQuantity
  )) || SINGLE_JOKER_PRODUCT_BY_TYPE[jokerType] || null;
}

export function getMarketCatalog() {
  return MARKET_CATALOG;
}

export function getMarketCatalogSections() {
  return MARKET_SECTION_DEFINITIONS
    .map((section) => ({
      ...section,
      products: MARKET_CATALOG.filter((product) => product.section === section.id),
    }))
    .filter((section) => section.products.length > 0);
}

export function isMarketRealMoneyProduct(product) {
  return product?.priceType === MARKET_PRICE_TYPES.REAL_MONEY
    || product?.priceType === MARKET_PRICE_TYPES.FUTURE_REAL_MONEY;
}

export function isMarketRealMoneyPurchaseDisabled(product) {
  if (!isMarketRealMoneyProduct(product)) return false;
  return product.priceType === MARKET_PRICE_TYPES.FUTURE_REAL_MONEY || !MARKET_REAL_MONEY_IAP_AVAILABLE;
}

export function getMarketPurchaseReadiness(options = {}) {
  const {
    product,
    user,
    authLoading = false,
    diamonds = 0,
    pending = false,
    anyPending = false,
  } = /** @type {any} */ (options || {});
  if (!product) {
    return { disabled: true, reason: 'missing_item_data', label: 'HAZIRLANIYOR' };
  }
  if (isMarketRealMoneyPurchaseDisabled(product)) {
    return {
      disabled: true,
      reason: product.priceType === MARKET_PRICE_TYPES.FUTURE_REAL_MONEY ? 'future_feature' : 'real_money_unavailable',
      label: 'Yakında',
      purchaseBlocked: true,
    };
  }
  if (pending) {
    return { disabled: true, reason: 'purchase_in_flight', label: 'İŞLENİYOR' };
  }
  if (anyPending) {
    return { disabled: true, reason: 'another_purchase_in_flight', label: 'BEKLE' };
  }
  if (authLoading) {
    return { disabled: true, reason: 'auth_loading', label: 'HAZIRLANIYOR' };
  }
  if (!user?.email) {
    return { disabled: false, reason: 'login_required', label: 'GİRİŞ YAP' };
  }
  if (product.priceType === MARKET_PRICE_TYPES.DIAMONDS && Number(diamonds) < Number(product.diamondCost)) {
    return { disabled: true, reason: 'insufficient_diamonds', label: 'YETERSİZ' };
  }
  return { disabled: false, reason: 'ready', label: 'SATIN AL' };
}

export function createMarketClientRequestId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export function buildMarketPurchaseIdempotencyKey(userEmail, productId, clientRequestId) {
  const email = normalizeJokerEmail(userEmail);
  const product = getMarketProduct(productId);
  const requestId = String(clientRequestId || '').trim();
  if (!email || !product || !requestId) return '';
  return `market_purchase:${email}:${product.id}:${requestId}`.replace(/[^a-zA-Z0-9_.:@-]/g, '_');
}

export function buildJokerPurchaseIdempotencyKey(userEmail, jokerType, clientRequestId, quantity = 1) {
  const product = getMarketJokerProduct(jokerType, quantity);
  return buildMarketPurchaseIdempotencyKey(userEmail, product?.id, clientRequestId);
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
  if (code === 'real_money_unavailable') return 'Yakında';
  if (code === 'future_feature') return 'Bu özellik yakında.';
  if (code === 'insufficient_diamonds') return 'Yeterli elmas yok.';
  if (code === 'invalid_product_id') return 'Ürün geçersiz.';
  if (code === 'invalid_joker_type') return 'Joker türü geçersiz.';
  if (code === 'invalid_quantity') return 'Satın alma adedi geçersiz.';
  if (code === 'unauthenticated') return 'Mağaza için giriş yapmalısın.';
  if (code === 'duplicate_purchase_in_progress' || code === 'economy_operation_in_progress') {
    return 'Bu satın alma zaten işleniyor.';
  }
  return fallback;
}

function normalizePurchaseBody(body, product) {
  const balances = normalizeJokerBalances(body?.balances);
  const diamondCost = normalizeJokerQuantity(body?.diamondCost ?? product?.diamondCost);
  const diamondBalanceAfter = normalizeJokerQuantity(body?.diamondBalanceAfter);
  return {
    ...body,
    product,
    productId: body?.productId || product?.id || '',
    diamondCost,
    diamondBalanceAfter,
    jokerBalanceAfter: normalizeJokerQuantity(body?.jokerBalanceAfter),
    hintBalanceAfter: normalizeJokerQuantity(body?.hintBalanceAfter),
    balances,
  };
}

export async function purchaseMarketProduct(user, options = {}) {
  const email = normalizeJokerEmail(user?.email || user?.user_email);
  const product = getMarketProduct(options.productId)
    || getMarketJokerProduct(options.jokerType, options.quantity);
  const clientRequestId = options.clientRequestId || createMarketClientRequestId();
  const idempotencyKey = buildMarketPurchaseIdempotencyKey(email, product?.id, clientRequestId);

  if (!product) {
    return { ok: false, code: 'invalid_product_id', error: 'Ürün geçersiz.', balances: emptyJokerBalances() };
  }
  if (isMarketRealMoneyPurchaseDisabled(product)) {
    return {
      ok: false,
      code: product.priceType === MARKET_PRICE_TYPES.FUTURE_REAL_MONEY ? 'future_feature' : 'real_money_unavailable',
      error: 'Yakında',
      product,
      balances: emptyJokerBalances(),
    };
  }
  if (!email) {
    return { ok: false, code: 'unauthenticated', error: 'Mağaza için giriş yapmalısın.', product, balances: emptyJokerBalances() };
  }
  if (!idempotencyKey) {
    return { ok: false, code: 'missing_idempotency_key', error: 'Satın alma doğrulanamadı.', product, balances: emptyJokerBalances() };
  }

  let response;
  try {
    response = await invokePurchaseMarketProductWithDiamonds({
      productId: product.id,
      idempotencyKey,
      clientRequestId,
      buildMarker: KRONOX_BUILD_MARKER,
    });
  } catch (error) {
    const body = unwrapInvokeError(error);
    return normalizePurchaseBody({
      ok: false,
      code: body?.code || 'market_purchase_request_failed',
      error: safeMarketPurchaseError(error),
      productId: product.id,
      clientRequestId,
      idempotencyKey,
      balances: body?.balances,
      diamondBalanceAfter: body?.diamondBalanceAfter,
      hintBalanceAfter: body?.hintBalanceAfter,
    }, product);
  }

  const body = unwrapFunctionResponse(response);
  if (body?.ok === false) {
    return normalizePurchaseBody({
      ...body,
      ok: false,
      error: safeMarketPurchaseError(body),
      productId: product.id,
      clientRequestId,
      idempotencyKey,
    }, product);
  }

  const normalized = normalizePurchaseBody({
    ...body,
    ok: body?.ok === true,
    productId: product.id,
    clientRequestId,
    idempotencyKey,
  }, product);
  setCachedJokerBalances(email, normalized.balances, {
    queryPath: 'purchaseMarketProductWithDiamonds.mutation_result',
    invalidatedBy: 'market_purchase',
  });
  return normalized;
}

export async function purchaseMarketJoker(user, options = {}) {
  const product = getMarketJokerProduct(options.jokerType, options.quantity);
  return purchaseMarketProduct(user, {
    ...options,
    productId: product?.id,
  });
}
