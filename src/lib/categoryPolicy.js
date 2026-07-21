export const CATEGORY_METADATA_POLICY = Object.freeze({
  sourceOfTruth: 'Category',
  safeMetadataFields: Object.freeze(['category_id', 'name', 'description', 'status']),
  metadataOnly: true,
  guestCallableWithoutLogin: true,
  rawQuestionRowsExposed: false,
  answersExposed: false,
  yearsExposed: false,
  adminFieldsExposed: false,
  legacyHardcodedCategoryFallbackAllowed: false,
  loadFailureBehavior: 'retryable_error_or_empty_state',
});

export const ONLINE_GAME_POLICY = Object.freeze({
  categorySourceOfTruth: 'Category',
  selectedCategoryIdsField: 'selected_category_ids',
  selectedCategoriesOnly: false,
  allCategoriesRandom: true,
  selectedCategoryCoverage: 'all_active_categories_random',
  allowedDifficulties: Object.freeze([1, 2]),
  difficultyRule: 'difficulty_1_or_2_only',
  soloPreferenceWeightingApplied: false,
  guestSoloPathUsed: false,
  legacyHardcodedCategoryFallbackAllowed: false,
});

export const SOLO_QUESTION_POLICY = Object.freeze({
  categorySourceOfTruth: 'Category',
  preferenceScope: 'solo_only',
  preferenceWeighting: 'soft_70_selected_30_global',
  minimumValidPreferenceCount: 3,
  selectedCategoryPreferenceRatio: 0.7,
  selectedLaneDifficulties: Object.freeze([1, 2]),
  globalLaneDifficultyTarget: 1,
  emptyPreferencesUseAllActiveCategories: true,
  unavailablePreferencesUseAllActiveCategories: true,
  hardFilterToSelectedCategories: false,
  rawQuestionListFallbackAllowed: false,
  legacyHardcodedCategoryFallbackAllowed: false,
});
