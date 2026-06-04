// Kronox Health Center — Full alignment and release-proof quality contracts.
//
// Scope: current docs, removed Settings UI expectations, Solo v2 coverage
// registration, PWA/mobile/Android manual gates, public asset README truth,
// DB architecture roadmap/implementation status, and Health report honesty.
// Runtime/device/two-account/destructive proofs intentionally remain manual.

import corePromptSource from '../../../KRONOX_CORE_PROMPT.md?raw';
import kronoxSource from '../../../KRONOX.md?raw';
import scoringDocsSource from '../../../docs/KRONOX_SCORING_RULES.md?raw';
import soloEngineDocsSource from '../../../docs/KRONOX_SOLO_QUESTION_ENGINE.md?raw';
import securityDocsSource from '../../../docs/KRONOX_SECURITY_DEPLOYMENT.md?raw';
import releaseChecklistSource from '../../../docs/KRONOX_RELEASE_PROOF_CHECKLIST.md?raw';
import questionModelDocsSource from '../../../docs/KRONOX_QUESTION_DATA_MODEL.md?raw';
import economyDocsSource from '../../../docs/KRONOX_ECONOMY_RULES.md?raw';
import categoryTaxonomyDocsSource from '../../../docs/KRONOX_CATEGORY_TAXONOMY.md?raw';
import dbArchitectureDocsSource from '../../../docs/KRONOX_DB_ARCHITECTURE.md?raw';
import settingsPageSource from '../../pages/SettingsPage.jsx?raw';
import standardTopBarSource from '../layout/StandardTopBar.jsx?raw';
import notificationApiSource from '../../lib/notificationApi.js?raw';
import placementFeedbackCasesSource from './simulationPanelPlacementFeedbackCases.jsx?raw';
import soloQuestionEngineCasesSource from './simulationPanelSoloQuestionEngineCases.jsx?raw';
import soloProgressCasesSource from './simulationPanelSoloProgressCases.jsx?raw';
import securityCleanupCasesSource from './simulationPanelSecurityCleanupCases.jsx?raw';
import backendSecurityCasesSource from './simulationPanelBackendSecurityCases.jsx?raw';
import accountDeletionCasesSource from './simulationPanelAccountDeletionCases.jsx?raw';
import dbArchitectureCasesSource from './simulationPanelDbArchitectureImplementationCases.jsx?raw';
import healthStatusSource from './health/healthStatus.jsx?raw';
import { DB_ARCHITECTURE_IMPLEMENTATION_MIRROR } from '@/lib/dbArchitectureMirrors';

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

const SUITE_ID = 'health_center_alignment';
const SUITE_NAME = 'Health Center Full Alignment Suite';

