import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, ChevronsUp, Clock, Hourglass, Landmark, LogIn, Radio, Trophy, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { sounds } from '@/lib/gameSounds';

const LOGO_URL = 'https://media.base44.com/images/public/69e753d5ab4c08a7c4287c25/49fc6f458_kronoxnobckgrnd.png';
const COSMIC_BACKGROUND = '/assets/ui/Kronox-Cosmic_background.webp';
const WIDE_STAGE_QUERY = '(min-aspect-ratio: 9 / 16)';

const CATEGORIES = [
  { id: 'flashback', label: 'FLASHBACK', Icon: Zap, tone: '#facc15', glow: 'rgba(250,204,21,0.72)', scene: 'portal' },
  { id: 'kult', label: 'KÜLT', Icon: Landmark, tone: '#d946ef', glow: 'rgba(217,70,239,0.66)', scene: 'ritual' },
  { id: 'viral', label: 'VIRAL', Icon: Radio, tone: '#a855f7', glow: 'rgba(168,85,247,0.62)', scene: 'signal' },
  { id: 'arena', label: 'ARENA', Icon: Trophy, tone: '#b874ff', glow: 'rgba(184,116,255,0.58)', scene: 'arena' },
  { id: 'level-up', label: 'LEVEL UP', Icon: ChevronsUp, tone: '#e879f9', glow: 'rgba(232,121,249,0.58)', scene: 'ascent' },
  { id: 'chronicle', label: 'CHRONICLE', Icon: Hourglass, tone: '#c084fc', glow: 'rgba(192,132,252,0.58)', scene: 'hourglass' },
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
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6"
      style={{ paddingTop: 'calc(5rem + env(safe-area-inset-top))', paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom))' }}>
      <div className="w-full max-w-md space-y-8">
        <div className="text-center space-y-2">
          <div className="w-14 h-14 mx-auto border-2 border-primary/40 rounded-full flex items-center justify-center">
            <Clock className="w-7 h-7 text-primary" />
          </div>
          <h1 className="font-cinzel text-3xl font-bold text-primary tracking-wider">KRONOX</h1>
          <p className="font-inter text-muted-foreground text-sm">Çevrimiçi Lobi</p>
        </div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          <div className="space-y-1">
            <Input
              placeholder="Oyuncu İsminiz"
              value={playerName}
              maxLength={15}
              onChange={e => { setPlayerName(e.target.value); setNameError(''); }}
              className={`h-12 bg-secondary/50 border-border/50 font-inter ${nameError ? 'border-destructive' : ''}`}
            />
            {nameError && <p className="font-inter text-xs text-destructive pl-1">{nameError}</p>}
          </div>
          {mode === 'join' && (
            <Input
              placeholder="Lobi Kodu (örn: ABC123)"
              value={joinCode}
              onChange={e => setJoinCode(e.target.value.toUpperCase())}
              maxLength={6}
              className="h-12 bg-secondary/50 border-border/50 font-inter font-bold tracking-widest text-center text-lg uppercase"
            />
          )}
          {error && <p className="text-destructive text-sm font-inter text-center">{error}</p>}
          <Button
            onClick={mode === 'create' ? onCreate : onJoin}
            disabled={loading}
            size="lg"
            className="w-full h-12 bg-primary text-primary-foreground font-cinzel tracking-wider"
          >
            {loading ? 'Yükleniyor...' : mode === 'create' ? 'LOBİ OLUŞTUR' : 'KATIL'}
          </Button>
          <Button onClick={onBackMode || (() => { setMode(null); })} variant="ghost" className="w-full gap-2 text-muted-foreground">
            <ArrowLeft className="w-4 h-4" /> Geri
          </Button>
        </motion.div>
      </div>
    </div>
  );
}

