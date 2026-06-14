// Kronox Health Center — Security cleanup contracts.
//
// Product decisions locked by this suite:
// - Spotify/external music-provider import functions are removed because
//   Kronox does not use them now.
// - VAPID keys are read from deployment secrets/config, never hardcoded.
// - VAPID_PRIVATE_KEY is backend-env-only; scanner findings about the env var
//   name are deployment-secret management notes when no key material is
//   committed, logged, returned, or exposed through VITE_ config.
// - Missing VAPID config skips push only; the persisted in-app invite flow
//   remains available.
// - Admin access is DB-backed through the private AdminUser source-of-truth;
//   no personal email or env allowlist is committed as an admin backdoor.

import adminSource from '../../lib/admin.js?raw';
import gameInviteSelectorsSource from '../../lib/gameInviteSelectors.js?raw';
import sendGameInvitePushSource from '../../../base44/functions/sendGameInvitePush/entry.ts?raw';
import resetTestAccountProgressSource from '../../../base44/functions/resetTestAccountProgress/entry.ts?raw';
import diagnoseSoloQuestionStartQuerySource from '../../../base44/functions/diagnoseSoloQuestionStartQuery/entry.ts?raw';
import diagnoseSoloQuestionStartQueryScriptSource from '../../../scripts/diagnoseSoloQuestionStartQuery.mjs?raw';
import accountDeletionPageSource from '../../pages/AccountDeletionPage.jsx?raw';
import privacyPolicySource from '../../pages/PrivacyPolicy.jsx?raw';
import publicContactConfigSource from '../../lib/publicContactConfig.js?raw';
import generateTechDocSource from '../../../base44/functions/generateTechDoc/entry.ts?raw';
import generateWorkflowDocSource from '../../../base44/functions/generateWorkflowDoc/entry.ts?raw';
import seedQuestionCategoriesSource from '../../../base44/functions/seedQuestionCategories/entry.ts?raw';
import caseRegistrySource from './simulationPanelCaseRegistry.jsx?raw';
import {
  SECURITY_DEPLOYMENT_DOC as securityDeploymentDocSource,
  RELEASE_PROOF_CHECKLIST_DOC as releaseProofChecklistSource,
} from '@/lib/healthAlignmentDocMirrors';

const SUITE_ID = 'security_cleanup_health';
const SUITE_NAME = 'Security Cleanup Health Suite';

const STATUS = {
  PASS: 'PASS',
  FAIL: 'FAIL',
  NOT_AUTOMATABLE: 'NOT_AUTOMATABLE',
};

const ACTION_TYPES = {
  CODE_FIX: 'CODE_FIX',
  BACKEND_RUNTIME_PROBE: 'BACKEND_RUNTIME_PROBE',
};

const LIVE_SOURCES = [
  adminSource,
  gameInviteSelectorsSource,
  sendGameInvitePushSource,
  resetTestAccountProgressSource,
  diagnoseSoloQuestionStartQuerySource,
  diagnoseSoloQuestionStartQueryScriptSource,
  accountDeletionPageSource,
  privacyPolicySource,
  publicContactConfigSource,
  generateTechDocSource,
  generateWorkflowDocSource,
  seedQuestionCategoriesSource,
  caseRegistrySource,
].join('\n');

const removedMusicFunctionNames = [
  ['load', 'MusicQuestions'].join('Spotify'),
  ['populate', 'Questions'].join('Spotify'),
  ['search', 'Track'].join('Spotify'),
];

const removedProviderEndpoints = [
  ['api', 'com'].join('.spotify.'),
  ['accounts', 'com'].join('.spotify.'),
];

const removedProviderCredentialMarkers = [
  ['SPOTIFY', 'CLIENT', 'ID'].join('_'),
  ['SPOTIFY', 'CLIENT', 'SECRET'].join('_'),
  ['client', 'secret'].join('_'),
  ['client', 'id'].join('_'),
];

const privateKeyBlockPattern = new RegExp([
  ['-----', 'BEGIN '].join(''),
  '[^-]+',
  ['PRIVATE KEY', '-----'].join(''),
].join(''));
const EMAIL_LITERAL_REGEX = /\b[\w.+-]+@[\w-]+(?:\.[\w-]+)*\.[A-Za-z]{2,}\b/g;
const ALLOWED_EMAIL_LITERAL_SUFFIXES = ['@example.com', '@example.test', '@kronos.local'];

