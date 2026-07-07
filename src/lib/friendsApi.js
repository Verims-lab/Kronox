// lib/friendsApi.js
// Thin client wrapper around Base44 Friends data. Kept tiny & dependency-free.
// Read/create paths use the standard entities SDK (RLS-gated). Mutating both
// sides of a relationship (accept / remove) goes through backend functions
// because RLS forbids the client from writing rows owned by another user.

import { base44 } from '@/api/base44Client';
import { getSafePublicUsernameLabel } from '@/lib/publicIdentity';
import { getPresenceLookupKeyForEmail } from '@/lib/presence';
import { normalizeSafePublicUsernameInput } from '@/lib/guestProfile';
import { pickPublicAvatarFields } from '@/lib/avatarOptions';
import { recordDailyQuestProgress } from '@/lib/dbGateway/dailyQuestGateway';

export const USERNAME_NOT_FOUND_MESSAGE = 'Kronox’ta bu kullanıcı adıyla biri yok.';
export const OPEN_INVITE_EXISTS_MESSAGE = 'Bu kişiye gönderilmiş açık davet var.';
export const EXPIRED_INVITE_REQUIRES_DELETE_MESSAGE = 'Bu kişiye süresi dolmuş bir davetin var. Yeniden davet göndermeden önce eski daveti silmelisin.';

export function normalizeEmail(raw) {
  return String(raw || '').trim().toLowerCase();
}

// Codex571 — Friends rate-limit safety. Raw backend/SDK errors (e.g. a
// literal "Rate limit exceeded" string) must never reach the UI. Every
// Friends mutation/read error is normalized into a safe, recoverable
// Turkish message before it can be shown.
const FRIENDS_RATE_LIMIT_MESSAGE = 'Çok hızlı işlem yapıldı. Lütfen biraz bekleyip tekrar dene.';
const FRIENDS_GENERIC_ERROR_MESSAGE = 'İşlem tamamlanamadı. Lütfen tekrar dene.';

