import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, UserRound } from 'lucide-react';
import { motion } from 'framer-motion';
import { sounds } from '@/lib/gameSounds';

/**
 * Codex102 — Standardized top bar for primary navigation screens.
 *
 * Layout:
 *   [Back?]   [Title]            [Chip?]   [Avatar]
 *
 * Rules followed (per brief):
 *  - Back button only when `showBack` is true (root screens hide it).
 *  - Title is centered text content.
 *  - Chip area is rendered ONLY when a real numeric value is passed via
 *    `chipValue`. If absent or null/undefined → the slot is hidden (no
 *    hardcoded "12.450"-style fake economy).
 *  - Avatar shows user's first initial when signed in; falls back to a
 *    safe UserRound icon for guests.
 *  - Header is fixed, safe-area aware, mobile-first.
 *
 * IMPORTANT: This component does NOT touch any business logic
 * (notifications, invites, tutorial, lobby, game). It is purely
 * presentational.
 */
export default function ScreenHeader({
  title,
  showBack = false,
  onBack,
  user = null,
  chipValue = null,
  rightSlot = null,
}) {
  const navigate = useNavigate();

  const handleBack = () => {
    sounds.tap();
    if (onBack) { onBack(); return; }
    if (typeof window !== 'undefined' && window.history.length > 1) navigate(-1);
    else navigate('/');
  };

  const handleAvatar = () => {
    sounds.tap();
    navigate('/profile');
  };

  const displayName = user?.full_name || (user?.email ? user.email.split('@')[0] : '');
  const initial = (displayName || '').trim().charAt(0).toUpperCase();
  const hasChip = chipValue !== null && chipValue !== undefined && chipValue !== '';

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

      {/* Center: title */}
      <h1
        className="flex-1 text-center font-cinzel text-base sm:text-lg font-black tracking-[0.16em] truncate px-1"
        style={{
          color: '#facc15',
          textShadow: '0 0 14px rgba(250,204,21,0.45), 0 2px 4px rgba(0,0,0,0.6)',
        }}
      >
        {title}
      </h1>

      {/* Right cluster: chip (optional) + avatar */}
      <div className="flex items-center gap-2" style={{ minWidth: 44 }}>
        {rightSlot}

        {hasChip && (
          <div
            className="flex items-center gap-1 rounded-full px-2.5 h-9 font-inter text-[12px] font-black text-amber-100"
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

        <motion.button
          type="button"
          onClick={handleAvatar}
          whileTap={{ scale: 0.92 }}
          transition={{ type: 'spring', stiffness: 520, damping: 24 }}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-amber-950"
          style={{
            background: 'radial-gradient(circle at 35% 28%, #ffe066, #b97a06 70%)',
            boxShadow: '0 0 14px rgba(250,204,21,0.45), inset 0 1px 0 rgba(255,255,255,0.45), inset 0 -4px 6px rgba(140,80,8,0.55)',
          }}
          aria-label="Profil"
        >
          {user && initial ? (
            <span className="font-bangers text-lg leading-none">{initial}</span>
          ) : (
            <UserRound className="h-5 w-5" strokeWidth={2.6} />
          )}
        </motion.button>
      </div>
    </header>
  );
}