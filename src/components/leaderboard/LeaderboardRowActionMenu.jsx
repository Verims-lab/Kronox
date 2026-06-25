import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { UserPlus, Loader2, X } from 'lucide-react';

/**
 * Long-press context menu for a leaderboard player row.
 *
 * Centered bottom-sheet style popup (safer than anchored menus on mobile).
 * Currently exposes a single action: "Arkadaş ekle". The parent owns the
 * friend-request call and the success/error messaging; this component only
 * renders the menu, the busy state, and dismiss behavior.
 *
 * Privacy: receives a `playerName` (safe public username) only. No email or
 * internal identifier is passed in or shown.
 */
export default function LeaderboardRowActionMenu({
  open,
  playerName,
  busy = false,
  onAddFriend,
  onClose,
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          key="lb-action-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={busy ? undefined : onClose}
          className="fixed inset-0 z-[80] flex items-end justify-center px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))]"
          style={{ background: 'rgba(2,6,23,0.66)', backdropFilter: 'blur(2px)' }}
        >
          <motion.div
            key="lb-action-sheet"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            transition={{ type: 'spring', stiffness: 340, damping: 30 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-2xl p-4"
            style={{
              background: 'linear-gradient(180deg, rgba(30,41,75,0.96), rgba(10,16,36,0.98))',
              boxShadow:
                'inset 0 0 0 1.5px rgba(250,204,21,0.35), inset 0 1px 0 rgba(255,255,255,0.08), 0 0 22px rgba(250,204,21,0.18), 0 12px 26px rgba(2,6,23,0.6)',
            }}
          >
            <div className="flex items-center justify-between gap-3">
              <p className="min-w-0 truncate font-inter text-sm font-black text-white">
                {playerName}
              </p>
              <button
                type="button"
                onClick={onClose}
                disabled={busy}
                aria-label="Kapat"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-blue-100/70 disabled:opacity-50"
                style={{ background: 'rgba(255,255,255,0.06)', boxShadow: 'inset 0 0 0 1px rgba(125,211,252,0.18)' }}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <button
              type="button"
              onClick={onAddFriend}
              disabled={busy}
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl py-3 font-inter text-sm font-black text-amber-950 disabled:opacity-60"
              style={{
                background: 'linear-gradient(180deg,#ffe066,#b97a06)',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.45), 0 0 14px rgba(250,204,21,0.45), 0 6px 14px rgba(2,6,23,0.45)',
              }}
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
              Arkadaş ekle
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}