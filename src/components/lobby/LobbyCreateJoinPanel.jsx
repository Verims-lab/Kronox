import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { sounds } from '@/lib/gameSounds';
import GoldButton from '@/components/ui/GoldButton';

const ONLINE_BACKGROUND_ASSET = '/assets/ui/Kronox_Online_Fantasy_Basckground.png';
// Exact CTA target visuals provided by the user (Base44 platform assets).
const CTA_GOLD_ASSET = 'https://media.base44.com/images/public/6a05b47e401bb23c2f21a522/c5645d70a_image.png';
const CTA_BLUE_ASSET = 'https://media.base44.com/images/public/6a05b47e401bb23c2f21a522/8a72f2312_image.png';
const WIDE_STAGE_QUERY = '(min-aspect-ratio: 9 / 16)';

const CATEGORIES = [
  { id: 'flashback', label: 'FLASHBACK', left: '6.3%', top: '28.6%', width: '40%', height: '11.8%' },
  { id: 'kult', label: 'KÜLT', left: '53.7%', top: '28.6%', width: '40%', height: '11.8%' },
  { id: 'viral', label: 'VIRAL', left: '6.3%', top: '43.2%', width: '40%', height: '11.8%' },
  { id: 'arena', label: 'ARENA', left: '53.7%', top: '43.2%', width: '40%', height: '11.8%' },
  { id: 'level-up', label: 'LEVEL UP', left: '6.3%', top: '57.8%', width: '40%', height: '11.8%' },
  { id: 'chronicle', label: 'CHRONICLE', left: '53.7%', top: '57.8%', width: '40%', height: '11.8%' },
];

const getIsWideStage = () => (
  typeof window !== 'undefined'
    ? window.matchMedia(WIDE_STAGE_QUERY).matches
    : false
);

export default function LobbyCreateJoinPanel({
  mode,
  setMode,
  playerName,
  setPlayerName,
  joinCode,
  setJoinCode,
  loading,
  error,
  nameError,
  setNameError,
  onCreate,
  onJoin,
  onBackHome,
  onBackMode,
}) {
  if (!mode) {
    return (
      <OnlineChallengeLanding
        onCreate={() => setMode('create')}
        onJoin={() => setMode('join')}
        onBackHome={onBackHome}
      />
    );
  }

  return (
    <div
      className="min-h-screen bg-background flex flex-col items-center justify-center px-6"
      style={{
        paddingTop: 'calc(5rem + env(safe-area-inset-top))',
        paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom))',
        background:
          'radial-gradient(ellipse at 50% 18%, rgba(59,130,246,0.34), transparent 42%), radial-gradient(ellipse at 50% 90%, rgba(34,211,238,0.14), transparent 50%), linear-gradient(180deg, #050b1c 0%, #0a1738 55%, #03060f 100%)',
      }}
    >
      <div className="w-full max-w-md space-y-7">
        <div className="text-center space-y-2">
          <div
            className="w-16 h-16 mx-auto rounded-full flex items-center justify-center"
            style={{
              background:
                'radial-gradient(circle at 35% 28%, rgba(255,236,140,0.34), rgba(8,18,42,0.85) 62%)',
              boxShadow:
                'inset 0 0 0 2px #facc15, inset 0 1px 0 rgba(255,236,140,0.55), 0 0 22px rgba(250,204,21,0.55), 0 0 30px rgba(59,130,246,0.35)',
            }}
          >
            <Clock className="w-7 h-7 text-amber-300" />
          </div>
          <h1
            className="font-cinzel text-3xl font-black tracking-wider"
            style={{
              color: '#facc15',
              textShadow: '0 0 18px rgba(250,204,21,0.55), 0 2px 4px rgba(0,0,0,0.7)',
            }}
          >
            KRONOX
          </h1>
          <p className="font-inter text-blue-100/70 text-sm">Çevrimiçi Lobi</p>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4 rounded-2xl p-5"
          style={{
            background:
              'linear-gradient(180deg, rgba(30,41,75,0.95) 0%, rgba(14,22,46,0.98) 70%, rgba(6,10,24,1) 100%)',
            boxShadow:
              'inset 0 0 0 1.5px rgba(120,170,255,0.4), inset 0 1px 0 rgba(255,255,255,0.1), inset 0 -14px 18px rgba(0,0,0,0.55), 0 0 24px rgba(59,130,246,0.22), 0 12px 24px rgba(2,6,23,0.55)',
          }}
        >
          <div className="space-y-1">
            <Input
              placeholder="Oyuncu İsminiz"
              value={playerName}
              maxLength={15}
              onChange={e => { setPlayerName(e.target.value); setNameError(''); }}
              className={`h-12 bg-slate-900/60 border-blue-400/30 text-white placeholder:text-blue-200/50 font-inter ${nameError ? 'border-destructive' : ''}`}
            />
            {nameError && <p className="font-inter text-xs text-destructive pl-1">{nameError}</p>}
          </div>
          {mode === 'join' && (
            <Input
              placeholder="Lobi Kodu (örn: ABC123)"
              value={joinCode}
              onChange={e => setJoinCode(e.target.value.toUpperCase())}
              maxLength={6}
              className="h-12 bg-slate-900/60 border-blue-400/30 text-amber-200 placeholder:text-blue-200/50 font-inter font-bold tracking-widest text-center text-lg uppercase"
            />
          )}
          {error && <p className="text-destructive text-sm font-inter text-center">{error}</p>}
          <GoldButton
            variant="gold"
            size="lg"
            onClick={mode === 'create' ? onCreate : onJoin}
            disabled={loading}
          >
            {loading ? 'Yükleniyor...' : mode === 'create' ? 'LOBİ OLUŞTUR' : 'KATIL'}
          </GoldButton>
          <Button
            onClick={onBackMode || (() => { setMode(null); })}
            variant="ghost"
            className="w-full gap-2 text-blue-100/70 hover:text-white hover:bg-white/5"
          >
            <ArrowLeft className="w-4 h-4" /> Geri
          </Button>
        </motion.div>
      </div>
    </div>
  );
}

