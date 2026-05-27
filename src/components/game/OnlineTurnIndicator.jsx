import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * OnlineTurnIndicator — Codex092
 *
 * Online-only turn visibility component. Purely derived from props:
 *   - isMyTurn (boolean): authoritative `currentPlayer.email === me.email`
 *     check from Game.jsx. NEVER computed locally; never mutates server state.
 *   - currentPlayerName (string): name of whoever holds the turn now.
 *   - currentPlayerIndex (number): drives the player-color ring and the
 *     one-time "turn changed to me" flash via `useEffect` ref comparison.
 *
 * Behaviour:
 *   - When it's the local user's turn → green/gold "Sıra sende!" badge +
 *     one-time spring scale flash + soft pulsing glow ring.
 *   - When it's someone else's turn → muted "Sıra {name} oyuncusunda"
 *     waiting badge, no aggressive animation.
 *   - Reduced motion: respects `prefers-reduced-motion` — flash and pulse
 *     are disabled, badge still updates instantly.
 *   - aria-live="polite" announces the turn change to screen readers.
 *   - Does not block touch/drag — pointer-events:none on the glow ring.
 *
 * Server authority: untouched. This component reads only.
 */

const COLOR_DOTS = ['bg-blue-400', 'bg-rose-400', 'bg-emerald-400', 'bg-violet-400'];

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handler = () => setReduced(!!mq.matches);
    handler();
    mq.addEventListener?.('change', handler);
    return () => mq.removeEventListener?.('change', handler);
  }, []);
  return reduced;
}

export default function OnlineTurnIndicator({
  isMyTurn,
  currentPlayerName,
  currentPlayerIndex = 0,
  hasWinner = false,
}) {
  const reducedMotion = usePrefersReducedMotion();
  const prevIsMyTurnRef = useRef(isMyTurn);
  const [flashKey, setFlashKey] = useState(0);

  // One-time flash only when turn flips FROM not-mine → mine.
  useEffect(() => {
    if (!prevIsMyTurnRef.current && isMyTurn && !hasWinner) {
      setFlashKey((k) => k + 1);
    }
    prevIsMyTurnRef.current = isMyTurn;
  }, [isMyTurn, hasWinner]);

  if (hasWinner) return null;

  const dotClass = COLOR_DOTS[currentPlayerIndex % COLOR_DOTS.length];

  // ─── Active (my turn) ───────────────────────────────────────────────
  if (isMyTurn) {
    return (
      <div
        className="flex flex-col items-center gap-1"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        <motion.div
          key={reducedMotion ? 'static' : flashKey}
          initial={reducedMotion ? false : { scale: 0.82, opacity: 0 }}
          animate={
            reducedMotion
              ? { scale: 1, opacity: 1 }
              : {
                  scale: [0.82, 1.06, 1],
                  opacity: [0, 1, 1],
                  boxShadow: [
                    '0 0 0 rgba(250,204,21,0)',
                    '0 0 18px rgba(250,204,21,0.55), 0 0 32px rgba(34,197,94,0.35)',
                    '0 0 12px rgba(250,204,21,0.45), 0 0 22px rgba(34,197,94,0.22)',
                  ],
                }
          }
          transition={
            reducedMotion
              ? { duration: 0 }
              : { duration: 0.55, ease: [0.22, 1.2, 0.36, 1] }
          }
          className="relative inline-flex items-center gap-2 rounded-full px-3 py-1.5"
          style={{
            background:
              'linear-gradient(180deg, rgba(34,197,94,0.22) 0%, rgba(250,204,21,0.18) 100%)',
            border: '1px solid rgba(250,204,21,0.55)',
            backdropFilter: 'blur(4px)',
          }}
        >
          {/* Pulse ring — non-interactive */}
          {!reducedMotion && (
            <motion.span
              aria-hidden="true"
              className="absolute inset-0 rounded-full pointer-events-none"
              style={{ border: '1px solid rgba(250,204,21,0.6)' }}
              animate={{ opacity: [0.5, 0.15, 0.5], scale: [1, 1.08, 1] }}
              transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
            />
          )}
          <span className={`relative w-2 h-2 rounded-full ${dotClass}`}>
            {!reducedMotion && (
              <motion.span
                aria-hidden="true"
                className={`absolute inset-0 rounded-full ${dotClass}`}
                animate={{ opacity: [0.6, 0, 0.6], scale: [1, 2.2, 1] }}
                transition={{ duration: 1.6, repeat: Infinity, ease: 'easeOut' }}
              />
            )}
          </span>
          <span
            className="relative font-bangers tracking-widest"
            style={{ fontSize: 15, color: '#fde68a', textShadow: '0 1px 0 rgba(0,0,0,0.4)' }}
          >
            SIRA SENDE!
          </span>
        </motion.div>
        <p
          className="font-inter text-[11px] font-semibold tracking-wide"
          style={{ color: 'rgba(255,255,255,0.78)' }}
        >
          Kartı zaman çizelgesine yerleştir.
        </p>
      </div>
    );
  }

  // ─── Passive (waiting for opponent) ────────────────────────────────
  const name = currentPlayerName || 'rakip';
  return (
    <div
      className="flex flex-col items-center gap-0.5"
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <div
        className="inline-flex items-center gap-2 rounded-full px-2.5 py-1"
        style={{
          background: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.10)',
        }}
      >
        <AnimatePresence mode="wait">
          <motion.span
            key={`dot-${currentPlayerIndex}`}
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.6 }}
            transition={{ duration: 0.18 }}
            className={`w-1.5 h-1.5 rounded-full ${dotClass}`}
          />
        </AnimatePresence>
        <span
          className="font-inter text-[11px] font-semibold tracking-wide"
          style={{ color: 'rgba(255,255,255,0.72)' }}
        >
          Sıra <span style={{ color: '#fde68a' }}>{name}</span> oyuncusunda
        </span>
      </div>
      <p
        className="font-inter text-[10px] tracking-wide"
        style={{ color: 'rgba(255,255,255,0.45)' }}
      >
        Rakibin hamlesini bekliyorsun…
      </p>
    </div>
  );
}