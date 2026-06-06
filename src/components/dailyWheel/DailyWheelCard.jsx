import React, { useEffect, useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Gem, Gift, Loader2, RotateCw, Sparkles, X } from 'lucide-react';
import { useDailyWheel } from '@/hooks/useDailyWheel';
import { sounds } from '@/lib/gameSounds';

const WHEEL_REWARD_SLICES = [10, 15, 20, 25, 30, 40, 50, 100];
const WHEEL_SLICE_DEGREES = 360 / WHEEL_REWARD_SLICES.length;
const WHEEL_SPIN_DURATION_MS = 4600;
const WHEEL_REDUCED_MOTION_DURATION_MS = 900;
const WHEEL_SPIN_DURATION_SECONDS = WHEEL_SPIN_DURATION_MS / 1000;
const WHEEL_REDUCED_MOTION_DURATION_SECONDS = WHEEL_REDUCED_MOTION_DURATION_MS / 1000;
const WHEEL_SPIN_KEYFRAME_TIMES = [0, 0.14, 0.72, 0.9, 0.96, 1];
const WHEEL_SLICE_COLORS = [
  '#facc15',
  '#2563eb',
  '#fb923c',
  '#7c3aed',
  '#22c55e',
  '#0ea5e9',
  '#ef4444',
  '#a855f7',
];

function getWheelTargetRotation(rewardAmount, reducedMotion = false) {
  const index = Math.max(0, WHEEL_REWARD_SLICES.indexOf(Number(rewardAmount)));
  const fullSpins = reducedMotion ? 1 : 8;
  return (360 * fullSpins) - (index * WHEEL_SLICE_DEGREES);
}

function formatCountdown(nextAvailableAt) {
  const target = Date.parse(String(nextAvailableAt || ''));
  if (!Number.isFinite(target)) return 'Yarın hazır';
  const ms = Math.max(0, target - Date.now());
  if (!ms) return 'Yarın hazır';
  const hours = Math.floor(ms / (60 * 60 * 1000));
  const minutes = Math.floor((ms % (60 * 60 * 1000)) / (60 * 1000));
  if (hours <= 0) return `${minutes || 1} dk sonra`;
  return `${hours} sa ${minutes} dk`;
}

function formatDiamondCount(value) {
  const n = Math.max(0, Math.floor(Number(value) || 0));
  return n.toLocaleString('tr-TR');
}

