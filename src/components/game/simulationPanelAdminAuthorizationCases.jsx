// Codex200 — Health/security contracts for DB-backed admin authorization.
//
// This suite makes the regression detectable from Health Center:
//   • No literal admin email string remains in the admin-only functions.
//   • Admin authorization source-of-truth is the private AdminUser entity.
//   • Backend admin-only functions use AdminUser-backed authorization.
//   • Shared guard imports are preferred where deployable; the Base44 callable
//     analytics report and Daily Quest definition manager are known
//     flat-runtime exceptions and must use verified inline AdminUser guards
//     instead.
//   • Admin/test reset email env allowlists are not used for authorization.
//   • Runtime active/disabled AdminUser proof remains NOT_AUTOMATABLE.
//
// PASS proves static source contracts only. Deployed AdminUser rows and RLS
// behavior must still be verified with real admin/non-admin accounts.

import adminAuthSource from '../../../base44/functions/_shared/adminAuth.ts?raw';
import adminUserEntitySource from '../../../base44/entities/AdminUser.jsonc?raw';
import getAdminStatusSource from '../../../base44/functions/getAdminStatus/entry.ts?raw';
import getAdminStatusConfigSource from '../../../base44/functions/getAdminStatus/function.jsonc?raw';
import generateTechDocSource from '../../../base44/functions/generateTechDoc/entry.ts?raw';
import generateWorkflowDocSource from '../../../base44/functions/generateWorkflowDoc/entry.ts?raw';
import seedQuestionCategoriesSource from '../../../base44/functions/seedQuestionCategories/entry.ts?raw';
import adminResetUserProgressSource from '../../../base44/functions/adminResetUserProgress/entry.ts?raw';
import cleanupAdminMaintenanceLogSource from '../../../base44/functions/cleanupAdminMaintenanceLog/entry.ts?raw';
import expireOldGameInvitesSource from '../../../base44/functions/expireOldGameInvites/entry.ts?raw';
import expirePushSubscriptionsSource from '../../../base44/functions/expirePushSubscriptions/entry.ts?raw';
import refreshLeaderboardProjectionSource from '../../../base44/functions/refreshLeaderboardProjection/entry.ts?raw';
import resetTestAccountProgressSource from '../../../base44/functions/resetTestAccountProgress/entry.ts?raw';
import sendQuestionAnalyticsReportEmailSource from '../../../base44/functions/sendQuestionAnalyticsReportEmail/entry.ts?raw';
import createDailyQuestDefinitionSource from '../../../base44/functions/createDailyQuestDefinition/entry.ts?raw';
import aggregateQuestionStatsSource from '../../../base44/functions/aggregateQuestionStats/entry.ts?raw';
import cancelStaleLobbiesSource from '../../../base44/functions/cancelStaleLobbies/entry.ts?raw';
import simulateOnlineGameSource from '../../../base44/functions/simulateOnlineGame/entry.ts?raw';
import getQuestionsSource from '../../../base44/functions/getQuestions/entry.ts?raw';
import adminMaintenanceLogSchemaSource from '../../../base44/entities/AdminMaintenanceLog.jsonc?raw';
import userSchemaSource from '../../../base44/entities/User.jsonc?raw';
// Codex — Vite cannot `?raw`-import markdown outside /src on this host
// (.md?raw breaks the build). Use the in-src JS doc mirrors instead.
import {
  SECURITY_DEPLOYMENT_DOC as securityDeploymentDocSource,
  RELEASE_PROOF_CHECKLIST_DOC as releaseProofChecklistSource,
} from '@/lib/healthAlignmentDocMirrors';
import settingsPageSource from '../../pages/SettingsPage.jsx?raw';
import adminPageSource from '../../pages/AdminPage.jsx?raw';
import testSuitePageSource from '../../pages/TestSuite.jsx?raw';
import resetUserProgressToolSource from '../../components/admin/ResetUserProgressTool.jsx?raw';
import authContextSource from '../../lib/AuthContext.jsx?raw';
import adminSource from '../../lib/admin.js?raw';
import appParamsSource from '../../lib/app-params.js?raw';
import base44ClientSource from '../../api/base44Client.js?raw';
import progressResetCacheSource from '../../lib/progressResetCache.js?raw';

