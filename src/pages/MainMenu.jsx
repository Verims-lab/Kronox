import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ChevronRight, Globe, LogOut, Settings, UserRound } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { sounds } from '@/lib/gameSounds';

const LOGO_URL = 'https://media.base44.com/images/public/69e753d5ab4c08a7c4287c25/49fc6f458_kronoxnobckgrnd.png';
const BACKGROUND_ASSET = '/assets/ui/home-background-full.webp';
const WIDE_STAGE_QUERY = '(min-aspect-ratio: 9 / 16)';

const HOME_BUTTONS = {
  solo: {
    label: ['SOLO', 'MEYDAN OKUMA'],
    labelAccent: '#7dd3fc',
    frame: '#f6c95b',
    frameDark: '#6d4515',
    energy: '#38bdf8',
    energySoft: 'rgba(56, 189, 248, 0.58)',
    stoneTop: '#1b376b',
    stoneMid: '#0c1b38',
    stoneLow: '#040713',
    portalA: '#0ea5e9',
    portalB: '#2563eb',
    portalC: '#8b5cf6',
  },
  online: {
    label: ['ONLINE', 'KAPIŞMA'],
    labelAccent: '#facc15',
    frame: '#ffd666',
    frameDark: '#7a4a12',
    energy: '#22d3ee',
    energySoft: 'rgba(34, 211, 238, 0.5)',
    stoneTop: '#263762',
    stoneMid: '#111a34',
    stoneLow: '#050712',
    portalA: '#22d3ee',
    portalB: '#1d4ed8',
    portalC: '#f59e0b',
  },
};

const getIsWideStage = () => (
  typeof window !== 'undefined'
    ? window.matchMedia(WIDE_STAGE_QUERY).matches
    : false
);

function PortalEmblem({ type, icon }) {
  const palette = HOME_BUTTONS[type];
  const solo = type === 'solo';
  const id = `home-${type}-portal`;
  const renderedIcon = React.isValidElement(icon)
    ? React.cloneElement(icon, {
        style: {
          ...(icon.props.style || {}),
          width: '54%',
          height: '54%',
        },
      })
    : icon;

  return (
    <span
      className="absolute left-1/2 z-20 flex -translate-x-1/2 items-center justify-center"
      style={{
        top: '7.5%',
        width: '67%',
        height: '34%',
      }}
      aria-hidden="true"
    >
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 150 92" preserveAspectRatio="none">
        <defs>
          <radialGradient id={`${id}-core`} cx="50%" cy="52%" r="56%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.9" />
            <stop offset="22%" stopColor={palette.portalA} stopOpacity="0.86" />
            <stop offset="58%" stopColor={palette.portalB} stopOpacity="0.62" />
            <stop offset="100%" stopColor={palette.stoneLow} stopOpacity="0" />
          </radialGradient>
          <linearGradient id={`${id}-stone`} x1="0%" x2="100%" y1="0%" y2="100%">
            <stop offset="0%" stopColor="#6d7485" />
            <stop offset="44%" stopColor="#2c3447" />
            <stop offset="100%" stopColor="#090c16" />
          </linearGradient>
          <linearGradient id={`${id}-gold`} x1="0%" x2="100%" y1="0%" y2="100%">
            <stop offset="0%" stopColor="#fff0a3" />
            <stop offset="46%" stopColor={palette.frame} />
            <stop offset="100%" stopColor={palette.frameDark} />
          </linearGradient>
        </defs>
        <ellipse cx="75" cy="48" rx="58" ry="30" fill={`url(#${id}-core)`} opacity="0.92" />
        <path
          d="M22 78 C16 59 22 38 39 25 C55 12 95 12 111 25 C128 38 134 59 128 78 L114 78 C120 60 115 44 103 34 C91 24 59 24 47 34 C35 44 30 60 36 78 Z"
          fill={`url(#${id}-stone)`}
          stroke={`url(#${id}-gold)`}
          strokeWidth="4.4"
        />
        <path
          d="M43 78 C38 63 41 49 51 39 C61 29 89 29 99 39 C109 49 112 63 107 78"
          fill="none"
          stroke={palette.energy}
          strokeWidth="4"
          strokeLinecap="round"
          opacity="0.92"
        />
        <path
          d="M29 76 H121 M49 24 L57 16 H93 L101 24"
          stroke="#fff3b8"
          strokeWidth="2.4"
          strokeLinecap="round"
          opacity="0.72"
        />
        <path
          d="M33 55 C53 41 97 41 117 55 M43 66 C58 57 92 57 107 66"
          fill="none"
          stroke="#e0f7ff"
          strokeWidth="1.5"
          strokeLinecap="round"
          opacity="0.56"
        />
        <path
          d="M21 80 H129 L120 91 H30 Z"
          fill={`url(#${id}-gold)`}
          opacity="0.95"
        />
        <path
          d="M37 82 H113"
          stroke="#2b1805"
          strokeWidth="3"
          strokeLinecap="round"
          opacity="0.46"
        />
        {!solo && (
          <path
            d="M75 9 L86 22 L80 36 H70 L64 22 Z"
            fill={`url(#${id}-gold)`}
            stroke="#4d2f0d"
            strokeWidth="2.2"
          />
        )}
      </svg>
      <span
        className="relative z-10 flex items-center justify-center"
        style={{
          width: '33%',
          aspectRatio: '1 / 1',
          color: solo ? '#e0f7ff' : '#fff3b8',
          background: [
            'radial-gradient(circle at 35% 24%, rgba(255,255,255,0.38), transparent 30%)',
            `linear-gradient(180deg, ${solo ? '#1d4ed8' : '#67430b'}, ${palette.stoneLow})`,
          ].join(', '),
          clipPath: 'polygon(20% 0, 80% 0, 100% 25%, 100% 75%, 80% 100%, 20% 100%, 0 75%, 0 25%)',
          boxShadow: [
            `0 0 18px ${palette.energySoft}`,
            `inset 0 0 0 2px ${palette.frame}`,
            'inset 0 1px 0 rgba(255,255,255,0.34)',
            'inset 0 -8px 12px rgba(0,0,0,0.45)',
          ].join(', '),
        }}
      >
        {renderedIcon}
      </span>
    </span>
  );
}

