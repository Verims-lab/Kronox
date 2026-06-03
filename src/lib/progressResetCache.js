const SOLO_PROGRESS_STORAGE_KEY = 'kx_solo_progress_v1';
const PROGRESS_RESET_SEEN_PREFIX = 'kx_progress_reset_seen_v1';

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

export function getProgressResetOwnerKey(userOrEmail) {
  const email = normalizeEmail(
    typeof userOrEmail === 'string' ? userOrEmail : userOrEmail?.email,
  );
  if (!email) return '';

  let hash = 2166136261;
  for (let i = 0; i < email.length; i += 1) {
    hash ^= email.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `u_${(hash >>> 0).toString(36)}`;
}

function parseTime(value) {
  const time = Date.parse(String(value || ''));
  return Number.isFinite(time) ? time : 0;
}

export function isSavedBeforeProgressReset(savedAt, progressResetAt) {
  const resetTime = parseTime(progressResetAt);
  if (!resetTime) return false;
  const savedTime = parseTime(savedAt);
  if (!savedTime) return true;
  return savedTime < resetTime;
}

function readStorageJson(storage, key) {
  try {
    const raw = storage?.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

function removeIfMatchingLegacySoloMirror(storage, ownerKey) {
  if (!storage || !ownerKey) return;
  const parsed = readStorageJson(storage, SOLO_PROGRESS_STORAGE_KEY);
  const mirrorOwner = String(parsed?.ownerKey || parsed?.__ownerKey || '').trim();
  if (mirrorOwner === ownerKey) {
    try {
      storage.removeItem(SOLO_PROGRESS_STORAGE_KEY);
    } catch {
      /* storage unavailable */
    }
  }
}

export function clearUserProgressLocalCaches(userOrEmail) {
  if (typeof window === 'undefined') return;

  const ownerKey = getProgressResetOwnerKey(userOrEmail);
  if (!ownerKey) return;

  try {
    window.localStorage.removeItem(`${SOLO_PROGRESS_STORAGE_KEY}:${ownerKey}`);
    removeIfMatchingLegacySoloMirror(window.localStorage, ownerKey);
  } catch {
    /* localStorage may be unavailable in private mode */
  }
}

export function applyUserProgressResetMarker(user) {
  if (typeof window === 'undefined' || !user?.email || !user?.progress_reset_at) return false;

  const ownerKey = getProgressResetOwnerKey(user);
  if (!ownerKey) return false;

  const seenKey = `${PROGRESS_RESET_SEEN_PREFIX}:${ownerKey}`;
  const marker = String(user.progress_reset_at || '');
  let previous = '';

  try {
    previous = window.localStorage.getItem(seenKey) || '';
  } catch {
    previous = '';
  }

  if (previous === marker) return false;

  clearUserProgressLocalCaches(user);
  try {
    window.localStorage.setItem(seenKey, marker);
  } catch {
    /* storage unavailable */
  }
  return true;
}
