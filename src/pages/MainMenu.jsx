import React, { useEffect, useMemo, useState } from 'react';
// useMemo is used below to compute the header Puan/Elmas stats payload
// without recomputing on every render.
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ChevronRight } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { sounds } from '@/lib/gameSounds';
import ScreenHeader from '@/components/layout/ScreenHeader';
// Codex146 — Header Puan uses the shared visible Kronox score helper so
// Online win/loss deltas are reflected in the top bar after persistence.
// Elmas still uses the real/placeholder helper Leaderboard uses.
import { getKronoxVisibleScore } from '@/lib/kronoxScore';
import { getLeaderboardDiamondValue } from '@/lib/leaderboard';

// Note: a remote logo URL constant previously lived here but was never
// rendered. It has been removed so the "no_remote_visual_assets_new_screens"
// contract stays honest — the home screen relies only on local
// /assets/ui/* fantasy assets.
const BACKGROUND_ASSET = '/assets/ui/Kronox_Home_Fantasy_background.webp';
const WIDE_STAGE_QUERY = '(min-aspect-ratio: 9 / 16)';

const HOME_BUTTON_ASSETS = {
  online: {
    ariaLabel: 'Online Kapışma',
    normal: '/assets/ui/Kronox_Home_Button_Online.png',
    pressed: '/assets/ui/Kronox_Home_Button_Online_Pressed.png',
  },
  solo: {
    ariaLabel: 'Solo Meydan Okuma',
    normal: '/assets/ui/Kronox_Home_Button_Solo.png',
    pressed: '/assets/ui/Kronox_Home_Button_Solo_Pressed.png',
  },
};

const getIsWideStage = () => (
  typeof window !== 'undefined'
    ? window.matchMedia(WIDE_STAGE_QUERY).matches
    : false
);

function HomeImageButton({ type, onClick }) {
  const [pressed, setPressed] = useState(false);
  const button = HOME_BUTTON_ASSETS[type];

  const releasePress = () => setPressed(false);
  const pressButton = () => setPressed(true);

  const handleKeyDown = (event) => {
    if (event.key === ' ' || event.key === 'Enter') pressButton();
  };

  const handleKeyUp = (event) => {
    if (event.key === ' ' || event.key === 'Enter') releasePress();
  };

  return (
    <motion.button
      type="button"
      onClick={onClick}
      onPointerDown={pressButton}
      onPointerUp={releasePress}
      onPointerCancel={releasePress}
      onPointerLeave={releasePress}
      onBlur={releasePress}
      onKeyDown={handleKeyDown}
      onKeyUp={handleKeyUp}
      whileTap={{ y: 4, scale: 0.985 }}
      transition={{ type: 'spring', stiffness: 660, damping: 26, mass: 0.7 }}
      className="relative block h-full w-full border-0 bg-transparent p-0 focus-visible:outline-none"
      style={{
        appearance: 'none',
        touchAction: 'manipulation',
        transformOrigin: '50% 55%',
        lineHeight: 0,
      }}
      aria-label={button.ariaLabel}
    >
      <img
        src={pressed ? button.pressed : button.normal}
        alt=""
        draggable={false}
        className="pointer-events-none h-full w-full select-none object-contain"
        style={{ display: 'block' }}
      />
    </motion.button>
  );
}

