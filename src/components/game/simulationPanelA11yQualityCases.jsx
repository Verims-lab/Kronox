// Kronox Health Center — Security Pass 3 accessibility/code-quality guards.
//
// These are static contract checks for the small a11y and quality cleanup
// pass. They intentionally avoid claiming full WCAG/runtime proof; real
// mobile screen-reader and keyboard validation remains a manual release gate.

import appSource from '../../App.jsx?raw';
import protectedRouteSource from '../ProtectedRoute.jsx?raw';
import splashScreenSource from '../SplashScreen.jsx?raw';
import adminPageSource from '../../pages/AdminPage.jsx?raw';
import testSuiteSource from '../../pages/TestSuite.jsx?raw';
import settingsPageSource from '../../pages/SettingsPage.jsx?raw';
import profileEditPageSource from '../../pages/ProfileEditPage.jsx?raw';
import onboardingPageSource from '../../pages/OnboardingPage.jsx?raw';
import gamePageSource from '../../pages/Game.jsx?raw';
import onlineBootstrapSource from './OnlineGameBootstrapFallback.jsx?raw';
import gameSettingsModalSource from './SettingsModal.jsx?raw';
import friendSelectModalSource from '../lobby/FriendSelectModal.jsx?raw';
import createLobbyInvitePanelSource from '../lobby/CreateLobbyInvitePanel.jsx?raw';
import waitingRoomPanelSource from '../lobby/WaitingRoomPanel.jsx?raw';
import categoryPreferencesSource from '../settings/CategoryPreferencesSection.jsx?raw';
import categoryOnboardingModalSource from '../settings/CategoryPreferenceOnboardingModal.jsx?raw';
import kronoxTutorialSource from '../tutorial/KronoxTutorial.jsx?raw';
import menubarSource from '../ui/menubar.jsx?raw';
import eslintConfigSource from '../../../eslint.config.js?raw';
import adminAuthorizationCasesSource from './simulationPanelAdminAuthorizationCases.jsx?raw';

const SUITE_ID = 'security_pass_3_a11y_quality';
const SUITE_NAME = 'Security Pass 3 A11y + Quality Suite';

const STATUS = {
  PASS: 'PASS',
  FAIL: 'FAIL',
  NOT_AUTOMATABLE: 'NOT_AUTOMATABLE',
};

const ACTION_TYPES = {
  CODE_FIX: 'CODE_FIX',
  MANUAL_VERIFY: 'MANUAL_VERIFY',
};

