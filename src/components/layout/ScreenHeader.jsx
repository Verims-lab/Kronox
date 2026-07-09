import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, Gem, Trophy } from 'lucide-react';
import { motion } from 'framer-motion';
import { sounds } from '@/lib/gameSounds';
import { getSafeBackRoute, getTabRootNavigationState } from '@/lib/NavigationStackContext';
// Codex134 — Shared real-time header notification bell.
// Renders to the right of the chip area and to the left of the avatar.
// Self-contained (data + subscriptions live in useHeaderNotifications),
// so adding it here is a pure presentational addition.
import HeaderNotificationBell from '@/components/notifications/HeaderNotificationBell';
import KronoxAvatar from '@/components/profile/KronoxAvatar';

/**
 * Codex118 — Standardized top bar for primary navigation screens.
 *
 * Two center layouts, exclusive:
 *
 *   A) Title mode (default):
 *      [Back?]   [Title]                       [Chip?]   [Avatar?]
 *
 *   B) Stats mode (Home, Solo, Online):
 *      [Back?]   [ 🏆 Puan  •  💎 Elmas ]      [Avatar?]
 *
 *   Stats mode activates when `headerStats` is provided:
 *      headerStats = { score: number, diamonds: number }
 *   When stats mode is active, `title` is intentionally ignored so the
 *   center area can host the Puan/Elmas pills without clipping on small
 *   screens.
 *
 *  Other rules:
 *   - Back button only when `showBack` is true (root screens hide it).
 *   - Avatar shown by default; pass `showProfile={false}` to hide it
 *     (Home requirement).
 *   - Chip area (`chipValue`) only renders in TITLE mode and only when a
 *     real numeric value is passed.
 *   - Header is fixed, safe-area aware, mobile-first.
 *
 * IMPORTANT: This component only hosts the notification bell visually;
 * notification loading/actions live inside HeaderNotificationBell.
 * Tutorial/lobby/game logic remains outside this header.
 */
