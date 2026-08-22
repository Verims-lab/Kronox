// Kronox Health Center — Security cleanup contracts.
//
// Product decisions locked by this suite:
// - Spotify/external music-provider import functions are removed because
//   Kronox does not use them now.
// - VAPID values are read request-time from Base44 project secrets, never hardcoded.
// - VAPID_PRIVATE_KEY is backend-only and never logged, returned, rendered,
//   included in Health output, or exposed through VITE_ config.
// - Missing VAPID config skips push only; the persisted in-app invite flow
//   remains available.
// - Admin access is DB-backed through the private AdminUser source-of-truth;
//   no personal email or env allowlist is committed as an admin backdoor.

import adminSource from '../../lib/admin.js?raw';
import gameInviteSelectorsSource from '../../lib/gameInviteSelectors.js?raw';
import sendGameInvitePushSource from '../../../base44/functions/sendGameInvitePush/entry.ts?raw';
import diagnoseSoloQuestionStartQueryScriptSource from '../../../scripts/diagnoseSoloQuestionStartQuery.mjs?raw';
import accountDeletionPageSource from '../../pages/AccountDeletionPage.jsx?raw';
import privacyPolicySource from '../../pages/PrivacyPolicy.jsx?raw';
import publicContactConfigSource from '../../lib/publicContactConfig.js?raw';
import appParamsSource from '../../lib/app-params.js?raw';
import base44ClientSource from '../../api/base44Client.js?raw';
import chartSource from '../ui/chart.jsx?raw';
import generateTechDocSource from '../../../base44/functions/generateTechDoc/entry.ts?raw';
import generateWorkflowDocSource from '../../../base44/functions/generateWorkflowDoc/entry.ts?raw';
import sendFriendRequestSource from '../../../base44/functions/sendFriendRequest/entry.ts?raw';
import createGameInvitesForTargetsSource from '../../../base44/functions/createGameInvitesForTargets/entry.ts?raw';
import getOnlinePlayerSelectionSource from '../../../base44/functions/getOnlinePlayerSelection/entry.ts?raw';
import startLobbyGameSource from '../../../base44/functions/startLobbyGame/entry.ts?raw';
import acceptGameInviteSource from '../../../base44/functions/acceptGameInvite/entry.ts?raw';
import caseRegistrySource from './simulationPanelCaseRegistry.jsx?raw';
import npmConfigSource from '../../../.npmrc?raw';
import packageJsonSource from '../../../package.json?raw';
import packageLockJsonSource from '../../../package-lock.json?raw';
import sdkPinGuardSource from '../../../scripts/checkBase44SdkPin.mjs?raw';
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
  diagnoseSoloQuestionStartQueryScriptSource,
  accountDeletionPageSource,
  privacyPolicySource,
  publicContactConfigSource,
  generateTechDocSource,
  generateWorkflowDocSource,
  appParamsSource,
  base44ClientSource,
  chartSource,
  sendFriendRequestSource,
  createGameInvitesForTargetsSource,
  getOnlinePlayerSelectionSource,
  startLobbyGameSource,
  acceptGameInviteSource,
  caseRegistrySource,
].join('\n');

const BASE44_SDK_VERSION = '0.8.34';
const PACKAGE_LOCK_PROOF = {
  packageLockAvailable: true,
  classification: 'SOURCE_CONNECTED',
  fixOwner: 'Codex package / repo',
  nextAction: 'Keep package.json and package-lock root/resolved SDK versions exact and aligned.',
};
const CRITICAL_BASE44_FUNCTION_SDK_SOURCES = [
  ['sendFriendRequest', sendFriendRequestSource],
  ['createGameInvitesForTargets', createGameInvitesForTargetsSource],
  ['getOnlinePlayerSelection', getOnlinePlayerSelectionSource],
  ['startLobbyGame', startLobbyGameSource],
  ['acceptGameInvite', acceptGameInviteSource],
  ['sendGameInvitePush', sendGameInvitePushSource],
];

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