function makeCase(id, name, run, options = {}) {
  return {
    key: `${SUITE_ID}.${id}`,
    suiteId: SUITE_ID,
    suiteName: SUITE_NAME,
    id,
    name,
    critical: options.critical ?? false,
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

function missingBySource(checks) {
  return checks
    .map(({ label, source, tokens }) => ({ label, missing: missingTokens(source, tokens) }))
    .filter((entry) => entry.missing.length);
}

export const EXTRA_SUITES = [
  {
    id: SUITE_ID,
    name: SUITE_NAME,
    critical: false,
    color: '#38bdf8',
  },
];

export const EXTRA_TESTS = [
  makeCase(
    'loading_states_have_accessible_status',
    'Protected/page/game/lobby loading states expose accessible status semantics',
    () => {
      const missing = missingBySource([
        {
          label: 'ProtectedRoute fallback',
          source: protectedRouteSource,
          tokens: ['role="status"', 'aria-live="polite"', 'aria-label="Oturum durumu kontrol ediliyor"', 'aria-hidden="true"'],
        },
        {
          label: 'SplashScreen',
          source: splashScreenSource,
          tokens: ['role="status"', 'aria-live="polite"', 'aria-label="Kronox yükleniyor"', 'aria-hidden="true"'],
        },
        {
          label: 'AdminPage auth/tool loading',
          source: adminPageSource,
          tokens: ['aria-label="Admin yetkisi kontrol ediliyor"', 'aria-label="Admin aracı yükleniyor"', 'role="status"', 'aria-hidden="true"'],
        },
        {
          label: 'TestSuite auth loading',
          source: testSuiteSource,
          tokens: ['aria-label="Regression Test Panel yetkisi kontrol ediliyor"', 'role="status"', 'aria-live="polite"'],
        },
        {
          label: 'SettingsPage auth loading',
          source: settingsPageSource,
          tokens: ['aria-label="Ayarlar yükleniyor"', 'role="status"', 'aria-live="polite"'],
        },
        {
          label: 'Game question bootstrap',
          source: gamePageSource,
          tokens: ['aria-label="Sorular hazırlanıyor"', 'role="status"', 'aria-hidden="true"'],
        },
        {
          label: 'OnlineGameBootstrapFallback',
          source: onlineBootstrapSource,
          tokens: ['aria-label={message}', 'role="status"', 'aria-live="polite"'],
        },
        {
          label: 'Onboarding loading/category loading',
          source: onboardingPageSource,
          tokens: ['aria-label="Kronox profilin hazırlanıyor"', 'aria-label="Kategoriler yükleniyor"', 'role="status"'],
        },
        {
          label: 'Category preference loading',
          source: `${categoryPreferencesSource}\n${categoryOnboardingModalSource}`,
          tokens: ['aria-label="Kategori tercihleri yükleniyor"', 'role="status"', 'aria-live="polite"'],
        },
        {
          label: 'Lobby player loading',
          source: `${friendSelectModalSource}\n${createLobbyInvitePanelSource}\n${waitingRoomPanelSource}`,
          tokens: ['aria-label="Oyuncular yükleniyor"', 'aria-label="Lobi yenileniyor"', 'role="status"'],
        },
      ]);
      if (missing.length) {
        return fail('One or more loading states can still render as visual-only spinners.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          actionType: ACTION_TYPES.CODE_FIX,
          actual: { missing },
        });
      }
      return pass('Core loading states expose status names/live regions while keeping spinner glyphs visual-only.', {
        verification: 'STATIC_CONTRACT',
        actionType: ACTION_TYPES.CODE_FIX,
      });
    },
  ),

  makeCase(
    'custom_modals_have_dialog_names',
    'Custom settings/tutorial/player-selection modals expose dialog semantics and labeled close actions',
    () => {
      const missing = missingBySource([
        {
          label: 'Game SettingsModal',
          source: gameSettingsModalSource,
          tokens: ['role="dialog"', 'aria-modal="true"', 'aria-labelledby="game-settings-modal-title"', 'aria-label="Ayarları kapat"'],
        },
        {
          label: 'FriendSelectModal',
          source: friendSelectModalSource,
          tokens: ['role="dialog"', 'aria-modal="true"', 'aria-labelledby="friend-select-modal-title"', 'aria-label="Kapat"'],
        },
        {
          label: 'KronoxTutorial',
          source: kronoxTutorialSource,
          tokens: ['role="dialog"', 'aria-modal="true"', 'aria-labelledby="kronox-tutorial-title"'],
        },
      ]);
      if (missing.length) {
        return fail('A custom modal is missing dialog semantics or an accessible close/title contract.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          actionType: ACTION_TYPES.CODE_FIX,
          actual: { missing },
        });
      }
      return pass('Custom modals touched by the pass expose dialog names and close affordances.', {
        verification: 'STATIC_CONTRACT',
        actionType: ACTION_TYPES.CODE_FIX,
      });
    },
  ),

  makeCase(
    'form_feedback_remains_accessible',
    'Profile/onboarding forms keep labels and announce inline feedback',
    () => {
      const missing = missingBySource([
        {
          label: 'Profile Info edit form',
          source: profileEditPageSource,
          tokens: ['role="dialog"', 'profile-edit-sheet-title', 'autoComplete="nickname"', 'role="alert"', 'role="status"', 'aria-live="polite"'],
        },
        {
          label: 'Onboarding profile/category forms',
          source: onboardingPageSource,
          tokens: ['function Field({ label, children })', '<label className="block">', 'role="alert"', 'autoComplete="username"'],
        },
      ]);
      if (missing.length) {
        return fail('Profile/onboarding form labels or feedback semantics drifted.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          actionType: ACTION_TYPES.CODE_FIX,
          actual: { missing },
        });
      }
      return pass('Profile/onboarding inputs keep accessible names and visible feedback is announced.', {
        verification: 'STATIC_CONTRACT',
        actionType: ACTION_TYPES.CODE_FIX,
      });
    },
  ),

  makeCase(
    'eslint_unused_imports_incremental_rule_stays_enabled',
    'ESLint keeps unused imports as errors and unused variables as warnings for incremental cleanup',
    () => {
      const typoStillPresent = menubarSource.includes('MenubarShortcut.displayname');
      const missing = missingBySource([
        {
          label: 'eslint.config.js',
          source: eslintConfigSource,
          tokens: ['"unused-imports/no-unused-imports": "error"', '"unused-imports/no-unused-vars": [', '"warn"'],
        },
        {
          label: 'menubar primitive',
          source: menubarSource,
          tokens: ['MenubarShortcut.displayName = "MenubarShortcut"'],
        },
      ]);
      if (missing.length || typoStillPresent) {
        return fail('Incremental lint/code-quality contract regressed.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          actionType: ACTION_TYPES.CODE_FIX,
          actual: { missing, typoStillPresent },
        });
      }
      return pass('Unused-import enforcement remains incremental and the menubar shortcut displayName typo is fixed.', {
        verification: 'STATIC_CONTRACT',
        actionType: ACTION_TYPES.CODE_FIX,
      });
    },
  ),

  makeCase(
    'admin_auth_and_simulation_panel_decisions_stay_scoped',
    'Admin auth, TypeScript, ESLint, and SimulationPanel cleanup decisions remain scoped/documented',
    () => {
      const missing = missingBySource([
        {
          label: 'Admin authorization Health decision',
          source: adminAuthorizationCasesSource,
          tokens: [
            'Base44 functions inline the AdminUser guard because individual function',
            'bundles do not reliably include shared helper modules during deploy',
            'AdminUser source-of-truth',
          ],
        },
        {
          label: 'AdminPage SimulationPanel lazy boundary',
          source: adminPageSource,
          tokens: ['const SimulationPanel = lazyWithRetry', '<Suspense fallback={<AdminToolLoading />}>'],
        },
        {
          label: 'App lazy routes',
          source: appSource,
          tokens: ['const TestSuite = lazyWithRetry', 'const AdminPage = lazyWithRetry'],
        },
        {
          label: 'TestSuite route-level admin gate',
          source: testSuiteSource,
          tokens: ['if (!isAdminUser(user))', 'Regression Test Panel yalnızca admin kullanıcılar için kullanılabilir'],
        },
      ]);
      if (missing.length) {
        return fail('Security Pass 3 scoped decisions drifted from the documented current architecture.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          actionType: ACTION_TYPES.CODE_FIX,
          actual: { missing },
        });
      }
      return pass('Admin auth refactor remains a deploy-risk follow-up, ESLint stays incremental, and SimulationPanel remains lazy/admin/test-suite scoped.', {
        verification: 'STATIC_CONTRACT',
        actionType: ACTION_TYPES.CODE_FIX,
      });
    },
  ),

  makeCase(
    'real_a11y_runtime_proof_remains_manual',
    'Screen-reader, keyboard, and real mobile accessibility proof remains a manual release gate',
    () => notAutomatable('Static Health can detect source-level a11y contracts, but it cannot prove TalkBack/VoiceOver announcements, focus order, keyboard traversal, or real device modal behavior. Run manual mobile accessibility proof before release.', {
      verification: 'MANUAL_REQUIRED',
      classification: 'STATIC_CHECK_LIMITATION',
      actionType: ACTION_TYPES.MANUAL_VERIFY,
      nextStep: 'Manually test protected loading, app loading, settings/profile forms, lobby player selection, and tutorial/settings modals with keyboard plus mobile screen reader where feasible.',
    }),
    { critical: false, actionType: ACTION_TYPES.MANUAL_VERIFY },
  ),
];
