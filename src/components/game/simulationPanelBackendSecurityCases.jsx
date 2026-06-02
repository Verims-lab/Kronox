// Kronox Health Center — Backend Security Contracts.
//
// Scope: static contracts for admin-only backend functions. Runtime auth
// probes still require real unauthenticated/non-admin/admin sessions.

import generateTechDocSource from '../../../base44/functions/generateTechDoc/entry.ts?raw';
import settingsPageSource from '../../pages/SettingsPage.jsx?raw';

const STATUS = {
  PASS: 'PASS',
  FAIL: 'FAIL',
  NOT_AUTOMATABLE: 'NOT_AUTOMATABLE',
};

const ACTION_TYPES = {
  CODE_FIX: 'CODE_FIX',
  BACKEND_RUNTIME_PROBE: 'BACKEND_RUNTIME_PROBE',
};

const SUITE_ID = 'backend_security_health';
const SUITE_NAME = 'Backend Security Health Suite';

function makeCase(id, name, run, options = {}) {
  return {
    key: `${SUITE_ID}.${id}`,
    suiteId: SUITE_ID,
    suiteName: SUITE_NAME,
    id,
    name,
    critical: options.critical ?? true,
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

function presentTokens(source, tokens) {
  return tokens.filter((token) => String(source || '').includes(token));
}

export const EXTRA_SUITES = [
  {
    id: SUITE_ID,
    name: SUITE_NAME,
    critical: true,
    color: '#f97316',
  },
];

export const EXTRA_TESTS = [
  makeCase('generate_tech_doc_requires_server_auth',
    'generateTechDoc authenticates server-side before generating internal docs',
    () => {
      const required = [
        'async function requireGenerateTechDocAdmin',
        'await base44.auth.me()',
        "authError(401, 'Authentication required')",
        'if (auth.response) return auth.response',
        'PDFDocument.create()',
      ];
      const missing = missingTokens(generateTechDocSource, required);
      const guardBeforePdf = generateTechDocSource.indexOf('if (auth.response) return auth.response') < generateTechDocSource.indexOf('PDFDocument.create()');
      if (missing.length || !guardBeforePdf) {
        return fail('generateTechDoc can generate internal docs before server auth is proven.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          file: 'base44/functions/generateTechDoc/entry.ts',
          expected: 'base44.auth.me() guard returns 401 before PDFDocument.create()',
          actual: { missing, guardBeforePdf },
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      return pass('generateTechDoc performs server-side authentication before creating the PDF.', {
        verification: 'STATIC_CONTRACT',
        classification: 'STATIC_CHECK_LIMITATION',
        actionType: ACTION_TYPES.CODE_FIX,
      });
    }),

  makeCase('generate_tech_doc_requires_admin_authorization',
    'generateTechDoc requires admin role or the existing server-side admin email pattern',
    () => {
      const required = [
        "const ADMIN_EMAIL = 'sariverim@gmail.com'",
        "user.role !== 'admin'",
        'user.email !== ADMIN_EMAIL',
        "authError(403, 'Admin access required')",
      ];
      const forbidden = presentTokens(generateTechDocSource, [
        'req.json()',
        'isAdmin',
        'admin: true',
      ]);
      const missing = missingTokens(generateTechDocSource, required);
      if (missing.length || forbidden.length) {
        return fail('generateTechDoc admin authorization contract drifted.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          file: 'base44/functions/generateTechDoc/entry.ts',
          expected: 'server-side user.role/admin email authorization; no client-supplied admin flag',
          actual: { missing, forbidden },
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      return pass('generateTechDoc authorizes admins from server auth context only.', {
        verification: 'STATIC_CONTRACT',
        classification: 'STATIC_CHECK_LIMITATION',
        actionType: ACTION_TYPES.CODE_FIX,
      });
    }),

  makeCase('generate_tech_doc_errors_do_not_leak_internal_doc_details',
    'generateTechDoc returns controlled errors and does not expose stack traces',
    () => {
      const required = [
        "Response.json({ error: 'Internal server error' }, { status: 500 })",
        "console.error('[generateTechDoc] failed', error)",
      ];
      const forbidden = presentTokens(generateTechDocSource, [
        'stack: error.stack',
        'error.message, stack',
      ]);
      const missing = missingTokens(generateTechDocSource, required);
      if (missing.length || forbidden.length) {
        return fail('generateTechDoc error response can leak internal details.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          file: 'base44/functions/generateTechDoc/entry.ts',
          expected: 'generic 500 JSON response; stack logged server-side only',
          actual: { missing, forbidden },
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      return pass('generateTechDoc uses controlled JSON errors without stack leakage.', {
        verification: 'STATIC_CONTRACT',
        classification: 'STATIC_CHECK_LIMITATION',
        actionType: ACTION_TYPES.CODE_FIX,
      });
    }),

  makeCase('generate_tech_doc_client_handles_401_403',
    'Settings direct caller checks generateTechDoc response status before downloading',
    () => {
      const required = [
        "base44.functions.fetch('/generateTechDoc'",
        'if (!res.ok)',
        'setDocError',
        'await res.json().catch',
        'Teknik doküman indirilemedi.',
      ];
      const missing = missingTokens(settingsPageSource, required);
      if (missing.length) {
        return fail('Settings would still download 401/403 JSON as a PDF.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          file: 'src/pages/SettingsPage.jsx',
          expected: 'res.ok guard + controlled admin-facing error copy',
          actual: { missing },
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      return pass('Settings handles generateTechDoc 401/403 responses gracefully.', {
        verification: 'STATIC_CONTRACT',
        classification: 'STATIC_CHECK_LIMITATION',
        actionType: ACTION_TYPES.CODE_FIX,
      });
    },
    { critical: false }),

  makeCase('generate_tech_doc_runtime_auth_probe_needed',
    'Runtime probe: unauthenticated 401, non-admin 403, admin success',
    () => notAutomatable('Static contracts prove the guard exists, but release sign-off still needs real calls as unauthenticated, authenticated non-admin, and admin users.', {
      verification: 'NOT_AUTOMATABLE',
      classification: 'STATIC_CHECK_LIMITATION',
      actionType: ACTION_TYPES.BACKEND_RUNTIME_PROBE,
      expected: 'unauthenticated -> 401; non-admin -> 403; admin -> PDF success',
      actual: 'runtime auth contexts not available in static Health',
    }),
    { actionType: ACTION_TYPES.BACKEND_RUNTIME_PROBE, critical: true, runtimeProofRequired: true }),
];
