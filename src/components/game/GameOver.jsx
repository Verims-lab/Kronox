import React from 'react';
import { motion } from 'framer-motion';
import { Trophy, RotateCcw, Share2, Timer, CircleX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatDuration } from './GameOverTimer';

const normalizeName = (value) => String(value || '').trim().toLocaleLowerCase('tr-TR');
const normalizeEmail = (value) => String(value || '').trim().toLocaleLowerCase('en-US');

export default function GameOver({
  winner,
  winnerEmail = null,
  onRestart,
  durationSeconds,
  winCardCount,
  isSinglePlayer,
  isOnline = false,
  localPlayerName = null,
  localPlayerEmail = null,
  onlineScoreResult = null,
}) {
  const hasOnlinePerspective = Boolean(isOnline && (localPlayerName || localPlayerEmail));
  const hasEmailPerspective = Boolean(isOnline && winnerEmail && localPlayerEmail);
  const isLocalWinner = hasEmailPerspective
    ? normalizeEmail(winnerEmail) === normalizeEmail(localPlayerEmail)
    : hasOnlinePerspective && normalizeName(winner) === normalizeName(localPlayerName);
  const isOnlineLoser = hasOnlinePerspective && !isLocalWinner;
  const headline = hasOnlinePerspective && !isLocalWinner ? 'Kaybettin' : 'Tebrikler!';
  const resultText = isSinglePlayer
    ? 'Zaman ustası oldun!'
    : hasOnlinePerspective
      ? isLocalWinner
        ? 'Kazandın!'
        : `${winner} kazandı.`
      : <><span className="text-primary font-bold">{winner}</span> kazandı!</>;
  const progressText = hasOnlinePerspective && !isLocalWinner
    ? `${winner} hedefe ulaştı.`
    : `${winCardCount || 10}/10 doğru sıraladın.`;
  const frameBorder = isOnlineLoser ? 'rgba(168,85,247,0.55)' : 'rgba(255,193,7,0.5)';
  const headerGlow = isOnlineLoser
    ? 'linear-gradient(180deg, rgba(168,85,247,0.16) 0%, transparent 100%)'
    : 'linear-gradient(180deg, rgba(255,193,7,0.12) 0%, transparent 100%)';
  const hasOnlineScore = Boolean(isOnline && onlineScoreResult);
  const scoreDelta = Number(onlineScoreResult?.delta || 0);
  const effectiveDelta = Number(onlineScoreResult?.effectiveDelta ?? scoreDelta);
  const scoreSign = scoreDelta > 0 ? '+' : '';
  const scoreHeadline = onlineScoreResult?.pending
    ? onlineScoreResult.message
    : onlineScoreResult?.error || onlineScoreResult?.noScoreDelta
      ? onlineScoreResult.message
      : `${scoreSign}${scoreDelta} Puan`;
  // Codex146 — Time displayed in the popup must equal the time used for
  // scoring. When we have an Online score result, prefer ITS elapsedSeconds
  // (the canonical player-own value passed to applyOnlineMatchToCurrentUser)
  // over winner.durationSeconds. Falls back to winner.durationSeconds only
  // for non-online / no-score-result paths so legacy/solo behavior is intact.
  const displayDurationSeconds = hasOnlineScore && Number.isFinite(Number(onlineScoreResult?.elapsedSeconds))
    ? Number(onlineScoreResult.elapsedSeconds)
    : durationSeconds;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-md p-6"
      style={{ background: 'rgba(11,31,58,0.9)' }}
    >
      <motion.div
        initial={{ scale: 0.7, opacity: 0, y: 40 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 260, damping: 22, delay: 0.1 }}
        className="w-full max-w-xs rounded-3xl overflow-hidden shadow-2xl"
        style={{ background: 'linear-gradient(160deg, #12185e 0%, #0a0e2e 100%)', border: `2px solid ${frameBorder}` }}
      >
        {/* Header */}
        <div className="relative pt-10 pb-6 px-6 text-center" style={{ background: headerGlow }}>
          <motion.div
            animate={isOnlineLoser ? { scale: [1, 1.06, 1] } : { rotate: [0, -8, 8, -8, 0], scale: [1, 1.15, 1] }}
            transition={{ duration: 1.2, repeat: Infinity, repeatDelay: 2 }}
            className="w-20 h-20 mx-auto mb-4 flex items-center justify-center"
          >
            {isOnlineLoser ? (
              <CircleX className="w-20 h-20 text-purple-300 drop-shadow-[0_0_18px_rgba(168,85,247,0.55)]" />
            ) : (
              <Trophy className="w-20 h-20 text-primary" />
            )}
          </motion.div>

          <h1 className="font-bangers text-4xl text-primary tracking-wider mb-1">{headline}</h1>
          <p className="font-inter text-white/80 text-base">
            {resultText}
          </p>

          {displayDurationSeconds != null && (
            <div className="flex items-center justify-center gap-2 mt-3 text-white/60 text-sm font-inter">
              <Timer className="w-4 h-4 text-primary" />
              {/* Codex146 — "Süren" makes it explicit this is YOUR gameplay
                  time, the same value used for the time bonus calculation. */}
              <span>{hasOnlineScore ? `Süren: ${formatDuration(displayDurationSeconds)}` : formatDuration(displayDurationSeconds)}</span>
            </div>
          )}

          <div className="mt-3 font-inter text-sm text-white/50">
            {progressText}
          </div>

          {hasOnlineScore && (
            <div className="mt-4 rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-left font-inter">
              <div className="text-center font-bangers text-2xl tracking-wide text-primary">
                {scoreHeadline}
              </div>
              {!onlineScoreResult.pending && !onlineScoreResult.error && !onlineScoreResult.noScoreDelta && (
                <div className="mt-2 space-y-1 text-xs text-white/65">
                  {onlineScoreResult.skipped && (
                    <div>Bu maçın puanı daha önce işlendi.</div>
                  )}
                  {onlineScoreResult.result === 'win' ? (
                    <>
                      <div>Galibiyet: +{onlineScoreResult.baseDelta || 15}</div>
                      <div>Hız Bonusu: +{onlineScoreResult.timeBonus || 0}</div>
                    </>
                  ) : (
                    <>
                      <div>Mağlubiyet: {scoreDelta} Puan</div>
                      {onlineScoreResult.checkpointApplied && (
                        <div>Checkpoint koruması: {onlineScoreResult.protectedFloor} altına düşmedin</div>
                      )}
                    </>
                  )}
                  <div>Skor: {onlineScoreResult.scoreBefore} → {onlineScoreResult.scoreAfter}</div>
                  {effectiveDelta !== scoreDelta && (
                    <div>Gerçek değişim: {effectiveDelta > 0 ? '+' : ''}{effectiveDelta}</div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Buttons */}
        <div className="flex gap-3 px-6 pb-8">
          <Button
            onClick={onRestart}
            className="flex-1 h-12 bg-primary hover:bg-primary/90 text-primary-foreground font-bangers text-xl tracking-wider gap-2 rounded-2xl min-h-[44px]"
          >
            <RotateCcw className="w-5 h-5" />
            Tekrar Oyna
          </Button>
          <button
            onClick={() => {
              if (navigator.share) {
                navigator.share({ title: 'Kronox', text: `${winCardCount || 10} kartı doğru sıraladım!` });
              }
            }}
            className="w-12 h-12 rounded-2xl flex items-center justify-center border-2 border-white/20 bg-white/10 text-white hover:bg-white/20 transition-colors min-h-[44px] min-w-[44px]"
            aria-label="Oyun sonucunu paylaş"
          >
            <Share2 className="w-5 h-5" />
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}