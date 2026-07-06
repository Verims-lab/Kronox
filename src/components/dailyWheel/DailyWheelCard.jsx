import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Gift, Loader2, RotateCw, Sparkles, X } from 'lucide-react';
import { useDailyWheel } from '@/hooks/useDailyWheel';
import {
  DAILY_WHEEL_REWARD_SEGMENTS,
  DAILY_WHEEL_VISUAL_SEGMENT_COUNT,
  formatDailyWheelJokerLabel,
  getDailyWheelSegmentById,
  normalizeDailyWheelJokerRewards,
  normalizeDailyWheelSegmentIndex,
} from '@/lib/dailyWheelRewards';
import { sounds } from '@/lib/gameSounds';

const WHEEL_REWARD_SLICES = DAILY_WHEEL_REWARD_SEGMENTS;
const WHEEL_SLICE_DEGREES = 360 / DAILY_WHEEL_VISUAL_SEGMENT_COUNT;
// One continuous landing spin (no visible loop phase): the wheel reaches a
// clear fast pace immediately, holds that speed, and decelerates only near the
// final phase before a light bounce settle on the backend-selected segment.
// This removes the old slow → fast → slow feel caused by handing off from a
// separate steady loop into an eased landing.
const WHEEL_SPIN_DURATION_MS = 5000;
const WHEEL_REDUCED_MOTION_DURATION_MS = 900;
const WHEEL_SPIN_DURATION_SECONDS = WHEEL_SPIN_DURATION_MS / 1000;
const WHEEL_REDUCED_MOTION_DURATION_SECONDS = WHEEL_REDUCED_MOTION_DURATION_MS / 1000;
// Monotonic deceleration curve: near-instant fast start (steep early ramp),
// then a long smooth ease-out tail. No mid-animation acceleration.
const WHEEL_LANDING_EASE = [0.05, 0.75, 0.15, 1];
// Light final bounce on the wheel rotation itself (in degrees) so the landing
// segment settles under the pointer with a small, controlled overshoot.
const WHEEL_LANDING_BOUNCE_DEGREES = 5;
const WHEEL_LANDING_SETTLE_SCALE = 1.018;
const DAILY_WHEEL_SEGMENT_CONTENT_SCALE = 0.8;
const DAILY_WHEEL_SEGMENT_CONTENT_STYLE = {
  transform: 'scale(var(--daily-wheel-segment-content-scale))',
  transformOrigin: 'center',
  backfaceVisibility: 'hidden',
  WebkitBackfaceVisibility: 'hidden',
};
let dailyWheelConfettiInstance = null;

