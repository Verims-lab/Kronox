import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trash2, Loader2, AlertTriangle } from 'lucide-react';
import { getSafeFriendDisplayName } from '@/lib/publicIdentity';
import KronoxAvatar from '@/components/profile/KronoxAvatar';

/**
 * One row of the "My Friends" list. Removal requires explicit confirmation.
 */
export default function FriendListItem({ friend, presence, onRemove }) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const display = getSafeFriendDisplayName(friend);
  const isOnline = Boolean(presence?.online);
  const avatarProfile = presence?.avatar_type ? { ...friend, ...presence } : friend;

  const handleRemove = async () => {
    setBusy(true);
    setError('');
    try {
      await onRemove(friend.target_ref);
    } catch (err) {
      setError(err.message || 'Arkadaş kaldırılamadı.');
      setBusy(false);
      setConfirming(false);
    }
  };

  return (
    <div
      className="rounded-2xl p-3"
      style={{
        background: 'linear-gradient(180deg, rgba(30,41,75,0.9), rgba(10,16,36,0.95))',
        boxShadow:
          'inset 0 0 0 1.5px rgba(120,170,255,0.28), inset 0 1px 0 rgba(255,255,255,0.08), 0 6px 14px rgba(2,6,23,0.45)',
      }}
    >
      <div className="flex items-center gap-3">
        <div className="relative shrink-0">
          <KronoxAvatar profile={avatarProfile} initial={display} size={36} />
          {presence && (
            <span
              aria-hidden="true"
              className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full"
              style={{
                background: isOnline ? '#22c55e' : 'rgba(148,163,184,0.75)',
                boxShadow: isOnline
                  ? '0 0 6px rgba(34,197,94,0.65), 0 0 0 2px rgba(10,16,36,0.95)'
                  : '0 0 0 2px rgba(10,16,36,0.95)',
              }}
            />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-inter text-sm font-bold text-white">{display}</p>
          {presence && (
            <p className="truncate font-inter text-[12px]" style={{ color: isOnline ? '#34d399' : 'rgba(148,163,184,0.85)' }}>
              {presence.label || 'Çevrim dışı'}
            </p>
          )}
        </div>
        {!confirming && (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-rose-300/80 hover:text-rose-300"
            style={{ background: 'rgba(244,63,94,0.08)', boxShadow: 'inset 0 0 0 1px rgba(244,63,94,0.28)' }}
            aria-label={`${display} arkadaşını kaldır`}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>

      <AnimatePresence>
        {confirming && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="mt-3 rounded-xl p-3"
            style={{
              background: 'rgba(244,63,94,0.10)',
              boxShadow: 'inset 0 0 0 1px rgba(244,63,94,0.35)',
            }}
          >
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 flex-shrink-0 text-rose-300 mt-0.5" />
              <p className="font-inter text-xs text-rose-100/90 leading-relaxed">
                <span className="font-bold">{display}</span> arkadaşlıktan çıkarılsın mı? Bu işlem her iki tarafta da geri alınır.
              </p>
            </div>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => { setConfirming(false); setError(''); }}
                className="flex-1 rounded-xl py-2 font-inter text-xs font-bold text-white/80 disabled:opacity-50"
                style={{ background: 'rgba(255,255,255,0.06)', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.15)' }}
              >
                Vazgeç
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={handleRemove}
                className="flex-1 inline-flex items-center justify-center gap-1 rounded-xl py-2 font-inter text-xs font-black text-rose-50 disabled:opacity-50"
                style={{
                  background: 'linear-gradient(180deg,#f43f5e,#9f1239)',
                  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.25), 0 4px 10px rgba(159,18,57,0.45)',
                }}
              >
                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                Evet, kaldır
              </button>
            </div>
            {error && <p className="mt-2 font-inter text-[12px] text-rose-200">{error}</p>}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