export default function DailyWheelCard({ user, onUserUpdated, onLogin }) {
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const wheel = useDailyWheel({ user, onUserUpdated });
  const claimedLabel = useMemo(
    () => formatCountdown(wheel.wheel?.nextAvailableAt),
    [wheel.wheel?.nextAvailableAt],
  );

  const handleCardClick = () => {
    sounds.tap();
    if (wheel.status === 'sign_in_required') {
      onLogin?.();
      return;
    }
    if (wheel.status === 'available') {
      wheel.openResult();
      return;
    }
    if (wheel.status === 'claimed') {
      setStatusModalOpen(true);
      return;
    }
    if (wheel.status === 'error') wheel.refresh();
  };

  return (
    <>
      <motion.button
        type="button"
        onClick={handleCardClick}
        disabled={wheel.claiming}
        aria-busy={wheel.claiming ? 'true' : 'false'}
        whileTap={{ y: 1, scale: 0.99 }}
        className="relative flex w-full items-center justify-center overflow-hidden font-inter text-left"
        style={{
          minHeight: 'clamp(72px, 17vw, 88px)',
          borderRadius: 18,
          border: '1px solid rgba(250,204,21,0.38)',
          background:
            'linear-gradient(135deg, rgba(5,14,36,0.88) 0%, rgba(10,28,66,0.88) 60%, rgba(5,14,36,0.92) 100%)',
          boxShadow:
            wheel.status === 'available'
              ? '0 0 20px rgba(250,204,21,0.18), inset 0 0 0 1px rgba(255,255,255,0.06)'
              : 'inset 0 0 0 1px rgba(255,255,255,0.05)',
          color: '#f8fafc',
        }}
        aria-label="Günlük Çark"
      >
        {wheel.status === 'available' && (
          <motion.span
            aria-hidden="true"
            className="absolute inset-0"
            animate={{ opacity: [0.25, 0.55, 0.25] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
            style={{
              background: 'radial-gradient(circle at 22% 50%, rgba(250,204,21,0.24), transparent 42%)',
            }}
          />
        )}

        <div className="relative flex w-full items-center gap-3 px-4 py-3">
          <WheelEmblem spinning={wheel.claiming} muted={wheel.status === 'claimed'} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span
                className="truncate"
                style={{
                  fontSize: 'clamp(17px, 5vw, 22px)',
                  fontWeight: 900,
                  letterSpacing: '0',
                  textShadow: '0 2px 8px rgba(0,0,0,0.45)',
                }}
              >
                Günlük Çark
              </span>
              {wheel.status === 'loading' && <Loader2 className="h-4 w-4 animate-spin text-amber-200" />}
            </div>
            <StatusBadge wheel={wheel} claimedLabel={claimedLabel} />
          </div>
        </div>
      </motion.button>

      {wheel.showPrompt && (
        <DailyWheelPromptModal
          claiming={wheel.claiming}
          onSpin={wheel.claim}
          onClose={wheel.dismissPrompt}
        />
      )}

      {wheel.showResult && (
        <DailyWheelResultModal
          status={wheel.status}
          error={wheel.error}
          claiming={wheel.claiming}
          result={wheel.lastResult}
          onSpin={wheel.claim}
          onClose={wheel.closeResult}
        />
      )}

      {statusModalOpen && (
        <DailyWheelStatusModal
          nextLabel={claimedLabel}
          onClose={() => setStatusModalOpen(false)}
        />
      )}
    </>
  );
}

function StatusBadge({ wheel, claimedLabel }) {
  if (wheel.status === 'sign_in_required') {
    return <Badge tone="neutral" icon={Gift} label="Giriş gerekli" />;
  }
  if (wheel.status === 'loading') {
    return <Badge tone="neutral" icon={Loader2} label="Kontrol ediliyor" />;
  }
  if (wheel.status === 'error') {
    return <Badge tone="danger" icon={RotateCw} label="Tekrar dene" />;
  }
  if (wheel.status === 'claimed') {
    return <Badge tone="passive" icon={null} label={claimedLabel || 'Yarın hazır'} />;
  }
  return <Badge tone="ready" icon={Sparkles} label="Hazır!" />;
}

function Badge({ icon: Icon, label, tone }) {
  const styles = {
    ready: {
      color: '#86efac',
      border: 'rgba(132,204,22,0.45)',
      bg: 'rgba(132,204,22,0.10)',
    },
    passive: {
      color: '#cbd5e1',
      border: 'rgba(148,163,184,0.28)',
      bg: 'rgba(148,163,184,0.08)',
    },
    danger: {
      color: '#fecaca',
      border: 'rgba(248,113,113,0.4)',
      bg: 'rgba(248,113,113,0.10)',
    },
    neutral: {
      color: '#fde68a',
      border: 'rgba(250,204,21,0.35)',
      bg: 'rgba(250,204,21,0.08)',
    },
  }[tone] || {};

  return (
    <span
      className="kronox-number mt-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs"
      style={{
        color: styles.color,
        background: styles.bg,
        boxShadow: `inset 0 0 0 1px ${styles.border}`,
      }}
    >
      {Icon && <Icon className={`h-3.5 w-3.5 ${Icon === Loader2 ? 'animate-spin' : ''}`} />}
      {label}
    </span>
  );
}

function WheelEmblem({ spinning, muted }) {
  const spokes = Array.from({ length: 12 }, (_, index) => index);
  return (
    <motion.span
      aria-hidden="true"
      className="relative grid shrink-0 place-items-center"
      animate={spinning ? { rotate: 720 } : { rotate: 0 }}
      transition={{ duration: 1.15, ease: [0.2, 0.9, 0.2, 1] }}
      style={{
        width: 'clamp(58px, 15.8vw, 70px)',
        height: 'clamp(58px, 15.8vw, 70px)',
        opacity: muted ? 0.72 : 1,
        filter: 'drop-shadow(0 0 14px rgba(250,204,21,0.34))',
      }}
    >
      <span
        className="absolute inset-0 rounded-full"
        style={{
          background:
            'radial-gradient(circle at 38% 30%, rgba(255,255,255,0.35), rgba(250,204,21,0.18) 22%, transparent 46%)',
        }}
      />
      <span
        className="absolute inset-[3px] rounded-full"
        style={{
          background: 'linear-gradient(145deg, #ffe77a 0%, #f6b70b 42%, #8b5204 100%)',
          boxShadow: 'inset 0 2px 2px rgba(255,255,255,0.38), inset 0 -3px 5px rgba(60,27,0,0.5)',
        }}
      />
      <span
        className="absolute inset-[9px] rounded-full"
        style={{
          background: 'radial-gradient(circle at 50% 50%, #0b1736 0%, #101f46 54%, #030817 100%)',
          boxShadow: 'inset 0 0 0 2px rgba(255,217,102,0.72), inset 0 0 16px rgba(0,0,0,0.62)',
        }}
      />
      {spokes.map((index) => {
        const highlighted = index % 3 === 0;
        return (
          <span
            key={index}
            className="absolute left-1/2 top-1/2 origin-left"
            style={{
              width: '31%',
              height: highlighted ? 2 : 1,
              transform: `rotate(${index * 30}deg)`,
              background: highlighted
                ? 'linear-gradient(90deg, rgba(255,236,160,0.18), rgba(255,218,74,0.95))'
                : 'linear-gradient(90deg, rgba(255,236,160,0.08), rgba(250,204,21,0.72))',
              borderRadius: 999,
              boxShadow: highlighted ? '0 0 4px rgba(250,204,21,0.5)' : 'none',
            }}
          />
        );
      })}
      <span
        className="absolute rounded-full"
        style={{
          width: '24%',
          height: '24%',
          background: 'radial-gradient(circle at 35% 28%, #fff7bd, #facc15 45%, #a16207 100%)',
          boxShadow: '0 0 0 2px rgba(91,42,0,0.65), 0 0 10px rgba(250,204,21,0.45)',
        }}
      />
      <span
        className="absolute"
        style={{
          top: '2%',
          width: 0,
          height: 0,
          borderLeft: '6px solid transparent',
          borderRight: '6px solid transparent',
          borderTop: '14px solid #f8fafc',
          filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.72)) drop-shadow(0 0 3px rgba(250,204,21,0.35))',
        }}
      />
    </motion.span>
  );
}

