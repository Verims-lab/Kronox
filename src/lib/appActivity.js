import { base44 } from '@/api/base44Client';
import { getStoredGuestCredentials } from '@/lib/guestProfile';

const ACTIVITY_THROTTLE_KEY = 'kronox.appActivity.lastRecorded';
const ACTIVITY_THROTTLE_MS = 30 * 60 * 1000;

function readActivityThrottle() {
  try {
    return JSON.parse(localStorage.getItem(ACTIVITY_THROTTLE_KEY) || '{}') || {};
  } catch {
    return {};
  }
}

function writeActivityThrottle(value) {
  try {
    localStorage.setItem(ACTIVITY_THROTTLE_KEY, JSON.stringify(value || {}));
  } catch {
    // Activity tracking is best-effort and must never block app start.
  }
}

export function detectCoarsePlatform() {
  const nav = typeof navigator === 'undefined' ? null : navigator;
  const ua = String(nav?.userAgent || '').toLowerCase();
  const platform = String(nav?.platform || '').toLowerCase();
  const maxTouchPoints = Number(nav?.maxTouchPoints || 0);
  if (ua.includes('android')) return 'android';
  if (
    /iphone|ipad|ipod/.test(ua) ||
    /iphone|ipad|ipod/.test(platform) ||
    (platform === 'macintel' && maxTouchPoints > 1)
  ) {
    return 'ios';
  }
  return 'other';
}

function actorThrottleKey({ user, guestProfile }) {
  const email = String(user?.email || user?.user_email || '').trim().toLowerCase();
  if (email) return `u:${email}`;
  const guestId = String(guestProfile?.guest_id || '').trim();
  if (guestId) return `g:${guestId}`;
  return '';
}

function shouldSkipActivity(actorKey, now) {
  if (!actorKey) return true;
  const state = readActivityThrottle();
  const lastRecorded = Number(state[actorKey] || 0);
  return Number.isFinite(lastRecorded) && now - lastRecorded < ACTIVITY_THROTTLE_MS;
}

function markActivity(actorKey, now) {
  if (!actorKey) return;
  const state = readActivityThrottle();
  state[actorKey] = now;
  writeActivityThrottle(state);
}

async function callRecordAppOpen(payload) {
  try {
    return await base44.functions.invoke('recordAppOpen', payload);
  } catch (_invokeError) {
    const response = await base44.functions.fetch('/recordAppOpen', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return response.json().catch(() => ({}));
  }
}

export async function recordAppOpenActivity({ user, guestProfile } = {}) {
  const now = Date.now();
  const actorKey = actorThrottleKey({ user, guestProfile });
  if (shouldSkipActivity(actorKey, now)) return { skipped: true, reason: 'client_throttle' };

  const payload = {
    platform_class: detectCoarsePlatform(),
  };

  const email = String(user?.email || user?.user_email || '').trim();
  if (!email) {
    const credentials = getStoredGuestCredentials();
    const guestId = String(credentials?.guest_id || guestProfile?.guest_id || '').trim();
    const guestToken = String(credentials?.guest_token || '').trim();
    if (!guestId || !guestToken) return { skipped: true, reason: 'guest_credentials_missing' };
    payload.guest_id = guestId;
    payload.guest_token = guestToken;
  }

  const result = await callRecordAppOpen(payload);
  if (result?.ok !== false) markActivity(actorKey, now);
  return result;
}
