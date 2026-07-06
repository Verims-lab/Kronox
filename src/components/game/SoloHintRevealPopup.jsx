import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Hammer, X } from 'lucide-react';
import { normalizeHintQuantity, normalizeHintRevealStage, SOLO_HINT_REVEAL_STAGE_COUNT } from '@/lib/hintInventory';
import { sounds } from '@/lib/gameSounds';

function coverWidthForStage(stage) {
  if (stage >= 3) return '0%';
  if (stage === 2) return '34%';
  if (stage === 1) return '66%';
  return '100%';
}

function answerClipPathForStage(stage) {
  if (stage >= 3) return 'inset(0 0 0 0)';
  if (stage === 2) return 'inset(0 0 0 34%)';
  if (stage === 1) return 'inset(0 0 0 66%)';
  return 'inset(0 0 0 100%)';
}

function revealLabel(stage) {
  if (stage >= 3) return 'Tamamı açıldı';
  if (stage === 2) return '2/3 açıldı';
  if (stage === 1) return '1/3 açıldı';
  return 'Kapalı';
}

function FragmentParticles({ pulseKey, reducedMotion }) {
  const particles = useMemo(() => Array.from({ length: 12 }, (_, index) => ({
    id: `${pulseKey}-${index}`,
    x: 24 + ((index % 4) * 17),
    y: 32 + (Math.floor(index / 4) * 24),
    rotate: (index % 2 === 0 ? 1 : -1) * (18 + index * 3),
  })), [pulseKey]);

  if (!pulseKey || reducedMotion) return null;

  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden rounded-[22px]">
      {particles.map((particle) => (
        <motion.span
          key={particle.id}
          className="absolute h-2 w-2 rounded-sm"
          style={{
            left: `${particle.x}%`,
            top: `${particle.y}%`,
            background: 'linear-gradient(135deg, #d6ad68, #77512c)',
            boxShadow: '0 2px 5px rgba(0,0,0,0.34)',
          }}
          initial={{ opacity: 0.9, scale: 0.8, x: 0, y: 0, rotate: 0 }}
          animate={{ opacity: 0, scale: [0.8, 1.05, 0.72], x: particle.rotate * 0.8, y: 34 + (particle.id.length % 12), rotate: particle.rotate }}
          transition={{ duration: 0.7, ease: 'easeOut' }}
        />
      ))}
    </div>
  );
}

