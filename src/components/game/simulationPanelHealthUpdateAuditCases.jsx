// Kronox Health Center — Recent contract update audit.
//
// Scope: stitches together recent Profile/Settings/Leaderboard, presence,
// admin reporting/cleanup, performance/bootstrap, visual/UX guardrail, and
// Base44 SDK Health coverage. These cases do not replace the focused suites;
// they fail when the current high-signal contracts are no longer represented
// in Health.

import {
  ARCHITECTURE_TARGET_DOC as architectureTargetSource,
  DB_REPORTING_READINESS_DOC as dbReportingReadinessSource,
  HEALTH_GAP_ANALYSIS_DOC as healthGapSource,
  MOBILE_VISUAL_GUARDRAILS_DOC as mobileVisualGuardrailsSource,
  UX_QUALITY_GUARDRAILS_DOC as uxQualityGuardrailsSource,
  VISUAL_ASSET_READINESS_DOC as visualAssetReadinessSource,
} from '@/lib/healthAlignmentDocMirrors';

import appSource from '../../App.jsx?raw';
import authContextSource from '../../lib/AuthContext.jsx?raw';
import mainMenuSource from '../../pages/MainMenu.jsx?raw';
import profilePageSource from '../../pages/ProfilePage.jsx?raw';
import profileEditPageSource from '../../pages/ProfileEditPage.jsx?raw';
import settingsPageSource from '../../pages/SettingsPage.jsx?raw';
import friendsPageSource from '../../pages/FriendsPage.jsx?raw';
import leaderboardPageSource from '../../pages/LeaderboardPage.jsx?raw';
import kronoxRankingSectionSource from '../leaderboard/KronoxRankingSection.jsx?raw';
import bottomNavSource from '../layout/BottomNav.jsx?raw';
import questionCardSource from './QuestionCard.jsx?raw';
import gameLayoutSource from './GameLayout.jsx?raw';
import timelineSource from './Timeline.jsx?raw';
import builtInHealthCasesSource from './health/simulationCases.jsx?raw';
import useDailyQuestsSource from '../../hooks/useDailyQuests.js?raw';
import useDailyWheelSource from '../../hooks/useDailyWheel.js?raw';
import registrySource from './simulationPanelCaseRegistry.jsx?raw';
import adminAuthorizationCasesSource from './simulationPanelAdminAuthorizationCases.jsx?raw';
import inviteDeliveryCasesSource from './simulationPanelInviteDeliveryCases.jsx?raw';
import leaderboardCasesSource from './simulationPanelLeaderboardCases.jsx?raw';
import onboardingGuestProfileCasesSource from './simulationPanelOnboardingGuestProfileCases.jsx?raw';
import securityCleanupCasesSource from './simulationPanelSecurityCleanupCases.jsx?raw';
import backendSecurityCasesSource from './simulationPanelBackendSecurityCases.jsx?raw';
import healthAlignmentCasesSource from './simulationPanelHealthAlignmentCases.jsx?raw';

const STATUS = {
  PASS: 'PASS',
  FAIL: 'FAIL',
  NOT_AUTOMATABLE: 'NOT_AUTOMATABLE',
};

const ACTION_TYPES = {
  CODE_FIX: 'CODE_FIX',
  MANUAL_REVIEW: 'MANUAL_REVIEW',
  HUMAN_RUNTIME_PROOF: 'HUMAN_RUNTIME_PROOF',
};

const SUITE_ID = 'health_center_recent_contract_update';
const SUITE_NAME = 'Health Center Recent Contract Update Suite';

function makeCase(id, name, run, options = {}) {
  return {
    key: `${SUITE_ID}.${id}`,
    suiteId: SUITE_ID,
    suiteName: SUITE_NAME,
    id,
    name,
    critical: options.critical ?? true,
    actionType: options.actionType || ACTION_TYPES.CODE_FIX,
    nextStep: options.nextStep || 'Keep recent Kronox product contracts represented by focused Health cases.',
    ...options,
    run,
  };
}

function text(source) {
  if (source == null) return '';
  if (typeof source === 'string') return source;
  try { return String(source); } catch { return ''; }
}