function getWheelTargetRotation(rewardSegmentIndex, reducedMotion = false) {
  const index = normalizeDailyWheelSegmentIndex(rewardSegmentIndex);
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

export default function DailyWheelCard({
  user,
  guestProfile,
  onUserUpdated,
  onLogin,
  compact = false,
  openClaimedResultOnMount = false,
  openAvailableResultOnMount = false,
  renderLauncher = true,
  forceModalOpen = false,
  onResultClose,
}) {
  const [claimedResultAutoOpened, setClaimedResultAutoOpened] = useState(false);
  const [availableResultAutoOpened, setAvailableResultAutoOpened] = useState(false);
  const wheel = useDailyWheel({ user, guestProfile, onUserUpdated });
  const claimedLabel = useMemo(
    () => formatCountdown(wheel.wheel?.nextAvailableAt),
    [wheel.wheel?.nextAvailableAt],
  );

  useEffect(() => {
    if (!openClaimedResultOnMount) return;
    if (claimedResultAutoOpened) return;
    if (wheel.status !== 'claimed') return;
    if (wheel.showResult || wheel.claiming) return;
    setClaimedResultAutoOpened(true);
    wheel.openClaimedResult();
  }, [
    claimedResultAutoOpened,
    openClaimedResultOnMount,
    wheel,
    wheel.claiming,
    wheel.showResult,
    wheel.status,
  ]);

  useEffect(() => {
    if (!openAvailableResultOnMount) return;
    if (availableResultAutoOpened) return;
    if (wheel.status !== 'available') return;
    if (wheel.showResult || wheel.claiming) return;
    setAvailableResultAutoOpened(true);
    wheel.openResult();
  }, [
    availableResultAutoOpened,
    openAvailableResultOnMount,
    wheel,
    wheel.claiming,
    wheel.showResult,
    wheel.status,
  ]);

  const handleCardClick = () => {
    sounds.tap();
    if (wheel.status === 'sign_in_required') {
      onLogin?.();
      return;
    }
    if (wheel.status === 'available') {
      // Open the result modal and start the spin in one motion — the wheel
      // begins turning immediately, no separate "prepare" wait.
      wheel.openResult();
      wheel.claim();
      return;
    }
    if (wheel.status === 'claimed') {
      wheel.openClaimedResult();
      return;
    }
    if (wheel.status === 'error') wheel.refresh();
  };

  const handleResultClose = () => {
    wheel.closeResult();
    onResultClose?.();
  };

  const handlePromptClose = () => {
    wheel.dismissPrompt();
    onResultClose?.();
  };

  const modalCloseHandler = (forceModalOpen || wheel.showResult)
    ? handleResultClose
    : handlePromptClose;

  const resultModal = (forceModalOpen || wheel.showPrompt || wheel.showResult) && (
    <DailyWheelResultModal
      status={wheel.status}
      error={wheel.error}
      claiming={wheel.claiming}
      result={wheel.lastResult}
      onSpin={wheel.claim}
      onClose={modalCloseHandler}
    />
  );

  if (!renderLauncher) {
    return resultModal ? <>{resultModal}</> : null;
  }

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
          minHeight: compact ? 'clamp(58px, 14.5vw, 70px)' : 'clamp(72px, 17vw, 88px)',
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

        <div className={`relative flex w-full items-center ${compact ? 'gap-2 px-3 py-2' : 'gap-3 px-4 py-3'}`}>
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

      {resultModal}
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
  // 'idle'    — resting (decorative / pre-tap / brief backend wait)
  // 'landing' — one continuous fast-start → decelerate spin to the winning slice
  phase = 'idle',
  targetRotation = 0,
  highlightAmount = null,
  compact = false,
  reducedMotion = false,
}) {
  const landingDurationSeconds = reducedMotion
    ? WHEEL_REDUCED_MOTION_DURATION_SECONDS
    : WHEEL_SPIN_DURATION_SECONDS;

  let wheelAnimation;
  let wheelTransition;
  if (phase === 'landing') {
    // One continuous timeline from rest to the backend-selected segment. The
    // wheel keyframes slightly PAST the target then settles back the small
    // bounce amount — a single monotonic ease-out with a light final bounce,
    // never a separate loop → landing handoff.
    if (reducedMotion) {
      wheelAnimation = { rotate: targetRotation };
      wheelTransition = { duration: landingDurationSeconds, ease: 'easeOut' };
    } else {
      wheelAnimation = { rotate: [0, targetRotation + WHEEL_LANDING_BOUNCE_DEGREES, targetRotation] };
      wheelTransition = {
        duration: landingDurationSeconds,
        times: [0, 0.9, 1],
        ease: [WHEEL_LANDING_EASE, 'easeOut'],
      };
    }
  } else {
    wheelAnimation = { rotate: targetRotation };
    wheelTransition = { duration: 0.18, ease: 'easeOut' };
  }
  const settleAnimation = highlightAmount && !reducedMotion
    ? { scale: [1, WHEEL_LANDING_SETTLE_SCALE, 1] }
    : { scale: 1 };
  const settleTransition = highlightAmount && !reducedMotion
    ? { duration: 0.34, ease: 'easeOut' }
    : { duration: 0.18, ease: 'easeOut' };
  const conicStops = WHEEL_REWARD_SLICES.map((segment, index) => {
    const start = index * WHEEL_SLICE_DEGREES;
    const end = (index + 1) * WHEEL_SLICE_DEGREES;
    return `${segment.segmentColor} ${start}deg ${end}deg`;
  }).join(', ');
  const rimLights = Array.from({ length: compact ? 16 : 24 }, (_, index) => index);

  return (
    <motion.div
      className="relative grid place-items-center"
      animate={settleAnimation}
      transition={settleTransition}
      style={{
        '--daily-wheel-segment-content-scale': DAILY_WHEEL_SEGMENT_CONTENT_SCALE,
        width: '85%',
        maxWidth: '22rem',
        aspectRatio: '1 / 1',
        filter: 'drop-shadow(0 22px 42px rgba(0,0,0,0.54))',
      }}
      aria-label="Günlük Çark ödül seçenekleri"
    >
      <div
        aria-hidden="true"
        className="absolute z-40 grid place-items-center"
        style={{
          top: '-4.5%',
          width: '13%',
          height: '18%',
          filter: 'drop-shadow(0 5px 5px rgba(0,0,0,0.78)) drop-shadow(0 0 10px rgba(250,204,21,0.62))',
        }}
      >
        <span
          className="absolute top-0 rounded-full"
          style={{
            width: '62%',
            aspectRatio: '1 / 1',
            background: 'radial-gradient(circle at 34% 24%, #fff8bd, #ffd431 42%, #b86b04 76%, #4b2100 100%)',
            border: '2px solid rgba(255,248,189,0.88)',
            boxShadow: '0 0 0 3px rgba(4,11,28,0.92), inset 0 2px 3px rgba(255,255,255,0.48)',
          }}
        />
        <span
          className="absolute"
          style={{
            top: '42%',
            width: 0,
            height: 0,
            borderLeft: 'clamp(0.6rem, 3.2vw, 1rem) solid transparent',
            borderRight: 'clamp(0.6rem, 3.2vw, 1rem) solid transparent',
            borderTop: 'clamp(1.35rem, 7vw, 2.25rem) solid #facc15',
          }}
        />
      </div>
      <div
        aria-hidden="true"
        className="absolute rounded-full"
        style={{
          inset: '-1.8%',
          background:
            'conic-gradient(from -35deg, #fff6aa, #f4b20d 16%, #9f5a05 28%, #fff1a8 42%, #d78b05 58%, #7c3f03 72%, #ffe88d 88%, #fff6aa)',
          boxShadow:
            '0 0 34px rgba(250,204,21,0.36), 0 0 62px rgba(56,189,248,0.14), inset 0 2px 4px rgba(255,255,255,0.45), inset 0 -5px 10px rgba(69,26,3,0.62)',
        }}
      />
      {rimLights.map((index) => (
        <span
          key={index}
          aria-hidden="true"
          className="absolute left-1/2 top-1/2 z-10 rounded-full"
          style={{
            width: index % 2 === 0 ? '1.9%' : '1.25%',
            aspectRatio: '1 / 1',
            background: index % 2 === 0 ? '#fff4a3' : 'rgba(255,231,122,0.82)',
            boxShadow: index % 2 === 0
              ? '0 0 10px rgba(250,204,21,0.88)'
              : '0 0 7px rgba(250,204,21,0.58)',
            transform: `rotate(${index * (360 / rimLights.length)}deg) translateY(calc(-1 * min(39vw, 10.95rem)))`,
          }}
        />
      ))}
      <motion.div
        className="absolute overflow-hidden rounded-full"
        animate={wheelAnimation}
        transition={wheelTransition}
        style={{
          inset: '3.8%',
          background: `radial-gradient(circle at 50% 50%, transparent 0 8%, rgba(0,0,0,0.08) 9% 100%), conic-gradient(from -${WHEEL_SLICE_DEGREES / 2}deg, ${conicStops})`,
          border: 'clamp(0.28rem, 1.25vw, 0.45rem) solid rgba(250,204,21,0.98)',
          boxShadow:
            'inset 0 0 0 clamp(0.16rem, 0.55vw, 0.28rem) rgba(9,16,36,0.72), inset 0 0 30px rgba(0,0,0,0.38), 0 0 28px rgba(250,204,21,0.22)',
          willChange: 'transform',
        }}
      >
        <div
          aria-hidden="true"
          className="absolute inset-[2.5%] rounded-full"
          style={{
            zIndex: 2,
            background: `repeating-conic-gradient(from -${WHEEL_SLICE_DEGREES / 2}deg, transparent 0deg ${WHEEL_SLICE_DEGREES - 1.05}deg, rgba(3,9,26,0.72) ${WHEEL_SLICE_DEGREES - 1.05}deg ${WHEEL_SLICE_DEGREES}deg)`,
          }}
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 rounded-full"
          style={{
            zIndex: 3,
            background: 'radial-gradient(circle at 34% 20%, rgba(255,255,255,0.28), transparent 26%), radial-gradient(circle at 50% 62%, transparent 0 42%, rgba(2,6,23,0.28) 76%)',
            pointerEvents: 'none',
          }}
        />
        {WHEEL_REWARD_SLICES.map((segment, index) => {
          const angle = index * WHEEL_SLICE_DEGREES;
          const radians = (angle * Math.PI) / 180;
          const radius = 31;
          const x = 50 + (Math.sin(radians) * radius);
          const y = 50 - (Math.cos(radians) * radius);
          const isHighlighted = String(highlightAmount || '') === segment.id;
          // Radial center-facing orientation: rotate each segment's content by
          // its own center angle so the icon/number group aligns with the
          // wedge and visually faces the wheel center (no screen-upright
          // counter-rotation). Content stays inside the spinning wheel layer,
          // so it rotates with the wheel; the pointer stays outside/stationary.
          return (
            <div
              key={segment.id}
              className="absolute grid place-items-center"
              style={{
                left: `${x}%`,
                top: `${y}%`,
                width: segment.type === 'diamonds' ? '17%' : '21%',
                transform: `translate(-50%, -50%) rotate(${angle}deg)`,
                transformOrigin: 'center',
                backfaceVisibility: 'hidden',
                WebkitBackfaceVisibility: 'hidden',
                willChange: phase === 'landing' ? 'transform' : 'auto',
                zIndex: 5,
                filter: isHighlighted
                  ? 'drop-shadow(0 0 12px rgba(255,255,255,0.74)) drop-shadow(0 0 20px rgba(250,204,21,0.86))'
                  : 'drop-shadow(0 3px 3px rgba(0,0,0,0.48))',
              }}
            >
              <DailyWheelSegmentContent segment={segment} compact={compact} />
            </div>
          );
        })}
      </motion.div>
      {/* center hub */}
      <div
        className="absolute rounded-full"
        style={{
          width: '8%',
          aspectRatio: '1 / 1',
          background: 'radial-gradient(circle at 35% 26%, #fff7b8, #facc15 42%, #b45309 73%, #4a1f02 100%)',
          border: '2px solid rgba(255,248,189,0.78)',
          boxShadow:
            '0 0 0 3px rgba(7,13,31,0.82), 0 0 16px rgba(250,204,21,0.5), inset 0 2px 3px rgba(255,255,255,0.52), inset 0 -3px 5px rgba(69,26,3,0.58)',
          zIndex: 8,
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
    </motion.div>
  );
}

function DailyWheelSegmentContent({ segment, compact }) {
  if (segment?.type === 'diamonds') {
    return (
      <div
        className="flex flex-col items-center justify-center leading-none"
        style={DAILY_WHEEL_SEGMENT_CONTENT_STYLE}
      >
        <PremiumDiamondIcon />
        <span
          className="kronox-number mt-1 font-black text-white"
          style={{
            fontSize: compact ? 'clamp(1rem, 4vw, 1.35rem)' : 'clamp(1.15rem, 5vw, 1.75rem)',
            textShadow: '0 2px 3px rgba(0,0,0,0.72), 0 0 7px rgba(255,255,255,0.18)',
          }}
        >
          {segment.wheelLabel}
        </span>
      </div>
    );
  }

  const icon = (() => {
    if (segment?.iconKey === 'gift_box') return <PremiumGiftIcon />;
    if (segment?.iconKey === 'shield') return <PremiumShieldIcon />;
    if (segment?.iconKey === 'snowflake') return <PremiumFreezeIcon />;
    if (segment?.iconKey === 'swap') return <PremiumSwapIcon />;
    return <PremiumDiamondIcon />;
  })();

  return (
    <span className="grid place-items-center" style={DAILY_WHEEL_SEGMENT_CONTENT_STYLE}>
      {icon}
    </span>
  );
}

function PremiumDiamondIcon() {
  return (
    <svg
      viewBox="0 0 64 52"
      aria-hidden="true"
      className="block"
      style={{ width: 'clamp(1.6rem, 7vw, 2.8rem)', height: 'auto' }}
    >
      <defs>
        <linearGradient id="daily-wheel-diamond-top" x1="10" y1="5" x2="52" y2="45" gradientUnits="userSpaceOnUse">
          <stop stopColor="#fff7ad" />
          <stop offset="0.42" stopColor="#ffc928" />
          <stop offset="1" stopColor="#f97316" />
        </linearGradient>
        <linearGradient id="daily-wheel-diamond-side" x1="14" y1="10" x2="48" y2="50" gradientUnits="userSpaceOnUse">
          <stop stopColor="#ffd84e" />
          <stop offset="1" stopColor="#d97706" />
        </linearGradient>
        <filter id="daily-wheel-icon-shadow" x="-30%" y="-30%" width="160%" height="170%">
          <feDropShadow dx="0" dy="4" stdDeviation="3" floodColor="#000000" floodOpacity="0.45" />
        </filter>
      </defs>
      <g filter="url(#daily-wheel-icon-shadow)">
        <path d="M15 5h34l11 14-28 29L4 19 15 5Z" fill="url(#daily-wheel-diamond-side)" />
        <path d="M15 5h34l-7 14H22L15 5Z" fill="#fff1a8" />
        <path d="M4 19h18l10 29L4 19Z" fill="#f59e0b" />
        <path d="M60 19H42L32 48 60 19Z" fill="#f97316" />
        <path d="M22 19h20L32 48 22 19Z" fill="url(#daily-wheel-diamond-top)" />
        <path d="M15 5 22 19M49 5 42 19M22 19 32 5 42 19" stroke="rgba(255,255,255,0.72)" strokeWidth="2" />
      </g>
    </svg>
  );
}

function PremiumShieldIcon() {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true" style={{ width: 'clamp(2.2rem, 10vw, 4.1rem)', height: 'auto' }}>
      <defs>
        <linearGradient id="daily-wheel-shield" x1="16" y1="9" x2="50" y2="58" gradientUnits="userSpaceOnUse">
          <stop stopColor="#bfe8ff" />
          <stop offset="0.45" stopColor="#1e9bff" />
          <stop offset="1" stopColor="#0b2d6f" />
        </linearGradient>
      </defs>
      <path d="M32 5 52 13v16c0 14-8.5 24.5-20 30C20.5 53.5 12 43 12 29V13l20-8Z" fill="url(#daily-wheel-shield)" stroke="#c7f0ff" strokeWidth="3" />
      <path d="M32 12v38c8.1-4.5 13-11.8 13-21V18l-13-6Z" fill="rgba(255,255,255,0.18)" />
      <path d="M22 30.5 29 37l14-17" fill="none" stroke="#e0fbff" strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" />
    </svg>
  );
}

function PremiumFreezeIcon() {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true" style={{ width: 'clamp(2.1rem, 9.5vw, 3.9rem)', height: 'auto' }}>
      <g fill="none" stroke="#ffe66d" strokeLinecap="round" strokeLinejoin="round" strokeWidth="5" filter="drop-shadow(0 3px 3px rgba(0,0,0,0.42))">
        <path d="M32 7v50M12 19l40 26M52 19 12 45" />
        <path d="m24 13 8 8 8-8M24 51l8-8 8 8M11 30l11-4 2-11M53 30l-11-4-2-11M11 34l11 4 2 11M53 34l-11 4-2 11" />
      </g>
      <circle cx="32" cy="32" r="6" fill="#fff5a8" />
    </svg>
  );
}