function RewardWheel({
  spinning = false,
  mode = 'target',
  targetRotation = 0,
  highlightAmount = null,
  compact = false,
  reducedMotion = false,
}) {
  const effectiveDurationSeconds = reducedMotion
    ? WHEEL_REDUCED_MOTION_DURATION_SECONDS
    : WHEEL_SPIN_DURATION_SECONDS;
  const loopAnimation = spinning && mode === 'loop'
    ? { rotate: reducedMotion ? [0, 28, 0] : [0, 360] }
    : {
      rotate: spinning && !reducedMotion
        ? [
          0,
          targetRotation * 0.1,
          targetRotation * 0.72,
          targetRotation - 8,
          targetRotation + 2,
          targetRotation,
        ]
        : targetRotation,
    };
  const loopTransition = spinning && mode === 'loop'
    ? {
      duration: reducedMotion ? 0.9 : 0.72,
      repeat: Infinity,
      ease: reducedMotion ? 'easeInOut' : 'linear',
    }
    : {
      duration: spinning ? effectiveDurationSeconds : 0.18,
      times: spinning && !reducedMotion ? WHEEL_SPIN_KEYFRAME_TIMES : undefined,
      ease: spinning && !reducedMotion
        ? ['easeIn', 'linear', [0.13, 0.84, 0.2, 1], 'easeOut', 'easeOut']
        : [0.12, 0.72, 0.14, 1],
    };
  const conicStops = WHEEL_REWARD_SLICES.map((amount, index) => {
    const start = index * WHEEL_SLICE_DEGREES;
    const end = (index + 1) * WHEEL_SLICE_DEGREES;
    return `${WHEEL_SLICE_COLORS[index]} ${start}deg ${end}deg`;
  }).join(', ');
  const wheelSize = compact
    ? 'clamp(190px, 58vw, 218px)'
    : 'clamp(276px, 82vw, 318px)';
  const rimLights = Array.from({ length: 24 }, (_, index) => index);

  return (
    <div
      className="relative grid place-items-center"
      style={{
        width: wheelSize,
        height: wheelSize,
        filter: 'drop-shadow(0 22px 42px rgba(0,0,0,0.52))',
      }}
      aria-label="Günlük Çark ödül seçenekleri"
    >
      <div
        aria-hidden="true"
        className="absolute -top-3 z-30 grid place-items-center"
        style={{
          width: 44,
          height: 52,
          filter: 'drop-shadow(0 4px 4px rgba(0,0,0,0.75)) drop-shadow(0 0 9px rgba(250,204,21,0.58))',
        }}
      >
        <span
          className="absolute top-0 rounded-full"
          style={{
            width: 28,
            height: 28,
            background: 'radial-gradient(circle at 35% 25%, #fff7bd, #facc15 45%, #92400e 100%)',
            boxShadow: '0 0 0 3px rgba(6,10,24,0.85), inset 0 1px 2px rgba(255,255,255,0.5)',
          }}
        />
        <span
          className="absolute top-[18px]"
          style={{
            width: 0,
            height: 0,
            borderLeft: '15px solid transparent',
            borderRight: '15px solid transparent',
            borderTop: '34px solid #fde68a',
          }}
        />
      </div>
      <div
        aria-hidden="true"
        className="absolute -inset-[5px] rounded-full"
        style={{
          background: 'linear-gradient(145deg, #fff4a3, #f5b301 32%, #4f46e5 66%, #082f49 100%)',
          boxShadow: '0 0 28px rgba(250,204,21,0.26), inset 0 2px 3px rgba(255,255,255,0.4)',
        }}
      />
      {rimLights.map((index) => (
        <span
          key={index}
          aria-hidden="true"
          className="absolute left-1/2 top-1/2 z-10 rounded-full"
          style={{
            width: index % 2 === 0 ? 5 : 3,
            height: index % 2 === 0 ? 5 : 3,
            background: index % 2 === 0 ? '#fef3c7' : 'rgba(191,219,254,0.9)',
            boxShadow: index % 2 === 0 ? '0 0 8px rgba(250,204,21,0.76)' : '0 0 6px rgba(56,189,248,0.55)',
            transform: `rotate(${index * 15}deg) translateY(${compact ? '-110px' : '-158px'})`,
          }}
        />
      ))}
      <motion.div
        className="absolute inset-0 overflow-hidden rounded-full"
        animate={loopAnimation}
        transition={loopTransition}
        style={{
          background: `radial-gradient(circle at 50% 50%, transparent 0 31%, rgba(0,0,0,0.08) 32% 100%), conic-gradient(from -${WHEEL_SLICE_DEGREES / 2}deg, ${conicStops})`,
          border: '7px solid rgba(250,204,21,0.96)',
          boxShadow: 'inset 0 0 0 5px rgba(8,13,32,0.68), inset 0 0 30px rgba(0,0,0,0.36), 0 0 28px rgba(250,204,21,0.24)',
          willChange: 'transform',
        }}
      >
        <div
          aria-hidden="true"
          className="absolute inset-[8px] rounded-full"
          style={{
            background: `repeating-conic-gradient(from -${WHEEL_SLICE_DEGREES / 2}deg, transparent 0deg ${WHEEL_SLICE_DEGREES - 1.2}deg, rgba(4,10,28,0.72) ${WHEEL_SLICE_DEGREES - 1.2}deg ${WHEEL_SLICE_DEGREES}deg)`,
          }}
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 rounded-full"
          style={{
            background: 'radial-gradient(circle at 34% 20%, rgba(255,255,255,0.28), transparent 26%), radial-gradient(circle at 50% 62%, transparent 0 42%, rgba(2,6,23,0.28) 76%)',
            pointerEvents: 'none',
          }}
        />
        {WHEEL_REWARD_SLICES.map((amount, index) => {
          const angle = index * WHEEL_SLICE_DEGREES;
          const isHighlighted = Number(highlightAmount) === amount;
          return (
            <div
              key={amount}
              className="absolute left-1/2 top-1/2 grid place-items-center"
              style={{
                width: compact ? 56 : 66,
                height: compact ? 28 : 34,
                marginLeft: compact ? -28 : -33,
                marginTop: -15,
                transform: `rotate(${angle}deg) translateY(${compact ? '-70px' : '-110px'}) rotate(${-angle}deg)`,
              }}
            >
              <span
                className={`kronox-number inline-flex items-center gap-1 rounded-full px-2 py-1 ${compact ? 'text-[10px]' : 'text-[12px]'}`}
                style={{
                  color: '#fff7ed',
                  background: isHighlighted ? 'rgba(6,10,24,0.94)' : 'rgba(6,10,24,0.68)',
                  boxShadow: isHighlighted
                    ? '0 0 0 2px rgba(255,255,255,0.78), 0 0 20px rgba(250,204,21,0.72)'
                    : '0 0 0 1px rgba(255,255,255,0.28)',
                  textShadow: '0 1px 2px rgba(0,0,0,0.72)',
                }}
              >
                +{amount}
                <Gem className="h-3 w-3 text-amber-200" fill="currentColor" strokeWidth={2.6} />
              </span>
            </div>
          );
        })}
      </motion.div>
      {/* center hub */}
      <div
        className="absolute rounded-full"
        style={{
          width: '30%',
          height: '30%',
          background: 'radial-gradient(circle at 35% 26%, #fff9c4, #facc15 38%, #b45309 72%, #451a03 100%)',
          border: '4px solid rgba(8,13,32,0.82)',
          boxShadow: '0 0 0 4px rgba(250,204,21,0.62), 0 0 24px rgba(250,204,21,0.46), inset 0 3px 5px rgba(255,255,255,0.5), inset 0 -5px 8px rgba(69,26,3,0.55)',
        }}
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 rounded-full"
        style={{
          boxShadow: 'inset 0 18px 26px rgba(255,255,255,0.13), inset 0 -22px 28px rgba(0,0,0,0.28)',
          pointerEvents: 'none',
        }}
      />
    </div>
  );
}