function missingTokens(source, tokens) {
  const value = text(source);
  return tokens.filter((token) => !value.includes(token));
}

function forbiddenTokens(source, tokens) {
  const value = text(source);
  return tokens.filter((token) => value.includes(token));
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

export const EXTRA_SUITES = [
  { id: SUITE_ID, name: SUITE_NAME, critical: true, color: '#38bdf8' },
];

export const EXTRA_TESTS = [
  makeCase('recent_contract_modules_registered',
    'Recent Health contract suites are registered in the modular registry',
    () => {
      const missing = missingTokens(registrySource, [
        'leaderboardCases',
        'inviteDeliveryCases',
        'adminAuthorizationCases',
        'securityCleanupCases',
        'onboardingGuestProfileCases',
        'healthAlignmentCases',
        'a11yQualityCases',
        'mobileGameplayGestureCases',
        'backendDeployabilityCases',
      ]);
      if (missing.length) {
        return fail('The Health registry no longer imports recent contract suites.', {
          verification: 'STATIC_CONTRACT',
          file: 'src/components/game/simulationPanelCaseRegistry.jsx',
          missing,
        });
      }
      return pass('Registry still includes the recent contract suites that own Profile, privacy, admin, presence, performance, and SDK checks.', {
        verification: 'STATIC_CONTRACT',
      });
    }),

  makeCase('profile_settings_leaderboard_route_ownership_current',
    'Profile, Settings, BottomNav, and own leaderboard-row route ownership stay current',
    () => {
      const combined = [
        appSource,
        mainMenuSource,
        profilePageSource,
        profileEditPageSource,
        settingsPageSource,
        friendsPageSource,
        leaderboardPageSource,
        kronoxRankingSectionSource,
        bottomNavSource,
        onboardingGuestProfileCasesSource,
        leaderboardCasesSource,
      ].map(text).join('\n');
      const required = [
        'path="/profile/edit"',
        'title="Profil Bilgileri"',
        'onClick={goProfileEdit}',
        "onBack={() => navigate('/profile')}",
        'title="Arkadaşlarım"',
        'title="Ayarlar"',
        'Takma Ad',
        'Yaş grubu',
        'Cinsiyet',
        'Kategori seçimi',
        'title="Gizlilik Politikası"',
        'title="Hesabı Sil"',
        "navigate('/profile/edit'",
        "source: 'leaderboard_self_row'",
        'onCurrentUserRowOpenSettings',
        'row.isCurrentUser',
        'own_row_opens_profile_settings_only',
        'Ana Sayfa',
        'Liderlik',
        'Profil',
        'Online Kapışma',
      ];
      const forbidden = forbiddenTokens(`${bottomNavSource}\n${kronoxRankingSectionSource}\n${settingsPageSource}`, [
        'Online</span>',
        'title="Profil Bilgileri"',
        'title="İlgi Alanlarım"',
        'ProfileSettingsSection',
        'user?.email',
        'owner_key',
        'player_key',
      ]).concat(forbiddenTokens(friendsPageSource, [
        "onBack={() => navigate('/')}",
      ]));
      const missing = missingTokens(combined, required);
      if (missing.length || forbidden.length) {
        return fail('Profile/Settings/Leaderboard route ownership drifted from the current product contract.', {
          verification: 'STATIC_CONTRACT',
          files: [
            'src/App.jsx',
            'src/pages/MainMenu.jsx',
            'src/pages/ProfilePage.jsx',
            'src/pages/ProfileEditPage.jsx',
            'src/pages/SettingsPage.jsx',
            'src/pages/LeaderboardPage.jsx',
            'src/components/leaderboard/KronoxRankingSection.jsx',
            'src/components/layout/BottomNav.jsx',
          ],
          expected: 'BottomNav = Ana Sayfa/Liderlik/Profil; Online remains Home CTA-owned; Profile rows navigate; Friends back returns to /profile (Profile-owned); Settings owns privacy/delete; own leaderboard row alone opens /profile/edit.',
          actual: { missing, forbidden },
        });
      }
      return pass('Profile, Settings, BottomNav, Online CTA, and own leaderboard-row navigation match the current route ownership contract.', {
        verification: 'STATIC_CONTRACT',
      });
    }),

  makeCase('privacy_public_identity_health_current',
    'Public identity/privacy Health covers leaderboard, invites, notifications, presence, and admin tools',
    () => {
      const healthSource = [
        leaderboardCasesSource,
        inviteDeliveryCasesSource,
        adminAuthorizationCasesSource,
        onboardingGuestProfileCasesSource,
        backendSecurityCasesSource,
        healthGapSource,
        uxQualityGuardrailsSource,
      ].map(text).join('\n');
      const required = [
        'Public identity is username only',
        'leaderboard_safe_fields_only',
        'leaderboard_safe_identity_display',
        'completed_guest_leaderboard_access_and_privacy',
        'profile_settings_username_privacy_and_leaderboard_contract',
        'friend_presence_backend_is_owner_bound_and_friend_scoped',
        'friend_rows_username_only_no_email_display_fallback',
        'online_player_selection_order_and_scope',
        'admin_user_report_aggregate_privacy_contract',
        'inactive_guest_username_cleanup_contract',
        'no email/provider/owner/raw guest/internal',
        'full question bank',
      ];
      const forbidden = forbiddenTokens(`${leaderboardPageSource}\n${kronoxRankingSectionSource}`, [
        'row.email',
        'row.owner_key',
        'row.player_key',
        'row.raw_guest_id',
        'row.provider_id',
      ]);
      const missing = missingTokens(healthSource, required);
      if (missing.length || forbidden.length) {
        return fail('Public identity/privacy coverage no longer ties recent surfaces together.', {
          verification: 'STATIC_CONTRACT',
          files: [
            'src/components/game/simulationPanelLeaderboardCases.jsx',
            'src/components/game/simulationPanelInviteDeliveryCases.jsx',
            'src/components/game/simulationPanelAdminAuthorizationCases.jsx',
            'src/components/game/simulationPanelOnboardingGuestProfileCases.jsx',
            'src/components/game/simulationPanelBackendSecurityCases.jsx',
          ],
          expected: 'Health keeps username-only public identity and blocks email/provider/owner/raw guest/internal/full question-bank exposure.',
          actual: { missing, forbidden },
        });
      }
      return pass('Privacy coverage remains explicit across public leaderboard, profile, invite/presence, backend security, and admin/reporting surfaces.', {
        verification: 'STATIC_CONTRACT',
      });
    }),

  makeCase('admin_reporting_cleanup_health_current',
    'Admin User Report and inactive guest cleanup contracts stay Health-covered and documented',
    () => {
      const combined = `${adminAuthorizationCasesSource}\n${dbReportingReadinessSource}\n${healthGapSource}`;
      const required = [
        'admin_user_report_aggregate_privacy_contract',
        'Kullanıcı Raporu',
        'totalUsersByDistinctValidUsername',
        'loggedInUsers',
        'usersWithKronoxPuanGreaterThanZero',
        'inactive10DaysUsers',
        'aggregate-only',
        'read-only',
        'inactive_guest_username_cleanup_contract',
        'cleanupInactiveGuestUsernames',
        'dry-run first',
        'manually confirmed',
        'server-side eligibility',
        'active_within_10_days',
        'known score exactly 0',
        'username release',
        'no automatic scheduler',
      ];
      const missing = missingTokens(combined, required);
      if (missing.length) {
        return fail('Admin reporting/cleanup Health or docs lost a recent safety contract.', {
          verification: 'STATIC_CONTRACT',
          files: [
            'src/components/game/simulationPanelAdminAuthorizationCases.jsx',
            'docs/KRONOX_DB_REPORTING_READINESS.md',
            'docs/KRONOX_HEALTH_GAP_ANALYSIS.md',
            'src/lib/healthAlignmentDocMirrors.js',
          ],
          missing,
        });
      }
      return pass('Admin report and inactive guest cleanup remain admin-only, aggregate/destructive-safe, privacy-safe, and documented.', {
        verification: 'STATIC_CONTRACT',
      });
    }),

  makeCase('presence_invite_health_current',
    'Online presence and friend invite duplicate/expiry contracts stay Health-covered',
    () => {
      const combined = `${inviteDeliveryCasesSource}\n${architectureTargetSource}\n${dbReportingReadinessSource}\n${healthGapSource}`;
      const required = [
        'friend_presence_backend_is_owner_bound_and_friend_scoped',
        'presence_freshness_and_refresh_contract',
        'PRESENCE_ONLINE_TTL_MS = 75 * 1000',
        'PRESENCE_HEARTBEAT_MS = 25 * 1000',
        'PRESENCE_REFRESH_MS = 12 * 1000',
        'Presence UI keeps previous safe rows through transient fetch failure',
        'FriendRequestOperationLock',
        'open duplicate warning',
        'expired invite cancel/delete before resend',
        'delivery failure preserving the row',
        'no target-email',
        'username-only labels',
      ];
      const missing = missingTokens(combined, required);
      if (missing.length) {
        return fail('Presence/invite Health coverage lost owner binding, freshness, duplicate/expiry, or privacy protections.', {
          verification: 'STATIC_CONTRACT',
          files: [
            'src/components/game/simulationPanelInviteDeliveryCases.jsx',
            'docs/KRONOX_ARCHITECTURE_TARGET.md',
            'docs/KRONOX_DB_REPORTING_READINESS.md',
            'docs/KRONOX_HEALTH_GAP_ANALYSIS.md',
          ],
          missing,
        });
      }
      return pass('Presence and invite Health covers owner-bound writes, scoped reads, 75/25/12 timing, transient failures, duplicate/expiry behavior, and privacy.', {
        verification: 'STATIC_CONTRACT',
      });
    }),

  makeCase('performance_and_visual_guardrails_health_current',
    'Performance/bootstrap and gameplay visual guardrails remain represented by static/manual Health',
    () => {
      const combined = [
        builtInHealthCasesSource,
        appSource,
        authContextSource,
        mainMenuSource,
        useDailyWheelSource,
        useDailyQuestsSource,
        questionCardSource,
        gameLayoutSource,
        timelineSource,
        uxQualityGuardrailsSource,
        mobileVisualGuardrailsSource,
        visualAssetReadinessSource,
        healthGapSource,
      ].map(text).join('\n');
      const required = [
        'app_bootstrap_avoids_duplicate_auth_me',
        'startup_home_first_render_fast_path',
        'game_bootstrap_reuses_auth_context',
        'startup_defers_optional_work',
        'runAuthenticatedBootstrapMaintenance',
        'runGuestBootstrapMaintenance',
        'getCachedGuestProfile',
        "import MainMenu from './pages/MainMenu'",
        'scheduleDailyWheelStatusRefresh',
        'scheduleDailyQuestStatusRefresh',
        'home_rewards_preserve_cached_status_during_refresh',
        'question_text_fit_tokens_memoized',
        'active_question_long_word_fit_formula',
        'active_question_long_word_fit_render_path',
        'heavy_blur_glow_low_end_android_manual_proof',
        'Timeline visual safety',
        'no full visual redesign',
        'low-end Android/WebView-safe performance',
        'Do not introduce GSAP',
      ];
      const forbidden = forbiddenTokens(`${questionCardSource}\n${gameLayoutSource}`, [
        "wordBreak: 'break-all'",
        "overflowWrap: 'anywhere'",
        'Question.list(',
      ]);
      const missing = missingTokens(combined, required);
      if (missing.length || forbidden.length) {
        return fail('Performance or gameplay visual guardrails drifted from the current Health/docs contract.', {
          verification: 'STATIC_CONTRACT',
          files: [
            'src/components/game/health/simulationCases.jsx',
            'src/components/game/QuestionCard.jsx',
            'src/components/game/GameLayout.jsx',
            'src/components/game/Timeline.jsx',
            'docs/KRONOX_UX_QUALITY_GUARDRAILS.md',
            'docs/KRONOX_MOBILE_VISUAL_GUARDRAILS.md',
            'docs/KRONOX_VISUAL_ASSET_READINESS.md',
          ],
          expected: 'Bootstrap avoids duplicate auth, optional startup work is deferred, long-word fit is per-word and shared, full visual redesign is out of scope, and low-end device proof stays manual.',
          actual: { missing, forbidden },
        });
      }
      return pass('Performance/bootstrap, long-word fit, visual scope, and low-end mobile proof boundaries are represented in Health and docs.', {
        verification: 'STATIC_CONTRACT',
      });
    }),

  makeCase('sdk_pin_health_case_scans_real_sources',
    'Base44 SDK exact-pin Health case scans root package and critical function sources',
    () => {
      const required = [
        "const BASE44_SDK_VERSION = '0.8.34'",
        'packageJsonSource',
        'packageLockSource',
        'const requiredPackage = `"@base44/sdk": "${BASE44_SDK_VERSION}"`',
        'const requiredDeno = `npm:@base44/sdk@${BASE44_SDK_VERSION}`',
        'CRITICAL_BASE44_FUNCTION_SDK_SOURCES',
        'package.json exact @base44/sdk pin',
        'package-lock.json exact @base44/sdk root spec',
        '"@base44/sdk": "^',
        'npm:@base44/sdk@0.8.25',
      ];
      const missing = missingTokens(securityCleanupCasesSource, required);
      if (missing.length) {
        return fail('The SDK exact-pin Health case no longer scans the real root/package and Base44 function contract.', {
          verification: 'STATIC_CONTRACT',
          files: ['src/components/game/simulationPanelSecurityCleanupCases.jsx', 'package.json', 'base44/functions/**/entry.ts'],
          missing,
        });
      }
      return pass('SDK exact-pin Health remains pointed at package.json and critical Base44 function imports, including caret/range regression tokens.', {
        verification: 'STATIC_CONTRACT',
      });
    }),

  makeCase('ux_quality_guardrails_promoted_to_health_contracts',
    'UX guardrail docs and Health gap mirror now distinguish implemented static coverage from manual proof',
    () => {
      const combined = `${uxQualityGuardrailsSource}\n${healthGapSource}\n${healthAlignmentCasesSource}`;
      const required = [
        'adapted guidance, not vendored skill content',
        'Profile > Profil Bilgileri owns username',
        'BottomNav remains exactly `Ana Sayfa`, `Liderlik`, `Profil`',
        'Public identity is username only',
        'Do not introduce GSAP',
        'Low-end Android/WebView smoothness is a release proof concern',
        'Static Health coverage now exists for the strongest current UX contracts',
        'Manual proof remains required for mobile route walkthrough',
        'Health is a contract guard. It is not release proof.',
      ];
      const missing = missingTokens(combined, required);
      if (missing.length) {
        return fail('UX guardrail docs/mirrors are not registered as current Health-aligned contracts.', {
          verification: 'STATIC_CONTRACT',
          files: [
            'docs/KRONOX_UX_QUALITY_GUARDRAILS.md',
            'docs/KRONOX_HEALTH_GAP_ANALYSIS.md',
            'src/lib/healthAlignmentDocMirrors.js',
          ],
          missing,
        });
      }
      return pass('UX guardrail docs are mirrored for Health and the Health gap doc now separates implemented static coverage from manual proof.', {
        verification: 'STATIC_CONTRACT',
      });
    }),

  makeCase('health_center_audit_runtime_inventory_manual_gap',
    'Manual: full Health inventory and real-device/live probes remain release gates',
    () => notAutomatable('This update audits static Health coverage and registers recent contracts, but full Health, two-account Online/invite probes, deployed admin/non-admin function probes, low-end Android/WebView visual proof, and App Store/Play Store wrapper checks remain manual.', {
      verification: 'NOT_AUTOMATABLE',
      verificationLabels: ['NOT_AUTOMATABLE', 'MANUAL_REQUIRED'],
      actionType: ACTION_TYPES.HUMAN_RUNTIME_PROOF,
      expected: 'User-run full Health plus live/manual probes after this branch is deployed.',
      actual: {
        staticSuite: SUITE_ID,
        fullHealthRunHere: false,
      },
    }),
    { critical: false, actionType: ACTION_TYPES.HUMAN_RUNTIME_PROOF }),
];