function PremiumSwapIcon() {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true" style={{ width: 'clamp(2.2rem, 10vw, 4rem)', height: 'auto' }}>
      <defs>
        <linearGradient id="daily-wheel-swap" x1="8" y1="12" x2="55" y2="52" gradientUnits="userSpaceOnUse">
          <stop stopColor="#b8ff8a" />
          <stop offset="1" stopColor="#24c947" />
        </linearGradient>
      </defs>
      <g fill="none" stroke="url(#daily-wheel-swap)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="6" filter="drop-shadow(0 3px 3px rgba(0,0,0,0.45))">
        <path d="M16 24a17 17 0 0 1 29-7l4 4" />
        <path d="M50 12v13H37" />
        <path d="M48 40a17 17 0 0 1-29 7l-4-4" />
        <path d="M14 52V39h13" />
      </g>
    </svg>
  );
}

function PremiumGiftIcon() {
  return (
    <svg viewBox="0 0 76 70" aria-hidden="true" style={{ width: 'clamp(2.6rem, 12vw, 4.8rem)', height: 'auto' }}>
      <defs>
        <linearGradient id="daily-wheel-gift-front" x1="14" y1="18" x2="62" y2="64" gradientUnits="userSpaceOnUse">
          <stop stopColor="#ff5330" />
          <stop offset="1" stopColor="#b11611" />
        </linearGradient>
        <linearGradient id="daily-wheel-gift-ribbon" x1="18" y1="13" x2="58" y2="62" gradientUnits="userSpaceOnUse">
          <stop stopColor="#fff3a0" />
          <stop offset="0.45" stopColor="#ffc928" />
          <stop offset="1" stopColor="#c46b00" />
        </linearGradient>
      </defs>
      <g filter="drop-shadow(0 5px 5px rgba(0,0,0,0.48))">
        <path d="M10 28h56v33H10z" fill="url(#daily-wheel-gift-front)" />
        <path d="M10 28h56v10H10z" fill="#ff8a36" />
        <path d="M33 25h10v36H33z" fill="url(#daily-wheel-gift-ribbon)" />
        <path d="M7 22h62v12H7z" fill="#f24a20" />
        <path d="M32 22h12v12H32z" fill="url(#daily-wheel-gift-ribbon)" />
        <path d="M36 21c-7-13-20-10-17-1 3 8 13 5 17 1Zm4 0c7-13 20-10 17-1-3 8-13 5-17 1Z" fill="url(#daily-wheel-gift-ribbon)" stroke="#fff1a8" strokeWidth="1.5" />
        <path d="M10 38 33 61H10V38Zm56 0L43 61h23V38Z" fill="rgba(70,0,0,0.2)" />
      </g>
    </svg>
  );
}

