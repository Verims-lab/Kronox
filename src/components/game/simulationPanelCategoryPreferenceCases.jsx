// Kronox Health Center — Settings Category preference contracts.
//
// Scope: Settings-only main Category interest preferences. These cases do not
// prove runtime RLS with another account and do not connect preferences to
// question selection.

import categoryEntitySource from '../../../base44/entities/Category.jsonc?raw';
import subCategoryEntitySource from '../../../base44/entities/SubCategory.jsonc?raw';
import userCategoryPreferenceEntitySource from '../../../base44/entities/UserCategoryPreference.jsonc?raw';
import userSubCategoryPreferenceEntitySource from '../../../base44/entities/UserSubCategoryPreference.jsonc?raw';
import questionEntitySource from '../../../base44/entities/Question.jsonc?raw';
import appSource from '../../App.jsx?raw';
import settingsPageSource from '../../pages/SettingsPage.jsx?raw';
import playerSetupSource from '../../pages/PlayerSetup.jsx?raw';
import preferenceSectionSource from '../settings/CategoryPreferencesSection.jsx?raw';
import tutorialSource from '../tutorial/KronoxTutorial.jsx?raw';
import preferenceHelperSource from '../../lib/userCategoryPreferences.js?raw';
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
        'activeIds',
        '.filter((id) => activeIds.has(id))',
        'normalizeActiveIdSet',
        'activeIdSet.has(id)',
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
        'selectedSet.size < MIN_CATEGORY_SELECTION_COUNT',
        'selectedCount >= MIN_CATEGORY_SELECTION_COUNT',
        'En az 3 kategori seçmelisin.',
        'saveUserCategoryPreferences(user, selectedIds, activeCategories)',
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
      const forbidden = forbiddenTokens(`${preferenceHelperSource}\n${preferenceSectionSource}`, [
        'MAX_CATEGORY_SELECTION_COUNT',
        'MAX_SELECTED_CATEGORIES',
        'MAX_SUBCATEGORY_SELECTION_COUNT',
        'MAX_SELECTED_SUBCATEGORIES',
      ]);
      if (missing.length || forbidden.length) {
        return fail('Category preference selection may have gained an unintended max cap.', {
          verification: 'STATIC_CONTRACT',
          files: ['src/lib/userCategoryPreferences.js', 'src/components/settings/CategoryPreferencesSection.jsx'],
          actual: { missing, forbidden },
        });
      }
      return pass('No upper selection limit is present for Category preferences.', {
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

  makeCase('question_selection_algorithm_unchanged',
    'Category preferences do not affect question selection yet',
    () => {
      const combinedGameplaySource = [
        gamePageSource,
        soloQuestionEngineSource,
        onlineGameStartSource,
        getQuestionsFunctionSource,
        analyticsGatewaySource,
      ].join('\n');
      const forbidden = forbiddenTokens(combinedGameplaySource, [
        'UserCategoryPreference',
        'UserSubCategoryPreference',
        'loadUserCategoryPreferences',
        'saveUserCategoryPreferences',
        'CategoryPreferencesSection',
        'SubCategoryPreferencesSection',
      ]);
      if (forbidden.length) {
        return fail('Category/SubCategory preferences leaked into gameplay/question selection too early.', {
          verification: 'STATIC_CONTRACT',
          files: [
            'src/pages/Game.jsx',
            'src/lib/soloQuestionEngine.js',
            'src/lib/onlineGameStart.js',
            'base44/functions/getQuestions/entry.ts',
            'src/lib/dbGateway/analyticsGateway.js',
          ],
          forbidden,
        });
      }
      return pass('Solo, Online, getQuestions, and analytics code do not read Category preference rows yet.', {
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

  makeCase('onboarding_preference_gate_not_implemented',
    'First-time onboarding is not gated by Category preferences yet',
    () => {
      const onboardingSource = `${appSource}\n${playerSetupSource}\n${tutorialSource}`;
      const forbidden = forbiddenTokens(onboardingSource, [
        'UserCategoryPreference',
        'CategoryPreferencesSection',
        'İlgi Alanlarım',
        'loadUserCategoryPreferences',
        'MIN_CATEGORY_SELECTION_COUNT',
      ]);
      if (forbidden.length) {
        return fail('Category preference onboarding appears to have been introduced too early.', {
          verification: 'STATIC_CONTRACT',
          files: ['src/App.jsx', 'src/pages/PlayerSetup.jsx', 'src/components/tutorial/KronoxTutorial.jsx'],
          forbidden,
        });
      }
      return pass('First-open/tutorial/onboarding flow is not blocked by missing Category preferences.', {
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
        return fail('Settings admin visibility changed while adding Category preferences.', {
          verification: 'STATIC_CONTRACT',
          file: 'src/pages/SettingsPage.jsx',
          actual: { missing, forbidden },
        });
      }
      return pass('Settings admin tools remain gated by backend AdminUser status and debug UI stays absent.', {
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

  makeCase('docs_align_category_preference_phase',
    'Docs align on Settings-only Category preferences and deferred soft-weighting future',
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
        'There is no maximum selection',
        'Preferences do not yet affect question selection',
        'soft weighting, not hard filtering',
        'Onboarding preference selection is deferred',
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
      return pass('Docs/mirrors state Settings-only Category preferences, minimum/no-max rules, deferred onboarding, no gameplay filtering, retained SubCategory, and RLS proof needs.', {
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
