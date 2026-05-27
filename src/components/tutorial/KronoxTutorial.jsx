import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronRight, RotateCcw, Play } from 'lucide-react';
import { sounds } from '@/lib/gameSounds';

// ── Step data ────────────────────────────────────────────────────────────────
const STEPS = [
  {
    id: 'welcome',
    title: 'KRONOX\'A HOŞ GELDİN',
    subtitle: 'Tarihi doğru yere yerleştir.\nArkadaşlarını timeline\'da ez.',
    visual: 'logo',
    cta: 'Başla',
  },
  {
    id: 'goal',
    title: 'Hedef',
    subtitle: 'Kartı doğru yıl aralığına yerleştir.',
    visual: 'timeline',
    hint: 'Timeline\'a bak →',
    cta: 'Anladım',
  },
  {
    id: 'drag',
    title: 'Nasıl Oynanır?',
    subtitle: 'Kartı basılı tut ve\ndoğru yıla sürükle.',
    visual: 'drag',
    hint: 'Parmağını bas ve sürükle',
    cta: 'Devam',
  },
  {
    id: 'placement',
    title: 'Yerleştir',
    subtitle: 'Doğru yere bıraktığında\ntimeline büyür.',
    visual: 'snap',
    cta: 'Harika!',
  },
  {
    id: 'win',
    title: 'Kazanmak İçin',
    subtitle: 'En çok doğru yerleştiren\nkazanır.',
    visual: 'win',
    cta: 'Hazırım',
  },
  {
    id: 'ready',
    title: 'Hazırsın.',
    subtitle: 'Şimdi zamanı bük.',
    visual: 'ready',
    cta: 'Oyuna Başla',
    isFinal: true,
  },
];

// ── Sub-visuals ───────────────────────────────────────────────────────────────

function VisualLogo() {
  return (
    <motion.div className="flex items-center justify-center w-full h-full"
      initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.2, type: 'spring', stiffness: 260, damping: 18 }}>
      <motion.img
        src="https://media.base44.com/images/public/69e753d5ab4c08a7c4287c25/49fc6f458_kronoxnobckgrnd.png"
        alt="Kronox"
        className="h-28 object-contain"
        animate={{ filter: ['drop-shadow(0 0 8px rgba(250,204,21,0.4))', 'drop-shadow(0 0 24px rgba(250,204,21,0.8))', 'drop-shadow(0 0 8px rgba(250,204,21,0.4))'] }}
        transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
      />
    </motion.div>
  );
}

function VisualTimeline() {
  return (
    <div className="w-full h-full flex flex-col items-center justify-center gap-4 px-4">
      {/* Sample card */}
      <motion.div
        initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.15, type: 'spring' }}
        className="rounded-xl border-2 border-yellow-400 px-4 py-2.5 text-center"
        style={{ background: 'linear-gradient(160deg,#0f1428,#0a0f23)', boxShadow: '0 0 18px rgba(250,204,21,0.45)' }}
      >
        <p className="font-inter text-xs text-white/80 mb-0.5">iPhone piyasaya çıktı</p>
        <p className="font-inter text-[10px] text-white/40">???</p>
      </motion.div>

      {/* Arrow */}
      <motion.div animate={{ y: [0, 6, 0] }} transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}>
        <span className="text-yellow-400 text-2xl">↓</span>
      </motion.div>

      {/* Timeline strip */}
      <motion.div
        initial={{ scaleX: 0, opacity: 0 }} animate={{ scaleX: 1, opacity: 1 }} transition={{ delay: 0.3, duration: 0.5 }}
        className="flex items-center gap-1"
      >
        {[2000, 2005, '?', 2015, 2020].map((yr, i) => (
          <div key={i} className="flex items-center gap-1">
            {i > 0 && <div className="w-5 h-0.5 bg-white/20" />}
            <div
              className={`rounded-lg px-2 py-1 text-center font-bangers text-sm ${yr === '?' ? 'border-2 border-yellow-400 text-yellow-400' : 'border border-white/20 text-white/50'}`}
              style={yr === '?' ? { background: 'rgba(250,204,21,0.1)', boxShadow: '0 0 12px rgba(250,204,21,0.3)' } : { background: 'rgba(255,255,255,0.04)' }}
            >
              {yr}
            </div>
          </div>
        ))}
      </motion.div>
    </div>
  );
}

function VisualDrag() {
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [dragged, setDragged] = useState(false);

  return (
    <div className="w-full h-full flex items-center justify-center select-none">
      <motion.div
        drag
        dragConstraints={{ left: -80, right: 80, top: -50, bottom: 50 }}
        onDragStart={() => { setDragged(true); sounds.pickup?.(); }}
        whileDrag={{ scale: 1.08, rotate: 3, zIndex: 10 }}
        className="rounded-xl border-2 border-violet-400 px-4 py-2.5 text-center cursor-grab active:cursor-grabbing"
        style={{ background: 'linear-gradient(160deg,#0f1428,#0a0f23)', boxShadow: dragged ? '0 0 28px rgba(167,139,250,0.7)' : '0 0 14px rgba(167,139,250,0.4)', touchAction: 'none' }}
      >
        <p className="font-inter text-xs text-white/80 mb-0.5">Bu kartı sürükle →</p>
        <motion.p
          className="font-inter text-[10px] text-violet-400"
          animate={{ opacity: dragged ? 0 : [1, 0.4, 1] }}
          transition={{ duration: 1.2, repeat: Infinity }}
        >
          {dragged ? '✓ Sürdün!' : 'Tut & Sürükle'}
        </motion.p>
      </motion.div>
    </div>
  );
}

