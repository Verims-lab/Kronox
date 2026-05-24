import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ChevronRight, LogOut, UserRound } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { sounds } from '@/lib/gameSounds';

// Note: a remote logo URL constant previously lived here but was never
// rendered. It has been removed so the "no_remote_visual_assets_new_screens"
// contract stays honest — the home screen relies only on local
// /assets/ui/* fantasy assets.
const BACKGROUND_ASSET = '/assets/ui/Kronox_Home_Fantasy_Background.png';
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

function ProfileBar({ user, onLogin, onLogout }) {
  return (
    <div
      className="flex min-w-0 flex-1 items-center gap-3 rounded-full border border-amber-300/30 bg-black/72 px-3 py-2"
      style={{
        minHeight: 56,
        background: 'linear-gradient(180deg, rgba(20,30,58,0.86), rgba(4,8,22,0.94))',
        boxShadow: 'inset 0 0 18px rgba(255,255,255,0.06), inset 0 1px 0 rgba(255,236,140,0.18), 0 0 20px rgba(59,130,246,0.22), 0 10px 22px rgba(0,0,0,0.42)',
      }}
    >
      <span
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
        style={{
          background: 'radial-gradient(circle at 35% 28%, #ffe066, #b97a06 70%)',
          boxShadow: '0 0 18px rgba(250,204,21,0.62), inset 0 1px 0 rgba(255,255,255,0.4), inset 0 -4px 6px rgba(140,80,8,0.55)',
        }}
      >
        <UserRound className="h-6 w-6 text-amber-950" strokeWidth={2.6} />
      </span>
      {user ? (
        <>
          <div className="min-w-0 flex-1">
            <p className="truncate font-inter text-[14px] font-black text-white">{user.full_name || user.email}</p>
            <p className="font-inter text-[11px] font-black text-primary">Hazır</p>
          </div>
          <button
            type="button"
            onClick={onLogout}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white/58"
            aria-label="Hesaptan çıkış yap"
          >
            <LogOut className="h-5 w-5" />
          </button>
        </>
      ) : (
        <button type="button" onClick={onLogin} className="min-w-0 flex-1 text-left" aria-label="Giriş yap veya kayıt ol">
          <span className="block truncate font-inter text-[14px] font-black text-white">Misafir Oyuncu</span>
          <span className="flex items-center gap-1 font-inter text-[11px] font-black text-primary">
            Giriş yap veya kayıt ol <ChevronRight className="h-4 w-4" />
          </span>
        </button>
      )}
    </div>
  );
}

export default function MainMenu() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [isWideStage, setIsWideStage] = useState(getIsWideStage);

  useEffect(() => {
    base44.auth.me().then((u) => setUser(u || null)).catch(() => setUser(null));
  }, []);

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

  const handleLogout = () => {
    sounds.tap();
    base44.auth.logout('/');
  };

  const handleProfile = () => {
    sounds.tap();
    navigate('/profile');
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
            top: '61.6%',
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
            top: '74.9%',
            width: '80.6%',
            height: '10.7%',
          }}
        >
          <HomeImageButton type="solo" onClick={handleSolo} />
        </div>

        <section
          className="absolute z-20 flex items-center gap-3 pointer-events-auto"
          style={{
            left: '4.6%',
            right: '4.6%',
            bottom: 'calc(0.75rem + env(safe-area-inset-bottom))',
          }}
        >
          <ProfileBar user={user} onLogin={handleLogin} onLogout={handleLogout} />
          <motion.button
            type="button"
            onClick={handleProfile}
            whileTap={{ scale: 0.92 }}
            transition={{ type: 'spring', stiffness: 520, damping: 24 }}
            className="flex h-[56px] w-[56px] shrink-0 items-center justify-center rounded-full border border-amber-300/70 bg-black/76 text-amber-200"
            style={{
              background: 'linear-gradient(180deg, rgba(20,30,58,0.92), rgba(4,8,22,0.96))',
              boxShadow: '0 0 20px rgba(250,204,21,0.46), 0 0 24px rgba(59,130,246,0.28), 0 10px 22px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,236,140,0.32), inset 0 -6px 10px rgba(0,0,0,0.4)',
            }}
            aria-label="Profil"
          >
            <UserRound className="h-7 w-7" strokeWidth={2.4} />
          </motion.button>
        </section>
      </div>
    </main>
  );
}