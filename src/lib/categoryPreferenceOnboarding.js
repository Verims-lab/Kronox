import { base44 } from '@/api/base44Client';

// Rollout cutoff prevents the new popup from treating every existing account
// with empty preferences as incomplete onboarding.
export const CATEGORY_PREFERENCE_ONBOARDING_ROLLOUT_AT = '2026-06-07T13:17:33.000Z';
export const CATEGORY_PREFERENCE_ONBOARDING_COMPLETED_FIELD = 'category_preferences_onboarding_completed';
export const CATEGORY_PREFERENCE_ONBOARDING_COMPLETED_AT_FIELD = 'category_preferences_onboarding_completed_at';
export const CATEGORY_PREFERENCE_ONBOARDING_REQUIRED_FIELD = 'category_preferences_onboarding_required';

function safeTime(value) {
  const time = Date.parse(String(value || ''));
  return Number.isFinite(time) ? time : null;
}

export function getCategoryPreferenceOnboardingCreatedAt(user) {
  return user?.created_at
    || user?.created_date
    || user?.createdAt
    || user?.createdDate
    || '';
}

export function hasCompletedCategoryPreferenceOnboarding(user) {
  return user?.[CATEGORY_PREFERENCE_ONBOARDING_COMPLETED_FIELD] === true
    || user?.categoryPreferenceOnboardingCompleted === true;
}

export function isNewUserForCategoryPreferenceOnboarding(user, rolloutAt = CATEGORY_PREFERENCE_ONBOARDING_ROLLOUT_AT) {
  const createdAt = safeTime(getCategoryPreferenceOnboardingCreatedAt(user));
  const rolloutTime = safeTime(rolloutAt);
  if (!createdAt || !rolloutTime) return false;
  return createdAt >= rolloutTime;
}

export function shouldShowCategoryPreferenceOnboarding(user, options = {}) {
  if (!user?.email) return false;
  if (hasCompletedCategoryPreferenceOnboarding(user)) return false;
  if (user?.[CATEGORY_PREFERENCE_ONBOARDING_REQUIRED_FIELD] === true) return true;
  return isNewUserForCategoryPreferenceOnboarding(
    user,
    options.rolloutAt || CATEGORY_PREFERENCE_ONBOARDING_ROLLOUT_AT,
  );
}

export async function markCategoryPreferenceOnboardingCompleted(user) {
  if (!user?.email) return user || null;
  const now = new Date().toISOString();
  const payload = {
    [CATEGORY_PREFERENCE_ONBOARDING_COMPLETED_FIELD]: true,
    [CATEGORY_PREFERENCE_ONBOARDING_COMPLETED_AT_FIELD]: now,
    category_preferences_onboarding_rollout_at: CATEGORY_PREFERENCE_ONBOARDING_ROLLOUT_AT,
  };
  const updated = await base44.auth.updateMe(payload);
  return {
    ...(user || {}),
    ...(updated || {}),
    ...payload,
  };
}