// CTA button — renders the exact target image asset as the entire visual
// surface. No text overlay, no icon overlay, no SVG redraw. The React layer
// only provides hit-testing, aria-label, and tactile press feedback.
function FantasyCtaButton({ variant, label, onClick }) {
  const isGold = variant === 'gold';
  const asset = isGold ? CTA_GOLD_ASSET : CTA_BLUE_ASSET;

  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileTap={{ scale: 0.97, y: 4 }}
      whileHover={{ y: -2 }}
      transition={{ type: 'spring', stiffness: 620, damping: 24, mass: 0.72 }}
      className="group relative block h-full w-full border-0 bg-transparent p-0"
      style={{
        appearance: 'none',
        transformOrigin: '50% 55%',
        touchAction: 'manipulation',
        filter: isGold
          ? 'drop-shadow(0 12px 10px rgba(0,0,0,0.62)) drop-shadow(0 0 16px rgba(245,158,11,0.42))'
          : 'drop-shadow(0 10px 9px rgba(0,0,0,0.62)) drop-shadow(0 0 14px rgba(37,99,235,0.42))',
      }}
      aria-label={label}
    >
      <img
        src={asset}
        alt=""
        draggable={false}
        className="pointer-events-none absolute inset-0 h-full w-full"
        style={{
          objectFit: 'contain',
          objectPosition: 'center center',
          userSelect: 'none',
        }}
      />
      <span
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-150 group-active:opacity-100"
        style={{
          borderRadius: '12px',
          background: isGold
            ? 'linear-gradient(180deg, rgba(255,255,255,0.18), rgba(255,197,64,0.12) 55%, rgba(0,0,0,0.12))'
            : 'linear-gradient(180deg, rgba(255,255,255,0.14), rgba(59,130,246,0.18) 55%, rgba(0,0,0,0.14))',
          boxShadow: isGold
            ? 'inset 0 0 30px rgba(255,229,142,0.38)'
            : 'inset 0 0 26px rgba(96,165,250,0.42)',
        }}
        aria-hidden="true"
      />
    </motion.button>
  );
}

function SelectedCategoryOverlay() {
  return (
    <motion.div
      className="pointer-events-none absolute inset-0 z-20"
      style={{ containerType: 'size' }}
      initial={{ opacity: 0.5, scale: 0.985 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'spring', stiffness: 560, damping: 26 }}
      aria-hidden="true"
    >
      {/* Premium gold glow frame */}
      <div
        className="absolute inset-0"
        style={{
          borderRadius: '14px',
          boxShadow:
            '0 0 0 2px rgba(255,225,120,0.95), 0 0 0 4px rgba(120,60,8,0.85), 0 0 22px rgba(250,204,21,0.78), inset 0 0 18px rgba(250,204,21,0.22)',
          background:
            'linear-gradient(135deg, rgba(255,228,128,0.14), transparent 40%, rgba(34,211,238,0.06))',
        }}
      />
      {/* Inner bright rim */}
      <div
        className="absolute inset-[3%]"
        style={{
          borderRadius: '10px',
          boxShadow: 'inset 0 0 0 1px rgba(255,245,180,0.55)',
        }}
      />
      {/* Diagonal top-right SEÇİLDİ ribbon */}
      <div
        className="absolute overflow-hidden"
        style={{
          right: '-1%',
          top: '-1%',
          width: '46%',
          height: '46%',
          pointerEvents: 'none',
        }}
      >
        <div
          className="absolute flex items-center justify-center"
          style={{
            width: '160%',
            height: '32%',
            top: '22%',
            left: '-10%',
            transform: 'rotate(45deg)',
            transformOrigin: '50% 50%',
            background:
              'linear-gradient(180deg, #fff4b8 0%, #fbc73a 40%, #a86512 100%)',
            color: '#231405',
            fontFamily: 'Bangers, Impact, sans-serif',
            fontSize: 'clamp(9px, 3.4cqw, 16px)',
            letterSpacing: '0.6px',
            textShadow: '0 1px 0 rgba(255,250,200,0.6)',
            boxShadow:
              '0 2px 6px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.55), inset 0 -2px 3px rgba(120,60,8,0.55)',
          }}
        >
          SEÇİLDİ
        </div>
      </div>
    </motion.div>
  );
}