function DailyWheelPromptModal({ claiming, onSpin, onClose }) {
  const prefersReducedMotion = useReducedMotion();
  return (
    <DailyWheelModalFrame onClose={onClose} disableClose={claiming}>
      <RewardWheel spinning={claiming} mode="loop" reducedMotion={prefersReducedMotion} />
      <h2 className="text-center font-inter text-2xl font-black text-white">Günlük Çark hazır!</h2>
      <p className="text-center text-sm font-semibold text-slate-200">Bugünkü ödülünü almak için çevir.</p>
      <div className="mt-2 flex w-full gap-2">
        <ModalButton tone="secondary" onClick={onClose}>Sonra</ModalButton>
        <ModalButton onClick={onSpin} disabled={claiming}>
          {claiming ? 'Ödül hazırlanıyor...' : 'Çevir'}
        </ModalButton>
      </div>
    </DailyWheelModalFrame>
  );
}

function DailyWheelResultModal({ status, error, claiming, result, onSpin, onClose }) {
  const hasReward = Number(result?.totalRewardAmount) > 0;
  const alreadyClaimed = Boolean(result?.alreadyClaimedToday || result?.alreadyClaimed);
  const updatedDiamondTotal = Number(result?.updatedDiamondTotal);
  const streakBonusAmount = Number(result?.streakBonusAmount) || 0;
  const streakBonusText = streakBonusAmount === 100
    ? '7 günlük seri bonusu: +100 elmas'
    : `7 günlük seri bonusu: +${formatDiamondCount(streakBonusAmount)} elmas`;
  const [revealReady, setRevealReady] = useState(false);
  const prefersReducedMotion = useReducedMotion();
  const targetRotation = useMemo(
    () => getWheelTargetRotation(result?.rewardAmount, prefersReducedMotion),
    [result?.rewardAmount, prefersReducedMotion],
  );
  const spinDurationMs = prefersReducedMotion ? WHEEL_REDUCED_MOTION_DURATION_MS : WHEEL_SPIN_DURATION_MS;

  useEffect(() => {
    setRevealReady(false);
    if (!hasReward) return undefined;
    try { sounds.wheelSpinStart?.(); } catch { /* non-blocking */ }
    const tickId = window.setInterval(() => {
      try { sounds.wheelTick?.(); } catch { /* non-blocking */ }
    }, 145);
    const revealId = window.setTimeout(() => {
      window.clearInterval(tickId);
      setRevealReady(true);
      try { sounds.rewardReveal?.(); } catch { /* non-blocking */ }
    }, spinDurationMs);
    return () => {
      window.clearInterval(tickId);
      window.clearTimeout(revealId);
    };
  }, [hasReward, result?.rewardAmount, spinDurationMs]);

  return (
    <DailyWheelModalFrame onClose={onClose} disableClose={hasReward && !revealReady}>
      {status === 'error' ? (
        <>
          <RewardWheel spinning={claiming} mode="loop" reducedMotion={prefersReducedMotion} />
          <h2 className="text-center font-inter text-2xl font-black text-white">Ödül alınamadı</h2>
          <p
            role="alert"
            className="rounded-xl bg-red-500/12 px-3 py-2 text-center text-xs font-bold text-red-100"
          >
            {error || 'Çark çevrilemedi. Lütfen tekrar dene.'}
          </p>
          <div className="mt-2 flex w-full gap-2">
            <ModalButton tone="secondary" onClick={onClose}>Kapat</ModalButton>
            <ModalButton onClick={onSpin} disabled={claiming}>
              {claiming ? 'Çevriliyor...' : 'Tekrar dene'}
            </ModalButton>
          </div>
        </>
      ) : hasReward ? (
        <>
          <RewardWheel
            spinning={!revealReady}
            targetRotation={targetRotation}
            highlightAmount={revealReady ? result.rewardAmount : null}
            compact={revealReady}
            reducedMotion={prefersReducedMotion}
          />
          {!revealReady ? (
            <>
              <h2 className="text-center font-inter text-2xl font-black text-white">Çark dönüyor...</h2>
              <p className="text-center text-sm font-semibold text-slate-200">
                Ödülün işaretçinin altında duracak.
              </p>
              <ModalButton disabled>Çevriliyor...</ModalButton>
            </>
          ) : (
            <>
              <motion.div
                initial={{ scale: 0.86, opacity: 0 }}
                animate={{ scale: [0.96, 1.05, 1], opacity: 1 }}
                transition={{ duration: 0.46, ease: 'easeOut' }}
                className="relative w-full overflow-hidden rounded-2xl px-4 py-4 text-center"
                style={{
                  border: '1px solid rgba(250,204,21,0.62)',
                  background: 'linear-gradient(180deg, rgba(250,204,21,0.18), rgba(56,189,248,0.08))',
                  boxShadow: '0 0 24px rgba(250,204,21,0.22), inset 0 0 0 1px rgba(255,255,255,0.08)',
                }}
              >
                {!prefersReducedMotion && <RewardBurst />}
                <Sparkles className="mx-auto mb-2 h-8 w-8 text-amber-300" />
                <h2 className="font-inter text-3xl font-black text-white">
                  +{formatDiamondCount(result.rewardAmount)} Elmas kazandın
                </h2>
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0"
                  style={{
                    background: 'radial-gradient(circle at 50% 20%, rgba(255,255,255,0.18), transparent 48%)',
                  }}
                />
              </motion.div>
              <div className="space-y-2 rounded-xl bg-amber-300/12 px-3 py-2 text-center">
                {streakBonusAmount > 0 && (
                  <p className="text-sm font-extrabold text-amber-100">
                    {streakBonusText}
                  </p>
                )}
                <p className="text-xs font-bold text-amber-50/80">
                  Toplam: +{formatDiamondCount(result.totalRewardAmount)} elmas
                </p>
              </div>
              {Number.isFinite(updatedDiamondTotal) && (
                <p className="rounded-full bg-slate-950/38 px-3 py-1.5 text-center text-sm font-extrabold text-amber-100">
                  Toplam Elmas: <span className="kronox-number">{formatDiamondCount(updatedDiamondTotal)}</span>
                </p>
              )}
              <p className="text-center text-xs font-semibold text-slate-300">
                Seri: <span className="kronox-number">{Number(result.streakAfter) || 1}</span> gün
              </p>
              <ModalButton onClick={onClose}>Kapat</ModalButton>
            </>
          )}
        </>
      ) : alreadyClaimed ? (
        <>
          <Gift className="h-10 w-10 text-amber-300" />
          <h2 className="text-center font-inter text-xl font-black text-white">Bugünkü ödülünü aldın.</h2>
          <p className="text-center text-sm font-semibold text-slate-200">
            Yeni çark yarın hazır olacak.
          </p>
          {result?.nextAvailableAt && (
            <p className="kronox-number text-center text-xs text-amber-100/85">
              {formatCountdown(result.nextAvailableAt)}
            </p>
          )}
          <ModalButton onClick={onClose}>Tamam</ModalButton>
        </>
      ) : (
        <>
          <RewardWheel spinning={claiming} mode="loop" reducedMotion={prefersReducedMotion} />
          <h2 className="text-center font-inter text-2xl font-black text-white">Günlük Çark hazır!</h2>
          <p className="text-center text-sm font-semibold text-slate-200">Bugünkü ödülünü almak için çevir.</p>
          {error && (
            <p role="alert" className="rounded-xl bg-red-500/12 px-3 py-2 text-center text-xs font-bold text-red-100">
              {error}
            </p>
          )}
          <ModalButton onClick={onSpin} disabled={claiming}>
            {claiming ? 'Çevriliyor...' : 'Çevir'}
          </ModalButton>
        </>
      )}
    </DailyWheelModalFrame>
  );
}

