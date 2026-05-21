import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ChevronRight, Globe, LogOut, Settings, UserRound } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { sounds } from '@/lib/gameSounds';

const LOGO_URL = 'https://media.base44.com/images/public/69e753d5ab4c08a7c4287c25/49fc6f458_kronoxnobckgrnd.png';
const BACKGROUND_ASSET = '/assets/ui/home-background-full.webp';
const WIDE_STAGE_QUERY = '(min-aspect-ratio: 9 / 16)';

const getIsWideStage = () => (
  typeof window !== 'undefined'
    ? window.matchMedia(WIDE_STAGE_QUERY).matches
    : false
);

function ModeIllustration({ type }) {
  const solo = type === 'solo';
  const glow = solo ? '#d15cff' : '#facc15';
  const deep = solo ? '#16041f' : '#170f04';
  const mid = solo ? '#6812a2' : '#875b06';
  const id = solo ? 'solo-mode-art' : 'online-mode-art';

  return (
    <svg className="absolute inset-0 h-full w-full" viewBox="0 0 360 230" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <radialGradient id={`${id}-core`} cx="50%" cy="60%" r="66%">
          <stop offset="0%" stopColor={glow} stopOpacity="0.92" />
          <stop offset="36%" stopColor={mid} stopOpacity="0.52" />
          <stop offset="100%" stopColor={deep} stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`${id}-horizon`} cx="50%" cy="80%" r="54%">
          <stop offset="0%" stopColor={glow} stopOpacity={solo ? '0.82' : '0.66'} />
          <stop offset="100%" stopColor={deep} stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${id}-shine`} x1="0%" x2="100%" y1="0%" y2="100%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.42" />
          <stop offset="24%" stopColor="#ffffff" stopOpacity="0.1" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
        <filter id={`${id}-hot`} x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="7" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <rect width="360" height="230" fill={solo ? '#11051b' : '#120c04'} />
      <rect width="360" height="230" fill={`url(#${id}-core)`} />
      <rect y="64" width="360" height="166" fill={`url(#${id}-horizon)`} />
      <path d="M0 0 H360 V230 H0 Z" fill="none" stroke={glow} strokeOpacity="0.4" strokeWidth="4" />
      <path d="M28 0 L0 28 V0 Z M332 0 H360 V28 Z M0 198 V230 H32 Z M360 198 V230 H328 Z" fill={glow} opacity="0.42" />
      <path d="M31 18 H122 M329 212 H238" stroke="#fff" strokeOpacity="0.34" strokeWidth="4" strokeLinecap="round" />
      <path d="M34 0 L0 36 V0 Z M326 0 H360 V36 Z" fill="#fff" opacity="0.08" />
      <path d="M20 12 L156 12 L66 134 L0 186 V52 Z" fill={`url(#${id}-shine)`} opacity="0.74" />
      <g opacity="0.5" stroke={glow} strokeWidth="1.4" fill="none">
        <ellipse cx="180" cy="155" rx="128" ry="28" />
        <ellipse cx="180" cy="155" rx="88" ry="19" />
        <ellipse cx="180" cy="155" rx="48" ry="10" />
        <path d="M26 154 C86 102 274 102 334 154" />
      </g>
      {solo ? (
        <>
          <path d="M180 28 L232 88 L212 166 H148 L128 88 Z" fill="#14031e" stroke={glow} strokeWidth="5.5" filter={`url(#${id}-hot)`} />
          <path d="M180 55 L205 88 L192 130 H168 L155 88 Z" fill="none" stroke="#f4d1ff" strokeWidth="6" />
          <path d="M180 28 L198 92 L180 170 L162 92 Z" fill="#ffffff" opacity="0.13" />
          <path d="M49 190 C95 142 137 148 180 164 C223 148 266 142 311 190 Z" fill="#06040c" opacity="0.9" />
          <path d="M16 204 L58 148 L96 204 Z M263 204 L306 146 L350 204 Z" fill="#05040b" opacity="0.94" />
          <circle cx="180" cy="156" r="12" fill={glow} filter={`url(#${id}-hot)`} />
          <path d="M180 114 V200" stroke="#f4d1ff" strokeWidth="2.5" strokeOpacity="0.78" />
        </>
      ) : (
        <>
          <circle cx="180" cy="96" r="70" fill="#0b0805" stroke={glow} strokeWidth="5" filter={`url(#${id}-hot)`} />
          <path d="M110 96 H250 M180 26 C145 58 145 134 180 166 M180 26 C215 58 215 134 180 166" stroke="#ffe69c" strokeOpacity="0.82" strokeWidth="2.6" fill="none" />
          <path d="M121 58 C158 78 202 78 239 58 M121 132 C158 112 202 112 239 132" stroke="#ffe69c" strokeOpacity="0.66" strokeWidth="2.4" fill="none" />
          <path d="M40 204 C70 154 116 146 148 200 Z M112 204 C144 144 216 144 248 204 Z M212 204 C244 146 296 154 332 204 Z" fill="#070604" opacity="0.94" />
          <circle cx="86" cy="162" r="20" fill="#070604" />
          <circle cx="180" cy="153" r="24" fill="#070604" />
          <circle cx="274" cy="162" r="20" fill="#070604" />
          <path d="M48 104 C107 44 253 44 312 104" stroke={glow} strokeOpacity="0.48" strokeWidth="11" fill="none" />
        </>
      )}
      <path d="M0 230 C74 188 286 188 360 230 Z" fill="#03030a" opacity="0.78" />
    </svg>
  );
}

