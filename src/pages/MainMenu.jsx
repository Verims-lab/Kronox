import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Crown, Settings, Zap, Globe, UserRound } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { sounds } from '@/lib/gameSounds';
import { tutorialState } from '@/lib/tutorialState';
import KronoxTutorial from '@/components/tutorial/KronoxTutorial';

const LOGO_URL = 'https://media.base44.com/images/public/69e753d5ab4c08a7c4287c25/49fc6f458_kronoxnobckgrnd.png';

function IconButton({ children, onClick, label }) {
  return (
    <motion.button
      whileTap={{ scale: 0.9 }}
      transition={{ type: 'spring', stiffness: 520, damping: 24 }}
      onClick={onClick}
      className="flex h-[56px] w-[56px] items-center justify-center rounded-[20px]"
      style={{
        background: 'linear-gradient(145deg, rgba(10,12,28,0.86), rgba(4,5,14,0.94))',
        border: '1.5px solid rgba(148,163,184,0.28)',
        boxShadow: '0 0 20px rgba(88,28,135,0.22), inset 0 0 18px rgba(255,255,255,0.05)',
      }}
      aria-label={label}
    >
      {children}
    </motion.button>
  );
}

function TimeCard({ year, tone, image, active, rotate, x, y, z }) {
  const colors = {
    yellow: ['#facc15', 'rgba(250,204,21,0.72)'],
    purple: ['#d946ef', 'rgba(217,70,239,0.55)'],
    blue: ['#38bdf8', 'rgba(56,189,248,0.55)'],
    amber: ['#fbbf24', 'rgba(251,191,36,0.48)'],
  }[tone];

  return (
    <div
      className="absolute left-1/2 top-1/2 overflow-hidden rounded-[12px]"
      style={{
        width: active ? '112px' : '82px',
        height: active ? '156px' : '126px',
        transform: `translate(-50%, -50%) translate(${x}px, ${y}px) rotate(${rotate}deg)`,
        zIndex: z,
        background: `linear-gradient(180deg, rgba(12,14,36,0.15), rgba(5,5,14,0.96)), ${image}`,
        border: `1.5px solid ${colors[0]}`,
        boxShadow: active
          ? `0 0 34px ${colors[1]}, inset 0 0 24px rgba(255,255,255,0.12)`
          : `0 0 18px ${colors[1]}, inset 0 0 18px rgba(255,255,255,0.08)`,
      }}
    >
      <div className="absolute inset-0 bg-gradient-to-b from-white/[0.1] via-transparent to-black/45" />
      <div className="absolute left-0 right-0 top-3 text-center font-bangers leading-none" style={{ color: colors[0], fontSize: active ? 28 : 17, textShadow: `0 0 12px ${colors[1]}` }}>
        {year}
      </div>
      <div
        className="absolute inset-x-0 bottom-0 h-[70%]"
        style={{
          background: active
            ? 'linear-gradient(to top, rgba(4,5,15,0.15), transparent), linear-gradient(120deg, transparent 0 35%, rgba(250,204,21,0.24) 36% 37%, transparent 38%), linear-gradient(90deg, #0b153d, #4c1d95 48%, #050816)'
            : 'linear-gradient(to top, rgba(0,0,0,0.4), transparent)',
          clipPath: active ? 'polygon(0 100%, 0 52%, 18% 44%, 18% 100%, 30% 100%, 30% 38%, 48% 30%, 48% 100%, 62% 100%, 62% 45%, 84% 35%, 84% 100%, 100% 100%)' : undefined,
        }}
      />
      {!active && (
        <div
          className="absolute bottom-5 left-1/2 h-16 w-16 -translate-x-1/2 rounded-full opacity-60"
          style={{ background: `radial-gradient(circle, ${colors[1]}, transparent 68%)` }}
        />
      )}
    </div>
  );
}

