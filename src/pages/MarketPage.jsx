import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  Crown,
  Gem,
  Gift,
  Lightbulb,
  Loader2,
  Package,
  RefreshCw,
  Shield,
  ShoppingBag,
  Snowflake,
  Sparkles,
} from 'lucide-react';
import { base44 } from '@/api/base44Client';
import StandardTopBar from '@/components/layout/StandardTopBar';
import { sounds } from '@/lib/gameSounds';
import { useAuth } from '@/lib/AuthContext';
import { getLeaderboardDiamondValue } from '@/lib/leaderboard';
import {
  emptyJokerBalances,
  ensureStarterJokers,
  getUserJokerBalances,
  JOKER_TYPES,
  normalizeJokerBalances,
  normalizeJokerQuantity,
} from '@/lib/jokerInventory';
import {
  getMarketCatalogSections,
  getMarketPurchaseReadiness,
  MARKET_PRICE_TYPES,
  purchaseMarketProduct,
} from '@/lib/market';

const Barlow = '"Barlow Condensed", "Arial Narrow", sans-serif';
const KronoxYellow = '#FFD24A';

const ICON_BY_ASSET_KIND = {
  diamond_pile: Gem,
  diamond_bag: ShoppingBag,
  diamond_chest: Package,
  diamond_chest_large: Package,
  diamond_vault: Gem,
  [JOKER_TYPES.MISTAKE_SHIELD]: Shield,
  [JOKER_TYPES.CARD_SWAP]: RefreshCw,
  [JOKER_TYPES.TIME_FREEZE]: Snowflake,
  hint: Lightbulb,
  hint_stack: Lightbulb,
  hint_bundle: Sparkles,
  starter_pack: Gift,
  mega_pack: Gift,
  club: Crown,
  remove_ads: Ban,
};

