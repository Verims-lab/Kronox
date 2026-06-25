import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Mailbox, Loader2, Check, X, AlertCircle, Crown } from 'lucide-react';
import {
  openNotificationCenterGameInvite,
  rejectNotificationCenterGameInvite,
  useNotificationCenter,
} from '@/hooks/useNotificationCenter';
import { isGameInviteExpired } from '@/lib/gameInviteSelectors';
import { getSafeNotificationActorName } from '@/lib/notificationIdentity';
import { sounds } from '@/lib/gameSounds';
import InviteCountdown from '@/components/invites/InviteCountdown';

/**
 * "Oyun Davetleri" — pending GameInvite rows addressed to the current user.
 * Reads from the shared notification center. Header, in-app toast, and this
 * panel now share one fetch/subscription/merge lifecycle, so stale refetches
 * cannot make just one surface flicker empty while another still has data.
 *
 * Renders nothing when there are no pending invites (and not loading), so it
 * can be embedded anywhere without taking space.
 */
export default function IncomingInvitesPanel({ user, variant = 'fantasy' }) {
  const navigate = useNavigate();
  const center = useNotificationCenter(user);
  const [localError, setLocalError] = useState('');
  const [busyId, setBusyId] = useState(null);
  const invites = center.gameInvites;
  const loading = center.loading;
  const error = localError || center.error || '';

  const handleAccept = async (invite) => {
    if (busyId) return;
    setBusyId(invite.id);
    setLocalError('');
    sounds.tap();
    try {
      if (isGameInviteExpired(invite)) {
        setLocalError('Davetin süresi doldu. Yeni bir davet iste.');
        await center.refresh({ preserveExisting: true, source: 'online_panel_expired_retry' });
        return;
      }
      const res = await openNotificationCenterGameInvite(invite, {
        navigate,
        userEmail: user.email,
        source: 'online_pending_panel',
        onAccepted: async () => center.refresh({ preserveExisting: true, source: 'online_panel_accepted_followup' }),
      });
      if (!res.ok) setLocalError(res.reason || 'Davet kabul edilemedi.');
    } catch (err) {
      setLocalError(err?.message || 'Davet kabul edilemedi.');
    } finally {
      setBusyId(null);
    }
  };

  const handleReject = async (invite) => {
    if (busyId) return;
    setBusyId(invite.id);
    setLocalError('');
    sounds.tick();
    try {
      const res = await rejectNotificationCenterGameInvite(invite.id);
      if (!res.ok) setLocalError(res.reason || 'Davet reddedilemedi.');
    } catch (err) {
      setLocalError(err?.message || 'Davet reddedilemedi.');
    } finally {
      setBusyId(null);
    }
  };

  if (!user?.email) return null;
  if (!loading && invites.length === 0 && !error) return null;

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <Mailbox className="h-3.5 w-3.5 text-amber-200/80" />
          <p className="font-inter text-[10px] font-black uppercase tracking-[0.18em] text-blue-100/70">
            Oyun Davetleri
          </p>
        </div>
        {invites.length > 0 && (
          <span
            className="rounded-full px-2 py-0.5 font-inter text-[10px] font-black text-amber-200"
            style={{ background: 'rgba(250,204,21,0.10)', boxShadow: 'inset 0 0 0 1px rgba(250,204,21,0.35)' }}
          >
            {invites.length}
          </span>
        )}
      </div>

      {error && (
        <div
          className="flex items-start gap-2 rounded-xl px-3 py-2"
          style={{ background: 'rgba(244,63,94,0.10)', boxShadow: 'inset 0 0 0 1px rgba(244,63,94,0.35)' }}
        >
          <AlertCircle className="h-4 w-4 text-rose-300 flex-shrink-0 mt-0.5" />
          <p className="font-inter text-xs text-rose-100/90">{error}</p>
        </div>
      )}

      {loading && invites.length === 0 ? (
        <div className="h-14 rounded-2xl"
          style={{
            background: 'linear-gradient(90deg, rgba(255,255,255,0.04), rgba(255,255,255,0.08), rgba(255,255,255,0.04))',
            backgroundSize: '200% 100%',
            animation: 'kx-skeleton 1.2s linear infinite',
          }}
        />
      ) : (
        <ul className="space-y-2">
          <AnimatePresence initial={false}>
            {invites.map((invite) => (
              <InviteRow
                key={invite.id}
                invite={invite}
                busy={busyId === invite.id}
                onAccept={() => handleAccept(invite)}
                onReject={() => handleReject(invite)}
              />
            ))}
          </AnimatePresence>
        </ul>
      )}
      <style>{`@keyframes kx-skeleton { 0%{background-position:200% 0} 100%{background-position:-200% 0} }`}</style>
    </section>
  );
}

function InviteRow({ invite, busy, onAccept, onReject }) {
  const display = getSafeNotificationActorName(invite.from_name, 'Bir arkadaşın');
  const expired = invite.status === 'expired' || isGameInviteExpired(invite);
  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ type: 'spring', stiffness: 560, damping: 28 }}
      className="rounded-2xl p-3 flex items-center gap-3"
      style={{
        background:
          'linear-gradient(180deg, rgba(30,41,75,0.95) 0%, rgba(14,22,46,0.98) 70%, rgba(6,10,24,1) 100%)',
        boxShadow:
          'inset 0 0 0 1.5px rgba(250,204,21,0.40), inset 0 1px 0 rgba(255,255,255,0.08), 0 0 18px rgba(250,204,21,0.18), 0 8px 16px rgba(2,6,23,0.5)',
      }}
    >
      <div
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
        style={{
          background: 'radial-gradient(circle at 35% 28%, #ffe066, #b97a06 70%)',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.45), 0 0 12px rgba(250,204,21,0.5)',
        }}
      >
        <Crown className="h-5 w-5 text-amber-950" strokeWidth={2.6} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-inter text-sm font-bold text-white">{display}</p>
        <p className="truncate font-inter text-[11px] text-blue-100/65">
          {invite.player_count ? `${invite.player_count} Kişilik` : 'Online'} meydan okumaya çağırıyor
        </p>
        <div className="mt-1">
          <InviteCountdown invite={invite} />
        </div>
      </div>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={onReject}
          disabled={busy}
          className="flex h-9 w-9 items-center justify-center rounded-full"
          style={{
            background: 'rgba(244,63,94,0.10)',
            boxShadow: 'inset 0 0 0 1px rgba(244,63,94,0.45)',
            opacity: busy ? 0.5 : 1,
          }}
          aria-label="Daveti reddet"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin text-rose-200" /> : <X className="h-4 w-4 text-rose-200" strokeWidth={2.6} />}
        </button>
        <button
          type="button"
          onClick={onAccept}
          disabled={busy || expired}
          className="flex h-9 w-9 items-center justify-center rounded-full"
          style={{
            background: expired
              ? 'rgba(148,163,184,0.12)'
              : 'linear-gradient(180deg,#ffe066,#b97a06)',
            boxShadow: expired
              ? 'inset 0 0 0 1px rgba(148,163,184,0.30)'
              : 'inset 0 1px 0 rgba(255,255,255,0.45), 0 0 12px rgba(250,204,21,0.5)',
            opacity: busy || expired ? 0.6 : 1,
          }}
          aria-label={expired ? 'Davetin süresi doldu' : 'Daveti kabul et'}
        >
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin text-amber-950" />
          ) : (
            <Check className={`h-4 w-4 ${expired ? 'text-blue-100/45' : 'text-amber-950'}`} strokeWidth={3.2} />
          )}
        </button>
      </div>
    </motion.li>
  );
}