function ClockArena() {
  return (
    <div className="absolute inset-x-0 bottom-0 h-[168px]">
      <div
        className="absolute left-1/2 top-8 h-[116px] w-[310px] -translate-x-1/2 rounded-[50%]"
        style={{
          background: 'radial-gradient(ellipse at center, rgba(15,23,42,0.12), rgba(2,6,23,0.82) 56%, transparent 70%)',
          border: '1px solid rgba(167,139,250,0.24)',
          boxShadow: '0 0 44px rgba(79,70,229,0.42), inset 0 0 38px rgba(250,204,21,0.1)',
        }}
      />
      <div
        className="absolute left-1/2 top-[68px] h-[54px] w-[220px] -translate-x-1/2 rounded-[50%]"
        style={{
          border: '2px solid rgba(250,204,21,0.86)',
          boxShadow: '0 0 20px rgba(250,204,21,0.65), inset 0 0 18px rgba(168,85,247,0.36)',
        }}
      />
      <div
        className="absolute left-1/2 top-[78px] h-[38px] w-[168px] -translate-x-1/2 rounded-[50%]"
        style={{
          border: '2px solid rgba(99,102,241,0.92)',
          boxShadow: '0 0 24px rgba(99,102,241,0.76)',
        }}
      />
      {['XII', 'III', 'VI', 'IX'].map((label, index) => (
        <span
          key={label}
          className="absolute left-1/2 top-[86px] font-cinzel text-[10px] text-purple-100/70"
          style={{ transform: `translate(-50%, -50%) rotate(${index * 90}deg) translateY(-44px) rotate(${-index * 90}deg)` }}
        >
          {label}
        </span>
      ))}
      <span className="absolute left-1/2 top-[87px] h-10 w-[2px] origin-bottom -translate-x-1/2 rounded-full bg-purple-100 shadow-[0_0_12px_rgba(216,180,254,0.9)]" />
      <span className="absolute left-1/2 top-[106px] h-2 w-2 -translate-x-1/2 rounded-full bg-primary shadow-[0_0_16px_rgba(250,204,21,0.9)]" />
    </div>
  );
}

function TimelineArc() {
  return (
    <div className="relative h-[58px] w-full">
      <svg viewBox="0 0 390 68" className="absolute inset-x-[-8px] top-0 h-12 w-[calc(100%+16px)] overflow-visible" aria-hidden="true">
        <path d="M0 58 C90 34 290 34 390 58" fill="none" stroke="rgba(168,85,247,0.92)" strokeWidth="2.2" />
        <path d="M0 58 C90 34 290 34 390 58" fill="none" stroke="rgba(126,34,206,0.58)" strokeWidth="9" />
      </svg>
      {[9, 34, 50, 70, 94].map(left => (
        <span
          key={left}
          className="absolute top-[30px] h-3 w-3 rounded-full bg-purple-300"
          style={{ left: `${left}%`, boxShadow: '0 0 14px rgba(216,180,254,0.9)' }}
        />
      ))}
      <span
        className="absolute top-[22px] h-7 w-7"
        style={{ left: '69%', filter: 'drop-shadow(0 0 15px rgba(250,204,21,0.95))' }}
      >
        <span className="absolute inset-0 bg-primary" style={{ clipPath: 'polygon(50% 0, 62% 38%, 100% 50%, 62% 62%, 50% 100%, 38% 62%, 0 50%, 38% 38%)' }} />
      </span>
      <div className="absolute inset-x-0 bottom-0 flex justify-between px-4 font-inter text-[13px] font-black text-white/45">
        <span>1800</span>
        <span>1900</span>
        <span className="text-primary drop-shadow-[0_0_10px_rgba(250,204,21,0.8)]">2000</span>
        <span>2025</span>
      </div>
    </div>
  );
}

