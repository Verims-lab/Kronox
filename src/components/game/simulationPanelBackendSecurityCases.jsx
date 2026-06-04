// Kronox Health Center — Backend Security Contracts.
//
// Scope: static contracts for admin-only backend functions. Runtime auth
// probes still require real unauthenticated/non-admin/admin sessions.

import generateTechDocSource from '../../../base44/functions/generateTechDoc/entry.ts?raw';
import getQuestionsSource from '../../../base44/functions/getQuestions/entry.ts?raw';
import questionEntitySource from '../../../base44/entities/Question.jsonc?raw';
import useOfflineQuestionsSource from '../../hooks/useOfflineQuestions.js?raw';
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
    'generateTechDoc requires server-side admin role/permission or deployment-secret allowlist',
    () => {
      const required = [
        'function isAuthorizedAdmin',
        "user.role === 'admin'",
        'user.is_admin === true',
        "user.permissions.includes('admin')",
        "Deno.env.get('ADMIN_EMAILS')",
        "Deno.env.get('KRONOX_ADMIN_EMAILS')",
        "authError(403, 'Admin access required')",
      ];
      const forbidden = presentTokens(generateTechDocSource, [
        'req.json()',
        'body.isAdmin',
        'isAdmin: true',
        'admin: true',
        ['ADMIN', 'EMAIL ='].join('_'),
      ]);
      const missing = missingTokens(generateTechDocSource, required);
      if (missing.length || forbidden.length) {
        return fail('generateTechDoc admin authorization contract drifted.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          file: 'base44/functions/generateTechDoc/entry.ts',
          expected: 'server-side role/permission/admin secret allowlist authorization; no client-supplied admin flag or committed email',
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

  makeCase('get_questions_requires_auth',
    'getQuestions requires authentication before returning playable questions',
    () => {
      const required = [
        'await base44.auth.me()',
        'Giris yapmaniz gerekiyor.',
        '}, 401)',
        'authenticated_minimal_projection',
      ];
      const forbidden = presentTokens(getQuestionsSource, [
        'auth gerekmez',
        'Service role ile soruları çek',
      ]);
      const missing = missingTokens(getQuestionsSource, required);
      if (missing.length || forbidden.length) {
        return fail('getQuestions can still expose questions without authenticated user context.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          file: 'base44/functions/getQuestions/entry.ts',
          expected: 'auth.me guard returning 401 before scoped service-role Question.filter',
          actual: { missing, forbidden },
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      return pass('getQuestions has an authenticated-user guard and no unauthenticated source contract.', {
        verification: 'STATIC_CONTRACT',
        classification: 'STATIC_CHECK_LIMITATION',
      });
    }),

  makeCase('get_questions_returns_minimal_projection',
    'getQuestions returns minimal playable projection and active-only rows',
    () => {
      const required = [
        'normalizeQuestionForRuntime',
        'isActiveQuestion',
        "state === 'A'",
        'activeCategoryIds',
        'main_category_id',
        'sub_category:',
        'tag:',
        'category: \'genel\'',
        'type: \'metin\'',
        'media_url: \'\'',
      ];
      const forbidden = presentTokens(getQuestionsSource, [
        'region:',
        '...question',
      ]);
      const missing = missingTokens(getQuestionsSource, required);
      if (missing.length || forbidden.length) {
        return fail('getQuestions minimal projection or active-only filter drifted.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          file: 'base44/functions/getQuestions/entry.ts',
          expected: 'active Question + active Category + minimal gameplay fields only',
          actual: { missing, forbidden },
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      return pass('getQuestions filters active playable rows and returns only minimal runtime fields.', {
        verification: 'STATIC_CONTRACT',
      });
    }),

  makeCase('no_public_question_bank_fallback',
    'Gameplay question loading has no direct public Question.list fallback',
    () => {
      const forbidden = presentTokens(useOfflineQuestionsSource, [
        'base44.entities.Question.list',
        'Question.list(',
      ]);
      const required = missingTokens(useOfflineQuestionsSource, [
        "base44.functions.invoke('getQuestions'",
        'activeCategoryIds',
        'Direct Question.list fallback',
      ]);
      const questionReadIsAdminOnly = String(questionEntitySource).includes('"read"')
        && String(questionEntitySource).includes('"role": "admin"');
      if (forbidden.length || required.length || !questionReadIsAdminOnly) {
        return fail('Question bank can still be read through a client/entity fallback.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          expected: 'useOfflineQuestions invokes getQuestions only; Question.read is admin-only',
          actual: { forbidden, required, questionReadIsAdminOnly },
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      return pass('Normal gameplay uses authenticated getQuestions and direct Question read is admin-only.', {
        verification: 'STATIC_CONTRACT',
      });
    }),
];
