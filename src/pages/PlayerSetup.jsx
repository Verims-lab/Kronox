import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Users, Play, Globe, LogIn, LogOut, Settings, RefreshCw } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { motion, AnimatePresence } from 'framer-motion';
import { sounds } from '@/lib/gameSounds';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';

// Floating ambient orbs — pure atmosphere, no layout impact
function AmbientOrbs() {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 0 }}>
      <motion.div
        className="absolute rounded-full"
        style={{ width: 320, height: 320, top: '-80px', left: '-80px', background: 'radial-gradient(circle, rgba(250,204,21,0.07) 0%, transparent 70%)' }}
        animate={{ scale: [1, 1.15, 1], opacity: [0.6, 1, 0.6] }}
        transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute rounded-full"
        style={{ width: 280, height: 280, bottom: '10%', right: '-60px', background: 'radial-gradient(circle, rgba(124,58,191,0.1) 0%, transparent 70%)' }}
        animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0.9, 0.5] }}
        transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut', delay: 1.5 }}
      />
      <motion.div
        className="absolute rounded-full"
        style={{ width: 180, height: 180, top: '40%', left: '20%', background: 'radial-gradient(circle, rgba(250,204,21,0.04) 0%, transparent 70%)' }}
        animate={{ scale: [1, 1.3, 1], opacity: [0.4, 0.7, 0.4] }}
        transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut', delay: 3 }}
      />
    </div>
  );
}

// Section wrapper with subtle entrance
function Section({ children, delay = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay, ease: 'easeOut' }}
    >
      {children}
    </motion.div>
  );
}

// Selector button with press feedback
function SelectBtn({ selected, onClick, children, ariaLabel, ariaPressed, className = '' }) {
  return (
    <motion.button
      onClick={() => { sounds.tap(); onClick(); }}
      whileTap={{ scale: 0.93 }}
      aria-label={ariaLabel}
      aria-pressed={ariaPressed}
      className={`transition-colors ${className} ${
        selected
          ? 'border-primary bg-primary/20 text-primary shadow-lg shadow-primary/25'
          : 'border-white/20 bg-white/5 text-white/50 hover:border-white/40 hover:bg-white/10'
      }`}
    >
      {children}
    </motion.button>
  );
}

