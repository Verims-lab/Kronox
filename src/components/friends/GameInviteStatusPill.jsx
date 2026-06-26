import React from 'react';
import { isGameInviteExpired } from '@/lib/inviteApi';

function hasFriendRequestShape(invite) {
  return Boolean(
    (invite?.from_email || invite?.to_email)
      && !invite?.lobby_id
      && !invite?.lobby_code
      && !invite?.invite_target_ref
  );
}

function isFriendRequestExpiredForDisplay(invite) {
  if (String(invite?.status || '').toLowerCase() === 'expired') return true;
  const raw = invite?.expires_at || invite?.expiresAt;
  if (!raw) return false;
  const parsed = Date.parse(String(raw));
  return Number.isFinite(parsed) && parsed <= Date.now();
}

/**
 * GameInviteStatusPill — Codex099
 *
 * Maps a GameInvite/FriendRequest status (+ TTL gate for GameInvite) to a
 * user-friendly Turkish label. Read-only. Does not mutate.
 *
 * Statuses we map (taken from inviteApi.js + friendsApi.js + Lobby flow):
 *   pending     → Bekliyor       (with TTL: shows "Süresi doldu" if expired)
 *   accepted    → Kabul edildi
 *   declined    → Reddedildi      (GameInvite uses "declined", FriendRequest uses "rejected")
 *   rejected    → Reddedildi
 *   expired     → Süresi doldu
 *   cancelled   → İptal edildi
 *   completed   → Tamamlandı
 */
const TONE_BY_STATUS = {
  pending:   { bg: 'rgba(250,204,21,0.10)',  ring: 'rgba(250,204,21,0.45)',  fg: '#fde68a' },
  accepted:  { bg: 'rgba(16,185,129,0.14)',  ring: 'rgba(52,211,153,0.45)',  fg: '#a7f3d0' },
  declined:  { bg: 'rgba(244,63,94,0.10)',   ring: 'rgba(244,63,94,0.45)',   fg: '#fecaca' },
  rejected:  { bg: 'rgba(244,63,94,0.10)',   ring: 'rgba(244,63,94,0.45)',   fg: '#fecaca' },
  expired:   { bg: 'rgba(148,163,184,0.10)', ring: 'rgba(148,163,184,0.30)', fg: 'rgba(226,232,240,0.70)' },
  cancelled: { bg: 'rgba(148,163,184,0.10)', ring: 'rgba(148,163,184,0.30)', fg: 'rgba(226,232,240,0.70)' },
  completed: { bg: 'rgba(125,211,252,0.10)', ring: 'rgba(125,211,252,0.40)', fg: '#bae6fd' },
};

const LABEL_BY_STATUS = {
  pending:   'Bekliyor',
  accepted:  'Kabul edildi',
  declined:  'Reddedildi',
  rejected:  'Reddedildi',
  expired:   'Süresi doldu',
  cancelled: 'İptal edildi',
  completed: 'Tamamlandı',
};

export default function GameInviteStatusPill({ invite, className = '' }) {
  if (!invite?.status) return null;

  // TTL-aware override: GameInvite can derive expiry from created_at, while
  // FriendRequest expiry is explicit 72h expires_at only.
  const expired = hasFriendRequestShape(invite)
    ? isFriendRequestExpiredForDisplay(invite)
    : isGameInviteExpired(invite);
  const effectiveStatus = invite.status === 'pending' && expired
    ? 'expired'
    : invite.status;

  const tone = TONE_BY_STATUS[effectiveStatus] || TONE_BY_STATUS.expired;
  const label = LABEL_BY_STATUS[effectiveStatus] || effectiveStatus;

  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 font-inter text-[12px] font-black uppercase tracking-widest ${className}`}
      style={{
        background: tone.bg,
        color: tone.fg,
        boxShadow: `inset 0 0 0 1px ${tone.ring}`,
      }}
    >
      {label}
    </span>
  );
}