function stopDailyWheelConfetti() {
  try { dailyWheelConfettiInstance?.reset?.(); } catch { /* non-blocking */ }
}

function fireDailyWheelConfetti(reducedMotion, shouldRun = () => true) {
  if (reducedMotion || typeof window === 'undefined') return;
  import('canvas-confetti')
    .then((module) => {
      const confetti = module?.default || module;
      if (typeof confetti !== 'function') return;
      dailyWheelConfettiInstance = confetti;
      if (!shouldRun()) return;
      confetti({
        particleCount: 72,
        spread: 58,
        startVelocity: 32,
        scalar: 0.82,
        ticks: 150,
        origin: { y: 0.36 },
        colors: ['#facc15', '#38bdf8', '#f8fafc', '#22c55e'],
      });
    })
    .catch(() => null);
}

function getDailyWheelWonRewardLine(result, jokerRewards = []) {
  const rewardType = String(result?.rewardType || result?.reward_type || '').trim();
  const rewardId = String(result?.rewardId || result?.reward_id || '').trim();
  const segment = getDailyWheelSegmentById(rewardId);

  if (rewardType === 'gift_box' || rewardId === 'gift_box') {
    return { icon: '🎁', label: 'Hediye Kutusu' };
  }

  if (result?.fallbackClaimedResult) {
    return { icon: '✨', label: 'Bugünkü ödül alındı' };
  }

  if (rewardType === 'joker' || segment?.type === 'joker' || jokerRewards.length > 0) {
    const jokerType = jokerRewards[0]?.jokerType || segment?.jokerType || '';
    const label = jokerRewards[0]?.label || formatDailyWheelJokerLabel(jokerType);
    const icons = {
      mistake_shield: '🛡',
      time_freeze: '⏳',
      card_swap: '🔄',
    };
    return { icon: icons[jokerType] || '🎁', label };
  }

  const rewardAmount = Math.max(0, Math.floor(Number(
    result?.rewardAmount ??
    result?.reward_amount ??
    (rewardId ? segment?.diamondAmount : undefined) ??
    result?.totalRewardAmount ??
    result?.total_reward_amount ??
    0,
  ) || 0));

  return { icon: '💎', label: `+${formatDiamondCount(rewardAmount)} Elmas` };
}