export default function PlayerSetup() {
  const navigate = useNavigate();
  const [playerCount, setPlayerCount] = useState(1);
  const [user, setUser] = useState(null);
  const [names, setNames] = useState(['', '', '', '']);
  const [selectedCategory, setSelectedCategory] = useState('karisik');
  const [yearStart, setYearStart] = useState(1900);
  const [yearEnd, setYearEnd] = useState(2020);
  const [turnDuration, setTurnDuration] = useState(60);
  const [nameErrors, setNameErrors] = useState([]);
  const scrollContainerRef = useRef(null);

  const refreshUser = () => {
    base44.auth.me().then((u) => setUser(u || null)).catch(() => setUser(null));
  };

  useEffect(() => {
    refreshUser();
  }, []);

  const { refreshing: isRefreshing } = usePullToRefresh(() => {
    setTimeout(refreshUser, 300);
  }, { threshold: 72 });

  const validateName = (name) => {
    const trimmed = name.trim();
    if (trimmed.length < 3) return 'En az 3 karakter';
    if (trimmed.length > 15) return 'En fazla 15 karakter';
    if (!/^[a-zA-Z0-9çğıöşüÇĞİÖŞÜ]+$/.test(trimmed)) return 'Yalnızca harf ve rakam';
    return '';
  };

  const handleStart = () => {
    const errors = Array.from({ length: playerCount }).map((_, i) => validateName(names[i]));
    setNameErrors(errors);
    if (errors.some((e) => e)) return;
    sounds.tap();
    const playerNames = names.slice(0, playerCount).map((n) => n.trim());
    navigate('/game', {
      state: { playerNames, category: selectedCategory, yearStart, yearEnd, turnDuration }
    });
  };

  const categories = [
    { value: 'karisik', label: 'Karışık', emoji: '🎲' },
    { value: 'tarih', label: 'Tarih', emoji: '🏰' },
    { value: 'bilim', label: 'Bilim', emoji: '🔬' },
    { value: 'spor', label: 'Spor', emoji: '⚽' },
    { value: 'sanat', label: 'Sanat', emoji: '🎨' },
    { value: 'teknoloji', label: 'Teknoloji', emoji: '💻' },
  ];

  return (
    <div
      ref={scrollContainerRef}
      className="min-h-screen flex flex-col items-center justify-start px-5 overflow-y-auto relative"
      style={{
        paddingTop: 'calc(1.5rem + env(safe-area-inset-top))',
        paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom))',
        background: 'linear-gradient(to bottom, #0B1F3A 0%, #1E3A8A 100%)',
        minHeight: '100vh',
        overscrollBehavior: 'contain',
        WebkitOverflowScrolling: 'touch',
      }}
    >
      <AmbientOrbs />

      {/* Content layer */}
      <div className="relative w-full flex flex-col items-center" style={{ zIndex: 1 }}>

        {/* Top row */}
        <div className="w-full flex items-center justify-between mb-2">
          <motion.button
            whileTap={{ scale: 0.9 }}
            animate={isRefreshing ? { rotate: 360 } : {}}
            transition={isRefreshing ? { duration: 0.8, repeat: Infinity, ease: 'linear' } : {}}
            onClick={refreshUser}
            className="w-11 h-11 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center text-white/70 min-h-[44px] min-w-[44px]"
            aria-label="Yenile"
          >
            <RefreshCw className="w-5 h-5" />
          </motion.button>

          {/* Logo with ambient pulse */}
          <motion.div
            className="flex-1 flex items-center justify-center"
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          >
            <motion.img
              src="https://media.base44.com/images/public/69e753d5ab4c08a7c4287c25/49fc6f458_kronoxnobckgrnd.png"
              alt="Kronox"
              className="h-24 object-contain"
              animate={{ filter: ['drop-shadow(0 0 8px rgba(250,204,21,0.3))', 'drop-shadow(0 0 18px rgba(250,204,21,0.6))', 'drop-shadow(0 0 8px rgba(250,204,21,0.3))'] }}
              transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
            />
          </motion.div>

          {user ? (
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => navigate('/settings')}
              className="w-11 h-11 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center text-white/70 min-h-[44px] min-w-[44px]"
              aria-label="Ayarlar"
            >
              <Settings className="w-5 h-5" />
            </motion.button>
          ) : (
            <div className="w-11" />
          )}
        </div>

        <div className="w-full max-w-md space-y-3">

          {/* Player count */}
          <Section delay={0.05}>
            <div className="space-y-2">
              <label className="font-inter text-sm text-white/60 flex items-center gap-2">
                <Users className="w-4 h-4" />
                Oyuncu Sayısı
              </label>
              <div className="flex gap-2">
                {[1, 2, 3, 4].map((n) => (
                  <SelectBtn
                    key={n}
                    selected={playerCount === n}
                    onClick={() => setPlayerCount(n)}
                    ariaLabel={`${n} oyuncu seç`}
                    ariaPressed={playerCount === n}
                    className="flex-1 h-12 rounded-2xl border-2 font-bangers text-2xl min-h-[44px]"
                  >
                    {n}
                  </SelectBtn>
                ))}
              </div>
            </div>
          </Section>

          {/* Category */}
          <Section delay={0.1}>
            <div className="space-y-2">
              <label className="font-inter text-sm text-white/60">Kategori</label>
              <div className="grid grid-cols-3 gap-2">
                {categories.map(({ value, label, emoji }) => (
                  <SelectBtn
                    key={value}
                    selected={selectedCategory === value}
                    onClick={() => setSelectedCategory(value)}
                    ariaLabel={`${label} kategorisi seç`}
                    ariaPressed={selectedCategory === value}
                    className="py-2 px-2 rounded-2xl border-2 flex flex-col items-center gap-0.5 min-h-[44px] justify-center"
                  >
                    <span className="text-xl">{emoji}</span>
                    <span className="font-inter text-xs font-semibold">{label}</span>
                  </SelectBtn>
                ))}
              </div>
            </div>
          </Section>

          {/* Year range */}
          <Section delay={0.15}>
            <div className="space-y-2">
              <label className="font-inter text-sm text-white/60">Yıl Aralığı</label>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Başlangıç', val: yearStart, set: (v) => setYearStart(Math.max(0, Math.min(yearEnd - 10, v))), step: 10 },
                  { label: 'Bitiş', val: yearEnd, set: (v) => setYearEnd(Math.max(yearStart + 10, Math.min(new Date().getFullYear(), v))), step: 10 },
                ].map(({ label, val, set, step }) => (
                  <div key={label} className="space-y-1">
                    <p className="font-inter text-xs text-white/40 text-center">{label}</p>
                    <div className="flex items-center gap-1">
                      <motion.button
                        whileTap={{ scale: 0.88 }}
                        onClick={() => { sounds.tap(); set(val - step); }}
                        className="w-8 h-9 rounded-xl bg-white/10 border border-white/20 font-bold text-white/70 hover:bg-white/20 flex items-center justify-center"
                      >
                        −
                      </motion.button>
                      <div className="flex-1 text-center font-bangers text-lg text-white">{val}</div>
                      <motion.button
                        whileTap={{ scale: 0.88 }}
                        onClick={() => { sounds.tap(); set(val + step); }}
                        className="w-8 h-9 rounded-xl bg-white/10 border border-white/20 font-bold text-white/70 hover:bg-white/20 flex items-center justify-center"
                      >
                        +
                      </motion.button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Section>

          {/* Turn duration */}
          <Section delay={0.2}>
            <div className="space-y-2">
              <label className="font-inter text-sm text-white/60">Tur Süresi</label>
              <div className="flex gap-2">
                {[0, 10, 30, 60].map((s) => (
                  <SelectBtn
                    key={s}
                    selected={turnDuration === s}
                    onClick={() => setTurnDuration(s)}
                    className="flex-1 h-10 rounded-2xl border-2 font-bangers text-lg"
                  >
                    {s === 0 ? '∞' : `${s}s`}
                  </SelectBtn>
                ))}
              </div>
            </div>
          </Section>

          {/* Player names */}
          <Section delay={0.25}>
            <div className="space-y-2">
              <AnimatePresence>
                {Array.from({ length: playerCount }).map((_, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 12 }}
                    transition={{ duration: 0.22, delay: i * 0.06 }}
                  >
                    <Input
                      placeholder={`Oyuncu ${i + 1} İsmi`}
                      value={names[i]}
                      maxLength={15}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleStart(); }}
                      onChange={(e) => {
                        const newNames = [...names];
                        newNames[i] = e.target.value;
                        setNames(newNames);
                        if (nameErrors[i]) {
                          const errs = [...nameErrors];
                          errs[i] = '';
                          setNameErrors(errs);
                        }
                      }}
                      className={`h-12 rounded-2xl bg-white/10 border-white/20 text-white placeholder:text-white/30 font-inter ${nameErrors[i] ? 'border-red-400' : ''}`}
                    />
                    {nameErrors[i] && (
                      <p className="font-inter text-xs text-red-400 pl-2 mt-0.5">{nameErrors[i]}</p>
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </Section>

          {/* Start button — pulsing glow CTA */}
          <Section delay={0.3}>
            <motion.button
              onClick={handleStart}
              whileTap={{ scale: 0.96 }}
              animate={{
                boxShadow: [
                  '0 0 20px rgba(250,204,21,0.4), 0 8px 32px rgba(250,204,21,0.25)',
                  '0 0 36px rgba(250,204,21,0.65), 0 8px 40px rgba(250,204,21,0.35)',
                  '0 0 20px rgba(250,204,21,0.4), 0 8px 32px rgba(250,204,21,0.25)',
                ],
              }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
              className="w-full h-14 rounded-2xl font-bangers text-2xl tracking-wider bg-primary text-primary-foreground hover:bg-primary/90 active:scale-95 transition-colors flex items-center justify-center gap-2"
            >
              <Play className="w-5 h-5" />
              OYUNU BAŞLAT
            </motion.button>
          </Section>

          {/* Online (disabled) */}
          <Section delay={0.33}>
            <button
              disabled
              className="w-full h-12 rounded-2xl font-bangers text-xl tracking-wider text-white flex items-center justify-center gap-2 opacity-50 cursor-not-allowed"
              style={{ background: 'linear-gradient(135deg, #5b2d8e, #7c3abf)', boxShadow: '0 4px 20px rgba(124,58,191,0.4)' }}
            >
              <Globe className="w-5 h-5" />
              ÇEVRİMİÇİ OYUN
            </button>
          </Section>

          {/* Auth */}
          <Section delay={0.36}>
            <div className="pt-1">
              {user ? (
                <div className="flex items-center justify-between px-1">
                  <p className="font-inter text-xs text-white/40">{user.full_name || user.email}</p>
                  <button
                    onClick={() => base44.auth.logout('/')}
                    className="font-inter text-xs text-white/30 hover:text-red-400 flex items-center gap-1 transition-colors px-2 py-1 rounded min-h-[44px] justify-center"
                    aria-label="Hesaptan çıkış yap"
                  >
                    <LogOut className="w-3 h-3" />
                    Çıkış
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => base44.auth.redirectToLogin('/')}
                  className="w-full font-inter text-sm text-white/50 hover:text-primary flex items-center justify-center gap-2 py-3 transition-colors rounded min-h-[44px]"
                  aria-label="Google ile giriş yap"
                >
                  <LogIn className="w-4 h-4" />
                  Google ile Giriş Yap
                </button>
              )}
            </div>
          </Section>

        </div>
      </div>
    </div>
  );
}