// Kronox Health Center — Onboarding GuestProfile identity foundation.
//
// Static coverage only. Runtime proof still requires opening a fresh device
// session and confirming createGuestProfile creates a row without storing the
// raw token server-side.

import guestProfileEntitySource from '../../../base44/entities/GuestProfile.jsonc?raw';
import guestCreationThrottleEntitySource from '../../../base44/entities/GuestCreationThrottle.jsonc?raw';
import accountLinkTransactionEntitySource from '../../../base44/entities/AccountLinkTransaction.jsonc?raw';
import kronoxUserIdTombstoneEntitySource from '../../../base44/entities/KronoxUserIdTombstone.jsonc?raw';
import friendRequestEntitySource from '../../../base44/entities/FriendRequest.jsonc?raw';
import gameInviteEntitySource from '../../../base44/entities/GameInvite.jsonc?raw';
import playerPresenceEntitySource from '../../../base44/entities/PlayerPresence.jsonc?raw';
import lobbyEntitySource from '../../../base44/entities/Lobby.jsonc?raw';
import soloLeaderboardEntitySource from '../../../base44/entities/SoloLeaderboardEntry.jsonc?raw';
import onlineMatchResultEntitySource from '../../../base44/entities/OnlineMatchResult.jsonc?raw';
import createGuestProfileSource from '../../../base44/functions/createGuestProfile/entry.ts?raw';
import ensureKronoxUserIdSource from '../../../base44/functions/ensureKronoxUserId/entry.ts?raw';
import getCategoryMetadataSource from '../../../base44/functions/getCategoryMetadata/entry.ts?raw';
import linkGuestAccountSource from '../../../base44/functions/linkGuestAccount/entry.ts?raw';
import updateProfileSettingsSource from '../../../base44/functions/updateProfileSettings/entry.ts?raw';
import sendFriendRequestSource from '../../../base44/functions/sendFriendRequest/entry.ts?raw';
import updatePlayerPresenceSource from '../../../base44/functions/updatePlayerPresence/entry.ts?raw';
import createGameInvitesForTargetsSource from '../../../base44/functions/createGameInvitesForTargets/entry.ts?raw';
import getSoloLeaderboardSource from '../../../base44/functions/getSoloLeaderboard/entry.ts?raw';
import guestProfileClientSource from '../../lib/guestProfile.js?raw';
import kronoxUserIdClientSource from '../../lib/kronoxUserId.js?raw';
import profileSettingsClientSource from '../../lib/profileSettings.js?raw';
import userProfileHydrationSource from '../../lib/userProfileHydration.js?raw';
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
import profileEditPageSource from '../../pages/ProfileEditPage.jsx?raw';
import settingsPageSource from '../../pages/SettingsPage.jsx?raw';
import playerSetupSource from '../../pages/PlayerSetup.jsx?raw';
import { mergeAuthenticatedUserProfile } from '../../lib/userProfileHydration';

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
        'resolveSafePublicUsername',
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

  makeCase('guest_account_link_preserves_daily_rewards_and_identity',
    'Account link preserves guest daily rewards, same-day guards, history, and leaderboard identity',
    () => {
      const combined = `${guestProfileEntitySource}\n${linkGuestAccountSource}\n${leaderboardSource}`;
      const missing = missingTokens(combined, [
        'buildDailyRewardLinkPatch',
        'mergeDailyRewardHistoryRows',
        'mergeDailyWheelHistoryRows',
        'mergeDailyQuestHistoryRows',
        'dailyWheelHistoryMerged',
        'dailyQuestHistoryMerged',
        'dailyQuestHistoryUpdated',
        'dailyRewardSameDayGuardsPreserved',
        'daily_wheel_last_spin_date',
        'daily_quest_last_claim_date',
        'leaderboardGuestRowPassivated',
        'syncCategoryPreferences',
        'mergeJokerBalances',
        'Server-authoritative guest Diamond balance',
      ]);
      if (missing.length) {
        return fail('Guest account linking no longer proves Daily Wheel/Daily Quest guard/history and username leaderboard preservation.', {
          verification: 'STATIC_CONTRACT',
          files: [
            'base44/functions/linkGuestAccount/entry.ts',
            'base44/entities/GuestProfile.jsonc',
            'src/lib/leaderboard.js',
          ],
          expected: 'linkGuestAccount merges guest Diamonds, Daily Wheel/Daily Quest guard fields/history, leaderboard username row continuity, categories, progress, and inventory where present.',
          actual: { missing },
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      return pass('Account linking carries guest Diamonds plus Daily Wheel/Daily Quest same-day guards/history into the registered account and preserves username-only leaderboard identity.', {
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

  makeCase('logged_in_username_restored_after_relaunch',
    'Logged-in relaunch hydrates saved username instead of provider/display fallback',
    () => {
      const restored = mergeAuthenticatedUserProfile(
        { email: 'ada@example.com', display_name: 'Ada Provider' },
        { email: 'ada@example.com', username: 'KronoxAda', gender: 'female' },
      );
      const storedWins = mergeAuthenticatedUserProfile(
        { email: 'ada@example.com', username: 'AuthName' },
        { email: 'ada@example.com', username: 'SavedName' },
      );
      const providerUsernameIgnored = mergeAuthenticatedUserProfile(
        { email: 'ada@example.com', username: 'ada@example.com', display_name: 'Ada Provider' },
        { email: 'ada@example.com' },
      );
      const missing = missingTokens(`${authContextSource}\n${profilePageSource}\n${userProfileHydrationSource}\n${linkGuestAccountSource}\n${updateProfileSettingsSource}\n${leaderboardSource}`, [
        'hydrateAuthenticatedUserProfile',
        'mergeAuthenticatedUserProfile',
        'selectStoredUserProfile',
        'normalizeSafePublicUsernameInput',
        'chooseLinkedAccountUsername',
        'explicitLinkedUserUsername',
        'explicitGuestUsername',
        'usernameMergeSource',
        'usernamePreservesExistingWhenEmpty',
        'getSafeLeaderboardName',
      ]);
      const leakedProviderUsername = String(providerUsernameIgnored?.username || '').includes('@');
      const behaviorFailed = restored?.username !== 'KronoxAda' ||
        storedWins?.username !== 'SavedName' ||
        leakedProviderUsername;
      if (missing.length || behaviorFailed) {
        return fail('Logged-in username restore/link/profile-save contract is not fully locked.', {
          verification: 'STATIC_AND_HELPER_CONTRACT',
          files: [
            'src/lib/userProfileHydration.js',
            'src/lib/AuthContext.jsx',
            'src/pages/ProfilePage.jsx',
            'base44/functions/linkGuestAccount/entry.ts',
            'base44/functions/updateProfileSettings/entry.ts',
          ],
          actual: {
            missing,
            restoredUsername: restored?.username || '',
            storedWinsUsername: storedWins?.username || '',
            leakedProviderUsername,
          },
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      return pass('Authenticated relaunch/profile loads hydrate the saved User.username, account linking preserves username precedence, and provider identity is not a username source.', {
        verification: 'STATIC_AND_HELPER_CONTRACT',
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
        'Giriş Yap',
        'İlk giriş ödülünüzü alın',
      ]);
      const providerForbidden = presentTokens(`${profilePageSource}\n${authProviderButtonsSource}`, [
        'Facebook',
        'facebook',
      ]);
      const guestContinueMissing = missingTokens(`${authContextSource}\n${onboardingPageSource}\n${mainMenuSource}`, [
        'ensureGuestProfile',
        "navigate('/', { replace: true })",
        'SOLO MEYDAN OKUMA',
        'rewardsPlayer &&',
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
      if (profileMissing.length || providerForbidden.length || guestContinueMissing.length || forbiddenHome.length || forbiddenNonProfile.length) {
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
          actual: { profileMissing, providerForbidden, guestContinueMissing, forbiddenHome, forbiddenNonProfile },
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      return pass('Guest account linking is Profile-only; Home stays playable without provider buttons, and Apple/Google/email remain together in Profile.', {
        verification: 'STATIC_CONTRACT',
        actionType: ACTION_TYPES.CODE_FIX,
      });
    }),

  makeCase('first_login_reward_server_backed_once',
    'First login reward is server-backed, one-time, and idempotent',
    () => {
      const combined = `${linkGuestAccountSource}\n${profilePageSource}`;
      const missing = missingTokens(combined, [
        'FIRST_LOGIN_REWARD_SOURCE',
        'FIRST_LOGIN_REWARD_AMOUNT = 80',
        'grantFirstLoginRewardIfEligible',
        "idempotencyKey = `${FIRST_LOGIN_REWARD_SOURCE}:${email}`",
        'findDiamondTransaction(base44, email, idempotencyKey)',
        'source: FIRST_LOGIN_REWARD_SOURCE',
        'first_login_reward_granted_at',
        'firstLoginRewardGranted',
        'İlk giriş ödülünüzü alın',
      ]);
      const forbidden = presentTokens(profilePageSource, [
        'DiamondTransaction.create',
        'first_login_reward:<email>',
      ]);
      if (missing.length || forbidden.length) {
        return fail('First-login reward is not fully locked to the backend account-link path.', {
          verification: 'STATIC_CONTRACT',
          files: ['src/pages/ProfilePage.jsx', 'base44/functions/linkGuestAccount/entry.ts'],
          expected: 'Profile shows reward copy only; linkGuestAccount grants +80 Diamonds once through DiamondTransaction idempotency and User guard fields.',
          actual: { missing, forbidden },
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      return pass('First-login reward is displayed in Profile but granted only by the server account-link function with a stable idempotency key.', {
        verification: 'STATIC_CONTRACT',
        actionType: ACTION_TYPES.CODE_FIX,
      });
    }),

  makeCase('first_launch_existing_account_entry_routes_to_profile',
    'First-launch Hesabım Var routes to Profile account linking without provider buttons',
    () => {
      const welcomeMissing = missingTokens(onboardingPageSource, [
        'İlk Seviye Seni Bekliyor',
        'Sevgili {displayName}',
        'Tek yapman gereken olay kartını, olayın gerçekleştiğini tahmin ettiğin zaman aralığına sürüklemek.',
        '7 kartı tamamla.',
        'Zamana hükmet…',
        'Seviye 1',
        'Hesabım Var',
        "navigate('/profile?open=account-link'",
        'openAccountLink: true',
        "accountLinkEntry: 'first-launch-welcome'",
      ]);
      const profileMissing = missingTokens(`${profilePageSource}\n${authProviderButtonsSource}`, [
        'useLocation',
        "params.get('open') === 'account-link'",
        'data-kronox-account-link-panel',
        'scrollIntoView',
        'AuthProviderButtons',
        'fromUrl="/profile"',
        'Apple ile devam et',
        'Google ile devam et',
        'E-posta ile devam et',
      ]);
      const routingMissing = missingTokens(appSource, [
        'isOnboardingAccountLinkEntry',
        "new URLSearchParams(location.search).get('open') === 'account-link'",
        '!isOnboardingAccountLinkEntry',
      ]);
      const forbiddenWelcome = presentTokens(onboardingPageSource, [
        '<AuthProviderButtons',
        'prepareGuestAccountLink',
        'Google ile devam et',
        'Apple ile devam et',
        'E-posta ile devam et',
        'Tek yapman gereken, olay kartını',
      ]);
      if (welcomeMissing.length || profileMissing.length || routingMissing.length || forbiddenWelcome.length) {
        return fail('First-launch existing-account entry drifted from the Profile-routed provider contract.', {
          verification: 'STATIC_CONTRACT',
          files: [
            'src/App.jsx',
            'src/pages/OnboardingPage.jsx',
            'src/pages/ProfilePage.jsx',
            'src/components/auth/AuthProviderButtons.jsx',
          ],
          expected: 'Welcome shows exact copy and Hesabım Var as a secondary route to Profile account linking; Apple/Google/email remain only in the Profile guest card.',
          actual: { welcomeMissing, profileMissing, routingMissing, forbiddenWelcome },
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      return pass('First-launch Hesabım Var is a secondary Profile route and the welcome screen still has no provider buttons.', {
        verification: 'STATIC_CONTRACT',
        actionType: ACTION_TYPES.CODE_FIX,
      });
    }),

  makeCase('profile_settings_editable_for_guest_and_registered_users',
    'Profile Info lets guest and registered users edit username, age group, and gender',
    () => {
      const missing = missingTokens(`${profilePageSource}\n${profileEditPageSource}\n${profileSettingsClientSource}\n${updateProfileSettingsSource}`, [
        'Profil Bilgileri',
        'Takma Ad',
        'Yaş grubu',
        'Cinsiyet',
        'Kaydet',
        'PROFILE_AGE_GROUP_OPTIONS',
        'age_group',
        "base44.functions.invoke('updateProfileSettings'",
        'guestTokenProofRequired',
        'authUserVerifiedServerSide',
      ]);
      const forbidden = presentTokens(`${profileEditPageSource}\n${settingsPageSource}`, [
        'Görünen Ad',
        'setDisplayName',
      ]);
      if (missing.length || forbidden.length) {
        return fail('Profile Info edit form or server-authoritative update path is missing.', {
          verification: 'STATIC_CONTRACT',
          files: ['src/pages/ProfilePage.jsx', 'src/pages/ProfileEditPage.jsx', 'src/lib/profileSettings.js', 'base44/functions/updateProfileSettings/entry.ts'],
          actual: { missing, forbidden },
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      return pass('Profile Info supports token-proven guest updates and authenticated user updates.', {
        verification: 'STATIC_CONTRACT',
        actionType: ACTION_TYPES.CODE_FIX,
      });
    }),

  makeCase('profile_name_area_opens_profile_edit',
    'Profile name area opens username/gender/age-group edit screen without private identifiers',
    () => {
      const combined = `${appSource}\n${profilePageSource}\n${profileEditPageSource}\n${profileSettingsClientSource}\n${updateProfileSettingsSource}`;
      const missing = missingTokens(combined, [
        'path="/profile/edit"',
        'navigate(\'/profile/edit\')',
        'aria-label="Profili düzenle"',
        'Takma Ad',
        'Cinsiyet',
        'Yaş grubu',
        'Kullanıcı ID',
        'data-kronox-user-id-readonly="true"',
        'getKronoxUserId(profile)',
        'ensureKronoxUserIdForCurrentActor()',
        'response?.data?.data',
        'Kullanıcı ID hazırlanamadı',
        'Kullanıcı ID tekrar hazırla',
        'aria-label="Kullanıcı ID kopyala"',
        'Kategori seçimi',
        'CategoryPreferencesSection',
        'PROFILE_AGE_GROUP_OPTIONS',
        'age_group',
        'ageGroupPublicFields: false',
        'normalizeSafePublicUsernameInput(nextUsername)',
        'role="dialog"',
      ]);
      const forbidden = presentTokens(profileEditPageSource, [
        'owner_key',
        'player_key',
        'provider_id',
        'providerId',
        'date_of_birth',
        'birthdate',
        'user?.email',
        'guest_id',
      ]);
      if (missing.length || forbidden.length) {
        return fail('Profile edit screen route, field contract, or privacy boundary drifted.', {
          verification: 'STATIC_CONTRACT',
          files: ['src/App.jsx', 'src/pages/ProfilePage.jsx', 'src/pages/ProfileEditPage.jsx', 'src/lib/profileSettings.js', 'base44/functions/updateProfileSettings/entry.ts'],
          expected: 'Profile name button routes to /profile/edit; edit screen writes username, gender, and age_group only; only read-only/copyable kronox_user_id may be rendered, with no email/provider/internal IDs.',
          actual: { missing, forbidden },
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      return pass('Profile name area opens a private-safe profile edit screen for username, gender, age group, and read-only Kronox ID.', {
        verification: 'STATIC_CONTRACT',
        actionType: ACTION_TYPES.CODE_FIX,
      });
    }),

  makeCase('immutable_kronox_user_id_foundation',
    'Immutable Kronox ID is backend-assigned, backfilled, preserved through linking, and tombstoned on deletion',
    () => {
      const combined = [
        guestProfileEntitySource,
        kronoxUserIdTombstoneEntitySource,
        createGuestProfileSource,
        ensureKronoxUserIdSource,
        updateProfileSettingsSource,
        linkGuestAccountSource,
        authContextSource,
        userProfileHydrationSource,
        guestProfileClientSource,
        kronoxUserIdClientSource,
      ].join('\n');
      const missing = missingTokens(combined, [
        '"kronox_user_id"',
        'KX-[A-HJ-NP-Z2-9]{4}',
        'crypto.getRandomValues',
        'generateUniqueKronoxUserId',
        'KronoxUserIdTombstone',
        'kronox_user_id_client_input_forbidden',
        'preserved_from_guest_profile',
        'kronoxUserIdPreservedThroughLinking',
        'ensureKronoxUserIdForCurrentActor',
        'response?.data?.data',
        'getKronoxUserId(profile)',
      ]);
      const forbidden = presentTokens(combined, [
        'Math.random()',
        'rawGuestTokenServerStored: true',
      ]);
      if (missing.length || forbidden.length) {
        return fail('Immutable Kronox ID backend/backfill/link/tombstone contract is incomplete.', {
          verification: 'STATIC_CONTRACT',
          files: [
            'base44/functions/ensureKronoxUserId/entry.ts',
            'base44/functions/createGuestProfile/entry.ts',
            'base44/functions/linkGuestAccount/entry.ts',
            'base44/entities/KronoxUserIdTombstone.jsonc',
            'src/lib/kronoxUserId.js',
          ],
          actual: { missing, forbidden },
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      return pass('Kronox ID is backend-assigned/backfilled, client input is forbidden, linking preserves it, and tombstones prevent reuse.', {
        verification: 'STATIC_CONTRACT',
        actionType: ACTION_TYPES.CODE_FIX,
      });
    }),

  makeCase('canonical_kronox_id_dual_write_surfaces',
    'Friends, Online presence/invites/lobbies, and leaderboard projections carry Kronox ID internally without public exposure',
    () => {
      const internalSources = [
        friendRequestEntitySource,
        gameInviteEntitySource,
        playerPresenceEntitySource,
        lobbyEntitySource,
        soloLeaderboardEntitySource,
        onlineMatchResultEntitySource,
        sendFriendRequestSource,
        updatePlayerPresenceSource,
        createGameInvitesForTargetsSource,
        leaderboardSource,
      ].join('\n');
      const publicSource = getSoloLeaderboardSource;
      const missing = missingTokens(internalSources, [
        'from_kronox_user_id',
        'to_kronox_user_id',
        'kronox_user_id',
        'host_kronox_user_id',
        'winner_kronox_user_id',
        'player_kronox_user_id',
        'normalizeKronoxUserId',
      ]);
      const publicRowStart = publicSource.indexOf('function toPublicLeaderboardRow');
      const publicRowEnd = publicSource.indexOf('function toPublicLeaderboardRows');
      const publicRowBody = publicSource.slice(publicRowStart, publicRowEnd > publicRowStart ? publicRowEnd : undefined);
      const publicForbidden = presentTokens(publicRowBody, [
        'kronox_user_id',
        'guest_id',
      ]);
      if (missing.length || publicForbidden.length) {
        return fail('Canonical Kronox ID dual-write or public-stripping contract drifted.', {
          verification: 'STATIC_CONTRACT',
          files: [
            'base44/entities/FriendRequest.jsonc',
            'base44/entities/GameInvite.jsonc',
            'base44/entities/PlayerPresence.jsonc',
            'base44/entities/Lobby.jsonc',
            'base44/entities/SoloLeaderboardEntry.jsonc',
            'base44/functions/getSoloLeaderboard/entry.ts',
          ],
          actual: { missing, publicForbidden },
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      return pass('Canonical Kronox ID is dual-written internally while public leaderboard output remains username-only.', {
        verification: 'STATIC_CONTRACT',
        actionType: ACTION_TYPES.CODE_FIX,
      });
    }),

  makeCase('profile_menu_navigation_screens_structure',
    'Profile menu rows navigate to dedicated screens and Settings owns privacy/delete',
    () => {
      const profileMissing = missingTokens(profilePageSource, [
        'title="Profil Bilgileri"',
        'onClick={goProfileEdit}',
        'title="Arkadaşlarım"',
        "navigate('/friends')",
        'title="Ayarlar"',
        'onClick={goSettings}',
      ]);
      const settingsMissing = missingTokens(settingsPageSource, [
        'title="Gizlilik Politikası"',
        "navigate('/privacy')",
        'title="Hesabı Sil"',
        'requestAccountDeletion(base44, user)',
        'accountSectionRef',
      ]);
      const profileInfoMissing = missingTokens(`${profileEditPageSource}\n${userCategoryPreferencesSource}`, [
        'Takma Ad',
        'Yaş grubu',
        'Cinsiyet',
        'Kategori seçimi',
        'CategoryPreferencesSection',
        'loadActiveCategories',
        'saveUserCategoryPreferences',
        'legacyHardcodedCategoryFallbackAllowed: false',
      ]);
      const forbiddenProfileRows = presentTokens(profilePageSource, [
        'title="Gizlilik Politikası"',
        'title="Hesabı Sil"',
        '?focus=profile',
        'focusProfileSettings',
      ]);
      const forbiddenSettingsRows = presentTokens(settingsPageSource, [
        'title="Profil Bilgileri"',
        'title="İlgi Alanlarım"',
        'ProfileSettingsSection',
      ]);
      if (profileMissing.length || settingsMissing.length || profileInfoMissing.length || forbiddenProfileRows.length || forbiddenSettingsRows.length) {
        return fail('Profile menu navigation or Settings/Profile Info ownership drifted.', {
          verification: 'STATIC_CONTRACT',
          files: ['src/pages/ProfilePage.jsx', 'src/pages/SettingsPage.jsx', 'src/pages/ProfileEditPage.jsx', 'src/lib/userCategoryPreferences.js'],
          expected: 'Profile menu rows route to screens; privacy/delete live under Settings; Profile Info owns username, age group, gender, and canonical category preference UI.',
          actual: { profileMissing, settingsMissing, profileInfoMissing, forbiddenProfileRows, forbiddenSettingsRows },
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      return pass('Profile menu rows navigate to screens, Settings owns privacy/delete, and Profile Info carries canonical profile/category fields.', {
        verification: 'STATIC_CONTRACT',
        actionType: ACTION_TYPES.CODE_FIX,
      });
    }),

  makeCase('profile_settings_username_privacy_and_leaderboard_contract',
    'Profile username remains unique and leaderboard-safe while age/gender stay private',
    () => {
      const missing = missingTokens(`${settingsPageSource}\n${profilePageSource}\n${profileEditPageSource}\n${leaderboardSource}\n${updateProfileSettingsSource}`, [
        'username_normalized',
        'usernameUniqueCaseInsensitive',
        'username_taken',
        'getSafeLeaderboardName',
        'refreshLeaderboardIdentity',
        'providerIdsDisplayedPublicly: false',
        'ageGenderPublicFields: false',
        'ageGroupPublicFields: false',
      ]);
      const forbidden = presentTokens(leaderboardSource, [
        'age:',
        'age_group:',
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
      const tutorialSources = `${gameSource}\n${onboardingPageSource}\n${gameLayoutSource}\n${timelineSource}\n${soloJokerBarSource}`;
      const missing = missingTokens(tutorialSources, [
        'isGuidedSoloTutorial',
        'GUIDED_TUTORIAL_JOKER_SEQUENCE',
        'SOLO_UI_JOKER_TYPES.TIME_FREEZE',
        'SOLO_UI_JOKER_TYPES.CARD_SWAP',
        'SOLO_UI_JOKER_TYPES.MISTAKE_SHIELD',
        'Zamanı Dondur jokerini kullan. Süreyi 10 saniye boyunca durdurur.',
        'Kart Değiştir jokerini kullan. Olay kartını başka bir olay ile değiştirir',
        'Kronokalkan jokerini kullan. Bu jokeri kullandığında bir sonraki yanlışın, hamle sayısından düşmez.',
        'guidedTutorialCorrectTargetZone',
        'data-kronox-guided-correct-target-slot',
        'GUIDED_JOKER_TAP_HINT_MIN_MS = 3000',
        'GUIDED_JOKER_TAP_HINT_MAX_MS = 10000',
        'guidedTutorialJokerRequiresTapBeforePlacement',
        "stopGuidedJokerTapHint('joker_pressed')",
        "stopGuidedJokerTapHint('auto_stop_10s')",
        'profile_save_timeout',
        'buildGuidedTutorialJokerBalances',
        'setGuidedTutorialJokerDemoUsedByCard',
        'jokerType !== guidedTutorialExpectedJokerType',
        'startSoloTimerFreeze()',
        'setMistakeShieldActive(true)',
        'current_question_id: replacement.id',
        'tutorialDemoType',
        'tutorialDemoHintActive',
        'tutorialFocusActive',
        'data-kronox-guided-joker-single-copy',
        'data-kronox-guided-joker-focus-backdrop',
        'data-kronox-guided-joker-finger-hint',
      ]);
      const forbidden = presentTokens(gameSource, [
        "setGuidedTutorialPopup({ type: 'joker'",
      ]);
      if (missing.length || forbidden.length) {
        return fail('Guided first level no longer proves correct-slot hints, direct no-popup joker demos, or tutorial-only inventory behavior.', {
          verification: 'STATIC_CONTRACT',
          files: ['src/pages/Game.jsx', 'src/components/game/GameLayout.jsx', 'src/components/game/Timeline.jsx', 'src/components/game/SoloJokerBar.jsx', 'src/pages/OnboardingPage.jsx'],
          actual: { missing, forbidden },
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      return pass('Guided first level points to correct slots, teaches all three jokers as direct tutorial-only demos with no joker popup, and avoids real UserJokerInventory spend.', {
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