function DailyWheelWonRewardLine({ rewardLine }) {
  return (
    <motion.div
      initial={{ y: 10, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.34, ease: 'easeOut' }}
      className="daily-wheel-result-reward-line flex items-center justify-center gap-2 text-center font-inter text-lg font-black text-white"
      style={{
        textShadow: '0 2px 8px rgba(0,0,0,0.62), 0 0 16px rgba(250,204,21,0.18)',
      }}
    >
      <span aria-hidden="true" className="text-2xl leading-none">{rewardLine.icon}</span>
      <span>{rewardLine.label}</span>
    </motion.div>
  );
}

function DisabledAdSpinCta() {
  // Future rewarded-ad integration only: this visible repeat CTA stays
  // disabled and cannot start a spin, decrement counters, or grant a
  // noFakeAdRewardFlow reward path.
  return (
    <button
      type="button"
      disabled
      aria-disabled="true"
      aria-label="Reklam entegrasyonu yakında. Şu anda tekrar çevirme devre dışı."
      className="daily-wheel-disabled-ad-spin-cta flex min-h-16 w-full max-w-[19.5rem] items-center justify-center rounded-xl px-5 py-4 font-inter text-sm font-black tracking-[0.18em] text-slate-300"
      style={{
        background: 'linear-gradient(180deg, rgba(31,45,72,0.92), rgba(13,24,48,0.96))',
        border: '1px solid rgba(148,163,184,0.34)',
        boxShadow:
          'inset 0 1px 0 rgba(255,255,255,0.10), 0 12px 28px rgba(0,0,0,0.34)',
        cursor: 'not-allowed',
        opacity: 0.76,
      }}
    >
      <span
        aria-hidden="true"
        className="grid h-9 w-9 place-items-center rounded-lg"
        style={{
          background: 'linear-gradient(180deg, rgba(148,163,184,0.28), rgba(71,85,105,0.22))',
          boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.18)',
        }}
      >
        <RewardedVideoIcon />
      </span>
      <span aria-hidden="true" className="mx-5 h-8 w-px bg-slate-300/16" />
      <span className="flex flex-col items-start leading-none">
        <span>ÇEVİR</span>
        <span className="mt-1 text-[10px] font-extrabold normal-case tracking-[0.04em] text-slate-400">
          Yakında
        </span>
      </span>
    </button>
  );
}

