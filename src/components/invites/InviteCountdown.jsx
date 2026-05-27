import React, { useEffect, useState } from 'react';
import { Clock } from 'lucide-react';
import { getGameInviteExpiresAt, isGameInviteExpired } from '@/lib/inviteApi';

/**
 * InviteCountdown — Codex099
 *
 * Small, read-only countdown chip for a pending GameInvite.
 *
 * Pure UI: it READS getGameInviteExpiresAt() / isGameInviteExpired() from
 * @/lib/inviteApi (Codex contract). It does NOT mutate invite state — the
 * actual server-side expiration is owned by the parent accept/reject flow
 * (see IncomingInvitesPanel). This component never imports or invokes any
 * accept/reject helper, and never updates GameInvite rows.
 *
 *  - status === 'pending' & not expired → "4:37 kaldı"
 *  - expired (TTL passed but row still 'pending')      → "Süresi doldu"
 *  - status === 'expired' explicit                     → "Süresi doldu"
 *  - any other status                                  → null (caller renders status label itself)
 */
export default function InviteCountdown({ invite, className = '' }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!invite || invite.status !== 'pending') return undefined;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [invite?.id, invite?.status]);

  if (!invite) return null;
  if (invite.status === 'expired') return <ExpiredPill className={className} />;
  if (invite.status !== 'pending') return null;

  const expiresAt = getGameInviteExpiresAt(invite);
  if (!Number.isFinite(expiresAt)) return null;

  if (isGameInviteExpired(invite, now)) return <ExpiredPill className={className} />;

  const msLeft = Math.max(0, expiresAt - now);
  const totalSec = Math.ceil(msLeft / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  const isUrgent = totalSec <= 60;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-inter text-[10px] font-black uppercase tracking-widest ${className}`}
      style={{
        background: isUrgent ? 'rgba(244,63,94,0.12)' : 'rgba(250,204,21,0.10)',
        color: isUrgent ? '#fecaca' : '#fde68a',
        boxShadow: `inset 0 0 0 1px ${isUrgent ? 'rgba(244,63,94,0.45)' : 'rgba(250,204,21,0.45)'}`,
      }}
      aria-live="polite"
    >
      <Clock className="h-3 w-3" />
      {m}:{String(s).padStart(2, '0')}
    </span>
  );
}

function ExpiredPill({ className }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-inter text-[10px] font-black uppercase tracking-widest ${className}`}
      style={{
        background: 'rgba(148,163,184,0.10)',
        color: 'rgba(226,232,240,0.70)',
        boxShadow: 'inset 0 0 0 1px rgba(148,163,184,0.30)',
      }}
    >
      Süresi doldu
    </span>
  );
}