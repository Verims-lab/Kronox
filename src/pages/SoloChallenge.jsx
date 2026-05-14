import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Settings, Zap } from 'lucide-react';
import { sounds } from '@/lib/gameSounds';

// Category → DB value mapping
// Primary: /assets/categories/*.webp (drop your files here to override)
// Fallback: curated Unsplash images
const CATEGORIES = [
  {
    id: 'teknoloji',
    label: 'INTERNET\nERA',
    dbValue: 'teknoloji',
    asset: '/assets/categories/internet-era.webp',
    fallback: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=400&q=80',
    color: '#8b5cf6',
    glow: 'rgba(139,92,246,0.6)',
  },
  {
    id: 'sanat',
    label: 'TÜRK TV',
    dbValue: 'sanat',
    asset: '/assets/categories/turk-tv.webp',
    fallback: 'https://images.unsplash.com/photo-1593784991095-a205069470b6?w=400&q=80',
    color: '#a78bfa',
    glow: 'rgba(167,139,250,0.5)',
  },
  {
    id: 'spor',
    label: 'FUTBOL\nDELİLİĞİ',
    dbValue: 'spor',
    asset: '/assets/categories/futbol-deliligi.webp',
    fallback: 'https://images.unsplash.com/photo-1553778263-73a83bab9b0c?w=400&q=80',
    color: '#22c55e',
    glow: 'rgba(34,197,94,0.5)',
  },
  {
    id: 'genel',
    label: 'VİRAL\nKÜLTÜR',
    dbValue: 'genel',
    asset: '/assets/categories/viral-kultur.webp',
    fallback: 'https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=400&q=80',
    color: '#f472b6',
    glow: 'rgba(244,114,182,0.5)',
  },
  {
    id: 'muzik',
    label: 'MÜZİK\nLEGENDS',
    dbValue: 'muzik',
    asset: '/assets/categories/muzik-legends.webp',
    fallback: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=400&q=80',
    color: '#c084fc',
    glow: 'rgba(192,132,252,0.5)',
  },
  {
    id: 'bilim',
    label: 'TEKNOLOJİ\nKAOSU',
    dbValue: 'bilim',
    asset: '/assets/categories/teknoloji-kaosu.webp',
    fallback: 'https://images.unsplash.com/photo-1446776653964-20c1d3a81b06?w=400&q=80',
    color: '#38bdf8',
    glow: 'rgba(56,189,248,0.5)',
  },
];

const DIFFICULTIES = [
  { id: 'rahat', label: 'RAHAT', duration: 0, icon: '🌿', desc: '∞ SN', color: '#22c55e', glow: 'rgba(34,197,94,0.5)' },
  { id: 'hizli', label: 'HIZLI', duration: 30, icon: '⚡', desc: '30 SN', color: '#facc15', glow: 'rgba(250,204,21,0.5)' },
  { id: 'kaos', label: 'KAOS', duration: 15, icon: '🌀', desc: '15 SN', color: '#f87171', glow: 'rgba(248,113,113,0.5)' },
];

