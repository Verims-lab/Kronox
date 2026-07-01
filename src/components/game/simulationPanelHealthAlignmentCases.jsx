// Kronox Health Center — Full alignment and release-proof quality contracts.
//
// Scope: current docs, removed Settings UI expectations, Solo v2 coverage
// registration, PWA/mobile/Android manual gates, public asset README truth,
// DB architecture roadmap/implementation status, and Health report honesty.
// Runtime/device/two-account/destructive proofs intentionally remain manual.

import {
  CORE_PROMPT_DOC as corePromptSource,
  KRONOX_DOC as kronoxSource,
  PRODUCT_WORKFLOW_DOC as productWorkflowDocsSource,
  TECHNICAL_FLOW_DOC as technicalFlowDocsSource,
  ARCHITECTURE_AUDIT_DOC as architectureAuditMirrorSource,
  ARCHITECTURE_TARGET_DOC as architectureTargetMirrorSource,
  HEALTH_GAP_ANALYSIS_DOC as healthGapMirrorSource,
  DB_REPORTING_READINESS_DOC as dbReportingMirrorSource,
  VISUAL_ASSET_READINESS_DOC as visualAssetMirrorSource,
  PROFILE_FIELDS_DOC as profileFieldsDocsSource,
  MOBILE_VISUAL_GUARDRAILS_DOC as mobileVisualGuardrailsSource,
  SECURITY_DEPLOYMENT_DOC as securityDocsSource,
  RELEASE_PROOF_CHECKLIST_DOC as releaseChecklistSource,
  CATEGORY_TAXONOMY_DOC as categoryTaxonomyDocsSource,
  DB_ARCHITECTURE_DOC as dbArchitectureDocsSource,
} from '@/lib/healthAlignmentDocMirrors';
import { SCORING_RULES_DOC as scoringDocsSource } from '@/lib/scoringRulesDoc';
import { SOLO_QUESTION_ENGINE_DOC as soloEngineDocsSource } from '@/lib/soloQuestionEngineDoc';
import { QUESTION_DATA_MODEL_DOC as questionModelDocsSource } from '@/lib/questionDataModelDoc';
import { ECONOMY_RULES_DOC as economyDocsSource } from '@/lib/economyRulesDoc';
import { FULL_AUDIT_PACKAGE_DOC as fullAuditPackageMirrorSource } from '@/lib/fullAuditPackageMirror';
import settingsPageSource from '../../pages/SettingsPage.jsx?raw';
import adminPageSource from '../../pages/AdminPage.jsx?raw';
import profilePageSource from '../../pages/ProfilePage.jsx?raw';
import profileEditPageSource from '../../pages/ProfileEditPage.jsx?raw';
import authProviderButtonsSource from '../auth/AuthProviderButtons.jsx?raw';
import standardTopBarSource from '../layout/StandardTopBar.jsx?raw';
import notificationApiSource from '../../lib/notificationApi.js?raw';
import placementFeedbackCasesSource from './simulationPanelPlacementFeedbackCases.jsx?raw';
import soloQuestionEngineCasesSource from './simulationPanelSoloQuestionEngineCases.jsx?raw';
import soloProgressCasesSource from './simulationPanelSoloProgressCases.jsx?raw';
import securityCleanupCasesSource from './simulationPanelSecurityCleanupCases.jsx?raw';
import backendSecurityCasesSource from './simulationPanelBackendSecurityCases.jsx?raw';
import marketCasesSource from './simulationPanelMarketCases.jsx?raw';
import dailyQuestDefinitionCasesSource from './simulationPanelDailyQuestDefinitionCases.jsx?raw';
import dailyQuestRuntimeCasesSource from './simulationPanelDailyQuestRuntimeCases.jsx?raw';
import diamondEconomyCasesSource from './simulationPanelDiamondEconomyCases.jsx?raw';
import jokerInventoryCasesSource from './simulationPanelJokerInventoryCases.jsx?raw';
import soloJokersCasesSource from './simulationPanelSoloJokersCases.jsx?raw';
import accountDeletionCasesSource from './simulationPanelAccountDeletionCases.jsx?raw';
import dbArchitectureCasesSource from './simulationPanelDbArchitectureImplementationCases.jsx?raw';
import healthStatusSource from './health/healthStatus.jsx?raw';
import { DB_ARCHITECTURE_IMPLEMENTATION_MIRROR } from '@/lib/dbArchitectureMirrors';
import appSource from '../../App.jsx?raw';
import privacyPolicySource from '../../pages/PrivacyPolicy.jsx?raw';
import packageJsonSource from '../../../package.json?raw';
// Codex383/Codex441 — Markdown ?raw imports of files OUTSIDE /src crash
// Vite/Base44 import analysis ("invalid JS syntax ... .md?raw"). The active
// docs are already available as in-/src/ string mirrors, so these cases read
// the mirrors instead of the raw Markdown files.
const fullAuditPackageSource = fullAuditPackageMirrorSource;
const architectureAuditSource = architectureAuditMirrorSource;
const architectureTargetSource = architectureTargetMirrorSource;
const healthGapAnalysisSource = healthGapMirrorSource;
const dbReportingReadinessSource = dbReportingMirrorSource;
const visualAssetReadinessSource = visualAssetMirrorSource;
import soloProgressHelpersSource from '../../lib/soloProgressHelpers.js?raw';
import soloLevelsSource from '../../lib/soloLevels.js?raw';
import getQuestionsSource from '../../../base44/functions/getQuestions/entry.ts?raw';

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
        productWorkflowDocsSource,
        technicalFlowDocsSource,
        profileFieldsDocsSource,
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
        'Kronox Product Workflow',
        'Kronox Technical Flow',
        'Kronox Profile Fields',
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
            'docs/KRONOX_PRODUCT_WORKFLOW.md',
            'docs/KRONOX_TECHNICAL_FLOW.md',
            'docs/KRONOX_PROFILE_FIELDS.md',
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

  makeCase('architecture_audit_target_docs_registered',
    'Architecture audit docs lock Feature-Based MVVM / MVI target without starting Base44 migration',
    () => {
      const docsCombined = [
        architectureAuditSource,
        architectureTargetSource,
        healthGapAnalysisSource,
        dbReportingReadinessSource,
        visualAssetReadinessSource,
      ].map(text).join('\n');
      const mirrorCombined = [
        architectureAuditMirrorSource,
        architectureTargetMirrorSource,
        healthGapMirrorSource,
        dbReportingMirrorSource,
        visualAssetMirrorSource,
      ].map(text).join('\n');
      const missingDocs = missingTokens(docsCombined, [
        'Feature-Based MVVM with MVI-style state machines',
        'Current Base44 production path remains active',
        'Base44 migration work is paused',
        'Online lobby/start/reconnect',
        'friend/game invite notifications',
        'Health is a contract guard',
        '4-player Online lobby join/start',
        'DB Reporting Readiness',
        'DAU / WAU / MAU',
        'Visual Asset Readiness',
        'higher-quality visual assets without starting',
        'no full visual redesign',
      ]).map((token) => `docs:${token}`);
      const missingMirrors = missingTokens(mirrorCombined, [
        'Feature-Based MVVM',
        'MVI-style state machines',
        'Base44 production path remains active',
        'Base44 migration',
        'Online lobby/start/reconnect',
        'DAU/WAU/MAU',
        'private identifiers',
        'full question bank',
      ]).map((token) => `mirror:${token}`);
      if (missingDocs.length || missingMirrors.length) {
        return fail('Architecture audit docs/mirrors are missing current target or readiness contracts.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          files: [
            'docs/KRONOX_ARCHITECTURE_AUDIT.md',
            'docs/KRONOX_ARCHITECTURE_TARGET.md',
            'docs/KRONOX_HEALTH_GAP_ANALYSIS.md',
            'docs/KRONOX_DB_REPORTING_READINESS.md',
            'docs/KRONOX_VISUAL_ASSET_READINESS.md',
            'src/lib/healthAlignmentDocMirrors.js',
          ],
          actual: { missingDocs, missingMirrors },
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      return pass('Architecture docs and mirrors preserve the MVVM/MVI target, Base44-active boundary, Health gap plan, reporting readiness, and visual asset readiness.', {
        verification: 'STATIC_CONTRACT',
        classification: 'STATIC_CHECK_LIMITATION',
      });
    }),

  makeCase('combined_p1_p2_audit_static_contracts',
    'Combined P1/P2 audit contracts are represented in Health/static docs',
    () => {
      const docsCombined = [
        technicalFlowDocsSource,
        securityDocsSource,
        releaseChecklistSource,
        soloEngineDocsSource,
        questionModelDocsSource,
        scoringDocsSource,
        dbArchitectureDocsSource,
        fullAuditPackageSource,
      ].map(text).join('\n');
      const appAdminCombined = `${appSource}\n${adminPageSource}`;
      const packageText = text(packageJsonSource);
      const soloCombined = `${soloProgressHelpersSource}\n${soloLevelsSource}`;
      const required = [
        ...missingTokens(appAdminCombined, [
          'function AdminRoute',
          'adminStatus?.loading === true',
          "adminStatus?.statusCall === 'pending'",
          '<Navigate to="/" replace state={{ adminDenied: true }} />',
          'lazyWithRetry',
          'SimulationPanelErrorBoundary',
          'AdminToolLoading',
        ]).map((token) => `admin:${token}`),
        ...missingTokens(docsCombined, [
          'configured `function.jsonc` manifests',
          'route-level UX guard',
          '96 * 3 = 288',
          'Dependency cleanup result',
          'Status: current index / redirect, Codex417',
          'iOS wrapper',
          'physical Apple parity',
          'economy parallel',
          'mobile visual',
        ]).map((token) => `docs:${token}`),
        ...missingTokens(`${getQuestionsSource}\n${backendSecurityCasesSource}`, [
          'AUTH_GAMEPLAY_CANDIDATE_FETCH_MULTIPLIER = 3',
          'queryLimitRationale',
          'QUESTION_FETCH_PER_CATEGORY_LIMIT = MAX_AUTH_GAMEPLAY_RESPONSE_LIMIT * AUTH_GAMEPLAY_CANDIDATE_FETCH_MULTIPLIER',
        ]).map((token) => `getQuestions:${token}`),
      ];
      const forbidden = [
        ...forbiddenTokens(getQuestionsSource, [
          'QUESTION_FETCH_PER_CATEGORY_LIMIT = 5000',
        ]).map((token) => `getQuestions:${token}`),
        ...forbiddenTokens(packageText, [
          '"@stripe/react-stripe-js"',
          '"@stripe/stripe-js"',
          '"three"',
          '"react-leaflet"',
          '"react-quill"',
          '"moment"',
          '"jspdf"',
          '"html2canvas"',
          '"lodash"',
        ]).map((token) => `package:${token}`),
        ...forbiddenTokens(soloCombined, [
          'SOLO_SCORE_MAX_MISTAKES',
          'SOLO_MAX_MISTAKES',
        ]).map((token) => `solo:${token}`),
      ];
      const retained = missingTokens(packageText, [
        '"recharts"',
        '"embla-carousel-react"',
      ]).map((token) => `retained:${token}`);
      if (required.length || forbidden.length || retained.length) {
        return fail('Combined P1/P2 audit static contracts drifted.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          files: [
            'src/App.jsx',
            'src/pages/AdminPage.jsx',
            'base44/functions/getQuestions/entry.ts',
            'package.json',
            'docs/KRONOX_FULL_AUDIT_PACKAGE_1.md',
          ],
          actual: { missing: required, forbidden, retainedMissing: retained },
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      return pass('Combined P1/P2 audit contracts cover admin guard, dependency cleanup, bounded getQuestions fetch, docs integrity, and legacy alias cleanup.', {
        verification: 'STATIC_CONTRACT',
      });
    }),

  makeCase('docs_current_solo_v3_contract',
    'Docs align with current Solo v3 move-based scoring, timing, deck, and replay rules',
    () => {
      const combined = `${scoringDocsSource}\n${soloEngineDocsSource}\n${releaseChecklistSource}`;
      const missing = missingTokens(combined, [
        '7 correct',
        '18-question deck',
        '19-question deck',
        '180 seconds',
        '10 evaluated moves',
        'HAMLE',
        'first 5 ordered questions',
        'minimum 5-year',
        'Same-score replay does not add points',
        'Lower-score replay does not add points',
        'Better replay adds only the positive score delta',
        'Old completed Solo results are not retroactively recalculated',
      ]);
      if (missing.length) {
        return fail('Solo v3 docs drifted from current product rules.', {
          verification: 'STATIC_CONTRACT',
          files: ['docs/KRONOX_SCORING_RULES.md', 'docs/KRONOX_SOLO_QUESTION_ENGINE.md', 'docs/KRONOX_RELEASE_PROOF_CHECKLIST.md'],
          missing,
        });
      }
      return pass('Solo v3 docs cover targets, decks, timer, move fail, spacing, replay, and non-retroactivity.', {
        verification: 'STATIC_CONTRACT',
      });
    }),

  makeCase('current_contract_freshness_profile_category_questions',
    'Health alignment covers current Profile, Category, Question, Security, and Scoring contracts',
    () => {
      const combined = [
        profileFieldsDocsSource,
        productWorkflowDocsSource,
        technicalFlowDocsSource,
        mobileVisualGuardrailsSource,
        releaseChecklistSource,
        securityDocsSource,
        categoryTaxonomyDocsSource,
        questionModelDocsSource,
        scoringDocsSource,
        soloEngineDocsSource,
      ].map(text).join('\n');
      const missing = missingTokens(combined, [
        'Home / Ana Sayfa must not render Google, Apple, email',
        'Guest account linking is implemented through linkGuestAccount and belongs under Profile',
        'Hesabım Var',
        'secondary route to Profile account connection',
        'not as an inline provider/login surface',
        'guided first Solo level',
        'GuestProfile is app-owned',
        'Firebase anonymous auth',
        'KronoxUser####',
        'The category completion CTA label is exactly Ana Sayfa',
        'onboarding_status = onboarding_complete',
        'guest_id + raw guest token',
        'Kategoriler kaydedilemedi. Lütfen tekrar dene',
        'getCategoryMetadata is metadata-only',
        'current active Category rows',
        'stale hardcoded seed fallback',
        'hardcoded category fallback arrays',
        'minimum is 3 active valid categories',
        'seedQuestionCategories is removed',
        'Visible UI must use **Puan** or **Kronox Puan**',
        'HAMLE / remaining moves',
        'HATA is legacy/internal',
        '5–6 used moves: 3 stars',
        'Deck sizing is 2 anchors + 10 playable moves + Kart Değiştir buffer',
        'Kronokalkan buffer',
        'getQuestions-live-per-category-v8-Codex417',
        'sourcePoolCapRemoved',
        'responseCapApplied',
        'QuestionAttemptEvent',
        'PlayerQuestionDailyExposure',
        'QuestionStatsProjection',
        'CategoryStatsProjection',
        'PlayerQuestionExposure is optional reset scope',
        'Do not delete Question, Category, SubCategory, User, GuestProfile, PlayerProfile',
        'VAPID_PRIVATE_KEY is server-side env/secret sourced. Production secret manager verification is MANUAL_REQUIRED.',
        'Health Copy Warning JSON is warning-only',
        'Manual Required / NOT_AUTOMATABLE does not reduce automated score',
        'Last Run and copy/download actions use the newest completed report only',
        'Health Center report actions, case details, copy buttons',
        'selected 100% from active lobby-selected categories',
        'Online does not use Solo preferences',
        'difficulty 1/2 only',
      ]);
      if (missing.length) {
        return fail('Health alignment docs/mirrors are stale against current product/security/question contracts.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          files: [
            'docs/KRONOX_PROFILE_FIELDS.md',
            'docs/KRONOX_MOBILE_VISUAL_GUARDRAILS.md',
            'docs/KRONOX_RELEASE_PROOF_CHECKLIST.md',
            'docs/KRONOX_SECURITY_DEPLOYMENT.md',
            'docs/KRONOX_CATEGORY_TAXONOMY.md',
            'docs/KRONOX_QUESTION_DATA_MODEL.md',
            'docs/KRONOX_SCORING_RULES.md',
            'docs/KRONOX_SOLO_QUESTION_ENGINE.md',
          ],
          missing,
        });
      }
      return pass('Health alignment covers the current Profile/auth placement, guest category completion, active category runtime, question analytics reset, scoring language, VAPID triage, and Health mobile copy/detail contracts.', {
        verification: 'STATIC_CONTRACT',
        classification: 'STATIC_CHECK_LIMITATION',
      });
    }),

  makeCase('removed_settings_sections_not_expected',
    'Settings Health expects normal settings while Admin Ekranı owns admin tools',
    () => {
      const forbidden = forbiddenTokens(settingsPageSource, [
        'Soru Yönetimi',
        'Question Management',
        'Uygulama Ayarları',
        'App Settings',
        'NotificationSettingsCard',
        'AppPreferencesCard',
        'ResetUserProgressTool',
        'QuestionAnalyticsReportTool',
        'SimulationPanel',
        'Kronox Health Simulator',
      ]);
      const settingsMissing = missingTokens(settingsPageSource, [
        'StandardTopBar',
        'diamonds={diamondValue}',
        'user={user}',
        'showBack',
        'Hesabı Sil',
      ]);
      const profileInfoMissing = missingTokens(profileEditPageSource, [
        'Profil Bilgileri',
        'Takma Ad',
        'Cinsiyet',
        'Yaş grubu',
        'Kategori seçimi',
        'CategoryPreferencesSection',
      ]);
      const adminMissing = missingTokens(adminPageSource, [
        'Admin Ekranı',
        'const isAdmin = parsedAdminStatus',
        'if (!isAdmin)',
        'ResetUserProgressTool',
        'QuestionAnalyticsReportTool',
        'SimulationPanel',
      ]);
      const topBarMissing = missingTokens(standardTopBarSource, [
        'HeaderNotificationBell',
        '<HeaderNotificationBell user={user} />',
        'aria-label={`Elmas: ${diamonds}`}',
      ]);
      if (forbidden.length || settingsMissing.length || profileInfoMissing.length || adminMissing.length || topBarMissing.length) {
        return fail('Settings/Admin split has stale removed UI or lost the current top/admin/deletion contract.', {
          verification: 'STATIC_CONTRACT',
          files: ['src/pages/SettingsPage.jsx', 'src/pages/ProfileEditPage.jsx', 'src/pages/AdminPage.jsx', 'src/components/layout/StandardTopBar.jsx'],
          actual: { forbidden, settingsMissing, profileInfoMissing, adminMissing, topBarMissing },
        });
      }
      return pass('Settings owns privacy/account deletion, Profile Info owns category preferences, and Admin Ekranı owns admin maintenance; removed UI stays absent.', {
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
        'normal_deck_size_is_18',
        'special_deck_size_is_19',
        'solo_move_based_runtime_contract',
        'SOLO_MAX_MOVES',
        'solo_attempt_fails_on_10th_move',
        'solo_deck_size_includes_joker_buffers',
        'PlayerQuestionExposure',
        'solo_category_preference_runtime_wiring_and_boundaries',
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

  makeCase('market_phase_1_health_registered',
    'Health registers comprehensive Mağaza Phase 1 economy coverage',
    () => {
      const combined = [
        marketCasesSource,
        diamondEconomyCasesSource,
        jokerInventoryCasesSource,
        soloJokersCasesSource,
        backendSecurityCasesSource,
        releaseChecklistSource,
        securityDocsSource,
        economyDocsSource,
      ].map(text).join('\n');
      const missing = missingTokens(combined, [
        'market_health',
        'Mağaza / Market Health Suite',
        'purchaseJokerWithDiamonds',
        'Client does not control trusted purchase price',
        'Successful purchase decreases Diamonds, increases joker balance, and writes both ledgers',
        'Retry/idempotency contract prevents double-charge and double-grant drift',
        'Mağaza purchase is a controlled Diamond sink',
        'Market purchase increases the correct UserJokerInventory joker type only',
        'Solo joker bar can reflect purchased Market balances',
        'Market purchase does not trust client price or client identity',
        'Daily Wheel remains Diamond-only',
        'Online does not use market/joker purchases',
      ]);
      if (missing.length) {
        return fail('Market Phase 1 Health coverage is not registered across economy/security/cross-mode suites.', {
          verification: 'STATIC_CONTRACT',
          files: [
            'src/components/game/simulationPanelMarketCases.jsx',
            'src/components/game/simulationPanelDiamondEconomyCases.jsx',
            'src/components/game/simulationPanelJokerInventoryCases.jsx',
            'src/components/game/simulationPanelSoloJokersCases.jsx',
            'docs/KRONOX_RELEASE_PROOF_CHECKLIST.md',
          ],
          missing,
        });
      }
      return pass('Market Phase 1 Health covers UI placement, server validation, dual ledgers, idempotency, and Diamond/Joker/Solo/Daily Wheel/Online boundaries.', {
        verification: 'STATIC_CONTRACT',
      });
    }),

  makeCase('daily_quest_definition_health_registered',
    'Health registers Daily Quest canonical runtime coverage',
    () => {
      const combined = [
        dailyQuestDefinitionCasesSource,
        dailyQuestRuntimeCasesSource,
        releaseChecklistSource,
        securityDocsSource,
        dbArchitectureDocsSource,
        soloEngineDocsSource,
      ].map(text).join('\n');
      const missing = missingTokens(combined, [
        'daily_quest_definition_health',
        'Daily Quest Definition Health Suite',
        'daily_quest_runtime_health',
        'Daily Quest Runtime Health Suite',
        'DailyQuestDefinition',
        'UserDailyQuestProgress',
        'claimDailyQuestReward',
        'daily_quest_reward',
        'solo_level_complete',
        'Solo’da Seviye Geç',
        'Bugün 1 Solo seviyesini tamamla.',
        'definitionRowsIgnoredAtRuntime',
        'solo_level_completion_only',
        'reward_diamonds',
        'no Kronox Puan',
        'no leaderboard impact',
        'Görevler',
        'Çark',
      ]);
      if (missing.length) {
        return fail('Daily Quest Definition/Runtime Health/docs coverage is incomplete.', {
          verification: 'STATIC_CONTRACT',
          files: [
            'src/components/game/simulationPanelDailyQuestDefinitionCases.jsx',
            'src/components/game/simulationPanelDailyQuestRuntimeCases.jsx',
            'docs/KRONOX_RELEASE_PROOF_CHECKLIST.md',
            'docs/KRONOX_SECURITY_DEPLOYMENT.md',
            'docs/KRONOX_DB_ARCHITECTURE.md',
            'docs/KRONOX_SOLO_QUESTION_ENGINE.md',
          ],
          missing,
        });
      }
      return pass('Daily Quest Health covers admin definitions plus runtime progress, claim, panel, and no-Puan/leaderboard boundaries.', {
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

  makeCase('public_privacy_policy_route',
    'Public /privacy route and App Store privacy policy content are present',
    () => {
      const combinedDocs = `${releaseChecklistSource}\n${securityDocsSource}`;
      const missingRoute = missingTokens(appSource, [
        "import('./pages/PrivacyPolicy')",
        "location.pathname === '/privacy'",
        'isPublicStandalonePage = isAccountDeletionPage || isPrivacyPage',
        '<Route path="/privacy" element={<PrivacyPolicy />} />',
        '!isPublicStandalonePage && <BottomNav />',
      ]);
      const missingPage = missingTokens(privacyPolicySource, [
        'Gizlilik Politikası',
        'Son güncelleme',
        'getPublicSupportEmail',
        'buildPublicSupportMailto',
        'Destek e-posta adresi dağıtım yapılandırmasından sağlanır.',
        'Hesap ve profil',
        'Oynanış bilgileri',
        'liderlik tablosu',
        'Sosyal ve davet',
        'Push bildirimleri isteğe bağlıdır',
        'local storage, IndexedDB/cache',
        'Elmas bakiyesi',
        'Günlük Çark',
        'Günlük Görev',
        'Joker Çantası',
        'Soru dengesi',
        'Kronox şu anda kişisel verileri üçüncü taraf reklam amacıyla satmaz',
        'Hesap silme talebi',
        'App Store gizlilik',
      ]);
      const missingLink = missingTokens(settingsPageSource, [
        'Gizlilik Politikası',
        "navigate('/privacy')",
      ]);
      const missingDocs = missingTokens(combinedDocs, [
        'https://kronoxgame.com/privacy',
        '/privacy must be publicly accessible without login',
        'App Store Connect privacy answers must match',
        'account/profile data',
        'gameplay/progress/leaderboard data',
        'friends/invites/social data',
        'optional push subscription',
        'local storage/cache',
        'economy/ledger',
        'question analytics/reporting',
      ]);
      const forbidden = forbiddenTokens(privacyPolicySource, [
        'no data is collected',
        'hiç veri toplanmaz',
        'veri toplamıyoruz',
        'Kids Category',
        'GDPR compliant',
        'CCPA compliant',
      ]);
      const missing = [
        ...missingRoute.map((token) => `route:${token}`),
        ...missingPage.map((token) => `page:${token}`),
        ...missingLink.map((token) => `settings:${token}`),
        ...missingDocs.map((token) => `docs:${token}`),
      ];
      if (missing.length || forbidden.length) {
        return fail('Public Privacy Policy route/content/App Store alignment is incomplete.', {
          verification: 'STATIC_CONTRACT',
          files: [
            'src/App.jsx',
            'src/pages/PrivacyPolicy.jsx',
            'src/pages/SettingsPage.jsx',
            'docs/KRONOX_RELEASE_PROOF_CHECKLIST.md',
            'docs/KRONOX_SECURITY_DEPLOYMENT.md',
          ],
          actual: { missing, forbidden },
        });
      }
      return pass('/privacy is public, Turkish, linked from Settings, and aligned with App Store privacy disclosures.', {
        verification: 'STATIC_CONTRACT',
      });
    }),

  makeCase('apple_login_compliance_static_contract',
    'Profile login surface includes Base44-managed Sign in with Apple option',
    () => {
      const uiSource = `${authProviderButtonsSource}\n${profilePageSource}`;
      const docsSource = `${releaseChecklistSource}\n${securityDocsSource}`;
      const missingUi = missingTokens(uiSource, [
        'AuthProviderButtons',
        'Apple ile devam et',
        "startProviderLogin('apple')",
        "base44.auth.loginWithProvider(provider, fromUrl)",
        "startProviderLogin('google')",
        'Google ile devam et',
        'E-posta ile devam et',
        'base44.auth.redirectToLogin(fromUrl)',
        'fromUrl="/profile"',
      ]);
      const missingDocs = missingTokens(docsSource, [
        'Sign in with Apple',
        'Apple ile devam et',
        'Base44 Settings',
        'Authentication',
        'Apple toggle',
        'Guideline 4.8',
      ]);
      const forbidden = forbiddenTokens(uiSource, [
        'APPLE_CLIENT_SECRET',
        'APPLE_TEAM_ID',
        'APPLE_KEY_ID',
        'client_secret',
        'native Apple Sign-In',
      ]);
      if (missingUi.length || missingDocs.length || forbidden.length) {
        return fail('Apple login/App Store Guideline 4.8 static contract is incomplete.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          files: [
            'src/components/auth/AuthProviderButtons.jsx',
            'src/pages/ProfilePage.jsx',
            'docs/KRONOX_RELEASE_PROOF_CHECKLIST.md',
            'docs/KRONOX_SECURITY_DEPLOYMENT.md',
          ],
          expected: 'visible Apple button using Base44 provider auth, Google/email preserved, no native secrets, manual Base44 Apple toggle documented',
          actual: { missingUi, missingDocs, forbidden },
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      return pass('Login surfaces include Apple, Google, and hosted/email Base44 auth; manual Base44 Apple toggle remains documented.', {
        verification: 'STATIC_CONTRACT',
        classification: 'STATIC_CHECK_LIMITATION',
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
        '/assets/icons/kronox-app-icon-192.png',
        '/assets/icons/kronox-app-icon-512.png',
        '/assets/icons/kronox-app-icon-1024.png',
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

  makeCase('ios_app_icon_90717_release_gate',
    'iOS AppIcon alpha-channel release gate is documented and checkable',
    () => {
      const missing = missingTokens(releaseChecklistSource, [
        'iOS AppIcon PNGs must be fully opaque',
        'No alpha channel',
        '1024x1024',
        'RGB/opaque',
        'App Store Connect error 90717',
        'npm run check:ios-icons',
        'ios/App/App/Assets.xcassets/AppIcon.appiconset/Contents.json',
        'public/manifest.json',
        '/assets/icons/kronox-app-icon-*',
        'Base44',
        'App logo',
        'public/assets/icons/base44-app-logo-1024-no-alpha.png',
        'Generate Files',
        'old IPA/archive files must not be reused',
        'final `WixOneApp.app` icon asset',
        'final exported IPA',
        'Assets.car',
        'source-only checks must not claim',
        'Real App Store Connect re-upload validation remains manual',
      ]);
      if (missing.length) {
        return fail('iOS AppIcon no-alpha release gate is missing from the release checklist.', {
          verification: 'STATIC_CONTRACT',
          files: ['docs/KRONOX_RELEASE_PROOF_CHECKLIST.md', 'scripts/check-ios-icons-no-alpha.mjs'],
          missing,
        });
      }
      return pass('iOS AppIcon no-alpha and App Store 90717 release checks are documented with a repo validation command.', {
        verification: 'STATIC_CONTRACT',
      });
    },
    {
      actionType: ACTION_TYPES.MANUAL_REVIEW,
      nextStep: 'Run npm run check:ios-icons, archive/export the iOS build, and re-upload or validate in App Store Connect to prove 90717 is gone.',
    }),

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
      const uiMissing = missingTokens(uiReadme, [
        'Adding a file here does not automatically make it part of the app',
        'mobile-first',
        'guided first Solo level',
        'Tutorial hand/finger assets are tutorial-only',
        'must not block touch input',
        'Heavy blur/glow effects should be limited',
        'HAMLE',
        'Puan` / `Kronox Puan',
        'Kullanıcı Adı',
        'Do not present `Görünen Ad` / `display_name` as current public identity',
        'Do not use `HATA` as the current Solo result/stat label',
        'account linking belongs under Profile',
        'No secrets, tokens, auth headers, private keys',
        'VAPID_PRIVATE_KEY',
      ]).map((token) => `ui:${token}`);
      const categoryMissing = missingTokens(categoryReadme, [
        'not the active category source of truth',
        'Current category source of truth is the DB/current canonical taxonomy',
        'getCategoryMetadata',
        'metadata only',
        'Guest users can load categories without login',
        'Category preferences are Solo-only soft weighting',
        'Online is separate',
        'sorted by category_id ASC',
        'No questions, answers, years, full question bank',
        'Do not reintroduce stale hardcoded category fallback arrays',
        'Forbidden stale fallback examples: Chronicle, Flashback, Viral, Arena',
        'Level Up',
        'VAPID_PRIVATE_KEY',
      ]).map((token) => `categories:${token}`);
      const questionMissing = missingTokens(questionReadme, [
        'media/support files only',
        'Do not store the full question bank',
        'Do not store question text, answer years, correct answers',
        'No raw `Question.list` fallback',
        'server/projection-safe paths',
        'No per-player exposure data',
        'Question Analytics remains a private/admin email-body report',
        'not a public PDF',
        'User0001-style labels',
        'No email, provider UID, raw guest_id, owner_key, internal player_key, tokens',
        'No secrets, tokens, auth headers, private keys',
        'VAPID_PRIVATE_KEY',
      ]).map((token) => `questions:${token}`);
      const forbiddenCurrent = [
        ...forbiddenTokens(uiReadme, [
          'standalone tutorial',
          'HATA is current',
          'display_name is public',
          'Görünen Ad is public',
        ]).map((token) => `ui:${token}`),
        ...forbiddenTokens(categoryReadme, [
          '## Current Categories',
          '| File | Category |',
          'runtime category source of truth unless',
          'full question bank belongs',
        ]).map((token) => `categories:${token}`),
        ...forbiddenTokens(questionReadme, [
          'question bank may live here',
          'correct answers may live here',
          'raw Question.list fallback is allowed',
          'Question Analytics is public',
        ]).map((token) => `questions:${token}`),
      ];
      const missing = [...uiMissing, ...categoryMissing, ...questionMissing];
      if (missing.length || forbiddenCurrent.length) {
        return fail('Public asset README contracts are missing or stale.', {
          verification: 'STATIC_CONTRACT',
          files: [
            'public/assets/ui/README.md',
            'public/assets/categories/README.md',
            'public/assets/questions/README.md',
          ],
          actual: { missing, forbiddenCurrent },
        });
      }
      return pass('Public asset docs distinguish mobile UI assets, category metadata source-of-truth, and private question/media boundaries.', {
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

  makeCase('full_audit_performance_security_platform_gates_visible',
    'Full audit gates keep performance, BOLA, DB uniqueness, and platform proof explicit',
    () => {
      const combined = [
        releaseChecklistSource,
        securityDocsSource,
        dbArchitectureDocsSource,
        mobileVisualGuardrailsSource,
      ].map(text).join('\n');
      const missing = missingTokens(combined, [
        '50ms long-task budget',
        'Gameplay paths do not run Health/report/question-analytics calculations',
        'object-level authorization',
        'Request-body user, email, role, or owner fields are not trusted',
        'Base44/manual DB constraints',
        'idempotency_key',
        'safe-area',
        'keyboard',
        'Final App Store icon proof',
        'Android wrapper edge-to-edge',
        'Play Console',
        'real mobile/device/store validation remains manual or NOT_AUTOMATABLE',
      ]);
      if (missing.length) {
        return fail('Full audit release gates are missing from docs/mirrors.', {
          verification: 'STATIC_CONTRACT',
          files: [
            'docs/KRONOX_RELEASE_PROOF_CHECKLIST.md',
            'docs/KRONOX_SECURITY_DEPLOYMENT.md',
            'docs/KRONOX_DB_ARCHITECTURE.md',
            'docs/KRONOX_MOBILE_VISUAL_GUARDRAILS.md',
          ],
          missing,
        });
      }
      return pass('Performance, object authorization, DB uniqueness/idempotency, and platform manual gates remain visible.', {
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