function RewardedVideoIcon() {
  return (
    <svg
      viewBox="0 0 48 48"
      aria-hidden="true"
      className="h-6 w-6"
      focusable="false"
    >
      <defs>
        <linearGradient id="daily-wheel-rewarded-video" x1="10" y1="8" x2="38" y2="40" gradientUnits="userSpaceOnUse">
          <stop stopColor="#dbeafe" />
          <stop offset="0.5" stopColor="#93c5fd" />
          <stop offset="1" stopColor="#64748b" />
        </linearGradient>
      </defs>
      <rect x="7" y="12" width="34" height="24" rx="6" fill="url(#daily-wheel-rewarded-video)" opacity="0.95" />
      <path d="M21 18.5 31 24l-10 5.5v-11Z" fill="#0f172a" />
      <path d="M14 38h20" stroke="#94a3b8" strokeWidth="3" strokeLinecap="round" />
      <path d="M35 7.5l1.4 3.1 3.1 1.4-3.1 1.4-1.4 3.1-1.4-3.1-3.1-1.4 3.1-1.4 1.4-3.1Z" fill="#fde68a" />
    </svg>
  );
}

function DailyWheelReadyTitle() {
  return (
    <>
      <h2
        className="text-center uppercase text-white"
        style={{
          fontFamily: "'Barlow Condensed', 'Arial Narrow', sans-serif",
          fontSize: 'clamp(1.5rem, 6vw, 2.25rem)',
          fontWeight: 800,
          letterSpacing: '0.12em',
          textShadow: '0 2px 8px rgba(0,0,0,0.62)',
        }}
      >
        GÜNLÜK ÇARK HAZIR
      </h2>
      <p className="text-center font-inter text-sm font-medium text-slate-200/78">
        Bugünkü ödülünü almak için çevir
      </p>
    </>
  );
}