function CategoryCard({ cat, selected, onSelect }) {
  const [imgSrc, setImgSrc] = React.useState(cat.asset);

  return (
    <motion.button
      onClick={() => { sounds.tap(); onSelect(cat.id); }}
      whileTap={{ scale: 0.93 }}
      className="relative rounded-2xl overflow-hidden flex flex-col items-center justify-end"
      style={{
        aspectRatio: '1 / 1',
        border: selected ? `2px solid ${cat.color}` : '1.5px solid rgba(255,255,255,0.08)',
        boxShadow: selected ? `0 0 20px ${cat.glow}, 0 0 40px ${cat.glow.replace('0.', '0.2')}` : '0 2px 12px rgba(0,0,0,0.4)',
      }}
    >
      {/* Image — tries local asset first, falls back to Unsplash */}
      <img
        src={imgSrc}
        alt={cat.label}
        onError={() => setImgSrc(cat.fallback)}
        className="absolute inset-0 w-full h-full object-cover"
        style={{ opacity: selected ? 0.6 : 0.42 }}
      />
      {/* Dark overlay */}
      <div
        className="absolute inset-0"
        style={{
          background: selected
            ? `linear-gradient(180deg, transparent 10%, ${cat.color}33 60%, ${cat.color}66 100%)`
            : 'linear-gradient(180deg, transparent 30%, rgba(10,4,30,0.8) 100%)',
        }}
      />
      {/* Selected glow ring */}
      {selected && (
        <motion.div
          className="absolute inset-0 rounded-2xl"
          style={{ border: `2px solid ${cat.color}`, boxShadow: `inset 0 0 16px ${cat.glow}` }}
          animate={{ opacity: [0.7, 1, 0.7] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        />
      )}
      {/* Label */}
      <p
        className="relative z-10 font-bangers text-center leading-tight pb-2 px-1"
        style={{
          fontSize: 13,
          color: selected ? cat.color : 'rgba(255,255,255,0.85)',
          textShadow: selected ? `0 0 10px ${cat.glow}` : 'none',
          whiteSpace: 'pre-line',
        }}
      >
        {cat.label}
      </p>
    </motion.button>
  );
}

function DifficultyCard({ diff, selected, onSelect }) {
  return (
    <motion.button
      onClick={() => { sounds.tap(); onSelect(diff.id); }}
      whileTap={{ scale: 0.93 }}
      className="flex-1 flex flex-col items-center justify-center gap-1 rounded-2xl py-3"
      style={{
        border: selected ? `2px solid ${diff.color}` : '1.5px solid rgba(255,255,255,0.1)',
        background: selected ? `rgba(${diff.id === 'rahat' ? '34,197,94' : diff.id === 'hizli' ? '250,204,21' : '248,113,113'},0.12)` : 'rgba(255,255,255,0.04)',
        boxShadow: selected ? `0 0 20px ${diff.glow}` : 'none',
        minHeight: 80,
      }}
    >
      <span className="text-xl">{diff.icon}</span>
      <p
        className="font-bangers text-base tracking-wider"
        style={{ color: selected ? diff.color : 'rgba(255,255,255,0.6)', textShadow: selected ? `0 0 10px ${diff.glow}` : 'none' }}
      >
        {diff.label}
      </p>
      <p className="font-inter text-[11px]" style={{ color: selected ? diff.color : 'rgba(255,255,255,0.35)' }}>
        {diff.desc}
      </p>
    </motion.button>
  );
}

export default function SoloChallenge() {
  const navigate = useNavigate();
  const [selectedCategory, setSelectedCategory] = useState('teknoloji');
  const [selectedDifficulty, setSelectedDifficulty] = useState('hizli');

  const handleStart = () => {
    sounds.tap();
    const cat = CATEGORIES.find(c => c.id === selectedCategory);
    const diff = DIFFICULTIES.find(d => d.id === selectedDifficulty);
    navigate('/game', {
      state: {
        playerNames: ['Sen'],
        category: cat.dbValue,
        yearStart: 1900,
        yearEnd: 2025,
        turnDuration: diff.duration,
      },
    });
  };

  return (
    <div
      className="min-h-screen flex flex-col items-center relative"
      style={{
        background: 'linear-gradient(180deg, #0a0414 0%, #0d0620 100%)',
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
        overflowY: 'auto',
      }}
    >
      {/* Ambient orb */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 0 }}>
        <motion.div
          className="absolute rounded-full"
          style={{ width: 400, height: 400, top: '-100px', left: '50%', transform: 'translateX(-50%)', background: 'radial-gradient(circle, rgba(120,40,200,0.18) 0%, transparent 70%)' }}
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>

      <div className="relative z-10 w-full max-w-sm mx-auto px-4 flex flex-col"
        style={{ paddingTop: 'calc(0.75rem + env(safe-area-inset-top))', paddingBottom: 'calc(5rem + env(safe-area-inset-bottom))' }}>

        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <motion.button
            whileTap={{ scale: 0.88 }}
            onClick={() => { sounds.tap(); navigate('/'); }}
            className="w-11 h-11 rounded-2xl flex items-center justify-center"
            style={{ background: 'rgba(255,255,255,0.07)', border: '1.5px solid rgba(255,255,255,0.12)', minHeight: 44, minWidth: 44 }}
          >
            <ArrowLeft className="w-5 h-5 text-white/70" />
          </motion.button>

          <motion.img
            src="https://media.base44.com/images/public/69e753d5ab4c08a7c4287c25/49fc6f458_kronoxnobckgrnd.png"
            alt="Kronox"
            className="h-12 object-contain"
            animate={{ filter: ['drop-shadow(0 0 6px rgba(250,204,21,0.35))', 'drop-shadow(0 0 14px rgba(250,204,21,0.65))', 'drop-shadow(0 0 6px rgba(250,204,21,0.35))'] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
          />

          <motion.button
            whileTap={{ scale: 0.88 }}
            onClick={() => navigate('/settings')}
            className="w-11 h-11 rounded-2xl flex items-center justify-center"
            style={{ background: 'rgba(255,255,255,0.07)', border: '1.5px solid rgba(255,255,255,0.12)', minHeight: 44, minWidth: 44 }}
          >
            <Settings className="w-5 h-5 text-white/60" />
          </motion.button>
        </div>

        {/* Title */}
        <motion.div
          className="text-center mb-5"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <h1
            className="font-bangers text-3xl tracking-wider"
            style={{ color: '#c084fc', textShadow: '0 0 20px rgba(192,132,252,0.5)' }}
          >
            SOLO MEYDAN OKUMA
          </h1>
          <p className="font-inter text-sm text-white/50 mt-1">Tarzını seç, zamanı fethet!</p>
        </motion.div>

        {/* Category section */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="mb-5"
        >
          {/* Section divider */}
          <div className="flex items-center gap-3 mb-3">
            <div className="flex-1 h-px bg-white/15" />
            <span className="font-inter text-xs font-semibold text-white/40 tracking-widest">KATEGORİ SEÇ</span>
            <div className="flex-1 h-px bg-white/15" />
          </div>

          <div className="grid grid-cols-3 gap-2.5">
            {CATEGORIES.map((cat) => (
              <CategoryCard
                key={cat.id}
                cat={cat}
                selected={selectedCategory === cat.id}
                onSelect={setSelectedCategory}
              />
            ))}
          </div>
        </motion.div>

        {/* Difficulty section */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.22 }}
          className="mb-6"
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="flex-1 h-px bg-white/15" />
            <span className="font-inter text-xs font-semibold text-white/40 tracking-widest">ZORLUK SEVİYESİ</span>
            <div className="flex-1 h-px bg-white/15" />
          </div>

          <div className="flex gap-2.5">
            {DIFFICULTIES.map((diff) => (
              <DifficultyCard
                key={diff.id}
                diff={diff}
                selected={selectedDifficulty === diff.id}
                onSelect={setSelectedDifficulty}
              />
            ))}
          </div>
        </motion.div>
      </div>

      {/* Sticky bottom CTA */}
      <div
        className="fixed bottom-0 left-0 right-0 z-50 px-4"
        style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))', background: 'linear-gradient(to top, #0a0414 60%, transparent)' }}
      >
        <motion.button
          onClick={handleStart}
          whileTap={{ scale: 0.96 }}
          animate={{
            boxShadow: [
              '0 0 24px rgba(250,204,21,0.5), 0 4px 24px rgba(250,204,21,0.3)',
              '0 0 44px rgba(250,204,21,0.8), 0 6px 40px rgba(250,204,21,0.45)',
              '0 0 24px rgba(250,204,21,0.5), 0 4px 24px rgba(250,204,21,0.3)',
            ],
          }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          className="w-full h-16 rounded-2xl font-bangers text-2xl tracking-widest flex items-center justify-center gap-3"
          style={{
            background: 'linear-gradient(135deg, #f5c400 0%, #facc15 50%, #e6b800 100%)',
            color: '#1a0a00',
            maxWidth: 384,
            margin: '0 auto',
          }}
        >
          MEYDAN OKUMAYA BAŞLA
          <Zap className="w-6 h-6" />
        </motion.button>
      </div>
    </div>
  );
}