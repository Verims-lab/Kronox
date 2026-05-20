import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ChevronRight, Globe, LogOut, Settings, UserRound, Zap } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { sounds } from '@/lib/gameSounds';

const LOGO_URL = 'https://media.base44.com/images/public/69e753d5ab4c08a7c4287c25/49fc6f458_kronoxnobckgrnd.png';
const BACKGROUND_ASSET = '/assets/ui/home-background-full.webp';

function PlayButton({ onClick }) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileTap={{ scale: 0.948, y: 7 }}
      transition={{ type: 'spring', stiffness: 620, damping: 24 }}
      className="relative mx-auto flex w-[96%] items-center justify-center gap-3 overflow-visible border-0 bg-transparent p-0 font-bangers text-[clamp(2.38rem,10.8vw,3.86rem)] leading-none text-black"
      style={{
        height: 'clamp(66px, 9.1svh, 106px)',
        filter: 'drop-shadow(0 0 18px rgba(250,204,21,0.52)) drop-shadow(0 16px 0 rgba(22,5,31,0.92))',
      }}
      aria-label="Hemen oyna"
    >
      <motion.span
        className="pointer-events-none absolute inset-[-14px]"
        animate={{ opacity: [0.34, 0.68, 0.34] }}
        transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
        style={{
          background: 'radial-gradient(ellipse at center, rgba(250,204,21,0.55), rgba(168,85,247,0.2) 42%, transparent 72%)',
          clipPath: 'polygon(6% 14%, 94% 14%, 100% 50%, 94% 86%, 6% 86%, 0 50%)',
          filter: 'blur(4px)',
        }}
        aria-hidden="true"
      />
      <span
        className="pointer-events-none absolute inset-x-[2px] bottom-[-12px] h-9"
        style={{
          background: 'linear-gradient(180deg, #7c2aa8, #35104c 62%, #100319)',
          clipPath: 'polygon(7% 0, 93% 0, 98% 26%, 92% 100%, 8% 100%, 2% 26%)',
          boxShadow: 'inset 0 4px 0 rgba(255,255,255,0.18), inset 0 -5px 10px rgba(0,0,0,0.42)',
        }}
        aria-hidden="true"
      />
      <span
        className="pointer-events-none absolute inset-0"
        aria-hidden="true"
        style={{
          background: 'linear-gradient(180deg, #fff9b8 0%, #ffd936 28%, #ffbd09 66%, #df8500 100%)',
          clipPath: 'polygon(7% 0, 93% 0, 99% 42%, 96% 82%, 88% 100%, 12% 100%, 4% 82%, 1% 42%)',
          boxShadow: [
            'inset 0 5px 0 rgba(255,255,255,0.62)',
            'inset 0 -9px 16px rgba(87,40,0,0.34)',
            'inset 0 0 0 3px rgba(20,12,0,0.92)',
            'inset 0 0 0 6px rgba(255,245,125,0.22)',
          ].join(', '),
        }}
      />
      <span
        className="pointer-events-none absolute inset-[6px]"
        aria-hidden="true"
        style={{
          background: [
            'linear-gradient(115deg, transparent 0 13%, rgba(255,255,255,0.55) 14% 17%, transparent 18% 100%)',
            'linear-gradient(180deg, rgba(255,255,255,0.34), transparent 40%)',
          ].join(', '),
          clipPath: 'polygon(8% 0, 92% 0, 98% 42%, 94% 76%, 86% 100%, 14% 100%, 6% 76%, 2% 42%)',
        }}
      />
      <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 420 112" preserveAspectRatio="none" aria-hidden="true">
        <path d="M30 8 H390 L414 47 L400 92 L368 106 H52 L20 92 L6 47 Z" fill="none" stroke="rgba(255,255,255,0.68)" strokeWidth="2.5" />
        <path d="M42 16 H378 L394 37" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="3" strokeLinecap="round" />
        <path d="M26 92 H394" fill="none" stroke="rgba(86,35,0,0.38)" strokeWidth="5" strokeLinecap="round" />
        <path d="M18 52 L2 40 M18 62 L0 62 M18 72 L2 84 M402 52 L418 40 M402 62 L420 62 M402 72 L418 84" stroke="rgba(255,255,255,0.95)" strokeWidth="5" strokeLinecap="round" />
      </svg>
      <span className="pointer-events-none absolute left-[8%] top-1/2 h-[48%] w-3 -translate-y-1/2 bg-white/34" style={{ clipPath: 'polygon(0 0, 100% 18%, 70% 100%, 0 88%)' }} aria-hidden="true" />
      <span className="pointer-events-none absolute right-[8%] top-1/2 h-[48%] w-3 -translate-y-1/2 bg-black/16" style={{ clipPath: 'polygon(30% 0, 100% 12%, 100% 88%, 0 100%)' }} aria-hidden="true" />
      <span className="relative z-10 tracking-[0.01em] drop-shadow-[0_3px_0_rgba(255,255,255,0.28)]">HEMEN OYNA</span>
      <Zap className="relative z-10 h-[0.78em] w-[0.78em] fill-black stroke-black drop-shadow-[0_2px_0_rgba(255,255,255,0.22)]" strokeWidth={3} />
    </motion.button>
  );
}

