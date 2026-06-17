import { base44 } from '@/api/base44Client';

const STORAGE_GUEST_ID_KEY = 'kronox.guestProfile.guest_id';
const STORAGE_GUEST_TOKEN_KEY = 'kronox.guestProfile.guest_token';
const STORAGE_GUEST_PUBLIC_KEY = 'kronox.guestProfile.public';
const USERNAME_PREFIX = 'KronoxUser';

export const GUEST_ONBOARDING_STATES = Object.freeze({
  GUEST_CREATED: 'guest_created',
  TUTORIAL_IN_PROGRESS: 'tutorial_in_progress',
  TUTORIAL_COMPLETED: 'tutorial_completed',
  PROFILE_SETUP_PENDING: 'profile_setup_pending',
  CATEGORY_SETUP_PENDING: 'category_setup_pending',
  ONBOARDING_COMPLETE: 'onboarding_complete',
});

const LEGACY_COMPLETE_STATES = new Set(['completed', GUEST_ONBOARDING_STATES.ONBOARDING_COMPLETE]);

function readLocalStorage(key) {
  try {
    return localStorage.getItem(key) || '';
  } catch {
    return '';
  }
}

function writeLocalStorage(key, value) {
  try {
    localStorage.setItem(key, String(value || ''));
  } catch {
    // Storage can be unavailable in private WebView modes; guest creation is
    // simply retried next boot rather than falling back to an unsafe local id.
  }
}

function removeLocalStorage(key) {
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore storage failures
  }
}

function normalizePublicProfile(profile) {
  if (!profile || typeof profile !== 'object') return null;
  const guestId = String(profile.guest_id || '').trim();
  const username = String(profile.username || '').trim();
  if (!guestId || !username) return null;
  const selectedCategoryIds = Array.isArray(profile.selected_category_ids)
    ? profile.selected_category_ids
        .map((value) => Number(value))
        .filter((value) => Number.isFinite(value) && value > 0)
    : [];
  return {
    guest_id: guestId,
    username,
    display_name: String(profile.display_name || username).trim() || username,
    status: String(profile.status || 'guest').trim() || 'guest',
    onboarding_status: String(profile.onboarding_status || GUEST_ONBOARDING_STATES.GUEST_CREATED).trim() || GUEST_ONBOARDING_STATES.GUEST_CREATED,
    tutorial_status: String(profile.tutorial_status || 'not_started').trim() || 'not_started',
    profile_setup_status: String(profile.profile_setup_status || 'pending').trim() || 'pending',
    category_setup_status: String(profile.category_setup_status || 'pending').trim() || 'pending',
    age: Number.isFinite(Number(profile.age)) ? Number(profile.age) : null,
    gender: String(profile.gender || '').trim(),
    selected_category_ids: selectedCategoryIds,
    created_at: profile.created_at || null,
    last_seen_at: profile.last_seen_at || null,
    tutorial_completed_at: profile.tutorial_completed_at || null,
    profile_setup_completed_at: profile.profile_setup_completed_at || null,
    category_setup_completed_at: profile.category_setup_completed_at || null,
    onboarding_completed_at: profile.onboarding_completed_at || null,
  };
}

function storeGuestSession(profile, rawToken) {
  const safeProfile = normalizePublicProfile(profile);
  if (!safeProfile) return null;
  writeLocalStorage(STORAGE_GUEST_ID_KEY, safeProfile.guest_id);
  if (rawToken) writeLocalStorage(STORAGE_GUEST_TOKEN_KEY, rawToken);
  writeLocalStorage(STORAGE_GUEST_PUBLIC_KEY, JSON.stringify(safeProfile));
  return safeProfile;
}

function clearGuestSession() {
  removeLocalStorage(STORAGE_GUEST_ID_KEY);
  removeLocalStorage(STORAGE_GUEST_TOKEN_KEY);
  removeLocalStorage(STORAGE_GUEST_PUBLIC_KEY);
}

