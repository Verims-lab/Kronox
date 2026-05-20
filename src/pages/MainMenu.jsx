import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ChevronRight, Globe, LogOut, Settings, UserRound } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { sounds } from '@/lib/gameSounds';

const LOGO_URL = 'https://media.base44.com/images/public/69e753d5ab4c08a7c4287c25/49fc6f458_kronoxnobckgrnd.png';
const BACKGROUND_ASSET = '/assets/ui/home-background-full.webp';

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
        padding: '8.8cqh 7.4cqw 7.4cqh',
        filter: solo
          ? 'drop-shadow(0 0 16px rgba(192,68,255,0.66)) drop-shadow(0 18px 18px rgba(0,0,0,0.52))'
          : 'drop-shadow(0 0 15px rgba(250,204,21,0.52)) drop-shadow(0 18px 18px rgba(0,0,0,0.52))',
      }}
      aria-label={title.replace('\n', ' ')}
    >
      <span
        className="pointer-events-none absolute inset-0"
        style={{
          background: solo
            ? 'linear-gradient(180deg, rgba(84,20,136,0.97) 0%, rgba(25,8,58,0.99) 46%, rgba(5,4,19,1) 100%)'
            : 'linear-gradient(180deg, rgba(53,42,14,0.97) 0%, rgba(16,13,20,0.99) 47%, rgba(4,4,13,1) 100%)',
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
        className="relative z-10 mx-auto flex items-center justify-center rounded-full border"
        style={{
          color: accent,
          width: '18.2cqw',
          height: '18.2cqw',
          marginBottom: '5.3cqh',
          background: solo
            ? 'radial-gradient(circle at 35% 23%, rgba(255,255,255,0.24), transparent 29%), linear-gradient(180deg, rgba(102,26,156,0.94), rgba(14,6,35,0.98))'
            : 'radial-gradient(circle at 35% 23%, rgba(255,255,255,0.2), transparent 29%), linear-gradient(180deg, rgba(93,70,13,0.92), rgba(13,9,18,0.98))',
          borderColor: solo ? 'rgba(228,132,255,0.96)' : 'rgba(250,220,72,0.96)',
          boxShadow: solo ? '0 0 22px rgba(192,68,255,0.66), inset 0 0 18px rgba(255,255,255,0.12), inset 0 -7px 10px rgba(0,0,0,0.34)' : '0 0 22px rgba(250,204,21,0.5), inset 0 0 18px rgba(255,255,255,0.1), inset 0 -7px 10px rgba(0,0,0,0.34)',
        }}
      >
        {renderedIcon}
      </span>
      <span
        className="relative z-10 block w-full whitespace-pre-line font-bangers"
        style={{
          fontSize: '8.8cqw',
          lineHeight: 0.92,
          color: solo ? '#d47cff' : '#f8fafc',
          letterSpacing: 0,
          textShadow: solo ? '0 0 13px rgba(192,68,255,0.54), 0 2px 0 rgba(0,0,0,0.45)' : '0 0 13px rgba(250,204,21,0.22), 0 2px 0 rgba(0,0,0,0.45)',
        }}
      >
        {title}
      </span>
      <span
        className="relative z-10 block w-full font-inter font-bold text-white/78"
        style={{
          marginTop: '4.1cqh',
          fontSize: '3.75cqw',
          lineHeight: 1.18,
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