function ModeCard({ type, title, subtitle, icon, onClick }) {
  const solo = type === 'solo';
  const accent = solo ? '#c044ff' : '#facc15';
  const renderedIcon = React.isValidElement(icon)
    ? React.cloneElement(icon, { style: { width: '54%', height: '54%' } })
    : icon;

  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={{ y: -3 }}
      whileTap={{ scale: 0.955, y: 5 }}
      transition={{ type: 'spring', stiffness: 560, damping: 24 }}
      className="relative flex h-full w-full flex-col items-center overflow-visible border-0 bg-transparent text-center"
      style={{
        containerType: 'size',
        padding: 0,
        filter: solo
          ? 'drop-shadow(0 0 22px rgba(192,68,255,0.78)) drop-shadow(0 18px 18px rgba(0,0,0,0.64))'
          : 'drop-shadow(0 0 22px rgba(250,204,21,0.66)) drop-shadow(0 18px 18px rgba(0,0,0,0.64))',
      }}
      aria-label={title.replace('\n', ' ')}
    >
      <span
        className="pointer-events-none absolute inset-0"
        style={{
          background: solo
            ? 'linear-gradient(180deg, rgba(42,7,70,0.98) 0%, rgba(12,5,24,1) 60%, rgba(4,3,12,1) 100%)'
            : 'linear-gradient(180deg, rgba(60,38,4,0.98) 0%, rgba(15,9,10,1) 60%, rgba(4,4,10,1) 100%)',
          clipPath: 'polygon(7.2% 0, 92.8% 0, 100% 8.2%, 100% 91.8%, 92.8% 100%, 7.2% 100%, 0 91.8%, 0 8.2%)',
          boxShadow: [
            'inset 0 1px 0 rgba(255,255,255,0.34)',
            `inset 0 0 0 2px ${solo ? 'rgba(217,92,255,0.9)' : 'rgba(250,213,54,0.86)'}`,
            `inset 0 0 38px ${solo ? 'rgba(192,68,255,0.25)' : 'rgba(250,204,21,0.17)'}`,
            'inset 0 -28px 28px rgba(0,0,0,0.58)',
            'inset 0 14px 20px rgba(255,255,255,0.05)',
          ].join(', '),
        }}
        aria-hidden="true"
      />
      <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 210 240" preserveAspectRatio="none" aria-hidden="true">
        <path
          d="M17 4 H193 L206 17 V223 L193 236 H17 L4 223 V17 Z"
          fill="none"
          stroke={solo ? 'rgba(220,112,255,0.95)' : 'rgba(250,204,21,0.92)'}
          strokeWidth="2.9"
        />
        <path
          d="M28 14 H92 M182 226 H118"
          fill="none"
          stroke="rgba(255,255,255,0.58)"
          strokeWidth="2.6"
          strokeLinecap="round"
        />
        <path
          d="M17 55 L4 70 V17 L17 4 H68 M193 4 L206 17 V70 L193 55 M4 170 V223 L17 236 H68 M206 170 V223 L193 236 H142"
          fill="none"
          stroke={solo ? 'rgba(244,190,255,0.36)' : 'rgba(255,241,150,0.34)'}
          strokeWidth="5.6"
          strokeLinecap="round"
        />
        <path d="M9 122 H24 M186 122 H201 M9 134 H19 M191 134 H201" stroke={solo ? 'rgba(220,112,255,0.9)' : 'rgba(250,204,21,0.82)'} strokeWidth="3" strokeLinecap="round" />
      </svg>
      <span
        className="pointer-events-none absolute"
        style={{
          inset: '2.2%',
          background: [
            'linear-gradient(118deg, transparent 0 19%, rgba(255,255,255,0.16) 20% 23%, transparent 24% 100%)',
            solo
              ? 'radial-gradient(ellipse at 50% 0%, rgba(232,114,255,0.36), transparent 60%)'
              : 'radial-gradient(ellipse at 50% 0%, rgba(250,222,91,0.26), transparent 60%)',
          ].join(', '),
          clipPath: 'polygon(7.2% 0, 92.8% 0, 100% 8.2%, 100% 91.8%, 92.8% 100%, 7.2% 100%, 0 91.8%, 0 8.2%)',
        }}
        aria-hidden="true"
      />
      <span
        className="absolute z-10 block overflow-hidden"
        style={{
          left: '5.4%',
          right: '5.4%',
          top: '5.1%',
          height: '57.2%',
          clipPath: 'polygon(7% 0, 93% 0, 100% 10%, 100% 91%, 93% 100%, 7% 100%, 0 91%, 0 10%)',
          border: `1px solid ${solo ? 'rgba(232,132,255,0.38)' : 'rgba(250,220,72,0.36)'}`,
          boxShadow: solo
            ? 'inset 0 0 28px rgba(192,68,255,0.34), 0 0 22px rgba(192,68,255,0.24)'
            : 'inset 0 0 28px rgba(250,204,21,0.24), 0 0 22px rgba(250,204,21,0.2)',
        }}
      >
        <ModeIllustration type={type} />
      </span>
      <span
        className="absolute z-10 block"
        style={{
          left: '4.8%',
          right: '4.8%',
          top: '56.4%',
          bottom: '5.1%',
          clipPath: 'polygon(9% 0, 91% 0, 100% 13%, 100% 88%, 91% 100%, 9% 100%, 0 88%, 0 13%)',
          background: solo
            ? 'linear-gradient(180deg, rgba(15,7,26,0.95), rgba(3,3,10,0.98) 72%), radial-gradient(ellipse at 50% 0%, rgba(192,68,255,0.24), transparent 62%)'
            : 'linear-gradient(180deg, rgba(17,12,7,0.95), rgba(3,3,9,0.98) 72%), radial-gradient(ellipse at 50% 0%, rgba(250,204,21,0.18), transparent 62%)',
          boxShadow: [
            'inset 0 1px 0 rgba(255,255,255,0.18)',
            `inset 0 0 0 1px ${solo ? 'rgba(220,112,255,0.56)' : 'rgba(250,204,21,0.52)'}`,
            'inset 0 -18px 20px rgba(0,0,0,0.62)',
          ].join(', '),
        }}
        aria-hidden="true"
      />
      <span
        className="absolute left-1/2 z-20 flex -translate-x-1/2 items-center justify-center border"
        style={{
          color: accent,
          width: '19%',
          height: '10.5%',
          top: '53.4%',
          clipPath: 'polygon(18% 0, 82% 0, 100% 28%, 100% 72%, 82% 100%, 18% 100%, 0 72%, 0 28%)',
          background: solo
            ? 'radial-gradient(circle at 35% 23%, rgba(255,255,255,0.24), transparent 29%), linear-gradient(180deg, rgba(102,26,156,0.94), rgba(14,6,35,0.98))'
            : 'radial-gradient(circle at 35% 23%, rgba(255,255,255,0.2), transparent 29%), linear-gradient(180deg, rgba(93,70,13,0.92), rgba(13,9,18,0.98))',
          borderColor: solo ? 'rgba(228,132,255,0.96)' : 'rgba(250,220,72,0.96)',
          boxShadow: solo ? '0 0 22px rgba(192,68,255,0.7), inset 0 0 18px rgba(255,255,255,0.12), inset 0 -7px 10px rgba(0,0,0,0.34)' : '0 0 22px rgba(250,204,21,0.54), inset 0 0 18px rgba(255,255,255,0.1), inset 0 -7px 10px rgba(0,0,0,0.34)',
        }}
      >
        {renderedIcon}
      </span>
      <span
        className="absolute z-20 block whitespace-pre-line font-bangers"
        style={{
          left: '8%',
          right: '8%',
          top: '64.8%',
          fontSize: '12.6cqw',
          lineHeight: 0.86,
          color: solo ? '#ffffff' : '#f8fafc',
          letterSpacing: 0,
          textShadow: solo ? '0 0 16px rgba(192,68,255,0.68), 0 2px 0 rgba(0,0,0,0.72)' : '0 0 16px rgba(250,204,21,0.38), 0 2px 0 rgba(0,0,0,0.72)',
        }}
      >
        {solo ? (
          <>
            <span className="block">SOLO</span>
            <span className="block" style={{ color: '#d995ff', fontSize: '0.9em' }}>MEYDAN OKUMA</span>
          </>
        ) : (
          <>
            <span className="block">ONLINE</span>
            <span className="block" style={{ color: '#facc15', fontSize: '0.9em' }}>KAPIŞMA</span>
          </>
        )}
      </span>
      <span
        className="absolute left-1/2 z-20 block -translate-x-1/2"
        aria-hidden="true"
        style={{
          width: '46%',
          height: '0.7%',
          top: '82%',
          background: solo ? 'linear-gradient(90deg, transparent, #d994ff, transparent)' : 'linear-gradient(90deg, transparent, #facc15, transparent)',
          boxShadow: solo ? '0 0 9px rgba(217,148,255,0.72)' : '0 0 9px rgba(250,204,21,0.6)',
        }}
      />
      <span
        className="absolute z-20 block font-inter font-black text-white/88"
        style={{
          left: '9%',
          right: '9%',
          top: '85.2%',
          fontSize: '4.2cqw',
          lineHeight: 1.05,
          letterSpacing: 0,
          textShadow: '0 2px 6px rgba(0,0,0,0.78)',
        }}
      >
        {subtitle}
      </span>
      <span
        className="absolute inset-x-0 bottom-0 h-16 opacity-80"
        aria-hidden="true"
        style={{
          height: '24%',
          background: solo
            ? 'radial-gradient(ellipse at 50% 100%, rgba(168,85,247,0.82), transparent 68%)'
            : 'radial-gradient(ellipse at 50% 100%, rgba(250,204,21,0.58), transparent 70%)',
        }}
      />
      <span
        className="pointer-events-none absolute opacity-75"
        aria-hidden="true"
        style={{
          left: '8%',
          right: '8%',
          bottom: '5%',
          height: '12%',
          background: solo
            ? 'linear-gradient(to top, rgba(88,28,135,0.92), transparent), radial-gradient(ellipse at 50% 100%, rgba(192,68,255,0.68), transparent 55%)'
            : 'linear-gradient(to top, rgba(92,65,12,0.72), transparent), radial-gradient(ellipse at 50% 100%, rgba(250,204,21,0.42), transparent 58%)',
          clipPath: 'polygon(0 100%, 0 66%, 8% 74%, 16% 58%, 23% 78%, 30% 50%, 38% 70%, 47% 44%, 56% 74%, 66% 54%, 75% 78%, 84% 58%, 92% 70%, 100% 60%, 100% 100%)',
          zIndex: 0,
        }}
      />
      <span
        className="pointer-events-none absolute left-1/2 -translate-x-1/2"
        aria-hidden="true"
        style={{
          bottom: '4.2%',
          height: '1%',
          width: '54%',
          background: solo ? 'linear-gradient(90deg, transparent, #d946ef, transparent)' : 'linear-gradient(90deg, transparent, #facc15, transparent)',
          boxShadow: solo ? '0 0 12px rgba(217,70,239,0.9)' : '0 0 12px rgba(250,204,21,0.78)',
        }}
      />
    </motion.button>
  );
}

