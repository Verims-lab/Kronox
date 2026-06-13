// Kronox Health Center — Category preference contracts.
//
// Scope: Settings + app-open main Category interest preferences. These
// cases do not prove runtime RLS with another account and do not connect
// preferences to question selection.

import categoryEntitySource from '../../../base44/entities/Category.jsonc?raw';
import subCategoryEntitySource from '../../../base44/entities/SubCategory.jsonc?raw';
import userEntitySource from '../../../base44/entities/User.jsonc?raw';
import userCategoryPreferenceEntitySource from '../../../base44/entities/UserCategoryPreference.jsonc?raw';
import userSubCategoryPreferenceEntitySource from '../../../base44/entities/UserSubCategoryPreference.jsonc?raw';
import questionEntitySource from '../../../base44/entities/Question.jsonc?raw';
import appSource from '../../App.jsx?raw';
import settingsPageSource from '../../pages/SettingsPage.jsx?raw';
import adminPageSource from '../../pages/AdminPage.jsx?raw';
import preferenceSectionSource from '../settings/CategoryPreferencesSection.jsx?raw';
import onboardingModalSource from '../settings/CategoryPreferenceOnboardingModal.jsx?raw';
import preferenceHelperSource from '../../lib/userCategoryPreferences.js?raw';
import onboardingProfileSource from '../../lib/categoryPreferenceOnboarding.js?raw';
import gamePageSource from '../../pages/Game.jsx?raw';
import soloQuestionEngineSource from '../../lib/soloQuestionEngine.js?raw';
import onlineGameStartSource from '../../lib/onlineGameStart.js?raw';
import analyticsGatewaySource from '../../lib/dbGateway/analyticsGateway.js?raw';
import getQuestionsFunctionSource from '../../../base44/functions/getQuestions/entry.ts?raw';
import { QUESTION_DATA_MODEL_DOC as questionDataModelDocSource } from '@/lib/questionDataModelDoc';
import { DB_ARCHITECTURE_IMPLEMENTATION_MIRROR as dbArchitectureDocSource } from '@/lib/dbArchitectureMirrors';
import {
  RELEASE_PROOF_CHECKLIST_DOC as releaseProofChecklistDocSource,
  SECURITY_DEPLOYMENT_DOC as securityDeploymentDocSource,
} from '@/lib/healthAlignmentDocMirrors';
import {
  getValidActiveSelectedCategoryIds,
  MIN_CATEGORY_SELECTION_COUNT,
  NO_MAX_CATEGORY_SELECTION_LIMIT,
} from '@/lib/userCategoryPreferences';
import {
  getValidCategoryPreferenceCount,
  shouldShowCategoryPreferenceOnboarding,
} from '@/lib/categoryPreferenceOnboarding';

const STATUS = {
  PASS: 'PASS',
  FAIL: 'FAIL',
  NOT_AUTOMATABLE: 'NOT_AUTOMATABLE',
};

const ACTION_TYPES = {
  CODE_FIX: 'CODE_FIX',
  BACKEND_RUNTIME_PROBE: 'BACKEND_RUNTIME_PROBE',
};

const SUITE_ID = 'category_preferences_health';
const SUITE_NAME = 'Settings Category Preferences Suite';

function makeCase(id, name, run, options = {}) {
  return {
    key: `${SUITE_ID}.${id}`,
    suiteId: SUITE_ID,
    suiteName: SUITE_NAME,
    id,
    name,
    critical: options.critical ?? true,
    actionType: options.actionType || ACTION_TYPES.CODE_FIX,
    ...options,
    run,
  };
}

function pass(reason, extra) { return { status: STATUS.PASS, reason, ...(extra || {}) }; }
function fail(reason, extra) { return { status: STATUS.FAIL, reason, ...(extra || {}) }; }
function notAutomatable(reason, extra) {
  return { status: STATUS.NOT_AUTOMATABLE, reason, ...(extra || {}) };
}

function missingTokens(source, tokens) {
  return tokens.filter((token) => !String(source || '').includes(token));
}

function forbiddenTokens(source, tokens) {
  return tokens.filter((token) => String(source || '').includes(token));
}

function parseJsonSource(source) {
  try {
    return JSON.parse(String(source || '{}'));
  } catch {
    return {};
  }
}

const HEALTH_USER_EMAIL = 'health-user@example.com';

function makeHealthCategory(categoryId, status = 'A') {
  return {
    category_id: categoryId,
    name: `Health Category ${categoryId}`,
    status,
  };
}

function makeHealthPreference(categoryId, { status = 'A', userEmail = HEALTH_USER_EMAIL } = {}) {
  return {
    id: `${userEmail}-${categoryId}`,
    user_id: userEmail,
    user_email: userEmail,
    category_id: categoryId,
    status,
  };
}

function makeHealthPreferences(count, options = {}) {
  return Array.from({ length: count }, (_, index) => makeHealthPreference(index + 1, options));
}

export const EXTRA_SUITES = [
  { id: SUITE_ID, name: SUITE_NAME, critical: true, color: '#facc15' },
];