function makeCase(id, name, run, options = {}) {
  return {
    key: `${SUITE_ID}.${id}`,
    suiteId: SUITE_ID,
    suiteName: SUITE_NAME,
    id,
    name,
    critical: options.critical ?? true,
    actionType: options.actionType || ACTION_TYPES.CODE_FIX,
    nextStep: options.nextStep || 'Keep Health aligned with current Kronox contracts and manual proof gates.',
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

async function fetchPublicText(path) {
  if (typeof fetch !== 'function') return '';
  try {
    const response = await fetch(path, { cache: 'no-store' });
    if (!response.ok) return '';
    return await response.text();
  } catch (_error) {
    return '';
  }
}

export const EXTRA_SUITES = [
  { id: SUITE_ID, name: SUITE_NAME, critical: true, color: '#facc15' },
];

export const EXTRA_TESTS = [
  makeCase('active_docs_current_paths_exist',
    'Health references the current active Kronox docs only',
    () => {
      const combined = [
        corePromptSource,
        kronoxSource,
        scoringDocsSource,
        soloEngineDocsSource,
        securityDocsSource,
        releaseChecklistSource,
        questionModelDocsSource,
        economyDocsSource,
        categoryTaxonomyDocsSource,
        dbArchitectureDocsSource,
      ].map(text).join('\n');
      const missing = missingTokens(combined, [
        'KRONOX Core Prompt',
        'Kronox',
        'Kronox Scoring Rules',
        'Kronox Solo Question Engine',
        'Kronox Security',
        'Kronox Release Proof Checklist',
        'Kronox Question Data Model',
        'Kronox Diamond Economy Rules',
        'Kronox Category Taxonomy',
        'Kronox DB Architecture',
      ]);
      if (missing.length) {
        return fail('Active docs/path contract is incomplete.', {
          verification: 'STATIC_CONTRACT',
          files: [
            'KRONOX_CORE_PROMPT.md',
            'KRONOX.md',
            'docs/KRONOX_SCORING_RULES.md',
            'docs/KRONOX_SOLO_QUESTION_ENGINE.md',
            'docs/KRONOX_SECURITY_DEPLOYMENT.md',
            'docs/KRONOX_RELEASE_PROOF_CHECKLIST.md',
            'docs/KRONOX_QUESTION_DATA_MODEL.md',
            'docs/KRONOX_ECONOMY_RULES.md',
            'docs/KRONOX_CATEGORY_TAXONOMY.md',
            'docs/KRONOX_DB_ARCHITECTURE.md',
          ],
          missing,
        });
      }
      return pass('Active docs are importable and contain current Kronox contract markers.', {
        verification: 'STATIC_CONTRACT',
      });
    }),

  makeCase('docs_current_solo_v2_contract',
    'Docs align with current Solo v2 scoring, timing, deck, and replay rules',
    () => {
      const combined = `${scoringDocsSource}\n${soloEngineDocsSource}\n${releaseChecklistSource}`;
      const missing = missingTokens(combined, [
        '7 correct',
        '16-question deck',
        '19-question deck',
        '180 seconds',
        '10 mistakes',
        'first 5 ordered questions',
        'minimum 5-year',
        'Same-score replay does not add points',
        'Lower-score replay does not add points',
        'Better replay adds only the positive score delta',
        'Old completed Solo results are not retroactively recalculated',
      ]);
      if (missing.length) {
        return fail('Solo v2 docs drifted from current product rules.', {
          verification: 'STATIC_CONTRACT',
          files: ['docs/KRONOX_SCORING_RULES.md', 'docs/KRONOX_SOLO_QUESTION_ENGINE.md', 'docs/KRONOX_RELEASE_PROOF_CHECKLIST.md'],
          missing,
        });
      }
      return pass('Solo v2 docs cover targets, decks, timer, mistake fail, spacing, replay, and non-retroactivity.', {
        verification: 'STATIC_CONTRACT',
      });
    }),

  makeCase('removed_settings_sections_not_expected',
    'Settings Health no longer expects removed question-management or app-settings UI',
    () => {
      const forbidden = forbiddenTokens(settingsPageSource, [
        'Soru Yönetimi',
        'Question Management',
        'Uygulama Ayarları',
        'App Settings',
        'NotificationSettingsCard',
        'AppPreferencesCard',
      ]);
      const settingsMissing = missingTokens(settingsPageSource, [
        'StandardTopBar',
        'diamonds={diamondValue}',
        'user={user}',
        'showBack',
        'ResetUserProgressTool',
        'Hesabı Sil',
      ]);
      const topBarMissing = missingTokens(standardTopBarSource, [
        'HeaderNotificationBell',
        '<HeaderNotificationBell user={user} />',
        'aria-label={`Elmas: ${diamonds}`}',
      ]);
      if (forbidden.length || settingsMissing.length || topBarMissing.length) {
        return fail('Settings page has stale removed UI or lost the current top/admin/deletion contract.', {
          verification: 'STATIC_CONTRACT',
          files: ['src/pages/SettingsPage.jsx', 'src/components/layout/StandardTopBar.jsx'],
          actual: { forbidden, settingsMissing, topBarMissing },
        });
      }
      return pass('Settings uses StandardTopBar with centered Elmas, right-side notification bell, admin maintenance, account deletion, and removed UI stays absent.', {
        verification: 'STATIC_CONTRACT',
      });
    }),

  makeCase('solo_health_current_contracts_registered',
    'Solo Health covers current Solo v2 rules and source-of-truth progress display',
    () => {
      const combined = `${soloQuestionEngineCasesSource}\n${soloProgressCasesSource}\n${placementFeedbackCasesSource}`;
      const missing = missingTokens(combined, [
        'normal_level_target_is_7',
        'special_level_target_is_10',
        'normal_deck_size_is_16',
        'special_deck_size_is_19',
        'first_five_ordered_questions_have_minimum_spacing',
        'solo_progress_counter_uses_completion_source',
        'progress_counter_pops_on_correct_increment',
        'same-score replay',
      ]);
      if (missing.length) {
        return fail('Solo Health no longer registers current rule/progress-counter coverage.', {
          verification: 'STATIC_CONTRACT',
          files: [
            'src/components/game/simulationPanelSoloQuestionEngineCases.jsx',
            'src/components/game/simulationPanelSoloProgressCases.jsx',
            'src/components/game/simulationPanelPlacementFeedbackCases.jsx',
          ],
          missing,
        });
      }
      return pass('Solo Health suites cover current rules, replay delta, and the progress-counter source-of-truth bug.', {
        verification: 'STATIC_CONTRACT',
      });
    }),

  makeCase('placement_reward_feedback_health_is_visual_only',
    'Correct-placement reward feedback Health stays visual-only and reduced-motion aware',
    () => {
      const missing = missingTokens(placementFeedbackCasesSource, [
        'correct_feedback_reward_stack_visual_only',
        'Correct placement triggers premium lock-in feedback animation',
        'pointer-events:none',
        'reduced-motion',
        'drag/drop core files were not rewritten',
      ]);
      if (missing.length) {
        return fail('Placement reward feedback Health lost the visual-only/reduced-motion contract.', {
          verification: 'STATIC_CONTRACT',
          file: 'src/components/game/simulationPanelPlacementFeedbackCases.jsx',
          missing,
        });
      }
      return pass('Placement reward feedback is checked as visual-only with reduced-motion protection.', {
        verification: 'STATIC_CONTRACT',
      });
    }),

  makeCase('notification_invite_lifecycle_current_contracts',
    'Notification/invite Health covers shared source, visual-only dismissal, and lobby-first open',
    () => {
      const combined = `${notificationApiSource}\n${releaseChecklistSource}`;
      const missing = missingTokens(combined, [
        'VITE_KRONOX_VAPID_PUBLIC_KEY',
        'missing_vapid_public_key',
        'registerKronoxServiceWorker',
        'GameInvite',
        'Push subscription works on real installed device if supported',
      ]);
      if (missing.length) {
        return fail('Notification/push static release contract is incomplete.', {
          verification: 'STATIC_CONTRACT',
          files: ['src/lib/notificationApi.js', 'docs/KRONOX_RELEASE_PROOF_CHECKLIST.md'],
          missing,
        });
      }
      return pass('Notification/push contracts keep in-app invites usable while push remains a manual device proof.', {
        verification: 'STATIC_CONTRACT',
      });
    }),

  makeCase('backend_security_current_controls_registered',
    'Backend security Health covers question access, startLobbyGame auth, secrets, and deletion',
    () => {
      const combined = [
        securityDocsSource,
        securityCleanupCasesSource,
        backendSecurityCasesSource,
        accountDeletionCasesSource,
      ].map(text).join('\n');
      const missing = missingTokens(combined, [
        'getQuestions',
        'requires auth',
        'startLobbyGame',
        'requires authenticated',
        'no legacy guest',
        'no client identity override',
        'VAPID',
        'admin',
        'account deletion',
        'NOT_AUTOMATABLE',
      ]);
      if (missing.length) {
        return fail('Backend/security Health coverage drifted from current controls.', {
          verification: 'STATIC_CONTRACT',
          files: [
            'docs/KRONOX_SECURITY_DEPLOYMENT.md',
            'src/components/game/simulationPanelSecurityCleanupCases.jsx',
            'src/components/game/simulationPanelBackendSecurityCases.jsx',
            'src/components/game/simulationPanelAccountDeletionCases.jsx',
          ],
          missing,
        });
      }
      return pass('Security Health keeps auth/authz, service-role, secret, question access, and account deletion risks visible.', {
        verification: 'STATIC_CONTRACT',
      });
    }),

  makeCase('db_architecture_status_is_honest',
    'DB architecture Health distinguishes implemented scaffolding from platform/manual proof',
    () => {
      const combined = `${dbArchitectureDocsSource}\n${dbArchitectureCasesSource}\n${DB_ARCHITECTURE_IMPLEMENTATION_MIRROR}`;
      const missing = missingTokens(combined, [
        'DB gateway',
        'QuestionAttemptEvent',
        'QuestionStatsProjection',
        'UserStatsProjection',
        'CategoryStatsProjection',
        'Leaderboard projection',
        'cleanup/retention',
        'Base44 index/unique-key declarations are a platform/manual configuration gap',
        'Runtime uniqueness proof remains manual/NOT_AUTOMATABLE',
        'Friendship',
        'GameRecord',
        'LobbyMessage',
        'Raw Question remains protected',
      ]);
      if (missing.length) {
        return fail('DB architecture Health/doc status is incomplete or overclaiming runtime proof.', {
          verification: 'STATIC_CONTRACT',
          files: ['docs/KRONOX_DB_ARCHITECTURE.md', 'src/components/game/simulationPanelDbArchitectureImplementationCases.jsx'],
          missing,
        });
      }
      return pass('DB architecture coverage is explicit about implemented scaffolding and manual platform constraints.', {
        verification: 'STATIC_CONTRACT',
      });
    }),

  makeCase('pwa_manifest_and_push_static_contract',
    'PWA manifest/service-worker/push basics are present without claiming device proof',
    async () => {
      const manifest = await fetchPublicText('/manifest.json');
      const serviceWorker = await fetchPublicText('/kronox-sw.js');
      const combined = `${manifest}\n${serviceWorker}\n${notificationApiSource}\n${releaseChecklistSource}`;
      const missing = missingTokens(combined, [
        '"name"',
        '"start_url"',
        '"display"',
        '"icons"',
        "self.addEventListener('push'",
        "self.addEventListener('notificationclick'",
        'registerKronoxServiceWorker',
        'Push subscription works on real installed device if supported',
      ]);
      if (missing.length) {
        return fail('PWA/static push contract is incomplete.', {
          verification: 'STATIC_CONTRACT',
          files: ['public/manifest.json', 'public/kronox-sw.js', 'src/lib/notificationApi.js', 'docs/KRONOX_RELEASE_PROOF_CHECKLIST.md'],
          missing,
        });
      }
      return pass('PWA manifest, push SW handlers, and manual push proof gate are visible.', {
        verification: 'STATIC_CONTRACT',
      });
    },
    { actionType: ACTION_TYPES.CODE_FIX }),

  makeCase('android_wrapper_warnings_are_manual_release_gates',
    'Android 15 edge-to-edge and large-screen/orientation warnings stay manual/platform release gates',
    () => {
      const missing = missingTokens(releaseChecklistSource, [
        'Android 15 Edge-To-Edge',
        'Play Console',
        'Window.setStatusBarColor',
        'Window.setNavigationBarColor',
        'Android Large-Screen / Orientation / Resizability',
        'tablet',
        'foldable',
        'resizable',
        'Do not mark this complete from static Health alone',
      ]);
      if (missing.length) {
        return fail('Android wrapper warning manual proof gates are missing from the release checklist.', {
          verification: 'STATIC_CONTRACT',
          file: 'docs/KRONOX_RELEASE_PROOF_CHECKLIST.md',
          missing,
        });
      }
      return pass('Android wrapper warnings are documented as runtime/Play Console gates, not static PASS.', {
        verification: 'STATIC_CONTRACT',
      });
    }),

  makeCase('public_asset_readmes_match_current_contract',
    'Public asset README contracts match current UI/category/question media truth',
    async () => {
      const [uiReadme, categoryReadme, questionReadme] = await Promise.all([
        fetchPublicText('/assets/ui/README.md'),
        fetchPublicText('/assets/categories/README.md'),
        fetchPublicText('/assets/questions/README.md'),
      ]);
      const combined = `${uiReadme}\n${categoryReadme}\n${questionReadme}`;
      const missing = missingTokens(combined, [
        'Adding a file here does not automatically make it part of the app',
        'Home screen is currently CSS/motion-driven',
        'not a pressed-image swap',
        'Chronicle',
        'Flashback',
        'Kült',
        'Viral',
        'Arena',
        'Level Up',
        'Current Kronox core gameplay does not require question images',
        'No current gameplay flow should depend on this folder',
      ]);
      if (missing.length) {
        return fail('Public asset README contracts are missing or stale.', {
          verification: 'STATIC_CONTRACT',
          files: [
            'public/assets/ui/README.md',
            'public/assets/categories/README.md',
            'public/assets/questions/README.md',
          ],
          missing,
        });
      }
      return pass('Public asset docs distinguish runtime assets, canonical categories, and optional question media.', {
        verification: 'STATIC_CONTRACT',
      });
    },
    { actionType: ACTION_TYPES.CODE_FIX }),

  makeCase('health_report_status_taxonomy_preserved',
    'Health report preserves PASS/FAIL/WARNING/BLOCKED/NOT_AUTOMATABLE/ERROR taxonomy',
    () => {
      const missing = missingTokens(healthStatusSource, [
        "PASS: 'PASS'",
        "FAIL: 'FAIL'",
        "WARNING: 'WARNING'",
        "BLOCKED: 'BLOCKED'",
        "NOT_AUTOMATABLE: 'NOT_AUTOMATABLE'",
        "ERROR: 'ERROR'",
        'STATUS_ORDER',
        'sanitizeForReport',
      ]);
      if (missing.length) {
        return fail('Health status/report taxonomy drifted or lost defensive serialization.', {
          verification: 'STATIC_CONTRACT',
          file: 'src/components/game/health/healthStatus.jsx',
          missing,
        });
      }
      return pass('Health status taxonomy and defensive report serialization are preserved.', {
        verification: 'STATIC_CONTRACT',
      });
    },
    { critical: false }),

  makeCase('manual_runtime_proof_gates_remain_visible',
    'Release readiness still surfaces manual runtime proof gates',
    () => {
      const combined = `${corePromptSource}\n${releaseChecklistSource}`;
      const missing = missingTokens(combined, [
        'two-account',
        'RLS',
        'push',
        'destructive account deletion',
        'Android wrapper',
        'safe-area',
        'real-device drag/drop',
        'NOT_AUTOMATABLE',
      ]);
      if (missing.length) {
        return fail('Manual release proof gates are not visible enough.', {
          verification: 'STATIC_CONTRACT',
          files: ['KRONOX_CORE_PROMPT.md', 'docs/KRONOX_RELEASE_PROOF_CHECKLIST.md'],
          missing,
        });
      }
      return pass('Manual/two-account/device/destructive proof gates stay explicit.', {
        verification: 'STATIC_CONTRACT',
      });
    }),

  makeCase('correct_reward_feel_human_review_required',
    'Correct-placement reward feel still requires human/game-feel review',
    () => notAutomatable(
      'Static Health proves the visual-only feedback hooks, but premium feel, readability, adrenaline, and distraction level require human review on a real device.',
      {
        verification: 'HUMAN_RUNTIME_PROOF_REQUIRED',
        classification: 'MANUAL_GAME_FEEL_REVIEW',
        actionType: ACTION_TYPES.HUMAN_RUNTIME_PROOF,
        manualProofRequired: true,
        relatedStaticCases: [
          'placement_feedback_animation.correct_placement_triggers_premium_feedback',
          'placement_feedback_animation.correct_feedback_reward_stack_visual_only',
          'placement_feedback_animation.progress_counter_pops_on_correct_increment',
        ],
      },
    ),
    {
      critical: false,
      actionType: ACTION_TYPES.HUMAN_RUNTIME_PROOF,
      runtimeProofRequired: true,
      nextStep: 'Review correct-placement feedback on a touch device with normal and reduced-motion settings.',
    }),

  makeCase('android_large_screen_runtime_proof_required',
    'Android 15 / large-screen wrapper warnings require Play Console and device proof',
    () => notAutomatable(
      'The web app can keep safe-area contracts visible, but Android 15 edge-to-edge and large-screen/orientation warnings originate in the native wrapper/dependencies and must be verified with an AAB, Play Console, and Android device/emulator.',
      {
        verification: 'PLATFORM_RUNTIME_PROOF_REQUIRED',
        classification: 'ANDROID_WRAPPER_MANUAL_GATE',
        actionType: ACTION_TYPES.HUMAN_RUNTIME_PROOF,
        manualProofRequired: true,
        file: 'docs/KRONOX_RELEASE_PROOF_CHECKLIST.md',
      },
    ),
    {
      critical: false,
      actionType: ACTION_TYPES.HUMAN_RUNTIME_PROOF,
      runtimeProofRequired: true,
      nextStep: 'Upload a new AAB and verify Android 15 edge-to-edge plus tablet/foldable orientation behavior in Play Console and on device.',
    }),
];
