import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Settings, Trophy, Zap, Globe, LogIn } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { sounds } from '@/lib/gameSounds';
import { tutorialState } from '@/lib/tutorialState';
import KronoxTutorial from '@/components/tutorial/KronoxTutorial';

// Hero background — uses /assets/ui/home-hero.webp if present, else animated CSS
function HeroBackground() {
  const [heroLoaded, setHeroLoaded] = React.useState(false);
  const [heroFailed, setHeroFailed] = React.useState(false);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {/* Static hero asset (if uploaded) */}
      {!heroFailed && (
        <img
          src="/assets/ui/home-hero.webp"
          alt=""
          onLoad={() => setHeroLoaded(true)}
          onError={() => setHeroFailed(true)}
          className="absolute inset-0 w-full h-full object-cover"
          style={{ opacity: heroLoaded ? 0.55 : 0, transition: 'opacity 0.4s ease' }}
        />
      )}
      {/* Always-on overlay tint */}
      <div
        className="absolute inset-0"
        style={{
          background: heroLoaded && !heroFailed
            ? 'linear-gradient(180deg, rgba(10,4,20,0.3) 0%, rgba(10,4,20,0.85) 100%)'
            : 'radial-gradient(ellipse 80% 60% at 50% 40%, rgba(120,40,200,0.35) 0%, rgba(30,10,60,0.7) 60%, transparent 100%)',
        }}
      />
      {/* Floating orb (always shown) */}
      <motion.div
        className="absolute rounded-full"
        style={{ width: 300, height: 300, top: '5%', left: '50%', transform: 'translateX(-50%)', background: 'radial-gradient(circle, rgba(140,60,220,0.18) 0%, transparent 70%)' }}
        animate={{ scale: [1, 1.15, 1], opacity: [0.6, 1, 0.6] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
      />
      {/* Animated clock (shown only when no hero image) */}
      {(heroFailed || !heroLoaded) && (
        <>
          <motion.div
            className="absolute rounded-full border-2"
            style={{
              width: 140, height: 140,
              top: '12%', left: '50%', transform: 'translateX(-50%)',
              borderColor: 'rgba(160,80,255,0.5)',
              background: 'radial-gradient(circle, rgba(120,40,200,0.15) 0%, transparent 70%)',
              boxShadow: '0 0 40px rgba(160,80,255,0.3), inset 0 0 30px rgba(160,80,255,0.1)',
            }}
            animate={{ boxShadow: ['0 0 30px rgba(160,80,255,0.2)', '0 0 60px rgba(160,80,255,0.5)', '0 0 30px rgba(160,80,255,0.2)'] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
          />
          <div className="absolute" style={{ top: '12%', left: '50%', transform: 'translateX(-50%)', width: 140, height: 140 }}>
            <motion.div
              className="absolute rounded-full"
              style={{ width: 2, height: 40, background: 'rgba(200,150,255,0.8)', top: '50%', left: '50%', transformOrigin: 'bottom center', marginLeft: -1, marginTop: -40 }}
              animate={{ rotate: 360 }}
              transition={{ duration: 12, repeat: Infinity, ease: 'linear' }}
            />
            <motion.div
              className="absolute rounded-full"
              style={{ width: 2, height: 55, background: 'rgba(255,220,50,0.9)', top: '50%', left: '50%', transformOrigin: 'bottom center', marginLeft: -1, marginTop: -55 }}
              animate={{ rotate: 360 }}
              transition={{ duration: 60, repeat: Infinity, ease: 'linear' }}
            />
            <div className="absolute w-3 h-3 rounded-full bg-yellow-400" style={{ top: '50%', left: '50%', transform: 'translate(-50%,-50%)', boxShadow: '0 0 8px rgba(250,204,21,0.8)' }} />
          </div>
        </>
      )}
    </div>
  );
}

// Timeline strip — uses /assets/ui/timeline-hero.webp if present, else CSS version
function TimelineStrip() {
  const [imgFailed, setImgFailed] = React.useState(false);
  const [imgLoaded, setImgLoaded] = React.useState(false);
  const years = [1800, 1900, 2000, 2025];

  if (!imgFailed) {
    return (
      <div className="w-full relative overflow-hidden rounded-xl" style={{ minHeight: 64 }}>
        <img
          src="/assets/ui/timeline-hero.webp"
          alt="Timeline"
          onLoad={() => setImgLoaded(true)}
          onError={() => setImgFailed(true)}
          className="w-full object-cover rounded-xl"
          style={{ maxHeight: 90, opacity: imgLoaded ? 1 : 0, transition: 'opacity 0.3s ease' }}
        />
        {/* Fallback CSS shown until image loads */}
        {!imgLoaded && <TimelineCSS years={years} />}
      </div>
    );
  }

  return <TimelineCSS years={years} />;
}

function TimelineCSS({ years }) {
  return (
    <div className="w-full flex items-center justify-between px-2 py-3 relative">
      <div className="absolute inset-y-1/2 left-4 right-4 h-px bg-white/20" />
      <motion.div
        className="absolute"
        style={{ left: '62%', top: '50%', transform: 'translate(-50%,-50%)' }}
        animate={{ opacity: [0.6, 1, 0.6] }}
        transition={{ duration: 1.5, repeat: Infinity }}
      >
        <div className="w-3 h-3 rounded-full bg-yellow-400" style={{ boxShadow: '0 0 12px rgba(250,204,21,0.9)' }} />
        <div className="absolute -top-1 -left-1 w-5 h-5 rounded-full border border-yellow-400/40" />
      </motion.div>
      {years.map((y) => (
        <div key={y} className="flex flex-col items-center gap-1 relative z-10">
          <div className="w-1.5 h-1.5 rounded-full bg-white/50" />
          <span className="font-inter text-[11px] font-semibold text-white/60">{y}</span>
        </div>
      ))}
    </div>
  );
}

export default function MainMenu() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [showTutorial, setShowTutorial] = useState(false);

  useEffect(() => {
    base44.auth.me().then(u => setUser(u || null)).catch(() => setUser(null));
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
        className="min-h-screen flex flex-col items-center relative overflow-hidden"
        style={{
          background: 'linear-gradient(180deg, #0a0414 0%, #120820 35%, #0d0618 100%)',
          paddingTop: 'env(safe-area-inset-top)',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
      >
        {/* Hero background */}
        <div className="absolute inset-0 pointer-events-none" style={{ height: '52vh' }}>
          <HeroBackground />
        </div>

        <div className="relative z-10 w-full max-w-sm mx-auto flex flex-col items-center px-4"
          style={{ paddingTop: 'calc(0.75rem + env(safe-area-inset-top))' }}>

          {/* Top row */}
          <div className="w-full flex items-center justify-between mb-1">
            <motion.button
              whileTap={{ scale: 0.88 }}
              onClick={() => navigate('/settings')}
              className="w-11 h-11 rounded-2xl flex items-center justify-center"
              style={{ background: 'rgba(255,255,255,0.07)', border: '1.5px solid rgba(255,255,255,0.12)', minHeight: 44, minWidth: 44 }}
              aria-label="Liderlik"
            >
              <Trophy className="w-5 h-5 text-yellow-400" />
            </motion.button>

            {/* Logo */}
            <motion.div
              initial={{ opacity: 0, y: -12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <motion.img
                src="https://media.base44.com/images/public/69e753d5ab4c08a7c4287c25/49fc6f458_kronoxnobckgrnd.png"
                alt="Kronox"
                className="h-16 object-contain"
                animate={{ filter: ['drop-shadow(0 0 8px rgba(250,204,21,0.4))', 'drop-shadow(0 0 20px rgba(250,204,21,0.75))', 'drop-shadow(0 0 8px rgba(250,204,21,0.4))'] }}
                transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
              />
            </motion.div>

            <motion.button
              whileTap={{ scale: 0.88 }}
              onClick={() => navigate('/settings')}
              className="w-11 h-11 rounded-2xl flex items-center justify-center"
              style={{ background: 'rgba(255,255,255,0.07)', border: '1.5px solid rgba(255,255,255,0.12)', minHeight: 44, minWidth: 44 }}
              aria-label="Ayarlar"
            >
              <Settings className="w-5 h-5 text-white/60" />
            </motion.button>
          </div>

          {/* Clock + timeline visual area */}
          <motion.div
            className="w-full relative"
            style={{ height: 140 }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            {/* Spacer for the clock drawn in HeroBackground */}
          </motion.div>

          {/* Hero headline */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.45 }}
            className="text-center mb-1 px-2"
          >
            <p className="font-inter text-base font-semibold text-white/90 leading-snug">
              KARTı DOĞRU YERE KOY,
            </p>
            <p className="font-bangers text-2xl tracking-wider leading-tight" style={{ color: '#facc15', textShadow: '0 0 16px rgba(250,204,21,0.5)' }}>
              ZAMANI SEN YÖNET
            </p>
          </motion.div>

          {/* Timeline strip */}
          <motion.div
            className="w-full rounded-2xl px-2 mb-4"
            style={{
              background: 'rgba(0,0,0,0.35)',
              border: '1px solid rgba(255,255,255,0.08)',
              backdropFilter: 'blur(8px)',
            }}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
          >
            <TimelineStrip />
          </motion.div>

          {/* HEMEN OYNA button */}
          <motion.div
            className="w-full mb-5"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            {/* Outer glow container */}
            <div className="relative rounded-2xl p-0.5" style={{ background: 'linear-gradient(135deg, rgba(80,40,120,0.6), rgba(40,10,80,0.6))', boxShadow: '0 0 30px rgba(250,204,21,0.2)' }}>
              <motion.button
                onClick={handleHemenOyna}
                whileTap={{ scale: 0.96 }}
                animate={{
                  boxShadow: [
                    '0 0 24px rgba(250,204,21,0.5), 0 6px 30px rgba(250,204,21,0.3)',
                    '0 0 44px rgba(250,204,21,0.75), 0 8px 44px rgba(250,204,21,0.45)',
                    '0 0 24px rgba(250,204,21,0.5), 0 6px 30px rgba(250,204,21,0.3)',
                  ],
                }}
                transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                className="w-full h-16 rounded-xl font-bangers text-2xl tracking-widest flex items-center justify-center gap-3"
                style={{
                  background: 'linear-gradient(135deg, #f5c400 0%, #facc15 50%, #e6b800 100%)',
                  color: '#1a0a00',
                  letterSpacing: '0.12em',
                }}
              >
                HEMEN OYNA
                <Zap className="w-6 h-6" />
              </motion.button>
            </div>
          </motion.div>

          {/* BİR MOD SEÇ */}
          <motion.div
            className="w-full"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.38 }}
          >
            {/* Divider label */}
            <div className="flex items-center gap-3 mb-3">
              <div className="flex-1 h-px bg-white/15" />
              <span className="font-inter text-xs font-semibold text-white/40 tracking-widest">BİR MOD SEÇ</span>
              <div className="flex-1 h-px bg-white/15" />
            </div>

            {/* Mode cards */}
            <div className="grid grid-cols-2 gap-3">
              {/* SOLO */}
              <motion.button
                onClick={handleSolo}
                whileTap={{ scale: 0.95 }}
                className="flex flex-col items-center justify-center gap-2 rounded-2xl p-4"
                style={{
                  background: 'linear-gradient(145deg, rgba(100,40,180,0.5), rgba(60,20,120,0.6))',
                  border: '1.5px solid rgba(160,80,255,0.5)',
                  boxShadow: '0 0 20px rgba(130,60,220,0.25), inset 0 1px 0 rgba(200,150,255,0.1)',
                  minHeight: 110,
                }}
              >
                <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: 'rgba(160,80,255,0.2)', border: '1.5px solid rgba(160,80,255,0.5)' }}>
                  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="rgba(180,120,255,1)" strokeWidth="1.5">
                    <circle cx="12" cy="8" r="4" />
                    <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" strokeLinecap="round" />
                  </svg>
                </div>
                <div className="text-center">
                  <p className="font-bangers text-base tracking-wider" style={{ color: '#c084fc', lineHeight: 1.1 }}>SOLO<br />MEYDAN OKUMA</p>
                </div>
                <p className="font-inter text-[10px] text-white/50 text-center leading-tight">Kendine karşı yarış,<br />zamanı yen!</p>
              </motion.button>

              {/* ONLINE */}
              <motion.button
                onClick={handleOnline}
                whileTap={{ scale: 0.95 }}
                className="flex flex-col items-center justify-center gap-2 rounded-2xl p-4"
                style={{
                  background: 'linear-gradient(145deg, rgba(20,20,30,0.8), rgba(30,20,50,0.9))',
                  border: '1.5px solid rgba(250,204,21,0.35)',
                  boxShadow: '0 0 16px rgba(250,204,21,0.1)',
                  minHeight: 110,
                }}
              >
                <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: 'rgba(250,204,21,0.1)', border: '1.5px solid rgba(250,204,21,0.4)' }}>
                  <Globe className="w-5 h-5 text-yellow-400" />
                </div>
                <div className="text-center">
                  <p className="font-bangers text-base tracking-wider text-white leading-tight">ONLINE<br />BATTLE</p>
                </div>
                <p className="font-inter text-[10px] text-white/50 text-center leading-tight">Gerçek oyunculara<br />karşı oyna!</p>
              </motion.button>
            </div>

            {/* Auth status */}
            <motion.div
              className="mt-4 text-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
            >
              {user ? (
                <p className="font-inter text-xs text-white/30">{user.full_name || user.email}</p>
              ) : (
                <button
                  onClick={() => base44.auth.redirectToLogin('/')}
                  className="font-inter text-xs text-white/40 hover:text-yellow-400 flex items-center justify-center gap-1.5 w-full py-2 transition-colors"
                  style={{ minHeight: 44 }}
                >
                  <LogIn className="w-3.5 h-3.5" />
                  Online oynamak için giriş yap
                </button>
              )}
            </motion.div>
          </motion.div>

        </div>
      </div>
    </>
  );
}