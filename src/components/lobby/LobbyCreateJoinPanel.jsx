import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, ChevronsUp, Clock, Hourglass, Landmark, LogIn, Radio, Trophy, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { sounds } from '@/lib/gameSounds';
import CategoryCard from '@/components/lobby/CategoryCard';
import GoldButton from '@/components/ui/GoldButton';

const LOGO_URL = 'https://media.base44.com/images/public/69e753d5ab4c08a7c4287c25/49fc6f458_kronoxnobckgrnd.png';
const WIDE_STAGE_QUERY = '(min-aspect-ratio: 9 / 16)';

// Kronox v2 — fantasy portal palette (blue/cyan/gold) shared by all category cards.
const CATEGORIES = [
  { id: 'flashback', label: 'FLASHBACK', Icon: Zap, scene: 'portal' },
  { id: 'kult', label: 'KÜLT', Icon: Landmark, scene: 'ritual' },
  { id: 'viral', label: 'VIRAL', Icon: Radio, scene: 'signal' },
  { id: 'arena', label: 'ARENA', Icon: Trophy, scene: 'arena' },
  { id: 'level-up', label: 'LEVEL UP', Icon: ChevronsUp, scene: 'ascent' },
  { id: 'chronicle', label: 'CHRONICLE', Icon: Hourglass, scene: 'hourglass' },
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
          background: [
            'radial-gradient(circle at 50% 22%, rgba(59,130,246,0.5), transparent 36%)',
            'radial-gradient(circle at 50% 76%, rgba(34,211,238,0.16), transparent 38%)',
            'linear-gradient(180deg, #050b1c 0%, #0a1738 50%, #03060f 100%)',
          ].join(', '),
        }}
      >
        {/* Portal halo */}
        <div
          className="pointer-events-none absolute inset-0 z-[1]"
          style={{
            background: [
              'radial-gradient(circle at 50% 10%, rgba(250,204,21,0.18), transparent 18%)',
              'radial-gradient(ellipse at 50% 36%, rgba(59,130,246,0.32), transparent 42%)',
              'linear-gradient(180deg, rgba(0,0,0,0.12) 0%, rgba(4,8,22,0.22) 40%, rgba(0,0,0,0.74) 100%)',
            ].join(', '),
          }}
        />
        {/* Drifting sparkles */}
        <div
          className="pointer-events-none absolute inset-0 z-[1]"
          style={{
            backgroundImage: [
              'radial-gradient(circle at 18% 28%, rgba(186,225,255,0.45) 0 1px, transparent 2px)',
              'radial-gradient(circle at 82% 18%, rgba(186,225,255,0.4) 0 1px, transparent 2px)',
              'radial-gradient(circle at 68% 58%, rgba(186,225,255,0.34) 0 1.2px, transparent 2.2px)',
              'radial-gradient(circle at 32% 70%, rgba(186,225,255,0.38) 0 1px, transparent 2px)',
            ].join(', '),
            opacity: 0.55,
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
          className="pointer-events-auto absolute z-30 flex items-center justify-center rounded-full border border-amber-200/40 bg-black/58 text-white/85 active:scale-95"
          style={{
            left: '4.6%',
            top: 'calc(0.65rem + env(safe-area-inset-top))',
            width: 44,
            height: 44,
            boxShadow: '0 0 16px rgba(59,130,246,0.42), inset 0 0 14px rgba(255,255,255,0.08)',
          }}
          aria-label="Ana ekrana dön"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>

        {/* Logo block */}
        <header
          className="pointer-events-none absolute z-20 flex flex-col items-center text-center"
          style={{
            left: '50%',
            top: 'calc(0.6rem + env(safe-area-inset-top))',
            width: '56%',
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
        </header>

        {/* Subtitle — placed BELOW logo, ABOVE the category grid, with breathing room */}
        <div
          className="pointer-events-none absolute z-20 flex flex-col items-center text-center"
          style={{
            left: '8%',
            right: '8%',
            top: '18.5%',
          }}
        >
          <p
            className="font-cinzel font-black uppercase text-white"
            style={{
              fontSize: 'clamp(13px, 4.1cqw, 17px)',
              letterSpacing: '0.06em',
              textShadow: '0 0 14px rgba(250,204,21,0.55), 0 0 18px rgba(59,130,246,0.55), 0 3px 8px rgba(0,0,0,0.78)',
            }}
          >
            Arkadaşlarına Meydan Oku
          </p>
          <div className="mt-2 flex items-center justify-center gap-3">
            <span className="h-px w-12 bg-gradient-to-r from-transparent via-amber-300/70 to-transparent" />
            <span
              className="font-inter font-black uppercase text-amber-100/85"
              style={{ fontSize: 'clamp(10px, 2.8cqw, 12px)', letterSpacing: '0.28em' }}
            >
              Kategori Seç
            </span>
            <span className="h-px w-12 bg-gradient-to-r from-transparent via-amber-300/70 to-transparent" />
          </div>
        </div>

        {/* Category grid — moved down so it no longer overlaps the subtitle */}
        <section
          className="pointer-events-auto absolute z-20"
          style={{
            left: '7%',
            right: '7%',
            top: '27%',
            bottom: '30%',
          }}
        >
          <div
            className="grid h-full w-full grid-cols-2 grid-rows-3"
            style={{ gap: 'clamp(8px, 2.6%, 14px)' }}
          >
            {CATEGORIES.map(category => (
              <CategoryCard
                key={category.id}
                category={category}
                selected={selectedCategory === category.id}
                onClick={() => chooseCategory(category.id)}
              />
            ))}
          </div>
        </section>

        {/* CTAs — anchored to bottom area */}
        <section
          className="pointer-events-auto absolute z-20 flex flex-col items-center gap-3"
          style={{
            left: '8.2%',
            right: '8.2%',
            bottom: 'calc(1.6rem + env(safe-area-inset-bottom))',
          }}
        >
          <GoldButton variant="gold" size="lg" onClick={startChallenge} icon={Zap}>
            Meydan Okumaya Başla
          </GoldButton>
          <div className="w-[82%]">
            <GoldButton variant="portal" size="md" onClick={joinOpenLobby} icon={LogIn}>
              Açık Lobiye Gir
            </GoldButton>
          </div>
        </section>
      </div>
    </main>
  );
}