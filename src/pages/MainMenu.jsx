import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ChevronRight, LogOut, Settings, UserRound } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { sounds } from '@/lib/gameSounds';

const LOGO_URL = 'https://media.base44.com/images/public/69e753d5ab4c08a7c4287c25/49fc6f458_kronoxnobckgrnd.png';
const BACKGROUND_ASSET = '/assets/ui/Kronox_Home_Fantasy_Background.png';
const WIDE_STAGE_QUERY = '(min-aspect-ratio: 9 / 16)';

const HOME_BUTTONS = {
  online: {
    label: ['ONLINE', 'KAPIŞMA'],
    ariaLabel: 'ONLINE KAPIŞMA',
    emblem: 'swords',
    primarySize: '12.9cqw',
    secondarySize: '9.4cqw',
    textTop: '18%',
    textBottom: '18%',
    glow: 'rgba(34, 211, 238, 0.72)',
  },
  solo: {
    label: ['SOLO', 'MEYDAN OKUMA'],
    ariaLabel: 'SOLO MEYDAN OKUMA',
    emblem: 'trophy',
    primarySize: '12.8cqw',
    secondarySize: '7.35cqw',
    textTop: '17%',
    textBottom: '18%',
    glow: 'rgba(56, 189, 248, 0.7)',
  },
};

const getIsWideStage = () => (
  typeof window !== 'undefined'
    ? window.matchMedia(WIDE_STAGE_QUERY).matches
    : false
);

function EmblemSymbol({ type }) {
  if (type === 'trophy') {
    return (
      <svg className="h-full w-full" viewBox="0 0 120 120" aria-hidden="true">
        <path d="M33 35 H87 V51 C87 70 76 82 65 85 V94 H80 V104 H40 V94 H55 V85 C44 82 33 70 33 51 Z" fill="#f9b72e" stroke="#5b3008" strokeWidth="5" />
        <path d="M33 43 H18 C19 62 29 72 43 74" fill="none" stroke="#f9b72e" strokeWidth="7" strokeLinecap="round" />
        <path d="M87 43 H102 C101 62 91 72 77 74" fill="none" stroke="#f9b72e" strokeWidth="7" strokeLinecap="round" />
        <path d="M44 42 H76 V51 C76 64 69 72 60 74 C51 72 44 64 44 51 Z" fill="#ffd86f" opacity="0.74" />
        <path d="M60 43 L65 53 L76 55 L68 63 L70 75 L60 69 L50 75 L52 63 L44 55 L55 53 Z" fill="#fff4bf" stroke="#87530e" strokeWidth="3" />
        <path d="M45 104 H75 L84 114 H36 Z" fill="#7a4210" stroke="#f6c45b" strokeWidth="4" />
      </svg>
    );
  }

  return (
    <svg className="h-full w-full" viewBox="0 0 120 120" aria-hidden="true">
      <path d="M60 16 L94 29 V55 C94 78 78 96 60 104 C42 96 26 78 26 55 V29 Z" fill="#153767" stroke="#f7c65a" strokeWidth="6" />
      <path d="M60 27 L82 36 V55 C82 70 73 83 60 90 C47 83 38 70 38 55 V36 Z" fill="#1d4ed8" opacity="0.55" />
      <path d="M28 87 L86 29" stroke="#d7e6ff" strokeWidth="8" strokeLinecap="round" />
      <path d="M34 93 L92 35" stroke="#65380d" strokeWidth="3" strokeLinecap="round" />
      <path d="M92 87 L34 29" stroke="#d7e6ff" strokeWidth="8" strokeLinecap="round" />
      <path d="M86 93 L28 35" stroke="#65380d" strokeWidth="3" strokeLinecap="round" />
      <path d="M22 93 L37 78 L44 85 L29 100 Z M98 93 L83 78 L76 85 L91 100 Z" fill="#f7c65a" stroke="#65380d" strokeWidth="3" />
      <path d="M26 25 L34 17 L43 32 L33 39 Z M94 25 L86 17 L77 32 L87 39 Z" fill="#f7c65a" stroke="#65380d" strokeWidth="3" />
    </svg>
  );
}

