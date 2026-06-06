// Kronox Health Center — Settings SubCategory preference contracts.
//
// Scope: Settings-only user interest preferences. These cases deliberately do
// not prove runtime RLS with another account and do not connect preferences to
// question selection.

import userPreferenceEntitySource from '../../../base44/entities/UserSubCategoryPreference.jsonc?raw';
import settingsPageSource from '../../pages/SettingsPage.jsx?raw';
import preferenceSectionSource from '../settings/SubCategoryPreferencesSection.jsx?raw';
import preferenceHelperSource from '../../lib/userSubCategoryPreferences.js?raw';
import gamePageSource from '../../pages/Game.jsx?raw';
import soloQuestionEngineSource from '../../lib/soloQuestionEngine.js?raw';
import getQuestionsFunctionSource from '../../../base44/functions/getQuestions/entry.ts?raw';

const STATUS = {
  PASS: 'PASS',
  FAIL: 'FAIL',
  NOT_AUTOMATABLE: 'NOT_AUTOMATABLE',
};

const ACTION_TYPES = {
  CODE_FIX: 'CODE_FIX',
  BACKEND_RUNTIME_PROBE: 'BACKEND_RUNTIME_PROBE',
};

const SUITE_ID = 'subcategory_preferences_health';
const SUITE_NAME = 'Settings SubCategory Preferences Suite';

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

export const EXTRA_SUITES = [
  { id: SUITE_ID, name: SUITE_NAME, critical: true, color: '#facc15' },
];

