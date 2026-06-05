import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Star, ChevronRight, RotateCcw, ListChecks, TimerReset, Zap, X as XIcon, Check,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { fetchSoloLevelRecordContext } from '@/lib/soloLevelRecord';
// Codex164 — shared popup helpers so success + failure stay in lockstep.
import SoloStatCard from './SoloStatCard';
import { formatCompactDuration } from '@/lib/soloTimeFormat';

/**
 * Solo SUCCESS completion popup — visual correction pass (matches the
 * target reference, Image 2):
 *
 *   • Title is light/elegant, not heavy bangers; flanked by horizontal
 *     gradient lines + small star ornaments on each side.
 *   • Stars are large and glowing; small sparkle dots scatter around them.
 *   • Stat cards are horizontal rectangles: large round icon on the left,
 *     label + value stacked on the right.
 *   • Time uses compact "MM:SS" format ("01:10"), no "dak/saniye".
 *   • Success Puan/Hata cards use compact short labels + unit copy.
 *   • All 4 stat icons share the same circle size and placement logic.
 *   • Buttons: primary yellow CTA + two secondary outline buttons, with
 *     icons consistently aligned to the left of the label.
 *
 * Product logic (stars, score, mistakes, speed bonus, record badge,
 * onNextLevel/onRetry/onBackToPath) is untouched.
 */
