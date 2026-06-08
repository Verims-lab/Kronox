import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { AlertTriangle, CheckCircle2, Gem, Loader2, RefreshCw, Shield, ShoppingBag, Snowflake } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import StandardTopBar from '@/components/layout/StandardTopBar';
import { sounds } from '@/lib/gameSounds';
import { getLeaderboardDiamondValue } from '@/lib/leaderboard';
import { emptyJokerBalances, getUserJokerBalances, JOKER_TYPES, normalizeJokerBalances, normalizeJokerQuantity } from '@/lib/jokerInventory';
import { MARKET_JOKER_PRODUCTS, createMarketClientRequestId, purchaseMarketJoker } from '@/lib/market';

const ICON_BY_JOKER_TYPE = {
  [JOKER_TYPES.TIME_FREEZE]: Snowflake,
  [JOKER_TYPES.CARD_SWAP]: RefreshCw,
  [JOKER_TYPES.MISTAKE_SHIELD]: Shield,
};

export default function MarketPage() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [balances, setBalances] = useState(emptyJokerBalances());
  const [pendingType, setPendingType] = useState('');
  const [notice, setNotice] = useState({ type: '', text: '' });

  useEffect(() => {
    let alive = true;
    setLoading(true);
    base44.auth.me()
      .then(async (currentUser) => {
        if (!alive) return;
        if (!currentUser) {
          setUser(null);
          setBalances(emptyJokerBalances());
          return;
        }
        setUser(currentUser);
        const result = await getUserJokerBalances(currentUser, { ensureStarter: true }).catch(() => null);
        if (!alive) return;
        setBalances(normalizeJokerBalances(result?.balances));
      })
      .catch(() => {
        if (!alive) return;
        setUser(null);
        setBalances(emptyJokerBalances());
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => { alive = false; };
  }, []);

  const diamonds = useMemo(() => getLeaderboardDiamondValue(user), [user]);

  const handleBack = () => {
    sounds.tap();
    navigate('/');
  };

  const handlePurchase = async (product) => {
    sounds.tap();
    if (!user) {
      base44.auth.redirectToLogin('/market');
      return;
    }
    if (pendingType) return;
    if (diamonds < product.price) {
      setNotice({ type: 'error', text: 'Yeterli elmas yok.' });
      return;
    }

    setPendingType(product.jokerType);
    setNotice({ type: '', text: '' });
    const clientRequestId = createMarketClientRequestId();
    try {
      const result = await purchaseMarketJoker(user, {
        jokerType: product.jokerType,
        quantity: 1,
        clientRequestId,
      });
      if (!result?.ok) {
        setNotice({ type: 'error', text: result?.error || 'Satın alma tamamlanamadı.' });
        return;
      }
      const nextBalances = normalizeJokerBalances(result.balances);
      if (Object.values(nextBalances).some((value) => Number(value) > 0)) {
        setBalances(nextBalances);
      } else {
        setBalances((current) => ({
          ...current,
          [product.jokerType]: normalizeJokerQuantity(current?.[product.jokerType]) + 1,
        }));
      }
      setUser((current) => ({
        ...(current || user),
        ...(result.userPatch || {}),
        diamonds: normalizeJokerQuantity(result.diamondBalanceAfter),
      }));
      setNotice({ type: 'success', text: `${product.name} alındı.` });
    } catch {
      setNotice({ type: 'error', text: 'Satın alma tamamlanamadı.' });
    } finally {
      setPendingType('');
    }
  };

  return (
    <main
      className="min-h-screen text-white"
      style={{
        paddingTop: 'calc(4rem + env(safe-area-inset-top))',
        paddingBottom: 'calc(5.5rem + env(safe-area-inset-bottom))',
        background:
          'radial-gradient(ellipse at 50% 0%, rgba(250,204,21,0.16), transparent 36%), radial-gradient(ellipse at 20% 22%, rgba(56,189,248,0.13), transparent 34%), linear-gradient(180deg, #050b1c 0%, #0a1738 55%, #03060f 100%)',
        userSelect: 'none',
      }}
    >
      <StandardTopBar diamonds={diamonds} user={user} showBack onBack={handleBack} />

      <div className="mx-auto flex w-full max-w-md flex-col gap-4 px-4">
        <header className="flex items-end justify-between gap-3">
          <div>
            <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-full bg-amber-300 text-slate-950 shadow-[0_0_24px_rgba(250,204,21,0.35)]">
              <ShoppingBag className="h-5 w-5" strokeWidth={2.5} />
            </div>
            <h1 className="font-cinzel text-[28px] font-black leading-none">Mağaza</h1>
            <p className="mt-2 font-inter text-[12px] font-semibold text-blue-100/72">
              Solo jokerlerini elmasla güçlendir.
            </p>
          </div>
          <div
            className="kronox-number flex items-center gap-1.5 rounded-full px-3 py-2 text-[15px] font-extrabold"
            style={{
              background: 'rgba(15,23,42,0.72)',
              boxShadow: 'inset 0 0 0 1px rgba(250,204,21,0.28)',
            }}
            aria-label={`Elmas: ${diamonds}`}
          >
            <Gem className="h-[18px] w-[18px] text-amber-300" strokeWidth={2.5} />
            {diamonds.toLocaleString('tr-TR')}
          </div>
        </header>

        {notice.text && (
          <div
            className="flex items-center gap-2 rounded-xl px-3 py-2 font-inter text-[12px] font-bold"
            style={{
              color: notice.type === 'success' ? '#bbf7d0' : '#fecaca',
              background: notice.type === 'success' ? 'rgba(22,101,52,0.30)' : 'rgba(127,29,29,0.30)',
              boxShadow: notice.type === 'success'
                ? 'inset 0 0 0 1px rgba(74,222,128,0.30)'
                : 'inset 0 0 0 1px rgba(248,113,113,0.30)',
            }}
          >
            {notice.type === 'success' ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
            <span>{notice.text}</span>
          </div>
        )}

        <section className="flex flex-col gap-3" aria-label="Mağaza ürünleri">
          {MARKET_JOKER_PRODUCTS.map((product) => (
            <MarketProductCard
              key={product.jokerType}
              product={product}
              ownedCount={normalizeJokerQuantity(balances?.[product.jokerType])}
              diamonds={diamonds}
              loading={loading}
              pending={pendingType === product.jokerType}
              anyPending={Boolean(pendingType)}
              onPurchase={() => handlePurchase(product)}
            />
          ))}
        </section>
      </div>
    </main>
  );
}

function MarketProductCard({ product, ownedCount, diamonds, loading, pending, anyPending, onPurchase }) {
  const Icon = ICON_BY_JOKER_TYPE[product.jokerType] || ShoppingBag;
  const insufficient = diamonds < product.price;
  const disabled = loading || pending || anyPending || insufficient;
  const buttonLabel = pending ? 'İşleniyor' : insufficient ? 'Yeterli elmas yok' : 'Satın Al';

  return (
    <motion.article
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22 }}
      className="rounded-2xl p-3"
      style={{
        background: 'linear-gradient(180deg, rgba(15,23,42,0.88), rgba(8,14,33,0.94))',
        boxShadow: 'inset 0 0 0 1px rgba(148,163,184,0.20), 0 16px 32px rgba(0,0,0,0.22)',
      }}
    >
      <div className="flex items-center gap-3">
        <div
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full"
          style={{
            color: product.accent,
            background: `${product.accent}18`,
            boxShadow: `inset 0 0 0 1px ${product.accent}55, 0 0 20px ${product.accent}24`,
          }}
        >
          <Icon className="h-6 w-6" strokeWidth={2.4} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <h2 className="truncate font-cinzel text-[16px] font-black">{product.name}</h2>
            <span className="shrink-0 rounded-full bg-white/10 px-2 py-1 font-inter text-[11px] font-bold text-blue-100/80">
              x{ownedCount}
            </span>
          </div>
          <p className="mt-1 font-inter text-[12px] font-medium leading-snug text-blue-100/70">
            {product.description}
          </p>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between gap-3">
        <div className="kronox-number flex items-center gap-1.5 rounded-full bg-amber-300/10 px-3 py-1.5 font-extrabold text-amber-200">
          <Gem className="h-4 w-4" strokeWidth={2.5} />
          <span>{product.price}</span>
        </div>
        <button
          type="button"
          onClick={onPurchase}
          disabled={disabled}
          className="flex min-w-[116px] items-center justify-center gap-2 rounded-xl px-4 py-2.5 font-inter text-[13px] font-black text-slate-950 transition-transform active:scale-95 disabled:cursor-not-allowed disabled:opacity-55 disabled:active:scale-100"
          style={{
            background: disabled ? 'rgba(148,163,184,0.70)' : 'linear-gradient(180deg, #facc15, #f59e0b)',
            boxShadow: disabled ? 'none' : '0 8px 20px rgba(250,204,21,0.24)',
          }}
          aria-label={`${product.name} satın al`}
        >
          {pending && <Loader2 className="h-4 w-4 animate-spin" />}
          {buttonLabel}
        </button>
      </div>
    </motion.article>
  );
}