function FantasyPlaqueButton({ type, onClick }) {
  const config = HOME_BUTTONS[type];
  const id = `home-plaque-${type}`;

  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={{ y: -2 }}
      whileTap={{
        scaleX: 0.986,
        scaleY: 0.94,
        y: 5,
        filter: 'drop-shadow(0 8px 7px rgba(0,0,0,0.72)) drop-shadow(0 0 25px rgba(34,211,238,0.72))',
      }}
      transition={{ type: 'spring', stiffness: 650, damping: 24, mass: 0.72 }}
      className="group relative block h-full w-full border-0 bg-transparent p-0 text-center"
      style={{
        containerType: 'size',
        appearance: 'none',
        touchAction: 'manipulation',
        transformOrigin: '50% 54%',
        filter: 'drop-shadow(0 17px 15px rgba(0,0,0,0.66)) drop-shadow(0 0 18px rgba(34,211,238,0.46))',
      }}
      aria-label={config.ariaLabel}
    >
      <span
        className="pointer-events-none absolute left-[5%] right-[5%] top-[63%] h-[30%] rounded-full"
        style={{
          background: 'radial-gradient(ellipse at center, rgba(14, 165, 233, 0.66), rgba(37, 99, 235, 0.22) 46%, transparent 72%)',
          filter: 'blur(4px)',
        }}
        aria-hidden="true"
      />

      <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 900 214" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient id={`${id}-gold`} x1="0%" x2="100%" y1="0%" y2="100%">
            <stop offset="0%" stopColor="#fff1a8" />
            <stop offset="21%" stopColor="#f8c65b" />
            <stop offset="50%" stopColor="#a85c16" />
            <stop offset="74%" stopColor="#ffd873" />
            <stop offset="100%" stopColor="#5f310c" />
          </linearGradient>
          <linearGradient id={`${id}-gold-hot`} x1="0%" x2="0%" y1="0%" y2="100%">
            <stop offset="0%" stopColor="#fff4b8" />
            <stop offset="45%" stopColor="#f6b734" />
            <stop offset="100%" stopColor="#6d370a" />
          </linearGradient>
          <linearGradient id={`${id}-plate`} x1="0%" x2="100%" y1="0%" y2="100%">
            <stop offset="0%" stopColor="#213d72" />
            <stop offset="45%" stopColor="#102246" />
            <stop offset="100%" stopColor="#071021" />
          </linearGradient>
          <radialGradient id={`${id}-plate-glow`} cx="50%" cy="18%" r="84%">
            <stop offset="0%" stopColor="#2563eb" stopOpacity="0.64" />
            <stop offset="42%" stopColor="#0f2a59" stopOpacity="0.42" />
            <stop offset="100%" stopColor="#030817" stopOpacity="0.08" />
          </radialGradient>
          <radialGradient id={`${id}-gem`} cx="48%" cy="34%" r="70%">
            <stop offset="0%" stopColor="#e7fbff" />
            <stop offset="32%" stopColor="#38d5ff" />
            <stop offset="74%" stopColor="#1d4ed8" />
            <stop offset="100%" stopColor="#08205d" />
          </radialGradient>
        </defs>

        <path d="M58 32 H154 L178 8 H722 L746 32 H842 L890 76 V138 L842 182 H746 L722 206 H178 L154 182 H58 L10 138 V76 Z" fill="rgba(0,0,0,0.72)" transform="translate(0 8)" />
        <path d="M50 25 H150 L174 4 H726 L750 25 H850 L896 70 V144 L850 189 H750 L726 210 H174 L150 189 H50 L4 144 V70 Z" fill={`url(#${id}-gold)`} />
        <path d="M70 41 H166 L188 22 H712 L734 41 H830 L874 80 V134 L830 174 H734 L712 193 H188 L166 174 H70 L26 134 V80 Z" fill="#4a2709" opacity="0.9" />
        <path d="M88 48 H806 L844 82 V130 L806 164 H88 L52 130 V82 Z" fill={`url(#${id}-plate)`} />
        <path d="M88 48 H806 L844 82 V130 L806 164 H88 L52 130 V82 Z" fill={`url(#${id}-plate-glow)`} />
        <path d="M103 61 H792 L825 89 V123 L792 151 H103 L76 123 V89 Z" fill="none" stroke="#0b1731" strokeWidth="7" opacity="0.82" />
        <path d="M107 58 H790" stroke="#78d7ff" strokeWidth="3.6" strokeLinecap="round" opacity="0.7" />
        <path d="M110 157 H786" stroke="#0ea5e9" strokeWidth="3.4" strokeLinecap="round" opacity="0.58" />
        <path d="M34 84 L78 44 H133 L104 75 V139 L133 170 H78 L34 130 Z" fill={`url(#${id}-gold-hot)`} />
        <path d="M866 84 L822 44 H767 L796 75 V139 L767 170 H822 L866 130 Z" fill={`url(#${id}-gold-hot)`} />
        <path d="M63 80 L91 55 H124 M837 80 L809 55 H776 M63 134 L91 159 H124 M837 134 L809 159 H776" fill="none" stroke="#fff2ae" strokeWidth="4" strokeLinecap="round" opacity="0.72" />
        <path d="M450 5 L476 31 L450 57 L424 31 Z" fill={`url(#${id}-gold-hot)`} stroke="#4d2506" strokeWidth="5" />
        <path d="M450 18 L464 31 L450 45 L436 31 Z" fill={`url(#${id}-gem)`} stroke="#8befff" strokeWidth="2.4" />
        <path d="M450 157 L476 183 L450 209 L424 183 Z" fill={`url(#${id}-gold-hot)`} stroke="#4d2506" strokeWidth="5" />
        <path d="M450 170 L464 183 L450 197 L436 183 Z" fill={`url(#${id}-gem)`} stroke="#8befff" strokeWidth="2.4" />
        <path d="M24 145 C170 189 730 189 876 145" fill="none" stroke="#0ea5e9" strokeWidth="5" opacity="0.35" />
        <path d="M79 49 L125 49 M775 49 L821 49 M80 164 L126 164 M774 164 L820 164" stroke="#2d1606" strokeWidth="7" strokeLinecap="round" opacity="0.48" />
      </svg>

      <span
        className="pointer-events-none absolute z-20 flex items-center justify-center"
        style={{
          left: '6.7%',
          top: '17.4%',
          width: '16.4%',
          height: '64%',
        }}
        aria-hidden="true"
      >
        <span
          className="absolute inset-0"
          style={{
            borderRadius: '28%',
            background: 'linear-gradient(145deg, #fff0a3 0%, #d18a25 40%, #5a2c07 100%)',
            clipPath: 'polygon(14% 0, 86% 0, 100% 18%, 100% 82%, 86% 100%, 14% 100%, 0 82%, 0 18%)',
            boxShadow: 'inset 0 2px 0 rgba(255,255,255,0.55), inset 0 -9px 12px rgba(62,29,5,0.58), 0 0 13px rgba(56,189,248,0.58)',
          }}
        />
        <span
          className="absolute"
          style={{
            inset: '10%',
            clipPath: 'polygon(16% 0, 84% 0, 100% 20%, 100% 80%, 84% 100%, 16% 100%, 0 80%, 0 20%)',
            background: 'radial-gradient(circle at 50% 24%, rgba(56,189,248,0.44), transparent 52%), linear-gradient(180deg, #102b58, #061225)',
            boxShadow: 'inset 0 0 0 2px rgba(4,10,24,0.86), inset 0 0 18px rgba(14,165,233,0.34)',
          }}
        />
        <span
          className="relative z-10 h-[72%] w-[72%]"
          style={{ filter: 'drop-shadow(0 2px 2px rgba(0,0,0,0.75))' }}
        >
          <EmblemSymbol type={config.emblem} />
        </span>
      </span>

      <span
        className="pointer-events-none absolute z-20 flex flex-col items-center justify-center"
        style={{
          left: '27%',
          right: '7.2%',
          top: config.textTop,
          bottom: config.textBottom,
          color: '#ffc942',
          fontFamily: 'Bangers, Impact, sans-serif',
          letterSpacing: 0,
          textShadow: '0 2px 0 #5b2b06, 0 5px 4px rgba(0,0,0,0.72), 0 0 10px rgba(255,216,100,0.34)',
          WebkitTextStroke: '0.7px rgba(91,43,6,0.95)',
        }}
      >
        <span style={{ display: 'block', fontSize: config.primarySize, lineHeight: 0.76 }}>
          {config.label[0]}
        </span>
        <span style={{ display: 'block', fontSize: config.secondarySize, lineHeight: 0.86 }}>
          {config.label[1]}
        </span>
      </span>

      <span
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-150 group-active:opacity-100"
        style={{
          clipPath: 'polygon(6% 13%, 94% 13%, 99% 38%, 99% 65%, 94% 88%, 6% 88%, 1% 65%, 1% 38%)',
          background: 'linear-gradient(180deg, rgba(255,255,255,0.18), rgba(56,189,248,0.18) 48%, rgba(0,0,0,0.18))',
          boxShadow: `inset 0 0 42px ${config.glow}`,
        }}
        aria-hidden="true"
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

  const handleSettings = () => {
    sounds.tap();
    navigate('/settings');
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

        <header
          className="pointer-events-none absolute z-10 flex justify-center"
          style={{
            left: '50%',
            top: 'calc(0.45rem + env(safe-area-inset-top))',
            width: '60%',
            transform: 'translateX(-50%)',
          }}
        >
          <img
            src={LOGO_URL}
            alt="Kronox"
            draggable={false}
            className="object-contain"
            style={{
              width: '100%',
              height: 'auto',
              filter: 'drop-shadow(0 0 14px rgba(250,204,21,0.86))',
            }}
          />
        </header>

        <div
          className="absolute z-20 pointer-events-auto"
          style={{
            left: '9.7%',
            top: '55.2%',
            width: '80.6%',
            height: '10.7%',
          }}
        >
          <FantasyPlaqueButton type="online" onClick={handleOnline} />
        </div>

        <div
          className="absolute z-20 pointer-events-auto"
          style={{
            left: '9.7%',
            top: '68.8%',
            width: '80.6%',
            height: '10.7%',
          }}
        >
          <FantasyPlaqueButton type="solo" onClick={handleSolo} />
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
            onClick={handleSettings}
            whileTap={{ scale: 0.92, rotate: -8 }}
            transition={{ type: 'spring', stiffness: 520, damping: 24 }}
            className="flex h-[56px] w-[56px] shrink-0 items-center justify-center rounded-full border border-amber-300/70 bg-black/76 text-amber-200"
            style={{
              background: 'linear-gradient(180deg, rgba(20,30,58,0.92), rgba(4,8,22,0.96))',
              boxShadow: '0 0 20px rgba(250,204,21,0.46), 0 0 24px rgba(59,130,246,0.28), 0 10px 22px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,236,140,0.32), inset 0 -6px 10px rgba(0,0,0,0.4)',
            }}
            aria-label="Ayarlar"
          >
            <Settings className="h-7 w-7" />
          </motion.button>
        </section>
      </div>
    </main>
  );
}
