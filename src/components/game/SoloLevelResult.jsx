import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { RotateCcw, ArrowLeft, Star, Trophy, XCircle, Play, Crown, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatDuration } from './GameOverTimer';
import { fetchSoloLevelRank } from '@/lib/soloRanking';

/**
 * Codex106-23 — Solo level attempt result overlay.
 *
 * Shows pass (with stars + completion time + mistake count + level number
 * + rank placeholder/real) or fail state (0 stars + clear reason). Provides
 * "Tekrar Oyna" (replay same level) and conditionally "Level X'e Geç"
 * (jump to next level) buttons.
 *
 * Mobile-first design — fits within a single screen height without inner
 * scroll, lives above the gameplay surface, and stays consistent with the
 * Kronox premium-fantasy palette. Pure presentational: the calling Game
 * page is responsible for persisting best stars and unlocking the next
 * level before this overlay mounts (see Game.jsx applyLevelAttempt flow).
 *
 * Ranking — `fetchSoloLevelRank()` is intentionally a placeholder right
 * now. There is no per-level completion record in the data model yet
 * (GameRecord stores generic single-player duration only, not solo
 * level number + stars). It always resolves to a "data preparing"
 * placeholder so we never fake permanent backend ranking. When a real
 * leaderboard backend ships, swap the implementation in
 * `lib/soloRanking.js` and this component picks it up automatically.
 *
 * Props:
 *   - levelNumber:           number
 *   - passed:                boolean
 *   - stars:                 0..3
 *   - mistakes:              number
 *   - timeSeconds:           number
 *   - baseScore:             number
 *   - timeBonus:             number
 *   - levelScore:            number
 *   - scoreDelta:            number | undefined
 *   - didImproveScore:       boolean | undefined
 *   - cardsCompleted:        number
 *   - cardTarget:            number (10)
 *   - failReason:            'mistakes' | 'timeout' | null
 *   - nextLevelNumber:       number   (current + 1; raw, may overflow)
 *   - hasNextLevel:          boolean  (true → CTA enabled)
 *   - isNextLevelComingSoon: boolean  (true → CTA shows "Yakında")
 *   - onRetry:               () => void
 *   - onNextLevel:           () => void
 *   - onBackToPath:          () => void
 */
