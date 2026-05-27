import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

/**
 * OnlineScoreboard — Codex094
 *
 * Compact top scoreboard for online multiplayer. Read-only/presentational:
 * receives `players`, `currentPlayerIndex`, `myEmail`, `winCardCount`
 * and renders a horizontal row of player chips.
 *
 * Score source: player.cards.length — this is the canonical Kronox score
 * (each correct placement appends a card; win triggers at win_card_count).
 * No parallel state. No server writes. No mutations.
 *
 * Active chip = `players[currentPlayerIndex].email`. Falls back safely if
 * currentPlayerIndex is out of bounds or players is empty.
 *
 * Mobile: 2 players → comfortable; 3 → tight; 4 → compact with text
 * truncation. Uses `flex` (not horizontal scroll) so it never overflows
 * the viewport. Each chip is `min-w-0` + `truncate` for safe shrinking.
 */

const COLOR_TOKENS = [
  { dot: 'bg-blue-400',   text: 'text-blue-200',   ring: 'rgba(96,165,250,0.85)',  glow: 'rgba(59,130,246,0.42)' },
  { dot: 'bg-rose-400',   text: 'text-rose-200',   ring: 'rgba(251,113,133,0.85)', glow: 'rgba(244,63,94,0.42)'  },
  { dot: 'bg-emerald-400',text: 'text-emerald-200',ring: 'rgba(52,211,153,0.85)',  glow: 'rgba(16,185,129,0.42)' },
  { dot: 'bg-violet-400', text: 'text-violet-200', ring: 'rgba(167,139,250,0.85)', glow: 'rgba(139,92,246,0.42)' },
];

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

const displayNameOf = (player) => {
  if (!player) return 'Oyuncu';
  if (player.name && player.name.trim()) return player.name.trim();
  const email = player.email || '';
  const at = email.indexOf('@');
  return at > 0 ? email.slice(0, at) : (email || 'Oyuncu');
};

const scoreOf = (player) => (Array.isArray(player?.cards) ? player.cards.length : 0);

export default function OnlineScoreboard({
  players = [],
  currentPlayerIndex = 0,
  myEmail = null,
  winCardCount = 10,
}) {
  const reducedMotion = usePrefersReducedMotion();

  if (!Array.isArray(players) || players.length === 0) return null;
  const safeIndex =
    Number.isInteger(currentPlayerIndex) && currentPlayerIndex >= 0 && currentPlayerIndex < players.length
      ? currentPlayerIndex
      : 0;

  return (
    <div
      className="w-full flex items-stretch justify-center gap-1.5 px-2"
      data-kx-scoreboard="online"
      aria-label="Oyuncu skor tablosu"
    >
      {players.map((player, idx) => {
        const isActive = idx === safeIndex;
        const isMe = !!(myEmail && player?.email && player.email === myEmail);
        const tokens = COLOR_TOKENS[idx % COLOR_TOKENS.length];
        const name = displayNameOf(player);
        const score = scoreOf(player);

        return (
          <motion.div
            key={player?.email || `idx-${idx}`}
            className="relative flex-1 min-w-0 max-w-[140px] rounded-2xl px-2 py-1.5"
            animate={
              isActive && !reducedMotion
                ? {
                    boxShadow: [
                      `0 0 0 1px ${tokens.ring}, 0 0 12px ${tokens.glow}`,
                      `0 0 0 1px ${tokens.ring}, 0 0 20px ${tokens.glow}`,
                      `0 0 0 1px ${tokens.ring}, 0 0 12px ${tokens.glow}`,
                    ],
                  }
                : {
                    boxShadow: isActive
                      ? `0 0 0 1px ${tokens.ring}, 0 0 12px ${tokens.glow}`
                      : '0 0 0 1px rgba(255,255,255,0.08)',
                  }
            }
            transition={
              isActive && !reducedMotion
                ? { duration: 1.8, repeat: Infinity, ease: 'easeInOut' }
                : { duration: 0.2 }
            }
            style={{
              background: isActive
                ? 'linear-gradient(180deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0.04) 100%)'
                : 'rgba(255,255,255,0.035)',
              willChange: 'box-shadow',
            }}
          >
            {/* Top row: dot + name + "Sen" pill */}
            <div className="flex items-center gap-1 min-w-0">
              <span
                className={`flex-shrink-0 w-1.5 h-1.5 rounded-full ${tokens.dot}`}
                style={{
                  boxShadow: isActive ? `0 0 6px ${tokens.glow}` : 'none',
                }}
              />
              <span
                className={`flex-1 min-w-0 truncate font-inter text-[11px] font-bold tracking-wide ${
                  isActive ? tokens.text : 'text-white/70'
                }`}
                title={name}
              >
                {name}
              </span>
              {isMe && (
                <span
                  className="flex-shrink-0 rounded-full px-1 py-px font-inter text-[8px] font-black tracking-widest"
                  style={{
                    background: 'rgba(250,204,21,0.18)',
                    color: '#fde68a',
                    border: '1px solid rgba(250,204,21,0.45)',
                    lineHeight: 1,
                  }}
                >
                  SEN
                </span>
              )}
            </div>

            {/* Bottom row: score */}
            <div className="mt-0.5 flex items-baseline gap-1 min-w-0">
              <span
                className={`font-bangers tracking-wider ${isActive ? 'text-yellow-300' : 'text-white/85'}`}
                style={{ fontSize: 15, lineHeight: 1 }}
              >
                {score}
              </span>
              <span
                className="font-inter text-[9px] font-semibold uppercase tracking-widest text-white/45 truncate"
              >
                / {winCardCount} kart
              </span>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}