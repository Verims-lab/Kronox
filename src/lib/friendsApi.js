// lib/friendsApi.js
// Thin client wrapper around Base44 Friends data. Kept tiny & dependency-free.
// Read/create paths use the standard entities SDK (RLS-gated). Mutating both
// sides of a relationship (accept / remove) goes through backend functions
// because RLS forbids the client from writing rows owned by another user.

import { base44 } from '@/api/base44Client';
import { normalizeSafePublicUsernameInput } from '@/lib/guestProfile';
import { recordDailyQuestSourceEvent } from '@/lib/dailyQuestEvents';
import { loadSocialSnapshot } from '@/lib/onlinePlayerSelection';

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

let socialSnapshotPromise = null;

export function invalidateFriendsSnapshot() {
  socialSnapshotPromise = null;
}

async function getFriendsSnapshot() {
  if (!socialSnapshotPromise) {
    socialSnapshotPromise = loadSocialSnapshot().finally(() => {
      window.setTimeout(() => { socialSnapshotPromise = null; }, 500);
    });
  }
  return socialSnapshotPromise;
}

export async function loadFriends(myEmail) {
  if (!normalizeEmail(myEmail)) return [];
  const snapshot = await getFriendsSnapshot();
  return Array.isArray(snapshot?.friends) ? snapshot.friends : [];
}

export async function loadIncomingRequests(myEmail) {
  if (!normalizeEmail(myEmail)) return [];
  const snapshot = await getFriendsSnapshot();
  return (Array.isArray(snapshot?.incomingFriendRequests) ? snapshot.incomingFriendRequests : [])
    .filter((row) => !isFriendRequestExpired(row));
}

export async function loadOutgoingRequests(myEmail) {
  if (!normalizeEmail(myEmail)) return [];
  const snapshot = await getFriendsSnapshot();
  return [...(Array.isArray(snapshot?.outgoingFriendRequests) ? snapshot.outgoingFriendRequests : [])]
    .sort((a, b) => parseFriendRequestTime(b?.created_at) - parseFriendRequestTime(a?.created_at));
}

export async function loadFriendsPageSnapshot(myEmail) {
  if (!normalizeEmail(myEmail)) return { friends: [], incoming: [], outgoing: [] };
  invalidateFriendsSnapshot();
  const snapshot = await getFriendsSnapshot();
  return {
    friends: Array.isArray(snapshot?.friends) ? snapshot.friends : [],
    incoming: (Array.isArray(snapshot?.incomingFriendRequests) ? snapshot.incomingFriendRequests : [])
      .filter((row) => !isFriendRequestExpired(row)),
    outgoing: Array.isArray(snapshot?.outgoingFriendRequests) ? snapshot.outgoingFriendRequests : [],
  };
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
  invalidateFriendsSnapshot();
  const requestId = String(data.requestId || data.request_id || data.friendRequestId || data.id || '').trim();
  if (requestId) {
    await recordDailyQuestSourceEvent({
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
  await base44.functions.invoke('acceptFriendRequest', { requestRef: requestId, action: 'reject' });
  invalidateFriendsSnapshot();
}

export async function cancelOutgoingRequest(requestId) {
  if (!requestId) throw new Error('Geçersiz istek.');
  await base44.functions.invoke('acceptFriendRequest', { requestRef: requestId, action: 'cancel' });
  invalidateFriendsSnapshot();
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
      : String(requestOrId?.request_ref || requestOrId?.id || '').trim();
  if (!requestId) throw new Error('Geçersiz istek.');

  let res;
  try {
    res = await base44.functions.invoke('acceptFriendRequest', { requestRef: requestId, action: 'accept' });
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
  await recordDailyQuestSourceEvent({
    eventType: 'friend_added',
    mode: 'friends',
    amount: 1,
    eventId: requestId,
    requestId,
    metadata: {
      source: 'friendsApi.acceptIncomingRequest',
    },
  }).catch(() => null);
  invalidateFriendsSnapshot();
  return data;
}

export async function removeFriend(targetRef) {
  const target = String(targetRef || '').trim();
  if (!target) throw new Error('Geçersiz arkadaş.');
  let res;
  try {
    res = await base44.functions.invoke('removeFriend', { targetRef: target });
  } catch (err) {
    // Codex571 — Never surface raw SDK/network errors (e.g. "Rate limit
    // exceeded") to the UI. Always throw a safe, recoverable Turkish message.
    throw new Error(getSafeFriendsErrorMessage(err));
  }
  if (res?.data?.error) throw new Error(getSafeFriendsErrorMessage({ message: res.data.error }));
  invalidateFriendsSnapshot();
  return res?.data;
}