export default function SoloHintRevealPopup({
  open = false,
  year,
  stage = 0,
  remaining = 0,
  pending = false,
  error = '',
  onUseHint,
  onClose,
}) {
  const reducedMotion = useReducedMotion();
  const normalizedStage = normalizeHintRevealStage(stage);
  const hintCount = normalizeHintQuantity(remaining);
  const [strikeKey, setStrikeKey] = useState(0);
  const previousStageRef = useRef(normalizedStage);

  useEffect(() => {
    if (!open) return;
    if (normalizedStage > previousStageRef.current) {
      setStrikeKey((value) => value + 1);
      try { sounds.tap(); } catch { /* audio is optional */ }
      try {
        if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
          navigator.vibrate(22);
        }
      } catch {
        // Vibration is a progressive enhancement and may be blocked by WebView.
      }
    }
    previousStageRef.current = normalizedStage;
  }, [normalizedStage, open]);

  useEffect(() => {
    if (!open) previousStageRef.current = normalizedStage;
  }, [normalizedStage, open]);

  const canAdvance = open && !pending && hintCount > 0 && normalizedStage < SOLO_HINT_REVEAL_STAGE_COUNT;
  const coverWidth = coverWidthForStage(normalizedStage);
  const answerClipPath = answerClipPathForStage(normalizedStage);
  const hammerAnimate = strikeKey && !reducedMotion
    ? { rotate: [0, -24, 18, -5, 0], y: [0, -8, 5, 0, 0], scale: [1, 1.05, 0.98, 1, 1] }
    : { rotate: 0, y: 0, scale: 1 };
  const cardAnimate = strikeKey && !reducedMotion
    ? { x: [0, -3, 4, -2, 0], y: [0, 2, -2, 1, 0] }
    : { x: 0, y: 0 };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[90] flex items-center justify-center px-4 py-8"
          data-kronox-solo-hint-popup="true"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          style={{
            background: 'radial-gradient(circle at 50% 36%, rgba(20,86,155,0.30), rgba(3,8,22,0.84) 58%, rgba(3,8,22,0.92) 100%)',
            backdropFilter: 'blur(7px)',
          }}
          role="dialog"
          aria-modal="true"
          aria-label="İpucu"
        >
          <motion.div
            className="relative w-full max-w-[390px] rounded-[28px] px-5 py-7"
            initial={{ opacity: 0, scale: 0.94, y: 18 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ type: 'spring', stiffness: 240, damping: 24 }}
            style={{
              background: 'linear-gradient(180deg, rgba(9,31,66,0.98), rgba(5,14,34,0.98))',
              border: '1.5px solid rgba(255,201,40,0.86)',
              boxShadow: '0 22px 60px rgba(0,0,0,0.52), inset 0 1px 0 rgba(255,255,255,0.08), 0 0 22px rgba(56,189,248,0.20)',
            }}
          >
            <button
              type="button"
              aria-label="İpucunu kapat"
              onClick={() => {
                try { sounds.tap(); } catch { /* optional */ }
                if (onClose) onClose();
              }}
              className="absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-full transition-transform active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-300/70"
              style={{
                background: 'rgba(15, 31, 61, 0.9)',
                border: '1px solid rgba(167,196,229,0.42)',
                color: '#F8FAFC',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06), 0 0 14px rgba(85,216,255,0.10)',
              }}
            >
              <X className="h-5 w-5" strokeWidth={2.5} />
            </button>

            <div className="mt-6 flex items-center justify-center gap-4">
              <motion.div
                className="relative h-[238px] w-[180px] overflow-hidden rounded-[22px]"
                data-kronox-solo-hint-reveal-stage={normalizedStage}
                data-kronox-solo-hint-answer-clipped={normalizedStage === 0 ? 'true' : undefined}
                data-kronox-solo-hint-reveal-label={revealLabel(normalizedStage)}
                animate={cardAnimate}
                transition={strikeKey && !reducedMotion ? { duration: 0.42, ease: 'easeOut' } : { duration: 0.15 }}
                style={{
                  background: 'linear-gradient(135deg, #f2ddb1 0%, #d7bb82 52%, #a77d42 100%)',
                  border: '2px solid rgba(255,201,40,0.92)',
                  boxShadow: '0 0 18px rgba(250,204,21,0.42), inset 0 0 18px rgba(86,52,15,0.22)',
                }}
              >
                <div
                  aria-hidden="true"
                  className="absolute inset-0"
                  style={{
                    backgroundImage: 'linear-gradient(0deg, rgba(82,48,15,0.05) 1px, transparent 1px)',
                    backgroundSize: '100% 13px',
                    opacity: 0.78,
                  }}
                />
                <div className="absolute inset-4 flex items-center justify-center">
                  <span
                    className="kronox-number inline-block font-inter text-[58px] font-black leading-none"
                    style={{
                      color: '#172033',
                      clipPath: answerClipPath,
                      textShadow: '0 2px 0 rgba(255,255,255,0.18)',
                    }}
                  >
                    {Number.isFinite(Number(year)) ? Math.floor(Number(year)) : '????'}
                  </span>
                </div>
                <motion.div
                  aria-hidden="true"
                  className="absolute inset-y-0 left-0 overflow-hidden"
                  initial={false}
                  animate={{ width: coverWidth }}
                  transition={{ duration: reducedMotion ? 0.12 : 0.48, ease: 'easeOut' }}
                  style={{
                    width: coverWidth,
                    background:
                      'radial-gradient(circle at 20% 18%, rgba(255,234,178,0.34), transparent 34%), linear-gradient(135deg, #b78b4b 0%, #8c6337 46%, #5f4228 100%)',
                    borderRight: normalizedStage > 0 && normalizedStage < 3 ? '2px solid rgba(61,37,20,0.50)' : 'none',
                    boxShadow: 'inset -10px 0 18px rgba(0,0,0,0.22)',
                  }}
                >
                  <span className="absolute left-[18%] top-[18%] h-[1px] w-[46%] rotate-[24deg] bg-[#4f341d]/52" />
                  <span className="absolute left-[44%] top-[28%] h-[1px] w-[42%] rotate-[-38deg] bg-[#4f341d]/48" />
                  <span className="absolute left-[22%] top-[46%] h-[1px] w-[56%] rotate-[-12deg] bg-[#4f341d]/44" />
                  <span className="absolute left-[38%] top-[60%] h-[1px] w-[36%] rotate-[44deg] bg-[#4f341d]/48" />
                  <span className="absolute bottom-[18%] left-[18%] h-[1px] w-[58%] rotate-[17deg] bg-[#4f341d]/44" />
                </motion.div>
                <FragmentParticles pulseKey={strikeKey} reducedMotion={reducedMotion} />
              </motion.div>

              <button
                type="button"
                disabled={!canAdvance}
                aria-disabled={!canAdvance}
                aria-busy={pending}
                aria-label={`İpucu kullan, kalan ${hintCount}`}
                onClick={() => {
                  if (!canAdvance || !onUseHint) return;
                  onUseHint();
                }}
                className="flex min-h-[72px] w-[72px] flex-col items-center justify-center rounded-2xl px-1.5 transition-transform active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-300/70"
                style={{
                  background: canAdvance
                    ? 'radial-gradient(circle at 35% 20%, rgba(255,255,255,0.22), transparent 38%), linear-gradient(180deg, rgba(18,42,80,0.96), rgba(7,15,36,0.98))'
                    : 'linear-gradient(180deg, rgba(30,41,59,0.88), rgba(15,23,42,0.92))',
                  border: `1.5px solid ${canAdvance ? '#facc15' : 'rgba(148,163,184,0.28)'}`,
                  color: canAdvance ? '#facc15' : 'rgba(203,213,225,0.48)',
                  boxShadow: canAdvance
                    ? '0 0 14px rgba(250,204,21,0.34), inset 0 -5px 10px rgba(0,0,0,0.30)'
                    : 'inset 0 0 10px rgba(255,255,255,0.032), 0 3px 9px rgba(0,0,0,0.26)',
                  cursor: canAdvance ? 'pointer' : 'default',
                  touchAction: 'manipulation',
                  WebkitTapHighlightColor: 'transparent',
                }}
                data-kronox-solo-hint-popup-consume-button="true"
                data-kronox-solo-hint-popup-single-hammer="true"
              >
                <motion.span
                  aria-hidden="true"
                  animate={hammerAnimate}
                  transition={strikeKey && !reducedMotion ? { duration: 0.48, ease: 'easeOut' } : { duration: 0.15 }}
                  className="relative flex h-9 w-9 items-center justify-center rounded-full"
                  style={{
                    background: canAdvance
                      ? 'radial-gradient(circle at 36% 22%, rgba(255,255,255,0.20), transparent 36%), linear-gradient(180deg, #3b2a13, #071329)'
                      : 'linear-gradient(180deg, rgba(51,65,85,0.72), rgba(15,23,42,0.86))',
                    border: `1px solid ${canAdvance ? 'rgba(250,204,21,0.88)' : 'rgba(148,163,184,0.28)'}`,
                  }}
                >
                  <Hammer className="h-5 w-5" strokeWidth={2.6} />
                  <span
                    className="kronox-number absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px]"
                    style={{
                      color: canAdvance ? '#fff7d1' : 'rgba(226,232,240,0.58)',
                      background: canAdvance
                        ? 'linear-gradient(180deg, #171923, #050816)'
                        : 'linear-gradient(180deg, rgba(71,85,105,0.96), rgba(30,41,59,0.98))',
                      border: `1px solid ${canAdvance ? 'rgba(250,204,21,0.82)' : 'rgba(148,163,184,0.38)'}`,
                    }}
                  >
                    {hintCount}
                  </span>
                </motion.span>
                <span className="mt-1 text-center font-inter text-[10px] font-black leading-tight">
                  Kullan
                </span>
              </button>
            </div>

            <div className="mt-4 min-h-[36px] text-center font-inter">
              <p className="text-xs font-semibold text-yellow-100/82">{revealLabel(normalizedStage)}</p>
              {error ? (
                <p className="mt-1 text-[11px] font-semibold text-red-200">{error}</p>
              ) : (
                <p className="mt-1 text-[11px] text-slate-200/62">Her darbe bu kartın yılını biraz daha açar.</p>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