export default function MarketPage() {
  const navigate = useNavigate();
  const { user: authUser, isLoadingAuth, checkUserAuth, setUser } = useAuth();
  const [localUserPatch, setLocalUserPatch] = useState(null);
  const [balances, setBalances] = useState(emptyJokerBalances());
  const [hintBalance, setHintBalance] = useState(null);
  const [inventoryState, setInventoryState] = useState({
    loading: false,
    refreshing: false,
    ready: false,
    error: '',
  });
  const [pendingProductId, setPendingProductId] = useState('');
  const [notice, setNotice] = useState({ type: '', text: '' });
  const sections = useMemo(() => getMarketCatalogSections(), []);
  const user = useMemo(
    () => (authUser ? { ...authUser, ...(localUserPatch || {}) } : null),
    [authUser, localUserPatch],
  );

  useEffect(() => {
    setLocalUserPatch(null);
    setHintBalance(null);
  }, [authUser?.email]);

  useEffect(() => {
    let alive = true;
    const currentUser = authUser;
    if (!currentUser?.email) {
      setBalances(emptyJokerBalances());
      setInventoryState({ loading: false, refreshing: false, ready: false, error: '' });
      return () => { alive = false; };
    }

    setInventoryState((prev) => ({ ...prev, loading: true, error: '' }));
    getUserJokerBalances(currentUser, { ensureStarter: false })
      .then((result) => {
        if (!alive) return;
        setBalances(normalizeJokerBalances(result?.balances));
        setInventoryState({
          loading: false,
          refreshing: Boolean(result?.meta?.selfHealNeeded),
          ready: true,
          error: '',
        });
        if (result?.meta?.selfHealNeeded) {
          ensureStarterJokers(currentUser)
            .then((healed) => {
              if (!alive) return;
              setBalances(normalizeJokerBalances(healed?.balances));
              setInventoryState({ loading: false, refreshing: false, ready: true, error: '' });
            })
            .catch(() => {
              if (!alive) return;
              setInventoryState((prev) => ({ ...prev, refreshing: false }));
            });
        }
      })
      .catch(() => {
        if (!alive) return;
        setBalances(emptyJokerBalances());
        setInventoryState({
          loading: false,
          refreshing: false,
          ready: false,
          error: 'Joker sayıları güncellenemedi.',
        });
      })
      .finally(() => {
        if (alive) setInventoryState((prev) => ({ ...prev, loading: false }));
      });
    return () => { alive = false; };
  }, [authUser]);

  const diamonds = useMemo(() => getLeaderboardDiamondValue(user), [user]);

  const handleBack = () => {
    sounds.tap();
    navigate('/');
  };

  const updateUserDiamonds = (result) => {
    const nextDiamonds = normalizeJokerQuantity(result?.diamondBalanceAfter);
    const userPatch = {
      ...(result?.userPatch || {}),
      diamonds: nextDiamonds,
    };
    setLocalUserPatch((current) => ({
      ...(current || {}),
      ...userPatch,
    }));
    if (typeof setUser === 'function') {
      setUser((current) => ({
        ...(current || authUser || {}),
        ...userPatch,
      }));
    }
  };

  const handlePurchase = async (product) => {
    sounds.tap();
    if (pendingProductId) return;

    const readiness = getMarketPurchaseReadiness({
      product,
      user,
      authLoading: isLoadingAuth,
      diamonds,
      pending: pendingProductId === product.id,
      anyPending: Boolean(pendingProductId),
    });

    if (readiness.purchaseBlocked) {
      return;
    }
    if (readiness.reason === 'login_required') {
      base44.auth.redirectToLogin('/market');
      return;
    }
    if (readiness.disabled) {
      if (readiness.reason === 'insufficient_diamonds') {
        setNotice({ type: 'error', text: 'Yeterli elmas yok.' });
      }
      return;
    }

    setPendingProductId(product.id);
    setNotice({ type: '', text: '' });
    try {
      const result = await purchaseMarketProduct(user, {
        productId: product.id,
      });
      if (!result?.ok) {
        setNotice({ type: result?.code === 'real_money_unavailable' || result?.code === 'future_feature' ? 'info' : 'error', text: result?.error || 'Satın alma tamamlanamadı. Tekrar dene.' });
        return;
      }
      setBalances(normalizeJokerBalances(result.balances));
      if (Number.isFinite(Number(result.hintBalanceAfter))) {
        setHintBalance(normalizeJokerQuantity(result.hintBalanceAfter));
      }
      updateUserDiamonds(result);
      checkUserAuth?.();
      setNotice({ type: 'success', text: `${product.title} alındı.` });
    } catch {
      setNotice({ type: 'error', text: 'Satın alma tamamlanamadı. Tekrar dene.' });
    } finally {
      setPendingProductId('');
    }
  };

  return (
    <main
      className="min-h-screen overflow-x-hidden overflow-y-auto text-white"
      style={{
        paddingTop: 'calc(4.25rem + env(safe-area-inset-top))',
        paddingBottom: 'calc(6.25rem + env(safe-area-inset-bottom))',
        background:
          'radial-gradient(circle at 50% 28%, rgba(65,196,255,.08), transparent 34%), linear-gradient(180deg, #081327 0%, #0B1C38 45%, #081327 100%)',
        userSelect: 'none',
      }}
    >
      <StandardTopBar
        diamonds={diamonds}
        user={user}
        showBack
        onBack={handleBack}
        onMarket={() => navigate('/market')}
        onDiamondClick={() => navigate('/market')}
      />

      <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-3 sm:px-4">
        <header className="flex items-end justify-between gap-3 px-1">
          <div className="min-w-0">
            <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-amber-300 text-slate-950 shadow-[0_0_24px_rgba(250,204,21,0.35)]">
              <ShoppingBag className="h-5 w-5" strokeWidth={2.5} />
            </div>
            <h1
              className="uppercase leading-none text-white"
              style={{ fontFamily: Barlow, fontWeight: 800, fontSize: 'clamp(2rem, 7vw, 3rem)', letterSpacing: 0 }}
            >
              Mağaza
            </h1>
            <p className="mt-1 font-inter text-[13px] font-medium leading-snug text-[#C6CEDB]">
              Elmas paketleri, jokerler ve avantaj paketleri.
            </p>
          </div>
          <div
            className="kronox-number flex shrink-0 items-center gap-1.5 rounded-full px-3 py-2 text-[15px] font-extrabold"
            style={{
              background: 'rgba(12,24,48,.88)',
              boxShadow: 'inset 0 0 0 1px rgba(255,210,95,.22)',
            }}
            aria-label={`Elmas: ${diamonds}`}
          >
            <Gem className="h-[18px] w-[18px] text-amber-300" strokeWidth={2.5} />
            {diamonds.toLocaleString('tr-TR')}
          </div>
        </header>

        {notice.text && (
          <Notice type={notice.type} text={notice.text} />
        )}

        {sections.map((section) => (
          <MarketSection
            key={section.id}
            section={section}
            products={section.products}
            diamonds={diamonds}
            user={user}
            authLoading={isLoadingAuth}
            pendingProductId={pendingProductId}
            onPurchase={handlePurchase}
          />
        ))}

        {(inventoryState.loading || inventoryState.refreshing || inventoryState.error || hintBalance != null) && (
          <p className="px-1 font-inter text-[11px] font-medium text-[#8FA3C4]" role="status" aria-live="polite">
            {inventoryState.error
              || (inventoryState.loading ? 'Joker sayıları yükleniyor.' : inventoryState.refreshing ? 'Joker sayıları güncelleniyor.' : `İpucu bakiyesi: ${hintBalance}`)}
          </p>
        )}
      </div>
    </main>
  );
}