export default function MainMenu() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [isWideStage, setIsWideStage] = useState(getIsWideStage);

  useEffect(() => {
    let cancelled = false;
    base44.auth.me()
      .then((u) => {
        if (cancelled) return;
        setUser(u || null);
      })
      .catch(() => {
        if (!cancelled) setUser(null);
      });
    return () => { cancelled = true; };
  }, []);

  // Codex146 — Stats payload for the top bar. Puan = visible Kronox Puan
  // (Solo best-score total + Online persisted score); Elmas = real economy
  // field if present, otherwise a safe 0 placeholder.
  const headerStats = useMemo(() => {
    return {
      score: getKronoxVisibleScore(user),
      diamonds: getLeaderboardDiamondValue(user),
    };
  }, [user]);

  useEffect(() => {
    const media = window.matchMedia(WIDE_STAGE_QUERY);
    const updateStageMode = () => setIsWideStage(media.matches);
    updateStageMode();
    media.addEventListener?.('change', updateStageMode);
    return () => media.removeEventListener?.('change', updateStageMode);
  }, []);

  const handleSolo = () => {
    sounds.tap();
    navigate('/solo');
  };

  const handleOnline = () => {
    sounds.tap();
    if (!user) base44.auth.redirectToLogin('/');
    else navigate('/lobby');
  };

  const handleLogin = () => {
    sounds.tap();
    base44.auth.redirectToLogin('/');
  };

  const stageStyle = isWideStage
    ? {
        width: 'min(100dvw, 56.25dvh)',
        height: 'min(100dvh, 177.7778dvw)',
      }
    : {
        width: 'max(100dvw, 56.25dvh)',
        height: 'max(100dvh, 177.7778dvw)',
      };

  return (
    <main
      className="fixed inset-0 w-full overflow-hidden bg-black text-white"
      style={{
        width: '100vw',
        minHeight: '100dvh',
        height: '100dvh',
        maxHeight: '100dvh',
        overflow: 'hidden',
        overscrollBehavior: 'none',
        overscrollBehaviorY: 'none',
        touchAction: 'manipulation',
        userSelect: 'none',
        contain: 'layout paint size',
      }}
    >
      {/* Codex118 — Home top bar shows Puan + Elmas only.
          • Title "Kronox" removed (logo lives in the immersive background).
          • Profile avatar hidden on Home (showProfile={false}).
          • Stats are centered and never overflow on small screens. */}
      <ScreenHeader
        user={user}
        headerStats={headerStats}
        showProfile={false}
      />
      <div
        className="absolute left-1/2 top-1/2 z-10"
        style={{
          ...stageStyle,
          aspectRatio: '1080 / 1920',
          transform: 'translate(-50%, -50%)',
          overflow: 'hidden',
          overscrollBehavior: 'none',
          overscrollBehaviorY: 'none',
          pointerEvents: 'none',
        }}
      >
        <img
          src={BACKGROUND_ASSET}
          alt=""
          draggable={false}
          className="pointer-events-none absolute inset-0 z-0 h-full w-full object-cover"
          style={{
            objectPosition: 'center center',
            userSelect: 'none',
          }}
        />

        <div
          className="absolute z-20 pointer-events-auto"
          style={{
            left: '9.7%',
            top: '63.4%',
            width: '80.6%',
            height: '10.7%',
          }}
        >
          <HomeImageButton type="online" onClick={handleOnline} />
        </div>

        <div
          className="absolute z-20 pointer-events-auto"
          style={{
            left: '9.7%',
            top: '76.7%',
            width: '80.6%',
            height: '10.7%',
          }}
        >
          <HomeImageButton type="solo" onClick={handleSolo} />
        </div>

        {/* Codex102 — Bottom ProfileBar removed. Avatar/profile entry now
            lives in the standardized ScreenHeader (top-right), and the
            primary navigation lives in the fixed BottomNav. A small login
            CTA is still shown here for guests so they can sign in without
            leaving home. The CTA sits ABOVE the bottom nav. */}
        {!user && (
          <section
            className="absolute z-20 flex items-center justify-center pointer-events-auto"
            style={{
              left: '4.6%',
              right: '4.6%',
              bottom: 'calc(4.25rem + env(safe-area-inset-bottom))',
            }}
          >
            <button
              type="button"
              onClick={handleLogin}
              className="flex items-center gap-2 rounded-full px-4 py-2 font-inter text-[12px] font-black text-amber-100"
              style={{
                background: 'linear-gradient(180deg, rgba(20,30,58,0.92), rgba(4,8,22,0.96))',
                boxShadow: 'inset 0 0 0 1px rgba(250,204,21,0.55), 0 0 12px rgba(250,204,21,0.30)',
              }}
              aria-label="Giriş yap veya kayıt ol"
            >
              Giriş yap veya kayıt ol <ChevronRight className="h-4 w-4" />
            </button>
          </section>
        )}
      </div>
    </main>
  );
}