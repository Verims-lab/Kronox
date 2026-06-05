// Codex154 — Health/security contracts that lock in the removal of
// hardcoded admin email literals from backend admin-only functions.
//
// Background: a security scan flagged three backend functions for using
// hardcoded email addresses to gate admin access:
//   • base44/functions/generateTechDoc/entry.ts
//   • base44/functions/generateWorkflowDoc/entry.ts
//   • base44/functions/seedQuestionCategories/entry.ts
//
// Fix: admin authorization now reads the comma-separated allowlist from
// ADMIN_EMAILS/KRONOX_ADMIN_EMAILS env/secrets (trim + lowercase
// normalization). Missing config fails closed unless the authenticated user
// has an admin role/permission.
//
// This suite makes the regression detectable from Health Center:
//   • No literal admin email string remains in the admin-only functions.
//   • Each function reads Deno.env.get('KRONOX_ADMIN_EMAILS') and can also
//     accept ADMIN_EMAILS as a deployment alias.
//   • Each function still requires authentication (401 on missing user).
//   • Each function still rejects non-admin authenticated users (403).
//
// PASS proves the security finding is resolved. Any FAIL means a literal
// admin email or a missing allowlist read regressed back into a function.

import generateTechDocSource from '../../../base44/functions/generateTechDoc/entry.ts?raw';
import generateWorkflowDocSource from '../../../base44/functions/generateWorkflowDoc/entry.ts?raw';
import seedQuestionCategoriesSource from '../../../base44/functions/seedQuestionCategories/entry.ts?raw';
import adminResetUserProgressSource from '../../../base44/functions/adminResetUserProgress/entry.ts?raw';
import adminMaintenanceLogSchemaSource from '../../../base44/entities/AdminMaintenanceLog.jsonc?raw';
import userSchemaSource from '../../../base44/entities/User.jsonc?raw';
import securityDeploymentDocSource from '../../../docs/KRONOX_SECURITY_DEPLOYMENT.md?raw';
import releaseProofChecklistSource from '../../../docs/KRONOX_RELEASE_PROOF_CHECKLIST.md?raw';
import settingsPageSource from '../../pages/SettingsPage.jsx?raw';
import resetUserProgressToolSource from '../../components/admin/ResetUserProgressTool.jsx?raw';
import authContextSource from '../../lib/AuthContext.jsx?raw';
import progressResetCacheSource from '../../lib/progressResetCache.js?raw';

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
];