function HeroStage() {
  return (
    <section className="relative mt-0 text-center">
      <div className="relative mx-auto w-full max-w-[430px]" style={{ height: 'clamp(340px, 47svh, 476px)' }}>
        <div
          className="absolute inset-x-[-56px] top-[-88px] h-[520px]"
          style={{
            background: [
              'radial-gradient(ellipse at 50% 45%, rgba(88,28,135,0.82), rgba(49,20,93,0.28) 38%, transparent 66%)',
              'radial-gradient(circle at 72% 42%, rgba(250,204,21,0.24), transparent 23%)',
              'radial-gradient(circle at 20% 58%, rgba(99,102,241,0.26), transparent 24%)',
            ].join(', '),
          }}
        />
        <div
          className="absolute inset-x-[-38px] top-[88px] h-[260px] opacity-70"
          style={{
            background: 'repeating-conic-gradient(from 8deg at 50% 78%, rgba(168,85,247,0.34) 0deg 2deg, transparent 2deg 11deg)',
            maskImage: 'radial-gradient(ellipse at 50% 70%, black 0 43%, transparent 70%)',
            WebkitMaskImage: 'radial-gradient(ellipse at 50% 70%, black 0 43%, transparent 70%)',
          }}
        />

        <div className="absolute inset-x-0 top-[22px] z-30">
          <p className="font-inter text-[20px] font-black leading-none text-white drop-shadow-[0_2px_13px_rgba(255,255,255,0.22)]">
            KARTI DOĞRU YERE KOY,
          </p>
          <p className="mt-2 font-bangers text-[31px] leading-none text-primary drop-shadow-[0_0_16px_rgba(250,204,21,0.78)]">
            ZAMANI SEN YÖNET
          </p>
        </div>

        <div className="absolute inset-x-0 top-[96px] h-[220px]">
          <TimeCard year="1867" tone="purple" x={-156} y={32} rotate={-22} z={1} image="linear-gradient(160deg, rgba(147,51,234,0.22), rgba(3,7,18,0.95))" />
          <TimeCard year="1903" tone="blue" x={-104} y={12} rotate={-13} z={2} image="linear-gradient(160deg, rgba(14,165,233,0.22), rgba(3,7,18,0.96))" />
          <TimeCard year="1969" tone="amber" x={-52} y={-3} rotate={-6} z={3} image="linear-gradient(160deg, rgba(251,191,36,0.18), rgba(3,7,18,0.96))" />
          <TimeCard year="2000" tone="yellow" active x={0} y={0} rotate={0} z={5} image="linear-gradient(160deg, rgba(250,204,21,0.22), rgba(8,10,32,0.96))" />
          <TimeCard year="1981" tone="purple" x={62} y={0} rotate={8} z={4} image="linear-gradient(160deg, rgba(217,70,239,0.24), rgba(3,7,18,0.96))" />
          <TimeCard year="2010" tone="blue" x={124} y={18} rotate={15} z={2} image="linear-gradient(160deg, rgba(14,165,233,0.22), rgba(3,7,18,0.96))" />
        </div>

        <ClockArena />
        <div className="absolute inset-x-0 bottom-0 z-40">
          <TimelineArc />
        </div>
      </div>
    </section>
  );
}

function ModeCard({ type, title, subtitle, icon, onClick }) {
  const solo = type === 'solo';
  return (
    <motion.button
      onClick={onClick}
      whileTap={{ scale: 0.96, y: 2 }}
      transition={{ type: 'spring', stiffness: 420, damping: 24 }}
      className="relative overflow-hidden rounded-[14px] px-3 py-4 text-center"
      style={{
        minHeight: 'clamp(136px, 18svh, 190px)',
        background: solo
          ? 'linear-gradient(180deg, rgba(59,15,104,0.88), rgba(19,8,42,0.98))'
          : 'linear-gradient(180deg, rgba(20,17,12,0.95), rgba(8,7,18,0.98))',
        border: solo ? '1.5px solid rgba(168,85,247,0.98)' : '1.5px solid rgba(250,204,21,0.68)',
        boxShadow: solo ? '0 0 18px rgba(168,85,247,0.58)' : '0 0 14px rgba(250,204,21,0.28)',
      }}
    >
      <span className="absolute inset-0 bg-gradient-to-b from-white/[0.08] to-transparent" />
      <span
        className="relative mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full border"
        style={{
          color: solo ? '#c084fc' : '#facc15',
          borderColor: solo ? 'rgba(192,132,252,0.62)' : 'rgba(250,204,21,0.55)',
          boxShadow: solo ? '0 0 18px rgba(168,85,247,0.42)' : '0 0 16px rgba(250,204,21,0.24)',
        }}
      >
        {icon}
      </span>
      <span className={`relative block font-bangers text-[25px] leading-[0.94] ${solo ? 'text-purple-300' : 'text-white'}`}>
        {title}
      </span>
      <span className="relative mt-3 block font-inter text-[12px] font-bold leading-snug text-white/[0.68]">
        {subtitle}
      </span>
      <span
        className="absolute inset-x-0 bottom-0 h-14 opacity-70"
        style={{
          background: solo
            ? 'radial-gradient(ellipse at 50% 100%, rgba(168,85,247,0.58), transparent 70%)'
            : 'radial-gradient(ellipse at 50% 100%, rgba(250,204,21,0.34), transparent 72%)',
        }}
      />
    </motion.button>
  );
}

