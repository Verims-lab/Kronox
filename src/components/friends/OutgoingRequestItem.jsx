import React, { useState } from 'react';
import { UserRound, X, Loader2 } from 'lucide-react';
import GameInviteStatusPill from '@/components/friends/GameInviteStatusPill';
import { getSafeRequestTargetName } from '@/lib/publicIdentity';

/**
 * One pending request the current user has sent — can be cancelled.
 *
 * Codex099 — adds user-friendly status pill so the sender can see
 * Bekliyor / Kabul edildi / Reddedildi / İptal edildi at a glance.
 * Cancel control is only active for "pending" rows. FriendRequest has no TTL,
 * so we do not render a countdown here (that is GameInvite-only).
 */
export default function OutgoingRequestItem({ request, onCancel }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const display = getSafeRequestTargetName(request);
  const status = request.status || 'pending';
  const isPending = status === 'pending';

  const handleCancel = async () => {
    setBusy(true);
    setError('');
    try {
      await onCancel(request);
    } catch (err) {
      setError(err.message || 'İptal başarısız.');
      setBusy(false);
    }
  };

  return (
    <div
      className="rounded-2xl p-3"
      style={{
        background: 'linear-gradient(180deg, rgba(30,41,75,0.85), rgba(10,16,36,0.92))',
        boxShadow:
          'inset 0 0 0 1.5px rgba(120,170,255,0.22), inset 0 1px 0 rgba(255,255,255,0.06), 0 6px 12px rgba(2,6,23,0.4)',
      }}
    >
      <div className="flex items-center gap-3">
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/5"
          style={{ boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.10)' }}
        >
          <UserRound className="h-4 w-4 text-blue-100/70" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-inter text-sm font-bold text-white/90">{display}</p>
          <div className="mt-0.5 flex items-center gap-1.5">
            <GameInviteStatusPill invite={request} />
          </div>
        </div>
        {isPending && (
          <button
            type="button"
            disabled={busy}
            onClick={handleCancel}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white/70 disabled:opacity-50"
            style={{ background: 'rgba(255,255,255,0.05)', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.15)' }}
            aria-label="İsteği iptal et"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
          </button>
        )}
      </div>
      {error && <p className="mt-2 font-inter text-[11px] text-rose-200">{error}</p>}
    </div>
  );
}
