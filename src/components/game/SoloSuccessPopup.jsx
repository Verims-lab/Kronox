import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Star, ChevronRight, RotateCcw, ListChecks, Clock, Zap, X as XIcon, Check,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatDuration } from './GameOverTimer';
import { fetchSoloLevelRecordContext } from '@/lib/soloLevelRecord';

/**
 * Solo SUCCESS completion popup.
 *
 * Renders a premium, mobile-first result panel matching the target
 * reference 1:1:
 *
 *   ┌────────────────────────────────────────┐
 *   │   ✦  N. SEVİYE TAMAMLANDI!  ✦          │
 *   │            ★  ★  ☆                     │
 *   │       Harika! Böyle devam et!          │
 *   │   ─── ◆ ───                            │
 *   │   ┌───────────┐  ┌───────────┐         │
 *   │   │ 🕒 SÜRE    │  │ ⭐ PUAN    │         │
 *   │   │  01:28     │  │  850       │         │
 *   │   │ YENİ REKOR!│  │  Puan      │         │
 *   │   └───────────┘  └───────────┘         │
 *   │   ┌───────────┐  ┌───────────┐         │
 *   │   │ ✖ HATA     │  │ ⚡ HIZ BNS │         │
 *   │   │  2  Hata   │  │  ✓ / ✖     │         │
 *   │   └───────────┘  └───────────┘         │
 *   │   ┌──────────────────────────┐         │
 *   │   │     SONRAKİ SEVİYE   ▶    │         │
 *   │   ├──────────────────────────┤         │
 *   │   │     TEKRAR OYNA           │         │
 *   │   ├──────────────────────────┤         │
 *   │   │     SEVİYELER             │         │
 *   │   └──────────────────────────┘         │
 *   └────────────────────────────────────────┘
 *
 * The record badge ("YENİ REKOR!" / "ARKADAŞLAR ARASINDA 1.") attaches to
 * the time card and is computed via fetchSoloLevelRecordContext().
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
  const formattedTime = formatDuration(timeSeconds);

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
        <div className="px-5 pt-6 pb-5">
          {/* ── Title ── */}
          <div className="flex items-center justify-center gap-3" aria-hidden="true">
            <Sparkle />
            <h1
              className="font-bangers text-center"
              style={{
                color: '#facc15',
                fontSize: 'clamp(20px, 6vw, 26px)',
                letterSpacing: '0.06em',
                textShadow: '0 0 14px rgba(250,204,21,0.55), 0 2px 6px rgba(0,0,0,0.55)',
              }}
            >
              {levelNumber}. SEVİYE TAMAMLANDI!
            </h1>
            <Sparkle flip />
          </div>

          {/* ── Stars row (large, glowing) ── */}
          <div
            className="mt-5 mb-2 flex items-center justify-center gap-3"
            aria-label={`${stars} yıldız`}
          >
            {[1, 2, 3].map((i) => {
              const filled = i <= stars;
              return (
                <motion.div
                  key={i}
                  initial={{ scale: 0, rotate: -180 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ delay: 0.15 + i * 0.12, type: 'spring', stiffness: 320, damping: 18 }}
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

          {/* ── Motivational subline ── */}
          <p
            className="mt-2 text-center font-inter"
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
          <div className="mt-3 mb-3 flex items-center justify-center gap-2" aria-hidden="true">
            <span style={{ display: 'block', height: 1, width: 36, background: 'linear-gradient(90deg, transparent, rgba(250,204,21,0.55), transparent)' }} />
            <span style={{ display: 'block', width: 6, height: 6, background: '#facc15', transform: 'rotate(45deg)', boxShadow: '0 0 6px rgba(250,204,21,0.6)' }} />
            <span style={{ display: 'block', height: 1, width: 36, background: 'linear-gradient(90deg, transparent, rgba(250,204,21,0.55), transparent)' }} />
          </div>

          {/* ── 2x2 stat grid ── */}
          <div className="grid grid-cols-2 gap-2.5">
            <StatCard
              icon={Clock}
              iconColor="#60a5fa"
              iconRingColor="rgba(96,165,250,0.55)"
              label="TOPLAM SÜRE"
              value={formattedTime}
              valueColor="#ffffff"
              footer={recordKind !== 'none' ? <RecordBadge kind={recordKind} /> : null}
            />
            <StatCard
              icon={Star}
              iconColor="#facc15"
              iconRingColor="rgba(250,204,21,0.55)"
              iconFill="#facc15"
              label="KAZANILAN PUAN"
              value={String(levelScore || 0)}
              valueColor="#facc15"
              footer={<UnitLabel color="#facc15">Puan</UnitLabel>}
            />
            <StatCard
              icon={XIcon}
              iconColor="#f87171"
              iconRingColor="rgba(248,113,113,0.55)"
              label="HATA SAYISI"
              value={String(mistakes || 0)}
              valueColor="#f87171"
              footer={<UnitLabel color="#fca5a5">Hata</UnitLabel>}
            />
            <StatCard
              icon={Zap}
              iconColor={speedBonusEarned ? '#4ade80' : '#f87171'}
              iconRingColor={speedBonusEarned ? 'rgba(74,222,128,0.55)' : 'rgba(248,113,113,0.55)'}
              iconFill={speedBonusEarned ? '#4ade80' : undefined}
              label="HIZ BONUSU"
              value={speedBonusEarned
                ? <Check className="mx-auto" style={{ width: 28, height: 28, color: '#4ade80' }} strokeWidth={3.5} />
                : <XIcon className="mx-auto" style={{ width: 28, height: 28, color: '#f87171' }} strokeWidth={3.5} />}
              valueColor={speedBonusEarned ? '#4ade80' : '#f87171'}
            />
          </div>

          {/* ── Buttons ── */}
          <div className="mt-4 flex flex-col gap-2">
            <Button
              onClick={onNextLevel}
              disabled={!hasNextLevel}
              className="w-full h-12 rounded-2xl font-bangers tracking-[0.12em] disabled:opacity-60"
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
              <span className="flex-1 text-center">SONRAKİ SEVİYE</span>
              <ChevronRight className="w-5 h-5" strokeWidth={3} />
            </Button>

            <Button
              onClick={onRetry}
              className="w-full h-11 rounded-2xl font-inter font-bold text-white"
              style={{
                background: 'linear-gradient(180deg, rgba(20,30,60,0.85), rgba(10,18,40,0.95))',
                boxShadow: 'inset 0 0 0 1.5px rgba(96,165,250,0.32)',
                fontSize: 'clamp(13px, 3.6vw, 14px)',
                letterSpacing: '0.08em',
              }}
            >
              <RotateCcw className="w-4 h-4 mr-2" strokeWidth={2.4} />
              TEKRAR OYNA
            </Button>

            <Button
              onClick={onBackToPath}
              className="w-full h-11 rounded-2xl font-inter font-bold text-white"
              style={{
                background: 'linear-gradient(180deg, rgba(20,30,60,0.85), rgba(10,18,40,0.95))',
                boxShadow: 'inset 0 0 0 1.5px rgba(96,165,250,0.32)',
                fontSize: 'clamp(13px, 3.6vw, 14px)',
                letterSpacing: '0.08em',
              }}
            >
              <ListChecks className="w-4 h-4 mr-2" strokeWidth={2.4} />
              SEVİYELER
            </Button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ─────────────────────────── helpers ─────────────────────────── */

function StatCard({
  icon: Icon,
  iconColor,
  iconRingColor,
  iconFill,
  label,
  value,
  valueColor,
  footer,
}) {
  return (
    <div
      className="rounded-2xl p-3 flex flex-col"
      style={{
        background: 'linear-gradient(180deg, rgba(20,30,60,0.85), rgba(8,16,40,0.95))',
        boxShadow: 'inset 0 0 0 1.5px rgba(96,165,250,0.22)',
        minHeight: 96,
      }}
    >
      <div className="flex items-center gap-2.5">
        <div
          className="flex items-center justify-center rounded-full shrink-0"
          style={{
            width: 38,
            height: 38,
            background: 'rgba(10,18,40,0.9)',
            boxShadow: `inset 0 0 0 2px ${iconRingColor}`,
          }}
        >
          <Icon
            className="w-5 h-5"
            strokeWidth={2.4}
            style={{ color: iconColor, fill: iconFill || 'transparent' }}
          />
        </div>
        <span
          className="font-inter"
          style={{
            color: 'rgba(199,210,234,0.78)',
            fontSize: '10.5px',
            fontWeight: 700,
            letterSpacing: '0.08em',
          }}
        >
          {label}
        </span>
      </div>
      <div
        className="mt-1.5 font-bangers leading-none"
        style={{
          color: valueColor,
          fontSize: 'clamp(22px, 6.5vw, 28px)',
          letterSpacing: '0.04em',
          textShadow: valueColor === '#ffffff' ? '0 1px 3px rgba(0,0,0,0.4)' : 'none',
        }}
      >
        {value}
      </div>
      {footer && <div className="mt-1.5">{footer}</div>}
    </div>
  );
}

function UnitLabel({ children, color }) {
  return (
    <span
      className="font-inter"
      style={{
        color,
        fontSize: '12px',
        fontWeight: 600,
        letterSpacing: '0.02em',
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
        fontSize: '10.5px',
        letterSpacing: '0.08em',
        padding: '3px 8px',
        borderRadius: 6,
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.35), 0 0 8px rgba(34,197,94,0.45)',
      }}
    >
      {label}
    </span>
  );
}

function Sparkle({ flip = false }) {
  return (
    <span
      aria-hidden="true"
      style={{
        display: 'inline-block',
        width: 16,
        height: 16,
        background:
          'radial-gradient(circle at 50% 50%, #facc15 0%, transparent 65%)',
        transform: flip ? 'rotate(-12deg)' : 'rotate(12deg)',
        filter: 'drop-shadow(0 0 6px rgba(250,204,21,0.6))',
      }}
    />
  );
}