function DailyWheelReadyActions({ claiming, onSpin, onClose }) {
  return (
    <div
      className="mt-1 grid w-full grid-cols-2"
      style={{ gap: 'clamp(.8rem,2vw,1rem)' }}
    >
      <button
        type="button"
        onClick={onClose}
        disabled={claiming}
        className="min-h-12 rounded-xl px-4 py-3 font-inter text-sm font-black tracking-[0.35em] transition-transform active:scale-[0.98] disabled:opacity-50"
        style={{
          background: 'linear-gradient(180deg, rgba(13,31,67,0.92), rgba(6,15,36,0.96))',
          color: '#e8efff',
          border: '1px solid rgba(148,211,255,0.24)',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08)',
        }}
      >
        SONRA
      </button>
      <button
        type="button"
        onClick={onSpin}
        disabled={claiming}
        aria-busy={claiming ? 'true' : 'false'}
        className="min-h-12 rounded-xl px-4 py-3 font-inter text-sm font-black tracking-[0.35em] transition-transform active:scale-[0.98] disabled:opacity-70"
        style={{
          background: 'linear-gradient(180deg, #ffde48 0%, #ffc928 52%, #e5a409 100%)',
          color: '#14151d',
          border: '1px solid rgba(255,248,189,0.72)',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.58), 0 10px 22px rgba(0,0,0,0.34), 0 0 18px rgba(250,204,21,0.28)',
        }}
      >
        ÇEVİR
      </button>
    </div>
  );
}

