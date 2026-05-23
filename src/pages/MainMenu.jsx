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
    primarySize: 'clamp(22px, 9.6cqw, 78px)',
    secondarySize: 'clamp(18px, 7.4cqw, 62px)',
    textTop: '21%',
    textBottom: '20%',
    textGap: '2%',
    glow: 'rgba(34, 211, 238, 0.72)',
  },
  solo: {
    label: ['SOLO', 'MEYDAN OKUMA'],
    ariaLabel: 'SOLO MEYDAN OKUMA',
    emblem: 'trophy',
    primarySize: 'clamp(22px, 9.6cqw, 78px)',
    secondarySize: 'clamp(14px, 5.6cqw, 48px)',
    textTop: '20%',
    textBottom: '20%',
    textGap: '3%',
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
          <linearGradient id={`${id}-gold-frame`} x1="0%" x2="0%" y1="0%" y2="100%">
            <stop offset="0%" stopColor="#fff7c2" />
            <stop offset="14%" stopColor="#ffe27a" />
            <stop offset="38%" stopColor="#d9991f" />
            <stop offset="58%" stopColor="#7a410a" />
            <stop offset="78%" stopColor="#e3aa30" />
            <stop offset="100%" stopColor="#3a1c04" />
          </linearGradient>
          <linearGradient id={`${id}-gold-rim`} x1="0%" x2="0%" y1="0%" y2="100%">
            <stop offset="0%" stopColor="#fff2a8" />
            <stop offset="50%" stopColor="#f0b840" />
            <stop offset="100%" stopColor="#6b3508" />
          </linearGradient>
          <linearGradient id={`${id}-gold-cap`} x1="0%" x2="0%" y1="0%" y2="100%">
            <stop offset="0%" stopColor="#fff5b4" />
            <stop offset="38%" stopColor="#f4b430" />
            <stop offset="76%" stopColor="#9a5210" />
            <stop offset="100%" stopColor="#3d1c04" />
          </linearGradient>
          <linearGradient id={`${id}-plate`} x1="0%" x2="0%" y1="0%" y2="100%">
            <stop offset="0%" stopColor="#1a2f5e" />
            <stop offset="40%" stopColor="#0b1b40" />
            <stop offset="100%" stopColor="#04081c" />
          </linearGradient>
          <radialGradient id={`${id}-plate-glow`} cx="50%" cy="18%" r="78%">
            <stop offset="0%" stopColor="#2f6dff" stopOpacity="0.62" />
            <stop offset="44%" stopColor="#0a1c45" stopOpacity="0.38" />
            <stop offset="100%" stopColor="#02050f" stopOpacity="0.06" />
          </radialGradient>
          <radialGradient id={`${id}-gem`} cx="48%" cy="32%" r="72%">
            <stop offset="0%" stopColor="#f3fdff" />
            <stop offset="28%" stopColor="#5fdcff" />
            <stop offset="68%" stopColor="#1c4ed8" />
            <stop offset="100%" stopColor="#070f3a" />
          </radialGradient>
          <linearGradient id={`${id}-highlight`} x1="0%" x2="0%" y1="0%" y2="100%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
          </linearGradient>
          <filter id={`${id}-soft-blur`} x="-10%" y="-10%" width="120%" height="120%">
            <feGaussianBlur stdDeviation="2" />
          </filter>
        </defs>

        {/* drop shadow */}
        <path d="M58 36 H154 L178 12 H722 L746 36 H842 L890 80 V142 L842 186 H746 L722 210 H178 L154 186 H58 L10 142 V80 Z" fill="rgba(0,0,0,0.55)" transform="translate(0 10)" filter={`url(#${id}-soft-blur)`} />

        {/* outer gold frame */}
        <path d="M50 25 H150 L174 4 H726 L750 25 H850 L896 70 V144 L850 189 H750 L726 210 H174 L150 189 H50 L4 144 V70 Z" fill={`url(#${id}-gold-frame)`} />

        {/* inner gold ridge highlight */}
        <path d="M50 25 H150 L174 4 H726 L750 25 H850 L896 70 V144 L850 189 H750 L726 210 H174 L150 189 H50 L4 144 V70 Z" fill="none" stroke="#fff4be" strokeWidth="2.4" opacity="0.85" />

        {/* dark groove between gold and plate */}
        <path d="M76 44 H170 L192 24 H708 L730 44 H824 L868 82 V132 L824 170 H730 L708 190 H192 L170 170 H76 L32 132 V82 Z" fill="#3a1f05" opacity="0.95" />

        {/* dark plate base */}
        <path d="M92 50 H802 L842 84 V130 L802 164 H92 L52 130 V84 Z" fill={`url(#${id}-plate)`} />

        {/* portal glow inside plate */}
        <path d="M92 50 H802 L842 84 V130 L802 164 H92 L52 130 V84 Z" fill={`url(#${id}-plate-glow)`} />

        {/* inner plate stroke */}
        <path d="M92 50 H802 L842 84 V130 L802 164 H92 L52 130 V84 Z" fill="none" stroke="#050a1b" strokeWidth="3.5" opacity="0.9" />

        {/* plate top sheen */}
        <path d="M104 56 H794 L828 86 H72 Z" fill={`url(#${id}-highlight)`} opacity="0.45" />

        {/* plate inner double-line frame */}
        <path d="M106 62 H788 L824 90 V124 L788 152 H106 L74 124 V90 Z" fill="none" stroke="#0a1936" strokeWidth="4.5" opacity="0.7" />
        <path d="M114 70 H780 L816 92 V122 L780 144 H114 L82 122 V92 Z" fill="none" stroke="#5ec1ff" strokeWidth="0.9" opacity="0.45" />

        {/* under-plate blue glow arc */}
        <path d="M40 150 C180 192 720 192 860 150" fill="none" stroke="#1d8eff" strokeWidth="4.5" opacity="0.42" filter={`url(#${id}-soft-blur)`} />

        {/* left gold side cap */}
        <path d="M30 84 L76 42 H140 L108 76 V138 L140 172 H76 L30 130 Z" fill={`url(#${id}-gold-cap)`} />
        <path d="M30 84 L76 42 H140 L108 76 V138 L140 172 H76 L30 130 Z" fill="none" stroke="#fff4be" strokeWidth="1.8" opacity="0.75" />
        <path d="M58 80 L92 53 H128" fill="none" stroke="#fff2ae" strokeWidth="3.2" strokeLinecap="round" opacity="0.72" />
        <path d="M58 134 L92 161 H128" fill="none" stroke="#3a1c04" strokeWidth="3" strokeLinecap="round" opacity="0.65" />

        {/* right gold side cap */}
        <path d="M870 84 L824 42 H760 L792 76 V138 L760 172 H824 L870 130 Z" fill={`url(#${id}-gold-cap)`} />
        <path d="M870 84 L824 42 H760 L792 76 V138 L760 172 H824 L870 130 Z" fill="none" stroke="#fff4be" strokeWidth="1.8" opacity="0.75" />
        <path d="M842 80 L808 53 H772" fill="none" stroke="#fff2ae" strokeWidth="3.2" strokeLinecap="round" opacity="0.72" />
        <path d="M842 134 L808 161 H772" fill="none" stroke="#3a1c04" strokeWidth="3" strokeLinecap="round" opacity="0.65" />

        {/* top gem */}
        <path d="M450 0 L484 32 L450 64 L416 32 Z" fill={`url(#${id}-gold-cap)`} stroke="#4d2506" strokeWidth="3.5" />
        <path d="M450 14 L468 32 L450 50 L432 32 Z" fill={`url(#${id}-gem)`} stroke="#bdf0ff" strokeWidth="1.6" />
        <path d="M444 22 L450 18 L456 22" fill="none" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" opacity="0.85" />

        {/* bottom gem */}
        <path d="M450 150 L484 182 L450 214 L416 182 Z" fill={`url(#${id}-gold-cap)`} stroke="#4d2506" strokeWidth="3.5" />
        <path d="M450 164 L468 182 L450 200 L432 182 Z" fill={`url(#${id}-gem)`} stroke="#bdf0ff" strokeWidth="1.6" />
        <path d="M444 172 L450 168 L456 172" fill="none" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" opacity="0.85" />

        {/* rivet dots */}
        <circle cx="100" cy="58" r="3" fill="#fff1ae" opacity="0.85" />
        <circle cx="100" cy="156" r="3" fill="#fff1ae" opacity="0.85" />
        <circle cx="800" cy="58" r="3" fill="#fff1ae" opacity="0.85" />
        <circle cx="800" cy="156" r="3" fill="#fff1ae" opacity="0.85" />
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
          left: '26%',
          right: '8%',
          top: config.textTop,
          bottom: config.textBottom,
          gap: config.textGap,
          color: '#ffd24a',
          fontFamily: 'Bangers, Impact, sans-serif',
          letterSpacing: '0.5px',
          textShadow: '0 1px 0 #fff7c2, 0 2px 0 #5b2b06, 0 4px 5px rgba(0,0,0,0.78), 0 0 12px rgba(255,210,74,0.4)',
          WebkitTextStroke: '0.6px rgba(58,28,4,0.95)',
        }}
      >
        <span style={{ display: 'block', fontSize: config.primarySize, lineHeight: 0.82 }}>
          {config.label[0]}
        </span>
        <span style={{ display: 'block', fontSize: config.secondarySize, lineHeight: 0.9 }}>
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

<div
          className="absolute z-20 pointer-events-auto"
          style={{
            left: '9.7%',
            top: '59.5%',
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
            top: '72.8%',
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