function OnlineChallengeLanding({ onCreate, onJoin, onBackHome }) {
  const [selectedCategory, setSelectedCategory] = useState(CATEGORIES[0].id);
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
    setSelectedCategory(categoryId);
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
          background: 'radial-gradient(circle at 50% 18%, rgba(116,32,182,0.58), transparent 30%), radial-gradient(circle at 50% 72%, rgba(250,204,21,0.16), transparent 34%), linear-gradient(180deg, #060310 0%, #130723 48%, #04020a 100%)',
        }}
      >
        <img
          src={COSMIC_BACKGROUND}
          alt=""
          draggable={false}
          className="pointer-events-none absolute inset-0 z-0 h-full w-full object-cover"
          style={{ objectPosition: 'center center', userSelect: 'none' }}
        />
        <div
          className="pointer-events-none absolute inset-0 z-[1]"
          style={{
            background: [
              'radial-gradient(circle at 50% 8%, rgba(250,204,21,0.18), transparent 16%)',
              'linear-gradient(180deg, rgba(0,0,0,0.1) 0%, rgba(8,3,18,0.18) 38%, rgba(0,0,0,0.74) 100%)',
              'radial-gradient(ellipse at 50% 102%, rgba(168,85,247,0.34), transparent 45%)',
            ].join(', '),
          }}
        />
        <div
          className="pointer-events-none absolute inset-x-0 top-0 z-[2]"
          style={{
            height: '34%',
            background: 'linear-gradient(180deg, rgba(0,0,0,0.44), transparent)',
          }}
        />

        <button
          type="button"
          onClick={() => { sounds.tap(); onBackHome(); }}
          className="pointer-events-auto absolute z-30 flex items-center justify-center rounded-full border border-purple-200/24 bg-black/58 text-white/80 active:scale-95"
          style={{
            left: '4.6%',
            top: 'calc(0.65rem + env(safe-area-inset-top))',
            width: 44,
            height: 44,
            boxShadow: '0 0 18px rgba(168,85,247,0.26), inset 0 0 14px rgba(255,255,255,0.07)',
          }}
          aria-label="Ana ekrana dön"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>

        <header
          className="pointer-events-none absolute z-20 flex flex-col items-center text-center"
          style={{
            left: '50%',
            top: 'calc(0.4rem + env(safe-area-inset-top))',
            width: '64%',
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
              filter: 'drop-shadow(0 0 16px rgba(250,204,21,0.9)) drop-shadow(0 10px 18px rgba(0,0,0,0.72))',
            }}
          />
          <p
            className="font-cinzel font-bold text-white"
            style={{
              marginTop: '-2.5%',
              fontSize: 16,
              letterSpacing: 0,
              textShadow: '0 0 12px rgba(168,85,247,0.82), 0 3px 8px rgba(0,0,0,0.72)',
            }}
          >
            Arkadaşlarına Meydan Oku
          </p>
        </header>

        <section
          className="pointer-events-auto absolute z-20"
          style={{
            left: '7.6%',
            right: '7.6%',
            top: '20.2%',
            height: '49.6%',
          }}
        >
          <div className="mb-2 flex items-center justify-center gap-3 text-center">
            <span className="h-px w-16 bg-gradient-to-r from-transparent via-purple-300/70 to-transparent" />
            <span className="font-inter text-[11px] font-black uppercase tracking-[0.22em] text-purple-100/80">Kategori Seç</span>
            <span className="h-px w-16 bg-gradient-to-r from-transparent via-purple-300/70 to-transparent" />
          </div>
          <div
            className="grid h-[calc(100%-1.4rem)] grid-cols-2 grid-rows-3"
            style={{ gap: '3.1%' }}
          >
            {CATEGORIES.map(category => (
              <CategoryButton
                key={category.id}
                category={category}
                selected={selectedCategory === category.id}
                onClick={() => chooseCategory(category.id)}
              />
            ))}
          </div>
        </section>

        <section
          className="pointer-events-auto absolute z-20 flex flex-col items-center"
          style={{
            left: '8.2%',
            right: '8.2%',
            top: '72.3%',
          }}
        >
          <PrimaryChallengeButton onClick={startChallenge} />
          <motion.button
            type="button"
            onClick={joinOpenLobby}
            whileTap={{ scale: 0.965, y: 2 }}
            transition={{ type: 'spring', stiffness: 560, damping: 25 }}
            className="mt-3 flex h-12 w-[82%] items-center justify-center gap-2 border-0 bg-transparent font-cinzel text-sm font-black text-purple-50"
            style={{
              clipPath: 'polygon(8% 0, 92% 0, 100% 50%, 92% 100%, 8% 100%, 0 50%)',
              background: 'linear-gradient(180deg, rgba(55,18,86,0.9), rgba(12,4,25,0.96))',
              boxShadow: '0 0 18px rgba(168,85,247,0.34), inset 0 0 0 1px rgba(216,180,254,0.46), inset 0 -12px 16px rgba(0,0,0,0.42)',
              letterSpacing: 0,
            }}
          >
            <LogIn className="h-4 w-4 text-purple-200" />
            Açık Lobiye Gir
          </motion.button>
        </section>
      </div>
    </main>
  );
}