function HomeGameButton({ type, title, icon, onClick }) {
  const palette = HOME_BUTTONS[type];
  const solo = type === 'solo';

  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={{ y: -3 }}
      whileTap={{ scale: 0.94, y: 6 }}
      transition={{ type: 'spring', stiffness: 620, damping: 23 }}
      className="relative block h-full w-full overflow-visible border-0 bg-transparent p-0 text-center"
      style={{
        containerType: 'size',
        appearance: 'none',
        touchAction: 'manipulation',
        filter: solo
          ? 'drop-shadow(0 16px 18px rgba(0,0,0,0.66)) drop-shadow(0 0 18px rgba(34,211,238,0.42))'
          : 'drop-shadow(0 16px 18px rgba(0,0,0,0.66)) drop-shadow(0 0 18px rgba(250,204,21,0.38))',
      }}
      aria-label={title.replace(/\n/g, ' ')}
    >
      <span
        className="absolute inset-x-[5%] bottom-[-4%] h-[18%]"
        style={{
          background: 'rgba(0, 0, 0, 0.58)',
          borderRadius: '999px',
          filter: 'blur(4px)',
        }}
        aria-hidden="true"
      />

      <span
        className="absolute inset-0"
        style={{
          clipPath: 'polygon(10% 0, 90% 0, 100% 11%, 100% 89%, 90% 100%, 10% 100%, 0 89%, 0 11%)',
          background: [
            `linear-gradient(180deg, ${palette.frame} 0%, #fff1a8 13%, ${palette.frame} 24%, ${palette.frameDark} 100%)`,
            `radial-gradient(circle at 50% 0%, ${palette.energySoft}, transparent 54%)`,
          ].join(', '),
          boxShadow: [
            'inset 0 2px 0 rgba(255,255,255,0.48)',
            'inset 0 -10px 0 rgba(65,33,5,0.46)',
            `0 0 18px ${palette.energySoft}`,
          ].join(', '),
        }}
        aria-hidden="true"
      />

      <span
        className="absolute"
        style={{
          inset: '5.2%',
          clipPath: 'polygon(9% 0, 91% 0, 100% 12%, 100% 88%, 91% 100%, 9% 100%, 0 88%, 0 12%)',
          background: [
            'linear-gradient(120deg, transparent 0 21%, rgba(255,255,255,0.15) 22% 25%, transparent 26% 100%)',
            `radial-gradient(circle at 50% 12%, ${palette.energySoft}, transparent 48%)`,
            `linear-gradient(180deg, ${palette.stoneTop} 0%, ${palette.stoneMid} 50%, ${palette.stoneLow} 100%)`,
          ].join(', '),
          boxShadow: [
            'inset 0 1px 0 rgba(255,255,255,0.2)',
            `inset 0 0 0 1px ${solo ? 'rgba(125,211,252,0.48)' : 'rgba(255,214,102,0.44)'}`,
            'inset 0 -18px 20px rgba(0,0,0,0.62)',
          ].join(', '),
        }}
        aria-hidden="true"
      />

      <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 220 250" preserveAspectRatio="none" aria-hidden="true">
        <path
          d="M23 8 H197 L212 23 V227 L197 242 H23 L8 227 V23 Z"
          fill="none"
          stroke="rgba(44, 24, 8, 0.62)"
          strokeWidth="8"
        />
        <path
          d="M25 10 H195 L210 25 V225 L195 240 H25 L10 225 V25 Z"
          fill="none"
          stroke={palette.frame}
          strokeWidth="3.4"
        />
        <path
          d="M36 19 H92 M184 231 H128 M18 80 V32 L32 18 H74 M202 80 V32 L188 18 H146 M18 170 V218 L32 232 H74 M202 170 V218 L188 232 H146"
          fill="none"
          stroke="rgba(255, 247, 196, 0.62)"
          strokeWidth="3.2"
          strokeLinecap="round"
        />
        <path
          d="M12 119 H28 M192 119 H208 M15 132 H25 M195 132 H205"
          stroke={palette.energy}
          strokeWidth="3.2"
          strokeLinecap="round"
          opacity="0.78"
        />
        <path
          d="M44 43 L65 25 H155 L176 43"
          fill="none"
          stroke="rgba(255,255,255,0.22)"
          strokeWidth="2.6"
          strokeLinecap="round"
        />
      </svg>

      <PortalEmblem type={type} icon={icon} />

      <span
        className="absolute left-1/2 z-10 -translate-x-1/2"
        style={{
          top: '43%',
          width: '82%',
          height: '41%',
          clipPath: 'polygon(9% 0, 91% 0, 100% 16%, 100% 84%, 91% 100%, 9% 100%, 0 84%, 0 16%)',
          background: [
            `radial-gradient(ellipse at 50% 0%, ${palette.energySoft}, transparent 58%)`,
            'linear-gradient(180deg, rgba(11,16,30,0.44), rgba(0,0,0,0.5))',
          ].join(', '),
          boxShadow: [
            `inset 0 0 0 1px ${solo ? 'rgba(125,211,252,0.38)' : 'rgba(255,214,102,0.34)'}`,
            'inset 0 1px 0 rgba(255,255,255,0.1)',
            'inset 0 -14px 18px rgba(0,0,0,0.46)',
          ].join(', '),
        }}
        aria-hidden="true"
      />

      <span
        className="absolute z-20 block whitespace-pre-line font-bangers"
        style={{
          left: '8%',
          right: '8%',
          top: '52%',
          color: '#f8fafc',
          fontSize: '12.4cqw',
          lineHeight: 0.86,
          letterSpacing: 0,
          textShadow: [
            '0 2px 0 rgba(0,0,0,0.82)',
            `0 0 14px ${solo ? 'rgba(34,211,238,0.58)' : 'rgba(250,204,21,0.42)'}`,
          ].join(', '),
        }}
      >
        <span className="block">{palette.label[0]}</span>
        <span className="block" style={{ color: palette.labelAccent, fontSize: '0.88em' }}>
          {palette.label[1]}
        </span>
      </span>

      <span
        className="absolute left-1/2 z-20 block -translate-x-1/2"
        style={{
          top: '77%',
          width: '58%',
          height: '1.2%',
          background: `linear-gradient(90deg, transparent, ${palette.energy}, #fff6bf, ${palette.energy}, transparent)`,
          boxShadow: `0 0 12px ${palette.energySoft}`,
        }}
        aria-hidden="true"
      />

      <span
        className="absolute left-1/2 z-20 flex -translate-x-1/2 items-center justify-center"
        style={{
          bottom: '6.6%',
          width: '44%',
          height: '10.5%',
          clipPath: 'polygon(12% 0, 88% 0, 100% 38%, 88% 100%, 12% 100%, 0 38%)',
          background: `linear-gradient(180deg, #fff1a8, ${palette.frame} 48%, ${palette.frameDark})`,
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.64), inset 0 -6px 8px rgba(72,34,5,0.44), 0 4px 8px rgba(0,0,0,0.32)',
        }}
        aria-hidden="true"
      >
        <span
          style={{
            width: '66%',
            height: '18%',
            borderRadius: 999,
            background: 'rgba(66, 33, 5, 0.42)',
            boxShadow: '0 -1px 0 rgba(255,255,255,0.28)',
          }}
        />
      </span>
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
            left: '13.314815%',
            top: '71.40625%',
            width: '33.981481%',
            height: '18.177083%',
          }}
        >
          <HomeGameButton
            type="solo"
            title={'SOLO\nMEYDAN OKUMA'}
            icon={<UserRound className="h-7 w-7" strokeWidth={1.75} />}
            onClick={handleSolo}
          />
        </div>

        <div
          className="absolute z-20 pointer-events-auto"
          style={{
            left: '52.703704%',
            top: '71.40625%',
            width: '33.981481%',
            height: '18.177083%',
          }}
        >
          <HomeGameButton
            type="online"
            title={'ONLINE\nKAPIŞMA'}
            icon={<Globe className="h-7 w-7" strokeWidth={1.85} />}
            onClick={handleOnline}
          />
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