function DailyWheelResultModal({ status, error, claiming, result, onSpin, onClose }) {
  const displayResult = result || (status === 'claimed'
    ? { fallbackClaimedResult: true, alreadyClaimedToday: true }
    : null);
  const jokerRewards = useMemo(() => normalizeDailyWheelJokerRewards(displayResult?.jokerRewards), [displayResult?.jokerRewards]);
  const resultRewardLine = useMemo(() => getDailyWheelWonRewardLine(displayResult, jokerRewards), [jokerRewards, displayResult]);
  const hasReward = Boolean(displayResult?.fallbackClaimedResult || displayResult?.rewardId || Number(displayResult?.totalRewardAmount) > 0 || jokerRewards.length || displayResult?.giftBox);
  const claimedToday = Boolean(displayResult?.alreadyClaimedToday || displayResult?.alreadyClaimed);
  const alreadyClaimed = Boolean(displayResult?.alreadyClaimed);
  const readOnlyResult = Boolean(alreadyClaimed || displayResult?.fallbackClaimedResult || (status === 'claimed' && !result));
  const [revealReady, setRevealReady] = useState(readOnlyResult);
  const effectSessionRef = useRef(0);
  const prefersReducedMotion = useReducedMotion();
  const targetRotation = useMemo(
    () => getWheelTargetRotation(displayResult?.rewardSegmentIndex, prefersReducedMotion),
    [displayResult?.rewardSegmentIndex, prefersReducedMotion],
  );
  const spinDurationMs = prefersReducedMotion ? WHEEL_REDUCED_MOTION_DURATION_MS : WHEEL_SPIN_DURATION_MS;

  // Spin phase model — one continuous timeline:
  //   • reward unknown (brief backend wait) → 'idle', wheel at rest.
  //   • reward arrives → 'landing' single fast-start decel; reveal fires when
  //     the wheel visually stops. There is no separate visible loop phase.
  const isLanding = hasReward && !readOnlyResult && !revealReady;
  const wheelPhase = isLanding ? 'landing' : 'idle';
  const spinLocked = claiming || (hasReward && !readOnlyResult && !revealReady);

  // Spin sound/effects are synchronized to the visible landing spin only. The
  // sound starts with the spin, ticks accelerate-then-decelerate in step with
  // the wheel (denser early, sparser near the end), and celebration cues fire
  // exactly when the wheel visually stops (reveal). Everything is cleaned up on
  // close/unmount so no sound continues after the wheel is stopped.
  useEffect(() => {
    setRevealReady(readOnlyResult);
    if (!hasReward || readOnlyResult) return undefined;
    const sessionId = effectSessionRef.current + 1;
    effectSessionRef.current = sessionId;
    let cancelled = false;
    const isActiveSession = () => !cancelled && effectSessionRef.current === sessionId;
    const timers = [];
    const startAt = Date.now();
    try { sounds.wheelSpinStart?.(); } catch { /* non-blocking */ }
    // Schedule ticks whose spacing widens as the wheel decelerates, so audio
    // stays in step with the visible rotation instead of a constant cadence.
    const scheduleTick = () => {
      if (!isActiveSession()) return;
      const elapsed = Date.now() - startAt;
      const remaining = spinDurationMs - elapsed;
      if (remaining <= 120) return;
      const progress = Math.min(1, elapsed / spinDurationMs);
      // 70ms while fast → ~360ms as it slows to a stop.
      const gap = 70 + (progress * progress * 290);
      try { sounds.wheelTick?.(); } catch { /* non-blocking */ }
      timers.push(window.setTimeout(scheduleTick, gap));
    };
    if (!prefersReducedMotion) scheduleTick();
    const revealId = window.setTimeout(() => {
      if (!isActiveSession()) return;
      setRevealReady(true);
      fireDailyWheelConfetti(prefersReducedMotion, isActiveSession);
      try { window.navigator?.vibrate?.(28); } catch { /* non-blocking */ }
      try { sounds.rewardReveal?.(); } catch { /* non-blocking */ }
    }, spinDurationMs);
    timers.push(revealId);
    return () => {
      cancelled = true;
      effectSessionRef.current += 1;
      timers.forEach((id) => window.clearTimeout(id));
      stopDailyWheelConfetti();
    };
  }, [hasReward, prefersReducedMotion, readOnlyResult, displayResult?.rewardId, spinDurationMs]);

  const handleModalClose = () => {
    effectSessionRef.current += 1;
    stopDailyWheelConfetti();
    onClose?.();
  };

  return (
    <DailyWheelModalFrame onClose={handleModalClose} disableClose={spinLocked}>
      {status === 'loading' ? (
        <>
          <RewardWheel phase="idle" reducedMotion={prefersReducedMotion} />
          <h2 className="text-center font-inter text-2xl font-black text-white">Günlük Çark</h2>
          <p role="status" className="flex items-center justify-center gap-2 text-center text-sm font-semibold text-slate-200">
            <Loader2 className="h-4 w-4 animate-spin text-amber-200" />
            Çark durumu hazırlanıyor...
          </p>
        </>
      ) : status === 'error' ? (
        <>
          <RewardWheel phase="idle" reducedMotion={prefersReducedMotion} />
          <h2 className="text-center font-inter text-2xl font-black text-white">Ödül alınamadı</h2>
          <p
            role="alert"
            className="rounded-xl bg-red-500/12 px-3 py-2 text-center text-xs font-bold text-red-100"
          >
            {error || 'Çark çevrilemedi. Lütfen tekrar dene.'}
          </p>
          <div className="mt-2 flex w-full gap-2">
            <ModalButton tone="secondary" onClick={handleModalClose}>Kapat</ModalButton>
            <ModalButton onClick={onSpin} disabled={claiming}>
              {claiming ? 'Çevriliyor...' : 'Tekrar dene'}
            </ModalButton>
          </div>
        </>
      ) : hasReward ? (
        <>
          <RewardWheel
            phase={wheelPhase}
            targetRotation={targetRotation}
            highlightAmount={revealReady ? displayResult?.rewardId : null}
            compact={revealReady}
            reducedMotion={prefersReducedMotion}
          />
          {!revealReady ? (
            <>
              <DailyWheelReadyTitle />
              <DailyWheelReadyActions claiming={spinLocked} onSpin={onSpin} onClose={onClose} />
            </>
          ) : (
            <div
              className="daily-wheel-simplified-result flex w-full flex-col items-center pb-2"
              style={{ gap: 'clamp(3rem, 10vw, 5.25rem)' }}
            >
              {!prefersReducedMotion && <RewardBurst />}
              <DailyWheelWonRewardLine rewardLine={resultRewardLine} />
              <DisabledAdSpinCta />
            </div>
          )}
        </>
      ) : claimedToday ? (
        <>
          <Gift className="h-10 w-10 text-amber-300" />
          <h2 className="text-center font-inter text-xl font-black text-white">Bugünkü ödülünü aldın.</h2>
          <p className="text-center text-sm font-semibold text-slate-200">
            Yeni çark yarın hazır olacak.
          </p>
          {displayResult?.nextAvailableAt && (
            <p className="kronox-number text-center text-xs text-amber-100/85">
              {formatCountdown(displayResult.nextAvailableAt)}
            </p>
          )}
          <DisabledAdSpinCta />
          <ModalButton onClick={handleModalClose}>Tamam</ModalButton>
        </>
      ) : (
        <>
          <RewardWheel phase="idle" reducedMotion={prefersReducedMotion} />
          <DailyWheelReadyTitle />
          {error && (
            <p role="alert" className="rounded-xl bg-red-500/12 px-3 py-2 text-center text-xs font-bold text-red-100">
              {error}
            </p>
          )}
          <DailyWheelReadyActions claiming={claiming} onSpin={onSpin} onClose={onClose} />
        </>
      )}
    </DailyWheelModalFrame>
  );
}

function DailyWheelModalFrame({ children, onClose, disableClose = false }) {
  return (
    <div
      className="fixed inset-0 z-[220] grid place-items-center px-3"
      style={{
        background: 'rgba(0,0,0,.55)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
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
        className="relative flex flex-col items-center gap-4 rounded-[24px]"
        style={{
          width: 'min(92vw, 32rem)',
          maxWidth: '32rem',
          height: 'auto',
          maxHeight: 'calc(100dvh - 1.5rem)',
          overflowY: 'auto',
          padding: 'clamp(1rem, 4vw, 1.25rem)',
          border: '1px solid rgba(250,204,21,0.46)',
          background:
            'radial-gradient(circle at 50% 8%, rgba(20,90,150,0.28), transparent 42%), linear-gradient(180deg, rgba(5,20,50,0.98), rgba(3,10,29,0.99) 72%, rgba(2,7,21,0.99))',
          boxShadow:
            '0 24px 80px rgba(0,0,0,0.64), 0 0 34px rgba(56,189,248,0.16), inset 0 0 0 1px rgba(255,255,255,0.06), inset 0 0 42px rgba(250,204,21,0.05)',
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