function VisualSnap() {
  const [snapped, setSnapped] = useState(false);

  return (
    <div className="w-full h-full flex flex-col items-center justify-center gap-3 px-4">
      <div className="flex items-center gap-1">
        {[2000, 2007, 2010].map((yr, i) => (
          <div key={i} className="flex items-center gap-1">
            {i > 0 && <div className="w-4 h-0.5 bg-white/20" />}
            <div className="rounded-lg px-2 py-1 border border-white/20 font-bangers text-sm text-white/60"
              style={{ background: 'rgba(255,255,255,0.04)' }}>
              {yr}
            </div>
          </div>
        ))}
        {/* Drop zone */}
        <div className="w-4 h-0.5 bg-white/20" />
        <motion.div
          animate={snapped ? {} : { scale: [1, 1.1, 1], borderColor: ['rgba(250,204,21,0.6)', 'rgba(250,204,21,1)', 'rgba(250,204,21,0.6)'] }}
          transition={{ duration: 1.1, repeat: snapped ? 0 : Infinity }}
          className="rounded-lg px-2 py-1 border-2 border-yellow-400 font-bangers text-sm text-yellow-400"
          style={{ background: 'rgba(250,204,21,0.08)', boxShadow: snapped ? '0 0 20px rgba(250,204,21,0.7)' : '0 0 10px rgba(250,204,21,0.3)' }}
        >
          {snapped ? '2015 ✓' : '＋'}
        </motion.div>
      </div>

      <motion.button
        whileTap={{ scale: 0.94 }}
        onClick={() => { setSnapped(true); sounds.correct?.(); }}
        disabled={snapped}
        className="px-5 py-2 rounded-xl font-inter text-sm font-semibold transition-all"
        style={{
          background: snapped ? 'rgba(34,197,94,0.2)' : 'rgba(250,204,21,0.15)',
          border: `1.5px solid ${snapped ? '#22c55e' : 'rgba(250,204,21,0.5)'}`,
          color: snapped ? '#22c55e' : '#facc15',
        }}
      >
        {snapped ? '🎯 Mükemmel!' : 'Buraya Yerleştir'}
      </motion.button>
    </div>
  );
}

function VisualWin() {
  return (
    <div className="w-full h-full flex flex-col items-center justify-center gap-3 px-4">
      {/* Mini scoreboard */}
      {[
        { name: 'Sen', cards: 5, color: '#22c55e' },
        { name: 'Ahmet', cards: 3, color: '#818cf8' },
        { name: 'Ayşe', cards: 2, color: '#f87171' },
      ].map((p, i) => (
        <motion.div
          key={p.name}
          initial={{ x: -40, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: i * 0.12, type: 'spring' }}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-xl"
          style={{ background: `${p.color}12`, border: `1.5px solid ${p.color}40` }}
        >
          <span className="font-bangers text-lg" style={{ color: p.color }}>{i + 1}.</span>
          <span className="font-inter text-sm font-semibold text-white flex-1">{p.name}</span>
          <div className="flex gap-1">
            {Array.from({ length: p.cards }).map((_, j) => (
              <motion.div key={j} initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: i * 0.12 + j * 0.06 }}
                className="w-3 h-4 rounded-sm" style={{ background: p.color }} />
            ))}
          </div>
          <span className="font-bangers text-sm" style={{ color: p.color }}>{p.cards} kart</span>
        </motion.div>
      ))}
    </div>
  );
}

function VisualReady() {
  return (
    <motion.div className="flex items-center justify-center w-full h-full"
      initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 200, damping: 16 }}>
      <motion.div
        animate={{ scale: [1, 1.08, 1] }}
        transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
        className="w-20 h-20 rounded-full flex items-center justify-center"
        style={{ background: 'radial-gradient(circle, rgba(250,204,21,0.25), rgba(250,204,21,0.06))', border: '2px solid rgba(250,204,21,0.7)', boxShadow: '0 0 40px rgba(250,204,21,0.5)' }}
      >
        <Play className="w-9 h-9 text-yellow-400 ml-1" />
      </motion.div>
    </motion.div>
  );
}

const VISUALS = {
  logo: VisualLogo,
  timeline: VisualTimeline,
  drag: VisualDrag,
  snap: VisualSnap,
  win: VisualWin,
  ready: VisualReady,
};

// ── Progress dots ─────────────────────────────────────────────────────────────
function ProgressDots({ total, current }) {
  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: total }).map((_, i) => (
        <motion.div
          key={i}
          animate={{ width: i === current ? 20 : 6, opacity: i <= current ? 1 : 0.3 }}
          transition={{ duration: 0.3 }}
          className="h-1.5 rounded-full"
          style={{ background: i === current ? '#facc15' : 'rgba(255,255,255,0.4)' }}
        />
      ))}
    </div>
  );
}

