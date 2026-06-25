import React, { useState } from 'react';
import { UserRound, Check, X, Loader2 } from 'lucide-react';
import { getSafeNotificationActorName } from '@/lib/notificationIdentity';

/**
 * One pending request addressed to the current user — accept or reject.
 */
export default function IncomingRequestItem({ request, onAccept, onReject }) {
  const [busy, setBusy] = useState(null); // 'accept' | 'reject' | null
  const [error, setError] = useState('');

  const display = getSafeNotificationActorName(request.from_name, 'Bir kullanıcı');

  const handle = async (action) => {
    setBusy(action);
    setError('');
    try {
      if (action === 'accept') await onAccept(request);
      else await onReject(request);
    } catch (err) {
      setError(err.message || 'İşlem başarısız.');
      setBusy(null);
    }
  };

  return (
    <div
      className="rounded-2xl p-3"
      style={{
        background: 'linear-gradient(180deg, rgba(30,41,75,0.9), rgba(10,16,36,0.95))',
        boxShadow:
          'inset 0 0 0 1.5px rgba(96,165,250,0.40), inset 0 1px 0 rgba(255,255,255,0.08), 0 0 14px rgba(59,130,246,0.18), 0 6px 14px rgba(2,6,23,0.45)',
      }}
    >
      <div className="flex items-center gap-3">
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
          style={{
            background: 'radial-gradient(circle at 35% 28%, #93c5fd, #1d4ed8 75%)',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.35), 0 0 10px rgba(59,130,246,0.35)',
          }}
        >
          <UserRound className="h-4 w-4 text-blue-950" strokeWidth={2.6} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-inter text-sm font-bold text-white">{display}</p>
          <p className="truncate font-inter text-[11px] text-blue-100/60">Arkadaşlık isteği</p>
        </div>
        <button
          type="button"
          disabled={Boolean(busy)}
          onClick={() => handle('reject')}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-rose-300/80 disabled:opacity-50"
          style={{ background: 'rgba(244,63,94,0.08)', boxShadow: 'inset 0 0 0 1px rgba(244,63,94,0.30)' }}
          aria-label="Reddet"
        >
          {busy === 'reject' ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
        </button>
        <button
          type="button"
          disabled={Boolean(busy)}
          onClick={() => handle('accept')}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-amber-950 disabled:opacity-50"
          style={{
            background: 'linear-gradient(180deg,#ffe066,#b97a06)',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.45), 0 0 10px rgba(250,204,21,0.45)',
          }}
          aria-label="Kabul et"
        >
          {busy === 'accept' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" strokeWidth={3} />}
        </button>
      </div>
      {error && <p className="mt-2 font-inter text-[11px] text-rose-200">{error}</p>}
    </div>
  );
}