// Codex212 merge alignment: the callable admin-status implementation now lives
// in the Base44 function mirror; keep the static Health aggregate pointed at
// the real deployed source instead of a deleted root wrapper file.
const rootGetAdminStatusSource = getAdminStatusSource;

export const EXTRA_SUITES = [
  {
    id: 'admin_authorization_hardening',
    name: 'Admin Authorization Hardening (Security)',
    critical: true,
    color: 'rose',
  },
];

const ACTION_TYPES = {
  CODE_FIX: 'CODE_FIX',
  MANUAL_VERIFY: 'MANUAL_VERIFY',
  BACKEND_RUNTIME_PROBE: 'BACKEND_RUNTIME_PROBE',
};

const STATUS = {
  PASS: 'PASS',
  FAIL: 'FAIL',
  NOT_AUTOMATABLE: 'NOT_AUTOMATABLE',
};

function safeStr(value) {
  return typeof value === 'string' ? value : '';
}

function pass(message, extras = {}) {
  return { status: STATUS.PASS, message, ...extras };
}

function fail(message, extras = {}) {
  return { status: STATUS.FAIL, message, ...extras };
}

function notAutomatable(message, extras = {}) {
  return { status: STATUS.NOT_AUTOMATABLE, message, ...extras };
}

function makeCase(suiteId, suiteName, id, description, run, opts = {}) {
  return {
    key: `${suiteId}.${id}`,
    suiteId,
    suiteName,
    id,
    description,
    run,
    critical: opts.critical !== false,
    actionType: opts.actionType || ACTION_TYPES.CODE_FIX,
  };
}