export const EXTRA_TESTS = [
  makeCase('category_entity_readiness_contract',
    'Category entity exists with active/passive status and stable category_id values',
    () => {
      const schema = parseJsonSource(categoryEntitySource);
      const props = schema?.properties || {};
      const missingFields = ['category_id', 'name', 'status', 'description']
        .filter((field) => !Object.prototype.hasOwnProperty.call(props, field));
      const categoryIdOk = props.category_id?.type === 'number';
      const statusEnum = Array.isArray(props.status?.enum) ? props.status.enum : [];
      const normalizedStatusEnum = statusEnum.map((value) => String(value || '').toUpperCase());
      const normalizedStatusOk = normalizedStatusEnum.includes('A') && normalizedStatusEnum.includes('P');
      const rls = schema?.rls || {};
      const readPublic = rls.read && Object.keys(rls.read).length === 0;
      const writesAdminOnly = ['create', 'update', 'delete'].every((op) => rls?.[op]?.user_condition?.role === 'admin');

      if (missingFields.length || !categoryIdOk || !normalizedStatusOk || !readPublic || !writesAdminOnly) {
        return fail('Category readiness contract for Settings preferences is incomplete.', {
          verification: 'STATIC_CONTRACT',
          file: 'base44/entities/Category.jsonc',
          actual: { missingFields, categoryIdOk, statusEnum, normalizedStatusEnum, readPublic, writesAdminOnly },
        });
      }
      return pass('Category remains the main-category lookup with stable category_id and active/passive status.', {
        verification: 'STATIC_CONTRACT',
      });
    }),

  makeCase('subcategory_entity_retained_but_not_settings_source',
    'SubCategory entity is retained for future metadata but not used by Settings preferences',
    () => {
      const subCategorySchema = parseJsonSource(subCategoryEntitySource);
      const userSubCategorySchema = parseJsonSource(userSubCategoryPreferenceEntitySource);
      const subCategoryExists = subCategorySchema?.name === 'SubCategory'
        && Object.prototype.hasOwnProperty.call(subCategorySchema?.properties || {}, 'main_category_1')
        && Object.prototype.hasOwnProperty.call(subCategorySchema?.properties || {}, 'main_category_2');
      const oldPreferenceEntityRetained = userSubCategorySchema?.name === 'UserSubCategoryPreference';
      const activeSettingsSource = `${settingsPageSource}\n${preferenceSectionSource}\n${preferenceHelperSource}`;
      const forbidden = forbiddenTokens(activeSettingsSource, [
        'SubCategoryPreferencesSection',
        'loadActiveSubCategories',
        'loadUserSubCategoryPreferences',
        'saveUserSubCategoryPreferences',
        'base44.entities.SubCategory',
        'base44.entities.UserSubCategoryPreference',
      ]);

      if (!subCategoryExists || !oldPreferenceEntityRetained || forbidden.length) {
        return fail('SubCategory was removed or the old SubCategory Settings preference path is still active.', {
          verification: 'STATIC_CONTRACT',
          files: [
            'base44/entities/SubCategory.jsonc',
            'base44/entities/UserSubCategoryPreference.jsonc',
            'src/pages/SettingsPage.jsx',
            'src/components/settings/CategoryPreferencesSection.jsx',
            'src/lib/userCategoryPreferences.js',
          ],
          actual: { subCategoryExists, oldPreferenceEntityRetained, forbidden },
        });
      }
      return pass('SubCategory and old preference rows are retained, but Settings no longer uses them as the active preference path.', {
        verification: 'STATIC_CONTRACT',
      });
    }),

  makeCase('settings_has_ilgi_alanlarim_category_section',
    'Settings has an İlgi Alanlarım section for Category preferences',
    () => {
      const missing = missingTokens(`${settingsPageSource}\n${preferenceSectionSource}`, [
        'CategoryPreferencesSection',
        'İlgi Alanlarım',
        'Oyun deneyimini kişiselleştirmek için en az 3 kategori seç.',
      ]);
      if (missing.length) {
        return fail('Settings is missing the Category preference section.', {
          verification: 'STATIC_CONTRACT',
          files: ['src/pages/SettingsPage.jsx', 'src/components/settings/CategoryPreferencesSection.jsx'],
          missing,
        });
      }
      return pass('Settings exposes the İlgi Alanlarım Category preference section.', {
        verification: 'STATIC_CONTRACT',
      });
    }),

  makeCase('settings_loads_active_categories_only',
    'Settings loads active Category rows and hides passive Category rows',
    () => {
      const missing = missingTokens(`${preferenceHelperSource}\n${preferenceSectionSource}`, [
        'base44.entities.Category.list',
        'filter(isActiveCategory)',
        "CATEGORY_STATUS_ACTIVE = 'A'",
        "CATEGORY_STATUS_PASSIVE = 'P'",
        'trim().toUpperCase()',
        'normalizeCategoryId(row?.category_id)',
        'Kategoriler henüz hazırlanıyor.',
      ]);
      if (missing.length) {
        return fail('Settings Category loading no longer proves active-only filtering and empty-state safety.', {
          verification: 'STATIC_CONTRACT',
          files: ['src/lib/userCategoryPreferences.js', 'src/components/settings/CategoryPreferencesSection.jsx'],
          missing,
        });
      }
      return pass('Settings loads active Category rows, hides passive rows, and has an empty state.', {
        verification: 'STATIC_CONTRACT',
      });
    }),

  makeCase('passive_previous_category_selections_are_not_resaved_active',
    'Previously selected now-passive Categories are removed from active UI/save state',
    () => {
      const missing = missingTokens(`${preferenceHelperSource}\n${preferenceSectionSource}`, [
        'sanitizeSelectedCategoryIds',
        'activeIdSet',
        '.filter((id) => activeIdSet.has(id))',
        'normalizeActiveIdSet',
        'activeIdSet.has(id)',
        'const activeSelectedIds = useMemo',
        'saveUserCategoryPreferences(user, selectedIds, activeCategories)',
        'status: CATEGORY_STATUS_PASSIVE',
      ]);
      if (missing.length) {
        return fail('Passive or removed Category preferences may remain selectable or be saved active.', {
          verification: 'STATIC_CONTRACT',
          files: ['src/lib/userCategoryPreferences.js', 'src/components/settings/CategoryPreferencesSection.jsx'],
          missing,
        });
      }
      return pass('Saved selections are intersected with active Categories and invalid rows are passivated on save.', {
        verification: 'STATIC_CONTRACT',
      });
    }),

  makeCase('current_user_category_preferences_loaded_and_displayed',
    'Current user selected categories are loaded and displayed',
    () => {
      const missing = missingTokens(`${preferenceHelperSource}\n${preferenceSectionSource}`, [
        'loadUserCategoryPreferences(user)',
        'getSelectedCategoryIds(preferences)',
        'setSelectedIds(selected)',
        'selectedCategories',
        'Seçtiklerin',
        'Seçili: {selectedCount}',
      ]);
      if (missing.length) {
        return fail('Settings no longer shows saved current-user Category selections.', {
          verification: 'STATIC_CONTRACT',
          files: ['src/lib/userCategoryPreferences.js', 'src/components/settings/CategoryPreferencesSection.jsx'],
          missing,
        });
      }
      return pass('Current-user Category preferences are loaded into the selected UI state.', {
        verification: 'STATIC_CONTRACT',
      });
    }),

  makeCase('minimum_three_category_selection_rule',
    'Saving is blocked below 3 category selections and allowed at 3 or more',
    () => {
      const missing = missingTokens(`${preferenceHelperSource}\n${preferenceSectionSource}`, [
        'MIN_CATEGORY_SELECTION_COUNT = 3',
        'saveUserCategoryPreferences(user, selectedIds, activeCategories)',
        'selectedSet.size < MIN_CATEGORY_SELECTION_COUNT',
        'selectedCount >= MIN_CATEGORY_SELECTION_COUNT',
        'En az 3 kategori seçmelisin.',
      ]);
      if (missing.length) {
        return fail('Minimum 3 Category preference selection rule is incomplete.', {
          verification: 'STATIC_CONTRACT',
          files: ['src/lib/userCategoryPreferences.js', 'src/components/settings/CategoryPreferencesSection.jsx'],
          missing,
        });
      }
      return pass('Settings blocks saves below 3 category selections and calls the persistence helper when valid.', {
        verification: 'STATIC_CONTRACT',
      });
    }),

  makeCase('no_maximum_category_selection_limit',
    'Category preferences have no maximum selection limit',
    () => {
      const missing = missingTokens(preferenceHelperSource, [
        'NO_MAX_CATEGORY_SELECTION_LIMIT = true',
        'noMaximumSelectionLimit',
      ]);
      const helperConstantOk = NO_MAX_CATEGORY_SELECTION_LIMIT === true;
      const forbidden = forbiddenTokens(`${preferenceHelperSource}\n${preferenceSectionSource}`, [
        'MAX_CATEGORY_SELECTION_COUNT',
        'MAX_SELECTED_CATEGORIES',
        'MAX_SUBCATEGORY_SELECTION_COUNT',
        'MAX_SELECTED_SUBCATEGORIES',
      ]);
      if (missing.length || forbidden.length || !helperConstantOk) {
        return fail('Category preference selection may have gained an unintended max cap.', {
          verification: 'STATIC_CONTRACT',
          files: ['src/lib/userCategoryPreferences.js', 'src/components/settings/CategoryPreferencesSection.jsx'],
          actual: { missing, forbidden, helperConstantOk },
        });
      }
      return pass('No upper selection limit is present for Category preferences.', {
        verification: 'STATIC_CONTRACT',
      });
    }),

  makeCase('stale_subcategory_preference_health_assumptions_rewritten',
    'Stale SubCategory preference UI/minimum-5 assumptions are removed from active Settings coverage',
    () => {
      const activePreferenceSources = [
        settingsPageSource,
        preferenceSectionSource,
        onboardingModalSource,
        preferenceHelperSource,
        onboardingProfileSource,
      ].join('\n');
      const forbidden = forbiddenTokens(activePreferenceSources, [
        'MIN_SUBCATEGORY_SELECTION_COUNT',
        'MAX_SUBCATEGORY_SELECTION_COUNT',
        'En az 5 ilgi alanı',
        'En az 5 alt kategori',
        'loadActiveSubCategories',
        'loadUserSubCategoryPreferences',
        'saveUserSubCategoryPreferences',
        'SubCategoryPreferencesSection',
        'categoryPreferenceOnboardingRequired',
        'created_at <',
        'created_date <',
        'rolloutCutoff',
      ]);
      const required = missingTokens(`${preferenceHelperSource}\n${preferenceSectionSource}\n${onboardingModalSource}`, [
        'MIN_CATEGORY_SELECTION_COUNT = 3',
        'En az 3 kategori seçmelisin.',
        'loadActiveCategories',
        'loadUserCategoryPreferences',
        'saveUserCategoryPreferences',
      ]);
      if (forbidden.length || required.length) {
        return fail('Active preference Health/static coverage still contains stale SubCategory, minimum-5, or new-user-only assumptions.', {
          verification: 'STATIC_CONTRACT',
          files: [
            'src/pages/SettingsPage.jsx',
            'src/components/settings/CategoryPreferencesSection.jsx',
            'src/components/settings/CategoryPreferenceOnboardingModal.jsx',
            'src/lib/userCategoryPreferences.js',
            'src/lib/categoryPreferenceOnboarding.js',
          ],
          actual: { forbidden, required },
        });
      }
      return pass('Active Settings/popup coverage uses Category preferences, minimum 3, and no old SubCategory preference UI path.', {
        verification: 'STATIC_CONTRACT',
      });
    }),

  makeCase('category_preferences_are_not_localstorage_source_of_truth',
    'Category preferences are persisted through Base44, not localStorage-only UI state',
    () => {
      const missing = missingTokens(preferenceHelperSource, [
        'base44.entities.UserCategoryPreference.filter',
        'base44.entities.UserCategoryPreference.update',
        'base44.entities.UserCategoryPreference.create',
      ]);
      const forbidden = forbiddenTokens(`${preferenceHelperSource}\n${preferenceSectionSource}`, [
        'localStorage',
        'sessionStorage',
      ]);
      if (missing.length || forbidden.length) {
        return fail('Category preferences may no longer be durable Base44-backed user preferences.', {
          verification: 'STATIC_CONTRACT',
          files: ['src/lib/userCategoryPreferences.js', 'src/components/settings/CategoryPreferencesSection.jsx'],
          actual: { missing, forbidden },
        });
      }
      return pass('Preferences use UserCategoryPreference rows as source-of-truth and no localStorage preference source exists.', {
        verification: 'STATIC_CONTRACT',
      });
    }),

  makeCase('category_preferences_are_user_scoped',
    'UserCategoryPreference rows are scoped to the authenticated user',
    () => {
      const schema = parseJsonSource(userCategoryPreferenceEntitySource);
      const props = schema?.properties || {};
      const missingFields = ['id', 'user_id', 'user_email', 'category_id', 'status', 'created_date', 'updated_date']
        .filter((field) => !Object.prototype.hasOwnProperty.call(props, field));
      const statusEnum = Array.isArray(props.status?.enum) ? props.status.enum : [];
      const statusOk = statusEnum.includes('A') && statusEnum.includes('P') && props.status?.default === 'A';
      const categoryReferenceDoc = String(schema?.description || '').includes('Category.category_id')
        && String(props.category_id?.description || '').includes('Category.category_id');
      const rls = schema?.rls || {};
      const createScoped = rls.create?.created_by_id === '{{user.id}}'
        && rls.create?.['data.user_email'] === '{{user.email}}';
      const readScoped = JSON.stringify(rls.read || {}).includes('"data.user_email":"{{user.email}}"')
        || JSON.stringify(rls.read || {}).includes('"data.user_email": "{{user.email}}"');
      const updateScoped = JSON.stringify(rls.update || {}).includes('"data.user_email":"{{user.email}}"')
        || JSON.stringify(rls.update || {}).includes('"data.user_email": "{{user.email}}"');
      const helperMissing = missingTokens(preferenceHelperSource, [
        'normalizePreferenceEmail',
        'base44.entities.UserCategoryPreference.filter',
        '{ user_email: userEmail }',
        'user_email: userEmail',
        'status: CATEGORY_STATUS_PASSIVE',
      ]);
      if (missingFields.length || !statusOk || !categoryReferenceDoc || !createScoped || !readScoped || !updateScoped || helperMissing.length) {
        return fail('UserCategoryPreference persistence is not clearly user-scoped.', {
          verification: 'STATIC_CONTRACT',
          file: 'base44/entities/UserCategoryPreference.jsonc',
          actual: {
            missingFields,
            statusEnum,
            defaultStatus: props.status?.default,
            categoryReferenceDoc,
            createScoped,
            readScoped,
            updateScoped,
            helperMissing,
          },
        });
      }
      return pass('Category preference rows are user-owned, scoped by user email, and unselected rows become passive.', {
        verification: 'STATIC_CONTRACT',
      });
    }),

  makeCase('duplicate_active_category_preferences_are_collapsed_or_documented',
    'Duplicate active category preference rows are avoided by code path and tracked as a DB uniqueness risk',
    () => {
      const missing = missingTokens(`${preferenceHelperSource}\n${dbArchitectureDocSource}`, [
        'duplicateRows',
        'byCategoryId',
        'status: CATEGORY_STATUS_PASSIVE',
        'user_email + category_id',
        'Base44 index/unique-key declarations are a platform/manual configuration gap',
      ]);
      if (missing.length) {
        return fail('Duplicate active UserCategoryPreference rows are not guarded or documented.', {
          verification: 'STATIC_CONTRACT',
          files: ['src/lib/userCategoryPreferences.js', 'docs/KRONOX_DB_ARCHITECTURE.md'],
          missing,
        });
      }
      return pass('Save path passivates duplicates and docs keep platform unique-key proof visible as manual risk.', {
        verification: 'STATIC_CONTRACT',
      });
    }),

  makeCase('question_selection_algorithm_solo_only_preference_connection',
    'Category preferences affect Solo only; Online/getQuestions/analytics remain unchanged',
    () => {
      const soloMissing = missingTokens(`${gamePageSource}\n${soloQuestionEngineSource}`, [
        'userSelectedCategoryIds',
        'categoryPreferenceFairness',
        'preferenceRatioTarget: \'70/30\'',
      ]);
      const nonSoloSource = [
        onlineGameStartSource,
        getQuestionsFunctionSource,
        analyticsGatewaySource,
      ].join('\n');
      const forbidden = forbiddenTokens(nonSoloSource, [
        'UserCategoryPreference',
        'UserSubCategoryPreference',
        'loadUserCategoryPreferences',
        'saveUserCategoryPreferences',
        'userSelectedCategoryIds',
        'CategoryPreferencesSection',
        'SubCategoryPreferencesSection',
      ]);
      if (soloMissing.length || forbidden.length) {
        return fail('Category/SubCategory preferences leaked outside the Solo-only selection boundary.', {
          verification: 'STATIC_CONTRACT',
          files: [
            'src/pages/Game.jsx',
            'src/lib/soloQuestionEngine.js',
            'src/lib/onlineGameStart.js',
            'base44/functions/getQuestions/entry.ts',
            'src/lib/dbGateway/analyticsGateway.js',
          ],
          actual: { soloMissing, forbidden },
        });
      }
      return pass('Category preferences now feed Solo 70/30 weighting only; Online, getQuestions, and analytics do not read preference rows.', {
        verification: 'STATIC_CONTRACT',
      });
    }),

  makeCase('question_schema_and_subcategory_mapping_unchanged',
    'Question schema and SubCategory mapping remain unchanged',
    () => {
      const schema = parseJsonSource(questionEntitySource);
      const props = schema?.properties || {};
      const hasTextSubCategory = props.sub_category?.type === 'string';
      const forbiddenFields = Object.keys(props).filter((field) => field === 'sub_category_id' || field === 'subcategory_id');
      if (!hasTextSubCategory || forbiddenFields.length) {
        return fail('Question schema was changed while switching Settings preferences to Category.', {
          verification: 'STATIC_CONTRACT',
          file: 'base44/entities/Question.jsonc',
          actual: { hasTextSubCategory, forbiddenFields },
        });
      }
      return pass('Question.sub_category remains text metadata and no SubCategory id mapping was introduced.', {
        verification: 'STATIC_CONTRACT',
      });
    }),

  makeCase('below_three_category_preference_popup_exists',
    'Category preference popup is wired after auth bootstrap for below-3 users',
    () => {
      const missing = missingTokens(`${appSource}\n${onboardingModalSource}\n${onboardingProfileSource}`, [
        'CategoryPreferenceOnboardingModal',
        'shouldShowCategoryPreferenceOnboarding({',
        'İlgi Alanlarını Seç',
        'Şimdi seçmezsen Solo tüm aktif kategorilerle başlar.',
        'Devam Et',
        'Daha Sonra',
        'onCompleted={handleCategoryPreferenceOnboardingComplete}',
        'disabled={showProfileTutorial}',
      ]);
      if (missing.length) {
        return fail('Category preference popup is not clearly wired or sequenced after auth/tutorial.', {
          verification: 'STATIC_CONTRACT',
          files: [
            'src/App.jsx',
            'src/components/settings/CategoryPreferenceOnboardingModal.jsx',
            'src/lib/categoryPreferenceOnboarding.js',
          ],
          missing,
        });
      }
      return pass('Category preference popup exists and is sequenced away from the tutorial modal.', {
        verification: 'STATIC_CONTRACT',
      });
    }),

  makeCase('category_preferences_optional_for_gameplay_start',
    'Category preference save validation is separate from Solo gameplay start',
    () => {
      const missing = missingTokens(`${preferenceHelperSource}\n${onboardingModalSource}\n${gamePageSource}`, [
        'saveValidationSeparateFromGameplayStart: true',
        'guestNoAuthUsesAllActiveCategories: true',
        'noSavedPreferencesUsesAllActiveCategories: true',
        'resolveGameplayCategoryPreferenceFilter(preferences, activeCategories)',
        'Şimdi seçmezsen Solo tüm aktif kategorilerle başlar.',
        'Daha Sonra',
        'userCategoryPreferenceAvailable: soloRuntimeCategoryPreferenceState.available === true',
      ]);
      if (missing.length) {
        return fail('Category preferences may still be mandatory for Solo question loading instead of optional personalization.', {
          verification: 'STATIC_CONTRACT',
          files: [
            'src/lib/userCategoryPreferences.js',
            'src/components/settings/CategoryPreferenceOnboardingModal.jsx',
            'src/pages/Game.jsx',
          ],
          missing,
        });
      }
      return pass('Minimum-3 validation remains a save rule, while Solo can start with all active categories when preferences are absent.', {
        verification: 'STATIC_CONTRACT',
      });
    }),

  makeCase('below_three_popup_loads_active_categories_and_minimum_three',
    'Popup loads active Category rows, hides passive rows, and requires 3 selections',
    () => {
      const missing = missingTokens(`${preferenceHelperSource}\n${onboardingModalSource}`, [
        'loadActiveCategories()',
        'loadUserCategoryPreferences(user)',
        'filter(isActiveCategory)',
        'getValidActiveSelectedCategoryIds(preferences, categories)',
        'activeCategories.length < MIN_CATEGORY_SELECTION_COUNT',
        'selectedCount >= MIN_CATEGORY_SELECTION_COUNT',
        'En az 3 kategori seçmelisin.',
        'Kategoriler henüz hazırlanıyor.',
        'Daha Sonra',
      ]);
      if (missing.length) {
        return fail('Category popup no longer proves active-only loading, min-3 validation, or safe empty-state fallback.', {
          verification: 'STATIC_CONTRACT',
          files: [
            'src/components/settings/CategoryPreferenceOnboardingModal.jsx',
            'src/lib/userCategoryPreferences.js',
          ],
          missing,
        });
      }
      return pass('Popup uses the same active Category source, min-3 rule, and guarded empty-state fallback as Settings.', {
        verification: 'STATIC_CONTRACT',
      });
    }),

  makeCase('below_three_popup_persists_preferences_and_completion_flag',
    'Popup saves UserCategoryPreference rows before marking onboarding complete',
    () => {
      const userSchema = parseJsonSource(userEntitySource);
      const userProps = userSchema?.properties || {};
      const missingUserFields = [
        'category_preferences_onboarding_completed',
        'category_preferences_onboarding_completed_at',
      ].filter((field) => !Object.prototype.hasOwnProperty.call(userProps, field));
      const missing = missingTokens(`${onboardingModalSource}\n${onboardingProfileSource}\n${appSource}`, [
        'saveUserCategoryPreferences(user, selectedIds, activeCategories)',
        'markCategoryPreferenceOnboardingCompleted(user)',
        'base44.auth.updateMe(payload)',
        'category_preferences_onboarding_completed',
        'category_preferences_onboarding_completed_at',
        'setNeedsOnboarding(false)',
        'setCompletedForSession(true)',
        'checkUserAuth?.()',
      ]);
      if (missing.length || missingUserFields.length) {
        return fail('Onboarding completion can drift from saved preferences or lacks profile completion fields.', {
          verification: 'STATIC_CONTRACT',
          files: [
            'src/components/settings/CategoryPreferenceOnboardingModal.jsx',
            'src/lib/categoryPreferenceOnboarding.js',
            'base44/entities/User.jsonc',
            'src/App.jsx',
          ],
          actual: { missing, missingUserFields },
        });
      }
      return pass('Popup saves Category preferences, then sets a user profile completion flag and refreshes auth state.', {
        verification: 'STATIC_CONTRACT',
      });
    }),

  makeCase('popup_trigger_uses_active_valid_count_for_all_users',
    'Any authenticated user below 3 active valid Category preferences sees the popup',
    () => {
      const missing = missingTokens(onboardingProfileSource, [
        'getValidCategoryPreferenceCount',
        'getValidActiveSelectedCategoryIds(preferences, activeCategories).size',
        '< MIN_CATEGORY_SELECTION_COUNT',
      ]);
      const showFunctionStart = onboardingProfileSource.indexOf('export function shouldShowCategoryPreferenceOnboarding');
      const showFunctionEnd = onboardingProfileSource.indexOf('export async function markCategoryPreferenceOnboardingCompleted');
      const showFunctionSource = showFunctionStart >= 0 && showFunctionEnd > showFunctionStart
        ? onboardingProfileSource.slice(showFunctionStart, showFunctionEnd)
        : onboardingProfileSource;
      const forbidden = forbiddenTokens(showFunctionSource, [
        'hasCompletedCategoryPreferenceOnboarding',
        'created_at',
        'created_date',
        'rollout',
        'category_preferences_onboarding_required',
      ]);
      if (missing.length || forbidden.length) {
        return fail('Popup trigger may still rely on account age or completion flags instead of active valid preference count.', {
          verification: 'STATIC_CONTRACT',
          file: 'src/lib/categoryPreferenceOnboarding.js',
          actual: { missing, forbidden },
        });
      }
      return pass('Popup trigger uses active valid Category preference count, so new and existing users below 3 are covered and completion flags cannot bypass the rule.', {
        verification: 'STATIC_CONTRACT',
      });
    }),

  makeCase('popup_trigger_count_matrix_covers_zero_one_two_three_plus',
    'Popup trigger covers 0/1/2 preferences as incomplete and 3+ as complete',
    () => {
      const activeCategories = Array.from({ length: 6 }, (_, index) => makeHealthCategory(index + 1));
      const matrix = [0, 1, 2, 3, 4, 6].map((count) => ({
        count,
        shouldShow: shouldShowCategoryPreferenceOnboarding({
          preferences: makeHealthPreferences(count),
          activeCategories,
        }),
      }));
      const expected = new Map([
        [0, true],
        [1, true],
        [2, true],
        [3, false],
        [4, false],
        [6, false],
      ]);
      const mismatches = matrix.filter((row) => row.shouldShow !== expected.get(row.count));
      const minOk = MIN_CATEGORY_SELECTION_COUNT === 3;

      if (mismatches.length || !minOk) {
        return fail('Popup trigger helper does not implement the active valid count < 3 rule.', {
          verification: 'HELPER_SIMULATION',
          actual: { matrix, mismatches, minOk },
        });
      }
      return pass('Popup trigger helper shows for 0/1/2 active valid preferences and skips for 3 or more.', {
        verification: 'HELPER_SIMULATION',
        actual: { matrix },
      });
    }),

  makeCase('completion_flag_cannot_bypass_below_three_count',
    'Onboarding completion flags cannot bypass the below-3 trigger rule',
    () => {
      const activeCategories = Array.from({ length: 4 }, (_, index) => makeHealthCategory(index + 1));
      const completedExistingUser = {
        email: HEALTH_USER_EMAIL,
        created_date: '2024-01-01T00:00:00.000Z',
        hasCompletedTutorial: true,
        category_preferences_onboarding_completed: true,
      };
      const shouldShowWithCompletedUser = shouldShowCategoryPreferenceOnboarding({
        user: completedExistingUser,
        preferences: makeHealthPreferences(2),
        activeCategories,
      });
      const shouldSkipWithValidCount = shouldShowCategoryPreferenceOnboarding({
        user: { email: HEALTH_USER_EMAIL, category_preferences_onboarding_completed: false },
        preferences: makeHealthPreferences(3),
        activeCategories,
      });

      if (!shouldShowWithCompletedUser || shouldSkipWithValidCount) {
        return fail('Completion, tutorial, account age, or rollout state can override the active valid preference count.', {
          verification: 'HELPER_SIMULATION',
          actual: { shouldShowWithCompletedUser, shouldSkipWithValidCount },
        });
      }
      return pass('The popup trigger ignores completion/advisory state and follows the active valid preference count.', {
        verification: 'HELPER_SIMULATION',
        actual: { shouldShowWithCompletedUser, shouldSkipWithValidCount },
      });
    }),

  makeCase('active_valid_count_helper_excludes_passive_invalid_and_passive_categories',
    'Active valid count excludes passive preferences, passive Categories, and corrupt Category ids',
    () => {
      const categories = [
        makeHealthCategory(1, 'A'),
        makeHealthCategory(2, 'P'),
        makeHealthCategory(3, 'a'),
        makeHealthCategory(4, 'A'),
      ];
      const preferences = [
        makeHealthPreference(1, { status: 'A' }),
        makeHealthPreference(2, { status: 'A' }),
        makeHealthPreference(3, { status: 'P' }),
        makeHealthPreference('bad-id', { status: 'A' }),
        makeHealthPreference(4, { status: 'A' }),
      ];
      const validIds = getValidActiveSelectedCategoryIds(preferences, categories);
      const validCount = getValidCategoryPreferenceCount(preferences, categories);
      const expectedIds = [1, 4];
      const idsOk = expectedIds.every((id) => validIds.has(id)) && validIds.size === expectedIds.length;
      const missing = missingTokens(`${preferenceHelperSource}\n${onboardingModalSource}`, [
        'loadUserCategoryPreferences(user)',
        '{ user_email: userEmail }',
        'getValidActiveSelectedCategoryIds(preferences, categories)',
      ]);

      if (!idsOk || validCount !== 2 || missing.length) {
        return fail('Valid count may include passive/invalid Category preferences or rows outside current-user filtering.', {
          verification: 'HELPER_SIMULATION',
          files: [
            'src/lib/userCategoryPreferences.js',
            'src/components/settings/CategoryPreferenceOnboardingModal.jsx',
          ],
          actual: { validIds: Array.from(validIds), validCount, missing },
        });
      }
      return pass('Valid count intersects active preferences with active Category rows after current-user preference loading.', {
        verification: 'HELPER_SIMULATION',
        actual: { validIds: Array.from(validIds), validCount },
      });
    }),

  makeCase('passive_selected_category_reopens_popup_when_count_drops_below_three',
    'A selected Category becoming passive drops valid count and reopens the popup',
    () => {
      const categories = [
        makeHealthCategory(1, 'A'),
        makeHealthCategory(2, 'A'),
        makeHealthCategory(3, 'P'),
      ];
      const preferences = makeHealthPreferences(3);
      const validCount = getValidCategoryPreferenceCount(preferences, categories);
      const shouldShow = shouldShowCategoryPreferenceOnboarding({ preferences, activeCategories: categories });

      if (validCount !== 2 || !shouldShow) {
        return fail('Passive selected Categories may still count toward completion.', {
          verification: 'HELPER_SIMULATION',
          actual: { validCount, shouldShow },
        });
      }
      return pass('If a previously selected Category becomes passive and valid count falls below 3, the popup should show again.', {
        verification: 'HELPER_SIMULATION',
        actual: { validCount, shouldShow },
      });
    }),

  makeCase('passive_categories_and_preferences_do_not_count_for_popup',
    'Popup count excludes passive preferences, passive Categories, SubCategory rows, and corrupt ids',
    () => {
      const missing = missingTokens(`${preferenceHelperSource}\n${onboardingProfileSource}\n${onboardingModalSource}`, [
        'sanitizeSelectedCategoryIds',
        'getValidActiveSelectedCategoryIds',
        'filter(isActiveCategoryPreference)',
        'getActiveCategoryIdSet(activeCategories)',
        '.filter((id) => activeIdSet.has(id))',
        'normalizeCategoryId(row?.category_id)',
        'filter(isActiveCategory)',
      ]);
      const forbidden = forbiddenTokens(`${onboardingProfileSource}\n${onboardingModalSource}`, [
        'UserSubCategoryPreference',
        'SubCategory',
      ]);
      if (missing.length || forbidden.length) {
        return fail('Popup count may include passive/invalid Category preferences or SubCategory preferences.', {
          verification: 'STATIC_CONTRACT',
          files: [
            'src/lib/userCategoryPreferences.js',
            'src/lib/categoryPreferenceOnboarding.js',
            'src/components/settings/CategoryPreferenceOnboardingModal.jsx',
          ],
          actual: { missing, forbidden },
        });
      }
      return pass('Popup count uses only current-user active UserCategoryPreference rows that reference active Category rows.', {
        verification: 'STATIC_CONTRACT',
      });
    }),

  makeCase('settings_remains_editable_after_onboarding',
    'Settings İlgi Alanlarım remains editable using the same Category preference storage',
    () => {
      const missing = missingTokens(`${settingsPageSource}\n${preferenceSectionSource}\n${onboardingModalSource}`, [
        'CategoryPreferencesSection',
        'loadUserCategoryPreferences(user)',
        'saveUserCategoryPreferences(user, selectedIds, activeCategories)',
        'Kaydet',
        'Devam Et',
      ]);
      if (missing.length) {
        return fail('Settings no longer proves the same Category preference storage remains editable after onboarding.', {
          verification: 'STATIC_CONTRACT',
          files: [
            'src/pages/SettingsPage.jsx',
            'src/components/settings/CategoryPreferencesSection.jsx',
            'src/components/settings/CategoryPreferenceOnboardingModal.jsx',
          ],
          missing,
        });
      }
      return pass('Settings remains the editable Category preference surface after app-open popup completion.', {
        verification: 'STATIC_CONTRACT',
      });
    }),

  makeCase('settings_and_popup_share_same_category_preference_contract',
    'Settings and popup share the same Category preference data contract',
    () => {
      const requiredInBoth = [
        'loadActiveCategories',
        'loadUserCategoryPreferences',
        'getValidActiveSelectedCategoryIds',
        'sanitizeSelectedCategoryIds',
        'saveUserCategoryPreferences',
        'MIN_CATEGORY_SELECTION_COUNT',
      ];
      const settingsMissing = missingTokens(preferenceSectionSource, requiredInBoth);
      const popupMissing = missingTokens(onboardingModalSource, requiredInBoth);
      const helperMissing = missingTokens(preferenceHelperSource, [
        'NO_MAX_CATEGORY_SELECTION_LIMIT = true',
      ]);
      const forbidden = forbiddenTokens(`${preferenceSectionSource}\n${onboardingModalSource}`, [
        'UserSubCategoryPreference',
        'loadActiveSubCategories',
        'saveUserSubCategoryPreferences',
        'MAX_CATEGORY_SELECTION_COUNT',
        'MAX_SUBCATEGORY_SELECTION_COUNT',
      ]);

      if (settingsMissing.length || popupMissing.length || helperMissing.length || forbidden.length) {
        return fail('Settings and popup may have diverged into separate preference contracts.', {
          verification: 'STATIC_CONTRACT',
          files: [
            'src/components/settings/CategoryPreferencesSection.jsx',
            'src/components/settings/CategoryPreferenceOnboardingModal.jsx',
          ],
          actual: { settingsMissing, popupMissing, helperMissing, forbidden },
        });
      }
      return pass('Settings and popup both use active Category rows, UserCategoryPreference persistence, min-3 validation, and no max cap.', {
        verification: 'STATIC_CONTRACT',
      });
    }),

  makeCase('global_under_three_active_categories_has_safe_non_blocking_state',
    'Popup does not trap users if fewer than 3 active Category rows exist globally',
    () => {
      const missing = missingTokens(onboardingModalSource, [
        'activeCategories.length < MIN_CATEGORY_SELECTION_COUNT',
        'Kategoriler henüz hazırlanıyor.',
        'setDismissedForSession(true)',
        'Daha Sonra',
        'disabled={loading || saving || !canContinue}',
      ]);
      if (missing.length) {
        return fail('Popup can trap users if admin Category data has fewer than 3 active rows.', {
          verification: 'STATIC_CONTRACT',
          file: 'src/components/settings/CategoryPreferenceOnboardingModal.jsx',
          missing,
        });
      }
      return pass('Popup has a safe setup-data fallback for fewer than 3 active Category rows.', {
        verification: 'STATIC_CONTRACT',
      });
    }),

  makeCase('settings_admin_visibility_unchanged',
    'Admin tools remain AdminUser-gated in Admin Ekranı and Settings stays preference-focused',
    () => {
      const missing = missingTokens(`${settingsPageSource}\n${adminPageSource}`, [
        'CategoryPreferencesSection',
        'Admin Ekranı',
        'const isAdmin = parsedAdminStatus',
        'if (!isAdmin)',
        'QuestionAnalyticsReportTool',
        'ResetUserProgressTool',
      ]);
      const forbidden = forbiddenTokens(settingsPageSource, [
        'AdminDebug-v4',
        'AdminDebug',
        'QuestionAnalyticsReportTool',
        'ResetUserProgressTool',
        'DailyQuestDefinitionManager',
        'SimulationPanel',
      ]);
      if (missing.length || forbidden.length) {
        return fail('Admin visibility or clean Settings contract changed while preserving Category preferences.', {
          verification: 'STATIC_CONTRACT',
          file: 'src/pages/SettingsPage.jsx + src/pages/AdminPage.jsx',
          actual: { missing, forbidden },
        });
      }
      return pass('Settings stays preference-focused and Admin Ekranı tools remain gated by backend AdminUser status.', {
        verification: 'STATIC_CONTRACT',
      });
    }),

  makeCase('settings_mobile_ui_static_guardrails',
    'Settings Category preference UI has mobile-safe wrapping and reachable save controls',
    () => {
      const missing = missingTokens(preferenceSectionSource, [
        'flex flex-wrap',
        'break-words',
        'min-h-12 w-full',
        'Kaydet',
        'validation',
        'w-full items-center justify-center',
      ]);
      if (missing.length) {
        return fail('Settings Category preference UI lost static mobile wrapping/reachable-save guardrails.', {
          verification: 'STATIC_CONTRACT',
          file: 'src/components/settings/CategoryPreferencesSection.jsx',
          missing,
        });
      }
      return pass('Static mobile guardrails are present for wrapping chips/list rows and the full-width save control.', {
        verification: 'STATIC_CONTRACT',
      });
    }),

  makeCase('below_three_popup_mobile_ui_static_guardrails',
    'Category preference popup has mobile-safe modal guardrails',
    () => {
      const missing = missingTokens(onboardingModalSource, [
        'max-h-full w-full max-w-md overflow-y-auto',
        'flex flex-wrap',
        'break-words',
        'min-h-12 w-full',
        'env(safe-area-inset-bottom)',
        'Devam Et',
        'Daha Sonra',
      ]);
      if (missing.length) {
        return fail('Category preference popup lost static mobile-safe wrapping/scroll guardrails.', {
          verification: 'STATIC_CONTRACT',
          file: 'src/components/settings/CategoryPreferenceOnboardingModal.jsx',
          missing,
        });
      }
      return pass('Popup uses safe-area padding, scrollable modal bounds, wrapping chips/list rows, and reachable actions.', {
        verification: 'STATIC_CONTRACT',
      });
    }),

  makeCase('docs_align_category_preference_phase',
    'Docs align on below-3 Category preference popup, Settings editability, and Solo-only soft weighting',
    () => {
      const combinedDocs = [
        questionDataModelDocSource,
        dbArchitectureDocSource,
        releaseProofChecklistDocSource,
        securityDeploymentDocSource,
      ].join('\n');
      const missing = missingTokens(combinedDocs, [
        'Category interests',
        'UserCategoryPreference',
        'İlgi Alanlarım',
        'Minimum selection count is 3',
        'There is no maximum selection.',
        'optional personalization popup',
        'new and existing users',
        'can be deferred',
        'active valid UserCategoryPreference count',
        'Only active categories are selectable and count',
        'Users can later change selections under Profile / Settings',
        'No login/no saved preferences/empty preferences use all active categories',
        'Category preference save validation remains separate from gameplay start',
        'Saved preferences target 70% selected user categories and 30% full eligible pool',
        'Online question selection is not affected',
        'soft weighting target with fallback, not hard filtering',
        'SubCategory entity still exists',
        'RLS',
      ]);
      if (missing.length) {
        return fail('Docs/mirrors no longer align with the staged Category preference contract.', {
          verification: 'STATIC_CONTRACT',
          files: [
            'docs/KRONOX_DB_ARCHITECTURE.md',
            'docs/KRONOX_QUESTION_DATA_MODEL.md',
            'docs/KRONOX_RELEASE_PROOF_CHECKLIST.md',
            'docs/KRONOX_SECURITY_DEPLOYMENT.md',
          ],
          missing,
        });
      }
      return pass('Docs/mirrors state below-3 popup trigger, Settings editability, minimum/no-max rules, Solo soft weighting, retained SubCategory, and RLS proof needs.', {
        verification: 'STATIC_CONTRACT',
      });
    }),

  makeCase('preference_rls_runtime_proof_required',
    'Two-account category preference RLS proof remains manual',
    () => notAutomatable('Static Health can inspect RLS shape, but proving one user cannot read or update another user’s UserCategoryPreference rows requires a real two-account backend runtime probe.', {
      verification: 'NOT_AUTOMATABLE',
      actionType: ACTION_TYPES.BACKEND_RUNTIME_PROBE,
      runtimeProofRequired: true,
      manualSteps: [
        'User A saves at least 3 Category preferences.',
        'User B opens Settings and cannot see User A selections.',
        'User B cannot update User A preference row through direct entity access.',
        'Admin account can inspect rows only through admin-authorized tooling when such tooling exists.',
      ],
    }),
    { actionType: ACTION_TYPES.BACKEND_RUNTIME_PROBE }),

  makeCase('preference_mobile_visual_runtime_proof_required',
    'Mobile visual proof for preference chips/list remains manual',
    () => notAutomatable('Static Health checks wrapping classes, but real mobile proof is still required for long Category names, touch targets, Settings scroll, safe area, and save-button reachability.', {
      verification: 'NOT_AUTOMATABLE',
      runtimeProofRequired: true,
      manualSteps: [
        'Open Settings on a narrow mobile viewport/device.',
        'Verify İlgi Alanlarım chips and list rows wrap without horizontal overflow.',
        'Verify long Category names remain readable and the Kaydet button is reachable.',
        'Verify validation text is visible when fewer than 3 categories are selected.',
      ],
    })),
];
