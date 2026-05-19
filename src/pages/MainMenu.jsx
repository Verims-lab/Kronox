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
      whileTap={{ scale: 0.965, y: 4 }}
      transition={{ type: 'spring', stiffness: 520, damping: 24 }}
      className="relative mx-auto flex w-full items-center justify-center gap-3 rounded-[22px] border-[3px] border-black/80 font-bangers text-[clamp(2.35rem,10.5vw,3.55rem)] leading-none text-black"
      style={{
        height: 'clamp(64px, 8.5svh, 92px)',
        background: 'linear-gradient(180deg, #fff06f 0%, #facc15 48%, #eda60a 100%)',
        boxShadow: '0 0 24px rgba(250,204,21,0.58), 0 11px 0 #6b2591, 0 16px 0 #19071f, inset 0 5px 0 rgba(255,255,255,0.34)',
      }}
      aria-label="Hemen oyna"
    >
      <span
        className="absolute -left-8 top-1/2 h-12 w-7 -translate-y-1/2"
        aria-hidden="true"
        style={{
          background: 'repeating-radial-gradient(ellipse at right, rgba(255,255,255,0.95) 0 2px, transparent 3px 8px)',
          clipPath: 'polygon(100% 0, 0 18%, 78% 50%, 0 82%, 100% 100%)',
        }}
      />
      HEMEN OYNA
      <Zap className="h-[0.76em] w-[0.76em] fill-black stroke-black" strokeWidth={2.7} />
      <span
        className="absolute -right-8 top-1/2 h-12 w-7 -translate-y-1/2 rotate-180"
        aria-hidden="true"
        style={{
          background: 'repeating-radial-gradient(ellipse at right, rgba(255,255,255,0.95) 0 2px, transparent 3px 8px)',
          clipPath: 'polygon(100% 0, 0 18%, 78% 50%, 0 82%, 100% 100%)',
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
      className="relative overflow-hidden rounded-[16px] px-3 py-4 text-center"
      style={{
        minHeight: 'clamp(138px, 18.5svh, 210px)',
        background: solo
          ? 'linear-gradient(180deg, rgba(64,13,105,0.92), rgba(16,7,35,0.98))'
          : 'linear-gradient(180deg, rgba(18,16,17,0.96), rgba(6,7,17,0.98))',
        border: `1.5px solid ${solo ? 'rgba(192,68,255,0.95)' : 'rgba(250,204,21,0.88)'}`,
        boxShadow: solo
          ? '0 0 18px rgba(192,68,255,0.58), inset 0 0 26px rgba(192,68,255,0.10)'
          : '0 0 18px rgba(250,204,21,0.38), inset 0 0 24px rgba(250,204,21,0.08)',
      }}
      aria-label={title.replace('\n', ' ')}
    >
      <span className="absolute inset-0 bg-gradient-to-b from-white/[0.08] via-transparent to-transparent" />
      <span
        className="relative mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full border"
        style={{
          color: accent,
          borderColor: solo ? 'rgba(192,68,255,0.72)' : 'rgba(250,204,21,0.72)',
          boxShadow: solo ? '0 0 20px rgba(192,68,255,0.44)' : '0 0 18px rgba(250,204,21,0.32)',
        }}
      >
        {icon}
      </span>
      <span
        className="relative block whitespace-pre-line font-bangers text-[clamp(1.55rem,6.6vw,2.25rem)] leading-[0.92]"
        style={{ color: solo ? '#c067ff' : '#f8fafc' }}
      >
        {title}
      </span>
      <span className="relative mt-3 block font-inter text-[clamp(0.72rem,3.1vw,0.94rem)] font-bold leading-snug text-white/78">
        {subtitle}
      </span>
      <span
        className="absolute inset-x-0 bottom-0 h-16 opacity-80"
        aria-hidden="true"
        style={{
          background: solo
            ? 'radial-gradient(ellipse at 50% 100%, rgba(168,85,247,0.72), transparent 70%)'
            : 'radial-gradient(ellipse at 50% 100%, rgba(250,204,21,0.48), transparent 72%)',
        }}
      />
    </motion.button>
  );
}

function ProfileBar({ user, onLogin, onLogout }) {
  return (
    <div
      className="flex min-w-0 flex-1 items-center gap-3 rounded-full border border-white/18 bg-black/64 px-3 py-2"
      style={{
        minHeight: 58,
        boxShadow: 'inset 0 0 20px rgba(255,255,255,0.04), 0 0 18px rgba(255,255,255,0.08)',
      }}
    >
      <span
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
        style={{
          background: 'linear-gradient(180deg, #9333ea, #581c87)',
          boxShadow: '0 0 18px rgba(168,85,247,0.55)',
        }}
      >
        <UserRound className="h-7 w-7 text-purple-200" />
      </span>
      {user ? (
        <>
          <div className="min-w-0 flex-1">
            <p className="truncate font-inter text-[15px] font-black text-white">{user.full_name || user.email}</p>
            <p className="font-inter text-[12px] font-bold text-primary/90">Hazır</p>
          </div>
          <button
            type="button"
            onClick={onLogout}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white/55"
            aria-label="Hesaptan çıkış yap"
          >
            <LogOut className="h-5 w-5" />
          </button>
        </>
      ) : (
        <button type="button" onClick={onLogin} className="min-w-0 flex-1 text-left" aria-label="Giriş yap veya kayıt ol">
          <span className="block truncate font-inter text-[15px] font-black text-white">Misafir Oyuncu</span>
          <span className="flex items-center gap-1 font-inter text-[12px] font-black text-primary">
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

        <section className="relative z-20 shrink-0" style={{ marginTop: 'calc(-1 * clamp(1.85rem, 5.8svh, 4.4rem))' }}>
          <PlayButton onClick={handleSolo} />

          <div className="mt-5 grid grid-cols-2 gap-4">
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

          <div className="mt-4 flex items-center gap-4">
            <ProfileBar user={user} onLogin={handleLogin} onLogout={handleLogout} />
            <motion.button
              type="button"
              onClick={handleSettings}
              whileTap={{ scale: 0.92, rotate: -8 }}
              transition={{ type: 'spring', stiffness: 520, damping: 24 }}
              className="flex h-[58px] w-[58px] shrink-0 items-center justify-center rounded-full border border-primary/70 bg-black/72 text-white"
              style={{
                boxShadow: '0 0 22px rgba(250,204,21,0.42), inset 0 0 18px rgba(255,255,255,0.07)',
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