// FLASHBACK is baked into the background as the default selected state, so we
// start with null to avoid double-rendering a live overlay on top of it. Any
// user tap then sets a single category id (mutual exclusion guaranteed).
function OnlineChallengeLanding({ onCreate, onJoin, onBackHome }) {
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [isWideStage, setIsWideStage] = useState(getIsWideStage);

  useEffect(() => {
    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverscroll = document.documentElement.style.overscrollBehavior;
    const previousBodyOverscroll = document.body.style.overscrollBehavior;

    document.body.style.overflow = 'hidden';
    document.documentElement.style.overscrollBehavior = 'none';
    document.body.style.overscrollBehavior = 'none';

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overscrollBehavior = previousHtmlOverscroll;
      document.body.style.overscrollBehavior = previousBodyOverscroll;
    };
  }, []);

  useEffect(() => {
    const media = window.matchMedia(WIDE_STAGE_QUERY);
    const updateStageMode = () => setIsWideStage(media.matches);
    updateStageMode();
    media.addEventListener?.('change', updateStageMode);
    return () => media.removeEventListener?.('change', updateStageMode);
  }, []);

  const stageStyle = isWideStage
    ? {
        width: 'min(100dvw, 56.25dvh)',
        height: 'min(100dvh, 177.7778dvw)',
      }
    : {
        width: 'max(100dvw, 56.25dvh)',
        height: 'max(100dvh, 177.7778dvw)',
      };

  const chooseCategory = (categoryId) => {
    sounds.tick();
    // Single-value state guarantees only one category is selected at a time.
    // If the same category is tapped again, no-op (avoid flicker).
    setSelectedCategory(prev => (prev === categoryId ? prev : categoryId));
  };

  const startChallenge = () => {
    sounds.tap();
    onCreate();
  };

  const joinOpenLobby = () => {
    sounds.tap();
    onJoin();
  };

  return (
    <main
      className="fixed inset-0 z-[90] overflow-hidden bg-black text-white"
      style={{
        width: '100vw',
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
          pointerEvents: 'none',
        }}
      >
        <img
          src={ONLINE_BACKGROUND_ASSET}
          alt=""
          draggable={false}
          className="pointer-events-none absolute inset-0 z-0 h-full w-full object-cover"
          style={{ objectPosition: 'center center', userSelect: 'none' }}
        />

        <button
          type="button"
          onClick={() => { sounds.tap(); onBackHome(); }}
          className="pointer-events-auto absolute z-30 block bg-transparent"
          style={{
            left: '2.6%',
            top: '2.1%',
            width: '12.4%',
            height: '7.4%',
            border: 0,
            padding: 0,
            touchAction: 'manipulation',
          }}
          aria-label="Ana ekrana dön"
        />

        {CATEGORIES.map(category => (
          <button
            key={category.id}
            type="button"
            onClick={() => chooseCategory(category.id)}
            className="pointer-events-auto absolute z-20 block bg-transparent"
            style={{
              left: category.left,
              top: category.top,
              width: category.width,
              height: category.height,
              border: 0,
              padding: 0,
              touchAction: 'manipulation',
            }}
            aria-label={`${category.label} kategorisini seç`}
            aria-pressed={selectedCategory === category.id}
          >
            {selectedCategory === category.id && <SelectedCategoryOverlay />}
          </button>
        ))}

        <div
          className="pointer-events-auto absolute z-30"
          style={{ left: '6.8%', top: '79.3%', width: '86.4%', height: '8.9%' }}
        >
          <FantasyCtaButton
            variant="gold"
            label="MEYDAN OKUMAYA BAŞLA"
            onClick={startChallenge}
          />
        </div>

        <div
          className="pointer-events-auto absolute z-30"
          style={{ left: '16.4%', top: '90%', width: '67.2%', height: '6.3%' }}
        >
          <FantasyCtaButton
            variant="blue"
            label="AÇIK LOBİYE GİR"
            onClick={joinOpenLobby}
          />
        </div>
      </div>
    </main>
  );
}