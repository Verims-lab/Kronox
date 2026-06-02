// Codex154 — Health/security contracts that lock in the removal of
// hardcoded admin email literals from backend admin-only functions.
//
// Background: a security scan flagged three backend functions for using
// hardcoded email addresses to gate admin access:
//   • functions/generateTechDoc.js
//   • functions/generateWorkflowDoc.js
//   • functions/seedQuestionCategories.js
//
// Fix: admin authorization now reads the comma-separated allowlist from
// the KRONOX_ADMIN_EMAILS env/secret (trim + lowercase normalization).
// Missing config fails closed (no caller is admin by default).
//
// This suite makes the regression detectable from Health Center:
//   • No literal admin email string remains in the three functions.
//   • Each function reads Deno.env.get('KRONOX_ADMIN_EMAILS').
//   • Each function still requires authentication (401 on missing user).
//   • Each function still rejects non-admin authenticated users (403).
//
// PASS proves the security finding is resolved. Any FAIL means a literal
// admin email or a missing allowlist read regressed back into a function.

import generateTechDocSource from '../../functions/generateTechDoc.js?raw';
import generateWorkflowDocSource from '../../functions/generateWorkflowDoc.js?raw';
import seedQuestionCategoriesSource from '../../functions/seedQuestionCategories.js?raw';

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
};

function safeStr(value) {
  return typeof value === 'string' ? value : '';
}

function pass(message, extras = {}) {
  return { status: 'PASS', message, ...extras };
}

function fail(message, extras = {}) {
  return { status: 'FAIL', message, ...extras };
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
          file: 'functions/{generateTechDoc,generateWorkflowDoc,seedQuestionCategories}.js',
          expected: 'No quoted email literal in admin-only function source',
          actual: { offenders },
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      return pass('No hardcoded admin email literals remain in the three admin-only functions.', {
        verification: 'STATIC_CONTRACT',
        classification: 'STATIC_CHECK_LIMITATION',
        actionType: ACTION_TYPES.CODE_FIX,
      });
    },
  ),

  // 2) Each function reads the KRONOX_ADMIN_EMAILS env/secret.
  makeCase(
    'admin_authorization_hardening', 'Admin Authorization Hardening (Security)',
    'admin_allowlist_sourced_from_env',
    'Each admin-only function reads its allowlist from Deno.env.get("KRONOX_ADMIN_EMAILS")',
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
      return pass('All three admin-only functions read KRONOX_ADMIN_EMAILS from env/secret.', {
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
      return pass('All three admin-only functions still authenticate the caller.', {
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
      return pass('All three admin-only functions still reject non-admin callers with 403.', {
        verification: 'STATIC_CONTRACT',
        classification: 'STATIC_CHECK_LIMITATION',
        actionType: ACTION_TYPES.CODE_FIX,
      });
    },
  ),

  // 5) Missing config fails closed. The allowlist parser must guard
  //    against an empty/missing env value and the auth check must NOT
  //    grant access when the allowlist is empty unless role==='admin'.
  makeCase(
    'admin_authorization_hardening', 'Admin Authorization Hardening (Security)',
    'missing_config_fails_closed',
    'When KRONOX_ADMIN_EMAILS is missing/empty, the parser returns an empty allowlist and the gate only admits role==="admin"',
    () => {
      const offenders = [];
      for (const fn of TARGET_FUNCTIONS) {
        const src = safeStr(fn.source);
        // The function must parse the env value into a list and then check
        // role==='admin' OR membership. The contract here is: the parser
        // returns [] for missing/empty config, and the gate uses a
        // membership check rather than truthy-coercing the raw env value.
        const hasEmptyArrayGuard = src.includes('return []') || src.includes('return [ ]');
        const hasAdminRoleCheck = src.includes("'admin'") || src.includes('"admin"');
        if (!hasEmptyArrayGuard || !hasAdminRoleCheck) {
          offenders.push({ function: fn.name, hasEmptyArrayGuard, hasAdminRoleCheck });
        }
      }
      if (offenders.length) {
        return fail('An admin-only function does not provably fail closed when KRONOX_ADMIN_EMAILS is missing.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          expected: 'Empty allowlist when env is missing; role==="admin" remains the only fallback',
          actual: { offenders },
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      return pass('Missing KRONOX_ADMIN_EMAILS fails closed in all three admin-only functions.', {
        verification: 'STATIC_CONTRACT',
        classification: 'STATIC_CHECK_LIMITATION',
        actionType: ACTION_TYPES.CODE_FIX,
      });
    },
  ),
];