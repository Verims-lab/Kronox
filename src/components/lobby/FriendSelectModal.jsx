import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Check, UserRound, UserPlus, AlertCircle } from 'lucide-react';
import { sounds } from '@/lib/gameSounds';
import { loadFriends, normalizeEmail } from '@/lib/friendsApi';

/**
 * Kronox Online — Friend Select Modal (Codex127).
 *
 * Premium dark-fantasy popup for picking 1–3 friends to invite to an
 * online challenge lobby. Replaces the old full-page CreateLobbyInvitePanel
 * friend selection screen.
 *
 *  - Max selection: 3 (cap enforced silently — extra taps are no-ops).
 *  - Friends list scrolls vertically inside the popup; the page behind
 *    stays locked (no body scroll).
 *  - Confirm button forwards the chosen emails to the parent and closes
 *    the modal.
 *
 * Props:
 *   open                 : boolean
 *   onClose              : () => void
 *   user                 : current authenticated user (for loadFriends())
 *   initialSelectedEmails: string[] — pre-selected emails when reopened
 *   onConfirm(emails)    : commit selection to parent
 *   onGoFriends          : optional CTA when the user has no friends yet
 */
const MAX_SELECTION = 3;

export default function FriendSelectModal({
  open,
  onClose,
  user,
  initialSelectedEmails = [],
  onConfirm,
  onGoFriends,
}) {
  const [selected, setSelected] = useState(initialSelectedEmails);
  const [friends, setFriends] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Reset selection to whatever the parent currently has each time we open.
  useEffect(() => {
    if (open) setSelected(initialSelectedEmails);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Load friends every time the modal opens (cheap; <=200 rows).
  useEffect(() => {
    if (!open) return undefined;
    if (!user?.email) { setFriends([]); return undefined; }
    let cancelled = false;
    setLoading(true);
    setError('');
    loadFriends(user.email)
      .then((rows) => { if (!cancelled) setFriends(rows || []); })
      .catch((err) => { if (!cancelled) setError(err?.message || 'Arkadaşlar yüklenemedi.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [open, user?.email]);

  // Lock body scroll while open.
  useEffect(() => {
    if (!open) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  const toggle = (emailRaw) => {
    const email = normalizeEmail(emailRaw);
    if (!email) return;
    setSelected((prev) => {
      if (prev.includes(email)) {
        sounds.tick();
        return prev.filter((e) => e !== email);
      }
      if (prev.length >= MAX_SELECTION) {
        sounds.tick();
        return prev; // silent cap
      }
      sounds.tap();
      return [...prev, email];
    });
  };

  const confirm = () => {
    sounds.tap();
    onConfirm?.([...selected]);
    onClose?.();
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center px-3"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          style={{
            background: 'rgba(2,6,23,0.78)',
            backdropFilter: 'blur(6px)',
            paddingTop: 'calc(2rem + env(safe-area-inset-top))',
            paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))',
          }}
          onClick={onClose}
        >
          <motion.div
            initial={{ y: 24, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 24, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 360, damping: 30 }}
            className="relative w-full max-w-md rounded-3xl flex flex-col overflow-hidden"
            style={{
              maxHeight: '85vh',
              background: 'linear-gradient(180deg, rgba(30,41,75,0.98) 0%, rgba(14,22,46,0.99) 60%, rgba(6,10,24,1) 100%)',
              boxShadow: 'inset 0 0 0 1.5px rgba(250,204,21,0.42), inset 0 1px 0 rgba(255,255,255,0.10), 0 22px 44px rgba(2,6,23,0.65), 0 0 28px rgba(250,204,21,0.18)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="relative px-5 pt-5 pb-3 text-center">
              <button
                type="button"
                onClick={onClose}
                className="absolute top-4 right-4 flex h-9 w-9 items-center justify-center rounded-full text-blue-100/80"
                style={{
                  background: 'rgba(10,16,36,0.7)',
                  boxShadow: 'inset 0 0 0 1px rgba(120,170,255,0.30)',
                }}
                aria-label="Kapat"
              >
                <X className="h-4 w-4" />
              </button>
              <p
                className="font-cinzel text-lg font-black tracking-[0.22em]"
                style={{
                  color: '#facc15',
                  textShadow: '0 0 12px rgba(250,204,21,0.45), 0 2px 4px rgba(0,0,0,0.6)',
                }}
              >
                ARKADAŞLARINI SEÇ
              </p>
              <p className="mt-1 font-inter text-[12px] text-blue-100/70">
                1, 2 veya 3 arkadaş seçebilirsin
              </p>
              <div className="mt-2 flex justify-center">
                <span
                  className="rounded-full px-3 py-1 font-inter text-[11px] font-black tracking-widest text-amber-100"
                  style={{
                    background: 'rgba(250,204,21,0.10)',
                    boxShadow: 'inset 0 0 0 1px rgba(250,204,21,0.45)',
                  }}
                >
                  {selected.length}/{MAX_SELECTION} seçildi
                </span>
              </div>
            </div>

            {/* Scrollable list */}
            <div
              className="flex-1 overflow-y-auto px-4 pb-2"
              style={{ overscrollBehavior: 'contain', WebkitOverflowScrolling: 'touch' }}
            >
              {loading ? (
                <FriendsSkeleton />
              ) : error ? (
                <ErrorHint text={error} />
              ) : friends.length === 0 ? (
                <EmptyFriends onGoFriends={onGoFriends} onClose={onClose} />
              ) : (
                <ul className="space-y-2 py-1">
                  {friends.map((f) => {
                    const email = normalizeEmail(f.friend_email);
                    const isSelected = selected.includes(email);
                    return (
                      <FriendRow
                        key={f.id}
                        friend={f}
                        selected={isSelected}
                        onToggle={() => toggle(email)}
                      />
                    );
                  })}
                </ul>
              )}
            </div>

            {/* Footer CTA */}
            <div
              className="px-5 pt-3 pb-4"
              style={{
                background: 'linear-gradient(to top, rgba(6,10,24,0.95), rgba(6,10,24,0.4))',
              }}
            >
              <motion.button
                type="button"
                onClick={confirm}
                disabled={selected.length === 0}
                whileTap={selected.length === 0 ? undefined : { scale: 0.97 }}
                className="w-full h-12 rounded-2xl font-bangers text-lg tracking-[0.22em] disabled:opacity-50"
                style={{
                  background: selected.length === 0
                    ? 'linear-gradient(135deg, #5a4a14 0%, #6b5318 50%, #4d3f10 100%)'
                    : 'linear-gradient(135deg, #f5c400 0%, #facc15 50%, #e6b800 100%)',
                  color: '#1a0a00',
                  boxShadow: selected.length === 0
                    ? 'inset 0 1px 0 rgba(255,255,255,0.18)'
                    : '0 0 18px rgba(250,204,21,0.45), inset 0 1px 0 rgba(255,255,255,0.45), inset 0 -3px 5px rgba(140,80,8,0.55)',
                }}
              >
                SEÇİMİ ONAYLA
              </motion.button>
              <p className="mt-2 text-center font-inter text-[11px]"
                style={{ color: selected.length === 0 ? 'rgba(252,211,77,0.85)' : 'rgba(207,224,255,0.55)' }}>
                {selected.length === 0
                  ? 'En az 1 arkadaş seçmelisin.'
                  : `${selected.length} arkadaş seçildi`}
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function FriendRow({ friend, selected, onToggle }) {
  const display = friend.friend_name?.trim() || friend.friend_email;
  const initial = (display || '?').charAt(0).toUpperCase();
  return (
    <motion.li layout>
      <motion.button
        type="button"
        onClick={onToggle}
        whileTap={{ scale: 0.985 }}
        transition={{ type: 'spring', stiffness: 540, damping: 26 }}
        className="w-full flex items-center gap-3 rounded-2xl p-3 text-left"
        style={{
          background: selected
            ? 'linear-gradient(180deg, rgba(34,68,142,0.92), rgba(8,18,42,0.96))'
            : 'linear-gradient(180deg, rgba(30,41,75,0.85), rgba(10,16,36,0.92))',
          boxShadow: selected
            ? 'inset 0 0 0 1.5px rgba(250,204,21,0.85), inset 0 1px 0 rgba(255,255,255,0.12), 0 0 14px rgba(250,204,21,0.32)'
            : 'inset 0 0 0 1.5px rgba(120,170,255,0.28), inset 0 1px 0 rgba(255,255,255,0.06)',
        }}
        aria-pressed={selected}
      >
        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
          style={{
            background: selected
              ? 'radial-gradient(circle at 35% 28%, #ffe066, #b97a06 70%)'
              : 'radial-gradient(circle at 35% 28%, #93c5fd, #1d4ed8 75%)',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.4), 0 0 10px rgba(59,130,246,0.28)',
          }}
        >
          {initial ? (
            <span className={selected ? 'font-bangers text-lg text-amber-950' : 'font-bangers text-lg text-blue-950'}>
              {initial}
            </span>
          ) : (
            <UserRound className={selected ? 'h-5 w-5 text-amber-950' : 'h-5 w-5 text-blue-950'} strokeWidth={2.6} />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-inter text-sm font-bold text-white">{display}</p>
          {friend.friend_name && (
            <p className="truncate font-inter text-[11px] text-blue-100/60">{friend.friend_email}</p>
          )}
        </div>
        <span
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
          style={{
            background: selected
              ? 'linear-gradient(180deg,#ffe066,#b97a06)'
              : 'transparent',
            boxShadow: selected
              ? 'inset 0 1px 0 rgba(255,255,255,0.5), 0 0 10px rgba(250,204,21,0.55)'
              : 'inset 0 0 0 1.5px rgba(255,255,255,0.28)',
          }}
        >
          {selected ? <Check className="h-4 w-4 text-amber-950" strokeWidth={3.2} /> : null}
        </span>
      </motion.button>
    </motion.li>
  );
}

function FriendsSkeleton() {
  return (
    <div className="space-y-2 py-2">
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          className="h-14 rounded-2xl"
          style={{
            background:
              'linear-gradient(90deg, rgba(255,255,255,0.04), rgba(255,255,255,0.08), rgba(255,255,255,0.04))',
            backgroundSize: '200% 100%',
            animation: 'kx-skeleton 1.2s linear infinite',
          }}
        />
      ))}
      <style>{`@keyframes kx-skeleton { 0%{background-position:200% 0} 100%{background-position:-200% 0} }`}</style>
    </div>
  );
}

function EmptyFriends({ onGoFriends, onClose }) {
  return (
    <div
      className="rounded-2xl px-4 py-5 text-center my-2"
      style={{
        background: 'linear-gradient(180deg, rgba(30,41,75,0.7), rgba(10,16,36,0.85))',
        boxShadow: 'inset 0 0 0 1.5px rgba(120,170,255,0.30)',
      }}
    >
      <UserPlus className="mx-auto h-7 w-7 text-amber-300" />
      <p className="mt-2 font-cinzel text-base tracking-wider text-white">Henüz arkadaşın yok</p>
      <p className="mt-1 font-inter text-[12px] text-blue-100/65">
        Profil → Arkadaşlarım üzerinden arkadaş ekleyebilirsin.
      </p>
      {onGoFriends && (
        <button
          type="button"
          onClick={() => { sounds.tap(); onClose?.(); onGoFriends(); }}
          className="mt-3 inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 font-inter text-xs font-black text-amber-950"
          style={{
            background: 'linear-gradient(180deg,#ffe066,#b97a06)',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.45), 0 0 12px rgba(250,204,21,0.45)',
          }}
        >
          Arkadaşlarım sayfasına git
        </button>
      )}
    </div>
  );
}

function ErrorHint({ text }) {
  return (
    <div
      className="my-2 flex items-start gap-2 rounded-xl px-3 py-2"
      style={{ background: 'rgba(244,63,94,0.10)', boxShadow: 'inset 0 0 0 1px rgba(244,63,94,0.35)' }}
    >
      <AlertCircle className="h-4 w-4 text-rose-300 flex-shrink-0 mt-0.5" />
      <p className="font-inter text-xs text-rose-100/90">{text}</p>
    </div>
  );
}
