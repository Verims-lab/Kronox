import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Gem, ShoppingBag } from 'lucide-react';
import { sounds } from '@/lib/gameSounds';
import HeaderNotificationBell from '@/components/notifications/HeaderNotificationBell';

/**
 * StandardTopBar — single shared top bar for app-shell screens.
 *
 * Layout (matches the new Home/Solo design language):
 *   [optional back ← / Mağaza]   [💎 diamondCount]      [🔔 bell]
 *
 * Fixed to the top, safe-area aware, 100% width. The diamond chip is
 * centered horizontally regardless of whether the back button is shown so
 * the visual rhythm stays identical across screens (Home, Solo, etc.).
 *
 * Props
 *   diamonds    : number — real diamond count to display
 *   user        : the auth user (passed to the notification bell)
 *   showBack    : boolean — render the back arrow in the top-left
 *   onBack      : optional override for the back action; defaults to
 *                 history.back() with a fallback to '/'.
 */
export default function StandardTopBar({
  diamonds = 0,
  user = null,
  showBack = false,
  onBack,
  showMarket = false,
  onMarket,
  onDiamondClick,
  variant = 'default',
}) {
  const navigate = useNavigate();
  const isHomeVariant = variant === 'home';

  const handleBack = () => {
    sounds.tap();
    if (onBack) { onBack(); return; }
    if (typeof window !== 'undefined' && window.history.length > 1) navigate(-1);
    else navigate('/');
  };

  const handleMarket = () => {
    sounds.tap();
    if (onMarket) { onMarket(); return; }
    navigate('/market');
  };

  const handleDiamondClick = () => {
    if (!onDiamondClick) return;
    sounds.tap();
    onDiamondClick();
  };

  return (
    <header
      className="fixed left-0 right-0 top-0 z-[110] flex items-center justify-center"
      style={{
        paddingTop: 'env(safe-area-inset-top)',
        paddingLeft: 'calc(env(safe-area-inset-left) + 0.75rem)',
        paddingRight: 'calc(env(safe-area-inset-right) + 0.75rem)',
        height: `calc(${isHomeVariant ? '3.75rem' : '3.25rem'} + env(safe-area-inset-top))`,
        background: isHomeVariant
          ? 'linear-gradient(180deg, rgba(6,18,37,0.74) 0%, rgba(6,18,37,0.28) 72%, rgba(6,18,37,0) 100%)'
          : 'linear-gradient(180deg, rgba(8,15,38,0.92) 0%, rgba(8,15,38,0.55) 70%, rgba(8,15,38,0) 100%)',
        userSelect: 'none',
      }}
    >
      {/* Left-anchored back button (absolute so center stays centered). */}
      {showBack && (
        <button
          type="button"
          onClick={handleBack}
          aria-label="Geri"
          className="absolute flex h-10 w-10 items-center justify-center rounded-full text-white active:scale-95 transition-transform"
          style={{
            left: 'calc(env(safe-area-inset-left) + 0.75rem)',
            top: 'calc(env(safe-area-inset-top) + 0.5rem)',
            background: 'rgba(255,255,255,0.08)',
            boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.12)',
          }}
        >
          <ArrowLeft className="h-5 w-5" strokeWidth={2.4} />
        </button>
      )}

      {!showBack && showMarket && (
        <button
          type="button"
          onClick={handleMarket}
          aria-label="Mağaza"
          className="absolute flex h-10 w-10 items-center justify-center rounded-full text-amber-200 active:scale-95 transition-transform"
          style={{
            left: 'calc(env(safe-area-inset-left) + 0.75rem)',
            top: `calc(env(safe-area-inset-top) + ${isHomeVariant ? '0.62rem' : '0.5rem'})`,
            width: isHomeVariant ? 44 : undefined,
            height: isHomeVariant ? 44 : undefined,
            background: isHomeVariant ? 'rgba(7, 21, 47, 0.82)' : 'rgba(250,204,21,0.10)',
            border: isHomeVariant ? '1px solid rgba(255, 201, 40, 0.45)' : undefined,
            boxShadow: isHomeVariant
              ? '0 0 16px rgba(85,216,255,0.10), inset 0 0 0 1px rgba(255,255,255,0.04)'
              : 'inset 0 0 0 1px rgba(250,204,21,0.35), 0 0 18px rgba(250,204,21,0.10)',
          }}
        >
          <ShoppingBag className="h-5 w-5" strokeWidth={2.5} />
        </button>
      )}

      {/* Centered diamond chip */}
      <button
        type="button"
        onClick={handleDiamondClick}
        disabled={!onDiamondClick}
        className="kronox-number flex items-center gap-1.5 rounded-full text-white disabled:pointer-events-none"
        style={{
          minHeight: 40,
          padding: onDiamondClick ? '0 0.6rem' : 0,
          background: onDiamondClick ? 'rgba(7, 21, 47, 0.20)' : 'transparent',
          fontSize: 18,
          fontWeight: 800,
          touchAction: 'manipulation',
        }}
        aria-label={`Elmas: ${diamonds}`}
      >
        <Gem
          className="shrink-0"
          style={{
            width: 'clamp(18px, 5vw, 22px)',
            height: 'clamp(18px, 5vw, 22px)',
            color: '#facc15',
            filter: 'drop-shadow(0 0 6px rgba(250,204,21,0.55))',
          }}
          strokeWidth={2.4}
        />
        <span>{formatDiamondCount(diamonds)}</span>
      </button>

      {/* Right-anchored bell */}
      <div
        className="absolute flex items-center"
        style={{
          right: 'calc(env(safe-area-inset-right) + 0.75rem)',
          top: `calc(env(safe-area-inset-top) + ${isHomeVariant ? '0.62rem' : '0.5rem'})`,
          height: isHomeVariant ? '2.75rem' : '2.25rem',
        }}
      >
        <HeaderNotificationBell user={user} variant={isHomeVariant ? 'home' : 'default'} />
      </div>
    </header>
  );
}

function formatDiamondCount(value) {
  const n = Math.max(0, Math.floor(Number(value) || 0));
  return n.toLocaleString('tr-TR');
}
