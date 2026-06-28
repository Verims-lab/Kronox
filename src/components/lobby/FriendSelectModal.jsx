import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Check, UserRound, UserPlus, AlertCircle, ChevronDown, Swords } from 'lucide-react';
import { sounds } from '@/lib/gameSounds';
import {
  loadOnlinePlayerSelection,
  ONLINE_PLAYER_SELECTION_GROUPS,
} from '@/lib/onlinePlayerSelection';
import { PRESENCE_REFRESH_MS } from '@/lib/presence';

/**
 * Kronox Online — Friend Select Modal (Codex159 redesign).
 *
 * Matches the target design (Attachment 3):
 *   • Premium dark-fantasy popup framed by gold ring.
 *   • Header: "OYUNCU SEÇ" with people icon + subtitle.
 *   • A dropdown-style filter chip with "Oyuncu seç..." label, then
 *     the actual list underneath.
 *   • Rows are ordered as online friends, online non-friends, offline friends.
 *   • Each row: small real presence dot + avatar + username + status/relation
 *     labels + a square gold checkbox on the right.
 *   • Bottom CTA: "ONAYLA" with crossed swords accent (gold, glowing).
 *
 * Selection rules:
 *   - Minimum 1 player required to enable "ONAYLA".
 *   - Maximum 3 players; extra taps are silent no-ops.
 *
 * Selection stores opaque backend target refs, never recipient emails.
 */
const MAX_SELECTION = 3;
const GROUP_LABELS = {
  [ONLINE_PLAYER_SELECTION_GROUPS.ONLINE_FRIEND]: 'Çevrimiçi Arkadaşlar',
  [ONLINE_PLAYER_SELECTION_GROUPS.ONLINE_NON_FRIEND]: 'Çevrimiçi Oyuncular',
  [ONLINE_PLAYER_SELECTION_GROUPS.OFFLINE_FRIEND]: 'Çevrim Dışı Arkadaşlar',
};

