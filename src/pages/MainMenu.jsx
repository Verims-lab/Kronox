import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Crown, Settings, Zap, Globe, LogIn, UserRound } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { sounds } from '@/lib/gameSounds';
import { tutorialState } from '@/lib/tutorialState';
import KronoxTutorial from '@/components/tutorial/KronoxTutorial';

const LOGO_URL = 'https://media.base44.com/images/public/69e753d5ab4c08a7c4287c25/49fc6f458_kronoxnobckgrnd.png';

function Skyline() {
  const left = [
    [8, 118, 24], [31, 82, 18], [52, 106, 20], [73, 66, 22], [94, 112, 16],
  ];
  const right = [
    [17, 94, 18], [40, 64, 22], [64, 114, 18], [83, 78, 24], [104, 124, 20],
  ];

  const renderTower = ([x, h, w], side) => (
    <div
      key={`${side}-${x}`}
      className="absolute bottom-0"
      style={{
        [side]: `${x}%`,
        width: w,
        height: h,
        background: 'linear-gradient(180deg, rgba(12,10,30,0.9), rgba(2,4,15,0.98))',
        borderLeft: '1px solid rgba(168,85,247,0.28)',
        boxShadow: 'inset 0 0 16px rgba(126,34,206,0.24), 0 0 24px rgba(76,29,149,0.2)',
        clipPath: 'polygon(0 12%, 100% 0, 100% 100%, 0 100%)',
      }}
    >
      {[18, 38, 59].map((top, i) => (
        <span
          key={top}
          className="absolute rounded-sm"
          style={{
            top: `${top}%`,
            left: i % 2 ? '58%' : '22%',
            width: 3,
            height: 10,
            background: i === 1 ? 'rgba(250,204,21,0.55)' : 'rgba(168,85,247,0.65)',
            boxShadow: '0 0 10px currentColor',
          }}
        />
      ))}
    </div>
  );

  return (
    <div className="absolute inset-x-0 bottom-0 h-40 overflow-hidden">
      <div
        className="absolute inset-x-0 bottom-0 h-28"
        style={{
          background: 'linear-gradient(180deg, rgba(46,16,101,0), rgba(46,16,101,0.5) 45%, rgba(3,4,14,0.94) 100%)',
        }}
      />
      {left.map(t => renderTower(t, 'left'))}
      {right.map(t => renderTower(t, 'right'))}
      <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-[#03040e] to-transparent" />
    </div>
  );
}

function NeonClock() {
  const tickAngles = [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330];
  return (
    <div className="relative mx-auto h-36 w-36">
      <motion.div
        className="absolute inset-0 rounded-full"
        animate={{
          boxShadow: [
            '0 0 24px rgba(168,85,247,0.55), inset 0 0 22px rgba(168,85,247,0.2)',
            '0 0 42px rgba(168,85,247,0.82), inset 0 0 32px rgba(168,85,247,0.32)',
            '0 0 24px rgba(168,85,247,0.55), inset 0 0 22px rgba(168,85,247,0.2)',
          ],
        }}
        transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
        style={{
          border: '3px solid rgba(192,132,252,0.95)',
          background: 'radial-gradient(circle, rgba(88,28,135,0.18), rgba(7,8,28,0.22) 60%, rgba(0,0,0,0.16))',
        }}
      />
      {tickAngles.map(angle => (
        <span
          key={angle}
          className="absolute left-1/2 top-1/2 rounded-full bg-purple-200"
          style={{
            width: angle % 90 === 0 ? 16 : 7,
            height: 3,
            transform: `translate(-50%, -50%) rotate(${angle}deg) translateX(54px)`,
            boxShadow: '0 0 8px rgba(216,180,254,0.9)',
          }}
        />
      ))}
      <span
        className="absolute left-1/2 top-1/2 rounded-full bg-purple-300"
        style={{ width: 4, height: 50, transform: 'translate(-50%, -100%) rotate(-45deg)', transformOrigin: 'bottom center', boxShadow: '0 0 10px rgba(216,180,254,0.9)' }}
      />
      <span
        className="absolute left-1/2 top-1/2 rounded-full bg-purple-400"
        style={{ width: 4, height: 42, transform: 'translate(-50%, -100%) rotate(45deg)', transformOrigin: 'bottom center', boxShadow: '0 0 10px rgba(192,132,252,0.9)' }}
      />
      <span className="absolute left-1/2 top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-purple-500 shadow-[0_0_18px_rgba(168,85,247,0.9)]" />
    </div>
  );
}

function TimelineArc() {
  const ticks = [
    { left: '7%', h: 18 }, { left: '22%', h: 32 }, { left: '34%', h: 16 }, { left: '50%', h: 34 },
    { left: '62%', h: 16 }, { left: '69%', h: 20 }, { left: '82%', h: 28 }, { left: '96%', h: 36 },
  ];

  return (
    <div className="relative h-24 w-full">
      <svg viewBox="0 0 390 90" className="absolute inset-x-0 top-0 h-16 w-full overflow-visible" aria-hidden="true">
        <path d="M0 58 C96 32 286 32 390 58" fill="none" stroke="rgba(216,180,254,0.95)" strokeWidth="2.4" />
        <path d="M0 58 C96 32 286 32 390 58" fill="none" stroke="rgba(168,85,247,0.45)" strokeWidth="8" />
        <path d="M210 43 C246 40 280 42 318 48" fill="none" stroke="rgba(250,204,21,0.8)" strokeWidth="2.8" />
      </svg>
      {ticks.map(t => (
        <span
          key={t.left}
          className="absolute top-5 w-1 rounded-full bg-purple-300"
          style={{ left: t.left, height: t.h, boxShadow: '0 0 10px rgba(216,180,254,0.8)' }}
        />
      ))}
      <motion.span
        className="absolute top-7 h-8 w-8"
        style={{ left: '69%', color: '#facc15' }}
        animate={{ scale: [1, 1.18, 1], opacity: [0.9, 1, 0.9] }}
        transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
      >
        <span
          className="absolute inset-0"
          style={{
            background: '#facc15',
            clipPath: 'polygon(50% 0, 62% 38%, 100% 50%, 62% 62%, 50% 100%, 38% 62%, 0 50%, 38% 38%)',
            filter: 'drop-shadow(0 0 14px rgba(250,204,21,0.95))',
          }}
        />
      </motion.span>
      <div className="absolute inset-x-0 bottom-0 flex justify-between px-5 font-inter text-xl font-bold text-purple-200/70">
        <span>1800</span>
        <span>1900</span>
        <span className="text-primary drop-shadow-[0_0_10px_rgba(250,204,21,0.7)]">2000</span>
        <span>2025</span>
      </div>
    </div>
  );
}

function ModeCard({ type, title, subtitle, icon, onClick }) {
  const solo = type === 'solo';
  return (
    <motion.button
      onClick={onClick}
      whileTap={{ scale: 0.95, y: 2 }}
      transition={{ type: 'spring', stiffness: 420, damping: 24 }}
      className="relative min-h-[160px] overflow-hidden rounded-[28px] px-3 py-5 text-center"
      style={{
        background: solo
          ? 'linear-gradient(145deg, rgba(67,18,116,0.86), rgba(18,8,42,0.94))'
          : 'linear-gradient(145deg, rgba(22,17,12,0.94), rgba(9,8,22,0.96))',
        border: solo ? '2px solid rgba(216,180,254,0.95)' : '2px solid rgba(250,204,21,0.82)',
        boxShadow: solo
          ? '0 0 24px rgba(168,85,247,0.52), inset 0 0 30px rgba(168,85,247,0.14)'
          : '0 0 22px rgba(250,204,21,0.3), inset 0 0 30px rgba(250,204,21,0.08)',
      }}
    >
      <span className="absolute inset-0 bg-gradient-to-b from-white/[0.08] to-transparent opacity-80" />
      <span className="relative mx-auto mb-4 flex h-14 w-14 items-center justify-center text-[52px]" style={{ color: solo ? '#d8b4fe' : '#facc15' }}>
        {icon}
      </span>
      <span className="relative block font-bangers text-[30px] leading-[0.95] tracking-wider text-white">
        {title}
      </span>
      <span className="relative mt-4 block font-inter text-[15px] font-medium leading-snug text-white/[0.8]">
        {subtitle}
      </span>
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
    if (!user) {
      base44.auth.redirectToLogin('/');
    } else {
      navigate('/lobby');
    }
  };

  const handleHemenOyna = () => {
    sounds.tap();
    navigate('/solo');
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
        className="relative min-h-screen overflow-x-hidden text-white"
        style={{
          background: 'linear-gradient(180deg, #030511 0%, #080420 38%, #05030d 100%)',
          paddingTop: 'env(safe-area-inset-top)',
          paddingBottom: 'env(safe-area-inset-bottom)',
          userSelect: 'none',
        }}
      >
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'radial-gradient(ellipse at 50% 32%, rgba(88,28,135,0.6) 0%, rgba(30,10,70,0.22) 34%, rgba(3,5,17,0) 66%)',
          }}
        />
        <div
          className="absolute inset-0 pointer-events-none opacity-55"
          style={{
            backgroundImage: 'linear-gradient(rgba(168,85,247,0.16) 1px, transparent 1px), linear-gradient(90deg, rgba(168,85,247,0.12) 1px, transparent 1px)',
            backgroundSize: '34px 34px',
            maskImage: 'linear-gradient(to bottom, transparent 0%, black 18%, transparent 72%)',
            WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 18%, transparent 72%)',
          }}
        />

        <Skyline />

        <main
          className="relative z-10 mx-auto flex min-h-screen w-full max-w-[430px] flex-col px-5"
          style={{ paddingTop: 'calc(1rem + env(safe-area-inset-top))', paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}
        >
          <div className="flex items-center justify-between">
            <motion.button
              whileTap={{ scale: 0.88 }}
              transition={{ type: 'spring', stiffness: 500, damping: 24 }}
              onClick={() => navigate('/settings')}
              className="flex h-[56px] w-[56px] items-center justify-center rounded-[22px]"
              style={{
                background: 'rgba(5,7,22,0.68)',
                border: '2px solid rgba(168,85,247,0.56)',
                boxShadow: '0 0 24px rgba(126,34,206,0.34), inset 0 0 18px rgba(126,34,206,0.12)',
              }}
              aria-label="Liderlik ve ayarlar"
            >
              <Crown className="h-7 w-7 text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.75)]" />
            </motion.button>

            <motion.img
              src={LOGO_URL}
              alt="Kronox"
              className="h-[86px] object-contain"
              style={{ width: 'clamp(178px, 54vw, 230px)' }}
              initial={{ opacity: 0, y: -10, scale: 0.96 }}
              animate={{
                opacity: 1,
                y: 0,
                scale: 1,
                filter: [
                  'drop-shadow(0 0 10px rgba(250,204,21,0.7))',
                  'drop-shadow(0 0 22px rgba(250,204,21,0.95))',
                  'drop-shadow(0 0 10px rgba(250,204,21,0.7))',
                ],
              }}
              transition={{ filter: { duration: 2.4, repeat: Infinity, ease: 'easeInOut' }, default: { duration: 0.36 } }}
            />

            <motion.button
              whileTap={{ scale: 0.88 }}
              transition={{ type: 'spring', stiffness: 500, damping: 24 }}
              onClick={() => navigate('/settings')}
              className="flex h-[56px] w-[56px] items-center justify-center rounded-[22px]"
              style={{
                background: 'rgba(5,7,22,0.68)',
                border: '2px solid rgba(168,85,247,0.56)',
                boxShadow: '0 0 24px rgba(126,34,206,0.34), inset 0 0 18px rgba(126,34,206,0.12)',
              }}
              aria-label="Ayarlar"
            >
              <Settings className="h-7 w-7 text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.7)]" />
            </motion.button>
          </div>

          <motion.section
            className="mt-5 text-center"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.34 }}
          >
            <p className="font-inter text-[27px] font-black leading-[1.05] tracking-wide text-white drop-shadow-[0_2px_10px_rgba(255,255,255,0.2)]">
              KARTI DOĞRU YERE KOY,
            </p>
            <p className="mt-2 font-bangers text-[42px] leading-none tracking-wide text-primary drop-shadow-[0_0_18px_rgba(250,204,21,0.68)]">
              ZAMANI SEN YÖNET
            </p>
          </motion.section>

          <section className="relative mt-8">
            <NeonClock />
          </section>

          <section className="relative -mt-3">
            <TimelineArc />
          </section>

          <motion.section
            className="relative mt-6"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.34, delay: 0.08 }}
          >
            <div
              className="rounded-[34px] p-[9px]"
              style={{
                background: 'linear-gradient(135deg, rgba(168,85,247,0.85), rgba(76,29,149,0.18) 48%, rgba(168,85,247,0.82))',
                boxShadow: '0 0 34px rgba(168,85,247,0.38), inset 0 0 22px rgba(216,180,254,0.13)',
                clipPath: 'polygon(8% 0, 92% 0, 100% 50%, 92% 100%, 8% 100%, 0 50%)',
              }}
            >
              <motion.button
                onClick={handleHemenOyna}
                whileTap={{ scale: 0.965 }}
                animate={{
                  boxShadow: [
                    '0 0 22px rgba(250,204,21,0.6), 0 12px 26px rgba(0,0,0,0.55)',
                    '0 0 42px rgba(250,204,21,0.92), 0 14px 34px rgba(0,0,0,0.58)',
                    '0 0 22px rgba(250,204,21,0.6), 0 12px 26px rgba(0,0,0,0.55)',
                  ],
                }}
                transition={{ boxShadow: { duration: 1.8, repeat: Infinity, ease: 'easeInOut' }, scale: { type: 'spring', stiffness: 500, damping: 24 } }}
                className="flex h-[74px] w-full items-center justify-center gap-5 font-bangers text-[38px] leading-none tracking-wide"
                style={{
                  background: 'linear-gradient(180deg, #ffe24a 0%, #facc15 42%, #f0b400 100%)',
                  color: '#090909',
                  clipPath: 'polygon(6% 0, 94% 0, 100% 50%, 94% 100%, 6% 100%, 0 50%)',
                }}
              >
                HEMEN OYNA
                <Zap className="h-10 w-10 fill-black stroke-black" />
              </motion.button>
            </div>
          </motion.section>

          <section className="mt-6">
            <div className="mb-5 flex items-center gap-4">
              <span className="h-px flex-1 bg-gradient-to-r from-transparent via-purple-300/65 to-white/10" />
              <span className="font-inter text-[18px] font-black tracking-widest text-white/60">BİR MOD SEÇ</span>
              <span className="h-px flex-1 bg-gradient-to-r from-white/10 via-purple-300/65 to-transparent" />
            </div>

            <div className="grid grid-cols-2 gap-5">
              <ModeCard
                type="solo"
                title={<>SOLO<br />MEYDAN OKUMA</>}
                subtitle={<>Kendine karşı yarış,<br />zamanı yen!</>}
                icon={<UserRound strokeWidth={1.7} className="h-14 w-14" />}
                onClick={handleSolo}
              />
              <ModeCard
                type="online"
                title={<>ONLINE<br />BATTLE</>}
                subtitle={<>Gerçek oyunculara<br />karşı oyna!</>}
                icon={<Globe strokeWidth={1.8} className="h-14 w-14" />}
                onClick={handleOnline}
              />
            </div>
          </section>

          <div className="mt-auto pt-4 text-center">
            {user ? (
              <p className="font-inter text-xs text-white/[0.35]">{user.full_name || user.email}</p>
            ) : (
              <button
                onClick={() => base44.auth.redirectToLogin('/')}
                className="mx-auto flex min-h-[44px] items-center justify-center gap-2 rounded-full px-4 font-inter text-xs font-semibold text-white/[0.55] transition-colors hover:text-primary"
              >
                <LogIn className="h-4 w-4" />
                Online oynamak için giriş yap
              </button>
            )}
          </div>
        </main>
      </div>
    </>
  );
}