function parseJsonSource(source) {
  try {
    return JSON.parse(String(source || '{}'));
  } catch {
    return {};
  }
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
    'sendGameInvitePush reads VAPID values from Base44 runtime secrets only',
    () => {
      const required = [
        "import { secrets } from 'base44:runtime'",
        'secrets.get("VAPID_SUBJECT")',
        'secrets.get("VAPID_PUBLIC_KEY")',
        'secrets.get("VAPID_PRIVATE_KEY")',
        'const config = getVapidConfig()',
        'isInvalidVapidValue(value)',
        'PUSH_VAPID_NOT_CONFIGURED',
        'webpush.setVapidDetails(config.subject, config.publicKey, config.privateKey)',
      ];
      const forbidden = [
        /Deno\.env\.get\(["']VAPID_(?:SUBJECT|PUBLIC_KEY|PRIVATE_KEY)["']\)/,
        /privateKey\s*:\s*['"][A-Za-z0-9_-]{40,}['"]/, 
        /console\.(?:log|warn|error)\([^;]*(?:config\.privateKey|secretValues\.privateKey)/,
        /return\s+json\(\{[^}]*privateKey\s*:/,
        privateKeyBlockPattern,
      ].filter((pattern) => pattern.test(sendGameInvitePushSource));
      const missing = missingTokens(sendGameInvitePushSource, required);
      if (missing.length || forbidden.length) {
        return fail('VAPID runtime-secret handling can expose or bypass project-secret configuration.', {
          verification: 'SOURCE_CONNECTED',
          classification: 'REAL_PRODUCT_RISK',
          file: 'base44/functions/sendGameInvitePush/entry.ts',
          actual: { missing, forbidden: forbidden.map(String) },
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      return pass('VAPID config uses request-time Base44 runtime secrets with no committed/logged/returned key material.', {
        verification: 'SOURCE_CONNECTED',
        actionType: ACTION_TYPES.CODE_FIX,
      });
    }),

  makeCase('vapid_private_key_backend_secret_only',
    'VAPID_PRIVATE_KEY is a Base44 project secret and never exposed',
    () => {
      const required = [
        "import { secrets } from 'base44:runtime'",
        'secrets.get("VAPID_PRIVATE_KEY")',
        "vapidPrivateKeySource: 'base44_project_secret'",
        "vapidPrivateKeyProductionSecretManagerVerification: 'MANUAL_REQUIRED'",
        'webpush.setVapidDetails(config.subject, config.publicKey, config.privateKey)',
      ];
      const forbidden = [
        /Deno\.env\.get\(["']VAPID_PRIVATE_KEY["']\)/,
        /VITE_[A-Z0-9_]*VAPID_PRIVATE_KEY/,
        /console\.(?:log|warn|error)\([^;]*(?:config\.privateKey|secretValues\.privateKey)/,
        /return\s+json\(\{[^}]*privateKey\s*:/,
        /privateKey\s*:\s*['"][A-Za-z0-9_-]{40,}['"]/, 
        privateKeyBlockPattern,
      ].filter((pattern) => pattern.test(sendGameInvitePushSource));
      const missing = missingTokens(sendGameInvitePushSource, required);
      if (missing.length || forbidden.length) {
        return fail('VAPID private-key project-secret boundary drifted.', {
          verification: 'SOURCE_CONNECTED',
          classification: 'REAL_PRODUCT_RISK',
          file: 'base44/functions/sendGameInvitePush/entry.ts',
          actual: { missing, forbidden: forbidden.map(String) },
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      return pass('VAPID_PRIVATE_KEY is request-time Base44 secret material; production provisioning remains MANUAL_REQUIRED.', {
        verification: 'SOURCE_CONNECTED',
        classification: 'STATIC_CHECK_LIMITATION',
        actionType: ACTION_TYPES.CODE_FIX,
      });
    }),

  makeCase('push_invite_graceful_without_vapid',
    'Missing VAPID config does not break persisted in-app invite flow',
    () => {
      const missing = missingTokens(sendGameInvitePushSource, [
        'missing_vapid_config',
        'PUSH_VAPID_NOT_CONFIGURED',
        'attempted: false',
        'ok: false',
        'pushSent: false',
        'pushSkipped: true',
        'missingConfig: true',
        'push skipped but in-app invite remains available',
        'summarizeVapidConfigState',
        'missingCount',
        'invalidCount',
        'vapidConfigured',
        'vapidConfigValid',
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

  makeCase('base44_sdk_versions_exact_and_aligned',
    'Base44 SDK is exact-pinned and critical Base44 functions use the same Deno SDK version',
    () => {
      const requiredPackage = `"@base44/sdk": "${BASE44_SDK_VERSION}"`;
      const requiredDeno = `npm:@base44/sdk@${BASE44_SDK_VERSION}`;
      const npmConfig = String(npmConfigSource || '');
      const packageSource = String(packageJsonSource || '');
      const packageLockSource = String(packageLockJsonSource || '');
      const pinGuardSource = String(sdkPinGuardSource || '');
      const parsedPackageLock = parseJsonSource(packageLockSource);
      const packageLockRootPin = parsedPackageLock?.packages?.['']?.dependencies?.['@base44/sdk'];
      const packageLockResolvedVersion = parsedPackageLock?.packages?.['node_modules/@base44/sdk']?.version;
      const combinedFunctionSource = CRITICAL_BASE44_FUNCTION_SDK_SOURCES.map(([, source]) => source).join('\n');
      const missing = [
        ...(!/^save-exact\s*=\s*true\s*$/m.test(npmConfig) ? ['.npmrc save-exact guard'] : []),
        ...(!packageSource.includes(requiredPackage) ? ['package.json exact @base44/sdk pin'] : []),
        ...(!packageSource.includes('"preinstall": "node scripts/checkBase44SdkPin.mjs"') ? ['package.json SDK preinstall guard'] : []),
        ...(packageLockRootPin !== BASE44_SDK_VERSION ? ['package-lock.json root exact @base44/sdk pin'] : []),
        ...(packageLockResolvedVersion !== BASE44_SDK_VERSION ? ['package-lock.json resolved @base44/sdk version'] : []),
        ...(!pinGuardSource.includes("EXPECTED_SDK_VERSION = '0.8.34'") ? ['SDK install guard expected version'] : []),
        ...(!pinGuardSource.includes("readText('.npmrc')") ? ['SDK install guard .npmrc proof'] : []),
        ...(!pinGuardSource.includes('Base44 SDK install gate failed') ? ['SDK install guard fail-closed path'] : []),
        ...CRITICAL_BASE44_FUNCTION_SDK_SOURCES
          .filter(([, source]) => !String(source || '').includes(requiredDeno))
          .map(([name]) => `${name} Deno import ${requiredDeno}`),
      ];
      const forbidden = [
        '"@base44/sdk": "^',
        'npm:@base44/sdk@0.8.25',
        "from 'npm:@base44/sdk'",
        'from "npm:@base44/sdk"',
      ].filter((token) => `${packageSource}\n${packageLockSource}\n${combinedFunctionSource}`.includes(token));
      if (missing.length || forbidden.length) {
        return fail('Base44 SDK version alignment can drift between frontend and backend.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          expected: `Frontend package and critical Base44 functions all pin ${BASE44_SDK_VERSION}`,
          actual: { missing, forbidden },
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      return pass(`Base44 SDK is pinned to ${BASE44_SDK_VERSION} in .npmrc, package.json, package-lock root/resolution, the fail-fast install guard, and critical Base44 functions.`, {
        verification: 'STATIC_CONTRACT',
        classification: 'RUNTIME_PATH_VERIFIED',
        actionType: ACTION_TYPES.CODE_FIX,
        packageLayerProof: PACKAGE_LOCK_PROOF,
      });
    }),

  makeCase('markdown_raw_html_surface_closed',
    'No runtime markdown/raw HTML renderer is available for user/content markdown',
    () => {
      const combined = `${packageJsonSource}\n${chartSource}\n${LIVE_SOURCES}`;
      const forbidden = [
        'react-markdown',
        'rehype-raw',
        'dangerouslySetInnerHTML',
        'DOMParser',
        '.innerHTML',
      ].filter((token) => combined.includes(token));
      const requiredChartGuard = [
        'SAFE_CSS_IDENTIFIER_PATTERN',
        'SAFE_CSS_COLOR_VALUE_PATTERN',
        'getSafeCssIdentifier',
        'getSafeCssColorValue',
        '<style>{css}</style>',
      ].filter((token) => !chartSource.includes(token));
      if (forbidden.length || requiredChartGuard.length) {
        return fail('Markdown/raw HTML rendering surface is not closed.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          expected: 'No react-markdown/rehype-raw/dangerouslySetInnerHTML user-content path; chart CSS uses guarded text children',
          actual: { forbidden, missingChartGuard: requiredChartGuard },
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      return pass('Unused markdown renderer dependency is absent, raw HTML markdown is unsupported, and chart CSS avoids dangerouslySetInnerHTML.', {
        verification: 'STATIC_CONTRACT',
        classification: 'STATIC_CHECK_LIMITATION',
        actionType: ACTION_TYPES.CODE_FIX,
      });
    }),

  makeCase('base44_access_token_url_cleanup_guard',
    'Base44 access_token URL cleanup is preserved and token values are not logged or rendered',
    () => {
      const required = [
        'getAppParamValue("access_token", { removeFromUrl: true })',
        'urlParams.delete(paramName)',
        'window.history.replaceState',
        "storage.removeItem('base44_access_token')",
        "storage.removeItem('token')",
        'const { appId, token, appBaseUrl } = appParams',
        'createClient({',
      ];
      const combined = `${appParamsSource}\n${base44ClientSource}`;
      const missing = required.filter((token) => !combined.includes(token));
      const forbidden = [
        /console\.(?:log|warn|error)\([^;]*(?:access_token|base44_access_token|\btoken\b)/,
        /dangerouslySetInnerHTML[\s\S]{0,300}(?:access_token|base44_access_token|\btoken\b)/,
        /document\.write[\s\S]{0,300}(?:access_token|base44_access_token|\btoken\b)/,
      ].filter((pattern) => pattern.test(combined));
      if (missing.length || forbidden.length) {
        return fail('Base44 token URL cleanup/no-logging guard drifted.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          expected: 'Base44 access token removed from URL, stored only through existing Base44 app-param pattern, never logged/rendered',
          actual: { missing, forbidden: forbidden.map(String) },
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      return pass('Base44 access_token is removed from the URL and no token logging/rendering path is present in the app-param/client boundary.', {
        verification: 'STATIC_CONTRACT',
        classification: 'STATIC_CHECK_LIMITATION',
        actionType: ACTION_TYPES.CODE_FIX,
      });
    }),

  makeCase('vapid_public_and_subject_docs_aligned',
    'VAPID public key and subject scanner context is documented accurately',
    () => {
      const combined = `${securityDeploymentDocSource}\n${releaseProofChecklistSource}`;
      const required = [
        'VAPID_PUBLIC_KEY',
        'VAPID_SUBJECT',
        'VAPID_PRIVATE_KEY',
        'Base44 project secrets',
        'base44:runtime',
        'secrets.get(...)',
        'Deno.env.get(...)',
        'never be logged, returned, rendered',
        'MANUAL_REQUIRED',
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
    () => notAutomatable('Static Health verifies Base44 runtime-secret source contracts only. Production VAPID project-secret presence, rotation, deployment, and real-device delivery remain MANUAL_REQUIRED and must not expose any value in evidence.', {
      verification: 'NOT_AUTOMATABLE',
      classification: 'DEPLOYMENT_SECRET_MANAGEMENT',
      verificationLabels: ['MANUAL_REQUIRED', 'BACKEND_RUNTIME_PROBE', 'SECRET_DEPLOYMENT_REVIEW'],
      expected: 'Base44 production project secrets are provisioned and real subscribed-device push succeeds without exposing values.',
      actionType: ACTION_TYPES.BACKEND_RUNTIME_PROBE,
    }),
    { critical: false, runtimeProofRequired: true, actionType: ACTION_TYPES.BACKEND_RUNTIME_PROBE, verificationLabels: ['MANUAL_REQUIRED', 'BACKEND_RUNTIME_PROBE', 'SECRET_DEPLOYMENT_REVIEW'] }),
];
