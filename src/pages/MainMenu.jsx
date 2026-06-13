import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Crosshair, Swords } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { sounds } from '@/lib/gameSounds';
import StandardTopBar from '@/components/layout/StandardTopBar';
import DailyRewardsPanel from '@/components/dailyWheel/DailyRewardsPanel';
import AuthProviderButtons from '@/components/auth/AuthProviderButtons';
import { getLeaderboardDiamondValue } from '@/lib/leaderboard';

/**
 * Kronox Home — fixed full-screen mobile game home.
 *
 * Reference: provided 1080x1920 mock with
 *   • Top bar: centered diamond icon + count (left of center), bell top-right
 *   • Center: large KRONOX wordmark + two-line yellow tagline
 *   • Two stacked yellow CTAs: SOLO MEYDAN OKUMA, ONLINE KAPIŞMA
 *   • BottomNav: Ana Sayfa / Liderlik / Profil (rendered globally by App)
 *
 * Layout strategy (no-scroll, anchored top/bottom, fluid middle):
 *   • <main> is fixed to 100dvh, overflow hidden, contained paint.
 *   • A flex column reserves a top header band and a bottom-nav buffer; the
 *     middle area absorbs the leftover space and centers its content.
 *   • A `clamp()` text + button sizing keeps the composition identical on
 *     small phones, large phones, and desktop browsers — no per-device
 *     breakpoints, no jitter.
 *   • Safe-area insets are added to the header band height and to the
 *     bottom CTA padding so the design respects notches and the iOS home
 *     indicator without drifting between devices.
 *   • The global BottomNav (rendered by App.jsx) sits below this screen; we
 *     reserve space for it via paddingBottom on the CTA stack.
 */