export default function MainMenu() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [showTutorial, setShowTutorial] = useState(false);

  useEffect(() => {
    base44.auth.me().then((u) => setUser(u || null)).catch(() => setUser(null));
    if (!tutorialState.hasSeen()) setShowTutorial(true);
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

  return (
    <>
      <AnimatePresence>
        {showTutorial && (
          <KronoxTutorial
            onDone={() => setShowTutorial(false)}
            onSkip={() => setShowTutorial(false)}
          />
        )}
      </AnimatePresence>

      <div
        className="relative min-h-screen overflow-hidden text-white"
        style={{ background: '#02030b', userSelect: 'none' }}
      >
        <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse at 50% 36%, rgba(57,18,116,0.74), transparent 56%)' }} />
        <div className="absolute inset-0 pointer-events-none opacity-55" style={{ backgroundImage: 'radial-gradient(circle at 22% 20%, rgba(250,204,21,0.22) 0 1px, transparent 2px), radial-gradient(circle at 74% 15%, rgba(168,85,247,0.24) 0 1px, transparent 2px), radial-gradient(circle at 82% 47%, rgba(59,130,246,0.25) 0 1px, transparent 2px)', backgroundSize: '62px 78px, 74px 92px, 86px 80px' }} />

        <main
          className="relative z-10 mx-auto flex min-h-screen w-full max-w-[430px] flex-col px-6"
          style={{ paddingTop: 'calc(1rem + env(safe-area-inset-top))', paddingBottom: 'calc(0.55rem + env(safe-area-inset-bottom))' }}
        >
          <div className="grid grid-cols-[56px_1fr_56px] items-start gap-2">
            <IconButton onClick={() => navigate('/settings')} label="Rekorlar ve ayarlar">
              <Crown className="h-6 w-6 text-primary drop-shadow-[0_0_10px_rgba(250,204,21,0.75)]" />
            </IconButton>
            <div className="flex min-w-0 justify-center">
              <motion.img
                src={LOGO_URL}
                alt="Kronox"
                className="h-[84px] object-contain"
                style={{ width: 'clamp(202px, 60vw, 250px)', filter: 'drop-shadow(0 0 16px rgba(250,204,21,0.92))' }}
                initial={{ opacity: 0, y: -8, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.28 }}
              />
            </div>
            <IconButton onClick={() => navigate('/settings')} label="Ayarlar">
              <Settings className="h-6 w-6 text-white/80 drop-shadow-[0_0_10px_rgba(255,255,255,0.55)]" />
            </IconButton>
          </div>

          <HeroStage />

          <section className="relative mt-2">
            <motion.button
              onClick={handleSolo}
              whileTap={{ scale: 0.965, y: 3 }}
              transition={{ type: 'spring', stiffness: 520, damping: 23 }}
              className="relative flex w-full items-center justify-center gap-4 rounded-[23px] border-[3px] border-black/75 font-bangers text-[40px] leading-none text-black"
              style={{
                height: 'clamp(68px, 8.5svh, 84px)',
                background: 'linear-gradient(180deg, #ffe66b 0%, #facc15 52%, #eda90a 100%)',
                boxShadow: '0 0 26px rgba(250,204,21,0.58), 0 11px 0 #552077, 0 16px 0 #13051d, inset 0 4px 0 rgba(255,255,255,0.32)',
              }}
            >
              HEMEN OYNA
              <Zap className="h-8 w-8 fill-black stroke-black" />
            </motion.button>
          </section>

          <section className="mt-5">
            <div className="mb-3 flex items-center gap-4">
              <span className="h-px flex-1 bg-gradient-to-r from-transparent via-white/20 to-white/10" />
              <span className="font-inter text-[14px] font-black tracking-widest text-white/55">OYUN MODUNU SEÇ</span>
              <span className="h-px flex-1 bg-gradient-to-r from-white/10 via-white/20 to-transparent" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <ModeCard
                type="solo"
                title={<>SOLO<br />MEYDAN OKUMA</>}
                subtitle={<>Kendine karşı yarış,<br />zamanı yen!</>}
                icon={<UserRound strokeWidth={1.65} className="h-7 w-7" />}
                onClick={handleSolo}
              />
              <ModeCard
                type="online"
                title={<>ONLINE<br />BATTLE</>}
                subtitle={<>Gerçek oyunculara<br />karşı oyna!</>}
                icon={<Globe strokeWidth={1.8} className="h-7 w-7" />}
                onClick={handleOnline}
              />
            </div>
          </section>

          <div className="mt-auto pt-3 text-center">
            <p className="font-inter text-[13px] font-semibold text-white/25">{user?.full_name || user?.email || ''}</p>
          </div>
        </main>
      </div>
    </>
  );
}
