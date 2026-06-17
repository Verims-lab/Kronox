// Kronox Health Center — Onboarding GuestProfile identity foundation.
//
// Static coverage only. Runtime proof still requires opening a fresh device
// session and confirming createGuestProfile creates a row without storing the
// raw token server-side.

import guestProfileEntitySource from '../../../base44/entities/GuestProfile.jsonc?raw';
import createGuestProfileSource from '../../../base44/functions/createGuestProfile/entry.ts?raw';
import guestProfileClientSource from '../../lib/guestProfile.js?raw';
import authContextSource from '../../lib/AuthContext.jsx?raw';
import leaderboardSource from '../../lib/leaderboard.js?raw';
import authProviderButtonsSource from '../auth/AuthProviderButtons.jsx?raw';

const STATUS = {
  PASS: 'PASS',
  FAIL: 'FAIL',
  NOT_AUTOMATABLE: 'NOT_AUTOMATABLE',
};

const ACTION_TYPES = {
  CODE_FIX: 'CODE_FIX',
  BACKEND_RUNTIME_PROBE: 'BACKEND_RUNTIME_PROBE',
};

const SUITE_ID = 'onboarding_guest_profile_health';
const SUITE_NAME = 'Onboarding GuestProfile Identity Suite';

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
  { id: SUITE_ID, name: SUITE_NAME, critical: true, color: '#38bdf8' },
];