export default function MainMenu() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);

  useEffect(() => {
    let cancelled = false;
    base44.auth.me()
      .then((u) => { if (!cancelled) setUser(u || null); })
      .catch(() => { if (!cancelled) setUser(null); });
    return () => { cancelled = true; };
  }, []);

  const diamonds = useMemo(() => getLeaderboardDiamondValue(user), [user]);

  const handleSolo = () => {
    sounds.tap();
    navigate('/solo');
  };

  const handleOnline = () => {
    sounds.tap();
    if (!user) base44.auth.redirectToLogin('/');
    else navigate('/lobby');
  };

  const handleMarket = () => {
    navigate('/market');
  };

  const handleLogin = () => {
    sounds.tap();
    base44.auth.redirectToLogin('/');
  };

  const handleDailyWheelUserPatch = useCallback((patch) => {
    if (!patch || typeof patch !== 'object') return;
    setUser((current) => ({
      ...(current || {}),
      ...patch,
    }));
  }, []);

  return (
    <main
      className="fixed inset-0 w-full overflow-hidden text-white"
      style={{
        width: '100vw',
        height: '100dvh',
        maxHeight: '100dvh',
        overflow: 'hidden',
        overscrollBehavior: 'none',
        touchAction: 'manipulation',
        userSelect: 'none',
        contain: 'layout paint size',
        // Reference background: deep navy with a subtle radial vignette so the
        // KRONOX wordmark reads cleanly. No external image required.
        background:
          'radial-gradient(ellipse at 50% 40%, #0f2657 0%, #0a1b3f 45%, #060f2b 75%, #03081a 100%)',
      }}
    >
      {/* ───── Top bar (Mağaza • Diamond + count • Bell) — shared StandardTopBar ───── */}
      <StandardTopBar diamonds={diamonds} user={user} showMarket onMarket={handleMarket} />

      {/* ───── Center stack (logo + tagline + CTAs) ─────
           Flex column fills between top safe-area and bottom-nav reserved
           space. The inner block self-centers, so the composition stays
           vertically balanced on every viewport. */}
      <div
        className="absolute left-0 right-0 flex flex-col items-center"
        style={{
          top: 'calc(env(safe-area-inset-top) + 3.25rem)',
          bottom: 'calc(env(safe-area-inset-bottom) + 3.5rem)', // BottomNav reserved
          paddingLeft: 'env(safe-area-inset-left)',
          paddingRight: 'env(safe-area-inset-right)',
        }}
      >
        {/* Inner container caps the artwork width on tablets / desktop so the
            mobile composition is preserved. */}
        <div
          className="flex h-full w-full flex-col items-center justify-center"
          style={{
            maxWidth: '28rem',
            paddingLeft: '1.25rem',
            paddingRight: '1.25rem',
          }}
        >
          {/* Logo + tagline */}
          <div className="flex flex-col items-center text-center" style={{ marginTop: 'auto' }}>
            <KronoxWordmark />
            <KronoxDivider />
            {/* Tagline — first line WHITE, second line GOLD (per reference). */}
            <p
              className="font-inter mt-5 leading-snug tracking-[0.22em] text-center"
              style={{
                fontWeight: 800,
                fontSize: 'clamp(11px, 3.4vw, 14px)',
                textShadow: '0 2px 8px rgba(0,0,0,0.55)',
              }}
            >
              <span style={{ color: '#f3f6ff' }}>KARTI DOĞRU YERE KOY,</span>
              <br />
              <span style={{ color: '#f4d24a' }}>ZAMANI SEN YÖNET</span>
            </p>
          </div>

          {/* CTA stack pinned toward the lower-middle so it always lands in
              the same visual zone as the reference, no matter the height.
              `paddingBottom` lifts the buttons slightly upward away from the
              bottom-nav edge to match the reference framing. */}
          <div
            className="mt-auto flex w-full flex-col items-center"
            style={{ gap: '0.75rem', paddingTop: 'clamp(0.75rem, 3vh, 1.8rem)', paddingBottom: 'clamp(1.35rem, 5.8vh, 3.2rem)' }}
          >
            <DailyRewardsPanel
              user={user}
              onUserUpdated={handleDailyWheelUserPatch}
              onLogin={handleLogin}
              ariaLabel="Günlük Ödüller: Günlük Çark ve Günlük Görev"
            />
            <HomeCTA
              icon={Crosshair}
              label="SOLO MEYDAN OKUMA"
              onClick={handleSolo}
              ariaLabel="Solo Meydan Okuma"
            />
            <HomeCTA
              icon={Swords}
              label="ONLINE KAPIŞMA"
              onClick={handleOnline}
              ariaLabel="Online Kapışma"
            />

            {/* Guest auth — App Store compliance requires Apple alongside
                third-party login. Email/hosted Base44 login stays available. */}
            {!user && (
              <AuthProviderButtons fromUrl="/" onBeforeStart={() => sounds.tap()} className="mt-1" />
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

/* ─────────────────────────────────────────────────────────────────── */
/*  Wordmark + divider                                                 */
/* ─────────────────────────────────────────────────────────────────── */

/**
 * Large KRONOX wordmark. The final "X" is split into two yellow accent
 * chevrons to mimic the reference logo, while the first five letters use
 * the cool white tone from the mock. clamp() keeps the size identical
 * across phones and desktop browsers without media queries.
 */
function KronoxWordmark() {
  // Reference shows clearly-separated KRONO letters in white plus a gold X
  // whose two diagonals are split with a small gap (slight notch at the
  // crossing point). We render the X as a stack of two rotated bars so the
  // characteristic split is preserved at any size.
  const fontSize = 'clamp(36px, 11vw, 60px)';
  return (
    <div
      className="flex items-center justify-center"
      style={{
        gap: 'clamp(10px, 2.6vw, 16px)',
        fontFamily: 'var(--font-cinzel)',
        fontWeight: 900,
        fontSize,
        lineHeight: 1,
      }}
      aria-label="KRONOX"
    >
      <span
        style={{
          color: '#f1f4ff',
          // Wider tracking matches the open, premium spacing in the crop.
          letterSpacing: '0.34em',
          // Compensate for trailing tracking so the gold X sits closer to "O".
          paddingRight: '0.34em',
          textShadow: '0 2px 12px rgba(0,0,0,0.55)',
        }}
      >
        KRONO
      </span>
      <KronoxSplitX size={fontSize} />
    </div>
  );
}

/**
 * Gold "X" composed of two diagonal bars with a small split at the centre,
 * matching the reference logo crop. `size` mirrors the wordmark font-size
 * so the X scales with the rest of the logotype on every viewport.
 */
function KronoxSplitX({ size }) {
  return (
    <span
      aria-hidden="true"
      style={{
        position: 'relative',
        display: 'inline-block',
        width: `calc(${size} * 0.78)`,
        height: size,
        // Subtle warm glow like the rest of the logo.
        filter: 'drop-shadow(0 0 8px rgba(250,204,21,0.55))',
      }}
    >
      {/* Top-left → bottom-right diagonal, stopped before the crossing. */}
      <span
        style={{
          position: 'absolute',
          top: '6%',
          left: 0,
          width: '46%',
          height: '14%',
          background: '#facc15',
          transformOrigin: '0% 50%',
          transform: 'rotate(54deg)',
          borderRadius: '2px',
        }}
      />
      {/* Bottom-left → top-right diagonal (mirrored, also stopped). */}
      <span
        style={{
          position: 'absolute',
          bottom: '6%',
          left: 0,
          width: '46%',
          height: '14%',
          background: '#facc15',
          transformOrigin: '0% 50%',
          transform: 'rotate(-54deg)',
          borderRadius: '2px',
        }}
      />
      {/* Top-right → bottom-left diagonal (right half). */}
      <span
        style={{
          position: 'absolute',
          top: '6%',
          right: 0,
          width: '46%',
          height: '14%',
          background: '#facc15',
          transformOrigin: '100% 50%',
          transform: 'rotate(-54deg)',
          borderRadius: '2px',
        }}
      />
      <span
        style={{
          position: 'absolute',
          bottom: '6%',
          right: 0,
          width: '46%',
          height: '14%',
          background: '#facc15',
          transformOrigin: '100% 50%',
          transform: 'rotate(54deg)',
          borderRadius: '2px',
        }}
      />
    </span>
  );
}

/**
 * Yellow diamond accent below the wordmark, replicating the reference's
 * thin underline + small rotated yellow square divider.
 */
function KronoxDivider() {
  return (
    <div
      className="mt-3 flex items-center justify-center"
      style={{ gap: 'clamp(6px, 2vw, 10px)' }}
      aria-hidden="true"
    >
      <span
        style={{
          display: 'block',
          height: 1.5,
          width: 'clamp(28px, 9vw, 48px)',
          background: 'linear-gradient(90deg, transparent, #facc15 60%, transparent)',
          opacity: 0.85,
        }}
      />
      <span
        style={{
          display: 'block',
          width: 'clamp(7px, 2vw, 10px)',
          height: 'clamp(7px, 2vw, 10px)',
          background: '#facc15',
          transform: 'rotate(45deg)',
          boxShadow: '0 0 8px rgba(250,204,21,0.65)',
        }}
      />
      <span
        style={{
          display: 'block',
          height: 1.5,
          width: 'clamp(28px, 9vw, 48px)',
          background: 'linear-gradient(90deg, transparent, #facc15 60%, transparent)',
          opacity: 0.85,
        }}
      />
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────── */
/*  CTA button                                                         */
/* ─────────────────────────────────────────────────────────────────── */

/**
 * Yellow main CTA matching the reference:
 *   [icon] ───  [label]                                            >
 *
 * - Solid yellow gradient fill, deep-navy text/icon for contrast.
 * - Internal vertical divider after the icon (as in the mock).
 * - Right chevron arrow.
 * - Whole row is one tap target; whileTap delivers a tactile press.
 * - clamp() sizing keeps the same look on small phones and on desktop.
 */
function HomeCTA({ icon: Icon, label, onClick, ariaLabel }) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileTap={{ y: 2, scale: 0.985 }}
      transition={{ type: 'spring', stiffness: 620, damping: 26, mass: 0.7 }}
      className="relative flex w-full items-center font-inter text-amber-950"
      style={{
        appearance: 'none',
        height: 'clamp(56px, 14.5vw, 70px)',
        padding: '0 1rem 0 1.1rem',
        borderRadius: '14px',
        background: 'linear-gradient(180deg, #ffd84a 0%, #f5c400 55%, #e0ad00 100%)',
        boxShadow:
          'inset 0 1px 0 rgba(255,255,255,0.55), inset 0 -3px 0 rgba(120,75,0,0.35), 0 8px 22px rgba(0,0,0,0.45)',
        color: '#1a1003',
        // Lighter weight + tighter tracking per reference (cleaner, less heavy).
        fontWeight: 600,
        letterSpacing: '0.04em',
        touchAction: 'manipulation',
      }}
      aria-label={ariaLabel}
    >
      {/* Left icon */}
      <Icon
        className="shrink-0"
        style={{
          width: 'clamp(22px, 6vw, 26px)',
          height: 'clamp(22px, 6vw, 26px)',
          color: '#1a1003',
        }}
        strokeWidth={2.4}
      />

      {/* Vertical divider */}
      <span
        aria-hidden="true"
        className="mx-3 shrink-0"
        style={{
          width: 1.5,
          height: '55%',
          background: 'rgba(26,16,3,0.45)',
          borderRadius: 1,
        }}
      />

      {/* Label — Inter semibold + slight tracking to match the reference. */}
      <span
        className="flex-1 text-left truncate"
        style={{
          fontSize: 'clamp(13px, 3.8vw, 15px)',
          letterSpacing: '0.03em',
          fontWeight: 600,
        }}
      >
        {label}
      </span>

      {/* Right chevron */}
      <ChevronRight
        className="shrink-0"
        style={{
          width: 'clamp(20px, 5vw, 24px)',
          height: 'clamp(20px, 5vw, 24px)',
          color: '#1a1003',
        }}
        strokeWidth={2.6}
      />
    </motion.button>
  );
}