function ModeCard({ type, title, subtitle, icon, onClick }) {
  const solo = type === 'solo';
  const accent = solo ? '#c044ff' : '#facc15';

  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileTap={{ scale: 0.958, y: 4 }}
      transition={{ type: 'spring', stiffness: 520, damping: 23 }}
      className="relative overflow-visible border-0 bg-transparent px-3 py-4 text-center"
      style={{
        minHeight: 'clamp(124px, 18svh, 218px)',
        filter: solo
          ? 'drop-shadow(0 0 18px rgba(192,68,255,0.56)) drop-shadow(0 14px 18px rgba(0,0,0,0.46))'
          : 'drop-shadow(0 0 18px rgba(250,204,21,0.4)) drop-shadow(0 14px 18px rgba(0,0,0,0.46))',
      }}
      aria-label={title.replace('\n', ' ')}
    >
      <span
        className="pointer-events-none absolute inset-0"
        style={{
          background: solo
            ? 'linear-gradient(180deg, rgba(88,22,142,0.98), rgba(22,7,50,0.98) 48%, rgba(5,3,17,0.99))'
            : 'linear-gradient(180deg, rgba(34,27,14,0.99), rgba(12,10,19,0.98) 48%, rgba(4,4,13,0.99))',
          clipPath: 'polygon(7% 0, 93% 0, 100% 8%, 100% 92%, 93% 100%, 7% 100%, 0 92%, 0 8%)',
          boxShadow: [
            'inset 0 0 0 1px rgba(255,255,255,0.22)',
            `inset 0 0 0 2px ${solo ? 'rgba(204,72,255,0.76)' : 'rgba(250,204,21,0.68)'}`,
            `inset 0 0 34px ${solo ? 'rgba(192,68,255,0.22)' : 'rgba(250,204,21,0.15)'}`,
            'inset 0 -18px 24px rgba(0,0,0,0.48)',
          ].join(', '),
        }}
        aria-hidden="true"
      />
      <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 210 240" preserveAspectRatio="none" aria-hidden="true">
        <path
          d="M16 4 H194 L206 16 V224 L194 236 H16 L4 224 V16 Z"
          fill="none"
          stroke={solo ? 'rgba(220,112,255,0.95)' : 'rgba(250,204,21,0.92)'}
          strokeWidth="2.6"
        />
        <path d="M26 14 H88 M184 226 H122" fill="none" stroke="rgba(255,255,255,0.48)" strokeWidth="2.4" strokeLinecap="round" />
        <path
          d="M16 55 L4 68 V16 L16 4 H65 M194 4 L206 16 V68 L194 55 M4 172 V224 L16 236 H66 M206 172 V224 L194 236 H144"
          fill="none"
          stroke={solo ? 'rgba(244,190,255,0.36)' : 'rgba(255,241,150,0.34)'}
          strokeWidth="5"
          strokeLinecap="round"
        />
        <path d="M8 128 H22 M188 128 H202" stroke={solo ? 'rgba(220,112,255,0.9)' : 'rgba(250,204,21,0.82)'} strokeWidth="3" strokeLinecap="round" />
      </svg>
      <span
        className="pointer-events-none absolute inset-[5px]"
        style={{
          background: [
            'linear-gradient(125deg, transparent 0 20%, rgba(255,255,255,0.12) 21% 24%, transparent 25% 100%)',
            solo
              ? 'radial-gradient(ellipse at 50% 0%, rgba(228,96,255,0.34), transparent 58%)'
              : 'radial-gradient(ellipse at 50% 0%, rgba(250,204,21,0.23), transparent 60%)',
          ].join(', '),
          clipPath: 'polygon(7% 0, 93% 0, 100% 8%, 100% 92%, 93% 100%, 7% 100%, 0 92%, 0 8%)',
        }}
        aria-hidden="true"
      />
      <span
        className="relative z-10 mx-auto mb-3 flex items-center justify-center rounded-full border"
        style={{
          color: accent,
          width: 'clamp(44px, 6.3svh, 56px)',
          height: 'clamp(44px, 6.3svh, 56px)',
          background: solo
            ? 'radial-gradient(circle at 35% 25%, rgba(255,255,255,0.2), transparent 28%), linear-gradient(180deg, rgba(82,21,128,0.9), rgba(12,6,31,0.94))'
            : 'radial-gradient(circle at 35% 25%, rgba(255,255,255,0.18), transparent 28%), linear-gradient(180deg, rgba(82,63,12,0.88), rgba(12,9,17,0.96))',
          borderColor: solo ? 'rgba(228,132,255,0.96)' : 'rgba(250,220,72,0.96)',
          boxShadow: solo ? '0 0 24px rgba(192,68,255,0.66), inset 0 0 18px rgba(255,255,255,0.1), inset 0 -6px 8px rgba(0,0,0,0.32)' : '0 0 24px rgba(250,204,21,0.48), inset 0 0 18px rgba(255,255,255,0.09), inset 0 -6px 8px rgba(0,0,0,0.32)',
        }}
      >
        {icon}
      </span>
      <span
        className="relative z-10 block whitespace-pre-line font-bangers text-[clamp(1.62rem,6.9vw,2.32rem)] leading-[0.9]"
        style={{
          color: solo ? '#d47cff' : '#f8fafc',
          textShadow: solo ? '0 0 14px rgba(192,68,255,0.42)' : '0 0 12px rgba(250,204,21,0.18)',
        }}
      >
        {title}
      </span>
      <span className="relative z-10 mt-3 block font-inter text-[clamp(0.72rem,3.1vw,0.94rem)] font-bold leading-snug text-white/78">
        {subtitle}
      </span>
      <span
        className="absolute inset-x-0 bottom-0 h-16 opacity-80"
        aria-hidden="true"
        style={{
          background: solo
            ? 'radial-gradient(ellipse at 50% 100%, rgba(168,85,247,0.82), transparent 68%)'
            : 'radial-gradient(ellipse at 50% 100%, rgba(250,204,21,0.55), transparent 70%)',
        }}
      />
      <span
        className="pointer-events-none absolute inset-x-3 bottom-3 h-11 opacity-75"
        aria-hidden="true"
        style={{
          background: solo
            ? 'linear-gradient(to top, rgba(88,28,135,0.92), transparent), radial-gradient(ellipse at 50% 100%, rgba(192,68,255,0.68), transparent 55%)'
            : 'linear-gradient(to top, rgba(92,65,12,0.72), transparent), radial-gradient(ellipse at 50% 100%, rgba(250,204,21,0.42), transparent 58%)',
          clipPath: 'polygon(0 100%, 0 66%, 8% 74%, 16% 58%, 23% 78%, 30% 50%, 38% 70%, 47% 44%, 56% 74%, 66% 54%, 75% 78%, 84% 58%, 92% 70%, 100% 60%, 100% 100%)',
          zIndex: 0,
        }}
      />
      <span
        className="pointer-events-none absolute bottom-2 left-1/2 h-1 w-[54%] -translate-x-1/2"
        aria-hidden="true"
        style={{
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
      className="relative w-full overflow-hidden bg-black text-white"
      style={{
        width: '100vw',
        minHeight: '100vh',
        height: '100dvh',
        userSelect: 'none',
      }}
    >
      <img
        src={BACKGROUND_ASSET}
        alt=""
        draggable={false}
        className="absolute inset-0 h-full w-full object-cover"
        style={{
          objectPosition: 'center top',
          pointerEvents: 'none',
        }}
      />

      <div
        className="relative z-10 mx-auto h-full w-full max-w-[440px] px-5"
        style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}
      >
        <header
          className="absolute left-0 right-0 flex justify-center px-5"
          style={{ top: 'calc(0.45rem + env(safe-area-inset-top))' }}
        >
          <img
            src={LOGO_URL}
            alt="Kronox"
            draggable={false}
            className="object-contain"
            style={{
              width: 'clamp(212px, 68vw, 326px)',
              height: 'clamp(74px, 10.2svh, 124px)',
              filter: 'drop-shadow(0 0 14px rgba(250,204,21,0.86))',
            }}
          />
        </header>

        <section
          className="absolute left-5 right-5 z-20"
          style={{ top: '57.2%' }}
        >
          <PlayButton onClick={handleSolo} />
        </section>

        <section
          className="absolute left-5 right-5 z-20 grid grid-cols-2 gap-4"
          style={{ top: '69.6%' }}
        >
          <ModeCard
            type="solo"
            title={'SOLO\nMEYDAN OKUMA'}
            subtitle={<>Kendine karşı yarış,<br />zamanı yen!</>}
            icon={<UserRound className="h-7 w-7" strokeWidth={1.75} />}
            onClick={handleSolo}
          />
          <ModeCard
            type="online"
            title={'ONLINE\nBATTLE'}
            subtitle={<>Gerçek oyunculara<br />karşı oyna!</>}
            icon={<Globe className="h-7 w-7" strokeWidth={1.85} />}
            onClick={handleOnline}
          />
        </section>

        <section
          className="absolute left-5 right-5 z-20 flex items-center gap-3"
          style={{ bottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}
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