function DailyWheelStatusModal({ nextLabel, onClose }) {
  return (
    <DailyWheelModalFrame onClose={onClose}>
      <Gift className="h-10 w-10 text-amber-300" />
      <h2 className="text-center font-inter text-xl font-black text-white">Bugünkü ödülünü aldın.</h2>
      <p className="text-center text-sm font-semibold text-slate-200">
        Yeni çark yarın hazır olacak.
      </p>
      <p className="kronox-number text-center text-xs text-amber-100/85">{nextLabel}</p>
      <ModalButton onClick={onClose}>Tamam</ModalButton>
    </DailyWheelModalFrame>
  );
}

function DailyWheelModalFrame({ children, onClose, disableClose = false }) {
  return (
    <div
      className="fixed inset-0 z-[220] grid place-items-center px-3"
      style={{
        background: 'rgba(2,6,23,0.72)',
        backdropFilter: 'blur(8px)',
        paddingTop: 'max(0.75rem, env(safe-area-inset-top))',
        paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))',
      }}
      role="dialog"
      aria-modal="true"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 12 }}
        className="relative flex w-full flex-col items-center gap-3 rounded-[22px]"
        style={{
          maxWidth: 'min(25.5rem, calc(100vw - 1.5rem))',
          maxHeight: 'calc(100dvh - 1.5rem)',
          padding: 'clamp(1rem, 4vw, 1.25rem)',
          border: '1px solid rgba(250,204,21,0.42)',
          background: 'linear-gradient(180deg, rgba(10,24,58,0.98), rgba(4,10,28,0.98))',
          boxShadow: '0 24px 80px rgba(0,0,0,0.62), inset 0 0 0 1px rgba(255,255,255,0.06)',
        }}
      >
        <button
          type="button"
          onClick={disableClose ? undefined : onClose}
          disabled={disableClose}
          className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-full text-slate-200"
          style={{
            background: 'rgba(255,255,255,0.08)',
            opacity: disableClose ? 0.38 : 1,
          }}
          aria-label="Kapat"
        >
          <X className="h-4 w-4" />
        </button>
        {children}
      </motion.div>
    </div>
  );
}

