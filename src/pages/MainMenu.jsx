import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ChevronRight, Globe, LogOut, Settings, UserRound, Zap } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { sounds } from '@/lib/gameSounds';

const LOGO_URL = 'https://media.base44.com/images/public/69e753d5ab4c08a7c4287c25/49fc6f458_kronoxnobckgrnd.png';
const HERO_ASSET = '/assets/ui/kronox_hero_section_v1.webp';

function PlayButton({ onClick }) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileTap={{ scale: 0.955, y: 5 }}
      transition={{ type: 'spring', stiffness: 560, damping: 25 }}
      className="relative mx-auto flex w-[96%] items-center justify-center gap-3 overflow-visible rounded-[24px] border-[3px] border-black/90 font-bangers text-[clamp(2.55rem,11.2vw,3.75rem)] leading-none text-black"
      style={{
        height: 'clamp(72px, 9.4svh, 102px)',
        background: 'linear-gradient(180deg, #fff8a8 0%, #ffd52b 34%, #f7b40b 72%, #df8c00 100%)',
        boxShadow: [
          '0 0 22px rgba(250,204,21,0.42)',
          '0 0 46px rgba(250,204,21,0.28)',
          '0 12px 0 #6c238f',
          '0 18px 0 #17051f',
          'inset 0 5px 0 rgba(255,255,255,0.46)',
          'inset 0 -9px 14px rgba(123,63,0,0.22)',
        ].join(', '),
      }}
      aria-label="Hemen oyna"
    >
      <motion.span
        className="pointer-events-none absolute inset-[-10px] rounded-[30px]"
        animate={{ opacity: [0.38, 0.72, 0.38] }}
        transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
        style={{
          background: 'radial-gradient(ellipse at center, rgba(250,204,21,0.42), transparent 68%)',
          filter: 'blur(2px)',
        }}
        aria-hidden="true"
      />
      <span
        className="pointer-events-none absolute inset-[5px] rounded-[18px]"
        style={{
          background: 'linear-gradient(180deg, rgba(255,255,255,0.32), transparent 42%)',
        }}
        aria-hidden="true"
      />
      <span
        className="absolute -left-9 top-1/2 h-14 w-8 -translate-y-1/2"
        aria-hidden="true"
        style={{
          background: 'repeating-radial-gradient(ellipse at right, rgba(255,255,255,0.98) 0 2px, transparent 3px 9px)',
          clipPath: 'polygon(100% 0, 0 18%, 78% 50%, 0 82%, 100% 100%)',
          filter: 'drop-shadow(0 0 7px rgba(255,255,255,0.75))',
        }}
      />
      <span className="relative tracking-[0.01em] drop-shadow-[0_2px_0_rgba(255,255,255,0.28)]">HEMEN OYNA</span>
      <Zap className="relative h-[0.76em] w-[0.76em] fill-black stroke-black" strokeWidth={2.8} />
      <span
        className="absolute -right-9 top-1/2 h-14 w-8 -translate-y-1/2 rotate-180"
        aria-hidden="true"
        style={{
          background: 'repeating-radial-gradient(ellipse at right, rgba(255,255,255,0.98) 0 2px, transparent 3px 9px)',
          clipPath: 'polygon(100% 0, 0 18%, 78% 50%, 0 82%, 100% 100%)',
          filter: 'drop-shadow(0 0 7px rgba(255,255,255,0.75))',
        }}
      />
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
      whileTap={{ scale: 0.965, y: 3 }}
      transition={{ type: 'spring', stiffness: 460, damping: 24 }}
      className="relative overflow-hidden rounded-[18px] px-3 py-4 text-center"
      style={{
        minHeight: 'clamp(146px, 19.5svh, 218px)',
        background: solo
          ? 'linear-gradient(180deg, rgba(71,19,118,0.96), rgba(22,7,46,0.98) 54%, rgba(6,4,18,0.99))'
          : 'linear-gradient(180deg, rgba(25,22,17,0.98), rgba(11,10,18,0.98) 54%, rgba(4,5,13,0.99))',
        border: `1.5px solid ${solo ? 'rgba(203,85,255,0.98)' : 'rgba(250,204,21,0.95)'}`,
        boxShadow: solo
          ? '0 0 22px rgba(192,68,255,0.62), 0 12px 24px rgba(0,0,0,0.42), inset 0 0 30px rgba(192,68,255,0.14)'
          : '0 0 22px rgba(250,204,21,0.42), 0 12px 24px rgba(0,0,0,0.42), inset 0 0 28px rgba(250,204,21,0.11)',
      }}
      aria-label={title.replace('\n', ' ')}
    >
      <span className="absolute inset-[1px] rounded-[16px] bg-gradient-to-b from-white/[0.11] via-transparent to-transparent" />
      <span
        className="absolute inset-x-0 top-0 h-20 opacity-80"
        style={{
          background: solo
            ? 'radial-gradient(ellipse at 50% 0%, rgba(217,70,239,0.34), transparent 70%)'
            : 'radial-gradient(ellipse at 50% 0%, rgba(250,204,21,0.22), transparent 70%)',
        }}
        aria-hidden="true"
      />
      <span
        className="relative z-10 mx-auto mb-3 flex items-center justify-center rounded-full border"
        style={{
          color: accent,
          width: 52,
          height: 52,
          background: 'rgba(0,0,0,0.22)',
          borderColor: solo ? 'rgba(214,97,255,0.88)' : 'rgba(250,204,21,0.88)',
          boxShadow: solo ? '0 0 22px rgba(192,68,255,0.58), inset 0 0 15px rgba(255,255,255,0.08)' : '0 0 22px rgba(250,204,21,0.42), inset 0 0 15px rgba(255,255,255,0.07)',
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
        minHeight: '100vh',
        height: '100svh',
        userSelect: 'none',
      }}
    >
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: 'radial-gradient(ellipse at 50% 36%, rgba(88,28,135,0.44), transparent 58%)' }}
      />

      <div
        className="relative z-10 mx-auto flex h-full w-full max-w-[440px] flex-col px-5"
        style={{
          paddingTop: 'calc(0.55rem + env(safe-area-inset-top))',
          paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))',
        }}
      >
        <header className="flex shrink-0 justify-center">
          <img
            src={LOGO_URL}
            alt="Kronox"
            draggable={false}
            className="object-contain"
            style={{
              width: 'clamp(212px, 66vw, 320px)',
              height: 'clamp(74px, 10svh, 122px)',
              filter: 'drop-shadow(0 0 14px rgba(250,204,21,0.86))',
            }}
          />
        </header>

        <section className="relative -mx-5 mt-0 min-h-0 flex-1">
          <img
            src={HERO_ASSET}
            alt=""
            draggable={false}
            className="mx-auto h-full w-full object-contain"
            style={{
              maxHeight: '100%',
              objectPosition: 'center top',
              pointerEvents: 'none',
            }}
          />
        </section>

        <section className="relative z-20 shrink-0" style={{ marginTop: 'calc(-1 * clamp(1.55rem, 5.1svh, 3.8rem))' }}>
          <PlayButton onClick={handleSolo} />

          <div className="mt-4 grid grid-cols-2 gap-4">
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
          </div>

          <div className="mt-3 flex items-center gap-3">
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
          </div>
        </section>
      </div>
    </main>
  );
}
