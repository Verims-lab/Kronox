// lib/friendsApi.js
// Thin client wrapper around Base44 Friends data. Kept tiny & dependency-free.
// Read/create paths use the standard entities SDK (RLS-gated). Mutating both
// sides of a relationship (accept / remove) goes through backend functions
// because RLS forbids the client from writing rows owned by another user.

import { base44 } from '@/api/base44Client';
import { getSafePublicUsernameLabel } from '@/lib/publicIdentity';
import { getPresenceLookupKeyForEmail } from '@/lib/presence';
import { normalizeSafePublicUsernameInput } from '@/lib/guestProfile';

export const USERNAME_NOT_FOUND_MESSAGE = 'Kronox’ta bu kullanıcı adıyla biri yok.';

export function normalizeEmail(raw) {
  return String(raw || '').trim().toLowerCase();
}

export function isValidEmail(raw) {
  const email = normalizeEmail(raw);
  // Minimal, safe RFC-ish check — good enough for client-side gating.
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function normalizeFriendUsername(raw) {
  return normalizeSafePublicUsernameInput(raw);
}

export function parseFriendRequestTarget(raw) {
  const value = String(raw || '').trim();
  if (!value) return { kind: 'empty', value: '', error: 'E-posta veya kullanıcı adı gir.' };
  if (value.includes('@')) {
    const email = normalizeEmail(value);
    return isValidEmail(email)
      ? { kind: 'email', value: email, error: '' }
      : { kind: 'email', value: email, error: 'Geçerli bir e-posta adresi gir.' };
  }
  const username = normalizeFriendUsername(value);
  return username
    ? { kind: 'username', value: username, error: '' }
    : { kind: 'username', value, error: 'Geçerli bir kullanıcı adı gir.' };
}

async function loadUserPublicProfileByEmail(email) {
  const normalized = normalizeEmail(email);
  if (!normalized) return null;
  try {
    const rows = await base44.entities.User.filter({ email: normalized }, '-updated_date', 1);
    return rows?.[0] || null;
  } catch {
    return null;
  }
}

async function attachSafeFriendIdentity(rows) {
  const uniqueEmails = Array.from(new Set(rows.map((row) => normalizeEmail(row.friend_email)).filter(Boolean)));
  const profiles = await Promise.all(uniqueEmails.map(async (email) => [email, await loadUserPublicProfileByEmail(email)]));
  const profileByEmail = Object.fromEntries(profiles);
  return rows.map((row) => {
    const friendEmail = normalizeEmail(row.friend_email);
    const profile = profileByEmail[friendEmail] || null;
    const friendUsername = getSafePublicUsernameLabel(
      [
        profile?.username,
        profile?.public_username,
        row.friend_name,
      ],
      friendEmail || row.id,
    );
    return {
      ...row,
      friend_email: friendEmail,
      friend_username: friendUsername,
      friend_name: friendUsername,
      presence_key: getPresenceLookupKeyForEmail(friendEmail),
    };
  });
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
  const deduped = projected.filter((row) => {
    if (seen.has(row.friend_email)) return false;
    seen.add(row.friend_email);
    return true;
  });
  return attachSafeFriendIdentity(deduped);
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

export async function sendFriendRequest({ me = null, target = '', toEmail = '' } = {}) {
  const fromEmail = normalizeEmail(me?.email);
  const parsed = parseFriendRequestTarget(target ?? toEmail);

  if (!fromEmail) throw new Error('Önce giriş yapmalısın.');
  if (parsed.error) throw new Error(parsed.error);

  let res;
  try {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    res = await base44.functions.invoke('sendFriendRequest', {
      target: parsed.value,
      inputKind: parsed.kind,
      appUrl: origin,
    });
  } catch (err) {
    const data = err?.response?.data || err?.data || {};
    if (data?.code === 'username_not_found') throw new Error(USERNAME_NOT_FOUND_MESSAGE);
    if (data?.error) throw new Error(data.error);
    throw new Error(err?.message || 'İstek gönderilemedi.');
  }

  const data = res?.data || {};
  if (!data.ok || data.error) {
    if (data.code === 'username_not_found') throw new Error(USERNAME_NOT_FOUND_MESSAGE);
    throw new Error(data.error || 'İstek gönderilemedi.');
  }

  // Duplicate pending outgoing request is handled idempotently: the backend
  // already filters its outgoing pendingOut row and returns alreadyPending
  // instead of creating a second FriendRequest. We surface a stable
  // user-facing message and a normalized pendingOut flag, never the target
  // email when the request was made by username.
  const pendingOut = data.alreadyPending === true;
  if (pendingOut) {
    return {
      ...data,
      pendingOut: true,
      duplicatePending: true,
      message: 'Bu kişiye zaten bekleyen bir isteğin var.',
    };
  }

  if (data.emailSent === false && data.emailError) {
    console.warn('[friendsApi] friend-request email not delivered:', data.emailError, 'marker=email_failed');
  }
  return data;
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