function RewardBurst() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0">
      {Array.from({ length: 12 }, (_, index) => {
        const angle = index * 30;
        return (
          <motion.span
            key={angle}
            className="absolute left-1/2 top-1/2 rounded-full"
            initial={{ x: 0, y: 0, scale: 0.4, opacity: 0 }}
            animate={{
              x: Math.cos((angle * Math.PI) / 180) * 128,
              y: Math.sin((angle * Math.PI) / 180) * 72,
              scale: [0.4, 1, 0.2],
              opacity: [0, 1, 0],
            }}
            transition={{ duration: 0.72, ease: 'easeOut', delay: index * 0.018 }}
            style={{
              width: index % 3 === 0 ? 8 : 5,
              height: index % 3 === 0 ? 8 : 5,
              marginLeft: index % 3 === 0 ? -4 : -2.5,
              marginTop: index % 3 === 0 ? -4 : -2.5,
              background: index % 2 === 0 ? '#facc15' : '#7dd3fc',
              boxShadow: index % 2 === 0 ? '0 0 10px rgba(250,204,21,0.85)' : '0 0 10px rgba(125,211,252,0.7)',
            }}
          />
        );
      })}
    </div>
  );
}

function ModalButton({ children, tone = 'primary', disabled = false, onClick }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="min-h-11 flex-1 rounded-xl px-4 py-3 text-sm font-black transition-transform active:scale-[0.98] disabled:opacity-60"
      style={{
        background: tone === 'secondary'
          ? 'rgba(148,163,184,0.14)'
          : 'linear-gradient(180deg, #facc15, #d99b05)',
        color: tone === 'secondary' ? '#e2e8f0' : '#1a1003',
        boxShadow: tone === 'secondary'
          ? 'inset 0 0 0 1px rgba(255,255,255,0.12)'
          : 'inset 0 1px 0 rgba(255,255,255,0.55), 0 10px 24px rgba(0,0,0,0.35)',
      }}
    >
      {children}
    </button>
  );
}