export default function SoloLevelResult({
  levelNumber,
  passed,
  stars,
  mistakes,
  timeSeconds,
  baseScore = 0,
  timeBonus = 0,
  levelScore = 0,
  scoreDelta,
  didImproveScore,
  cardsCompleted,
  cardTarget,
  failReason,
  nextLevelNumber,
  hasNextLevel,
  isNextLevelComingSoon,
  onRetry,
  onNextLevel,
  onBackToPath,
}) {
  const accentColor = passed ? '#facc15' : '#f87171';
  const headline = passed ? 'Seviye Tamamlandı!' : 'Seviye Başarısız';
  const subline = passed
    ? `Level ${levelNumber} geçildi.`
    : failReason === 'timeout'
      ? 'Süren doldu. Bir dahaki sefere!'
      : 'Çok fazla hata. Tekrar dene!';

  // Codex106-23 — Async rank lookup. Only fetched on pass; failed attempts
  // do not contribute to ranking and don't need the line.
  const [rankState, setRankState] = useState({ loading: passed, rank: null, ready: false });
  useEffect(() => {
    if (!passed) return undefined;
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
  }, [passed, levelNumber, levelScore, stars, timeSeconds, mistakes]);

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
          boxShadow: `0 0 32px ${passed ? 'rgba(250,204,21,0.35)' : 'rgba(248,113,113,0.32)'}`,
        }}
      >
        <div className="relative pt-7 pb-4 px-5 text-center">
          <motion.div
            animate={passed ? { rotate: [0, -6, 6, -6, 0], scale: [1, 1.12, 1] } : { scale: [1, 1.05, 1] }}
            transition={{ duration: 1.4, repeat: Infinity, repeatDelay: 1.8 }}
            className="w-12 h-12 mx-auto mb-2 flex items-center justify-center"
          >
            {passed ? (
              <Trophy className="w-12 h-12" style={{ color: accentColor }} />
            ) : (
              <XCircle className="w-12 h-12 text-rose-300" />
            )}
          </motion.div>

          <h1
            className="font-bangers text-2xl tracking-wider mb-0.5"
            style={{ color: accentColor }}
          >
            {headline}
          </h1>
          <p className="font-inter text-white/80 text-xs">{subline}</p>

          {/* Stars row — large, animated, prominent on pass */}
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

          {/* Completion time row — large, prominent, easy to read at a glance */}
          <div className="mt-3 inline-flex items-center justify-center gap-2 rounded-full px-3 py-1"
            style={{ background: 'rgba(255,255,255,0.06)', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.10)' }}>
            <span className="font-inter text-[10px] font-black uppercase tracking-widest text-white/60">
              Süre
            </span>
            <span className="font-bangers text-base tracking-wider text-white">
              {formattedTime}
            </span>
          </div>

          <div
            className="mt-3 rounded-2xl px-3 py-2"
            style={{
              background: passed
                ? 'linear-gradient(180deg, rgba(250,204,21,0.14), rgba(185,122,6,0.08))'
                : 'rgba(248,113,113,0.08)',
              boxShadow: passed
                ? 'inset 0 0 0 1px rgba(250,204,21,0.28)'
                : 'inset 0 0 0 1px rgba(248,113,113,0.22)',
            }}
          >
            <div className="flex items-center justify-center gap-2">
              <Trophy className="h-4 w-4 text-amber-300" />
              <span className="font-bangers text-xl tracking-wider text-amber-200">
                Puan: {levelScore}
              </span>
            </div>
            <p className="mt-0.5 font-inter text-[10px] font-semibold text-amber-100/75">
              {passed
                ? `${stars} yıldız: ${baseScore} + hız bonusu: ${timeBonus}`
                : 'Başarısız deneme: 0 + hız bonusu: 0'}
            </p>
            {passed && typeof scoreDelta === 'number' && (
              <p className="mt-1 font-inter text-[10px] font-black text-amber-100/85">
                {didImproveScore && scoreDelta > 0
                  ? `Yeni en iyi puan! +${scoreDelta}`
                  : 'En iyi puanın korunuyor'}
              </p>
            )}
          </div>

          {/* Stats grid */}
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            <Stat label="Level" value={String(levelNumber)} />
            <Stat label="Hata" value={mistakes} />
            <Stat label="Kart" value={`${cardsCompleted}/${cardTarget}`} />
          </div>

          {/* Rank line — only on pass. Real rank if available, otherwise a
              clearly worded placeholder. Never fakes data. */}
          {passed && (
            <RankLine state={rankState} levelNumber={levelNumber} />
          )}

          {/* Fail reason line — only on fail, in addition to subline copy.
              Keeps the rule explicit so the player knows what to fix. */}
          {!passed && (
            <div className="mt-3 rounded-xl py-2 px-3 font-inter text-[11px] text-rose-200/90"
              style={{ background: 'rgba(248,113,113,0.10)', boxShadow: 'inset 0 0 0 1px rgba(248,113,113,0.25)' }}>
              {failReason === 'timeout' ? 'Süre doldu.' : 'Çok fazla hata yapıldı (8+).'}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2 px-5 pb-5">
          {/* Primary CTA — pass: next level (or coming soon), fail: replay */}
          {passed ? (
            hasNextLevel ? (
              <Button
                onClick={onNextLevel}
                className="w-full h-11 rounded-2xl font-bangers text-lg tracking-wider gap-2"
                style={{
                  background: 'linear-gradient(135deg, #f5c400 0%, #facc15 50%, #e6b800 100%)',
                  color: '#1a0a00',
                }}
              >
                {/* Codex106-25 — Next-level CTA copy is exactly "Level X"
                    (no "'e Geç") with a Play icon to its left. Pass-only,
                    failed attempts hit the disabled/coming-soon branch
                    below or get hidden entirely. */}
                <Play className="w-4 h-4" fill="currentColor" />
                Level {nextLevelNumber}
              </Button>
            ) : (
              <Button
                disabled
                className="w-full h-11 rounded-2xl font-bangers text-base tracking-wider gap-2 opacity-70 cursor-not-allowed"
                style={{
                  background: 'linear-gradient(135deg, rgba(250,204,21,0.18), rgba(250,204,21,0.10))',
                  color: '#facc15',
                  border: '1px solid rgba(250,204,21,0.35)',
                }}
              >
                <Lock className="w-4 h-4" />
                {isNextLevelComingSoon ? 'Yeni Levellar Yakında' : 'Sıradaki Level Kilitli'}
              </Button>
            )
          ) : (
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
          )}

          {/* Secondary row — replay (on pass) + back to path */}
          <div className="flex gap-2">
            {passed && (
              <Button
                onClick={onRetry}
                variant="outline"
                className="flex-1 h-10 rounded-2xl border-white/20 bg-white/10 text-white hover:bg-white/20 font-inter text-xs gap-2"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Tekrar Oyna
              </Button>
            )}
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

function Stat({ label, value, compact = false }) {
  return (
    <div
      className="rounded-xl py-1.5 px-1"
      style={{ background: 'rgba(255,255,255,0.05)', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.08)' }}
    >
      <p className={`font-bangers tracking-wider text-white ${compact ? 'text-sm' : 'text-base'}`}>
        {value}
      </p>
      <p className="font-inter text-[9px] font-black uppercase tracking-widest text-white/50">
        {label}
      </p>
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