export default function SoloSuccessPopup({
  levelNumber,
  stars,
  mistakes,
  timeSeconds,
  levelScore,
  timeBonus,
  hasNextLevel,
  userEmail,
  onNextLevel,
  onRetry,
  onBackToPath,
}) {
  // Record context: only computed on mount, silent on error.
  const [recordKind, setRecordKind] = useState('none');
  useEffect(() => {
    let cancelled = false;
    fetchSoloLevelRecordContext({ levelNumber, timeSeconds, userEmail })
      .then((res) => { if (!cancelled) setRecordKind(res?.kind || 'none'); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [levelNumber, timeSeconds, userEmail]);

  const speedBonusEarned = Number(timeBonus) > 0;
  const compactTime = formatCompactDuration(timeSeconds);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-md p-4"
      style={{ background: 'rgba(3,8,22,0.92)' }}
    >
      <motion.div
        initial={{ scale: 0.85, opacity: 0, y: 30 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 280, damping: 24 }}
        className="w-full max-w-sm rounded-[28px] overflow-hidden"
        style={{
          background:
            'radial-gradient(ellipse at 50% 0%, rgba(59,130,246,0.18), transparent 65%), linear-gradient(180deg, #0a1c46 0%, #061332 100%)',
          boxShadow:
            'inset 0 0 0 1.5px rgba(96,165,250,0.32), 0 24px 60px rgba(2,6,23,0.65), 0 0 40px rgba(59,130,246,0.18)',
        }}
      >
        <div className="px-5 pt-5 pb-5">
          {/* ── Title row: ✦ ─── N. SEVİYE TAMAMLANDI! ─── ✦ ── */}
          <TitleRow levelNumber={levelNumber} />

          {/* ── Stars + sparkles ── */}
          <StarsRow stars={stars} />

          {/* ── Motivational subline ── */}
          <p
            className="mt-3 text-center font-inter"
            style={{
              color: '#e2e8f0',
              fontSize: 'clamp(13px, 3.8vw, 15px)',
              fontWeight: 500,
              letterSpacing: '0.01em',
            }}
          >
            Harika! Böyle devam et!
          </p>

          {/* Divider with diamond accent */}
          <div className="mt-2.5 mb-3 flex items-center justify-center gap-2" aria-hidden="true">
            <span style={{ display: 'block', height: 1, width: 40, background: 'linear-gradient(90deg, transparent, rgba(250,204,21,0.55), transparent)' }} />
            <span style={{ display: 'block', width: 6, height: 6, background: '#facc15', transform: 'rotate(45deg)', boxShadow: '0 0 6px rgba(250,204,21,0.6)' }} />
            <span style={{ display: 'block', height: 1, width: 40, background: 'linear-gradient(90deg, transparent, rgba(250,204,21,0.55), transparent)' }} />
          </div>

          {/* ── 2x2 stat grid (horizontal rectangle cards) ── */}
          <div className="grid grid-cols-2 gap-2.5">
            <SoloStatCard
              icon={TimerReset}
              iconColor="#60a5fa"
              iconRingColor="rgba(96,165,250,0.55)"
              label="SÜRE"
              value={compactTime}
              valueColor="#ffffff"
              footer={recordKind !== 'none' ? <RecordBadge kind={recordKind} /> : null}
            />
            <SoloStatCard
              icon={Star}
              iconColor="#facc15"
              iconRingColor="rgba(250,204,21,0.55)"
              iconFill="#facc15"
              label="PUAN"
              value={String(levelScore || 0)}
              valueColor="#facc15"
              footer={<UnitLabel color="#facc15">Puan</UnitLabel>}
              footerMarginTop={0}
            />
            <SoloStatCard
              icon={XIcon}
              iconColor="#f87171"
              iconRingColor="rgba(248,113,113,0.55)"
              label="HATA"
              value={String(mistakes || 0)}
              valueColor="#f87171"
              footer={<UnitLabel color="#fca5a5">Hata</UnitLabel>}
              footerMarginTop={0}
            />
            <SoloStatCard
              icon={Zap}
              iconColor={speedBonusEarned ? '#4ade80' : '#f87171'}
              iconRingColor={speedBonusEarned ? 'rgba(74,222,128,0.55)' : 'rgba(248,113,113,0.55)'}
              iconFill={speedBonusEarned ? '#4ade80' : undefined}
              label="HIZ BONUSU"
              valueNode={speedBonusEarned
                ? <Check style={{ width: 26, height: 26, color: '#4ade80' }} strokeWidth={3.5} />
                : <XIcon style={{ width: 26, height: 26, color: '#f87171' }} strokeWidth={3.5} />}
              valueColor={speedBonusEarned ? '#4ade80' : '#f87171'}
            />
          </div>

          {/* ── Buttons ── */}
          <div className="mt-4 flex flex-col gap-2.5">
            <Button
              onClick={onNextLevel}
              disabled={!hasNextLevel}
              className="w-full h-12 rounded-2xl font-bangers tracking-[0.12em] disabled:opacity-60 flex items-center justify-between px-5"
              style={{
                background: hasNextLevel
                  ? 'linear-gradient(180deg, #ffe066 0%, #facc15 55%, #d99e00 100%)'
                  : 'linear-gradient(180deg, rgba(250,204,21,0.3), rgba(185,122,6,0.2))',
                color: '#1a0a00',
                fontSize: 'clamp(15px, 4vw, 17px)',
                boxShadow: hasNextLevel
                  ? 'inset 0 1px 0 rgba(255,255,255,0.5), inset 0 -3px 0 rgba(120,75,0,0.35), 0 6px 18px rgba(250,204,21,0.35)'
                  : 'inset 0 0 0 1px rgba(250,204,21,0.35)',
              }}
            >
              <span className="w-5" aria-hidden="true" />
              <span className="flex-1 text-center">SONRAKİ SEVİYE</span>
              <ChevronRight className="w-5 h-5" strokeWidth={3} />
            </Button>

            <Button
              onClick={onRetry}
              className="w-full h-11 rounded-2xl font-bangers text-white flex items-center justify-center gap-2"
              style={{
                background: 'linear-gradient(180deg, rgba(20,30,60,0.85), rgba(10,18,40,0.95))',
                boxShadow: 'inset 0 0 0 1.5px rgba(96,165,250,0.32)',
                fontSize: 'clamp(14px, 3.8vw, 15px)',
                letterSpacing: '0.12em',
              }}
            >
              <RotateCcw className="w-4 h-4" strokeWidth={2.6} />
              TEKRAR OYNA
            </Button>

            <Button
              onClick={onBackToPath}
              className="w-full h-11 rounded-2xl font-bangers text-white flex items-center justify-center gap-2"
              style={{
                background: 'linear-gradient(180deg, rgba(20,30,60,0.85), rgba(10,18,40,0.95))',
                boxShadow: 'inset 0 0 0 1.5px rgba(96,165,250,0.32)',
                fontSize: 'clamp(14px, 3.8vw, 15px)',
                letterSpacing: '0.12em',
              }}
            >
              <ListChecks className="w-4 h-4" strokeWidth={2.6} />
              SEVİYELER
            </Button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ─────────────────────────── helpers ─────────────────────────── */

/**
 * Title row: small star ornament + gradient line on each side of the title.
 * Light/elegant, not heavy. Title text keeps the gold tint + soft glow but
 * uses lighter tracking and weight than the previous bangers-only version.
 */
function TitleRow({ levelNumber }) {
  return (
    <div className="flex items-center justify-center gap-2 px-1">
      <TitleOrnament side="left" />
      <h1
        className="font-bangers text-center whitespace-nowrap"
        style={{
          color: '#facc15',
          fontSize: 'clamp(18px, 5.4vw, 22px)',
          letterSpacing: '0.04em',
          fontWeight: 400,
          textShadow: '0 0 14px rgba(250,204,21,0.45), 0 1px 4px rgba(0,0,0,0.55)',
        }}
      >
        {levelNumber}. SEVİYE TAMAMLANDI!
      </h1>
      <TitleOrnament side="right" />
    </div>
  );
}

function TitleOrnament({ side }) {
  // Small 4-point star + a thin gradient line, mirrored on each side.
  const line = (
    <span
      style={{
        display: 'block',
        height: 1,
        width: 18,
        background: side === 'left'
          ? 'linear-gradient(90deg, transparent, rgba(250,204,21,0.7))'
          : 'linear-gradient(90deg, rgba(250,204,21,0.7), transparent)',
      }}
    />
  );
  const star = (
    <span
      aria-hidden="true"
      style={{
        display: 'inline-block',
        width: 10,
        height: 10,
        background:
          'radial-gradient(circle at 50% 50%, #fff6c2 0%, #facc15 35%, rgba(250,204,21,0) 70%)',
        filter: 'drop-shadow(0 0 6px rgba(250,204,21,0.85))',
        borderRadius: '2px',
        transform: 'rotate(45deg)',
      }}
    />
  );
  return (
    <span className="flex items-center gap-1.5" aria-hidden="true">
      {side === 'left' ? <>{star}{line}</> : <>{line}{star}</>}
    </span>
  );
}

/**
 * Stars row: three large stars with glow, surrounded by small sparkle dots
 * to match the target reference's celebratory composition. Sparkles are
 * purely decorative and pointer-events: none.
 */
function StarsRow({ stars }) {
  // Predefined sparkle positions around the stars area. Values are %
  // relative to the row's bounding box.
  const sparkles = [
    { top: '8%',  left: '6%',  size: 6, delay: 0.25 },
    { top: '14%', left: '94%', size: 5, delay: 0.45 },
    { top: '70%', left: '4%',  size: 5, delay: 0.55 },
    { top: '78%', left: '96%', size: 6, delay: 0.35 },
    { top: '0%',  left: '38%', size: 4, delay: 0.6 },
    { top: '2%',  left: '64%', size: 4, delay: 0.5 },
    { top: '88%', left: '32%', size: 4, delay: 0.65 },
    { top: '92%', left: '70%', size: 4, delay: 0.7 },
  ];

  return (
    <div
      className="relative mt-4 flex items-center justify-center gap-3"
      style={{ minHeight: 'clamp(72px, 22vw, 92px)' }}
      aria-label={`${stars} yıldız`}
    >
      {/* Decorative sparkles */}
      {sparkles.map((sp, i) => (
        <motion.span
          key={i}
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: [0, 1, 0.5, 1], scale: [0, 1.1, 0.9, 1] }}
          transition={{ delay: sp.delay, duration: 1.2, repeat: Infinity, repeatDelay: 1.8 }}
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: sp.top,
            left: sp.left,
            width: sp.size,
            height: sp.size,
            transform: 'translate(-50%, -50%) rotate(45deg)',
            background:
              'radial-gradient(circle at 50% 50%, #fff6c2 0%, #facc15 45%, rgba(250,204,21,0) 75%)',
            filter: 'drop-shadow(0 0 4px rgba(250,204,21,0.9))',
            borderRadius: '2px',
            pointerEvents: 'none',
          }}
        />
      ))}

      {/* Main stars */}
      {[1, 2, 3].map((i) => {
        const filled = i <= stars;
        return (
          <motion.div
            key={i}
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ delay: 0.15 + i * 0.12, type: 'spring', stiffness: 320, damping: 18 }}
            style={{ position: 'relative', zIndex: 1 }}
          >
            <Star
              style={{
                width: 'clamp(54px, 18vw, 72px)',
                height: 'clamp(54px, 18vw, 72px)',
                color: filled ? '#facc15' : 'rgba(40,55,95,0.65)',
                fill: filled ? '#facc15' : 'rgba(20,30,60,0.55)',
                filter: filled
                  ? 'drop-shadow(0 0 14px rgba(250,204,21,0.85)) drop-shadow(0 0 28px rgba(250,204,21,0.45))'
                  : 'none',
              }}
              strokeWidth={2.2}
            />
          </motion.div>
        );
      })}
    </div>
  );
}

function UnitLabel({ children, color }) {
  return (
    <span
      className="font-inter"
      style={{
        color,
        fontSize: '11.5px',
        fontWeight: 600,
        letterSpacing: '0.02em',
        lineHeight: 1.1,
      }}
    >
      {children}
    </span>
  );
}

function RecordBadge({ kind }) {
  const label = kind === 'global_first' ? 'YENİ REKOR!' : 'ARKADAŞ REKORU!';
  return (
    <span
      className="inline-flex items-center font-inter font-black"
      style={{
        background: 'linear-gradient(180deg, #16a34a, #15803d)',
        color: '#ffffff',
        fontSize: '10px',
        letterSpacing: '0.06em',
        padding: '2.5px 7px',
        borderRadius: 5,
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.35), 0 0 8px rgba(34,197,94,0.45)',
      }}
    >
      {label}
    </span>
  );
}