function Notice({ type, text }) {
  const isSuccess = type === 'success';
  const isInfo = type === 'info';
  const Icon = isSuccess ? CheckCircle2 : AlertTriangle;
  return (
    <div
      className="flex items-center gap-2 rounded-xl px-3 py-2 font-inter text-[12px] font-bold"
      style={{
        color: isSuccess ? '#bbf7d0' : isInfo ? '#bfdbfe' : '#fecaca',
        background: isSuccess ? 'rgba(22,101,52,0.30)' : isInfo ? 'rgba(30,64,175,0.28)' : 'rgba(127,29,29,0.30)',
        boxShadow: isSuccess
          ? 'inset 0 0 0 1px rgba(74,222,128,0.30)'
          : isInfo
            ? 'inset 0 0 0 1px rgba(96,165,250,0.30)'
            : 'inset 0 0 0 1px rgba(248,113,113,0.30)',
      }}
    >
      <Icon className="h-4 w-4" />
      <span>{text}</span>
    </div>
  );
}

function MarketSection({ section, products, diamonds, user, authLoading, pendingProductId, onPurchase }) {
  return (
    <section className="flex flex-col gap-2.5" aria-label={section.title}>
      <div className="px-1">
        <p className="font-inter text-[11px] font-normal uppercase text-[#8FA3C4]">{section.eyebrow}</p>
        <h2
          className="uppercase text-white"
          style={{ fontFamily: Barlow, fontWeight: 800, fontSize: 'clamp(1.5rem, 5vw, 2rem)', letterSpacing: 0 }}
        >
          {section.title}
        </h2>
        <p className="font-inter text-[12px] font-medium leading-snug text-[#C6CEDB]">{section.description}</p>
      </div>
      <div className="flex flex-col gap-2.5">
        {products.map((product) => (
          <MarketProductCard
            key={product.id}
            product={product}
            diamonds={diamonds}
            user={user}
            authLoading={authLoading}
            pending={pendingProductId === product.id}
            anyPending={Boolean(pendingProductId)}
            onPurchase={() => onPurchase(product)}
          />
        ))}
      </div>
    </section>
  );
}

