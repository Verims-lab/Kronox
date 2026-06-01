import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { RotateCcw, ArrowLeft, Star, Trophy, XCircle, Crown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatDuration } from './GameOverTimer';
import { fetchSoloLevelRank } from '@/lib/soloRanking';

/**
 * Solo FAILURE result card.
 *
 * This is the legacy fail-state UI extracted from SoloLevelResult so the
 * success path can delegate to SoloSuccessPopup without keeping
 * conditionally-called hooks (rank lookup) in the parent. Visual behavior
 * is intentionally identical to what shipped before — only the success
 * branch was redesigned in this iteration. A dedicated failure redesign
 * will land later.
 */
export default function SoloFailureCard({
  levelNumber,
  stars,
  mistakes,
  timeSeconds,
  baseScore = 0,
  timeBonus = 0,
  levelScore = 0,
  cardsCompleted,
  cardTarget,
  failReason,
  onRetry,
  onBackToPath,
}) {
  const accentColor = '#f87171';
  const headline = 'Seviye Başarısız';
  const subline = failReason === 'timeout'
    ? 'Süren doldu. Bir dahaki sefere!'
    : 'Çok fazla hata. Tekrar dene!';

  // Rank lookup is intentionally unconditional here — this component only
  // mounts on a failed attempt, but we still keep hook order stable.
  const [rankState, setRankState] = useState({ loading: false, rank: null, ready: false });
  useEffect(() => {
    let cancelled = false;
    fetchSoloLevelRank({ levelNumber, levelScore, stars, timeSeconds, mistakes })
      .then((res) => {
        if (cancelled) return;
        setRankState({ loading: false, rank: res?.rank ?? null, ready: Boolean(res?.ready) });
      })
      .catch(() => {
        if (cancelled) return;
        setRankState({ loading: false, rank: null, ready: false });
      });
    return () => { cancelled = true; };
  }, [levelNumber, levelScore, stars, timeSeconds, mistakes]);

  const formattedTime = formatDuration(timeSeconds);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-md p-4"
      style={{ background: 'rgba(5,11,28,0.92)' }}
    >
      <motion.div
        initial={{ scale: 0.7, opacity: 0, y: 40 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 260, damping: 22, delay: 0.1 }}
        className="w-full max-w-xs rounded-3xl overflow-hidden"
        style={{
          background: 'linear-gradient(160deg, #12185e 0%, #0a0e2e 100%)',
          border: `2px solid ${accentColor}`,
          boxShadow: '0 0 32px rgba(248,113,113,0.32)',
        }}
      >
        <div className="relative pt-7 pb-4 px-5 text-center">
          <motion.div
            animate={{ scale: [1, 1.05, 1] }}
            transition={{ duration: 1.4, repeat: Infinity, repeatDelay: 1.8 }}
            className="w-12 h-12 mx-auto mb-2 flex items-center justify-center"
          >
            <XCircle className="w-12 h-12 text-rose-300" />
          </motion.div>

          <h1 className="font-bangers text-2xl tracking-wider mb-0.5" style={{ color: accentColor }}>
            {headline}
          </h1>
          <p className="font-inter text-white/80 text-xs">{subline}</p>

          <div className="mt-3 flex items-center justify-center gap-2" aria-label={`${stars} yıldız`}>
            {[1, 2, 3].map((i) => {
              const filled = i <= stars;
              return (
                <motion.div
                  key={i}
                  initial={{ scale: 0, rotate: -180 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ delay: 0.25 + i * 0.12, type: 'spring', stiffness: 320, damping: 18 }}
                >
                  <Star
                    className="w-9 h-9"
                    strokeWidth={1.8}
                    style={{
                      color: filled ? '#facc15' : 'rgba(226,232,240,0.22)',
                      fill: filled ? '#facc15' : 'transparent',
                      filter: filled ? 'drop-shadow(0 0 8px rgba(250,204,21,0.65))' : 'none',
                    }}
                  />
                </motion.div>
              );
            })}
          </div>

          <div
            className="mt-3 inline-flex items-center justify-center gap-2 rounded-full px-3 py-1"
            style={{ background: 'rgba(255,255,255,0.06)', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.10)' }}
          >
            <span className="font-inter text-[10px] font-black uppercase tracking-widest text-white/60">
              Süre
            </span>
            <span className="font-bangers text-base tracking-wider text-white">{formattedTime}</span>
          </div>

          <div
            className="mt-3 rounded-2xl px-3 py-2"
            style={{
              background: 'rgba(248,113,113,0.08)',
              boxShadow: 'inset 0 0 0 1px rgba(248,113,113,0.22)',
            }}
          >
            <div className="flex items-center justify-center gap-2">
              <Trophy className="h-4 w-4 text-amber-300" />
              <span className="font-bangers text-xl tracking-wider text-amber-200">
                Puan: {levelScore}
              </span>
            </div>
            <p className="mt-0.5 font-inter text-[10px] font-semibold text-amber-100/75">
              {`Başarısız deneme: ${baseScore} + hız bonusu: ${timeBonus}`}
            </p>
          </div>

          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            <Stat label="Level" value={String(levelNumber)} />
            <Stat label="Hata" value={mistakes} />
            <Stat label="Kart" value={`${cardsCompleted}/${cardTarget}`} />
          </div>

          <div
            className="mt-3 rounded-xl py-2 px-3 font-inter text-[11px] text-rose-200/90"
            style={{ background: 'rgba(248,113,113,0.10)', boxShadow: 'inset 0 0 0 1px rgba(248,113,113,0.25)' }}
          >
            {failReason === 'timeout' ? 'Süre doldu.' : 'Çok fazla hata yapıldı (8+).'}
          </div>

          {/* Keep the rank scaffolding mounted so future ranking data shows
              automatically. Rendered as a single visual line at the bottom. */}
          <RankLine state={rankState} levelNumber={levelNumber} />
        </div>

        <div className="flex flex-col gap-2 px-5 pb-5">
          <Button
            onClick={onRetry}
            className="w-full h-11 rounded-2xl font-bangers text-lg tracking-wider gap-2"
            style={{
              background: 'linear-gradient(135deg, #f5c400 0%, #facc15 50%, #e6b800 100%)',
              color: '#1a0a00',
            }}
          >
            <RotateCcw className="w-4 h-4" />
            Tekrar Oyna
          </Button>

          <div className="flex gap-2">
            <Button
              onClick={onBackToPath}
              variant="outline"
              className="flex-1 h-10 rounded-2xl border-white/20 bg-white/10 text-white hover:bg-white/20 font-inter text-xs gap-2"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Level Path
            </Button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

function Stat({ label, value }) {
  return (
    <div
      className="rounded-xl py-1.5 px-1"
      style={{ background: 'rgba(255,255,255,0.05)', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.08)' }}
    >
      <p className="font-bangers tracking-wider text-white text-base">{value}</p>
      <p className="font-inter text-[9px] font-black uppercase tracking-widest text-white/50">{label}</p>
    </div>
  );
}

function RankLine({ state, levelNumber }) {
  const { loading, rank, ready } = state || {};
  let content;
  if (loading) {
    content = 'Sıralama hesaplanıyor…';
  } else if (ready && typeof rank === 'number' && rank > 0) {
    content = `Level ${levelNumber} sıralamasında ${rank}. oldun`;
  } else {
    content = 'Sıralama verisi hazırlanıyor';
  }
  return (
    <div
      className="mt-3 flex items-center justify-center gap-2 rounded-xl py-2 px-3"
      style={{ background: 'rgba(250,204,21,0.08)', boxShadow: 'inset 0 0 0 1px rgba(250,204,21,0.22)' }}
    >
      <Crown className="w-3.5 h-3.5 text-amber-300/80" />
      <span className="font-inter text-[11px] font-semibold text-amber-100/90 text-center leading-tight">
        {content}
      </span>
    </div>
  );
}