export const EXTRA_TESTS = [
  makeCase('settings_has_ilgi_alanlarim_section',
    'Settings has an İlgi Alanlarım section for SubCategory preferences',
    () => {
      const missing = missingTokens(`${settingsPageSource}\n${preferenceSectionSource}`, [
        'SubCategoryPreferencesSection',
        'İlgi Alanlarım',
        'Oyun deneyimini kişiselleştirmek için en az 5 ilgi alanı seç.',
      ]);
      if (missing.length) {
        return fail('Settings is missing the SubCategory preference section.', {
          verification: 'STATIC_CONTRACT',
          files: ['src/pages/SettingsPage.jsx', 'src/components/settings/SubCategoryPreferencesSection.jsx'],
          missing,
        });
      }
      return pass('Settings exposes the İlgi Alanlarım SubCategory preference section.', {
        verification: 'STATIC_CONTRACT',
      });
    }),

  makeCase('settings_loads_active_subcategories_only',
    'Settings loads active SubCategory rows and hides passive rows',
    () => {
      const missing = missingTokens(`${preferenceHelperSource}\n${preferenceSectionSource}`, [
        'base44.entities.SubCategory.list',
        'filter(isActiveSubCategory)',
        "SUBCATEGORY_STATUS_ACTIVE = 'A'",
        "SUBCATEGORY_STATUS_PASSIVE = 'P'",
        'String(row?.status || \'\').trim().toUpperCase() === SUBCATEGORY_STATUS_ACTIVE',
        'İlgi alanları henüz hazırlanıyor.',
      ]);
      if (missing.length) {
        return fail('Settings SubCategory loading no longer proves active-only filtering and empty-state safety.', {
          verification: 'STATIC_CONTRACT',
          files: ['src/lib/userSubCategoryPreferences.js', 'src/components/settings/SubCategoryPreferencesSection.jsx'],
          missing,
        });
      }
      return pass('Settings loads active SubCategory rows, hides passive rows, and has an empty state.', {
        verification: 'STATIC_CONTRACT',
      });
    }),

  makeCase('current_user_preferences_loaded_and_displayed',
    'Current user selected subcategories are loaded and displayed',
    () => {
      const missing = missingTokens(`${preferenceHelperSource}\n${preferenceSectionSource}`, [
        'loadUserSubCategoryPreferences(user)',
        'getSelectedSubCategoryIds(preferences)',
        'setSelectedIds(selected)',
        'selectedSubCategories',
        'Seçtiklerin',
        'Seçili: {selectedCount}',
      ]);
      if (missing.length) {
        return fail('Settings no longer shows saved current-user selections.', {
          verification: 'STATIC_CONTRACT',
          files: ['src/lib/userSubCategoryPreferences.js', 'src/components/settings/SubCategoryPreferencesSection.jsx'],
          missing,
        });
      }
      return pass('Current-user SubCategory preferences are loaded into the selected UI state.', {
        verification: 'STATIC_CONTRACT',
      });
    }),

  makeCase('minimum_five_selection_rule',
    'Saving is blocked below 5 selections and allowed at 5 or more',
    () => {
      const missing = missingTokens(`${preferenceHelperSource}\n${preferenceSectionSource}`, [
        'MIN_SUBCATEGORY_SELECTION_COUNT = 5',
        'selectedSet.size < MIN_SUBCATEGORY_SELECTION_COUNT',
        'selectedCount >= MIN_SUBCATEGORY_SELECTION_COUNT',
        'En az 5 ilgi alanı seçmelisin.',
        'saveUserSubCategoryPreferences(user, selectedIds, activeSubCategories)',
      ]);
      if (missing.length) {
        return fail('Minimum 5 SubCategory preference selection rule is incomplete.', {
          verification: 'STATIC_CONTRACT',
          files: ['src/lib/userSubCategoryPreferences.js', 'src/components/settings/SubCategoryPreferencesSection.jsx'],
          missing,
        });
      }
      return pass('Settings blocks saves below 5 selections and calls the persistence helper when valid.', {
        verification: 'STATIC_CONTRACT',
      });
    }),

  makeCase('no_maximum_selection_limit',
    'SubCategory preferences have no maximum selection limit',
    () => {
      const missing = missingTokens(preferenceHelperSource, [
        'NO_MAX_SUBCATEGORY_SELECTION_LIMIT = true',
        'noMaximumSelectionLimit',
      ]);
      const forbidden = forbiddenTokens(`${preferenceHelperSource}\n${preferenceSectionSource}`, [
        'MAX_SUBCATEGORY_SELECTION_COUNT',
        'MAX_SELECTED_SUBCATEGORIES',
      ]);
      if (missing.length || forbidden.length) {
        return fail('SubCategory preference selection may have gained an unintended max cap.', {
          verification: 'STATIC_CONTRACT',
          files: ['src/lib/userSubCategoryPreferences.js', 'src/components/settings/SubCategoryPreferencesSection.jsx'],
          actual: { missing, forbidden },
        });
      }
      return pass('No upper selection limit is present for SubCategory preferences.', {
        verification: 'STATIC_CONTRACT',
      });
    }),

  makeCase('preferences_are_user_scoped',
    'UserSubCategoryPreference rows are scoped to the authenticated user',
    () => {
      const schema = parseJsonSource(userPreferenceEntitySource);
      const props = schema?.properties || {};
      const missingFields = ['id', 'user_id', 'user_email', 'sub_category_id', 'status', 'created_date', 'updated_date']
        .filter((field) => !Object.prototype.hasOwnProperty.call(props, field));
      const rls = schema?.rls || {};
      const createScoped = rls.create?.created_by_id === '{{user.id}}'
        && rls.create?.['data.user_email'] === '{{user.email}}';
      const readScoped = JSON.stringify(rls.read || {}).includes('"data.user_email":"{{user.email}}"')
        || JSON.stringify(rls.read || {}).includes('"data.user_email": "{{user.email}}"');
      const updateScoped = JSON.stringify(rls.update || {}).includes('"data.user_email":"{{user.email}}"')
        || JSON.stringify(rls.update || {}).includes('"data.user_email": "{{user.email}}"');
      const helperMissing = missingTokens(preferenceHelperSource, [
        'normalizePreferenceEmail',
        'base44.entities.UserSubCategoryPreference.filter',
        '{ user_email: userEmail }',
        'user_email: userEmail',
        'status: SUBCATEGORY_STATUS_PASSIVE',
      ]);
      if (missingFields.length || !createScoped || !readScoped || !updateScoped || helperMissing.length) {
        return fail('UserSubCategoryPreference persistence is not clearly user-scoped.', {
          verification: 'STATIC_CONTRACT',
          file: 'base44/entities/UserSubCategoryPreference.jsonc',
          actual: { missingFields, createScoped, readScoped, updateScoped, helperMissing },
        });
      }
      return pass('Preference rows are user-owned, scoped by user email, and unselected rows become passive.', {
        verification: 'STATIC_CONTRACT',
      });
    }),

  makeCase('question_selection_algorithm_unchanged',
    'SubCategory preferences do not affect question selection yet',
    () => {
      const combinedGameplaySource = `${gamePageSource}\n${soloQuestionEngineSource}\n${getQuestionsFunctionSource}`;
      const forbidden = forbiddenTokens(combinedGameplaySource, [
        'UserSubCategoryPreference',
        'loadUserSubCategoryPreferences',
        'saveUserSubCategoryPreferences',
        'SubCategoryPreferencesSection',
      ]);
      if (forbidden.length) {
        return fail('SubCategory preferences leaked into gameplay/question selection too early.', {
          verification: 'STATIC_CONTRACT',
          files: ['src/pages/Game.jsx', 'src/lib/soloQuestionEngine.js', 'base44/functions/getQuestions/entry.ts'],
          forbidden,
        });
      }
      return pass('Gameplay/question selection code does not read SubCategory preference rows yet.', {
        verification: 'STATIC_CONTRACT',
      });
    }),

  makeCase('settings_admin_visibility_unchanged',
    'Settings admin tools remain AdminUser-gated and no debug panel returns',
    () => {
      const missing = missingTokens(settingsPageSource, [
        'const isAdmin = parsedAdminStatus',
        '{isAdmin && (',
        'QuestionAnalyticsReportTool',
        'ResetUserProgressTool',
      ]);
      const forbidden = forbiddenTokens(settingsPageSource, [
        'AdminDebug-v4',
        'AdminDebug',
      ]);
      if (missing.length || forbidden.length) {
        return fail('Settings admin visibility changed while adding SubCategory preferences.', {
          verification: 'STATIC_CONTRACT',
          file: 'src/pages/SettingsPage.jsx',
          actual: { missing, forbidden },
        });
      }
      return pass('Settings admin tools remain gated by backend AdminUser status and debug UI stays absent.', {
        verification: 'STATIC_CONTRACT',
      });
    }),

  makeCase('preference_rls_runtime_proof_required',
    'Two-account preference RLS proof remains manual',
    () => notAutomatable('Static Health can inspect RLS shape, but proving one user cannot read or update another user’s UserSubCategoryPreference rows requires a real two-account backend runtime probe.', {
      verification: 'NOT_AUTOMATABLE',
      actionType: ACTION_TYPES.BACKEND_RUNTIME_PROBE,
      runtimeProofRequired: true,
      manualSteps: [
        'User A saves at least 5 SubCategory preferences.',
        'User B opens Settings and cannot see User A selections.',
        'User B cannot update User A preference row through direct entity access.',
        'Admin account can inspect rows only through admin-authorized tooling when such tooling exists.',
      ],
    }),
    { actionType: ACTION_TYPES.BACKEND_RUNTIME_PROBE }),
];
