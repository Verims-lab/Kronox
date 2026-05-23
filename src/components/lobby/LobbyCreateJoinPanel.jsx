import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { sounds } from '@/lib/gameSounds';
import GoldButton from '@/components/ui/GoldButton';

const ONLINE_BACKGROUND_ASSET = '/assets/ui/Kronox_Online_Fantasy_Basckground.png';
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

function CtaIcon({ type }) {
  if (type === 'enter') {
    return (
      <svg className="h-full w-full" viewBox="0 0 92 92" aria-hidden="true">
        <path d="M22 18 H58 C68 18 74 24 74 34 V70" fill="none" stroke="#d8ecff" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M23 46 H62" fill="none" stroke="#d8ecff" strokeWidth="8" strokeLinecap="round" />
        <path d="M48 31 L63 46 L48 61" fill="none" stroke="#d8ecff" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M22 18 H58 C68 18 74 24 74 34 V70" fill="none" stroke="#173059" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" opacity="0.7" />
      </svg>
    );
  }

  return (
    <svg className="h-full w-full" viewBox="0 0 92 92" aria-hidden="true">
      <path d="M23 72 L63 32" stroke="#42260a" strokeWidth="12" strokeLinecap="round" />
      <path d="M28 67 L68 27" stroke="#17243a" strokeWidth="8" strokeLinecap="round" />
      <path d="M62 14 L78 30 L68 39 L52 23 Z" fill="#202c3e" stroke="#4b2b0c" strokeWidth="4" />
      <path d="M18 77 L28 65 L36 73 L24 83 Z" fill="#7b470f" stroke="#3a1f08" strokeWidth="4" />
      <path d="M47 27 L65 45" stroke="#d6992b" strokeWidth="5" strokeLinecap="round" />
    </svg>
  );
}

