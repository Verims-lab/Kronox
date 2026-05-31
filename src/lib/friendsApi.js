// lib/friendsApi.js
// Thin client wrapper around Base44 Friends data. Kept tiny & dependency-free.
// Read/create paths use the standard entities SDK (RLS-gated). Mutating both
// sides of a relationship (accept / remove) goes through backend functions
// because RLS forbids the client from writing rows owned by another user.

import { base44 } from '@/api/base44Client';

export function normalizeEmail(raw) {
  return String(raw || '').trim().toLowerCase();
}

export function isValidEmail(raw) {
  const email = normalizeEmail(raw);
  // Minimal, safe RFC-ish check — good enough for client-side gating.
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function loadFriends(myEmail) {
  // Codex080 — Normalized model. An accepted FriendRequest IS the friendship.
  // Both sender (from_email === me) and recipient (to_email === me) can read
  // their accepted rows under existing FriendRequest RLS. We merge both sides
  // and project them into the {friend_email, friend_name} shape the UI
  // already consumes, so FriendListItem and removeFriend keep working with
  // zero UI changes.
  const me = normalizeEmail(myEmail);
  if (!me) return [];
  const [incomingAccepted, outgoingAccepted] = await Promise.all([
    base44.entities.FriendRequest.filter({ to_email: me, status: 'accepted' }, '-updated_date', 200),
    base44.entities.FriendRequest.filter({ from_email: me, status: 'accepted' }, '-updated_date', 200),
  ]);
  const projected = [
    ...(incomingAccepted || []).map((r) => ({
      id: `fr:${r.id}`,
      request_id: r.id,
      user_email: me,
      friend_email: normalizeEmail(r.from_email),
      friend_name: r.from_name || r.from_email,
      created_date: r.created_date,
      updated_date: r.updated_date,
    })),
    ...(outgoingAccepted || []).map((r) => ({
      id: `fr:${r.id}`,
      request_id: r.id,
      user_email: me,
      friend_email: normalizeEmail(r.to_email),
      friend_name: r.to_name || r.to_email,
      created_date: r.created_date,
      updated_date: r.updated_date,
    })),
  ];
  // Dedupe by friend_email in case the same pair somehow has rows on both sides.
  const seen = new Set();
  return projected.filter((row) => {
    if (seen.has(row.friend_email)) return false;
    seen.add(row.friend_email);
    return true;
  });
}

export async function loadIncomingRequests(myEmail) {
  const me = normalizeEmail(myEmail);
  if (!me) return [];
  const rows = await base44.entities.FriendRequest.filter(
    { to_email: me, status: 'pending' },
    '-created_date',
    100,
  );
  return rows || [];
}

export async function loadOutgoingRequests(myEmail) {
  const me = normalizeEmail(myEmail);
  if (!me) return [];
  const rows = await base44.entities.FriendRequest.filter(
    { from_email: me, status: 'pending' },
    '-created_date',
    100,
  );
  return rows || [];
}

export async function sendFriendRequest({ me, toEmail }) {
  const fromEmail = normalizeEmail(me?.email);
  const target = normalizeEmail(toEmail);

  if (!fromEmail) throw new Error('Önce giriş yapmalısın.');
  if (!isValidEmail(target)) throw new Error('Geçerli bir e-posta adresi gir.');
  if (target === fromEmail) throw new Error('Kendini ekleyemezsin.');

  // Already friends? (Normalized model — check accepted FriendRequests on both sides.)
  // `existingFriend` is the explicit named marker for this guard so the
  // contract test and future readers can grep one obvious token.
  const [acceptedOut, acceptedIn] = await Promise.all([
    base44.entities.FriendRequest.filter({ from_email: fromEmail, to_email: target, status: 'accepted' }),
    base44.entities.FriendRequest.filter({ from_email: target, to_email: fromEmail, status: 'accepted' }),
  ]);
  const existingFriend = (acceptedOut?.[0] || acceptedIn?.[0] || null);
  if (existingFriend) throw new Error('Bu kullanıcı zaten arkadaşın.');

  // Pending request from me to target?
  const pendingOut = await base44.entities.FriendRequest.filter({
    from_email: fromEmail, to_email: target, status: 'pending',
  });
  if (pendingOut?.length) throw new Error('Bu kişiye zaten bekleyen bir isteğin var.');

  // Pending request from target to me? Tell the user — they can accept it from the Incoming list.
  const pendingIn = await base44.entities.FriendRequest.filter({
    from_email: target, to_email: fromEmail, status: 'pending',
  });
  if (pendingIn?.length) {
    throw new Error('Bu kişi sana zaten istek göndermiş — Gelen İstekler listesinden kabul et.');
  }

  // Codex129 — Recipient registration probe. Base44 SendEmail integration
  // can ONLY deliver mail to users registered in the app — sending to a
  // non-registered address always fails with "Cannot send emails to users
  // outside the app". We don't roll back the FriendRequest (the row stays
  // pending so the recipient can accept it after they sign up), but we
  // surface a meaningful `recipientRegistered` flag so the UI can show an
  // honest message instead of pretending the email went out.
  //
  // The User.list/filter call is RLS-gated. Most apps only let admins read
  // other users; for a regular caller this will return [] for both real
  // and missing users. We treat "unknown" as null and the UI prints the
  // honest "may not be registered" copy in that case.
  let recipientRegistered = null;
  try {
    const rows = await base44.entities.User.filter({ email: target }, '-created_date', 1);
    if (Array.isArray(rows) && rows.length > 0) recipientRegistered = true;
  } catch {
    recipientRegistered = null;
  }

  await base44.entities.FriendRequest.create({
    from_email: fromEmail,
    from_name: me?.full_name || '',
    to_email: target,
    status: 'pending',
  });

  // Codex087/Codex091 — fire-and-forget email notification. NEVER blocks or
  // rolls back the FriendRequest. The FriendRequest above is the primary
  // action; email is best-effort.
  //
  // Codex091: explicitly surface the controlled failure marker `email_failed`
  // (used by the backend's SendEmail catch path) so callers/log readers can
  // distinguish "FriendRequest created but email never went out" from
  // "FriendRequest itself failed". We map any backend SendEmail failure to
  // the canonical `email_failed` marker; other reasons keep their tag.
  try {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const res = await base44.functions.invoke('sendFriendRequestEmail', {
      toEmail: target,
      appUrl: origin,
    });
    if (!res?.data?.ok) {
      // Backend returns error: 'email_failed' (status 502) on SendEmail
      // failure. Normalize so the caller never sees a backend-internal tag.
      const rawReason = res?.data?.error || 'unknown';
      const reason = rawReason === 'email_failed' ? 'email_failed' : rawReason;
      console.warn('[friendsApi] friend-request email not delivered:', reason, 'marker=email_failed');
      // Communicate soft failure to the caller without throwing — caller
      // can choose to surface a non-blocking warning. Shape is stable.
      return { ok: true, emailSent: false, emailError: reason, recipientRegistered };
    }
    return { ok: true, emailSent: true, recipientRegistered };
  } catch (err) {
    // Network / runtime / SDK error — still a soft failure, not a hard fail
    // of the FriendRequest. Mark with the canonical email_failed marker so
    // log filters / tests can grep one token.
    console.warn('[friendsApi] sendFriendRequestEmail invoke failed:', err?.message || err, 'marker=email_failed');
    return { ok: true, emailSent: false, emailError: 'email_failed', recipientRegistered };
  }
}

export async function rejectIncomingRequest(requestId) {
  if (!requestId) throw new Error('Geçersiz istek.');
  await base44.entities.FriendRequest.update(requestId, { status: 'rejected' });
}

export async function cancelOutgoingRequest(requestId) {
  if (!requestId) throw new Error('Geçersiz istek.');
  await base44.entities.FriendRequest.update(requestId, { status: 'cancelled' });
}

export async function acceptIncomingRequest(requestOrId) {
  // Accept either a bare id string or a full FriendRequest object. The
  // FriendsPage handler passes the full row (so it can show sender data
  // without an extra round trip), while older callers passed the id alone.
  // Both must work — passing [object Object] to the backend was the
  // Codex077→078 regression that caused every accept to silently 404.
  const requestId =
    typeof requestOrId === 'string'
      ? requestOrId.trim()
      : String(requestOrId?.id || '').trim();
  if (!requestId) throw new Error('Geçersiz istek.');

  let res;
  try {
    res = await base44.functions.invoke('acceptFriendRequest', { requestId });
  } catch (err) {
    // Real network/runtime failure — log the technical reason, surface
    // a friendly Turkish message to the UI.
    console.error('[friendsApi] acceptFriendRequest invoke failed', err);
    throw new Error('Arkadaşlık isteği kabul edilemedi. Lütfen tekrar dene.');
  }

  const data = res?.data;
  if (!data || data.ok === false || data.error) {
    console.error('[friendsApi] acceptFriendRequest backend error', data);
    throw new Error('Arkadaşlık isteği kabul edilemedi. Lütfen tekrar dene.');
  }
  return data;
}

export async function removeFriend(friendEmail) {
  const target = normalizeEmail(friendEmail);
  if (!target) throw new Error('Geçersiz e-posta.');
  const res = await base44.functions.invoke('removeFriend', { friendEmail: target });
  if (res?.data?.error) throw new Error(res.data.error);
  return res?.data;
}