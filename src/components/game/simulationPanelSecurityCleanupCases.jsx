// Kronox Health Center — Security cleanup contracts.
//
// Product decisions locked by this suite:
// - Spotify/external music-provider import functions are removed because
//   Kronox does not use them now.
// - VAPID keys are read from deployment secrets/config, never hardcoded.
// - Missing VAPID config skips push only; the persisted in-app invite flow
//   remains available.
// - Admin access is role/permission/config based; no personal email is
//   committed as an admin backdoor.

import adminSource from '../../lib/admin.js?raw';
import gameInviteSelectorsSource from '../../lib/gameInviteSelectors.js?raw';
import sendGameInvitePushSource from '../../../base44/functions/sendGameInvitePush/entry.ts?raw';
import generateTechDocSource from '../../../base44/functions/generateTechDoc/entry.ts?raw';
import generateWorkflowDocSource from '../../../base44/functions/generateWorkflowDoc/entry.ts?raw';
import seedQuestionCategoriesSource from '../../../base44/functions/seedQuestionCategories/entry.ts?raw';
import caseRegistrySource from './simulationPanelCaseRegistry.jsx?raw';
import notificationDeploymentHintSource from '../notifications/NotificationDeploymentHint.jsx?raw';

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
  generateTechDocSource,
  generateWorkflowDocSource,
  seedQuestionCategoriesSource,
  caseRegistrySource,
  notificationDeploymentHintSource,
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
        "Deno.env.get('VAPID_PUBLIC_KEY')",
        "Deno.env.get('VAPID_PRIVATE_KEY')",
        "Deno.env.get('VAPID_SUBJECT')",
        "Deno.env.get('KRONOX_VAPID_PUBLIC_KEY')",
        "Deno.env.get('KRONOX_VAPID_PRIVATE_KEY')",
      ];
      const forbidden = [
        /privateKey\s*:\s*['"][^'"]{12,}['"]/,
        /publicKey\s*:\s*['"][^'"]{12,}['"]/,
        privateKeyBlockPattern,
      ].filter((pattern) => pattern.test(sendGameInvitePushSource));
      const missing = missingTokens(sendGameInvitePushSource, required);
      if (missing.length || forbidden.length) {
        return fail('VAPID key handling can still expose committed key material.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          file: 'base44/functions/sendGameInvitePush/entry.ts',
          expected: 'VAPID keys read from Deno.env only; no literal key material',
          actual: { missing, forbidden: forbidden.map(String) },
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      return pass('VAPID keys are loaded from env/config and no literal key material is present.', {
        verification: 'STATIC_CONTRACT',
        actionType: ACTION_TYPES.CODE_FIX,
      });
    }),

  makeCase('push_invite_graceful_without_vapid',
    'Missing VAPID config does not break persisted in-app invite flow',
    () => {
      const missing = missingTokens(sendGameInvitePushSource, [
        'missing_vapid_config',
        'attempted: false',
        'push skipped but in-app invite remains available',
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

  makeCase('admin_access_role_or_config_based',
    'Admin gates use role/permission fields or deployment-secret allowlist',
    () => {
      const requiredBackend = [
        'function getConfiguredAdminEmails',
        "Deno.env.get('ADMIN_EMAILS')",
        "Deno.env.get('KRONOX_ADMIN_EMAILS')",
        'function isAuthorizedAdmin',
        "user.role === 'admin'",
        'user.is_admin === true',
        "user.permissions.includes('admin')",
      ];
      const requiredClient = [
        'function isAdminUser',
        "user.role === 'admin'",
        'user.is_admin === true',
        "user.permissions.includes('admin')",
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
        return fail('Admin authorization is not clearly role/permission/config based.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          expected: 'server role/permission/admin secret allowlist + client role/permission helper',
          actual: { missing },
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      return pass('Admin authorization is role/permission/config based without a committed email.', {
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
    () => notAutomatable('Static Health can verify source contracts, but the external security scanner must rerun against the deployed function bundle.', {
      verification: 'NOT_AUTOMATABLE',
      classification: 'STATIC_CHECK_LIMITATION',
      expected: 'Security scan reports no exposed Spotify/VAPID/admin-email findings',
      actionType: ACTION_TYPES.BACKEND_RUNTIME_PROBE,
    }),
    { critical: true, runtimeProofRequired: true, actionType: ACTION_TYPES.BACKEND_RUNTIME_PROBE }),
];