function CategoryButton({ category, selected, onClick }) {
  const { Icon } = category;

  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileTap={{ scale: 0.955, y: 4 }}
      animate={{ y: selected ? -2 : 0 }}
      transition={{ type: 'spring', stiffness: 560, damping: 26 }}
      className="relative h-full w-full overflow-hidden border-0 bg-transparent text-white"
      style={{
        clipPath: 'polygon(8% 0, 92% 0, 100% 8%, 100% 92%, 92% 100%, 8% 100%, 0 92%, 0 8%)',
        filter: selected
          ? `drop-shadow(0 0 18px ${category.glow}) drop-shadow(0 14px 14px rgba(0,0,0,0.72))`
          : 'drop-shadow(0 10px 12px rgba(0,0,0,0.62))',
      }}
      aria-pressed={selected}
      aria-label={`${category.label} kategorisini seç`}
    >
      <span
        className="absolute inset-0"
        style={{
          background: 'linear-gradient(180deg, rgba(18,7,36,0.98), rgba(6,4,16,1) 72%, rgba(1,1,6,1))',
          boxShadow: [
            `inset 0 0 0 ${selected ? '2px' : '1px'} ${selected ? category.tone : 'rgba(168,85,247,0.58)'}`,
            `inset 0 0 34px ${selected ? category.glow : 'rgba(168,85,247,0.2)'}`,
            'inset 0 -18px 20px rgba(0,0,0,0.66)',
            'inset 0 1px 0 rgba(255,255,255,0.14)',
          ].join(', '),
        }}
      />
      <span
        className="absolute inset-[5%]"
        style={{
          clipPath: 'polygon(8% 0, 92% 0, 100% 9%, 100% 91%, 92% 100%, 8% 100%, 0 91%, 0 9%)',
          background: [
            `radial-gradient(circle at 50% 29%, ${category.glow}, transparent 36%)`,
            'linear-gradient(180deg, rgba(60,18,94,0.68), rgba(4,3,14,0.82) 68%)',
          ].join(', '),
          opacity: selected ? 1 : 0.82,
        }}
      />
      <CategoryScene category={category} selected={selected} />
      <span
        className="absolute left-1/2 top-[48%] flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full"
        style={{
          width: '35%',
          aspectRatio: '1',
          color: category.tone,
          background: 'radial-gradient(circle, rgba(255,255,255,0.12), rgba(0,0,0,0.62) 60%, rgba(0,0,0,0))',
          filter: `drop-shadow(0 0 12px ${category.glow})`,
        }}
      >
        <Icon className="h-[58%] w-[58%]" strokeWidth={selected ? 2.6 : 2.2} />
      </span>
      <span
        className="absolute inset-x-[9%] bottom-[12%] block truncate font-cinzel text-[13px] font-black text-white"
        style={{
          letterSpacing: 0,
          textShadow: `0 0 12px ${category.glow}, 0 2px 5px rgba(0,0,0,0.8)`,
        }}
      >
        {category.label}
      </span>
      {selected && (
        <span
          className="absolute right-[7%] top-[7%] rounded-full px-2 py-0.5 font-inter text-[9px] font-black text-black"
          style={{
            background: 'linear-gradient(180deg, #fff7a8, #facc15 70%, #d97706)',
            boxShadow: '0 0 12px rgba(250,204,21,0.72)',
          }}
        >
          SEÇİLDİ
        </span>
      )}
    </motion.button>
  );
}

