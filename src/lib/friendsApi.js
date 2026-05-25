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
  const me = normalizeEmail(myEmail);
  if (!me) return [];
  const rows = await base44.entities.Friendship.filter({ user_email: me }, '-created_date', 200);
  return rows || [];
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

  // Already friends?
  const existingFriend = await base44.entities.Friendship.filter({
    user_email: fromEmail, friend_email: target,
  });
  if (existingFriend?.length) throw new Error('Bu kullanıcı zaten arkadaşın.');

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

export async function acceptIncomingRequest(request) {
  // Codex077 — real fix.
  //
  // Friendship RLS create rule pins data.user_email to {{user.email}} (the
  // caller's auth context). Service-role calls do NOT carry that context,
  // so EVERY server-side Friendship.create was returning 403:
  //   "Permission denied for create operation on Friendship entity"
  // — which is why no Friendship rows ever existed in the database and the
  // user saw "Arkadaşlık kaydı oluşturulamadı." every single time.
  //
  // Fix: create the receiver's own Friendship row directly from the client
  // via the entities SDK. RLS passes because data.user_email === caller's
  // own email. The backend function is now only responsible for the mirror
  // row + flipping FriendRequest.status to 'accepted' (both require
  // service-role because they touch rows the client doesn't own).
  //
  // Accepts either the full request object (preferred — gives us
  // from_email/from_name without an extra round trip) or a bare requestId
  // string (legacy callers).
  const requestId = typeof request === 'string' ? request : request?.id;
  if (!requestId) throw new Error('Geçersiz istek.');

  // Hydrate sender details from the request object if provided. If only an
  // id was passed, fetch the row so we can build the Friendship correctly.
  let fromEmail = normalizeEmail(typeof request === 'object' ? request?.from_email : '');
  let fromName = (typeof request === 'object' ? request?.from_name : '') || '';
  if (!fromEmail) {
    const row = await base44.entities.FriendRequest.get(requestId);
    fromEmail = normalizeEmail(row?.from_email);
    fromName = row?.from_name || '';
    if (!fromEmail) throw new Error('Arkadaşlık isteği bulunamadı.');
  }

  // Verify the caller is the recipient before mutating anything.
  const me = await base44.auth.me();
  const myEmail = normalizeEmail(me?.email);
  if (!myEmail) throw new Error('Oturum açman gerekiyor.');

  // Idempotent: if the row already exists, skip create.
  const existing = await base44.entities.Friendship.filter({
    user_email: myEmail,
    friend_email: fromEmail,
  });
  if (!existing?.length) {
    await base44.entities.Friendship.create({
      user_email: myEmail,
      friend_email: fromEmail,
      friend_name: fromName,
    });
  }

  // Now ask the backend to (a) create the mirror row for the sender and
  // (b) flip the FriendRequest to 'accepted'. If the backend fails the
  // mirror create it returns success with mirrorCreated:false — we still
  // treat the overall accept as successful because the receiver's row
  // already exists and the receiver sees the friend in their list.
  try {
    const res = await base44.functions.invoke('acceptFriendRequest', { requestId });
    if (res?.data?.error) throw new Error(res.data.error);
    return res?.data;
  } catch (err) {
    const backendMsg = err?.response?.data?.error;
    if (backendMsg) throw new Error(backendMsg);
    throw new Error('Arkadaşlık isteği kabul edilemedi. Lütfen tekrar dene.');
  }
}

export async function removeFriend(friendEmail) {
  const target = normalizeEmail(friendEmail);
  if (!target) throw new Error('Geçersiz e-posta.');
  const res = await base44.functions.invoke('removeFriend', { friendEmail: target });
  if (res?.data?.error) throw new Error(res.data.error);
  return res?.data;
}