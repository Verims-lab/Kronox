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

export async function acceptIncomingRequest(requestId) {
  if (!requestId) throw new Error('Geçersiz istek.');
  // base44.functions.invoke uses axios under the hood and REJECTS the promise
  // on any non-2xx status — so `res.data.error` is unreachable for real
  // failures (the old code only handled the impossible "200 with error
  // field" case and let real 500s bubble up as raw "Request failed with
  // status code 500"). We catch axios-style errors, extract the structured
  // backend error message if present, and re-throw a clean Turkish message.
  try {
    const res = await base44.functions.invoke('acceptFriendRequest', { requestId });
    if (res?.data?.error) throw new Error(res.data.error);
    return res?.data;
  } catch (err) {
    const backendMsg = err?.response?.data?.error;
    if (backendMsg) throw new Error(backendMsg);
    // Fallback only when backend gave us nothing useful — never expose raw
    // "Request failed with status code 500" to the user.
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