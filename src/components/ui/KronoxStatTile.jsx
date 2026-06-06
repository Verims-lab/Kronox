import React from 'react';

/**
 * KronoxStatTile — Shared stat card used by Profile + Leaderboard.
 *
 *   Phase 3 — Codex123 UI consolidation.
 *
 *   Replaces the two near-duplicate `StatTile` inline components that
 *   used to live in ProfilePage.jsx and LeaderboardPage.jsx. They used
 *   the same three tints (gold / portal blue / cyan), the same icon /
 *   value / label layout, and the same shared numeric/Inter typography — but
 *   diverged on padding, shadow ring, and label opacity. Profile and
 *   Leaderboard now share this single source so both surfaces stay
 *   visually consistent.
 *
 *   Behavior preservation:
 *     - Puan tile: caller passes `value` derived from
 *       getKronoxVisibleScore(user).
 *     - Seviye tile: caller passes `value` derived from
 *       getCurrentPlayableLevel(...) (Profile) or
 *       summarizeSoloProgress(...).currentLevel (Leaderboard).
 *     - Elmas tile: caller passes `value` derived from
 *       getLeaderboardDiamondValue(user). Never derived from
 *       stars / score / completed levels.
 *
 *   This component is presentational only. It does NOT read user data
 *   or progress directly, so swapping it in cannot regress the
 *   Puan/Seviye/Elmas source-of-truth contracts.
 *
 * Props:
 *   icon     : lucide-react component (e.g. Trophy, Sparkles, Gem)
 *   label    : short uppercase label (e.g. "Puan")
 *   value    : number/string already formatted by the caller
 *   tint     : 'gold' | 'portal' | 'cyan' (semantic) — preferred
 *   tintHex  : raw hex (#facc15 etc.) — accepted for backward compat
 *              with LeaderboardPage's previous `tint="#facc15"` shape.
 *   variant  : 'profile' | 'compact' — controls padding/typography
 *              density. Defaults to 'profile' (matches the old Profile
 *              tile). LeaderboardPage uses 'compact'.
 *   subtitle : optional small subtitle line (not used by Profile/
 *              Leaderboard today, kept for future surfaces).
 */
const SEMANTIC_TINTS = {
  gold:   { glow: 'rgba(250,204,21,0.35)',  ring: 'rgba(250,204,21,0.55)',  fg: '#facc15' },
  portal: { glow: 'rgba(59,130,246,0.40)',  ring: 'rgba(96,165,250,0.55)',  fg: '#60a5fa' },
  cyan:   { glow: 'rgba(34,211,238,0.40)',  ring: 'rgba(125,211,252,0.55)', fg: '#7dd3fc' },
};

function resolveTint({ tint, tintHex }) {
  if (tint && SEMANTIC_TINTS[tint]) return SEMANTIC_TINTS[tint];
  if (typeof tintHex === 'string' && tintHex.startsWith('#')) {
    return { glow: `${tintHex}55`, ring: `${tintHex}88`, fg: tintHex };
  }
  if (typeof tint === 'string' && tint.startsWith('#')) {
    return { glow: `${tint}55`, ring: `${tint}88`, fg: tint };
  }
  return { glow: 'rgba(255,255,255,0.2)', ring: 'rgba(255,255,255,0.3)', fg: '#fff' };
}

export default function KronoxStatTile({
  icon: Icon,
  label,
  value,
  tint,
  tintHex,
  variant = 'profile',
  subtitle = null,
}) {
  const t = resolveTint({ tint, tintHex });
  const compact = variant === 'compact';

  // Profile variant = stronger panel (matches the original Profile look).
  // Compact variant = lighter panel inside the Leaderboard summary card.
  const background = compact
    ? 'linear-gradient(180deg, rgba(255,255,255,0.07), rgba(255,255,255,0.035))'
    : 'linear-gradient(180deg, rgba(30,41,75,0.9), rgba(10,16,36,0.95))';
  const boxShadow = compact
    ? `inset 0 0 0 1px ${t.ring}`
    : `inset 0 0 0 1.5px ${t.ring}, inset 0 1px 0 rgba(255,255,255,0.08), 0 0 18px ${t.glow}, 0 8px 16px rgba(2,6,23,0.5)`;

  return (
    <div
      data-kx-stat-tile={label || ''}
      className={`rounded-2xl ${compact ? 'p-3 text-center' : 'p-3 flex flex-col items-center justify-center gap-1'}`}
      style={{ background, boxShadow, minHeight: compact ? undefined : 86 }}
    >
      <Icon className={compact ? 'mx-auto h-4 w-4' : 'w-4 h-4'} style={{ color: t.fg }} />
      <p
        className={`${compact ? 'mt-1 ' : ''}kronox-number text-xl leading-none`}
        style={{ color: t.fg, textShadow: compact ? undefined : `0 0 10px ${t.glow}` }}
      >
        {value}
      </p>
      <p
        className={`${compact ? 'mt-1 text-[9px] text-blue-100/60' : 'text-[10px] text-blue-100/70'} font-inter font-black uppercase tracking-widest`}
      >
        {label}
      </p>
      {subtitle ? (
        <p className="font-inter text-[10px] text-blue-100/55 truncate max-w-full">{subtitle}</p>
      ) : null}
    </div>
  );
}
