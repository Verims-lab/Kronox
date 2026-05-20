import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ChevronRight, Globe, LogOut, Settings, UserRound } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { sounds } from '@/lib/gameSounds';

const LOGO_URL = 'https://media.base44.com/images/public/69e753d5ab4c08a7c4287c25/49fc6f458_kronoxnobckgrnd.png';
const BACKGROUND_ASSET = '/assets/ui/home-background-full.webp';

function ModeIllustration({ type }) {
  const solo = type === 'solo';
  const glow = solo ? '#c044ff' : '#facc15';
  const deep = solo ? '#160923' : '#1b1205';
  const mid = solo ? '#5d1792' : '#7a5106';
  const id = solo ? 'solo-mode-art' : 'online-mode-art';

  return (
    <svg className="absolute inset-0 h-full w-full" viewBox="0 0 360 210" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <radialGradient id={`${id}-core`} cx="50%" cy="58%" r="58%">
          <stop offset="0%" stopColor={glow} stopOpacity="0.82" />
          <stop offset="42%" stopColor={mid} stopOpacity="0.34" />
          <stop offset="100%" stopColor={deep} stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${id}-shine`} x1="0%" x2="100%" y1="0%" y2="100%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.35" />
          <stop offset="28%" stopColor="#ffffff" stopOpacity="0.08" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect width="360" height="210" fill={solo ? '#13071f' : '#160f07'} />
      <rect width="360" height="210" fill={`url(#${id}-core)`} />
      <path d="M0 0 H360 V210 H0 Z" fill="none" stroke={glow} strokeOpacity="0.34" strokeWidth="3" />
      <path d="M28 0 L0 28 V0 Z M332 0 H360 V28 Z M0 182 V210 H28 Z M360 182 V210 H332 Z" fill={glow} opacity="0.42" />
      <path d="M34 18 H126 M326 192 H232" stroke="#fff" strokeOpacity="0.28" strokeWidth="3" strokeLinecap="round" />
      <path d="M34 0 L0 35 V0 Z M326 0 H360 V35 Z" fill="#fff" opacity="0.08" />
      <path d="M24 18 L132 18 L64 118 L0 166 V54 Z" fill={`url(#${id}-shine)`} opacity="0.72" />
      <g opacity="0.42" stroke={glow} strokeWidth="1.2" fill="none">
        <ellipse cx="180" cy="137" rx="112" ry="24" />
        <ellipse cx="180" cy="137" rx="74" ry="16" />
        <path d="M42 136 C94 94 266 94 318 136" />
      </g>
      {solo ? (
        <>
          <path d="M180 34 L220 82 L207 145 H153 L140 82 Z" fill="#13051e" stroke={glow} strokeWidth="4" />
          <path d="M180 60 L197 84 L188 116 H172 L163 84 Z" fill="none" stroke="#e9b7ff" strokeWidth="4" />
          <path d="M180 34 L194 83 L180 146 L166 83 Z" fill="#ffffff" opacity="0.12" />
          <path d="M70 166 C112 126 148 135 180 146 C214 135 252 126 294 166 Z" fill="#07050d" opacity="0.86" />
          <path d="M30 180 L68 142 L92 180 Z M264 180 L302 140 L338 180 Z" fill="#07050d" opacity="0.9" />
          <circle cx="180" cy="136" r="8" fill={glow} />
          <path d="M180 112 V170" stroke="#f4d1ff" strokeWidth="2" strokeOpacity="0.72" />
        </>
      ) : (
        <>
          <circle cx="180" cy="92" r="55" fill="#0b0908" stroke={glow} strokeWidth="4" />
          <path d="M126 92 H234 M180 37 C152 62 152 122 180 147 M180 37 C208 62 208 122 180 147" stroke="#ffe69c" strokeOpacity="0.78" strokeWidth="2.2" fill="none" />
          <path d="M134 62 C164 78 197 78 226 62 M134 122 C164 106 197 106 226 122" stroke="#ffe69c" strokeOpacity="0.62" strokeWidth="2" fill="none" />
          <path d="M54 182 C82 148 118 142 146 180 Z M118 184 C146 142 204 142 232 184 Z M216 182 C244 142 292 150 324 182 Z" fill="#070605" opacity="0.9" />
          <circle cx="88" cy="150" r="16" fill="#070605" />
          <circle cx="180" cy="142" r="18" fill="#070605" />
          <circle cx="270" cy="150" r="16" fill="#070605" />
          <path d="M65 94 C112 48 248 48 295 94" stroke={glow} strokeOpacity="0.35" strokeWidth="9" fill="none" />
        </>
      )}
      <path d="M0 210 C78 174 282 174 360 210 Z" fill="#03030a" opacity="0.72" />
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
        padding: '4.6cqh 5.2cqw 5.5cqh',
        filter: solo
          ? 'drop-shadow(0 0 20px rgba(192,68,255,0.72)) drop-shadow(0 20px 18px rgba(0,0,0,0.58))'
          : 'drop-shadow(0 0 18px rgba(250,204,21,0.58)) drop-shadow(0 20px 18px rgba(0,0,0,0.58))',
      }}
      aria-label={title.replace('\n', ' ')}
    >
      <span
        className="pointer-events-none absolute inset-0"
        style={{
          background: solo
            ? 'linear-gradient(180deg, rgba(41,9,70,0.98) 0%, rgba(12,6,25,1) 48%, rgba(4,3,14,1) 100%)'
            : 'linear-gradient(180deg, rgba(52,34,6,0.98) 0%, rgba(14,10,15,1) 48%, rgba(4,4,12,1) 100%)',
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
          inset: '1.7cqw',
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
        className="relative z-10 block w-full overflow-hidden"
        style={{
          height: '48cqh',
          marginBottom: '1.8cqh',
          clipPath: 'polygon(7% 0, 93% 0, 100% 10%, 100% 92%, 93% 100%, 7% 100%, 0 92%, 0 10%)',
          border: `1px solid ${solo ? 'rgba(232,132,255,0.38)' : 'rgba(250,220,72,0.36)'}`,
          boxShadow: solo
            ? 'inset 0 0 18px rgba(192,68,255,0.28), 0 0 18px rgba(192,68,255,0.2)'
            : 'inset 0 0 18px rgba(250,204,21,0.2), 0 0 18px rgba(250,204,21,0.16)',
        }}
      >
        <ModeIllustration type={type} />
      </span>
      <span
        className="relative z-20 mx-auto flex items-center justify-center border"
        style={{
          color: accent,
          width: '18.6cqw',
          height: '9.8cqh',
          marginTop: '-6.7cqh',
          marginBottom: '2.2cqh',
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
        className="relative z-10 block w-full whitespace-pre-line font-bangers"
        style={{
          fontSize: '8.15cqw',
          lineHeight: 0.9,
          color: solo ? '#d994ff' : '#f8fafc',
          letterSpacing: 0,
          textShadow: solo ? '0 0 14px rgba(192,68,255,0.62), 0 2px 0 rgba(0,0,0,0.58)' : '0 0 14px rgba(250,204,21,0.28), 0 2px 0 rgba(0,0,0,0.58)',
        }}
      >
        {title}
      </span>
      <span
        className="relative z-10 block"
        aria-hidden="true"
        style={{
          width: '46%',
          height: '0.8cqh',
          marginTop: '2cqh',
          background: solo ? 'linear-gradient(90deg, transparent, #d994ff, transparent)' : 'linear-gradient(90deg, transparent, #facc15, transparent)',
          boxShadow: solo ? '0 0 9px rgba(217,148,255,0.72)' : '0 0 9px rgba(250,204,21,0.6)',
        }}
      />
      <span
        className="relative z-10 block w-full font-inter font-bold text-white/78"
        style={{
          marginTop: '1.8cqh',
          fontSize: '3.25cqw',
          lineHeight: 1.14,
          letterSpacing: 0,
        }}
      >
        {subtitle}
      </span>
      <span
        className="absolute inset-x-0 bottom-0 h-16 opacity-80"
        aria-hidden="true"
        style={{
          height: '28cqh',
          background: solo
            ? 'radial-gradient(ellipse at 50% 100%, rgba(168,85,247,0.82), transparent 68%)'
            : 'radial-gradient(ellipse at 50% 100%, rgba(250,204,21,0.58), transparent 70%)',
        }}
      />
      <span
        className="pointer-events-none absolute opacity-75"
        aria-hidden="true"
        style={{
          left: '8cqw',
          right: '8cqw',
          bottom: '5cqh',
          height: '16cqh',
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
          bottom: '3.9cqh',
          height: '1.2cqh',
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

  useEffect(() => {
    base44.auth.me().then((u) => setUser(u || null)).catch(() => setUser(null));
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
      <img
        src={BACKGROUND_ASSET}
        alt=""
        draggable={false}
        className="absolute left-1/2 top-1/2 object-cover"
        style={{
          width: 'max(100dvw, 56.25dvh)',
          height: 'max(100dvh, 177.7778dvw)',
          transform: 'translate(-50%, -50%)',
          objectPosition: 'center center',
          pointerEvents: 'none',
        }}
      />

      <div
        className="absolute left-1/2 top-1/2 z-10"
        style={{
          width: 'max(100dvw, 56.25dvh)',
          height: 'max(100dvh, 177.7778dvw)',
          aspectRatio: '1080 / 1920',
          transform: 'translate(-50%, -50%)',
          overflow: 'hidden',
          overscrollBehavior: 'none',
          overscrollBehaviorY: 'none',
        }}
      >
        <header
          className="absolute flex justify-center"
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
          className="absolute z-20"
          style={{
            left: '11.851852%',
            top: '70.484375%',
            width: '33.648148%',
            height: '20.25%',
          }}
        >
          <ModeCard
            type="solo"
            title={'SOLO\nMEYDAN OKUMA'}
            subtitle={<>Kendine karşı yarış,<br />zamanı yen!</>}
            icon={<UserRound className="h-7 w-7" strokeWidth={1.75} />}
            onClick={handleSolo}
          />
        </div>

        <div
          className="absolute z-20"
          style={{
            left: '54.5%',
            top: '70.484375%',
            width: '33.648148%',
            height: '20.25%',
          }}
        >
          <ModeCard
            type="online"
            title={'ONLINE\nBATTLE'}
            subtitle={<>Gerçek oyunculara<br />karşı oyna!</>}
            icon={<Globe className="h-7 w-7" strokeWidth={1.85} />}
            onClick={handleOnline}
          />
        </div>

        <section
          className="absolute z-20 flex items-center gap-3"
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