export default function ScreenHeader({
  title,
  showBack = false,
  onBack,
  user = null,
  chipValue = null,
  rightSlot = null,
  // Codex118 — optional stats payload. When provided, the center area
  // renders Puan + Elmas instead of `title`. Both numbers must come from
  // the caller's source of truth (Puan = visible Kronox Puan, Elmas =
  // canonical persisted User.diamonds with safe loading fallback). The
  // header does NOT compute these itself.
  headerStats = null,
  // Codex118 — Home hides the avatar. Default true preserves every
  // other screen's existing behavior.
  showProfile = true,
}) {
  const navigate = useNavigate();
  const location = useLocation();

  const handleBack = () => {
    sounds.tap();
    if (onBack) { onBack(); return; }
    navigate(getSafeBackRoute(location), { replace: true });
  };

  const handleAvatar = () => {
    sounds.tap();
    navigate('/profile', { state: getTabRootNavigationState('/profile') });
  };

  const displayName = user?.username || user?.public_username || user?.full_name || (user?.email ? user.email.split('@')[0] : '');
  const hasChip = chipValue !== null && chipValue !== undefined && chipValue !== '';
  const statsMode = headerStats && typeof headerStats === 'object';

  return (
    <header
      className="fixed top-0 left-0 right-0 z-[110] flex items-center gap-2 px-3 bg-background/85 backdrop-blur-md border-b border-white/10"
      style={{
        paddingTop: 'env(safe-area-inset-top)',
        height: 'calc(3.5rem + env(safe-area-inset-top))',
        userSelect: 'none',
      }}
    >
      {/* Left: back or spacer */}
      <div className="flex items-center" style={{ minWidth: 44 }}>
        {showBack ? (
          <button
            type="button"
            onClick={handleBack}
            className="w-10 h-10 rounded-2xl bg-white/10 border border-white/15 flex items-center justify-center text-white hover:bg-white/20 active:scale-95 transition-all"
            style={{ minHeight: 40, minWidth: 40 }}
            aria-label="Geri"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
        ) : null}
      </div>

      {/* Center: stats (Puan + Elmas) OR title */}
      {statsMode ? (
        <HeaderStats stats={headerStats} />
      ) : (
        <h1
          className="flex-1 text-center font-cinzel text-base sm:text-lg font-black tracking-[0.16em] truncate px-1"
          style={{
            color: '#facc15',
            textShadow: '0 0 14px rgba(250,204,21,0.45), 0 2px 4px rgba(0,0,0,0.6)',
          }}
        >
          {title}
        </h1>
      )}

      {/* Right cluster: chip (optional, title-mode only) + notification bell + avatar (optional) */}
      <div className="flex items-center gap-2" style={{ minWidth: 44, justifyContent: 'flex-end' }}>
        {rightSlot}

        {/* Codex134 — Notification bell. Only rendered when a user is
            signed in (the bell itself short-circuits to null otherwise).
            Sits before the avatar so the avatar stays in its existing
            top-right anchor on every screen. */}
        <HeaderNotificationBell user={user} />

        {!statsMode && hasChip && (
          <div
            className="kronox-number flex h-9 items-center gap-1 rounded-full px-2.5 text-[12px] text-amber-100"
            style={{
              background: 'linear-gradient(180deg, rgba(250,204,21,0.18), rgba(185,122,6,0.10))',
              boxShadow: 'inset 0 0 0 1px rgba(250,204,21,0.45), 0 0 10px rgba(250,204,21,0.22)',
            }}
            aria-label={`Chip: ${chipValue}`}
          >
            <span
              className="inline-block w-3 h-3 rounded-full"
              style={{
                background: 'radial-gradient(circle at 35% 28%, #ffe066, #b97a06 70%)',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.5)',
              }}
            />
            <span>{chipValue}</span>
          </div>
        )}

        {showProfile && (
          <motion.button
            type="button"
            onClick={handleAvatar}
            whileTap={{ scale: 0.92 }}
            transition={{ type: 'spring', stiffness: 520, damping: 24 }}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
            aria-label="Profil"
          >
            <KronoxAvatar profile={user} initial={displayName || 'K'} size={40} />
          </motion.button>
        )}
      </div>
    </header>
  );
}

/**
 * Codex118 — Centered Puan + Elmas pills.
 *
 * Sized to never overflow on a 320px-wide viewport:
 *  - shrinks each pill (px-2, h-8, text-[11px]).
 *  - container is flex-1 + min-w-0 so it absorbs the leftover space.
 *  - both numbers are clamped via `truncate` defensive max-width.
 */
function HeaderStats({ stats }) {
  const score = formatStatNumber(stats?.score);
  const diamonds = formatStatNumber(stats?.diamonds);
  return (
    <div
      className="flex flex-1 min-w-0 items-center justify-center gap-1.5 sm:gap-2 px-1"
      aria-label={`Puan ${score}, Elmas ${diamonds}`}
    >
      <StatPill
        icon={Trophy}
        value={score}
        label="Puan"
        tint="#facc15"
        glow="rgba(250,204,21,0.30)"
      />
      <StatPill
        icon={Gem}
        value={diamonds}
        label="Elmas"
        tint="#7dd3fc"
        glow="rgba(34,211,238,0.30)"
      />
    </div>
  );
}

function StatPill({ icon: Icon, value, label, tint, glow }) {
  return (
    <div
      className="kronox-number flex h-8 min-w-0 items-center gap-1 rounded-full px-2 text-[11px] text-amber-100 sm:px-2.5 sm:text-[12px]"
      style={{
        background: 'linear-gradient(180deg, rgba(20,30,58,0.92), rgba(4,8,22,0.96))',
        boxShadow: `inset 0 0 0 1px ${tint}88, 0 0 8px ${glow}`,
        color: tint,
      }}
      aria-label={`${label}: ${value}`}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" />
      <span className="truncate" style={{ maxWidth: '6ch' }}>{value}</span>
    </div>
  );
}

function formatStatNumber(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '0';
  return Math.max(0, Math.floor(n)).toString();
}
