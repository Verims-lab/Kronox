// Kronox Health Center — Settings SubCategory preference contracts.
//
// Scope: Settings-only user interest preferences. These cases deliberately do
// not prove runtime RLS with another account and do not connect preferences to
// question selection.

import subCategoryEntitySource from '../../../base44/entities/SubCategory.jsonc?raw';
import userPreferenceEntitySource from '../../../base44/entities/UserSubCategoryPreference.jsonc?raw';
import questionEntitySource from '../../../base44/entities/Question.jsonc?raw';
import appSource from '../../App.jsx?raw';
import settingsPageSource from '../../pages/SettingsPage.jsx?raw';
import playerSetupSource from '../../pages/PlayerSetup.jsx?raw';
import preferenceSectionSource from '../settings/SubCategoryPreferencesSection.jsx?raw';
import tutorialSource from '../tutorial/KronoxTutorial.jsx?raw';
import preferenceHelperSource from '../../lib/userSubCategoryPreferences.js?raw';
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
  makeCase('subcategory_entity_readiness_contract',
    'SubCategory entity exists with active/passive status and Category-id references',
    () => {
      const schema = parseJsonSource(subCategoryEntitySource);
      const props = schema?.properties || {};
      const missingFields = ['id', 'main_category_1', 'main_category_2', 'name', 'status', 'description']
        .filter((field) => !Object.prototype.hasOwnProperty.call(props, field));
      const categoryReferenceDocs = [
        schema?.description,
        props.main_category_1?.description,
        props.main_category_2?.description,
      ].every((text) => String(text || '').includes('Category.category_id'));
      const statusEnum = Array.isArray(props.status?.enum) ? props.status.enum : [];
      const statusOk = statusEnum.includes('A') && statusEnum.includes('P') && props.status?.default === 'A';
      const rls = schema?.rls || {};
      const readPublic = rls.read && Object.keys(rls.read).length === 0;
      const writesAdminOnly = ['create', 'update', 'delete'].every((op) => rls?.[op]?.user_condition?.role === 'admin');
      const questionSchema = parseJsonSource(questionEntitySource);
      const questionProps = questionSchema?.properties || {};
      const questionBoundaryOk = questionProps.sub_category?.type === 'string'
        && !Object.prototype.hasOwnProperty.call(questionProps, 'sub_category_id');

      if (missingFields.length || !categoryReferenceDocs || !statusOk || !readPublic || !writesAdminOnly || !questionBoundaryOk) {
        return fail('SubCategory readiness contract is incomplete or Question was migrated too early.', {
          verification: 'STATIC_CONTRACT',
          files: ['base44/entities/SubCategory.jsonc', 'base44/entities/Question.jsonc'],
          actual: {
            missingFields,
            categoryReferenceDocs,
            statusEnum,
            defaultStatus: props.status?.default,
            readPublic,
            writesAdminOnly,
            questionBoundaryOk,
          },
        });
      }
      return pass('SubCategory is a separate active/passive lookup table and Question.sub_category remains unmigrated.', {
        verification: 'STATIC_CONTRACT',
      });
    }),

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

  makeCase('passive_previous_selections_are_not_resaved_active',
    'Previously selected now-passive SubCategories are removed from active UI/save state',
    () => {
      const missing = missingTokens(`${preferenceHelperSource}\n${preferenceSectionSource}`, [
        'activeIds',
        '.filter((id) => activeIds.has(id))',
        'normalizeActiveIdSet',
        'activeIdSet.has(id)',
        'status: SUBCATEGORY_STATUS_PASSIVE',
      ]);
      if (missing.length) {
        return fail('Passive or removed SubCategory preferences may remain selectable or be saved active.', {
          verification: 'STATIC_CONTRACT',
          files: ['src/lib/userSubCategoryPreferences.js', 'src/components/settings/SubCategoryPreferencesSection.jsx'],
          missing,
        });
      }
      return pass('Saved selections are intersected with active SubCategories and invalid rows are passivated on save.', {
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

  makeCase('preferences_are_not_localstorage_source_of_truth',
    'SubCategory preferences are persisted through Base44, not localStorage-only UI state',
    () => {
      const missing = missingTokens(preferenceHelperSource, [
        'base44.entities.UserSubCategoryPreference.filter',
        'base44.entities.UserSubCategoryPreference.update',
        'base44.entities.UserSubCategoryPreference.create',
      ]);
      const forbidden = forbiddenTokens(`${preferenceHelperSource}\n${preferenceSectionSource}`, [
        'localStorage',
        'sessionStorage',
      ]);
      if (missing.length || forbidden.length) {
        return fail('SubCategory preferences may no longer be durable Base44-backed user preferences.', {
          verification: 'STATIC_CONTRACT',
          files: ['src/lib/userSubCategoryPreferences.js', 'src/components/settings/SubCategoryPreferencesSection.jsx'],
          actual: { missing, forbidden },
        });
      }
      return pass('Preferences use UserSubCategoryPreference rows as source-of-truth and no localStorage preference source exists.', {
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
      const statusEnum = Array.isArray(props.status?.enum) ? props.status.enum : [];
      const statusOk = statusEnum.includes('A') && statusEnum.includes('P') && props.status?.default === 'A';
      const subCategoryReferenceDoc = String(schema?.description || '').includes('SubCategory.id')
        && String(props.sub_category_id?.description || '').includes('SubCategory.id');
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
      if (missingFields.length || !statusOk || !subCategoryReferenceDoc || !createScoped || !readScoped || !updateScoped || helperMissing.length) {
        return fail('UserSubCategoryPreference persistence is not clearly user-scoped.', {
          verification: 'STATIC_CONTRACT',
          file: 'base44/entities/UserSubCategoryPreference.jsonc',
          actual: {
            missingFields,
            statusEnum,
            defaultStatus: props.status?.default,
            subCategoryReferenceDoc,
            createScoped,
            readScoped,
            updateScoped,
            helperMissing,
          },
        });
      }
      return pass('Preference rows are user-owned, scoped by user email, and unselected rows become passive.', {
        verification: 'STATIC_CONTRACT',
      });
    }),

  makeCase('duplicate_active_preferences_are_collapsed_or_documented',
    'Duplicate active preference rows are avoided by code path and tracked as a DB uniqueness risk',
    () => {
      const missing = missingTokens(`${preferenceHelperSource}\n${dbArchitectureDocSource}`, [
        'duplicateRows',
        'bySubCategoryId',
        'status: SUBCATEGORY_STATUS_PASSIVE',
        'user_email + sub_category_id',
        'Base44 index/unique-key declarations are a platform/manual configuration gap',
      ]);
      if (missing.length) {
        return fail('Duplicate active UserSubCategoryPreference rows are not guarded or documented.', {
          verification: 'STATIC_CONTRACT',
          files: ['src/lib/userSubCategoryPreferences.js', 'docs/KRONOX_DB_ARCHITECTURE.md'],
          missing,
        });
      }
      return pass('Save path passivates duplicates and docs keep platform unique-key proof visible as manual risk.', {
        verification: 'STATIC_CONTRACT',
      });
    }),

  makeCase('question_selection_algorithm_unchanged',
    'SubCategory preferences do not affect question selection yet',
    () => {
      const combinedGameplaySource = [
        gamePageSource,
        soloQuestionEngineSource,
        onlineGameStartSource,
        getQuestionsFunctionSource,
        analyticsGatewaySource,
      ].join('\n');
      const forbidden = forbiddenTokens(combinedGameplaySource, [
        'UserSubCategoryPreference',
        'loadUserSubCategoryPreferences',
        'saveUserSubCategoryPreferences',
        'SubCategoryPreferencesSection',
      ]);
      if (forbidden.length) {
        return fail('SubCategory preferences leaked into gameplay/question selection too early.', {
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
      return pass('Solo, Online, getQuestions, and analytics code do not read SubCategory preference rows yet.', {
        verification: 'STATIC_CONTRACT',
      });
    }),

  makeCase('onboarding_preference_gate_not_implemented',
    'First-time onboarding is not gated by SubCategory preferences yet',
    () => {
      const onboardingSource = `${appSource}\n${playerSetupSource}\n${tutorialSource}`;
      const forbidden = forbiddenTokens(onboardingSource, [
        'UserSubCategoryPreference',
        'SubCategoryPreferencesSection',
        'İlgi Alanlarım',
        'loadUserSubCategoryPreferences',
        'MIN_SUBCATEGORY_SELECTION_COUNT',
      ]);
      if (forbidden.length) {
        return fail('SubCategory preference onboarding appears to have been introduced too early.', {
          verification: 'STATIC_CONTRACT',
          files: ['src/App.jsx', 'src/pages/PlayerSetup.jsx', 'src/components/tutorial/KronoxTutorial.jsx'],
          forbidden,
        });
      }
      return pass('First-open/tutorial/onboarding flow is not blocked by missing SubCategory preferences.', {
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

  makeCase('settings_mobile_ui_static_guardrails',
    'Settings SubCategory preference UI has mobile-safe wrapping and reachable save controls',
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
        return fail('Settings SubCategory preference UI lost static mobile wrapping/reachable-save guardrails.', {
          verification: 'STATIC_CONTRACT',
          file: 'src/components/settings/SubCategoryPreferencesSection.jsx',
          missing,
        });
      }
      return pass('Static mobile guardrails are present for wrapping chips/list rows and the full-width save control.', {
        verification: 'STATIC_CONTRACT',
      });
    }),

  makeCase('docs_align_subcategory_preference_phase',
    'Docs align on Settings-only SubCategory preferences and deferred soft-weighting future',
    () => {
      const combinedDocs = [
        questionDataModelDocSource,
        dbArchitectureDocSource,
        releaseProofChecklistDocSource,
        securityDeploymentDocSource,
      ].join('\n');
      const missing = missingTokens(combinedDocs, [
        'SubCategory',
        'UserSubCategoryPreference',
        'İlgi Alanlarım',
        'Minimum selection count is 5',
        'There is no maximum selection',
        'Preferences do not yet affect question selection',
        'soft weighting, not hard filtering',
        'Onboarding preference selection is deferred',
        'RLS',
      ]);
      if (missing.length) {
        return fail('Docs/mirrors no longer align with the staged SubCategory preference contract.', {
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
      return pass('Docs/mirrors state Settings-only preferences, minimum/no-max rules, deferred onboarding, no gameplay filtering, and RLS proof needs.', {
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

  makeCase('preference_mobile_visual_runtime_proof_required',
    'Mobile visual proof for preference chips/list remains manual',
    () => notAutomatable('Static Health checks wrapping classes, but real mobile proof is still required for long SubCategory names, touch targets, Settings scroll, safe area, and save-button reachability.', {
      verification: 'NOT_AUTOMATABLE',
      runtimeProofRequired: true,
      manualSteps: [
        'Open Settings on a narrow mobile viewport/device.',
        'Verify İlgi Alanlarım chips and list rows wrap without horizontal overflow.',
        'Verify long SubCategory names remain readable and the Kaydet button is reachable.',
        'Verify validation text is visible when fewer than 5 interests are selected.',
      ],
    })),
];
