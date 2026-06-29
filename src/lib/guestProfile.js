import { base44 } from '@/api/base44Client';

const STORAGE_GUEST_ID_KEY = 'kronox.guestProfile.guest_id';
const STORAGE_GUEST_TOKEN_KEY = 'kronox.guestProfile.guest_token';
const STORAGE_GUEST_PUBLIC_KEY = 'kronox.guestProfile.public';
const STORAGE_GUEST_LINK_INTENT_KEY = 'kronox.guestProfile.linkIntent';
const STORAGE_GUEST_INSTALL_ID_KEY = 'kronox.guestProfile.install_id';
const KRONOX_USER_ID_PATTERN = /^KX-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/;
const USERNAME_PREFIX = 'KronoxUser';
const UNSAFE_PUBLIC_USERNAME_PATTERN = /^(apple|google|firebase|auth0|base44|provider|uid|owner)(?:[\w:-].*)?$/i;
const INTERNAL_ID_PUBLIC_USERNAME_PATTERN = /^(guest|player|owner|user_key|player_key|g|u)_[A-Za-z0-9_-]{4,}$/i;

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
  const username = resolveSafePublicUsername(profile.username, guestId || profile.id || profile._id);
  if (!guestId || !username) return null;
  const selectedCategoryIds = Array.isArray(profile.selected_category_ids)
    ? profile.selected_category_ids
        .map((value) => Number(value))
        .filter((value) => Number.isFinite(value) && value > 0)
    : [];
  return {
    guest_id: guestId,
    kronox_user_id: normalizeKronoxUserId(profile.kronox_user_id),
    username,
    display_name: username,
    status: String(profile.status || 'guest').trim() || 'guest',
    onboarding_status: String(profile.onboarding_status || GUEST_ONBOARDING_STATES.GUEST_CREATED).trim() || GUEST_ONBOARDING_STATES.GUEST_CREATED,
    tutorial_status: String(profile.tutorial_status || 'not_started').trim() || 'not_started',
    profile_setup_status: String(profile.profile_setup_status || 'pending').trim() || 'pending',
    category_setup_status: String(profile.category_setup_status || 'pending').trim() || 'pending',
    age: Number.isFinite(Number(profile.age)) ? Number(profile.age) : null,
    age_group: String(profile.age_group || '').trim(),
    gender: String(profile.gender || '').trim(),
    selected_category_ids: selectedCategoryIds,
    created_at: profile.created_at || null,
    last_seen_at: profile.last_seen_at || null,
    tutorial_completed_at: profile.tutorial_completed_at || null,
    profile_setup_completed_at: profile.profile_setup_completed_at || null,
    profile_settings_updated_at: profile.profile_settings_updated_at || null,
    category_setup_completed_at: profile.category_setup_completed_at || null,
    onboarding_completed_at: profile.onboarding_completed_at || null,
    diamonds: Number.isFinite(Number(profile.diamonds)) ? Math.max(0, Math.floor(Number(profile.diamonds))) : 0,
    daily_wheel_last_spin_at: profile.daily_wheel_last_spin_at || null,
    daily_wheel_last_spin_date: profile.daily_wheel_last_spin_date || null,
    daily_wheel_next_available_at: profile.daily_wheel_next_available_at || null,
    daily_wheel_streak: Number.isFinite(Number(profile.daily_wheel_streak)) ? Math.max(0, Math.floor(Number(profile.daily_wheel_streak))) : 0,
    daily_wheel_spin_count: Number.isFinite(Number(profile.daily_wheel_spin_count)) ? Math.max(0, Math.floor(Number(profile.daily_wheel_spin_count))) : 0,
    daily_quest_last_claim_at: profile.daily_quest_last_claim_at || null,
    daily_quest_last_claim_date: profile.daily_quest_last_claim_date || null,
    daily_quest_next_available_at: profile.daily_quest_next_available_at || null,
    daily_quest_claim_count: Number.isFinite(Number(profile.daily_quest_claim_count)) ? Math.max(0, Math.floor(Number(profile.daily_quest_claim_count))) : 0,
  };
}