// Email-shaped literal: anything that looks like x@y.z inside the source.
// We deliberately do NOT include a real admin address here — that would
// reintroduce the very thing we want banned. The regex catches any
// quoted email literal, which is what the security finding flags.
const EMAIL_LITERAL_REGEX = /['"][\w.+-]+@[\w-]+\.[\w.-]+['"]/g;

function findEmailLiterals(src) {
  const matches = src.match(EMAIL_LITERAL_REGEX) || [];
  return matches;
}

const TARGET_FUNCTIONS = [
  { name: 'generateTechDoc', source: generateTechDocSource },
  { name: 'generateWorkflowDoc', source: generateWorkflowDocSource },
  { name: 'seedQuestionCategories', source: seedQuestionCategoriesSource },
  { name: 'adminResetUserProgress', source: adminResetUserProgressSource },
  { name: 'cleanupAdminMaintenanceLog', source: cleanupAdminMaintenanceLogSource },
  { name: 'expireOldGameInvites', source: expireOldGameInvitesSource },
  { name: 'expirePushSubscriptions', source: expirePushSubscriptionsSource },
  { name: 'refreshLeaderboardProjection', source: refreshLeaderboardProjectionSource },
  { name: 'resetTestAccountProgress', source: resetTestAccountProgressSource },
  { name: 'sendQuestionAnalyticsReportEmail', source: sendQuestionAnalyticsReportEmailSource },
  { name: 'createDailyQuestDefinition', source: createDailyQuestDefinitionSource },
  { name: 'aggregateQuestionStats', source: aggregateQuestionStatsSource },
  { name: 'cancelStaleLobbies', source: cancelStaleLobbiesSource },
  { name: 'simulateOnlineGame', source: simulateOnlineGameSource },
  { name: 'getAdminStatus', source: getAdminStatusSource },
  { name: 'getQuestions', source: getQuestionsSource },
];

const LEGACY_ADMIN_ENV_TOKENS = [
  `Deno.env.get('${['ADMIN', 'EMAILS'].join('_')}')`,
  `Deno.env.get("${['ADMIN', 'EMAILS'].join('_')}")`,
  `Deno.env.get('${['KRONOX', 'ADMIN', 'EMAILS'].join('_')}')`,
  `Deno.env.get("${['KRONOX', 'ADMIN', 'EMAILS'].join('_')}")`,
  `Deno.env.get('${['KRONOX', 'TEST', 'RESET', 'EMAILS'].join('_')}')`,
  `Deno.env.get("${['KRONOX', 'TEST', 'RESET', 'EMAILS'].join('_')}")`,
  `Deno.env.get('${['TEST', 'RESET', 'EMAILS'].join('_')}')`,
  `Deno.env.get("${['TEST', 'RESET', 'EMAILS'].join('_')}")`,
  ['get', 'AdminEmails'].join(''),
  ['get', 'ConfiguredAdminEmails'].join(''),
  ['get', 'ResettableTestEmails'].join(''),
  ['configured', 'EmailList'].join(''),
];

export const EXTRA_TESTS = [
  // 1) No hardcoded email literal remains in any of the three functions.
  makeCase(
    'admin_authorization_hardening', 'Admin Authorization Hardening (Security)',
    'no_hardcoded_admin_email_literal',
    'None of the admin-only functions contain a quoted email-shaped literal in source (AdminUser is the admin source of truth)',
    () => {
      const offenders = [];
      for (const fn of TARGET_FUNCTIONS) {
        const src = safeStr(fn.source);
        const emails = findEmailLiterals(src);
        if (emails.length > 0) {
          offenders.push({ function: fn.name, count: emails.length });
        }
      }
      if (offenders.length) {
        return fail('A hardcoded admin email literal is still present in a protected backend function.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          file: 'base44/functions/{generateTechDoc,generateWorkflowDoc,seedQuestionCategories}/entry.ts',
          expected: 'No quoted email literal in admin-only function source',
          actual: { offenders },
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      return pass('No hardcoded admin email literals remain in the admin-only functions.', {
        verification: 'STATIC_CONTRACT',
        classification: 'STATIC_CHECK_LIMITATION',
        actionType: ACTION_TYPES.CODE_FIX,
      });
    },
  ),

  // 2) AdminUser exists and is the DB-backed source-of-truth.
  makeCase(
    'admin_authorization_hardening', 'Admin Authorization Hardening (Security)',
    'admin_user_entity_exists',
    'AdminUser entity exists with email, role, and active/disabled status fields',
    () => {
      const missing = [
        'AdminUser',
        '"email"',
        '"role"',
        '"owner"',
        '"admin"',
        '"status"',
        '"active"',
        '"disabled"',
        '"rls"',
      ].filter((token) => !safeStr(adminUserEntitySource).includes(token));
      if (missing.length) {
        return fail('AdminUser entity is missing the required DB-backed admin authorization fields.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          expected: 'AdminUser email + role owner/admin + status active/disabled + private/admin RLS',
          actual: { missing },
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      return pass('AdminUser entity is present as the DB-backed admin source-of-truth.', {
        verification: 'STATIC_CONTRACT',
        classification: 'STATIC_CHECK_LIMITATION',
        actionType: ACTION_TYPES.CODE_FIX,
      });
    },
  ),

  // 3) Shared AdminUser guard exists.
  makeCase(
    'admin_authorization_hardening', 'Admin Authorization Hardening (Security)',
    'shared_admin_guard_uses_admin_user',
    'Shared backend admin guard checks active AdminUser rows by normalized authenticated email',
    () => {
      const missing = [
        'getAdminAuthorization',
        'requireAdmin',
        'base44.auth.me()',
        'entities?.AdminUser',
        'FIELD_CANDIDATES',
        '.filter({ [field]: email }',
        'status',
        'active',
        'owner',
        'admin',
        '403',
      ].filter((token) => !safeStr(adminAuthSource).includes(token));
      const forbidden = LEGACY_ADMIN_ENV_TOKENS.filter((token) => safeStr(adminAuthSource).includes(token));
      if (missing.length || forbidden.length) {
        return fail('Shared admin guard does not clearly use AdminUser as the backend source-of-truth.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          expected: 'auth.me + service-role AdminUser lookup + active owner/admin role + 401/403 failures; no env email allowlist',
          actual: { missing, forbidden },
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      return pass('Shared admin guard is AdminUser-backed and does not read admin email env allowlists.', {
        verification: 'STATIC_CONTRACT',
        classification: 'STATIC_CHECK_LIMITATION',
        actionType: ACTION_TYPES.CODE_FIX,
      });
    },
  ),

  // 4) Affected functions use AdminUser-backed guards.
  makeCase(
    'admin_authorization_hardening', 'Admin Authorization Hardening (Security)',
    'admin_functions_use_shared_admin_guard',
    'Admin-only functions use AdminUser-backed authorization; shared guard is preferred where deployable and Base44 flat runtime exceptions must inline the same guard contract',
    () => {
      const missing = [];
      const allowedAlternatives = new Map([
        ['getQuestions', 'isAuthorizedAdmin'],
        ['getAdminStatus', 'getAdminAuthorization'],
      ]);
      const inlineGuardExceptions = new Map([
        ['sendQuestionAnalyticsReportEmail', [
          'function requireAdmin(base44)',
          'getAdminAuthorization',
          'entities?.AdminUser',
          "value === 'owner' || value === 'admin'",
          'isActiveStatus',
          'Admin access required',
          'requireAdmin(base44)',
          'if (admin.response) return admin.response',
        ]],
        ['createDailyQuestDefinition', [
          'function requireAdmin(base44)',
          'getAdminAuthorization',
          'entities?.AdminUser',
          "value === 'owner' || value === 'admin'",
          'isActiveStatus',
          'Admin yetkisi gerekli.',
          'requireAdmin(base44)',
          'if (admin.response) return admin.response',
        ]],
      ]);
      const brokenLocalImportTokens = [
        "from './_shared/adminAuth.js'",
        "from './_shared/adminAuth.ts'",
        "from '../_shared/adminAuth.js'",
        "from '../_shared/adminAuth.ts'",
        "from '/src/_shared/adminAuth",
        'file://' + '/src/_shared/adminAuth',
      ];
      for (const fn of TARGET_FUNCTIONS) {
        const src = safeStr(fn.source);
        const inlineRequired = inlineGuardExceptions.get(fn.name);
        if (inlineRequired) {
          const missingInline = inlineRequired.filter((token) => !src.includes(token));
          const brokenLocalImports = brokenLocalImportTokens.filter((token) => src.includes(token));
          if (missingInline.length || brokenLocalImports.length) {
            missing.push({
              function: fn.name,
              mode: 'verified_inline_admin_user_guard',
              missing: missingInline,
              forbidden: brokenLocalImports,
            });
          }
          continue;
        }
        const helper = allowedAlternatives.get(fn.name) || 'requireAdmin';
        if (!src.includes("../_shared/adminAuth.ts") || !src.includes(helper)) {
          missing.push({ function: fn.name, mode: 'shared_admin_guard', missing: [helper] });
        }
      }
      if (missing.length) {
        return fail('An admin-only function is not using accepted AdminUser-backed authorization.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          expected: 'Use shared ../_shared/adminAuth.ts guard where deployable, or verified inline AdminUser guard for Base44 flat-runtime exceptions such as sendQuestionAnalyticsReportEmail/createDailyQuestDefinition',
          actual: { missingIn: missing },
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      return pass('Affected admin functions use accepted AdminUser-backed authorization. Shared guard is preferred; flat Base44 callable exceptions use verified inline AdminUser guards.', {
        verification: 'STATIC_CONTRACT',
        classification: 'STATIC_CHECK_LIMITATION',
        actionType: ACTION_TYPES.CODE_FIX,
      });
    },
  ),

  makeCase(
    'admin_authorization_hardening', 'Admin Authorization Hardening (Security)',
    'simulate_online_game_admin_guard_typo_removed',
    'simulateOnlineGame rejects scanner typo role checks and uses AdminUser-backed authorization',
    () => {
      const src = safeStr(simulateOnlineGameSource);
      const missing = [
        "import { requireAdmin } from '../_shared/adminAuth.ts'",
        'const admin = await requireAdmin(base44)',
        'if (admin.response) return admin.response',
        'base44.asServiceRole.entities.Lobby.create',
        'base44.asServiceRole.entities.Lobby.delete',
      ].filter((token) => !src.includes(token));
      const forbidden = [
        'en_core_news_sm',
        'user.role',
        'body.role',
        'requestRole',
        'admin_email',
        'ADMIN_EMAIL',
      ].filter((token) => src.includes(token));
      if (missing.length || forbidden.length) {
        return fail('simulateOnlineGame admin authorization is not clearly hardened.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          expected: 'AdminUser-backed requireAdmin guard before service-role simulation writes; no typo/client/profile role trust.',
          actual: { missing, forbidden },
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      return pass('simulateOnlineGame uses the shared AdminUser guard and contains no scanner typo/client-role authorization tokens.', {
        verification: 'STATIC_CONTRACT',
        classification: 'STATIC_CHECK_LIMITATION',
        actionType: ACTION_TYPES.CODE_FIX,
      });
    },
  ),

  // 5) Env email allowlists are not used for authorization.
  makeCase(
    'admin_authorization_hardening', 'Admin Authorization Hardening (Security)',
    'admin_email_env_allowlist_not_used',
    'Admin authorization does not read admin/test reset email allowlists from environment variables',
    () => {
      const offenders = [];
      for (const fn of TARGET_FUNCTIONS) {
        const src = safeStr(fn.source);
        const forbidden = LEGACY_ADMIN_ENV_TOKENS.filter((token) => src.includes(token));
        if (forbidden.length) offenders.push({ function: fn.name, forbidden });
      }
      if (offenders.length) {
        return fail('Admin email env allowlist usage remains in a protected backend function.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          expected: 'No legacy admin email env reads for admin authorization',
          actual: { offenders },
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      return pass('Protected backend functions no longer read admin email env allowlists.', {
        verification: 'STATIC_CONTRACT',
        classification: 'STATIC_CHECK_LIMITATION',
        actionType: ACTION_TYPES.CODE_FIX,
      });
    },
  ),

  makeCase(
    'admin_authorization_hardening', 'Admin Authorization Hardening (Security)',
    'reset_test_account_progress_adminuser_guard',
    'resetTestAccountProgress uses AdminUser-backed authorization and exact target confirmation instead of env email allowlists',
    () => {
      const src = safeStr(resetTestAccountProgressSource);
      const required = [
        "import { requireAdmin } from '../_shared/adminAuth.ts'",
        'const adminAuth = await requireAdmin(base44)',
        'if (adminAuth.response) return adminAuth.response',
        'confirmEmail',
        'confirmation_mismatch',
        "source: 'AdminUser'",
        'role: adminAuth.adminRole',
        'base44.asServiceRole.entities.User.update',
        'updateSoloLeaderboardRows',
      ].filter((token) => !src.includes(token));
      const forbidden = [
        'KRONOX_TEST_RESET_EMAILS',
        'TEST_RESET_EMAILS',
        'getConfiguredEmails',
        'getResettableTestEmails',
        'test_account_not_allowlisted',
        'body?.role',
        'user.role',
      ].filter((token) => src.includes(token));
      if (required.length || forbidden.length) {
        return fail('resetTestAccountProgress can still drift from the AdminUser-backed reset contract.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          file: 'base44/functions/resetTestAccountProgress/entry.ts',
          expected: 'AdminUser-backed requireAdmin + exact target-email confirmation + no KRONOX_TEST_RESET_EMAILS/TEST_RESET_EMAILS runtime auth',
          actual: { missing: required, forbidden },
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      return pass('resetTestAccountProgress is AdminUser-gated, exact-email confirmed, and no longer reads test reset email allowlists.', {
        verification: 'STATIC_CONTRACT',
        classification: 'STATIC_CHECK_LIMITATION',
        actionType: ACTION_TYPES.CODE_FIX,
      });
    },
  ),

  makeCase(
    'admin_authorization_hardening', 'Admin Authorization Hardening (Security)',
    'reset_test_account_progress_runtime_probe_needed',
    'Runtime probe: resetTestAccountProgress blocks unauthenticated, normal, and disabled admins',
    () => notAutomatable('Static Health can verify the AdminUser guard and absence of env allowlist auth, but deployed proof still requires calls as unauthenticated, normal user, disabled/passive admin, and active owner/admin with exact target-email confirmation.', {
      verification: 'NOT_AUTOMATABLE',
      classification: 'DEPLOYMENT_RUNTIME_REQUIRED',
      verificationLabels: ['NOT_AUTOMATABLE', 'BACKEND_RUNTIME_PROBE', 'MANUAL_REQUIRED'],
      actionType: ACTION_TYPES.BACKEND_RUNTIME_PROBE,
      expected: 'unauthenticated -> 401; normal user -> 403; disabled/passive admin -> 403; active owner/admin + confirmEmail -> success for intended test target',
    }),
    { actionType: ACTION_TYPES.BACKEND_RUNTIME_PROBE },
  ),

  // 6) Admin source-of-truth is documented and bootstrapping stays manual.
  makeCase(
    'admin_authorization_hardening', 'Admin Authorization Hardening (Security)',
    'admin_source_of_truth_documented',
    'Admin source-of-truth and bootstrap process are documented as AdminUser-backed',
    () => {
      const combined = `${securityDeploymentDocSource}\n${releaseProofChecklistSource}`;
      const required = [
        'AdminUser',
        'Current source of truth',
        'Shared backend guard',
        'active',
        'disabled',
        'role: "admin"',
        'status: "active"',
        'There is no unsafe "if no admin exists, everyone is admin" fallback',
        'commit the personal admin emails to source',
        'VAPID private key',
      ].filter((token) => !combined.includes(token));
      if (required.length) {
        return fail('AdminUser source-of-truth or bootstrap docs are incomplete.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          expected: 'Docs explain AdminUser source, manual bootstrap, add/remove process, disabled-admin proof, and VAPID remains a real secret.',
          actual: { missing: required },
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      return pass('Admin source-of-truth and bootstrap process are documented as AdminUser-backed.', {
        verification: 'STATIC_CONTRACT',
        classification: 'STATIC_CHECK_LIMITATION',
        actionType: ACTION_TYPES.CODE_FIX,
      });
    },
  ),

  makeCase(
    'admin_authorization_hardening', 'Admin Authorization Hardening (Security)',
    'admin_ui_uses_backend_status_hint',
    'Admin Ekranı and test-suite admin UI consume backend AdminUser status without exposing AdminUser rows',
    () => {
      const combined = `${getAdminStatusSource}\n${getAdminStatusConfigSource}\n${rootGetAdminStatusSource}\n${authContextSource}\n${adminSource}\n${adminPageSource}\n${testSuitePageSource}`;
      const required = [
        '"name": "getAdminStatus"',
        '"entry": "entry.ts"',
        'Deno.serve',
        "statusFunction: 'getAdminStatus'",
        "invokeFunctionJson('getAdminStatus'",
        'unwrapFunctionBody',
        'value.data',
        'value.data.data',
        'getAdminAuthorization',
        'getCurrentAdminStatus',
        'withAdminStatus',
        'adminStatus',
        'refreshAdminStatus',
        'admin_status_source',
        'admin_status_debug',
        'backendDebug',
        'admin_status_shape_missing',
        'response_parse_error',
        'useAuth()',
        'const parsedAdminStatus',
        'const isAdmin = parsedAdminStatus',
        'if (!isAdmin)',
        'isAdminUser(user)',
        'Admin Ekranı',
        'QuestionAnalyticsReportTool',
        'ResetUserProgressTool',
        'DailyQuestDefinitionManager',
        'Regression Test Panel',
      ].filter((token) => !combined.includes(token));
      const forbidden = [
        'AdminDebug-v4',
        'AdminStatusDebugPanel',
        'Settings component version',
        'Admin status call attempted',
        'Raw response shape',
        'AdminUser lookup source',
      ].filter((token) => safeStr(settingsPageSource).includes(token));
      if (required.length || forbidden.length) {
        return fail('Admin UI status is not clearly backed by the AdminUser status function.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          expected: 'AuthContext enriches current user through getAdminStatus; Admin Ekranı/TestSuite use that user for UI gating.',
          actual: { missing: required, forbidden },
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      return pass('Production admin UI surfaces use the backend AdminUser status hint without the temporary AdminDebug-v4 panel.', {
        verification: 'STATIC_CONTRACT',
        classification: 'STATIC_CHECK_LIMITATION',
        actionType: ACTION_TYPES.CODE_FIX,
      });
    },
  ),

  makeCase(
    'admin_authorization_hardening', 'Admin Authorization Hardening (Security)',
    'admin_status_does_not_use_get_questions_fallback',
    'Admin status uses getAdminStatus and rejects question projection responses',
    () => {
      const forbiddenAdminSource = [
        "fetchFunctionJson('/getQuestions'",
        "invokeFunctionJson('getQuestions'",
        "action: 'admin_status'",
        "statusFunction: 'getQuestions'",
        'authenticated_minimal_projection',
      ].filter((token) => safeStr(adminSource).includes(token));
      const required = [
        'hasAdminStatusShape',
        'admin_status_shape_missing',
        'response_parse_error',
        "invokeFunctionJson('getAdminStatus'",
        'statusFunction: \'getAdminStatus\'',
        'entities?.AdminUser',
        '"name": "getAdminStatus"',
        '"entry": "entry.ts"',
      ].filter((token) => !`${adminSource}\n${getAdminStatusSource}\n${getAdminStatusConfigSource}\n${rootGetAdminStatusSource}\n${adminAuthSource}`.includes(token));
      if (forbiddenAdminSource.length || required.length) {
        return fail('Admin status can still call getQuestions or parse non-admin payloads.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          expected: 'Only getAdminStatus/AdminUser status payloads can drive Admin Ekranı admin UI.',
          actual: { forbiddenAdminSource, missing: required },
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      return pass('Admin status only accepts dedicated getAdminStatus/AdminUser responses.', {
        verification: 'STATIC_CONTRACT',
        classification: 'STATIC_CHECK_LIMITATION',
        actionType: ACTION_TYPES.CODE_FIX,
      });
    },
  ),

  makeCase(
    'admin_authorization_hardening', 'Admin Authorization Hardening (Security)',
    'admin_status_not_pinned_to_stale_functions_version',
    'Base44 function calls are not pinned to a stale functions_version catalog',
    () => {
      const forbidden = [
        'functionsVersion',
        'VITE_BASE44_FUNCTIONS_VERSION',
        'Base44-Functions-Version',
        'getFreshFunctionVersion',
      ].filter((token) => `${base44ClientSource}\n${appParamsSource}`.includes(token));
      const required = [
        "storage.removeItem('base44_functions_version')",
        "invokeFunctionJson('getAdminStatus'",
      ].filter((token) => !`${base44ClientSource}\n${appParamsSource}\n${adminSource}`.includes(token));
      if (forbidden.length || required.length) {
        return fail('Admin status can still be pinned to a stale Base44 functions catalog.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          expected: 'Base44 client omits functionsVersion and Settings invokes getAdminStatus by name.',
          actual: { forbidden, missing: required },
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      return pass('Function calls are not pinned to a stale Base44 functions_version catalog.', {
        verification: 'STATIC_CONTRACT',
        classification: 'STATIC_CHECK_LIMITATION',
        actionType: ACTION_TYPES.CODE_FIX,
      });
    },
  ),

  makeCase(
    'admin_authorization_hardening', 'Admin Authorization Hardening (Security)',
    'settings_admin_debug_v4_removed_from_production',
    'Settings removes AdminDebug-v4 and admin-only tools move to gated Admin Ekranı',
    () => {
      const required = [
        'adminStatus',
        'const parsedAdminStatus',
        'const isAdmin = parsedAdminStatus',
        'if (!isAdmin)',
        'Admin Ekranı',
        'QuestionAnalyticsReportTool',
        'ResetUserProgressTool',
        'DailyQuestDefinitionManager',
        'SimulationPanel',
      ].filter((token) => !safeStr(adminPageSource).includes(token));
      const forbidden = [
        'SETTINGS_ADMIN_DEBUG_VERSION',
        'AdminDebug-v4',
        'AdminStatusDebugPanel',
        'Settings component version',
        'Auth email raw',
        'Auth email normalized',
        'Admin status call attempted',
        'Raw response shape',
        'Parsed isAdmin',
        'AdminUser lookup source',
        'Admin tools actually mounted',
      ].filter((token) => safeStr(settingsPageSource).includes(token));
      const settingsAdminTools = [
        'QuestionAnalyticsReportTool',
        'ResetUserProgressTool',
        'DailyQuestDefinitionManager',
        'SimulationPanel',
        'Kronox Health Simulator',
      ].filter((token) => safeStr(settingsPageSource).includes(token));
      if (required.length || forbidden.length || settingsAdminTools.length) {
        return fail('Settings still contains temporary/admin tooling or Admin Ekranı lost the production admin gate.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          expected: 'No AdminDebug-v4/admin-tool strings in Settings; admin tools remain behind parsed backend AdminUser status in Admin Ekranı.',
          actual: { missing: required, forbidden, settingsAdminTools },
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      return pass('Settings no longer renders AdminDebug-v4 or admin tools; Admin Ekranı gates them by backend status.', {
        verification: 'STATIC_CONTRACT',
        classification: 'STATIC_CHECK_LIMITATION',
        actionType: ACTION_TYPES.CODE_FIX,
      });
    },
  ),

  makeCase(
    'admin_authorization_hardening', 'Admin Authorization Hardening (Security)',
    'admin_user_lookup_handles_field_casing',
    'AdminUser lookup normalizes email/role/status and safely handles field-name casing variants',
    () => {
      const required = [
        'FIELD_CANDIDATES',
        "'email'",
        "'Email'",
        "'user_email'",
        "'admin_email'",
        "'role'",
        "'Role'",
        "'status'",
        "'Status'",
        'trim().toLowerCase()',
        "value === 'owner' || value === 'admin'",
        "=== 'active'",
        'matchedFieldNames',
        'active_admin_match',
        'status_not_active',
        'role_not_allowed',
        'admin_user_not_found',
      ].filter((token) => !safeStr(adminAuthSource).includes(token));
      if (required.length) {
        return fail('AdminUser lookup does not clearly handle field casing and normalized active admin checks.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          expected: 'Email/role/status aliases, trim/lowercase normalization, owner/admin active match, safe current-user debug reasons.',
          actual: { missing: required },
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      return pass('AdminUser lookup handles field casing and normalized active admin checks.', {
        verification: 'STATIC_CONTRACT',
        classification: 'STATIC_CHECK_LIMITATION',
        actionType: ACTION_TYPES.CODE_FIX,
      });
    },
  ),

  makeCase(
    'admin_authorization_hardening', 'Admin Authorization Hardening (Security)',
    'new_admin_accounts_runtime_proof_needed',
    'New admin accounts must be manually inserted and verified in AdminUser',
    () => notAutomatable('Repo code cannot create deployed AdminUser rows. Manually create active AdminUser rows for the requested admin emails, then verify active admins can access Admin Ekranı, /test-suite / Health Simulator, and the admin question analytics trigger while normal and disabled-admin accounts remain blocked.', {
      verification: 'NOT_AUTOMATABLE',
      classification: 'DEPLOYMENT_RUNTIME_REQUIRED',
      verificationLabels: ['NOT_AUTOMATABLE', 'BACKEND_RUNTIME_PROBE', 'MANUAL_REQUIRED'],
      actionType: ACTION_TYPES.BACKEND_RUNTIME_PROBE,
      expected: {
        adminSourceOfTruth: 'AdminUser.email + role owner/admin + status active',
        requestedAdminRows: 'two normalized lowercase emails from the task, role admin, status active',
      },
    }),
  ),

  makeCase(
    'admin_authorization_hardening', 'Admin Authorization Hardening (Security)',
    'admin_reset_user_progress_contract',
    'Reset User Progress is admin-only, previewed before execution, exact-email confirmed, logged, and never deletes the user account',
    () => {
      const combined = `${adminResetUserProgressSource}\n${resetUserProgressToolSource}\n${adminPageSource}\n${adminMaintenanceLogSchemaSource}\n${userSchemaSource}\n${authContextSource}\n${progressResetCacheSource}`;
      const required = [
        'adminResetUserProgress',
        'Reset User Progress',
        'action: \'preview\'',
        'action: \'execute\'',
        'confirmEmail',
        'confirmation_mismatch',
        'Hard zero reset',
        'New player reset',
        'starter_bonus_granted_at: hardZero ? nowIso',
        'last_daily_diamond_reward_date: hardZero ? todayUtcKey()',
        'progress_reset_at',
        'applyUserProgressResetMarker',
        'AdminMaintenanceLog',
        'admin_email',
        'target_email',
        'base44.asServiceRole.entities.User.update',
      ].filter((token) => !combined.includes(token));
      const forbidden = [
        'base44.asServiceRole.entities.User.delete',
      ].filter((token) => combined.includes(token));
      const hardcodedEmails = combined.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || [];
      if (hardcodedEmails.length) forbidden.push('hardcoded_email_literal');
      if (required.length || forbidden.length) {
        return fail('Admin reset tool does not satisfy the protected maintenance reset contract.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          expected: 'Admin UI + server auth + preview + exact confirm + log + progress_reset_at cache invalidation; no user delete or hardcoded target email',
          actual: { missing: required, forbidden },
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      return pass('Admin reset tool is server-gated, preview/confirm protected, audit-logged, and invalidates local progress mirrors without deleting the user.', {
        verification: 'STATIC_CONTRACT',
        classification: 'STATIC_CHECK_LIMITATION',
        actionType: ACTION_TYPES.CODE_FIX,
      });
    },
  ),
];
