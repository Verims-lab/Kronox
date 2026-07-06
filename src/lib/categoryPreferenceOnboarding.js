import { base44 } from '@/api/base44Client';
import {
  MIN_CATEGORY_SELECTION_COUNT,
  getValidActiveSelectedCategoryIds,
  isActiveCategory,
} from '@/lib/userCategoryPreferences';

export const CATEGORY_PREFERENCE_ONBOARDING_COMPLETED_FIELD = 'category_preferences_onboarding_completed';
export const CATEGORY_PREFERENCE_ONBOARDING_COMPLETED_AT_FIELD = 'category_preferences_onboarding_completed_at';
export const CATEGORY_PREFERENCE_ONBOARDING_DEFERRED_FIELD = 'category_preferences_onboarding_deferred';
export const CATEGORY_PREFERENCE_ONBOARDING_DEFERRED_AT_FIELD = 'category_preferences_onboarding_deferred_at';

export function hasCompletedCategoryPreferenceOnboarding(user) {
  return user?.[CATEGORY_PREFERENCE_ONBOARDING_COMPLETED_FIELD] === true
    || user?.categoryPreferenceOnboardingCompleted === true;
}

export function hasDeferredCategoryPreferenceOnboarding(user) {
  return user?.[CATEGORY_PREFERENCE_ONBOARDING_DEFERRED_FIELD] === true
    || user?.categoryPreferenceOnboardingDeferred === true;
}

export function getValidCategoryPreferenceCount(preferences, activeCategories) {
  return getValidActiveSelectedCategoryIds(preferences, activeCategories).size;
}

export function shouldShowCategoryPreferenceOnboarding({
  user,
  preferences,
  activeCategories,
  categoriesLoaded,
  categoriesLoadError = false,
} = {}) {
  if (categoriesLoadError || hasDeferredCategoryPreferenceOnboarding(user)) return false;
  const categoryRows = Array.isArray(activeCategories) ? activeCategories : [];
  const hasLoadedCategories = categoriesLoaded ?? Array.isArray(activeCategories);
  const activeCategoryCount = categoryRows.filter(isActiveCategory).length;
  if (!hasLoadedCategories || activeCategoryCount < MIN_CATEGORY_SELECTION_COUNT) return false;
  return getValidCategoryPreferenceCount(preferences, activeCategories) < MIN_CATEGORY_SELECTION_COUNT;
}

export async function markCategoryPreferenceOnboardingCompleted(user) {
  if (!user?.email) return user || null;
  const now = new Date().toISOString();
  const payload = {
    [CATEGORY_PREFERENCE_ONBOARDING_COMPLETED_FIELD]: true,
    [CATEGORY_PREFERENCE_ONBOARDING_COMPLETED_AT_FIELD]: now,
  };
  const updated = await base44.auth.updateMe(payload);
  return {
    ...(user || {}),
    ...(updated || {}),
    ...payload,
  };
}

export async function markCategoryPreferenceOnboardingDeferred(user) {
  if (!user?.email) return user || null;
  const now = new Date().toISOString();
  const payload = {
    [CATEGORY_PREFERENCE_ONBOARDING_DEFERRED_FIELD]: true,
    [CATEGORY_PREFERENCE_ONBOARDING_DEFERRED_AT_FIELD]: now,
  };
  const updated = await base44.auth.updateMe(payload);
  return {
    ...(user || {}),
    ...(updated || {}),
    ...payload,
  };
}