function FantasyCtaButton({ variant, label, icon, onClick }) {
  const isGold = variant === 'gold';
  const viewBox = isGold ? '0 0 933 171' : '0 0 726 121';
  const id = `online-cta-${variant}`;

  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileTap={{ scaleX: 0.988, scaleY: 0.94, y: 5 }}
      whileHover={{ y: -2 }}
      transition={{ type: 'spring', stiffness: 620, damping: 24, mass: 0.72 }}
      className="group relative h-full w-full border-0 bg-transparent p-0"
      style={{
        containerType: 'size',
        appearance: 'none',
        transformOrigin: '50% 55%',
        touchAction: 'manipulation',
        filter: isGold
          ? 'drop-shadow(0 14px 10px rgba(0,0,0,0.72)) drop-shadow(0 0 18px rgba(245,158,11,0.55))'
          : 'drop-shadow(0 12px 9px rgba(0,0,0,0.72)) drop-shadow(0 0 16px rgba(37,99,235,0.52))',
      }}
      aria-label={label}
    >
      <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox={viewBox} preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient id={`${id}-outer`} x1="0%" x2="100%" y1="0%" y2="100%">
            {isGold ? (
              <>
                <stop offset="0%" stopColor="#fff0a0" />
                <stop offset="22%" stopColor="#d58a21" />
                <stop offset="52%" stopColor="#6b350a" />
                <stop offset="76%" stopColor="#f7c45a" />
                <stop offset="100%" stopColor="#432106" />
              </>
            ) : (
              <>
                <stop offset="0%" stopColor="#4f91e8" />
                <stop offset="26%" stopColor="#183f82" />
                <stop offset="55%" stopColor="#07152f" />
                <stop offset="80%" stopColor="#2f6dc7" />
                <stop offset="100%" stopColor="#061022" />
              </>
            )}
          </linearGradient>
          <linearGradient id={`${id}-inner`} x1="0%" x2="100%" y1="0%" y2="100%">
            {isGold ? (
              <>
                <stop offset="0%" stopColor="#f7be4e" />
                <stop offset="34%" stopColor="#c1761d" />
                <stop offset="63%" stopColor="#7f4512" />
                <stop offset="100%" stopColor="#e3a738" />
              </>
            ) : (
              <>
                <stop offset="0%" stopColor="#173e80" />
                <stop offset="44%" stopColor="#071c43" />
                <stop offset="100%" stopColor="#08265b" />
              </>
            )}
          </linearGradient>
          <radialGradient id={`${id}-shine`} cx="38%" cy="0%" r="90%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity={isGold ? '0.4' : '0.24'} />
            <stop offset="42%" stopColor={isGold ? '#ffd977' : '#4aa3ff'} stopOpacity={isGold ? '0.18' : '0.18'} />
            <stop offset="100%" stopColor="#000000" stopOpacity="0" />
          </radialGradient>
        </defs>
        {isGold ? (
          <>
            <path d="M39 24 H83 L110 2 H824 L851 24 H894 L930 61 V110 L894 148 H851 L824 169 H110 L83 148 H39 L3 110 V61 Z" fill="rgba(0,0,0,0.72)" transform="translate(0 5)" />
            <path d="M37 18 H87 L114 1 H819 L846 18 H896 L932 56 V115 L896 153 H846 L819 170 H114 L87 153 H37 L1 115 V56 Z" fill={`url(#${id}-outer)`} />
            <path d="M65 34 H134 L156 17 H777 L799 34 H868 L906 65 V105 L868 136 H799 L777 153 H156 L134 136 H65 L27 105 V65 Z" fill="#5a2b06" opacity="0.86" />
            <path d="M79 44 H854 L884 72 V98 L854 126 H79 L49 98 V72 Z" fill={`url(#${id}-inner)`} />
            <path d="M79 44 H854 L884 72 V98 L854 126 H79 L49 98 V72 Z" fill={`url(#${id}-shine)`} />
            <path d="M86 52 H844" stroke="#fff0a3" strokeWidth="5" strokeLinecap="round" opacity="0.66" />
            <path d="M88 124 H842" stroke="#4b2306" strokeWidth="6" strokeLinecap="round" opacity="0.48" />
            <path d="M22 64 L64 29 H126 L101 57 V112 L126 141 H64 L22 106 Z M911 64 L869 29 H807 L832 57 V112 L807 141 H869 L911 106 Z" fill="#f1b63d" opacity="0.82" />
          </>
        ) : (
          <>
            <path d="M34 15 H85 L106 1 H620 L641 15 H692 L725 50 V72 L692 106 H641 L620 120 H106 L85 106 H34 L1 72 V50 Z" fill="rgba(0,0,0,0.74)" transform="translate(0 4)" />
            <path d="M33 11 H88 L110 1 H616 L638 11 H693 L725 46 V76 L693 110 H638 L616 120 H110 L88 110 H33 L1 76 V46 Z" fill={`url(#${id}-outer)`} />
            <path d="M53 23 H116 L131 13 H595 L610 23 H673 L701 51 V72 L673 99 H610 L595 109 H131 L116 99 H53 L25 72 V51 Z" fill="#06142f" opacity="0.94" />
            <path d="M67 31 H660 L682 53 V70 L660 91 H67 L45 70 V53 Z" fill={`url(#${id}-inner)`} />
            <path d="M67 31 H660 L682 53 V70 L660 91 H67 L45 70 V53 Z" fill={`url(#${id}-shine)`} />
            <path d="M75 35 H650" stroke="#8cc8ff" strokeWidth="3.4" strokeLinecap="round" opacity="0.54" />
            <path d="M78 90 H648" stroke="#0b1a3d" strokeWidth="4" strokeLinecap="round" opacity="0.62" />
          </>
        )}
      </svg>

      <span
        className="pointer-events-none absolute z-10 flex items-center justify-center"
        style={{
          left: isGold ? '8.2%' : '7.6%',
          top: isGold ? '28%' : '23%',
          width: isGold ? '7.8%' : '10.5%',
          height: isGold ? '45%' : '54%',
          filter: isGold ? 'drop-shadow(0 2px 1px rgba(0,0,0,0.55))' : 'drop-shadow(0 2px 2px rgba(0,0,0,0.72))',
        }}
      >
        <CtaIcon type={icon} />
      </span>

      <span
        className="pointer-events-none absolute z-10 flex items-center justify-center font-bangers uppercase"
        style={{
          left: isGold ? '18%' : '20%',
          right: isGold ? '8%' : '9%',
          top: 0,
          bottom: isGold ? '3%' : '1%',
          color: isGold ? '#1e180c' : '#e9f4ff',
          fontSize: isGold ? '12.3cqw' : '8.6cqw',
          lineHeight: 1,
          letterSpacing: 0,
          textShadow: isGold
            ? '0 1px 0 rgba(255,243,174,0.42), 0 3px 2px rgba(0,0,0,0.24)'
            : '0 2px 0 rgba(1,8,24,0.72), 0 0 8px rgba(126,200,255,0.28)',
        }}
      >
        {label}
      </span>

      <span
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-150 group-active:opacity-100"
        style={{
          clipPath: isGold
            ? 'polygon(4% 12%, 96% 12%, 100% 34%, 100% 66%, 96% 90%, 4% 90%, 0 66%, 0 34%)'
            : 'polygon(5% 10%, 95% 10%, 100% 39%, 100% 62%, 95% 91%, 5% 91%, 0 62%, 0 39%)',
          background: isGold
            ? 'linear-gradient(180deg, rgba(255,255,255,0.22), rgba(255,197,64,0.16) 52%, rgba(0,0,0,0.14))'
            : 'linear-gradient(180deg, rgba(255,255,255,0.16), rgba(59,130,246,0.2) 52%, rgba(0,0,0,0.16))',
          boxShadow: isGold
            ? 'inset 0 0 36px rgba(255,229,142,0.44)'
            : 'inset 0 0 30px rgba(96,165,250,0.46)',
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
      initial={{ opacity: 0.6, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'spring', stiffness: 520, damping: 28 }}
      aria-hidden="true"
    >
      <div
        className="absolute inset-0"
        style={{
          clipPath: 'polygon(4% 2%, 96% 2%, 99% 9%, 99% 91%, 96% 98%, 4% 98%, 1% 91%, 1% 9%)',
          border: '2px solid rgba(255, 214, 88, 0.96)',
          boxShadow: '0 0 18px rgba(250,204,21,0.92), inset 0 0 18px rgba(250,204,21,0.32)',
          background: 'linear-gradient(135deg, rgba(250,204,21,0.12), transparent 36%, rgba(34,211,238,0.08))',
        }}
      />
      <div
        className="absolute right-[-3%] top-[2%] flex items-center justify-center"
        style={{
          width: '34%',
          height: '29%',
          transform: 'rotate(45deg)',
          transformOrigin: '50% 50%',
          background: 'linear-gradient(135deg, #fff2a8 0%, #facc15 38%, #a35b12 100%)',
          color: '#1e1609',
          fontFamily: 'Bangers, Impact, sans-serif',
          fontSize: 'clamp(10px, 3.8cqw, 18px)',
          letterSpacing: 0,
          textShadow: '0 1px 0 rgba(255,255,255,0.34)',
          boxShadow: '0 2px 8px rgba(0,0,0,0.44), inset 0 1px 0 rgba(255,255,255,0.46)',
        }}
      >
        SEÇİLDİ
      </div>
    </motion.div>
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
            icon="sword"
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
            icon="enter"
            onClick={joinOpenLobby}
          />
        </div>
      </div>
    </main>
  );
}
