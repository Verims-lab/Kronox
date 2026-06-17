// Kronox Health Center — Onboarding GuestProfile identity foundation.
//
// Static coverage only. Runtime proof still requires opening a fresh device
// session and confirming createGuestProfile creates a row without storing the
// raw token server-side.

import guestProfileEntitySource from '../../../base44/entities/GuestProfile.jsonc?raw';
import accountLinkTransactionEntitySource from '../../../base44/entities/AccountLinkTransaction.jsonc?raw';
import createGuestProfileSource from '../../../base44/functions/createGuestProfile/entry.ts?raw';
import linkGuestAccountSource from '../../../base44/functions/linkGuestAccount/entry.ts?raw';
import updateProfileSettingsSource from '../../../base44/functions/updateProfileSettings/entry.ts?raw';
import guestProfileClientSource from '../../lib/guestProfile.js?raw';
import profileSettingsClientSource from '../../lib/profileSettings.js?raw';
import authContextSource from '../../lib/AuthContext.jsx?raw';
import leaderboardSource from '../../lib/leaderboard.js?raw';
import authProviderButtonsSource from '../auth/AuthProviderButtons.jsx?raw';
import appSource from '../../App.jsx?raw';
import gameSource from '../../pages/Game.jsx?raw';
import onboardingPageSource from '../../pages/OnboardingPage.jsx?raw';
import soloJokerBarSource from './SoloJokerBar.jsx?raw';
import profilePageSource from '../../pages/ProfilePage.jsx?raw';
import settingsPageSource from '../../pages/SettingsPage.jsx?raw';
import playerSetupSource from '../../pages/PlayerSetup.jsx?raw';

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

  makeCase('guest_account_linking_function_is_idempotent',
    'Guest can link Google/Apple/Email account through server-authoritative idempotent merge',
    () => {
      const missing = missingTokens(`${accountLinkTransactionEntitySource}\n${linkGuestAccountSource}\n${guestProfileClientSource}\n${authContextSource}`, [
        '"name": "AccountLinkTransaction"',
        "base44.auth.me()",
        'hashGuestToken',
        'invalid_guest_token',
        'idempotency_key',
        'mergeIdempotent',
        'guestStatusLinkedOnce',
        'linked_guest_ids',
        'linkPendingGuestAccount',
        "base44.functions.invoke('linkGuestAccount'",
      ]);
      const forbidden = presentTokens(linkGuestAccountSource, [
        'console.log(body',
        'console.warn(body',
        'guest_token:',
        'auth_header',
      ]);
      if (missing.length || forbidden.length) {
        return fail('Account linking no longer proves token verification, authenticated user verification, and idempotent one-time merge.', {
          verification: 'STATIC_CONTRACT',
          files: ['base44/functions/linkGuestAccount/entry.ts', 'base44/entities/AccountLinkTransaction.jsonc', 'src/lib/guestProfile.js', 'src/lib/AuthContext.jsx'],
          actual: { missing, forbidden },
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      return pass('Guest account linking is server-authoritative, token-proven, audited, and idempotent.', {
        verification: 'STATIC_CONTRACT',
        actionType: ACTION_TYPES.CODE_FIX,
      });
    }),

  makeCase('guest_merge_preserves_progress_economy_preferences',
    'Account link merge preserves user-benefit progress, diamonds, jokers, and category preferences',
    () => {
      const missing = missingTokens(`${guestProfileEntitySource}\n${createGuestProfileSource}\n${linkGuestAccountSource}`, [
        'sync_progress',
        'solo_progress',
        'kronox_puan_total',
        'mergeSoloProgress',
        'mergeOnlineProgress',
        'account_link_merge',
        'DiamondTransaction',
        'UserJokerInventory',
        'JokerTransaction',
        'UserCategoryPreference',
        'selected_category_ids',
        'additiveMergeApplied',
      ]);
      if (missing.length) {
        return fail('Guest-to-account merge no longer proves score/progress/economy/preference preservation.', {
          verification: 'STATIC_CONTRACT',
          files: ['base44/functions/createGuestProfile/entry.ts', 'base44/functions/linkGuestAccount/entry.ts', 'base44/entities/GuestProfile.jsonc'],
          actual: { missing },
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      return pass('Account link merge has explicit user-benefit progress, economy, and category preference preservation.', {
        verification: 'STATIC_CONTRACT',
        actionType: ACTION_TYPES.CODE_FIX,
      });
    }),

  makeCase('leaderboard_uses_username_not_provider_identity_after_link',
    'Leaderboard identity is username/display_name first and never provider/email id',
    () => {
      const missing = missingTokens(`${leaderboardSource}\n${linkGuestAccountSource}\n${createGuestProfileSource}`, [
        'getSafeLeaderboardName',
        'display_name',
        'username',
        '!explicitName.includes',
        'providerIdsDisplayedInLeaderboard: false',
        'usernameFirstLeaderboardIdentity: true',
        'publishGuestLeaderboardEntry',
        'getGuestOwnerKey',
      ]);
      if (missing.length) {
        return fail('Leaderboard public identity is not clearly username-first for guest and linked users.', {
          verification: 'STATIC_CONTRACT',
          files: ['src/lib/leaderboard.js', 'base44/functions/linkGuestAccount/entry.ts', 'base44/functions/createGuestProfile/entry.ts'],
          actual: { missing },
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      return pass('Guest and linked leaderboard rows use username/display_name and keep owner_key/provider ids internal.', {
        verification: 'STATIC_CONTRACT',
        actionType: ACTION_TYPES.CODE_FIX,
      });
    }),

  makeCase('guest_continue_and_secure_progress_cta_exist',
    'Login CTA secures progress without blocking guest play',
    () => {
      const missing = missingTokens(`${onboardingPageSource}\n${profilePageSource}\n${authProviderButtonsSource}`, [
        'İlerlemeni Güvenceye Al',
        'Misafir olarak oynuyorsun',
        'Şimdilik misafir devam et',
        'prepareGuestAccountLink',
        'AuthProviderButtons',
        'Apple ile Giriş Yap',
        'Google ile Giriş Yap',
        'E-posta ile devam et',
      ]);
      if (missing.length) {
        return fail('Secure-progress CTA or guest continue path is missing from onboarding/profile.', {
          verification: 'STATIC_CONTRACT',
          files: ['src/pages/OnboardingPage.jsx', 'src/pages/ProfilePage.jsx', 'src/components/auth/AuthProviderButtons.jsx'],
          actual: { missing },
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      return pass('Login is presented as secure-progress account linking while guest continue remains available.', {
        verification: 'STATIC_CONTRACT',
        actionType: ACTION_TYPES.CODE_FIX,
      });
    }),

  makeCase('profile_settings_editable_for_guest_and_registered_users',
    'Profile > Ayarlar lets guest and registered users edit username, age, and gender',
    () => {
      const missing = missingTokens(`${settingsPageSource}\n${profileSettingsClientSource}\n${updateProfileSettingsSource}`, [
        'Profil Bilgileri',
        'Kullanıcı Adı',
        'Yaş',
        'Cinsiyet',
        'Kaydet',
        "base44.functions.invoke('updateProfileSettings'",
        'guestTokenProofRequired',
        'authUserVerifiedServerSide',
      ]);
      if (missing.length) {
        return fail('Profile settings edit form or server-authoritative update path is missing.', {
          verification: 'STATIC_CONTRACT',
          files: ['src/pages/SettingsPage.jsx', 'src/lib/profileSettings.js', 'base44/functions/updateProfileSettings/entry.ts'],
          actual: { missing },
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      return pass('Profile > Ayarlar supports token-proven guest updates and authenticated user updates.', {
        verification: 'STATIC_CONTRACT',
        actionType: ACTION_TYPES.CODE_FIX,
      });
    }),

  makeCase('profile_settings_username_privacy_and_leaderboard_contract',
    'Profile username remains unique and leaderboard-safe while age/gender stay private',
    () => {
      const missing = missingTokens(`${settingsPageSource}\n${profilePageSource}\n${leaderboardSource}\n${updateProfileSettingsSource}`, [
        'username_normalized',
        'usernameUniqueCaseInsensitive',
        'username_taken',
        'getSafeLeaderboardName',
        'refreshLeaderboardIdentity',
        'providerIdsDisplayedPublicly: false',
        'ageGenderPublicFields: false',
      ]);
      const forbidden = presentTokens(leaderboardSource, [
        'age:',
        'gender:',
      ]);
      if (missing.length || forbidden.length) {
        return fail('Profile settings privacy or leaderboard identity contract drifted.', {
          verification: 'STATIC_CONTRACT',
          files: ['src/pages/SettingsPage.jsx', 'src/pages/ProfilePage.jsx', 'src/lib/leaderboard.js', 'base44/functions/updateProfileSettings/entry.ts'],
          actual: { missing, forbidden },
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      return pass('Username updates are unique/leaderboard-safe; age and gender are private profile fields only.', {
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

  makeCase('guided_first_solo_replaces_old_standalone_tutorial',
    'Onboarding Phase 2 uses guided first Solo level instead of old standalone tutorial',
    () => {
      const missing = missingTokens(`${appSource}\n${onboardingPageSource}\n${gameSource}`, [
        'OnboardingPage',
        'path="/onboarding"',
        'onboardingTutorial',
        'guided_first_solo_level',
        'GUIDED_TUTORIAL_TIME_LIMIT_SECONDS = SOLO_LEVEL_TIME_SECONDS',
        'totalTimeSeconds: GUIDED_TUTORIAL_TIME_LIMIT_SECONDS',
        'GuidedSoloTutorialOverlay',
        'tutorial_in_progress',
        'guidedTutorialCompleted',
      ]);
      const forbidden = presentTokens(`${appSource}\n${settingsPageSource}\n${playerSetupSource}`, [
        "import KronoxTutorial",
        'setShowTutorial',
        'shouldShowTutorialForUser',
      ]);
      if (missing.length || forbidden.length) {
        return fail('Old standalone tutorial can still be reached or guided first Solo wiring is missing.', {
          verification: 'STATIC_CONTRACT',
          files: ['src/App.jsx', 'src/pages/OnboardingPage.jsx', 'src/pages/Game.jsx', 'src/pages/SettingsPage.jsx'],
          actual: { missing, forbidden },
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      return pass('First-time guest onboarding is routed through a guided Solo level, not the old tutorial modal.', {
        verification: 'STATIC_CONTRACT',
        actionType: ACTION_TYPES.CODE_FIX,
      });
    }),

  makeCase('guest_onboarding_state_machine_persists_server_side',
    'GuestProfile onboarding state machine persists tutorial/profile/category progress',
    () => {
      const missing = missingTokens(`${guestProfileEntitySource}\n${createGuestProfileSource}\n${guestProfileClientSource}\n${onboardingPageSource}`, [
        'guest_created',
        'tutorial_in_progress',
        'tutorial_completed',
        'profile_setup_pending',
        'category_setup_pending',
        'onboarding_complete',
        'update_onboarding',
        'guestTokenProofRequiredForUpdates: true',
        'updateGuestProfileOnboarding',
        'getGuestOnboardingStep',
      ]);
      if (missing.length) {
        return fail('Guided onboarding state machine or token-proven update path is missing.', {
          verification: 'STATIC_CONTRACT',
          files: ['base44/entities/GuestProfile.jsonc', 'base44/functions/createGuestProfile/entry.ts', 'src/lib/guestProfile.js', 'src/pages/OnboardingPage.jsx'],
          actual: { missing },
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      return pass('GuestProfile carries the Phase 2 onboarding state machine and server-authoritative update path.', {
        verification: 'STATIC_CONTRACT',
        actionType: ACTION_TYPES.CODE_FIX,
      });
    }),

  makeCase('profile_then_category_setup_after_tutorial',
    'Profile setup and category selection follow guided level completion',
    () => {
      const missing = missingTokens(onboardingPageSource, [
        'ProfileSetupStep',
        'CategorySetupStep',
        'username',
        'display_name',
        'age',
        'gender',
        'loadActiveCategories',
        'MIN_CATEGORY_SELECTION_COUNT',
        'Şimdilik Misafir Devam Et',
        "navigate('/', { replace: true })",
      ]);
      if (missing.length) {
        return fail('Onboarding does not clearly sequence profile setup then category setup after the guided level.', {
          verification: 'STATIC_CONTRACT',
          file: 'src/pages/OnboardingPage.jsx',
          actual: { missing },
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      return pass('Guided level completion moves through profile setup, category setup, then Ana Sayfa.', {
        verification: 'STATIC_CONTRACT',
        actionType: ACTION_TYPES.CODE_FIX,
      });
    }),

  makeCase('tutorial_joker_concept_does_not_spend_inventory',
    'Guided tutorial teaches interactive joker usage without spending real inventory',
    () => {
      const missing = missingTokens(`${gameSource}\n${onboardingPageSource}\n${soloJokerBarSource}`, [
        'isGuidedSoloTutorial',
        'Jokerleri Tanı',
        'GUIDED_TUTORIAL_JOKER_TYPE = SOLO_UI_JOKER_TYPES.TIME_FREEZE',
        'buildGuidedTutorialJokerBalances',
        'setGuidedTutorialJokerDemoUsed(true)',
        'jokerType !== GUIDED_TUTORIAL_JOKER_TYPE',
        'Zaman Dondur demosu aktif: gerçek çantandan harcanmadı.',
        'tutorialDemoType',
        'tutorialDemoHintActive',
        'data-kronox-guided-joker-finger-hint',
      ]);
      if (missing.length) {
        return fail('Guided first level no longer proves tutorial-only joker behavior.', {
          verification: 'STATIC_CONTRACT',
          files: ['src/pages/Game.jsx', 'src/components/game/SoloJokerBar.jsx'],
          actual: { missing },
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      return pass('Guided first level requires a tutorial-only Zaman Dondur demo while avoiding real UserJokerInventory spend.', {
        verification: 'STATIC_CONTRACT',
        actionType: ACTION_TYPES.CODE_FIX,
      });
    }),
];