export default function FriendSelectModal({
  open,
  onClose,
  user,
  initialSelectedTargets = [],
  onConfirm,
  onGoFriends,
}) {
  const [selected, setSelected] = useState(initialSelectedTargets);
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) setSelected(initialSelectedTargets);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    if (!user?.email) {
      setPlayers([]);
      setLoading(false);
      setError('');
      return undefined;
    }
    let cancelled = false;
    const refresh = async ({ showLoading = false } = {}) => {
      if (cancelled) return;
      if (showLoading) setLoading(true);
      setError('');
      try {
        const rows = await loadOnlinePlayerSelection();
        if (!cancelled) setPlayers(rows || []);
      } catch (err) {
        if (!cancelled) setError(err?.message || 'Oyuncular yüklenemedi.');
      } finally {
        if (!cancelled && showLoading) setLoading(false);
      }
    };
    const refreshIfVisible = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    refresh({ showLoading: true });
    const intervalId = window.setInterval(refreshIfVisible, PRESENCE_REFRESH_MS);
    document.addEventListener('visibilitychange', refreshIfVisible);
    window.addEventListener('focus', refreshIfVisible);
    window.addEventListener('online', refreshIfVisible);
    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', refreshIfVisible);
      window.removeEventListener('focus', refreshIfVisible);
      window.removeEventListener('online', refreshIfVisible);
    };
  }, [open, user?.email]);

  useEffect(() => {
    if (!open) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  const toggle = (targetRef) => {
    if (!targetRef) return;
    setSelected((prev) => {
      if (prev.includes(targetRef)) {
        sounds.tick();
        return prev.filter((ref) => ref !== targetRef);
      }
      if (prev.length >= MAX_SELECTION) {
        sounds.tick();
        return prev; // silent cap at 3
      }
      sounds.tap();
      return [...prev, targetRef];
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
            role="dialog"
            aria-modal="true"
            aria-labelledby="friend-select-modal-title"
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
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
              <p
                id="friend-select-modal-title"
                className="font-cinzel font-black"
                style={{
                  color: '#f1f4ff',
                  fontSize: 'clamp(15px, 4.4vw, 18px)',
                  letterSpacing: '0.20em',
                }}
              >
                OYUNCU SEÇ
              </p>
              <p className="mt-1 font-inter text-[12px] text-blue-100/70 leading-snug">
                Arkadaşlarını ve çevrimiçi<br />oyuncuları seç.
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
                <span className="font-inter text-[13px] text-blue-100/70">Oyuncu seç...</span>
                <ChevronDown className="h-4 w-4 text-blue-100/60" strokeWidth={2.4} />
              </div>
            </div>

            {/* Scrollable list */}
            <div
              className="flex-1 overflow-y-auto px-5 pt-2 pb-2"
              style={{ overscrollBehavior: 'contain', WebkitOverflowScrolling: 'touch' }}
            >
              {loading && players.length === 0 ? (
                <FriendsSkeleton />
              ) : error && players.length === 0 ? (
                <ErrorHint text={error} />
              ) : players.length === 0 ? (
                <EmptyPlayers onGoFriends={onGoFriends} onClose={onClose} />
              ) : (
                <GroupedPlayerList
                  players={players}
                  selected={selected}
                  onToggle={toggle}
                />
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
                  ? 'En az 1 oyuncu seçmelisin.'
                  : `${selected.length} oyuncu seçildi`}
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ----------------------------- Sub-views ----------------------------- */

function GroupedPlayerList({ players, selected, onToggle }) {
  return (
    <div className="space-y-3">
      {Object.values(ONLINE_PLAYER_SELECTION_GROUPS).map((group) => {
        const rows = players.filter((player) => player.group === group);
        if (!rows.length) return null;
        return (
          <section key={group}>
            <p className="px-1 pb-1 font-inter text-[10px] font-black uppercase tracking-[0.18em] text-blue-100/55">
              {GROUP_LABELS[group]}
            </p>
            <ul className="divide-y divide-white/5">
              {rows.map((player) => {
                const isSelected = selected.includes(player.target_ref);
                const capped = !isSelected && selected.length >= MAX_SELECTION;
                return (
                  <PlayerRow
                    key={player.target_ref}
                    player={player}
                    selected={isSelected}
                    capped={capped}
                    onToggle={() => onToggle(player.target_ref)}
                  />
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function PlayerRow({ player, selected, capped, onToggle }) {
  const display = player?.username || player?.display_name || 'Oyuncu';
  const initial = (display || '?').charAt(0).toUpperCase();
  const isOnline = Boolean(player?.online);

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
            background: isOnline ? '#22c55e' : '#ef4444',
            boxShadow: isOnline ? '0 0 6px rgba(34,197,94,0.65)' : '0 0 6px rgba(239,68,68,0.38)',
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
          <div className="flex min-w-0 items-center gap-2">
            <p className="truncate font-inter text-[11px]" style={{ color: isOnline ? '#34d399' : '#f87171' }}>
              {player?.status_label || (isOnline ? 'Çevrimiçi' : 'Çevrim dışı')}
            </p>
            <span className="shrink-0 rounded-full px-1.5 py-0.5 font-inter text-[9px] font-black uppercase tracking-wider text-blue-100/75"
              style={{ boxShadow: 'inset 0 0 0 1px rgba(120,170,255,0.25)' }}>
              {player?.badge_label || (player?.relation === 'friend' ? 'Arkadaş' : 'Oyuncu')}
            </span>
          </div>
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
    <div
      className="space-y-2 py-2"
      role="status"
      aria-live="polite"
      aria-label="Oyuncular yükleniyor"
    >
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          className="h-12 rounded-xl"
          aria-hidden="true"
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

function EmptyPlayers({ onGoFriends, onClose }) {
  return (
    <div
      className="rounded-2xl px-4 py-5 text-center my-2"
      style={{
        background: 'linear-gradient(180deg, rgba(30,41,75,0.7), rgba(10,16,36,0.85))',
        boxShadow: 'inset 0 0 0 1.5px rgba(120,170,255,0.30)',
      }}
    >
      <UserPlus className="mx-auto h-7 w-7 text-amber-300" />
      <p className="mt-2 font-cinzel text-base tracking-wider text-white">Oyuncu bulunamadı</p>
      <p className="mt-1 font-inter text-[12px] text-blue-100/65">
        Çevrimiçi oyuncu veya arkadaş görünmüyor.
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