function normalizeKronoxUserId(value) {
  const text = String(value || '').trim().toUpperCase();
  return KRONOX_USER_ID_PATTERN.test(text) ? text : '';
}

function storeGuestSession(profile, rawToken) {
  const safeProfile = normalizePublicProfile(profile);
  if (!safeProfile) return null;
  writeLocalStorage(STORAGE_GUEST_ID_KEY, safeProfile.guest_id);
  if (rawToken) writeLocalStorage(STORAGE_GUEST_TOKEN_KEY, rawToken);
  writeLocalStorage(STORAGE_GUEST_PUBLIC_KEY, JSON.stringify(safeProfile));
  return safeProfile;
}

export function clearGuestSession() {
  removeLocalStorage(STORAGE_GUEST_ID_KEY);
  removeLocalStorage(STORAGE_GUEST_TOKEN_KEY);
  removeLocalStorage(STORAGE_GUEST_PUBLIC_KEY);
}

function normalizeLinkIntent(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const idempotencyKey = String(raw.idempotency_key || '').trim();
  if (!idempotencyKey) return null;
  return {
    idempotency_key: idempotencyKey,
    provider: String(raw.provider || '').trim(),
    created_at: raw.created_at || null,
  };
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

export function getPendingGuestAccountLinkIntent() {
  try {
    return normalizeLinkIntent(JSON.parse(readLocalStorage(STORAGE_GUEST_LINK_INTENT_KEY) || 'null'));
  } catch {
    return null;
  }
}

export function clearPendingGuestAccountLinkIntent() {
  removeLocalStorage(STORAGE_GUEST_LINK_INTENT_KEY);
}

export function setPendingGuestAccountLinkIntent(provider = 'email') {
  const credentials = getStoredGuestCredentials();
  if (!credentials.guest_id || !credentials.guest_token) return null;
  const intent = {
    provider: String(provider || 'email').trim(),
    idempotency_key: `account_link_merge_${credentials.guest_id}_${Date.now()}`,
    created_at: new Date().toISOString(),
  };
  writeLocalStorage(STORAGE_GUEST_LINK_INTENT_KEY, JSON.stringify(intent));
  return intent;
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

export function isSafePublicUsername(value) {
  const explicitName = String(value || '').replace(/\s+/g, ' ').trim();
  return Boolean(
    explicitName &&
    /^[A-Za-z0-9_]{3,24}$/.test(explicitName) &&
    !explicitName.includes('@') &&
    !UNSAFE_PUBLIC_USERNAME_PATTERN.test(explicitName) &&
    !INTERNAL_ID_PUBLIC_USERNAME_PATTERN.test(explicitName),
  );
}

export function normalizeSafePublicUsernameInput(value) {
  const explicitName = String(value || '').replace(/\s+/g, ' ').trim();
  return isSafePublicUsername(explicitName) ? explicitName : '';
}

export function resolveSafePublicUsername(explicitName, fallbackSeed = '') {
  return normalizeSafePublicUsernameInput(explicitName) || makeKronoxUserFallback(fallbackSeed);
}

function makeClientInstallId() {
  try {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    const encoded = btoa(String.fromCharCode(...bytes))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/g, '');
    return `install_${encoded}`;
  } catch {
    return `install_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`;
  }
}

function getOrCreateClientInstallId() {
  const existing = readLocalStorage(STORAGE_GUEST_INSTALL_ID_KEY);
  if (/^install_[A-Za-z0-9_-]{12,80}$/.test(existing)) return existing;
  const created = makeClientInstallId();
  writeLocalStorage(STORAGE_GUEST_INSTALL_ID_KEY, created);
  return created;
}

async function invokeCreateGuestProfile(payload) {
  let response;
  try {
    response = await base44.functions.invoke('createGuestProfile', {
      client_install_id: getOrCreateClientInstallId(),
      ...(payload || {}),
    });
  } catch (invokeError) {
    // Non-2xx responses (e.g. 409 username_taken) reject the invoke call.
    // Recover the structured error code from the response body so callers
    // can show precise inline errors instead of a generic failure box.
    const data = invokeError?.response?.data || invokeError?.data || {};
    const code = data?.error || invokeError?.code || 'guest_profile_failed';
    const error = new Error(code);
    error.code = code;
    throw error;
  }
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
  const normalized = normalizePublicProfile(profile);
  if (!normalized) return false;
  const status = String(normalized.onboarding_status || '').trim();
  if (LEGACY_COMPLETE_STATES.has(status)) return true;
  const profileStatus = String(normalized.profile_setup_status || '').trim();
  const categoryStatus = String(normalized.category_setup_status || '').trim();
  const profileCompleted = profileStatus === 'completed' || Boolean(normalized.profile_setup_completed_at);
  const categoryCompleted = categoryStatus === 'completed' ||
    Boolean(normalized.category_setup_completed_at || normalized.onboarding_completed_at);
  return Boolean(profileCompleted && categoryCompleted);
}

export function getCompletedGuestCredentialsPayload(profile) {
  if (!isGuestOnboardingComplete(profile)) return null;
  const credentials = getStoredGuestCredentials();
  if (!credentials.guest_id || !credentials.guest_token) return null;
  return {
    player_type: 'guest',
    guest_id: credentials.guest_id,
    guest_token: credentials.guest_token,
  };
}

export function getGuestOnboardingCompletionRepairPatch(profile) {
  const normalized = normalizePublicProfile(profile);
  if (!normalized) return null;
  const status = String(normalized.onboarding_status || '').trim();
  const profileStatus = String(normalized.profile_setup_status || '').trim();
  const categoryStatus = String(normalized.category_setup_status || '').trim();
  const profileCompleted = profileStatus === 'completed' || Boolean(normalized.profile_setup_completed_at);
  const categoryCompleted = categoryStatus === 'completed' ||
    Boolean(normalized.category_setup_completed_at || normalized.onboarding_completed_at);
  const statusComplete = LEGACY_COMPLETE_STATES.has(status);

  if (profileCompleted && categoryCompleted && status !== GUEST_ONBOARDING_STATES.ONBOARDING_COMPLETE) {
    return {
      tutorial_status: 'completed',
      profile_setup_status: 'completed',
      category_setup_status: 'completed',
      onboarding_status: GUEST_ONBOARDING_STATES.ONBOARDING_COMPLETE,
    };
  }

  if (statusComplete && profileCompleted && categoryStatus !== 'completed') {
    return {
      tutorial_status: 'completed',
      profile_setup_status: 'completed',
      category_setup_status: 'completed',
      onboarding_status: GUEST_ONBOARDING_STATES.ONBOARDING_COMPLETE,
    };
  }

  return null;
}

export function getGuestOnboardingStep(profile) {
  const normalized = normalizePublicProfile(profile);
  if (!normalized) return GUEST_ONBOARDING_STATES.GUEST_CREATED;
  if (isGuestOnboardingComplete(normalized)) return GUEST_ONBOARDING_STATES.ONBOARDING_COMPLETE;
  const status = normalized.onboarding_status;
  const tutorialStatus = String(normalized.tutorial_status || '').trim();
  const profileStatus = String(normalized.profile_setup_status || '').trim();
  const categoryStatus = String(normalized.category_setup_status || '').trim();
  const tutorialCompleted = Boolean(normalized.tutorial_completed_at);
  const profileCompleted = Boolean(normalized.profile_setup_completed_at);
  const categoryCompleted = Boolean(normalized.category_setup_completed_at || normalized.onboarding_completed_at);

  // Onboarding is monotonic: later setup flags win over a stale
  // onboarding_status so users cannot regress back to "Eğitime Devam".
  if (categoryStatus === 'completed' || categoryCompleted) return GUEST_ONBOARDING_STATES.ONBOARDING_COMPLETE;
  if (profileStatus === 'completed' || profileCompleted || status === GUEST_ONBOARDING_STATES.CATEGORY_SETUP_PENDING) {
    return GUEST_ONBOARDING_STATES.CATEGORY_SETUP_PENDING;
  }
  if (
    tutorialStatus === 'completed' ||
    tutorialCompleted ||
    status === GUEST_ONBOARDING_STATES.TUTORIAL_COMPLETED ||
    status === GUEST_ONBOARDING_STATES.PROFILE_SETUP_PENDING
  ) {
    return GUEST_ONBOARDING_STATES.PROFILE_SETUP_PENDING;
  }
  if (status === GUEST_ONBOARDING_STATES.TUTORIAL_IN_PROGRESS && tutorialStatus === 'in_progress') {
    return GUEST_ONBOARDING_STATES.TUTORIAL_IN_PROGRESS;
  }
  if (status === GUEST_ONBOARDING_STATES.GUEST_CREATED) return GUEST_ONBOARDING_STATES.GUEST_CREATED;
  return GUEST_ONBOARDING_STATES.GUEST_CREATED;
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

export async function repairGuestOnboardingCompletionIfNeeded(profile) {
  const patch = getGuestOnboardingCompletionRepairPatch(profile);
  if (!patch) return profile || null;
  return updateGuestProfileOnboarding(patch);
}

export async function syncGuestProfileProgress({ soloProgress = null, onlineProgress = null } = {}) {
  const credentials = getStoredGuestCredentials();
  if (!credentials.guest_id || !credentials.guest_token) return null;
  const patch = {};
  if (soloProgress && typeof soloProgress === 'object') patch.solo_progress = soloProgress;
  if (onlineProgress && typeof onlineProgress === 'object') patch.online_progress = onlineProgress;
  if (Object.keys(patch).length === 0) return null;
  const updated = await invokeCreateGuestProfile({
    ...credentials,
    action: 'sync_progress',
    patch,
  });
  return storeGuestSession(updated.profile, updated.guest_token);
}

export async function prepareGuestAccountLink({ provider = 'email', soloProgress = null, onlineProgress = null } = {}) {
  const intent = setPendingGuestAccountLinkIntent(provider);
  if (!intent) return null;
  await syncGuestProfileProgress({ soloProgress, onlineProgress }).catch(() => null);
  return intent;
}

export async function linkPendingGuestAccount({ soloProgress = null, onlineProgress = null } = {}) {
  const credentials = getStoredGuestCredentials();
  const intent = getPendingGuestAccountLinkIntent();
  if (!credentials.guest_id || !credentials.guest_token || !intent?.idempotency_key) return null;

  await syncGuestProfileProgress({ soloProgress, onlineProgress }).catch(() => null);
  const response = await base44.functions.invoke('linkGuestAccount', {
    ...credentials,
    idempotency_key: intent.idempotency_key,
  });
  const data = response?.data || response || {};
  if (data?.ok === false) {
    const error = new Error(data.code || data.error || 'account_link_failed');
    error.code = data.code || data.error || 'account_link_failed';
    throw error;
  }
  clearPendingGuestAccountLinkIntent();
  clearGuestSession();
  return data;
}

export const GUEST_PROFILE_IDENTITY_CONTRACT = Object.freeze({
  model: 'GuestProfile',
  firebaseUsed: false,
  base44AnonymousAuthUsed: false,
  rawGuestTokenStorage: 'client_local_device_only',
  serverStoredToken: 'guest_token_hash',
  defaultUsernamePrefix: USERNAME_PREFIX,
  accountLinkingLater: ['google', 'apple', 'email'],
  accountLinkingPhase3: true,
  linkFunction: 'linkGuestAccount',
  mergeTransactionEntity: 'AccountLinkTransaction',
  mergeIdempotent: true,
  guestStatusLinkedOnce: true,
  guidedFirstSoloLevelOnboarding: true,
  oldStandaloneTutorialDisabled: true,
});