export const EXTRA_TESTS = [
  // 1) No hardcoded email literal remains in any of the three functions.
  makeCase(
    'admin_authorization_hardening', 'Admin Authorization Hardening (Security)',
    'no_hardcoded_admin_email_literal',
    'None of the admin-only functions contain a quoted email-shaped literal in source (admin allowlist must come from env/secret only)',
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

  makeCase(
    'admin_authorization_hardening', 'Admin Authorization Hardening (Security)',
    'admin_source_of_truth_documented',
    'Admin source-of-truth is documented as User role/permission plus deployment-secret allowlist fallback',
    () => {
      const combined = `${securityDeploymentDocSource}\n${releaseProofChecklistSource}\n${adminResetUserProgressSource}\n${settingsPageSource}`;
      const required = [
        'Current source of truth',
        'role === "admin"',
        'is_admin === true',
        'permissions',
        'ADMIN_EMAILS',
        'KRONOX_ADMIN_EMAILS',
        'Settings admin tools',
        '/test-suite',
        'Health Simulator',
        'admin question analytics trigger',
        'requested new admins',
        'Do not commit the personal admin emails to source',
      ].filter((token) => !combined.includes(token));
      if (required.length) {
        return fail('Admin source-of-truth or requested admin addition path is missing from docs/contracts.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          expected: 'Docs identify User role/permission as primary, env allowlist as fallback, and require the requested admin additions through deployment data/secrets.',
          actual: { missing: required },
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      return pass('Admin source-of-truth and requested admin addition path are documented without adding a hardcoded runtime email gate.', {
        verification: 'STATIC_CONTRACT',
        classification: 'STATIC_CHECK_LIMITATION',
        actionType: ACTION_TYPES.CODE_FIX,
      });
    },
  ),

  makeCase(
    'admin_authorization_hardening', 'new_admin_accounts_runtime_proof_needed',
    'New admin accounts must be verified in the deployed User role/env allowlist source-of-truth',
    () => notAutomatable('Repo code cannot prove deployed Base44 User.role/permissions or KRONOX_ADMIN_EMAILS secret contents. Verify both requested admin accounts can access Settings admin tools, /test-suite / Health Simulator, and the admin question analytics trigger while a normal account remains blocked.', {
      verification: 'NOT_AUTOMATABLE',
      classification: 'DEPLOYMENT_RUNTIME_REQUIRED',
      verificationLabels: ['NOT_AUTOMATABLE', 'BACKEND_RUNTIME_PROBE', 'MANUAL_REQUIRED'],
      actionType: ACTION_TYPES.BACKEND_RUNTIME_PROBE,
      expected: {
        adminSourceOfTruth: 'User.role/is_admin/permissions first; ADMIN_EMAILS/KRONOX_ADMIN_EMAILS deployment fallback only',
        requestedAdmins: 'the two admin emails from the task; keep exact addresses in deployed User roles or KRONOX_ADMIN_EMAILS, not source code',
      },
    }),
  ),

  // 2) Each function reads the KRONOX_ADMIN_EMAILS env/secret.
  makeCase(
    'admin_authorization_hardening', 'Admin Authorization Hardening (Security)',
    'admin_allowlist_sourced_from_env',
    'Each admin-only function reads its allowlist from Deno.env.get("KRONOX_ADMIN_EMAILS") / ADMIN_EMAILS',
    () => {
      const missing = [];
      for (const fn of TARGET_FUNCTIONS) {
        const src = safeStr(fn.source);
        if (!src.includes("Deno.env.get('KRONOX_ADMIN_EMAILS')")
          && !src.includes('Deno.env.get("KRONOX_ADMIN_EMAILS")')) {
          missing.push(fn.name);
        }
      }
      if (missing.length) {
        return fail('An admin-only function does not read the KRONOX_ADMIN_EMAILS allowlist from env/secret.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          expected: 'Deno.env.get("KRONOX_ADMIN_EMAILS") in each function',
          actual: { missingIn: missing },
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      return pass('All admin-only functions read KRONOX_ADMIN_EMAILS from env/secret.', {
        verification: 'STATIC_CONTRACT',
        classification: 'STATIC_CHECK_LIMITATION',
        actionType: ACTION_TYPES.CODE_FIX,
      });
    },
  ),

  // 3) Auth is still required: each function calls base44.auth.me().
  makeCase(
    'admin_authorization_hardening', 'Admin Authorization Hardening (Security)',
    'auth_still_required',
    'Each admin-only function still calls base44.auth.me() before granting access',
    () => {
      const missing = [];
      for (const fn of TARGET_FUNCTIONS) {
        const src = safeStr(fn.source);
        if (!src.includes('base44.auth.me()')) missing.push(fn.name);
      }
      if (missing.length) {
        return fail('An admin-only function no longer calls base44.auth.me().', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          expected: 'base44.auth.me() in each function',
          actual: { missingIn: missing },
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      return pass('All admin-only functions still authenticate the caller.', {
        verification: 'STATIC_CONTRACT',
        classification: 'STATIC_CHECK_LIMITATION',
        actionType: ACTION_TYPES.CODE_FIX,
      });
    },
  ),

  // 4) Each function still rejects non-admin authenticated users (403).
  makeCase(
    'admin_authorization_hardening', 'Admin Authorization Hardening (Security)',
    'non_admin_rejected_with_403',
    'Each admin-only function returns a 403 path for authenticated callers who are not admin',
    () => {
      const missing = [];
      for (const fn of TARGET_FUNCTIONS) {
        const src = safeStr(fn.source);
        // Look for a 403 response anywhere in the source (each function uses
        // its own response helper but all surface { status: 403 } literally).
        if (!src.includes('403')) missing.push(fn.name);
      }
      if (missing.length) {
        return fail('An admin-only function no longer returns 403 for non-admin callers.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          expected: '403 rejection path in each function',
          actual: { missingIn: missing },
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      return pass('All admin-only functions still reject non-admin callers with 403.', {
        verification: 'STATIC_CONTRACT',
        classification: 'STATIC_CHECK_LIMITATION',
        actionType: ACTION_TYPES.CODE_FIX,
      });
    },
  ),

  // 5) Missing config fails closed. The allowlist parser must normalize to
  //    an array and the auth check must NOT grant access from allowlist
  //    unless allowlist.length > 0 and the caller email is included.
  makeCase(
    'admin_authorization_hardening', 'Admin Authorization Hardening (Security)',
    'missing_config_fails_closed',
    'When admin allowlist env is missing/empty, the gate only admits role/permission admins',
    () => {
      const offenders = [];
      for (const fn of TARGET_FUNCTIONS) {
        const src = safeStr(fn.source);
        const hasArrayNormalization = src.includes('.split') && src.includes('.filter(Boolean)');
        const hasAllowlistLengthGuard = src.includes('allowlist.length > 0');
        const hasAdminRoleOrPermissionCheck = (
          src.includes("role === 'admin'") ||
          src.includes('is_admin === true') ||
          src.includes("permissions.includes('admin')")
        );
        if (!hasArrayNormalization || !hasAllowlistLengthGuard || !hasAdminRoleOrPermissionCheck) {
          offenders.push({
            function: fn.name,
            hasArrayNormalization,
            hasAllowlistLengthGuard,
            hasAdminRoleOrPermissionCheck,
          });
        }
      }
      if (offenders.length) {
        return fail('An admin-only function does not provably fail closed when admin allowlist env is missing.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          expected: 'Normalized allowlist + allowlist.length guard + role/permission admin fallback',
          actual: { offenders },
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      return pass('Missing admin allowlist env fails closed in all admin-only functions.', {
        verification: 'STATIC_CONTRACT',
        classification: 'STATIC_CHECK_LIMITATION',
        actionType: ACTION_TYPES.CODE_FIX,
      });
    },
  ),

  makeCase(
    'admin_authorization_hardening', 'Admin Authorization Hardening (Security)',
    'admin_reset_user_progress_contract',
    'Reset User Progress is admin-only, previewed before execution, exact-email confirmed, logged, and never deletes the user account',
    () => {
      const combined = `${adminResetUserProgressSource}\n${resetUserProgressToolSource}\n${settingsPageSource}\n${adminMaintenanceLogSchemaSource}\n${userSchemaSource}\n${authContextSource}\n${progressResetCacheSource}`;
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
        'sariverim@gmail.com',
      ].filter((token) => combined.includes(token));
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
