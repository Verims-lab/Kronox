import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Check, UserRound, UserPlus, AlertCircle, ChevronDown, Swords } from 'lucide-react';
import { sounds } from '@/lib/gameSounds';
import { loadFriends, normalizeEmail } from '@/lib/friendsApi';
import { getSafeFriendDisplayName } from '@/lib/publicIdentity';
import useFriendPresence from '@/hooks/useFriendPresence';

/**
 * Kronox Online — Friend Select Modal (Codex159 redesign).
 *
 * Matches the target design (Attachment 3):
 *   • Premium dark-fantasy popup framed by gold ring.
 *   • Header: "ARKADAŞ SEÇ" with people icon + subtitle.
 *   • A dropdown-style filter chip with "Arkadaş seç..." label, then
 *     the actual list of friends underneath.
 *   • Each row: small online status dot + avatar + name + online/offline
 *     text + a square gold checkbox on the right.
 *   • Bottom CTA: "ONAYLA" with crossed swords accent (gold, glowing).
 *
 * Selection rules:
 *   - Minimum 1 friend required to enable "ONAYLA".
 *   - Maximum 3 friends; extra taps are silent no-ops.
 *
 * Online status comes from the relationship-scoped presence helper. Presence
 * is visual only and does not affect selection eligibility.
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
  const {
    getPresenceForFriend,
  } = useFriendPresence(friends, { enabled: open && Boolean(user?.email) });

  useEffect(() => {
    if (open) setSelected(initialSelectedEmails);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

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
        return prev; // silent cap at 3
      }
      sounds.tap();
      return [...prev, email];
    });
  };

  const confirmEnabled = selected.length >= 1 && selected.length <= MAX_SELECTION;

  const confirm = () => {
    if (!confirmEnabled) return;
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
              maxHeight: '88vh',
              background: 'linear-gradient(180deg, rgba(20,32,68,0.98) 0%, rgba(10,18,42,0.99) 60%, rgba(6,10,24,1) 100%)',
              boxShadow: 'inset 0 0 0 1.5px rgba(250,204,21,0.40), inset 0 1px 0 rgba(255,255,255,0.10), 0 22px 44px rgba(2,6,23,0.65), 0 0 28px rgba(250,204,21,0.18)',
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
                className="font-cinzel font-black"
                style={{
                  color: '#f1f4ff',
                  fontSize: 'clamp(15px, 4.4vw, 18px)',
                  letterSpacing: '0.20em',
                }}
              >
                ARKADAŞ SEÇ
              </p>
              <p className="mt-1 font-inter text-[12px] text-blue-100/70 leading-snug">
                Meydan okumak istediğin<br />arkadaşını seç
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

            {/* Dropdown-style filter chip */}
            <div className="px-5">
              <div
                className="flex items-center justify-between rounded-xl px-4 py-2.5"
                style={{
                  background: 'rgba(8,14,32,0.75)',
                  boxShadow: 'inset 0 0 0 1px rgba(120,170,255,0.30)',
                }}
              >
                <span className="font-inter text-[13px] text-blue-100/70">Arkadaş seç...</span>
                <ChevronDown className="h-4 w-4 text-blue-100/60" strokeWidth={2.4} />
              </div>
            </div>

            {/* Scrollable list */}
            <div
              className="flex-1 overflow-y-auto px-5 pt-2 pb-2"
              style={{ overscrollBehavior: 'contain', WebkitOverflowScrolling: 'touch' }}
            >
              {loading ? (
                <FriendsSkeleton />
              ) : error ? (
                <ErrorHint text={error} />
              ) : friends.length === 0 ? (
                <EmptyFriends onGoFriends={onGoFriends} onClose={onClose} />
              ) : (
                <ul className="divide-y divide-white/5">
                  {friends.map((f) => {
                    const email = normalizeEmail(f.friend_email);
                    const isSelected = selected.includes(email);
                    const capped = !isSelected && selected.length >= MAX_SELECTION;
                    return (
                      <FriendRow
                        key={f.id}
                        friend={f}
                        presence={getPresenceForFriend(f)}
                        selected={isSelected}
                        capped={capped}
                        onToggle={() => toggle(email)}
                      />
                    );
                  })}
                </ul>
              )}
            </div>

            {/* Footer CTA — ONAYLA */}
            <div
              className="px-5 pt-3 pb-4"
              style={{ background: 'linear-gradient(to top, rgba(6,10,24,0.95), rgba(6,10,24,0.4))' }}
            >
              <motion.button
                type="button"
                onClick={confirm}
                disabled={!confirmEnabled}
                whileTap={!confirmEnabled ? undefined : { scale: 0.97 }}
                className="relative w-full h-12 rounded-2xl font-inter text-base font-black tracking-[0.22em] disabled:opacity-50 flex items-center justify-center"
                style={{
                  background: !confirmEnabled
                    ? 'linear-gradient(135deg, #5a4a14 0%, #6b5318 50%, #4d3f10 100%)'
                    : 'linear-gradient(180deg, #ffd84a 0%, #f5c400 55%, #e0ad00 100%)',
                  color: '#1a0a00',
                  boxShadow: !confirmEnabled
                    ? 'inset 0 1px 0 rgba(255,255,255,0.18)'
                    : '0 0 18px rgba(250,204,21,0.45), inset 0 1px 0 rgba(255,255,255,0.55), inset 0 -3px 0 rgba(120,75,0,0.35)',
                }}
              >
                <span>ONAYLA</span>
                {confirmEnabled && (
                  <Swords
                    className="absolute"
                    style={{ right: '1.25rem', width: 20, height: 20, color: '#1a0a00' }}
                    strokeWidth={2.2}
                  />
                )}
              </motion.button>
              <p className="mt-2 text-center font-inter text-[11px]"
                style={{ color: !confirmEnabled ? 'rgba(252,211,77,0.85)' : 'rgba(207,224,255,0.55)' }}>
                {!confirmEnabled
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

/* ----------------------------- Sub-views ----------------------------- */

function FriendRow({ friend, presence, selected, capped, onToggle }) {
  const display = getSafeFriendDisplayName(friend);
  const initial = (display || '?').charAt(0).toUpperCase();
  const isOnline = Boolean(presence?.online);

  return (
    <li>
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-3 py-3 text-left"
        style={{ opacity: capped ? 0.6 : 1 }}
        aria-pressed={selected}
      >
        {/* Online status dot */}
        <span
          aria-hidden="true"
          className="shrink-0 rounded-full"
          style={{
            width: 7, height: 7,
            background: isOnline ? '#22c55e' : 'rgba(148,163,184,0.6)',
            boxShadow: isOnline ? '0 0 6px rgba(34,197,94,0.65)' : 'none',
          }}
        />

        {/* Avatar */}
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
          style={{
            background: 'radial-gradient(circle at 35% 28%, #93c5fd, #1d4ed8 75%)',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.4), 0 0 8px rgba(59,130,246,0.32)',
          }}
        >
          {initial ? (
            <span className="font-bangers text-base text-blue-950">{initial}</span>
          ) : (
            <UserRound className="h-5 w-5 text-blue-950" strokeWidth={2.6} />
          )}
        </div>

        {/* Name + status text */}
        <div className="min-w-0 flex-1">
          <p className="truncate font-inter text-[14px] font-bold text-white">{display}</p>
          <p className="truncate font-inter text-[11px]" style={{ color: isOnline ? '#34d399' : 'rgba(148,163,184,0.85)' }}>
            {presence?.label || 'Çevrim dışı'}
          </p>
        </div>

        {/* Square gold checkbox */}
        <span
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded"
          style={{
            background: selected ? 'rgba(250,204,21,0.10)' : 'transparent',
            boxShadow: selected
              ? 'inset 0 0 0 1.5px rgba(250,204,21,0.95), 0 0 8px rgba(250,204,21,0.35)'
              : 'inset 0 0 0 1.5px rgba(207,224,255,0.45)',
          }}
        >
          {selected && <Check className="h-4 w-4" style={{ color: '#facc15' }} strokeWidth={3} />}
        </span>
      </button>
    </li>
  );
}

function FriendsSkeleton() {
  return (
    <div className="space-y-2 py-2">
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          className="h-12 rounded-xl"
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