function ProfileBar({ user, onLogin, onLogout }) {
  return (
    <div
      className="flex min-w-0 flex-1 items-center gap-3 rounded-full border border-purple-300/24 bg-black/72 px-3 py-2"
      style={{
        minHeight: 56,
        background: 'linear-gradient(180deg, rgba(17,12,30,0.82), rgba(5,5,14,0.9))',
        boxShadow: 'inset 0 0 18px rgba(255,255,255,0.05), 0 0 20px rgba(168,85,247,0.18), 0 10px 22px rgba(0,0,0,0.38)',
      }}
    >
      <span
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
        style={{
          background: 'linear-gradient(180deg, #a855f7, #5b21b6)',
          boxShadow: '0 0 18px rgba(168,85,247,0.62), inset 0 0 10px rgba(255,255,255,0.12)',
        }}
      >
        <UserRound className="h-6 w-6 text-purple-100" />
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
          <ModeCard
            type="solo"
            title={'SOLO\nMEYDAN OKUMA'}
            subtitle={<></>}
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
          <ModeCard
            type="online"
            title={'ONLINE\nBATTLE'}
            subtitle={<></>}
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
            className="flex h-[56px] w-[56px] shrink-0 items-center justify-center rounded-full border border-primary/70 bg-black/76 text-white"
            style={{
              background: 'linear-gradient(180deg, rgba(24,21,18,0.88), rgba(4,5,13,0.96))',
              boxShadow: '0 0 20px rgba(250,204,21,0.42), 0 10px 22px rgba(0,0,0,0.4), inset 0 0 18px rgba(255,255,255,0.08)',
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
