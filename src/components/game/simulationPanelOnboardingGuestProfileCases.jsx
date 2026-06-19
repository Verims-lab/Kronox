// Kronox Health Center — Onboarding GuestProfile identity foundation.
//
// Static coverage only. Runtime proof still requires opening a fresh device
// session and confirming createGuestProfile creates a row without storing the
// raw token server-side.

import guestProfileEntitySource from '../../../base44/entities/GuestProfile.jsonc?raw';
import guestCreationThrottleEntitySource from '../../../base44/entities/GuestCreationThrottle.jsonc?raw';
import accountLinkTransactionEntitySource from '../../../base44/entities/AccountLinkTransaction.jsonc?raw';
import createGuestProfileSource from '../../../base44/functions/createGuestProfile/entry.ts?raw';
import getCategoryMetadataSource from '../../../base44/functions/getCategoryMetadata/entry.ts?raw';
import linkGuestAccountSource from '../../../base44/functions/linkGuestAccount/entry.ts?raw';
import updateProfileSettingsSource from '../../../base44/functions/updateProfileSettings/entry.ts?raw';
import guestProfileClientSource from '../../lib/guestProfile.js?raw';
import profileSettingsClientSource from '../../lib/profileSettings.js?raw';
import userCategoryPreferencesSource from '../../lib/userCategoryPreferences.js?raw';
import authContextSource from '../../lib/AuthContext.jsx?raw';
import leaderboardSource from '../../lib/leaderboard.js?raw';
import authProviderButtonsSource from '../auth/AuthProviderButtons.jsx?raw';
import appSource from '../../App.jsx?raw';
import gameSource from '../../pages/Game.jsx?raw';
import onboardingPageSource from '../../pages/OnboardingPage.jsx?raw';
import gameLayoutSource from './GameLayout.jsx?raw';
import soloJokerBarSource from './SoloJokerBar.jsx?raw';
import timelineSource from './Timeline.jsx?raw';
import mainMenuSource from '../../pages/MainMenu.jsx?raw';
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

  makeCase('create_guest_profile_public_abuse_controls',
    'Public createGuestProfile has request validation, source-hash throttling, and bloat monitoring',
    () => {
      const missing = missingTokens(`${createGuestProfileSource}\n${guestProfileClientSource}\n${guestCreationThrottleEntitySource}`, [
        'Public by design',
        'MAX_REQUEST_BODY_BYTES',
        'readJsonBody',
        'unexpected_guest_creation_fields',
        'unexpected_guest_patch_fields',
        'GUEST_CREATION_HOURLY_LIMIT',
        'GUEST_CREATION_DAILY_LIMIT',
        'GuestCreationThrottle',
        'source_hash',
        'throttle_key',
        'guestCreationSourceHash',
        'client_install_id',
        'rawIpStored: false',
        'rawHeadersStored: false',
      ]);
      const forbidden = presentTokens(createGuestProfileSource, [
        'console.log(guestToken',
        'guest_token_hash: body',
        'status: body',
        'linked_user_email: body',
        'diamonds = normalizeNonNegativeInteger(patch.diamonds)',
        'joker_balances = normalizeJokerBalances',
      ]);
      if (missing.length || forbidden.length) {
        return fail('Public createGuestProfile lacks hardening proof or still trusts unsafe request fields.', {
          verification: 'STATIC_CONTRACT',
          files: ['base44/functions/createGuestProfile/entry.ts', 'base44/entities/GuestCreationThrottle.jsonc', 'src/lib/guestProfile.js'],
          actual: { missing, forbidden },
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      return pass('createGuestProfile remains public by design but is size-limited, allowlisted, source-hash throttled, and monitored for bloat.', {
        verification: 'STATIC_CONTRACT',
        classification: 'PUBLIC_BY_DESIGN_WITH_ABUSE_CONTROLS',
        publicAccessAllowed: true,
        remainingRuntimeProof: 'MANUAL_REQUIRED',
        actionType: ACTION_TYPES.CODE_FIX,
      });
    }),

  makeCase('get_category_metadata_public_metadata_only',
    'Public getCategoryMetadata returns guest-safe category metadata only',
    () => {
      const missing = missingTokens(`${getCategoryMetadataSource}\n${userCategoryPreferencesSource}\n${onboardingPageSource}`, [
        'Public by design',
        'MAX_REQUEST_BODY_BYTES',
        'unexpected_category_metadata_fields',
        'base44.asServiceRole.entities.Category',
        'publicCategoryMetadata',
        'responseFields',
        "'category_id'",
        "'name'",
        "'description'",
        "'status'",
        'metadataOnly: true',
        'guestCallableWithoutLogin: true',
        'rawQuestionRowsExposed: false',
        'answersExposed: false',
        'yearsExposed: false',
        'adminFieldsExposed: false',
        'legacyHardcodedCategoryFallbackAllowed: false',
        "base44.functions.invoke('getCategoryMetadata'",
        'categoryLoadError',
        'Tekrar Dene',
      ]);
      const forbidden = [
        ...presentTokens(`${getCategoryMetadataSource}\n${userCategoryPreferencesSource}`, [
          'SAFE_GUEST_CATEGORY_METADATA',
          'guestOnboardingSafeMetadataFallback',
          'allowSafeFallback: true',
          'entities.Question',
          'Question.list',
          'Question.filter',
          'base44.auth.me',
        ]),
        ...presentTokens(getCategoryMetadataSource, [
          'created_by:',
          'created_date:',
          'updated_date:',
          'admin_notes:',
          'Chronicle',
          'Flashback',
          'Viral',
        ]),
      ];
      if (missing.length || forbidden.length) {
        return fail('Public getCategoryMetadata is not proven to be metadata-only guest category access.', {
          verification: 'STATIC_CONTRACT',
          classification: 'PUBLIC_METADATA_EXPOSURE_RISK',
          files: ['base44/functions/getCategoryMetadata/entry.ts', 'src/lib/userCategoryPreferences.js', 'src/pages/OnboardingPage.jsx'],
          expected: 'Public-by-design category metadata only: category_id/name/description/status, no questions, no auth requirement, no stale fallback.',
          actual: { missing, forbidden },
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      return pass('getCategoryMetadata is public by design for guest onboarding and returns only current active category metadata.', {
        verification: 'STATIC_CONTRACT',
        classification: 'ALLOWED_PUBLIC_METADATA',
        publicAccessAllowed: true,
        responseScope: ['category_id', 'name', 'description', 'status'],
        remainingRuntimeProof: 'MANUAL_REQUIRED',
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
    'Existing Apple, Google, and email login entry points remain wired',
    () => {
      const missing = missingTokens(authProviderButtonsSource, [
        'Apple ile devam et',
        'Google ile devam et',
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
    'Leaderboard identity is username-only and never provider/email/internal id',
    () => {
      const missing = missingTokens(`${leaderboardSource}\n${linkGuestAccountSource}\n${createGuestProfileSource}`, [
        'getSafeLeaderboardName',
        'isSafePublicUsername',
        'username',
        'const displayName = username',
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
      return pass('Guest and linked leaderboard rows use username-only public identity and keep owner_key/provider ids internal.', {
        verification: 'STATIC_CONTRACT',
        actionType: ACTION_TYPES.CODE_FIX,
      });
    }),

  makeCase('profile_only_guest_account_link_cta',
    'Guest account linking CTA is Profile-only and does not block guest play',
    () => {
      const profileMissing = missingTokens(`${profilePageSource}\n${authProviderButtonsSource}`, [
        '{!loading && !user && (',
        'Misafir olarak oynuyorsun',
        'İlerlemeni kaybetmemek için hesabını bağla',
        'prepareGuestAccountLink',
        'AuthProviderButtons',
        'fromUrl="/profile"',
        'Apple ile devam et',
        'Google ile devam et',
        'E-posta ile devam et',
      ]);
      const guestContinueMissing = missingTokens(`${authContextSource}\n${onboardingPageSource}\n${mainMenuSource}`, [
        'ensureGuestProfile',
        "navigate('/', { replace: true })",
        'SOLO MEYDAN OKUMA',
      ]);
      const forbiddenHome = presentTokens(mainMenuSource, [
        "import AuthProviderButtons from '@/components/auth/AuthProviderButtons'",
        '<AuthProviderButtons',
        'Google ile Giriş Yap',
        'Apple ile Giriş Yap',
        'Google ile devam et',
        'Apple ile devam et',
        'E-posta ile devam et',
        'İlerlemeni Güvenceye Al',
        'Hesabını Bağla',
        'Hesabını bağla',
      ]);
      const forbiddenNonProfile = presentTokens(`${onboardingPageSource}\n${playerSetupSource}`, [
        "import AuthProviderButtons from '@/components/auth/AuthProviderButtons'",
        '<AuthProviderButtons',
        'prepareGuestAccountLink',
        'function SecureProgressStep',
        'İlerlemeni Güvenceye Al',
      ]);
      if (profileMissing.length || guestContinueMissing.length || forbiddenHome.length || forbiddenNonProfile.length) {
        return fail('Guest account linking placement drifted from the Profile-only contract.', {
          verification: 'STATIC_CONTRACT',
          files: [
            'src/pages/MainMenu.jsx',
            'src/pages/ProfilePage.jsx',
            'src/pages/OnboardingPage.jsx',
            'src/pages/PlayerSetup.jsx',
            'src/components/auth/AuthProviderButtons.jsx',
          ],
          expected: 'Home/onboarding/deprecated setup have no provider buttons or secure-progress card; Profile guest card links with Apple, Google, and email while guest flow can continue to Home/Solo.',
          actual: { profileMissing, guestContinueMissing, forbiddenHome, forbiddenNonProfile },
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      return pass('Guest account linking is Profile-only; Home stays playable without provider buttons, and Apple/Google/email remain together in Profile.', {
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
      const forbidden = presentTokens(settingsPageSource, [
        'Görünen Ad',
        'setDisplayName',
      ]);
      if (missing.length || forbidden.length) {
        return fail('Profile settings edit form or server-authoritative update path is missing.', {
          verification: 'STATIC_CONTRACT',
          files: ['src/pages/SettingsPage.jsx', 'src/lib/profileSettings.js', 'base44/functions/updateProfileSettings/entry.ts'],
          actual: { missing, forbidden },
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
    () => notAutomatable('Static checks cannot inspect deployed Base44 rows or real request metadata. Manually open a fresh browser/device, confirm GuestProfile row exists with guest_token_hash only, verify localStorage holds the raw guest token, and probe repeated public create calls for GuestCreationThrottle rows plus safe rate-limit behavior.', {
      verification: 'NOT_AUTOMATABLE',
      classification: 'STATIC_CHECK_LIMITATION',
      actionType: ACTION_TYPES.BACKEND_RUNTIME_PROBE,
      expected: 'Fresh app open -> GuestProfile row with guest_id, username KronoxUser####, guest_token_hash, no raw guest token; repeated create spam -> hashed throttle rows or safe rate-limit response',
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
        'tutorial_completed_at',
        'profile_setup_completed_at',
        'category_setup_completed_at',
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
        'age',
        'gender',
        'normalizeOptionalAgeInput',
        'Yaş alanı boş bırakılabilir',
        'loadActiveCategories',
        'MIN_CATEGORY_SELECTION_COUNT',
        'Şimdilik Misafir Devam Et',
        "navigate('/', { replace: true })",
        'profileSaving',
        'categorySaving',
        'submitError',
        'profile_save_timeout',
        'isTutorialResumeStep',
        'loadActiveCategories()',
        'categoryLoadError',
        'Tekrar Dene',
      ]);
      if (missing.length) {
        return fail('Onboarding does not clearly sequence profile setup then category setup after the guided level with retryable profile-save errors.', {
          verification: 'STATIC_CONTRACT',
          file: 'src/pages/OnboardingPage.jsx',
          actual: { missing },
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      const forbidden = presentTokens(onboardingPageSource, [
        'Görünen Ad',
        'setDisplayName',
      ]);
      if (forbidden.length) {
        return fail('Onboarding profile setup still exposes the removed display-name field.', {
          verification: 'STATIC_CONTRACT',
          file: 'src/pages/OnboardingPage.jsx',
          actual: { forbidden },
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      return pass('Guided level completion moves through profile setup, category setup, then Ana Sayfa without sharing the profile button spinner with background onboarding work.', {
        verification: 'STATIC_CONTRACT',
        actionType: ACTION_TYPES.CODE_FIX,
      });
    }),

  makeCase('guest_category_setup_loads_without_login',
    'Guest category setup loads safe category metadata without login and never exposes questions',
    () => {
      const missing = missingTokens(`${onboardingPageSource}\n${guestProfileClientSource}\n${userCategoryPreferencesSource}\n${createGuestProfileSource}\n${getCategoryMetadataSource}`, [
        'isTutorialResumeStep',
        "guestProfile?.tutorial_status === 'in_progress'",
        "guestProfile?.profile_setup_status !== 'completed'",
        "tutorial_status: 'completed'",
        'profile_setup_status: \'completed\'',
        'category_setup_status: \'completed\'',
        'getCategoryMetadata',
        'guestCallableWithoutLogin: true',
        'metadataOnly: true',
        'legacyHardcodedCategoryFallbackAllowed: false',
        'guestOnboardingUsesCurrentCategoryMetadata',
        'loadActiveCategories()',
        'categoryLoadError',
        'selected_category_ids',
        'guestTokenProofRequiredForUpdates: true',
        'Kategoriler kaydedilemedi. Lütfen tekrar dene.',
        "navigate('/', { replace: true })",
      ]);
      const forbidden = presentTokens(`${onboardingPageSource}\n${userCategoryPreferencesSource}`, [
        'SAFE_GUEST_CATEGORY_METADATA',
        'guestOnboardingSafeMetadataFallback',
        'allowSafeFallback: true',
        'Chronicle',
        'Flashback',
        'Viral',
        'Question.list',
        'Question.filter',
        'base44.auth.me',
      ]);
      if (missing.length || forbidden.length) {
        return fail('Guest onboarding category setup may regress to tutorial resume, require login, or expose question-bank reads.', {
          verification: 'STATIC_CONTRACT',
          files: ['src/pages/OnboardingPage.jsx', 'src/lib/guestProfile.js', 'src/lib/userCategoryPreferences.js', 'base44/functions/createGuestProfile/entry.ts', 'base44/functions/getCategoryMetadata/entry.ts'],
          actual: { missing, forbidden },
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      return pass('Guest category setup uses token-proven GuestProfile save plus current Category metadata, with no login, legacy fallback, or raw question-bank read.', {
        verification: 'STATIC_CONTRACT',
        actionType: ACTION_TYPES.CODE_FIX,
      });
    }),

  makeCase('guest_category_completion_cta_copy_and_home_route',
    'Guest category completion CTA says Ana Sayfa and routes home after save',
    () => {
      const categoryStepStart = onboardingPageSource.indexOf('function CategorySetupStep');
      const secureStepStart = onboardingPageSource.indexOf('function SecureProgressStep');
      const categoryStepSource = categoryStepStart >= 0 && secureStepStart > categoryStepStart
        ? onboardingPageSource.slice(categoryStepStart, secureStepStart)
        : onboardingPageSource;
      const missing = missingTokens(categoryStepSource, [
        'Ana Sayfa',
        'submitError',
        'Kategoriler kaydedilemedi. Lütfen tekrar dene.',
      ]);
      const completionMissing = missingTokens(onboardingPageSource, [
        'CATEGORY_SAVE_TIMEOUT_MS',
        'category_save_timeout',
        'selected_category_ids: selectedIds',
        "category_setup_status: 'completed'",
        'onboarding_status: GUEST_ONBOARDING_STATES.ONBOARDING_COMPLETE',
        "navigate('/', { replace: true })",
        'setCategorySaving(false)',
      ]);
      const forbidden = presentTokens(categoryStepSource, [
        'Ana Sayfa’ya Geç',
        'Ana Sayfaya Geç',
      ]);
      if (missing.length || completionMissing.length || forbidden.length) {
        return fail('Guest category completion CTA or home navigation contract drifted.', {
          verification: 'STATIC_CONTRACT',
          file: 'src/pages/OnboardingPage.jsx',
          expected: 'CTA label exactly Ana Sayfa; token-proven category save sets completion flags and replaces route to / with retryable error on failure.',
          actual: { missing, completionMissing, forbidden },
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      return pass('Guest category completion CTA is Ana Sayfa and successful save routes directly to Home.', {
        verification: 'STATIC_CONTRACT',
        actionType: ACTION_TYPES.CODE_FIX,
      });
    }),

  makeCase('guest_onboarding_completion_restart_repairs_to_home',
    'Completed guest onboarding cannot restart into a blank blue onboarding shell',
    () => {
      const missing = missingTokens(`${guestProfileClientSource}\n${authContextSource}\n${onboardingPageSource}\n${appSource}`, [
        'getGuestOnboardingCompletionRepairPatch',
        'repairGuestOnboardingCompletionIfNeeded',
        'profileCompleted && categoryCompleted',
        'category_setup_completed_at',
        'onboarding_completed_at',
        'currentGuestProfile = await repairGuestOnboardingCompletionIfNeeded(currentGuestProfile)',
        'if (step === GUEST_ONBOARDING_STATES.ONBOARDING_COMPLETE) return <Navigate to="/" replace />',
        '!isGuestOnboardingComplete(guestProfile)',
      ]);
      if (missing.length) {
        return fail('Completed or category-completed guest onboarding can still route back to /onboarding with no rendered step.', {
          verification: 'STATIC_CONTRACT',
          files: ['src/lib/guestProfile.js', 'src/lib/AuthContext.jsx', 'src/pages/OnboardingPage.jsx', 'src/App.jsx'],
          expected: 'category complete/onboarding_complete guests are treated as complete, repaired when safe, and routed to Ana Sayfa on restart.',
          actual: { missing },
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      return pass('Completed guest onboarding is monotonic, repaired when safe, and routed to Ana Sayfa on restart.', {
        verification: 'STATIC_CONTRACT',
        actionType: ACTION_TYPES.CODE_FIX,
      });
    }),

  makeCase('tutorial_joker_concept_does_not_spend_inventory',
    'Guided tutorial teaches correct placement and all three jokers without spending real inventory',
    () => {
      const missing = missingTokens(`${gameSource}\n${onboardingPageSource}\n${gameLayoutSource}\n${timelineSource}\n${soloJokerBarSource}`, [
        'isGuidedSoloTutorial',
        'Jokerleri Tanı',
        'GUIDED_TUTORIAL_JOKER_SEQUENCE',
        'SOLO_UI_JOKER_TYPES.TIME_FREEZE',
        'SOLO_UI_JOKER_TYPES.CARD_SWAP',
        'SOLO_UI_JOKER_TYPES.MISTAKE_SHIELD',
        'guidedTutorialCorrectTargetZone',
        'data-kronox-guided-correct-target-slot',
        'GuidedTutorialPopup',
        'profile_save_timeout',
        'buildGuidedTutorialJokerBalances',
        'setGuidedTutorialJokerDemoUsedByCard',
        'jokerType !== guidedTutorialExpectedJokerType',
        'gerçek çantandan harcanmadı',
        'tutorialDemoType',
        'tutorialDemoHintActive',
        'data-kronox-guided-joker-finger-hint',
      ]);
      if (missing.length) {
        return fail('Guided first level no longer proves correct-slot hints, popup pauses, or tutorial-only joker behavior.', {
          verification: 'STATIC_CONTRACT',
          files: ['src/pages/Game.jsx', 'src/components/game/GameLayout.jsx', 'src/components/game/Timeline.jsx', 'src/components/game/SoloJokerBar.jsx', 'src/pages/OnboardingPage.jsx'],
          actual: { missing },
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      return pass('Guided first level points to correct slots, teaches all three jokers as tutorial-only demos, pauses popups, and avoids real UserJokerInventory spend.', {
        verification: 'STATIC_CONTRACT',
        actionType: ACTION_TYPES.CODE_FIX,
      });
    }),

  makeCase('guided_timeline_swipe_hint_lifetime_guard',
    'Guided question-2 timeline swipe hint has bounded lifetime and interaction stops',
    () => {
      const missing = missingTokens(`${gameSource}\n${gameLayoutSource}\n${timelineSource}`, [
        'GUIDED_TIMELINE_SWIPE_HINT_MIN_MS = 3000',
        'GUIDED_TIMELINE_SWIPE_HINT_MAX_MS = 10000',
        'timelineSwipeHintMinimumTimerRef',
        'timelineSwipeHintAutoStopTimerRef',
        'timelineSwipeHintPendingInteractionRef',
        'timelineSwipeHintStartedAtRef',
        'handleTimelineSwipeHintInteraction',
        "stopTimelineSwipeHint('auto_stop_10s')",
        "stopTimelineSwipeHint('timeline_swipe_hint_cleanup', false)",
        "guidedTutorialStepMode === 'timeline-scroll'",
        'isTimelineSwipeHintActive',
        'hasTimelineSwipeHintMinimumElapsed',
        "handleTimelineSwipeHintInteraction('question_card_drag_start')",
        "handleTimelineSwipeHintInteraction('question_card_touch_drag')",
        'guidedTimelineSwipeHintMinimumElapsed',
        'onTimelineSwipeHintInteraction',
        'onGuidedScrollHintInteraction',
        'onPointerDown',
        'onTouchStart',
        'onWheel',
        'data-kronox-guided-timeline-swipe-hint',
        'pointer-events-none absolute inset-0',
      ]);
      if (missing.length) {
        return fail('Guided question-2 timeline swipe hint can run too long, stop too early, or block interaction.', {
          verification: 'STATIC_CONTRACT',
          files: ['src/pages/Game.jsx', 'src/components/game/GameLayout.jsx', 'src/components/game/Timeline.jsx'],
          expected: '3s minimum timer, 10s auto-stop, timeline/card interaction stop after minimum, timer cleanup, tutorial-only activation, and pointer-events:none visual layer.',
          actual: { missing },
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      return pass('Guided question-2 timeline swipe hint is tutorial-only, runs at least 3s, auto-stops by 10s, stops on timeline/card interaction after the minimum, and cleans up timers.', {
        verification: 'STATIC_CONTRACT',
        actionType: ACTION_TYPES.CODE_FIX,
      });
    }),
];