export const EXTRA_TESTS = [
  makeCase('guest_profile_entity_exists',
    'GuestProfile entity documents portable app-owned guest identity',
    () => {
      const missing = missingTokens(guestProfileEntitySource, [
        '"name": "GuestProfile"',
        'guest_id',
        'guest_token_hash',
        'username',
        'display_name',
        '"guest"',
        '"linked"',
        '"abandoned"',
        'onboarding_status',
        'tutorial_status',
        'profile_setup_status',
        'category_setup_status',
        'linked_user_email',
        'last_seen_at',
        'Raw guest tokens are client-only',
      ]);
      if (missing.length) {
        return fail('GuestProfile entity is missing portable identity fields or raw-token boundary docs.', {
          verification: 'STATIC_CONTRACT',
          file: 'base44/entities/GuestProfile.jsonc',
          actual: { missing },
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      return pass('GuestProfile schema carries the app-owned guest identity foundation.', {
        verification: 'STATIC_CONTRACT',
        actionType: ACTION_TYPES.CODE_FIX,
      });
    }),

  makeCase('create_guest_profile_hashes_raw_token',
    'createGuestProfile stores token hash only and verifies guest_id plus token',
    () => {
      const required = [
        'createClientFromRequest',
        'HASH_ALGORITHM',
        'hashGuestToken',
        'guest_token_hash',
        'guest_token_hash_algorithm',
        'guest_id',
        'guest_token',
        'invalid_guest_token',
        'rawGuestTokenServerStored: false',
        'rawGuestTokenClientOnly: true',
        'tokenHashStored: true',
        'firebaseUsed: false',
        'base44AnonymousAuthUsed: false',
      ];
      const forbidden = presentTokens(createGuestProfileSource, [
        'console.log(body',
        'console.warn(body',
        'metadata: { guest_token',
        'guest_token_hash: guestToken',
      ]);
      const missing = missingTokens(createGuestProfileSource, required);
      if (missing.length || forbidden.length) {
        return fail('createGuestProfile can no longer prove the guest token/hash ownership contract.', {
          verification: 'STATIC_CONTRACT',
          file: 'base44/functions/createGuestProfile/entry.ts',
          expected: 'server-generated raw token returned once, DB stores guest_token_hash, subsequent calls verify guest_id + token',
          actual: { missing, forbidden },
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      return pass('createGuestProfile stores only guest_token_hash and verifies guest ownership server-side.', {
        verification: 'STATIC_CONTRACT',
        actionType: ACTION_TYPES.CODE_FIX,
      });
    }),

  makeCase('auth_bootstrap_creates_guest_without_login',
    'Auth bootstrap creates/verifies GuestProfile without forcing login',
    () => {
      const missing = missingTokens(`${authContextSource}\n${guestProfileClientSource}`, [
        'ensureGuestProfile',
        'guestProfile',
        'isGuest',
        'setIsAuthenticated(!!currentUser)',
        "base44.auth.me()",
        "base44.functions.invoke('createGuestProfile'",
        'rawGuestTokenStorage',
        'client_local_device_only',
      ]);
      const forbidden = presentTokens(authContextSource, [
        'signInAnonymously',
        'firebase.auth',
      ]);
      if (missing.length || forbidden.length) {
        return fail('Guest bootstrap can regress into login-first or Firebase/Base44 anonymous identity.', {
          verification: 'STATIC_CONTRACT',
          files: ['src/lib/AuthContext.jsx', 'src/lib/guestProfile.js'],
          actual: { missing, forbidden },
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      return pass('Unauthenticated app boot can create/verify an app-owned GuestProfile without forcing login.', {
        verification: 'STATIC_CONTRACT',
        actionType: ACTION_TYPES.CODE_FIX,
      });
    }),

  makeCase('default_username_is_kronoxuser_not_provider_id',
    'Default guest and leaderboard fallback identity uses KronoxUser username, not provider/email ids',
    () => {
      const missing = missingTokens(`${createGuestProfileSource}\n${guestProfileClientSource}\n${leaderboardSource}`, [
        'KronoxUser',
        'makeKronoxUserFallback',
        'getSafeLeaderboardName',
        '!explicitName.includes',
      ]);
      if (missing.length) {
        return fail('Public identity fallback is not locked to KronoxUser username semantics.', {
          verification: 'STATIC_CONTRACT',
          files: ['base44/functions/createGuestProfile/entry.ts', 'src/lib/guestProfile.js', 'src/lib/leaderboard.js'],
          actual: { missing },
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      return pass('Guest usernames and leaderboard fallbacks use KronoxUser format and avoid provider/email display.', {
        verification: 'STATIC_CONTRACT',
        actionType: ACTION_TYPES.CODE_FIX,
      });
    }),

  makeCase('apple_google_email_login_preserved',
    'Existing Apple, Google, and email login entry points remain visible',
    () => {
      const missing = missingTokens(authProviderButtonsSource, [
        'Apple ile Giriş Yap',
        'Google ile Giriş Yap',
        'E-posta ile devam et',
        "startProviderLogin('apple')",
        "startProviderLogin('google')",
        'redirectToLogin',
      ]);
      if (missing.length) {
        return fail('Auth provider parity drifted while adding GuestProfile foundation.', {
          verification: 'STATIC_CONTRACT',
          file: 'src/components/auth/AuthProviderButtons.jsx',
          actual: { missing },
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      return pass('Apple, Google, and email/hosted login options remain intact.', {
        verification: 'STATIC_CONTRACT',
        actionType: ACTION_TYPES.CODE_FIX,
      });
    }),

  makeCase('guest_profile_runtime_proof_manual',
    'Manual: fresh app open creates a GuestProfile row without raw token exposure',
    () => notAutomatable('Static checks cannot inspect the deployed Base44 row. Manually open a fresh browser/device, confirm GuestProfile row exists with guest_token_hash only, and verify localStorage holds the raw guest token.', {
      verification: 'NOT_AUTOMATABLE',
      classification: 'STATIC_CHECK_LIMITATION',
      actionType: ACTION_TYPES.BACKEND_RUNTIME_PROBE,
      expected: 'Fresh app open -> GuestProfile row with guest_id, username KronoxUser####, guest_token_hash, no raw guest token',
      actual: 'runtime/deployment proof required',
    }),
    { critical: true, runtimeProofRequired: true, actionType: ACTION_TYPES.BACKEND_RUNTIME_PROBE }),
];