function findCommittedEmailLiterals(source) {
  return Array.from(new Set(String(source || '').match(EMAIL_LITERAL_REGEX) || []))
    .filter((value) => {
      const normalized = value.toLowerCase();
      return !ALLOWED_EMAIL_LITERAL_SUFFIXES.some((suffix) => normalized.endsWith(suffix));
    });
}

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

function pass(reason, extra = {}) {
  return { status: STATUS.PASS, reason, ...extra };
}

function fail(reason, extra = {}) {
  return { status: STATUS.FAIL, reason, ...extra };
}

function notAutomatable(reason, extra = {}) {
  return { status: STATUS.NOT_AUTOMATABLE, reason, ...extra };
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
    color: '#ef4444',
  },
];

export const EXTRA_TESTS = [
  makeCase('spotify_integration_removed',
    'Spotify integration functions are removed from active Health/runtime sources',
    () => {
      const forbidden = presentTokens(LIVE_SOURCES, [
        ...removedMusicFunctionNames,
        ...removedProviderEndpoints,
      ]);
      if (forbidden.length) {
        return fail('Removed Spotify integration is still referenced by active sources.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          expected: 'No active Spotify function names or API endpoints',
          actual: { forbidden },
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      return pass('No active runtime/Health source references the removed Spotify integration.', {
        verification: 'STATIC_CONTRACT',
        actionType: ACTION_TYPES.CODE_FIX,
      });
    }),

  makeCase('no_spotify_secrets_in_source',
    'Spotify credentials are not present in source',
    () => {
      const forbidden = presentTokens(LIVE_SOURCES, [
        ...removedProviderCredentialMarkers,
      ]);
      if (forbidden.length) {
        return fail('Spotify credential markers still exist in source.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          expected: 'No Spotify credential names or credential fields',
          actual: { forbidden },
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      return pass('No Spotify credential markers are present in active source.', {
        verification: 'STATIC_CONTRACT',
        actionType: ACTION_TYPES.CODE_FIX,
      });
    }),

  makeCase('vapid_keys_not_hardcoded',
    'sendGameInvitePush reads VAPID values from env/config only',
    () => {
      const required = [
        'VAPID_CONFIG_FIELDS',
        "canonicalName: 'VAPID_PUBLIC_KEY'",
        "envNames: ['VAPID_PUBLIC_KEY', 'KRONOX_VAPID_PUBLIC_KEY']",
        "canonicalName: 'VAPID_PRIVATE_KEY'",
        "envNames: ['VAPID_PRIVATE_KEY', 'KRONOX_VAPID_PRIVATE_KEY']",
        "canonicalName: 'VAPID_SUBJECT'",
        "envNames: ['VAPID_SUBJECT', 'KRONOX_VAPID_SUBJECT']",
        'Deno.env.get(envName)',
        'readRequiredVapidValue',
        'isInvalidVapidValue',
        'isValidVapidSubject',
        'isLikelyVapidKey',
        'summarizeVapidConfigState',
        'vapid_config_missing',
        'pushSent: false',
        'pushSkipped: true',
        'missingConfig: true',
        'missingCount',
        'invalidCount',
        'sanitizePushErrorReason',
        'push_invite_failed',
        'webpush.setVapidDetails(config.subject, config.publicKey, config.privateKey)',
      ];
      const forbidden = [
        /privateKey\s*:\s*['"][^'"]{12,}['"]/,
        /publicKey\s*:\s*['"][^'"]{12,}['"]/,
        /subject\s*:\s*['"]mailto:[^'"]+['"]/,
        /Deno\.env\.get\('(?:KRONOX_)?VAPID_(?:PUBLIC_KEY|PRIVATE_KEY|SUBJECT)'\)\s*\|\|\s*['"]['"]/,
        /Deno\.env\.get\('(?:KRONOX_)?VAPID_SUBJECT'\)\s*\|\|\s*['"][^'"]+['"]/,
        /Deno\.env\.get\('VITE_[^']*VAPID[^']*'\)/,
        /Deno\.env\.get\('VITE_[^']*(?:PRIVATE|SECRET|TOKEN)[^']*'\)/,
        /console\.(?:log|warn|error)\([^;]*(?:config\.privateKey|privateKey|KRONOX_VAPID_PRIVATE_KEY)/,
        /return\s+json\(\{[\s\S]{0,500}privateKey\s*:/,
        /console\.error\([^;]*(?:\.message|\|\|\s*error|,\s*error)/,
        /acceptedEnvNames/,
        /missingConfig:\s*config\.missing/,
        /invalidConfig:\s*config\.invalid/,
        privateKeyBlockPattern,
      ].filter((pattern) => pattern.test(sendGameInvitePushSource));
      const missing = missingTokens(sendGameInvitePushSource, required);
      if (missing.length || forbidden.length) {
        return fail('VAPID key handling can still expose committed key material.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          file: 'base44/functions/sendGameInvitePush/entry.ts',
          expected: 'Server VAPID keys read from non-VITE Deno.env names only, strictly validated, and never empty-string/defaulted',
          actual: { missing, forbidden: forbidden.map(String) },
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      return pass('VAPID keys are loaded from server env/config names, strict validation rejects missing/blank values, no empty/default/VITE private-key fallback is present, and private key values are not logged or returned.', {
        verification: 'STATIC_CONTRACT',
        actionType: ACTION_TYPES.CODE_FIX,
      });
    }),

  makeCase('vapid_private_key_backend_secret_only',
    'VAPID_PRIVATE_KEY is backend-env-only and never exposed to frontend/logs/responses',
    () => {
      const required = [
        "canonicalName: 'VAPID_PRIVATE_KEY'",
        "envNames: ['VAPID_PRIVATE_KEY', 'KRONOX_VAPID_PRIVATE_KEY']",
        'Deno.env.get(envName)',
        'config.privateKey',
        'webpush.setVapidDetails(config.subject, config.publicKey, config.privateKey)',
        'vapid_config_missing',
        'pushSent: false',
        'pushSkipped: true',
        'missingConfig: true',
        'missingCount',
        'invalidCount',
        'push_invite_failed',
      ];
      const forbidden = [
        /VITE_[A-Z0-9_]*VAPID_PRIVATE_KEY/,
        /VITE_[A-Z0-9_]*PRIVATE_KEY/,
        /Deno\.env\.get\('VITE_[^']*(?:VAPID|PRIVATE|SECRET|TOKEN)[^']*'\)/,
        /import\.meta\.env\.[A-Z0-9_]*VAPID_PRIVATE_KEY/,
        /console\.(?:log|warn|error)\([^;]*(?:config\.privateKey|privateKey|KRONOX_VAPID_PRIVATE_KEY)/,
        /return\s+json\(\{[\s\S]{0,500}privateKey\s*:/,
        /console\.error\([^;]*(?:\.message|\|\|\s*error|,\s*error)/,
        /privateKey\s*:\s*['"][^'"]{12,}['"]/,
        /acceptedEnvNames/,
        /missingConfig:\s*config\.missing/,
        /invalidConfig:\s*config\.invalid/,
        privateKeyBlockPattern,
      ].filter((pattern) => pattern.test(sendGameInvitePushSource));
      const missing = missingTokens(sendGameInvitePushSource, required);
      if (missing.length || forbidden.length) {
        return fail('VAPID private key handling may expose backend secret material.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          file: 'base44/functions/sendGameInvitePush/entry.ts',
          expected: 'VAPID_PRIVATE_KEY is read only from backend env, used only for webpush signing, never logged/returned/client-exposed',
          actual: { missing, forbidden: forbidden.map(String) },
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      return pass('VAPID_PRIVATE_KEY remains backend-env-only; scanner env-name findings are deployment-secret management notes when no value is committed.', {
        verification: 'STATIC_CONTRACT',
        classification: 'STATIC_CHECK_LIMITATION',
        actionType: ACTION_TYPES.CODE_FIX,
      });
    }),

  makeCase('push_invite_graceful_without_vapid',
    'Missing VAPID config does not break persisted in-app invite flow',
    () => {
      const missing = missingTokens(sendGameInvitePushSource, [
        'missing_vapid_config',
        'vapid_config_missing',
        'attempted: false',
        'ok: false',
        'pushSent: false',
        'pushSkipped: true',
        'missingConfig: true',
        'push skipped but in-app invite remains available',
        'summarizeVapidConfigState',
        'missingCount',
        'invalidCount',
        'console.warn',
      ]);
      if (missing.length) {
        return fail('Missing push secrets can break or hide the expected graceful fallback.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          file: 'base44/functions/sendGameInvitePush/entry.ts',
          expected: 'Best-effort push skip with in-app invite preserved',
          actual: { missing },
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      return pass('Missing VAPID config is handled as a best-effort push skip.', {
        verification: 'STATIC_CONTRACT',
        actionType: ACTION_TYPES.CODE_FIX,
      });
    }),

  makeCase('reset_test_account_progress_env_allowlist_removed',
    'resetTestAccountProgress uses AdminUser authorization, not KRONOX_TEST_RESET_EMAILS',
    () => {
      const required = [
        'requireAdmin(base44)',
        "source: 'AdminUser'",
        'confirmEmail',
        'confirmation_mismatch',
        'base44.asServiceRole.entities.User.update',
        'updateSoloLeaderboardRows',
      ];
      const forbidden = [
        'KRONOX_TEST_RESET_EMAILS',
        'TEST_RESET_EMAILS',
        'getConfiguredEmails',
        'getResettableTestEmails',
        'test_account_not_allowlisted',
        'body?.role',
        'user.role',
      ].filter((token) => resetTestAccountProgressSource.includes(token));
      const missing = missingTokens(resetTestAccountProgressSource, required);
      if (missing.length || forbidden.length) {
        return fail('resetTestAccountProgress still has unsafe test-reset authorization markers.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          file: 'base44/functions/resetTestAccountProgress/entry.ts',
          expected: 'AdminUser-backed requireAdmin, exact target confirmation, no KRONOX_TEST_RESET_EMAILS / TEST_RESET_EMAILS runtime authorization',
          actual: { missing, forbidden },
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      return pass('resetTestAccountProgress no longer reads env email allowlists and remains AdminUser-gated.', {
        verification: 'STATIC_CONTRACT',
        actionType: ACTION_TYPES.CODE_FIX,
      });
    }),

  makeCase('vapid_public_and_subject_docs_aligned',
    'VAPID public key and subject scanner context is documented accurately',
    () => {
      const combined = `${securityDeploymentDocSource}\n${releaseProofChecklistSource}`;
      const required = [
        'VAPID_PUBLIC_KEY',
        'public-by-design',
        'config-managed',
        'VAPID_SUBJECT',
        'contact/config metadata',
        'must not be logged',
        'VAPID_PRIVATE_KEY',
        'server-only',
        'never logged, returned',
      ];
      const missing = missingTokens(combined, required);
      if (missing.length) {
        return fail('VAPID public/subject scanner context docs are incomplete.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          files: ['docs/KRONOX_SECURITY_DEPLOYMENT.md', 'docs/KRONOX_RELEASE_PROOF_CHECKLIST.md'],
          expected: 'Private key server-only; public key public-by-design/config-managed; subject contact/config metadata and not logged.',
          actual: { missing },
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      return pass('VAPID private/public/subject distinctions are documented for scanner triage and release proof.', {
        verification: 'STATIC_CONTRACT',
        actionType: ACTION_TYPES.CODE_FIX,
      });
    }),

  makeCase('admin_email_not_hardcoded',
    'Admin access does not use a committed personal email',
    () => {
      const forbidden = [
        ...presentTokens(LIVE_SOURCES, [[ 'ADMIN', 'EMAIL =' ].join('_')]),
      ];
      if (forbidden.length) {
        return fail('A committed personal admin email is still present.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          expected: 'No personal admin email or legacy admin-email constant',
          actual: { forbidden },
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      return pass('No personal admin email or legacy admin-email constant appears in active source.', {
        verification: 'STATIC_CONTRACT',
        actionType: ACTION_TYPES.CODE_FIX,
      });
    }),

  makeCase('diagnostic_and_public_contact_emails_not_hardcoded',
    'Diagnostics and public contact pages avoid committed email literals',
    () => {
      const combined = [
        diagnoseSoloQuestionStartQuerySource,
        diagnoseSoloQuestionStartQueryScriptSource,
        accountDeletionPageSource,
        privacyPolicySource,
        publicContactConfigSource,
      ].join('\n');
      const personalEmail = [['sari', 'verim'].join(''), 'gmail.com'].join('@');
      const supportEmail = ['support', 'kronoxgame.com'].join('@');
      const required = [
        'VITE_KRONOX_SUPPORT_EMAIL',
        'getPublicSupportEmail',
        'buildPublicSupportMailto',
        'SOLO_DIAGNOSTIC_REQUESTED_EMAIL',
        'requestedUserEmailMasked',
        'requireAdmin(base44)',
      ];
      const forbidden = presentTokens(combined, [
        personalEmail,
        supportEmail,
        'SOLO_QUESTION_RUNTIME_DEBUG_TARGET_EMAIL',
        'OWNER_EMAIL',
        'const SUPPORT_EMAIL =',
      ]);
      const genericEmailLiterals = findCommittedEmailLiterals(combined);
      const missing = missingTokens(combined, required);
      if (missing.length || forbidden.length || genericEmailLiterals.length) {
        return fail('Diagnostics or public pages still expose committed email literals.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          expected: 'AdminUser-backed diagnostics with generic masking and public support email supplied by VITE_KRONOX_SUPPORT_EMAIL',
          actual: { missing, forbidden, genericEmailLiterals },
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      return pass('Diagnostics use AdminUser/request-env targeting with generic masking, and public contact email comes from deployment config.', {
        verification: 'STATIC_CONTRACT',
        actionType: ACTION_TYPES.CODE_FIX,
      });
    }),

  makeCase('admin_access_role_or_config_based',
    'Admin gates use DB-backed AdminUser authority plus client status hint',
    () => {
      const requiredBackend = [
        'requireAdmin',
        'ADMIN_AUTH_FIELD_CANDIDATES',
        'entities?.AdminUser',
        'base44.auth.me()',
        'status',
        'active',
        'owner',
        'admin',
      ];
      const requiredClient = [
        'function isAdminUser',
        "user.role === 'admin'",
        'user.is_admin === true',
        "user.permissions.includes('admin')",
        'withAdminStatus',
        '/getAdminStatus',
      ];
      const backendSource = [
        generateTechDocSource,
        generateWorkflowDocSource,
        seedQuestionCategoriesSource,
      ].join('\n');
      const missing = [
        ...missingTokens(backendSource, requiredBackend),
        ...missingTokens(adminSource, requiredClient),
      ];
      if (missing.length) {
        return fail('Admin authorization is not clearly DB-backed through AdminUser.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          expected: 'inline AdminUser guard on backend + client backend-status helper',
          actual: { missing },
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      return pass('Admin authorization is DB-backed through AdminUser without a committed email allowlist.', {
        verification: 'STATIC_CONTRACT',
        actionType: ACTION_TYPES.CODE_FIX,
      });
    }),

  makeCase('no_exposed_secret_patterns',
    'Static source scan has no obvious committed secret patterns in affected sources',
    () => {
      const patterns = [
        new RegExp(`${['s', 'k'].join('')}-[A-Za-z0-9_-]{20,}`),
        new RegExp(`${['g', 'h', 'p'].join('')}_[A-Za-z0-9_]{20,}`),
        new RegExp(`${['A', 'K', 'I', 'A'].join('')}[0-9A-Z]{16}`),
        /xox[baprs]-[A-Za-z0-9-]{20,}/,
        privateKeyBlockPattern,
      ];
      const found = patterns.filter((pattern) => pattern.test(LIVE_SOURCES));
      if (found.length) {
        return fail('Affected sources still contain an obvious secret-like pattern.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          actual: { patterns: found.map(String) },
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      return pass('No obvious secret-like pattern appears in affected active sources.', {
        verification: 'STATIC_CONTRACT',
        classification: 'STATIC_CHECK_LIMITATION',
        actionType: ACTION_TYPES.CODE_FIX,
      });
    }),

  makeCase('security_runtime_secret_scan_needed',
    'Runtime security scan should be rerun after deploy',
    () => notAutomatable('Static Health can verify source contracts, but deployed secret presence/rotation remains manual-only verification. A VAPID_PRIVATE_KEY env-var-name-only finding is a deployment-secret management warning, not a blocker, unless real key material is hardcoded, exposed, logged, returned, or read through VITE_.', {
      verification: 'NOT_AUTOMATABLE',
      classification: 'DEPLOYMENT_SECRET_MANAGEMENT',
      verificationLabels: ['MANUAL_REQUIRED', 'BACKEND_RUNTIME_PROBE', 'SECRET_DEPLOYMENT_REVIEW'],
      expected: 'External scan reports no exposed Spotify/VAPID/admin-email findings; backend VAPID_PRIVATE_KEY env-name-only usage is warning/manual deployment verification unless real key material is found.',
      actionType: ACTION_TYPES.BACKEND_RUNTIME_PROBE,
    }),
    { critical: false, runtimeProofRequired: true, actionType: ACTION_TYPES.BACKEND_RUNTIME_PROBE, verificationLabels: ['MANUAL_REQUIRED', 'BACKEND_RUNTIME_PROBE', 'SECRET_DEPLOYMENT_REVIEW'] }),
];