// ── Main Tutorial component ────────────────────────────────────────────────────
export default function KronoxTutorial({ onDone, onSkip, onComplete }) {
  const [step, setStep] = useState(0);
  const current = STEPS[step];
  const Visual = VISUALS[current.visual];

  const complete = useCallback(async (callback) => {
    try {
      await onComplete?.();
    } catch (_error) {
      // Tutorial should close even if the profile flag update has to retry later.
    } finally {
      callback?.();
    }
  }, [onComplete]);

  const next = useCallback(() => {
    sounds.tap?.();
    if (step < STEPS.length - 1) {
      setStep(s => s + 1);
    } else {
      complete(onDone);
    }
  }, [complete, onDone, step]);

  const skip = useCallback(() => {
    sounds.tap?.();
    complete(onSkip);
  }, [complete, onSkip]);

  const replay = useCallback(() => {
    sounds.tap?.();
    setStep(0);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] flex items-end justify-center"
      style={{ background: 'rgba(5,10,25,0.88)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}
    >
      {/* Skip button — always top right */}
      {!current.isFinal && (
        <motion.button
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}
          onClick={skip}
          className="absolute top-0 right-4 flex items-center gap-1 px-3 py-2 rounded-xl font-inter text-xs text-white/40 hover:text-white/70 transition-colors"
          style={{ paddingTop: 'calc(0.5rem + env(safe-area-inset-top))', zIndex: 10, minHeight: 44 }}
        >
          <X className="w-3.5 h-3.5" />
          Geç
        </motion.button>
      )}

      {/* Card panel — slides up from bottom */}
      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ y: 60, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -30, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 320, damping: 28 }}
          className="w-full max-w-sm mx-auto flex flex-col rounded-t-3xl overflow-hidden"
          style={{
            background: 'linear-gradient(170deg, #0d1630 0%, #080d1f 100%)',
            border: '1.5px solid rgba(250,204,21,0.2)',
            borderBottom: 'none',
            boxShadow: '0 -8px 60px rgba(250,204,21,0.12), 0 -2px 20px rgba(0,0,0,0.8)',
            paddingBottom: 'env(safe-area-inset-bottom)',
          }}
        >
          {/* Neon top stripe */}
          <div className="w-full h-0.5" style={{ background: 'linear-gradient(90deg, transparent, rgba(250,204,21,0.7), transparent)' }} />

          {/* Visual area */}
          <div className="w-full" style={{ height: 180 }}>
            <Visual />
          </div>

          {/* Text + controls */}
          <div className="flex flex-col px-6 pb-6 pt-2 gap-4">
            {/* Progress */}
            <div className="flex items-center justify-between">
              <ProgressDots total={STEPS.length} current={step} />
              <span className="font-inter text-[10px] text-white/30">{step + 1}/{STEPS.length}</span>
            </div>

            {/* Title */}
            <div className="space-y-1.5">
              <h2 className="font-bangers text-2xl tracking-wider text-white leading-tight"
                style={{ textShadow: '0 0 20px rgba(250,204,21,0.4)' }}>
                {current.title}
              </h2>
              <p className="font-inter text-sm text-white/65 leading-relaxed whitespace-pre-line">
                {current.subtitle}
              </p>
              {current.hint && (
                <p className="font-inter text-xs text-yellow-400/70 mt-1">{current.hint}</p>
              )}
            </div>

            {/* Buttons */}
            {current.isFinal ? (
              <div className="flex gap-2 pt-1">
                <button
                  onClick={replay}
                  className="flex-1 h-12 rounded-2xl font-inter text-sm font-semibold border border-white/20 text-white/60 flex items-center justify-center gap-1.5 hover:bg-white/5 transition-colors"
                >
                  <RotateCcw className="w-4 h-4" />
                  Tekrar İzle
                </button>
                <motion.button
                  onClick={next}
                  whileTap={{ scale: 0.97 }}
                  animate={{ boxShadow: ['0 0 16px rgba(250,204,21,0.4)', '0 0 30px rgba(250,204,21,0.7)', '0 0 16px rgba(250,204,21,0.4)'] }}
                  transition={{ duration: 1.8, repeat: Infinity }}
                  className="flex-1 h-12 rounded-2xl font-bangers text-xl tracking-wider bg-primary text-primary-foreground flex items-center justify-center gap-1.5"
                >
                  <Play className="w-4 h-4" />
                  {current.cta}
                </motion.button>
              </div>
            ) : (
              <motion.button
                onClick={next}
                whileTap={{ scale: 0.97 }}
                className="w-full h-12 rounded-2xl font-bangers text-xl tracking-wider bg-primary text-primary-foreground flex items-center justify-center gap-2"
                style={{ boxShadow: '0 0 16px rgba(250,204,21,0.35)' }}
              >
                {current.cta}
                <ChevronRight className="w-4 h-4" />
              </motion.button>
            )}
          </div>
        </motion.div>
      </AnimatePresence>
    </motion.div>
  );
}