export function getStoredGuestCredentials() {
  return {
    guest_id: readLocalStorage(STORAGE_GUEST_ID_KEY),
    guest_token: readLocalStorage(STORAGE_GUEST_TOKEN_KEY),
  };
}

export function getCachedGuestProfile() {
  try {
    return normalizePublicProfile(JSON.parse(readLocalStorage(STORAGE_GUEST_PUBLIC_KEY) || 'null'));
  } catch {
    return null;
  }
}

export function makeKronoxUserFallback(seed = '') {
  const text = String(seed || '').trim();
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const suffix = 1000 + ((hash >>> 0) % 90000);
  return `${USERNAME_PREFIX}${suffix}`;
}

async function invokeCreateGuestProfile(payload) {
  const response = await base44.functions.invoke('createGuestProfile', payload || {});
  const data = response?.data || response || {};
  if (data?.ok === false) {
    const error = new Error(data.error || 'guest_profile_failed');
    error.code = data.error || 'guest_profile_failed';
    throw error;
  }
  return data;
}

export async function ensureGuestProfile({ forceCreate = false } = {}) {
  const cached = getCachedGuestProfile();
  const credentials = getStoredGuestCredentials();
  const hasCredentials = Boolean(credentials.guest_id && credentials.guest_token);

  if (!forceCreate && hasCredentials) {
    try {
      const verified = await invokeCreateGuestProfile(credentials);
      return storeGuestSession(verified.profile, verified.guest_token) || cached;
    } catch (error) {
      if (error?.code !== 'invalid_guest_token' && error?.code !== 'guest_profile_not_found') {
        if (cached) return cached;
        throw error;
      }
      clearGuestSession();
    }
  }

  const created = await invokeCreateGuestProfile({});
  return storeGuestSession(created.profile, created.guest_token);
}

export function isGuestOnboardingComplete(profile) {
  const status = String(profile?.onboarding_status || '').trim();
  return LEGACY_COMPLETE_STATES.has(status);
}

export function getGuestOnboardingStep(profile) {
  const normalized = normalizePublicProfile(profile);
  if (!normalized) return GUEST_ONBOARDING_STATES.GUEST_CREATED;
  if (isGuestOnboardingComplete(normalized)) return GUEST_ONBOARDING_STATES.ONBOARDING_COMPLETE;
  const status = normalized.onboarding_status;
  if (Object.values(GUEST_ONBOARDING_STATES).includes(status)) return status;
  if (normalized.tutorial_status !== 'completed') return GUEST_ONBOARDING_STATES.GUEST_CREATED;
  if (normalized.profile_setup_status !== 'completed') return GUEST_ONBOARDING_STATES.PROFILE_SETUP_PENDING;
  if (normalized.category_setup_status !== 'completed') return GUEST_ONBOARDING_STATES.CATEGORY_SETUP_PENDING;
  return GUEST_ONBOARDING_STATES.ONBOARDING_COMPLETE;
}

export async function updateGuestProfileOnboarding(patch) {
  const credentials = getStoredGuestCredentials();
  if (!credentials.guest_id || !credentials.guest_token) {
    const error = new Error('guest_credentials_required');
    error.code = 'guest_credentials_required';
    throw error;
  }
  const updated = await invokeCreateGuestProfile({
    ...credentials,
    action: 'update_onboarding',
    patch: patch || {},
  });
  return storeGuestSession(updated.profile, updated.guest_token);
}

export const GUEST_PROFILE_IDENTITY_CONTRACT = Object.freeze({
  model: 'GuestProfile',
  firebaseUsed: false,
  base44AnonymousAuthUsed: false,
  rawGuestTokenStorage: 'client_local_device_only',
  serverStoredToken: 'guest_token_hash',
  defaultUsernamePrefix: USERNAME_PREFIX,
  accountLinkingLater: ['google', 'apple', 'email'],
  guidedFirstSoloLevelOnboarding: true,
  oldStandaloneTutorialDisabled: true,
});