export function getSafeFriendsErrorMessage(err) {
  const status = Number(err?.response?.status ?? err?.status ?? 0);
  const rawMessage = String(err?.response?.data?.error || err?.message || '').toLowerCase();
  if (status === 429 || rawMessage.includes('rate limit') || rawMessage.includes('too many requests')) {
    return FRIENDS_RATE_LIMIT_MESSAGE;
  }
  return FRIENDS_GENERIC_ERROR_MESSAGE;
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

function makeFriendRequestError(message, code) {
  const error = new Error(message || 'İstek gönderilemedi.');
  if (code) error.code = code;
  return error;
}

function parseFriendRequestTime(raw) {
  if (!raw) return NaN;
  if (raw instanceof Date) return raw.getTime();
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : NaN;
  const text = String(raw || '').trim();
  if (!text) return NaN;
  const normalized = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?$/.test(text)
    ? `${text}Z`
    : text;
  const parsed = Date.parse(normalized);
  return Number.isFinite(parsed) ? parsed : NaN;
}

export function isFriendRequestExpired(request, now = Date.now()) {
  if (String(request?.status || '').toLowerCase() === 'expired') return true;
  const expiresAt = parseFriendRequestTime(request?.expires_at || request?.expiresAt);
  return Number.isFinite(expiresAt) && expiresAt <= now;
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
      ...pickPublicAvatarFields(profile),
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
  return (rows || []).filter((row) => !isFriendRequestExpired(row));
}

export async function loadOutgoingRequests(myEmail) {
  const me = normalizeEmail(myEmail);
  if (!me) return [];
  const [pendingRows, expiredRows] = await Promise.all([
    base44.entities.FriendRequest.filter(
      { from_email: me, status: 'pending' },
      '-created_date',
      100,
    ),
    base44.entities.FriendRequest.filter(
      { from_email: me, status: 'expired' },
      '-created_date',
      100,
    ).catch(() => []),
  ]);
  const byId = new Map();
  [...(pendingRows || []), ...(expiredRows || [])].forEach((row) => {
    const key = row?.id || row?._id;
    if (key) byId.set(key, row);
  });
  return Array.from(byId.values()).sort((a, b) => (
    parseFriendRequestTime(b?.created_at || b?.created_date) - parseFriendRequestTime(a?.created_at || a?.created_date)
  ));
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
    if (data?.code === 'OPEN_INVITE_EXISTS') throw makeFriendRequestError(OPEN_INVITE_EXISTS_MESSAGE, data.code);
    if (data?.code === 'EXPIRED_INVITE_REQUIRES_DELETE') throw makeFriendRequestError(EXPIRED_INVITE_REQUIRES_DELETE_MESSAGE, data.code);
    if (data?.error) throw makeFriendRequestError(data.error, data.code);
    throw new Error(err?.message || 'İstek gönderilemedi.');
  }

  const data = res?.data || {};
  if (!data.ok || data.error) {
    if (data.code === 'username_not_found') throw new Error(USERNAME_NOT_FOUND_MESSAGE);
    if (data.code === 'OPEN_INVITE_EXISTS') throw makeFriendRequestError(OPEN_INVITE_EXISTS_MESSAGE, data.code);
    if (data.code === 'EXPIRED_INVITE_REQUIRES_DELETE') throw makeFriendRequestError(EXPIRED_INVITE_REQUIRES_DELETE_MESSAGE, data.code);
    throw makeFriendRequestError(data.error || 'İstek gönderilemedi.', data.code);
  }

  // Backward-compatible fallback for older deployed functions. The current
  // backend returns OPEN_INVITE_EXISTS as a typed error instead.
  const pendingOut = data.alreadyPending === true;
  if (pendingOut) {
    return {
      ...data,
      pendingOut: true,
      duplicatePending: true,
      message: OPEN_INVITE_EXISTS_MESSAGE,
    };
  }

  if (data.emailSent === false && data.emailError) {
    console.warn('[friendsApi] friend-request email not delivered:', data.emailError, 'marker=email_failed');
  }
  const requestId = String(data.requestId || data.request_id || data.friendRequestId || data.id || '').trim();
  if (requestId) {
    recordDailyQuestProgress({
      eventType: 'friend_invite_sent',
      mode: 'friends',
      amount: 1,
      eventId: requestId,
      requestId,
      metadata: {
        source: 'friendsApi.sendFriendRequest',
        inputKind: parsed.kind,
      },
    }).catch(() => null);
  }
  return data;
}

export async function rejectIncomingRequest(requestId) {
  if (!requestId) throw new Error('Geçersiz istek.');
  await base44.entities.FriendRequest.update(requestId, { status: 'rejected' });
}

export async function cancelOutgoingRequest(requestId) {
  if (!requestId) throw new Error('Geçersiz istek.');
  await base44.entities.FriendRequest.update(requestId, {
    status: 'cancelled',
    cancelled_at: new Date().toISOString(),
  });
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
  recordDailyQuestProgress({
    eventType: 'friend_added',
    mode: 'friends',
    amount: 1,
    eventId: requestId,
    requestId,
    metadata: {
      source: 'friendsApi.acceptIncomingRequest',
    },
  }).catch(() => null);
  return data;
}

export async function removeFriend(friendEmail) {
  const target = normalizeEmail(friendEmail);
  if (!target) throw new Error('Geçersiz e-posta.');
  let res;
  try {
    res = await base44.functions.invoke('removeFriend', { friendEmail: target });
  } catch (err) {
    // Codex571 — Never surface raw SDK/network errors (e.g. "Rate limit
    // exceeded") to the UI. Always throw a safe, recoverable Turkish message.
    throw new Error(getSafeFriendsErrorMessage(err));
  }
  if (res?.data?.error) throw new Error(getSafeFriendsErrorMessage({ message: res.data.error }));
  return res?.data;
}