function MarketProductCard({
  product,
  diamonds,
  authLoading,
  user,
  pending,
  anyPending,
  onPurchase,
}) {
  const readiness = getMarketPurchaseReadiness({
    product,
    user,
    authLoading,
    diamonds,
    pending,
    anyPending,
  });
  const disabled = readiness.disabled;
  const buttonLabel = readiness.label;

  return (
    <motion.article
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="relative grid items-center gap-3 px-3 py-3"
      style={{
        gridTemplateColumns: 'clamp(4.35rem, 17vw, 6.1rem) minmax(0, 1fr) minmax(5.7rem, 7.7rem)',
        background: 'rgba(12,24,48,.88)',
        border: '1px solid rgba(255,210,95,.18)',
        borderRadius: 'clamp(1rem,2vw,1.4rem)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06), 0 16px 30px rgba(0,0,0,0.18)',
      }}
    >
      {product.badge && (
        <span
          className="absolute left-0 top-0 rounded-br-md rounded-tl-[inherit] px-2 py-0.5 uppercase text-slate-950"
          style={{ background: product.badge === 'EN İYİ DEĞER' ? '#8B5CF6' : KronoxYellow, fontFamily: Barlow, fontWeight: 700, fontSize: 12, letterSpacing: 0 }}
        >
          {product.badge}
        </span>
      )}

      <ProductArt product={product} />

      <div className="min-w-0 py-1">
        <h3
          className="truncate uppercase text-white"
          style={{ fontFamily: Barlow, fontWeight: 700, fontSize: 'clamp(1.15rem, 4.6vw, 1.72rem)', letterSpacing: 0 }}
        >
          {product.title}
        </h3>
        <p className="mt-1 line-clamp-2 font-inter text-[12px] font-medium leading-snug text-[#C6CEDB]">
          {product.description}
        </p>
      </div>

      <div className="flex min-w-0 flex-col items-end justify-center gap-2">
        <PriceLabel product={product} />
        <button
          type="button"
          onClick={disabled ? undefined : onPurchase}
          disabled={disabled}
          className="flex min-h-10 w-full min-w-0 items-center justify-center gap-1.5 rounded-xl px-2 text-center transition-transform active:scale-95 disabled:cursor-not-allowed disabled:opacity-55 disabled:active:scale-100"
          style={{
            background: disabled ? 'rgba(148,163,184,0.70)' : 'linear-gradient(180deg, #FFD95A 0%, #FFB026 100%)',
            color: '#111111',
            boxShadow: disabled ? 'none' : '0 8px 18px rgba(255,210,74,0.26), inset 0 1px 0 rgba(255,255,255,0.35)',
            fontFamily: Barlow,
            fontWeight: 700,
            fontSize: 'clamp(0.95rem, 3.5vw, 1.15rem)',
            letterSpacing: 0,
          }}
          aria-label={`${product.title} ${buttonLabel}`}
        >
          {pending && <Loader2 className="h-4 w-4 animate-spin" />}
          <span className="truncate">{buttonLabel}</span>
        </button>
      </div>
    </motion.article>
  );
}

function PriceLabel({ product }) {
  if (product.priceType === MARKET_PRICE_TYPES.DIAMONDS) {
    return (
      <div
        className="flex items-center gap-1 text-right"
        style={{ color: KronoxYellow, fontFamily: Barlow, fontWeight: 600, fontSize: 'clamp(1.05rem, 4.2vw, 1.5rem)', letterSpacing: 0 }}
      >
        <Gem className="h-4 w-4 shrink-0" strokeWidth={2.5} />
        <span>{Number(product.diamondCost).toLocaleString('tr-TR')}</span>
      </div>
    );
  }
  return (
    <p
      className="truncate text-right"
      style={{ color: product.priceType === MARKET_PRICE_TYPES.FUTURE_REAL_MONEY ? '#8FA3C4' : KronoxYellow, fontFamily: Barlow, fontWeight: 600, fontSize: 'clamp(1.05rem, 4.2vw, 1.5rem)', letterSpacing: 0 }}
    >
      {product.displayPrice}
    </p>
  );
}

function ProductArt({ product }) {
  const Icon = ICON_BY_ASSET_KIND[product.assetKind] || ShoppingBag;
  const isDiamond = product.type === 'diamond_pack';
  const isPack = product.type === 'advantage';
  const accent = product.accent || (isDiamond ? '#FFD24A' : isPack ? '#22D3EE' : '#8FA3C4');
  return (
    <div
      className="relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-xl"
      style={{
        background: `radial-gradient(circle at 50% 35%, ${accent}30, rgba(8,19,39,0.15) 62%, rgba(8,19,39,0.02) 100%)`,
      }}
      aria-hidden="true"
    >
      <Icon
        className="relative z-10 h-[54%] w-[54%]"
        strokeWidth={2.35}
        style={{
          color: accent,
          filter: isDiamond ? 'drop-shadow(0 0 10px rgba(255,210,74,0.45))' : `drop-shadow(0 0 10px ${accent}55)`,
        }}
      />
      {isDiamond && (
        <>
          <span className="absolute bottom-[18%] left-[18%] h-[22%] w-[22%] rotate-12 rounded-md bg-amber-300/80 shadow-[0_0_12px_rgba(255,210,74,0.55)]" />
          <span className="absolute bottom-[16%] right-[18%] h-[18%] w-[18%] -rotate-12 rounded-md bg-yellow-500/75 shadow-[0_0_10px_rgba(255,176,38,0.48)]" />
        </>
      )}
    </div>
  );
}
