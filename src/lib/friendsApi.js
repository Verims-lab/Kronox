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
  const [acceptedOut, acceptedIn] = await Promise.all([
    base44.entities.FriendRequest.filter({ from_email: fromEmail, to_email: target, status: 'accepted' }),
    base44.entities.FriendRequest.filter({ from_email: target, to_email: fromEmail, status: 'accepted' }),
  ]);
  if (acceptedOut?.length || acceptedIn?.length) throw new Error('Bu kullanıcı zaten arkadaşın.');

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

  await base44.entities.FriendRequest.create({
    from_email: fromEmail,
    from_name: me?.full_name || '',
    to_email: target,
    status: 'pending',
  });
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
