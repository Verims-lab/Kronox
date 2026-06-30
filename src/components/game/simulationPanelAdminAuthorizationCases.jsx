// Codex200 — Health/security contracts for DB-backed admin authorization.
//
// This suite makes the regression detectable from Health Center:
//   • No literal admin email string remains in the admin-only functions.
//   • Admin authorization source-of-truth is the private AdminUser entity.
//   • Backend admin-only functions use AdminUser-backed authorization.
//   • Base44 functions inline the AdminUser guard because individual function
//     bundles do not reliably include shared helper modules during deploy.
//   • Admin/test reset email env allowlists are not used for authorization.
//   • Runtime active/disabled AdminUser proof remains NOT_AUTOMATABLE.
//
// PASS proves static source contracts only. Deployed AdminUser rows and RLS
// behavior must still be verified with real admin/non-admin accounts.

import adminUserEntitySource from '../../../base44/entities/AdminUser.jsonc?raw';
import getAdminStatusSource from '../../../base44/functions/getAdminStatus/entry.ts?raw';
import getAdminStatusConfigSource from '../../../base44/functions/getAdminStatus/function.jsonc?raw';
import generateTechDocSource from '../../../base44/functions/generateTechDoc/entry.ts?raw';
import generateWorkflowDocSource from '../../../base44/functions/generateWorkflowDoc/entry.ts?raw';
import adminResetUserProgressSource from '../../../base44/functions/adminResetUserProgress/entry.ts?raw';
import cleanupAdminMaintenanceLogSource from '../../../base44/functions/cleanupAdminMaintenanceLog/entry.ts?raw';
import expireOldGameInvitesSource from '../../../base44/functions/expireOldGameInvites/entry.ts?raw';
import expirePushSubscriptionsSource from '../../../base44/functions/expirePushSubscriptions/entry.ts?raw';
import refreshLeaderboardProjectionSource from '../../../base44/functions/refreshLeaderboardProjection/entry.ts?raw';
import resetTestAccountProgressSource from '../../../base44/functions/resetTestAccountProgress/entry.ts?raw';
import diagnoseSoloQuestionStartQuerySource from '../../../base44/functions/diagnoseSoloQuestionStartQuery/entry.ts?raw';
import runTestSuiteSource from '../../../base44/functions/runTestSuite/entry.ts?raw';
import sendQuestionAnalyticsReportEmailSource from '../../../base44/functions/sendQuestionAnalyticsReportEmail/entry.ts?raw';
import getUserReportSource from '../../../base44/functions/getUserReport/entry.ts?raw';
import getUserReportConfigSource from '../../../base44/functions/getUserReport/function.jsonc?raw';
import adminGrantDiamondsSource from '../../../base44/functions/adminGrantDiamonds/entry.ts?raw';
import adminGrantDiamondsConfigSource from '../../../base44/functions/adminGrantDiamonds/function.jsonc?raw';
import cleanupInactiveGuestUsernamesSource from '../../../base44/functions/cleanupInactiveGuestUsernames/entry.ts?raw';
import cleanupInactiveGuestUsernamesConfigSource from '../../../base44/functions/cleanupInactiveGuestUsernames/function.jsonc?raw';
import recordAppOpenSource from '../../../base44/functions/recordAppOpen/entry.ts?raw';
import recordAppOpenConfigSource from '../../../base44/functions/recordAppOpen/function.jsonc?raw';
import createDailyQuestDefinitionSource from '../../../base44/functions/createDailyQuestDefinition/entry.ts?raw';
import aggregateQuestionStatsSource from '../../../base44/functions/aggregateQuestionStats/entry.ts?raw';
import cancelStaleLobbiesSource from '../../../base44/functions/cancelStaleLobbies/entry.ts?raw';
import simulateOnlineGameSource from '../../../base44/functions/simulateOnlineGame/entry.ts?raw';
import getQuestionsSource from '../../../base44/functions/getQuestions/entry.ts?raw';
import adminMaintenanceLogSchemaSource from '../../../base44/entities/AdminMaintenanceLog.jsonc?raw';
import userSchemaSource from '../../../base44/entities/User.jsonc?raw';
import guestProfileSchemaSource from '../../../base44/entities/GuestProfile.jsonc?raw';
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
import userReportToolSource from '../../components/admin/UserReportTool.jsx?raw';
import questionAnalyticsReportToolSource from '../../components/admin/QuestionAnalyticsReportTool.jsx?raw';
import adminDiamondGrantToolSource from '../../components/admin/AdminDiamondGrantTool.jsx?raw';
import inactiveGuestCleanupToolSource from '../../components/admin/InactiveGuestCleanupTool.jsx?raw';
import adminCollapsibleSectionSource from '../../components/admin/AdminCollapsibleSection.jsx?raw';
import authContextSource from '../../lib/AuthContext.jsx?raw';
import adminSource from '../../lib/admin.js?raw';
import appParamsSource from '../../lib/app-params.js?raw';
import base44ClientSource from '../../api/base44Client.js?raw';
import progressResetCacheSource from '../../lib/progressResetCache.js?raw';
import appActivitySource from '../../lib/appActivity.js?raw';

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
const EMAIL_LITERAL_REGEX = /['"][\w.+-]+@[\w-]+(?:\.[\w-]+)*\.[A-Za-z]{2,}['"]/g;

function maskEmailLiteral(value) {
  const text = String(value || '').trim().toLowerCase();
  const [local = '', domain = ''] = text.split('@');
  const [domainName = '', ...suffixParts] = domain.split('.');
  const suffix = suffixParts.length ? `.${suffixParts.join('.')}` : '';
  const localHead = local.slice(0, 1) || '*';
  const domainHead = domainName.slice(0, 1) || '*';
  return `${localHead}***@${domainHead}***${suffix}`;
}

function findEmailLiterals(src) {
  const lines = String(src || '').split(/\r?\n/);
  const matches = src.match(EMAIL_LITERAL_REGEX) || [];
  const seen = new Set();
  return matches.map((match) => {
    const value = match.replace(/^['"]|['"]$/g, '').toLowerCase();
    const line = lines.findIndex((sourceLine) => sourceLine.includes(match) || sourceLine.includes(value)) + 1;
    return { value, line, maskedLiteral: maskEmailLiteral(value) };
  }).filter((entry) => {
    // Synthetic fixture addresses used inside admin-only test harnesses are
    // not personal/admin/support contacts and do not grant authorization.
    if (entry.value.endsWith('@kronos.local') || entry.value.endsWith('@example.com') || entry.value.endsWith('@example.test')) return false;
    const key = `${entry.value}:${entry.line}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

const TARGET_FUNCTIONS = [
  { name: 'generateTechDoc', file: 'base44/functions/generateTechDoc/entry.ts', source: generateTechDocSource },
  { name: 'generateWorkflowDoc', file: 'base44/functions/generateWorkflowDoc/entry.ts', source: generateWorkflowDocSource },
  { name: 'adminResetUserProgress', file: 'base44/functions/adminResetUserProgress/entry.ts', source: adminResetUserProgressSource },
  { name: 'adminGrantDiamonds', file: 'base44/functions/adminGrantDiamonds/entry.ts', source: adminGrantDiamondsSource },
  { name: 'cleanupAdminMaintenanceLog', file: 'base44/functions/cleanupAdminMaintenanceLog/entry.ts', source: cleanupAdminMaintenanceLogSource },
  { name: 'expireOldGameInvites', file: 'base44/functions/expireOldGameInvites/entry.ts', source: expireOldGameInvitesSource },
  { name: 'expirePushSubscriptions', file: 'base44/functions/expirePushSubscriptions/entry.ts', source: expirePushSubscriptionsSource },
  { name: 'refreshLeaderboardProjection', file: 'base44/functions/refreshLeaderboardProjection/entry.ts', source: refreshLeaderboardProjectionSource },
  { name: 'resetTestAccountProgress', file: 'base44/functions/resetTestAccountProgress/entry.ts', source: resetTestAccountProgressSource },
  { name: 'diagnoseSoloQuestionStartQuery', file: 'base44/functions/diagnoseSoloQuestionStartQuery/entry.ts', source: diagnoseSoloQuestionStartQuerySource },
  { name: 'runTestSuite', file: 'base44/functions/runTestSuite/entry.ts', source: runTestSuiteSource },
  { name: 'sendQuestionAnalyticsReportEmail', file: 'base44/functions/sendQuestionAnalyticsReportEmail/entry.ts', source: sendQuestionAnalyticsReportEmailSource },
  { name: 'cleanupInactiveGuestUsernames', file: 'base44/functions/cleanupInactiveGuestUsernames/entry.ts', source: cleanupInactiveGuestUsernamesSource },
  { name: 'createDailyQuestDefinition', file: 'base44/functions/createDailyQuestDefinition/entry.ts', source: createDailyQuestDefinitionSource },
  { name: 'aggregateQuestionStats', file: 'base44/functions/aggregateQuestionStats/entry.ts', source: aggregateQuestionStatsSource },
  { name: 'cancelStaleLobbies', file: 'base44/functions/cancelStaleLobbies/entry.ts', source: cancelStaleLobbiesSource },
  { name: 'simulateOnlineGame', file: 'base44/functions/simulateOnlineGame/entry.ts', source: simulateOnlineGameSource },
  { name: 'getAdminStatus', file: 'base44/functions/getAdminStatus/entry.ts', source: getAdminStatusSource },
  { name: 'getQuestions', file: 'base44/functions/getQuestions/entry.ts', source: getQuestionsSource },
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
          offenders.push({
            function: fn.name,
            file: fn.file,
            count: emails.length,
            maskedOffenders: emails.map((entry) => `line ${entry.line}: ${entry.maskedLiteral}`),
          });
        }
      }
      if (offenders.length) {
        const offenderSummary = offenders.flatMap((offender) => (
          offender.maskedOffenders || []
        ).map((masked) => `${offender.file}: ${masked}`));
        return fail('A hardcoded admin email literal is still present in a protected backend function.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          file: 'base44/functions/{generateTechDoc,generateWorkflowDoc}/entry.ts',
          expected: 'No quoted email literal in admin-only function source',
          actual: { offenderCount: offenders.reduce((sum, item) => sum + item.count, 0), offenderSummary },
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

  // 3) Inline AdminUser guards exist in protected Base44 functions.
  makeCase(
    'admin_authorization_hardening', 'Admin Authorization Hardening (Security)',
    'inline_admin_guards_use_admin_user',
    'Inline backend admin guards check active AdminUser rows by normalized authenticated email',
    () => {
      const combined = TARGET_FUNCTIONS.map((fn) => fn.source).join('\n');
      const missing = [
        'getAdminAuthorization',
        'requireAdmin',
        'base44.auth.me()',
        'entities?.AdminUser',
        'ADMIN_AUTH_FIELD_CANDIDATES',
        '.filter({ [field]: email }',
        'status',
        'active',
        'owner',
        'admin',
        '403',
      ].filter((token) => !safeStr(combined).includes(token));
      const forbidden = [
        ...LEGACY_ADMIN_ENV_TOKENS.filter((token) => safeStr(combined).includes(token)),
        "from '../_shared/adminAuth.ts'",
        "from './_shared/adminAuth.ts'",
        'file://' + '/__shared',
      ].filter((token) => safeStr(combined).includes(token));
      if (missing.length || forbidden.length) {
        return fail('Inline admin guards do not clearly use AdminUser as the backend source-of-truth.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          expected: 'auth.me + service-role AdminUser lookup + active owner/admin role + 401/403 failures; no env email allowlist',
          actual: { missing, forbidden },
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      return pass('Inline admin guards are AdminUser-backed and do not read admin email env allowlists.', {
        verification: 'STATIC_CONTRACT',
        classification: 'STATIC_CHECK_LIMITATION',
        actionType: ACTION_TYPES.CODE_FIX,
      });
    },
  ),

  // 4) Affected functions use AdminUser-backed guards.
  makeCase(
    'admin_authorization_hardening', 'Admin Authorization Hardening (Security)',
    'admin_functions_use_inline_admin_guard',
    'Admin-only functions inline AdminUser-backed authorization for Base44 deployability',
    () => {
      const missing = [];
      const allowedAlternatives = new Map([
        ['getQuestions', 'isAuthorizedAdmin'],
        ['getAdminStatus', 'getAdminAuthorization'],
      ]);
      const inlineGuardRequirements = [
        'entities?.AdminUser',
        'ADMIN_AUTH_FIELD_CANDIDATES',
        "value === 'owner' || value === 'admin'",
        "=== 'active'",
        '.filter({ [field]: email }',
      ];
      const legacyInlineGuardRequirements = [
        'function requireAdmin(base44)',
        'getAdminAuthorization',
        'entities?.AdminUser',
        'ADMIN_EMAIL_FIELDS',
        "value === 'owner' || value === 'admin'",
        'isActiveStatus',
        '.filter({ [field]: email }',
      ];
      const perFunctionRequirements = new Map([
        ['sendQuestionAnalyticsReportEmail', legacyInlineGuardRequirements],
        ['createDailyQuestDefinition', legacyInlineGuardRequirements],
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
        const helper = allowedAlternatives.get(fn.name) || 'requireAdmin';
        const required = fn.name === 'getAdminStatus'
          ? ['getAdminAuthorization', 'entities?.AdminUser', 'ADMIN_AUTH_FIELD_CANDIDATES', 'active_admin_match']
          : (perFunctionRequirements.get(fn.name) || [helper, ...inlineGuardRequirements]);
        const missingInline = required.filter((token) => !src.includes(token));
        const brokenLocalImports = brokenLocalImportTokens.filter((token) => src.includes(token));
        if (missingInline.length || brokenLocalImports.length) {
          missing.push({
            function: fn.name,
            mode: 'inline_admin_user_guard',
            missing: missingInline,
            forbidden: brokenLocalImports,
          });
        }
      }
      if (missing.length) {
        return fail('An admin-only function is not using accepted AdminUser-backed authorization.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          expected: 'Inline AdminUser guard in each Base44 function: auth.me + service-role AdminUser lookup + active owner/admin role/status + no shared adminAuth import',
          actual: { missingIn: missing },
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      return pass('Affected admin functions inline accepted AdminUser-backed authorization for Base44 deployability.', {
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
        'function requireAdmin(base44)',
        'entities?.AdminUser',
        'ADMIN_AUTH_FIELD_CANDIDATES',
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
        'body.admin_email',
        'body?.admin_email',
        'requestPayload.admin_email',
        'requestPayload?.admin_email',
        'payload.admin_email',
        'payload?.admin_email',
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
      return pass('simulateOnlineGame uses an inline AdminUser guard and contains no scanner typo/client-role authorization tokens.', {
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
        'function requireAdmin',
        'entities?.AdminUser',
        'ADMIN_AUTH_FIELD_CANDIDATES',
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
        'Inline backend guard',
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
      ].filter((token) => !`${adminSource}\n${getAdminStatusSource}\n${getAdminStatusConfigSource}\n${rootGetAdminStatusSource}`.includes(token));
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
        'ADMIN_AUTH_FIELD_CANDIDATES',
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
      ].filter((token) => !safeStr(getAdminStatusSource).includes(token));
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

  makeCase(
    'admin_authorization_hardening', 'Admin Authorization Hardening (Security)',
    'admin_user_report_aggregate_privacy_contract',
    'Kullanıcı Raporu is admin-only, aggregate-only, read-only, and privacy-safe',
    () => {
      const combined = `${getUserReportSource}\n${getUserReportConfigSource}\n${userReportToolSource}\n${adminPageSource}`;
      const required = [
        '"name": "getUserReport"',
        'requireAdmin',
        'base44.asServiceRole.entities.User',
        'base44.asServiceRole.entities.GuestProfile',
        'base44.asServiceRole.entities.SoloLeaderboardEntry',
        'totalUsersByDistinctValidUsername',
        'loggedInUsers',
        'usersWithKronoxPuanGreaterThanZero',
        'inactive10DaysUsers',
        'noLastOpenUsers',
        'platformBreakdown',
        'adminOnly: true',
        'aggregateOnly: true',
        'readOnly: true',
        'deletesUsers: false',
        'mutatesScoreOrEconomy: false',
        'exposesEmail: false',
        'exposesProviderId: false',
        'exposesOwnerKey: false',
        'exposesRawGuestId: false',
        'exposesInternalPlayerKey: false',
        'Kullanıcı Raporu',
        'Kullanıcı, giriş, puan ve son aktiflik özetleri. Silme işlemi yapmaz.',
      ].filter((token) => !combined.includes(token));
      const forbidden = [
        'entities.User.delete',
        'entities.GuestProfile.delete',
        'base44.asServiceRole.entities.User.delete',
        'base44.asServiceRole.entities.GuestProfile.delete',
      ].filter((token) => combined.includes(token));
      if (required.length || forbidden.length) {
        return fail('Admin user report does not satisfy the aggregate read-only privacy contract.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          expected: 'AdminUser-gated getUserReport returns aggregate counts only, includes username/logged-in/score/inactive metrics, and exposes no private identifiers or delete path.',
          actual: { missing: required, forbidden },
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      return pass('Kullanıcı Raporu is AdminUser-gated, aggregate-only, read-only, score-source aligned, and privacy-safe.', {
        verification: 'STATIC_CONTRACT',
        classification: 'STATIC_CHECK_LIMITATION',
      });
    },
  ),

  makeCase(
    'admin_authorization_hardening', 'Admin Authorization Hardening (Security)',
    'admin_test_diamond_grant_contract',
    'Test Elmas Yükleme is AdminUser-gated, Kronox-ID targeted, Diamond-only, ledgered, idempotent, and privacy-safe',
    () => {
      const backend = `${adminGrantDiamondsSource}\n${adminGrantDiamondsConfigSource}`;
      const ui = `${adminDiamondGrantToolSource}\n${adminPageSource}`;
      const combined = `${backend}\n${ui}\n${adminMaintenanceLogSchemaSource}`;
      const required = [
        '"name": "adminGrantDiamonds"',
        'requireAdmin',
        'entities?.AdminUser',
        'normalizeKronoxUserId',
        'KRONOX_ID_PATTERN',
        'ALLOWED_AMOUNTS',
        'new Set([100, 300, 500, 1000])',
        'resolveTarget',
        "'User'",
        "'GuestProfile'",
        'linked_guest_canonical_user_missing',
        'DiamondTransaction',
        "source: ADMIN_GRANT_SOURCE",
        "ADMIN_GRANT_SOURCE = 'admin_adjustment'",
        "direction: 'earn'",
        'balance_before',
        'balance_after',
        'idempotency_key',
        'buildIdempotencyKey',
        'missing_request_id',
        'withEconomyOperationLock',
        'reconcileTargetBalanceFromTransaction',
        "operation_scope: 'admin_diamond_grant'",
        'AdminMaintenanceLog',
        'grantsDiamondsOnly: true',
        'noKronoxPuan: true',
        'noLeaderboardImpact: true',
        'noDailyWheelImpact: true',
        'noDailyQuestImpact: true',
        'noMarketMutation: true',
        'Test Elmas Yükleme',
        'Kullanıcı ID',
        'request_id: buildRequestId()',
        'base44.functions.fetch(\'/adminGrantDiamonds\'',
        'checkUserAuth',
      ].filter((token) => !combined.includes(token));
      const forbiddenBackend = [
        'kronox_puan_total:',
        'solo_progress:',
        'online_progress:',
        'daily_wheel_last_spin',
        'daily_quest_last_claim',
        'base44.asServiceRole.entities.User.delete',
        'base44.asServiceRole.entities.GuestProfile.delete',
      ].filter((token) => backend.includes(token));
      const forbiddenUi = [
        'target_email',
        'guest_id',
        'owner_key',
        'provider',
      ].filter((token) => ui.includes(token));
      const forbiddenResponseShape = [
        'transactionId:',
        'ownerKey:',
        'guestId:',
        'targetEmail:',
        'playerKey:',
        'adminEmail:',
      ].filter((token) => backend.includes(token));
      if (required.length || forbiddenBackend.length || forbiddenUi.length || forbiddenResponseShape.length) {
        return fail('Admin test Diamond grant does not satisfy the protected economy/admin contract.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          expected: 'AdminUser-gated Kronox ID lookup, allowed amount enum, DiamondTransaction admin_adjustment ledger, request idempotency, economy lock, no score/quest/wheel/market mutation, no private IDs in UI/API response.',
          actual: { missing: required, forbiddenBackend, forbiddenUi, forbiddenResponseShape },
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      return pass('Test Elmas Yükleme is server-gated, Kronox-ID targeted, Diamond-only, ledgered, idempotent, and privacy-safe.', {
        verification: 'STATIC_CONTRACT',
        classification: 'STATIC_CHECK_LIMITATION',
        actionType: ACTION_TYPES.CODE_FIX,
      });
    },
  ),

  makeCase(
    'admin_authorization_hardening', 'Admin Authorization Hardening (Security)',
    'inactive_guest_username_cleanup_contract',
    'Inactive zero-score guest username cleanup is admin-only, dry-run first, confirmed, and privacy-safe',
    () => {
      const backend = `${cleanupInactiveGuestUsernamesSource}\n${cleanupInactiveGuestUsernamesConfigSource}`;
      const ui = `${inactiveGuestCleanupToolSource}\n${adminPageSource}`;
      const combined = `${backend}\n${ui}\n${adminMaintenanceLogSchemaSource}`;
      const required = [
        '"name": "cleanupInactiveGuestUsernames"',
        'requireAdmin',
        'buildCleanupContext',
        'buildPreview',
        'action === \'preview\'',
        'action === \'execute\'',
        'dryRunNoMutation: true',
        'confirmText !== CONFIRM_TEXT',
        'preview_count_changed',
        'previewCandidateCount',
        'serverSideEligibilityRechecked: true',
        'missing_or_uncertain_last_open',
        'active_within_10_days',
        'score_not_zero',
        'score_source_missing_or_ambiguous',
        'linked_or_logged_in',
        'not_guest_only',
        'has_friends',
        'has_active_social_relation',
        'active_presence',
        'economy_state_not_empty',
        'base44.asServiceRole.entities',
        'entities.GuestProfile.delete',
        'entities.SoloLeaderboardEntry',
        'entities.PlayerPresence',
        'releasesUsernameForReuse: true',
        'usernamesReleasedForReuse: true',
        'privateIdsReturnedToClient: false',
        'exposesEmail: false',
        'exposesProviderId: false',
        'exposesOwnerKey: false',
        'exposesRawGuestId: false',
        'exposesInternalPlayerKey: false',
        'AdminMaintenanceLog',
        'inactive_guest_username_cleanup_preview',
        'inactive_guest_username_cleanup_execute',
        'Pasif Guest Kullanıcı Adlarını Temizle',
        'Adayları Bul',
        'Seçili/Aday Kullanıcı Adlarını Sil',
        'Sil ve Serbest Bırak',
      ].filter((token) => !combined.includes(token));
      const forbiddenBackend = [
        'setInterval(',
        'cron',
        'scheduled',
        'base44.asServiceRole.entities.User.delete',
        'DiamondTransaction.delete',
        'JokerTransaction.delete',
      ].filter((token) => backend.includes(token));
      const forbiddenUi = [
        'guest_id',
        'guestId',
        'owner_key',
        'player_key',
        'provider',
        'email',
      ].filter((token) => ui.includes(token));
      if (required.length || forbiddenBackend.length || forbiddenUi.length) {
        return fail('Inactive guest username cleanup does not satisfy the destructive admin safety contract.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          expected: 'AdminUser-gated cleanupInactiveGuestUsernames with preview-only dry-run, execute confirmation, server-side recheck, no automatic cleanup, username release, audit log, and no private identifiers in UI/API response.',
          actual: { missing: required, forbiddenBackend, forbiddenUi },
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      return pass('Inactive guest username cleanup is server-gated, dry-run first, confirmed, audit-logged, username-release oriented, and privacy-safe.', {
        verification: 'STATIC_CONTRACT',
        classification: 'STATIC_CHECK_LIMITATION',
        actionType: ACTION_TYPES.CODE_FIX,
      });
    },
  ),

  makeCase(
    'admin_authorization_hardening', 'Admin Authorization Hardening (Security)',
    'admin_operations_collapsed_by_default_contract',
    'Heavy Admin operations are collapsed by default, analytics reset is separately nested, and user report loads only when opened',
    () => {
      const shared = safeStr(adminCollapsibleSectionSource);
      const questionAnalytics = safeStr(questionAnalyticsReportToolSource);
      const userReport = safeStr(userReportToolSource);
      const inactiveCleanup = safeStr(inactiveGuestCleanupToolSource);
      const resetProgress = safeStr(resetUserProgressToolSource);
      const diamondGrant = safeStr(adminDiamondGrantToolSource);
      const combined = [
        shared,
        questionAnalytics,
        userReport,
        inactiveCleanup,
        resetProgress,
        diamondGrant,
        adminPageSource,
      ].join('\n');
      const topLevelTools = [
        { label: 'Soru Analiz Raporu Gönder', source: questionAnalytics },
        { label: 'Kullanıcı Raporu', source: userReport },
        { label: 'Pasif Guest Kullanıcı Adlarını Temizle', source: inactiveCleanup },
        { label: 'Reset User Progress', source: resetProgress },
        { label: 'Test Elmas Yükleme', source: diamondGrant },
      ];
      const required = [
        'data-admin-collapsible-section',
        'data-default-open',
        '...sectionProps',
        'title="Soru Analiz Raporu Gönder"',
        'title="Rapor Hazırla ve Gönder"',
        'title="Soru Analitik Verilerini Sıfırla"',
        'data-admin-question-analytics-nested-groups',
        'defaultOpen',
        'title="Kullanıcı Raporu"',
        'onOpenChange={handleSectionOpenChange}',
        'if (nextOpen && !report && !loading) loadReport();',
        'ReportGroup',
        'MiniRatioBar',
        'title="Pasif Guest Kullanıcı Adlarını Temizle"',
        'title="Reset User Progress"',
        'title="Test Elmas Yükleme"',
      ].filter((token) => !combined.includes(token));
      const missingClosedDefaults = topLevelTools
        .filter(({ source }) => !source.includes('defaultOpen={false}'))
        .map(({ label }) => label);
      const forbidden = [
        userReport.includes('useEffect(() =>') ? 'user_report_mount_fetch_useEffect' : '',
        userReport.includes('loadReport();\n    // eslint-disable-next-line react-hooks/exhaustive-deps') ? 'user_report_mount_fetch_loadReport' : '',
      ].filter(Boolean);
      const splitResetIsClosed = questionAnalytics.includes('title="Soru Analitik Verilerini Sıfırla"')
        && questionAnalytics.includes('defaultOpen={false}')
        && questionAnalytics.includes('data-admin-question-analytics-reset-group');
      if (required.length || missingClosedDefaults.length || forbidden.length || !splitResetIsClosed) {
        return fail('Admin operations UI does not satisfy the collapsed-by-default maintenance layout contract.', {
          verification: 'STATIC_CONTRACT',
          classification: 'UX_HEALTH_REGRESSION',
          expected: 'Shared collapsed section wrapper; five heavy Admin tools closed by default; analytics report group open only after parent expansion; analytics reset separately closed; User Report lazy-loads on open with compact grouped metrics.',
          actual: { missing: required, missingClosedDefaults, forbidden, splitResetIsClosed },
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      return pass('Admin operations use the shared collapsed-by-default pattern, nested analytics groups, and lazy User Report loading.', {
        verification: 'STATIC_CONTRACT',
        classification: 'STATIC_CHECK_LIMITATION',
        actionType: ACTION_TYPES.CODE_FIX,
      });
    },
  ),

  makeCase(
    'admin_authorization_hardening', 'Admin Authorization Hardening (Security)',
    'record_app_open_server_time_coarse_platform_contract',
    'App-open tracking uses server time, guest token proof, and coarse platform only',
    () => {
      const combined = `${recordAppOpenSource}\n${recordAppOpenConfigSource}\n${appActivitySource}\n${authContextSource}\n${userSchemaSource}\n${guestProfileSchemaSource}`;
      const required = [
        '"name": "recordAppOpen"',
        'last_app_open_at: now',
        'last_seen_at: now',
        'app_platform: platform',
        'app_platform_updated_at: now',
        'serverTimeUsed: true',
        'clientTimestampIgnored: true',
        'preciseDeviceFingerprintStored: false',
        'hashGuestToken',
        'guest_id',
        'guest_token',
        'base44.auth.updateMe',
        'recordAppOpenActivity',
        'platform_class: detectCoarsePlatform()',
        'ACTIVITY_THROTTLE_MS',
        '"last_app_open_at"',
        '"app_platform"',
      ].filter((token) => !combined.includes(token));
      const forbidden = [
        'device_id',
        'deviceId',
        'fingerprint_id',
        'client_timestamp',
        'body?.last_app_open_at',
        'body?.last_seen_at',
      ].filter((token) => combined.includes(token));
      if (required.length || forbidden.length) {
        return fail('App-open tracking is not clearly server-time/coarse-platform safe.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          expected: 'recordAppOpen updates User/GuestProfile with server time, token-proves guests, captures only ios/android/other/unknown, and ignores client timestamps.',
          actual: { missing: required, forbidden },
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      return pass('recordAppOpen records last_app_open_at/last_seen_at with server time, guest proof, and coarse platform only.', {
        verification: 'STATIC_CONTRACT',
        classification: 'STATIC_CHECK_LIMITATION',
      });
    },
  ),
];