function CategoryScene({ category, selected }) {
  const opacity = selected ? 0.9 : 0.58;
  return (
    <svg className="absolute inset-0 h-full w-full" viewBox="0 0 220 260" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <radialGradient id={`${category.id}-pulse`} cx="50%" cy="35%" r="54%">
          <stop offset="0%" stopColor={category.tone} stopOpacity={selected ? '0.72' : '0.42'} />
          <stop offset="100%" stopColor={category.tone} stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="220" height="260" fill={`url(#${category.id}-pulse)`} opacity={opacity} />
      <g stroke={category.tone} strokeWidth="1.4" fill="none" opacity={selected ? 0.7 : 0.45}>
        <path d="M18 196 C58 146 162 146 202 196" />
        <path d="M36 206 C74 170 146 170 184 206" />
        <path d="M110 62 V206" strokeOpacity="0.46" />
        <path d="M32 218 H188" strokeOpacity="0.34" />
      </g>
      <g fill={category.tone} opacity={selected ? 0.32 : 0.2}>
        <circle cx="38" cy="52" r="2" />
        <circle cx="178" cy="72" r="1.8" />
        <circle cx="64" cy="114" r="1.5" />
        <circle cx="192" cy="132" r="1.4" />
      </g>
      {category.scene === 'portal' && <circle cx="110" cy="92" r="45" fill="none" stroke={category.tone} strokeWidth="5" opacity={selected ? 0.6 : 0.42} />}
      {category.scene === 'ritual' && <path d="M110 44 L150 116 H70 Z M110 68 L132 106 H88 Z" fill="none" stroke={category.tone} strokeWidth="5" opacity={selected ? 0.62 : 0.42} />}
      {category.scene === 'signal' && <path d="M60 86 L166 58 L178 124 L72 152 Z M78 102 L160 82" fill="none" stroke={category.tone} strokeWidth="5" opacity={selected ? 0.58 : 0.4} />}
      {category.scene === 'arena' && <path d="M72 82 H148 V110 C148 146 125 164 110 170 C95 164 72 146 72 110 Z" fill="none" stroke={category.tone} strokeWidth="5" opacity={selected ? 0.6 : 0.42} />}
      {category.scene === 'ascent' && <path d="M70 142 L110 102 L150 142 M74 108 L110 72 L146 108" fill="none" stroke={category.tone} strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" opacity={selected ? 0.6 : 0.42} />}
      {category.scene === 'hourglass' && <path d="M78 54 H142 C136 92 123 102 110 116 C97 102 84 92 78 54 Z M78 178 H142 C136 140 123 130 110 116 C97 130 84 140 78 178 Z" fill="none" stroke={category.tone} strokeWidth="5" opacity={selected ? 0.62 : 0.42} />}
      <path d="M0 260 C42 226 178 226 220 260 Z" fill="rgba(0,0,0,0.58)" />
    </svg>
  );
}

function PrimaryChallengeButton({ onClick }) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileTap={{ scale: 0.955, y: 5 }}
      transition={{ type: 'spring', stiffness: 620, damping: 24 }}
      className="relative flex h-[58px] w-full items-center justify-center gap-3 border-0 bg-transparent font-cinzel text-[15px] font-black text-black"
      style={{
        clipPath: 'polygon(8% 0, 92% 0, 100% 50%, 92% 100%, 8% 100%, 0 50%)',
        background: 'linear-gradient(180deg, #ffe66d 0%, #facc15 48%, #e7a307 100%)',
        boxShadow: '0 0 20px rgba(250,204,21,0.68), 0 10px 0 rgba(76,18,104,0.84), 0 18px 26px rgba(0,0,0,0.72), inset 0 1px 0 rgba(255,255,255,0.74), inset 0 -10px 12px rgba(151,78,0,0.28)',
        letterSpacing: 0,
      }}
    >
      <span
        className="pointer-events-none absolute inset-[4px]"
        style={{
          clipPath: 'polygon(7% 0, 93% 0, 100% 50%, 93% 100%, 7% 100%, 0 50%)',
          boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.34), inset 0 11px 12px rgba(255,255,255,0.24)',
        }}
      />
      <span className="relative z-10">Meydan Okumaya Başla</span>
      <Zap className="relative z-10 h-5 w-5 fill-black text-black" />
    </motion.button>
  );
}
