import packageSource from '../../../package.json?raw';
import gitignoreSource from '../../../.gitignore?raw';
import runnerSource from '../../../scripts/run-health-e2e.mjs?raw';
import handlerSource from '../../../tests/health-e2e/scenarioHandlers.mjs?raw';
import harnessSource from '../../../tests/health-e2e/runtimeHarness.mjs?raw';
import simulationPanelSource from './SimulationPanel.jsx?raw';
import runtimePanelSource from './health/RuntimeE2EAutomationPanel.jsx?raw';
import soloLevelMapSource from '../solo/LevelMapPath.jsx?raw';
import soloChallengeSource from '../../pages/SoloChallenge.jsx?raw';
import reportSource from '../../lib/health/runtimeE2EReport.js?raw';
import capabilitySource from '../../lib/health/runtimeE2ECapabilities.js?raw';
import scenarioRegistrySource from '../../lib/health/runtimeE2EScenarios.js?raw';
import { HEALTH_GAP_ANALYSIS_DOC, RELEASE_PROOF_CHECKLIST_DOC } from '@/lib/healthAlignmentDocMirrors';
import {
  AUTOMATION_STATUS,
  BACKEND_PREFLIGHT_STATUS,
  RUNTIME_DIAGNOSTIC_CATEGORY,
  RUNTIME_E2E_PREFLIGHT_DEPENDENCY,
  RUNTIME_E2E_PROOF_LEVEL,
  buildAllAutomationSetupGapsJson,
  buildAutomationFailureJson,
  buildRuntimePermissionDiagnostic,
  classifyRuntimeDiagnostic,
  classifyRuntimeServiceRequest,
  createNotRunAutomationReport,
  normalizeRuntimeE2EReport,
  recordRuntimeServiceObservation,
  resolveRuntimePreflightStatus,
  runtimeServiceSummaryUnavailableReason,
  summarizeRuntimeBackendEvidence,
} from '@/lib/health/runtimeE2EReport';
import {
  buildRuntimeCapabilitySummary,
  classifyRuntimeE2ETarget,
  evaluateScenarioCapabilities,
  RUNTIME_E2E_CAPABILITY_STATUS,
  RUNTIME_E2E_TARGET_KIND,
} from '@/lib/health/runtimeE2ECapabilities';
import {
  RUNTIME_E2E_SCENARIOS,
  RUNTIME_E2E_SUITE,
  RUNTIME_E2E_SUITE_ID,
} from '@/lib/health/runtimeE2EScenarios';

const SUITE_ID = 'runtime_e2e_automation';
const SUITE_NAME = 'Runtime E2E Automation Framework Health Suite';
const RELATED_FILES = [
  'src/lib/health/runtimeE2EScenarios.js',
  'src/lib/health/runtimeE2EReport.js',
  'scripts/run-health-e2e.mjs',
  'tests/health-e2e/runtimeHarness.mjs',
  'tests/health-e2e/scenarioHandlers.mjs',
  'src/components/game/health/RuntimeE2EAutomationPanel.jsx',
  'src/components/game/SimulationPanel.jsx',
];
const pass = (reason, extra = {}) => ({ status: 'PASS', reason, verification: 'EXECUTABLE_SIMULATION', classification: 'EXECUTABLE', ...extra });
const fail = (reason, actual) => ({ status: 'FAIL', reason, actual, verification: 'SOURCE_CONNECTED', classification: 'REAL_PRODUCT_RISK' });
const makeCase = (id, name, run, relatedFiles = RELATED_FILES) => ({
  key: `${SUITE_ID}.${id}`,
  suiteId: SUITE_ID,
  suiteName: SUITE_NAME,
  id,
  name,
  critical: true,
  actionType: 'CODE_FIX',
  relatedFiles,
  run,
});
const missing = (source, tokens) => tokens.filter((token) => !String(source || '').includes(token));

export const EXTRA_SUITES = [{ id: SUITE_ID, name: SUITE_NAME, critical: true, color: '#38bdf8' }];

export const EXTRA_TESTS = [
  makeCase('suite_registered', 'Runtime E2E Automation Health Suite is registered as a display-only HealthCheck suite', () => {
    const ok = RUNTIME_E2E_SUITE.id === RUNTIME_E2E_SUITE_ID
      && RUNTIME_E2E_SUITE.name === 'Runtime E2E Automation Health Suite'
      && RUNTIME_E2E_SUITE.externalAutomation === true
      && simulationPanelSource.includes('DISPLAY_SUITES');
    return ok
      ? pass('The display-only Runtime E2E Automation suite is registered under HealthCheck.')
      : fail('Runtime E2E suite registration is missing or not display-only.', { suite: RUNTIME_E2E_SUITE });
  }),

  makeCase('max_10_scenarios', 'Runtime E2E V2 registry contains exactly 10 and never more than 10 scenarios', () => (
    RUNTIME_E2E_SCENARIOS.length === 10
      ? pass('The V2 registry contains exactly 10 scenarios.', { actual: RUNTIME_E2E_SCENARIOS.length })
      : fail('Runtime E2E V2 must contain exactly 10 scenarios.', { actual: RUNTIME_E2E_SCENARIOS.length, maximum: 10 })
  )),

  makeCase('full_run_excludes_runtime_automation', 'Full Health Run cannot execute runtime browser automation', () => {
    const absent = missing(simulationPanelSource, [
      'const DISPLAY_SUITES = [...SUITES, RUNTIME_E2E_SUITE]',
      "const runAll = () => runPack('full')",
      'getHealthPackCases(TESTS, pack.id)',
      'if (runtimeAutomationSelected) return',
    ]);
    const runtimeSuiteInCoreRegistry = scenarioRegistrySource.includes('export const RUNTIME_E2E_SUITE')
      && simulationPanelSource.includes('RUNTIME_E2E_SUITE')
      && !simulationPanelSource.includes('buildReport(Object.values(nextResults), DISPLAY_SUITES');
    return !absent.length && runtimeSuiteInCoreRegistry
      ? pass('Full Run still resolves only TESTS; the external suite is appended for display and excluded from core report execution.')
      : fail('Full Run separation contract drifted.', { missing: absent, runtimeSuiteInCoreRegistry });
  }),

  makeCase('separate_run_control_exists', 'Runtime E2E exposes an honest separate CLI run control', () => {
    const absent = missing(`${runtimePanelSource}\n${scenarioRegistrySource}\n${packageSource}`, [
      'Otomasyonu Çalıştır',
      'CLI\'dan Çalıştır',
      'Komutu Kopyala',
      'npm run health:e2e',
      'node scripts/run-health-e2e.mjs',
    ]);
    return absent.length
      ? fail('Separate runtime automation control/command is incomplete.', { missing: absent })
      : pass('HealthCheck exposes a non-deceptive CLI run control and copyable npm command.');
  }),

  makeCase('report_is_separate_from_blockers', 'Automation report and counters remain separate from Health blockers/fails/warnings', () => {
    const absent = missing(`${reportSource}\n${runtimePanelSource}\n${simulationPanelSource}`, [
      'automationPassed',
      'automationFailed',
      'automationNotRun',
      'automationNotAutomatable',
      'automationManualExternal',
      'Otomasyon sonuçları Health blocker, fail veya warning sayaçlarına eklenmez.',
      '!runtimeAutomationSelected && report',
    ]);
    return absent.length
      ? fail('Automation report can drift into core Health reporting.', { missing: absent })
      : pass('Automation owns five separate counters and is never passed into core Health report actions/counts.');
  }),

  makeCase('scenario_step_details_visible', 'Scenario details expose ordered step action/expected/status/actual/artifact fields', () => {
    const absent = missing(runtimePanelSource, [
      '<details',
      'scenario.steps.map',
      'data-health-runtime-step-details="visible"',
      'Action:',
      'Expected:',
      'Actual:',
      'Selector:',
      'Route:',
      'Artifacts:',
    ]);
    return absent.length
      ? fail('Expandable per-step result detail UI is incomplete.', { missing: absent })
      : pass('Each registry scenario expands into ordered action, expected, actual, status, route, selector, and artifact details.');
  }),

  makeCase('copy_json_failure_exists', 'Selected and all failed automation results have privacy-safe JSON copy output', () => {
    const sample = createNotRunAutomationReport('Health-test');
    sample.runId = 'health-runtime-test';
    sample.scenarios[0] = {
      ...sample.scenarios[0],
      status: AUTOMATION_STATUS.FAIL,
      failureCategory: 'TEST_FAILURE',
      steps: sample.scenarios[0].steps.map((step, index) => index === 0 ? { ...step, status: AUTOMATION_STATUS.FAIL, actual: 'safe failure' } : step),
    };
    const failure = buildAutomationFailureJson(sample, sample.scenarios[0].scenarioId);
    const absent = missing(runtimePanelSource, ['Copy JSON - Automation Fail', 'Copy JSON - All Automation Failures']);
    return failure?.type === 'KRONOX_RUNTIME_E2E_AUTOMATION_FAILURE' && failure.failedStepId && !absent.length
      ? pass('Selected/all failure copy actions produce the required sanitized failure shape.')
      : fail('Automation failure JSON export is incomplete.', { missing: absent, failure });
  }),

  makeCase('no_fake_pass_without_run', 'AUTOMATION_PASS is rejected without real browser execution evidence', () => {
    const fake = createNotRunAutomationReport('Health-test');
    fake.scenarios[0] = {
      ...fake.scenarios[0],
      status: AUTOMATION_STATUS.PASS,
      steps: fake.scenarios[0].steps.map((step) => ({ ...step, status: AUTOMATION_STATUS.PASS, durationMs: 1 })),
    };
    const normalized = normalizeRuntimeE2EReport(fake, 'Health-test');
    const status = normalized.scenarios[0].status;
    return status === AUTOMATION_STATUS.FAIL
      ? pass('A fabricated PASS without run/browser evidence is deterministically rejected.', { actual: status })
      : fail('A scenario can claim PASS without real execution evidence.', { actual: status });
  }),

  makeCase('guest_or_test_user_strategy_documented', 'Guest/test-user execution strategy is isolated and contains no hardcoded credentials', () => {
    const docs = `${HEALTH_GAP_ANALYSIS_DOC}\n${RELEASE_PROOF_CHECKLIST_DOC}\n${scenarioRegistrySource}\n${runnerSource}`;
    const absent = missing(docs, [
      'KRONOX_E2E_STORAGE_STATE',
      'completed guest',
      'isolated',
      'NOT_AUTOMATABLE',
    ]);
    const hardcodedCredential = /KRONOX_E2E_(?:USER_EMAIL|USER_PASSWORD)\s*[:=]\s*['"][^'"]+['"]/.test(docs);
    return absent.length || hardcodedCredential
      ? fail('Safe guest/test-user strategy is incomplete or credential material is hardcoded.', { missing: absent, hardcodedCredential })
      : pass('Completed guest/auth storage state is external, isolated, optional, and missing setup stays NOT_AUTOMATABLE.');
  }, [...RELATED_FILES, 'docs/KRONOX_HEALTH_GAP_ANALYSIS.md', 'docs/KRONOX_RELEASE_PROOF_CHECKLIST.md', 'src/lib/healthAlignmentDocMirrors.js']),

  makeCase('scalable_registry_not_one_off', 'Runtime E2E uses an extensible registry, handler map, harness, report model, and UI adapter', () => {
    const absent = missing(`${scenarioRegistrySource}\n${handlerSource}\n${harnessSource}\n${runnerSource}`, [
      'RUNTIME_E2E_SCENARIOS',
      'RUNTIME_E2E_SCENARIO_HANDLERS',
      'RuntimeScenarioHarness',
      'runScenario(',
      'definition.scenarioId',
    ]);
    return absent.length
      ? fail('Runtime scenarios are not fully separated into scalable registry/harness/handler layers.', { missing: absent })
      : pass('Scenario metadata, browser behavior, evidence model, and Health UI are separate extensible layers.');
  }),

  makeCase('duello_two_context_not_faked', 'Duello remains MANUAL_EXTERNAL until deterministic two-context authority evidence exists', () => {
    const duello = RUNTIME_E2E_SCENARIOS.find((item) => item.scenarioId === 'runtime_e2e.duello_two_context_runtime_sync');
    const absent = missing(`${handlerSource}\n${reportSource}`, [
      'AUTOMATION_STATUS.MANUAL_EXTERNAL',
      'No deterministic two-actor pairing and correct-claim fixture exists',
      'contextCount >= 2',
      'deterministicPairing === true',
      'deterministicClaimFixture === true',
      'singleAcceptedClaim === true',
      'snapshotReconciled === true',
    ]);
    return duello && absent.length === 0
      ? pass('Duello cannot PASS on route smoke; it requires two contexts plus deterministic authority evidence and otherwise stays MANUAL_EXTERNAL.')
      : fail('Duello two-context proof can be faked or lacks an explicit manual boundary.', { missing: absent });
  }),

  makeCase('artifacts_on_failure', 'Real scenario failures capture screenshot/trace and bounded console/network diagnostics', () => {
    const absent = missing(`${runnerSource}\n${harnessSource}`, [
      'page.screenshot',
      'context.tracing.start',
      'context.tracing.stop({ path: tracePath })',
      "page.on('console'",
      "page.on('requestfailed'",
      'test-results/health-e2e',
    ]);
    return absent.length
      ? fail('Failure artifact/log capture is incomplete.', { missing: absent })
      : pass('Failure-only screenshot/trace paths plus bounded console/network diagnostics are written to ignored test-results.');
  }),

  makeCase('preflight_exists', 'Runtime E2E V2 runs an explicit backend/app capability preflight', () => {
    const absent = missing(`${runnerSource}\n${reportSource}`, [
      'runRuntimePreflight',
      'configuredBaseUrl',
      'pageOrigin',
      'appConfigAvailable',
      'base44AppReachable',
      'serviceSummary',
    ]);
    return absent.length
      ? fail('Runtime E2E V2 preflight evidence is incomplete.', { missing: absent })
      : pass('The runner records safe app-document, app-config, backend, origin, and service preflight evidence.');
  }),

  makeCase('scenario_capabilities_declared', 'Every Runtime E2E scenario declares explicit required capabilities', () => {
    const missingDeclarations = RUNTIME_E2E_SCENARIOS
      .filter((scenario) => !Array.isArray(scenario.requiredCapabilities) || scenario.requiredCapabilities.length < 3)
      .map((scenario) => scenario.scenarioId);
    const absent = missing(`${scenarioRegistrySource}\n${capabilitySource}`, [
      'base44Backend',
      'guestBootstrap',
      'questionBootstrap',
      'soloQuestionService',
      'authenticatedStorage',
      'safeMatchmakingQueue',
      'deterministicTwoActorPairing',
      'deterministicClaimFixture',
    ]);
    return !missingDeclarations.length && !absent.length
      ? pass('All 10 scenarios declare capability-owned preflight requirements.', { scenarioCount: RUNTIME_E2E_SCENARIOS.length })
      : fail('Scenario capability declarations are incomplete.', { missingDeclarations, missing: absent });
  }),

  makeCase('app_not_found_blocks_backend_pass', 'Base44 App not found can never produce a backend-dependent PASS', () => {
    const definition = RUNTIME_E2E_SCENARIOS.find((item) => item.scenarioId === 'runtime_e2e.solo_gameplay_smoke');
    const evidence = {
      executionId: 'health-app-not-found',
      browserName: 'chromium health',
      pageOrigin: 'https://runtime.health.test',
      backendPreflight: { status: BACKEND_PREFLIGHT_STATUS.APP_NOT_FOUND },
    };
    const normalized = normalizeRuntimeE2EReport({
      runId: 'health-app-not-found',
      startedAt: new Date().toISOString(),
      finishedAt: new Date().toISOString(),
      configuredBaseUrl: 'https://runtime.health.test',
      pageOrigin: 'https://runtime.health.test',
      preflight: { status: BACKEND_PREFLIGHT_STATUS.APP_NOT_FOUND },
      executionEvidence: evidence,
      scenarios: [{
        scenarioId: definition.scenarioId,
        status: AUTOMATION_STATUS.PASS,
        executionEvidence: evidence,
        consoleErrors: ['[Base44 SDK Error] 404: App not found'],
        steps: definition.steps.map((step) => ({ ...step, status: AUTOMATION_STATUS.PASS, durationMs: 1 })),
      }],
    }, 'Health-test');
    const result = normalized.scenarios.find((item) => item.scenarioId === definition.scenarioId);
    return result?.status === AUTOMATION_STATUS.NOT_AUTOMATABLE
      && result.failureCategory === 'BACKEND_PREFLIGHT_APP_NOT_FOUND'
      && /configured Base44 app was not found/i.test(result.statusReason)
      ? pass('A fabricated backend PASS is deterministically demoted to an App-not-found setup gap.')
      : fail('Backend PASS survived an App-not-found diagnostic.', { result });
  }),

  makeCase('ui_only_pass_labeled_ui_only', 'UI-only PASS under a missing backend is explicitly browser-only', () => {
    const definition = RUNTIME_E2E_SCENARIOS.find((item) => item.scenarioId === 'runtime_e2e.bottom_nav_route_sync');
    const evidence = {
      executionId: 'health-ui-only',
      browserName: 'chromium health',
      pageOrigin: 'https://runtime.health.test',
      backendPreflight: { status: BACKEND_PREFLIGHT_STATUS.APP_NOT_FOUND },
    };
    const normalized = normalizeRuntimeE2EReport({
      runId: 'health-ui-only',
      startedAt: new Date().toISOString(),
      finishedAt: new Date().toISOString(),
      configuredBaseUrl: 'https://runtime.health.test',
      pageOrigin: 'https://runtime.health.test',
      preflight: { status: BACKEND_PREFLIGHT_STATUS.APP_NOT_FOUND },
      executionEvidence: evidence,
      scenarios: [{
        scenarioId: definition.scenarioId,
        status: AUTOMATION_STATUS.PASS,
        executionEvidence: evidence,
        steps: definition.steps.map((step) => ({ ...step, status: AUTOMATION_STATUS.PASS, durationMs: 1 })),
      }],
    }, 'Health-test');
    const result = normalized.scenarios.find((item) => item.scenarioId === definition.scenarioId);
    return result?.status === AUTOMATION_STATUS.PASS
      && result.uiOnly === true
      && result.backendDependent === false
      && result.statusReason.includes('Browser-only')
      ? pass('The UI-only PASS remains valid and explicitly disclaims backend proof.')
      : fail('UI-only PASS labeling is ambiguous.', { result });
  }),

  makeCase('solo_requires_question_bootstrap', 'Solo automation requires backend and question bootstrap capabilities', () => {
    const solo = RUNTIME_E2E_SCENARIOS.find((item) => item.scenarioId === 'runtime_e2e.solo_gameplay_smoke');
    const required = ['base44Backend', 'questionBootstrap', 'soloQuestionService'];
    const absent = required.filter((item) => !solo?.requiredCapabilities.includes(item));
    const handlerMissing = missing(handlerSource, ['safeRecovery', 'Solo question bootstrap reached a safe recovery state', '35000']);
    return !absent.length && !handlerMissing.length
      ? pass('Solo is capability-gated and waits for gameplay, safe recovery, or a bounded diagnostic failure.')
      : fail('Solo can still rely on a blind selector timeout.', { missingCapabilities: absent, missingHandlerTokens: handlerMissing });
  }),

  makeCase('solo_level_map_not_gameplay', 'Solo level map can never satisfy the gameplay-root assertion', () => {
    const solo = RUNTIME_E2E_SCENARIOS.find((item) => item.scenarioId === 'runtime_e2e.solo_gameplay_smoke');
    const rootStep = solo?.steps.find((item) => item.id === 'solo.root');
    const sourceContract = handlerSource.includes("if (route === '/game')")
      && handlerSource.includes("runtime.page.locator('[data-testid=\"solo-game-screen\"]')")
      && !String(rootStep?.selector || '').includes('solo-current-level-entry');
    return rootStep?.selector === '[data-testid="solo-game-screen"]' && sourceContract
      ? pass('The map is only an entry state; PASS still requires the dedicated gameplay root on /game.')
      : fail('The Solo level map can be mistaken for gameplay.', { rootStep, sourceContract });
  }),

  makeCase('home_solo_entry_reaches_playable_state_or_level_map', 'Home Solo entry supports direct gameplay and the canonical level-map path', () => {
    const absent = missing(handlerSource, [
      "entryPath = 'direct_game'",
      "entryPath = 'level_map'",
      "await expectPath(runtime.page, '/game'",
      "await expectPath(runtime.page, '/solo'",
    ]);
    return absent.length === 0
      ? pass('Home OYNA accepts either documented entry path without treating either path as final gameplay proof.')
      : fail('Home Solo entry-path handling is incomplete.', { missing: absent });
  }),

  makeCase('solo_current_level_click_reaches_game_or_precise_setup_gap', 'Current Solo level click deterministically commits gameplay or reports a precise gap', () => {
    const absent = missing(`${handlerSource}\n${soloLevelMapSource}\n${soloChallengeSource}`, [
      'data-solo-level-number',
      'data-solo-level-playable',
      'scrollIntoViewIfNeeded',
      'SOLO_CURRENT_LEVEL_NOT_PLAYABLE',
      'The visible current Solo level entry did not commit /game.',
      'isFocusedFrontier',
      'if (!level.isPlayable && !isFocusedFrontier) return',
    ]);
    return absent.length === 0
      ? pass('The current map node exposes stable metadata, is scrolled into view, and must commit /game after click.')
      : fail('The current Solo level click remains ambiguous.', { missing: absent });
  }),

  makeCase('solo_current_level_entry_click_is_deterministic', 'Solo current-level selector is stable and playability-aware', () => {
    const absent = missing(`${handlerSource}\n${soloLevelMapSource}`, [
      'data-testid="solo-current-level-entry"',
      'data-solo-level-playable="true"',
      "runtime.page.locator('[data-testid=\"solo-current-level-entry\"]')",
    ]);
    return absent.length === 0
      ? pass('The harness targets exactly the current node and reads its explicit playability metadata.')
      : fail('Solo current-level selection can drift to a locked or unrelated node.', { missing: absent });
  }),

  makeCase('solo_gameplay_root_required_for_pass', 'Solo PASS requires the real game route and gameplay root', () => {
    const absent = missing(`${handlerSource}\n${scenarioRegistrySource}`, [
      "await expectPath(runtime.page, '/game'",
      '[data-testid="solo-game-screen"]',
      '[data-testid="solo-question-area"]',
      'solo.interaction_target',
    ]);
    return absent.length === 0
      ? pass('A level-map click alone cannot pass; route, gameplay root, question area, and interaction target remain required.')
      : fail('Solo PASS can bypass a real gameplay root.', { missing: absent });
  }),

  makeCase('solo_question_bootstrap_failure_classified', 'Solo question bootstrap failure becomes a precise setup classification', () => {
    const absent = missing(handlerSource, [
      'SOLO_QUESTION_BOOTSTRAP_UNAVAILABLE',
      'question-service request was observed',
      'no classified question-service request was observed',
      'Solo question bootstrap reached a safe recovery state',
    ]);
    return absent.length === 0
      ? pass('Safe recovery, missing request, and missing successful response are reported as explicit bootstrap gaps.')
      : fail('Solo question bootstrap can still collapse into an opaque selector timeout.', { missing: absent });
  }),

  makeCase('solo_question_bootstrap_failure_is_classified', 'Solo bootstrap recovery is not mislabeled as gameplay failure', () => (
    handlerSource.includes("'SOLO_QUESTION_BOOTSTRAP_UNAVAILABLE'")
      ? pass('Missing question data is classified as NOT_AUTOMATABLE setup evidence, not a fabricated gameplay PASS.')
      : fail('Solo bootstrap recovery lacks its required setup-gap category.')
  )),

  makeCase('solo_no_raw_error_or_permission_text', 'Solo runtime proof rejects raw backend and permission text in public UI', () => {
    const absent = missing(`${handlerSource}\n${harnessSource}`, [
      'await assertPublicTextSafe(runtime.page)',
      'permission denied',
      '\\bforbidden\\b',
      '(?:status(?: code)?|http)\\s*403',
    ]);
    return absent.length === 0
      ? pass('Solo gameplay and recovery paths pass through the shared private/raw-error UI guard.')
      : fail('Solo public UI can expose raw backend permission details.', { missing: absent });
  }),

  makeCase('online_requires_authenticated_storage_or_guest_policy', 'Online automation requires authenticated storage and an explicit safe queue gate', () => {
    const online = RUNTIME_E2E_SCENARIOS.find((item) => item.scenarioId === 'runtime_e2e.online_random_waiting_cancel_smoke');
    const required = ['authenticatedStorage', 'onlineMatchmaking', 'safeMatchmakingQueue'];
    const absent = required.filter((item) => !online?.requiredCapabilities.includes(item));
    return !absent.length && runnerSource.includes('KRONOX_E2E_ALLOW_MATCHMAKING')
      ? pass('Online cannot run from labels alone; actor storage and queue mutation are explicit gates.')
      : fail('Online actor/matchmaking setup gate drifted.', { missing: absent });
  }),

  makeCase('duello_two_context_requires_real_pairing', 'Duello two-context proof requires real pairing and claim fixtures', () => {
    const duello = RUNTIME_E2E_SCENARIOS.find((item) => item.scenarioId === 'runtime_e2e.duello_two_context_runtime_sync');
    const required = ['twoBrowserContexts', 'twoIsolatedActors', 'deterministicTwoActorPairing', 'deterministicClaimFixture'];
    const absent = required.filter((item) => !duello?.requiredCapabilities.includes(item));
    return !absent.length && handlerSource.includes('AUTOMATION_STATUS.MANUAL_EXTERNAL')
      ? pass('Duello remains manual/external until two real actors, deterministic pairing, and claim proof exist.')
      : fail('Duello can be promoted without real two-actor authority evidence.', { missing: absent });
  }),

  makeCase('console_error_classifier_exists', 'Critical Base44 console/config errors have a safe classifier', () => {
    const classified = classifyRuntimeDiagnostic('User auth check failed: Base44Error: App not found');
    const absent = missing(reportSource, ['RUNTIME_DIAGNOSTIC_CATEGORY', 'ACTOR_BOOTSTRAP_CONFIG_FAILURE', 'summarizeRuntimeConsoleErrors']);
    return classified.critical === true && !absent.length
      ? pass('App-not-found and actor-bootstrap config errors become critical safe summaries.')
      : fail('Critical runtime diagnostic classification is incomplete.', { classified, missing: absent });
  }),

  makeCase('report_includes_preflight_and_capabilities', 'Runtime report V2 includes preflight and capability evidence', () => {
    const report = createNotRunAutomationReport('Health-test');
    const required = [
      'preflight',
      'environment',
      'capabilitySummary',
      'configuredBaseUrl',
      'pageOrigin',
      'targetKind',
      'productionCustomDomainMode',
      'directBackendPreflightStatus',
      'runtimeBackendProbeStatus',
      'preflightStatusReason',
      'serviceSummary',
      'serviceSummaryUnavailableReason',
      'backendProofLevel',
      'homeVisible',
      'authenticatedOrStoredSession',
      'canRunRuntimeProbes',
      'preflightLimitations',
      'backendAvailable',
      'appConfigAvailable',
      'base44AppReachable',
    ];
    const absent = required.filter((key) => !(key in report));
    const scenarioAbsent = [
      'requiredCapabilities',
      'capabilityStatus',
      'backendDependent',
      'uiOnly',
      'preflightDecision',
      'proofLevel',
      'backendEvidence',
      'preflightDependency',
      'blockReason',
      'statusReason',
      'safeSetupInstructions',
    ]
      .filter((key) => !(key in report.scenarios[0]));
    return report.version === 2 && !absent.length && !scenarioAbsent.length
      ? pass('Top-level and per-scenario V2 proof fields are present.')
      : fail('Runtime report V2 schema is incomplete.', { missingTopLevel: absent, missingScenario: scenarioAbsent });
  }),

  makeCase('base_url_origin_is_meaningful', 'Runtime report records absolute configured URL and page origin', () => {
    const normalized = normalizeRuntimeE2EReport({
      configuredBaseUrl: 'https://runtime.health.test/app?private=value',
      pageOrigin: 'https://runtime.health.test',
    }, 'Health-test');
    return normalized.configuredBaseUrl === 'https://runtime.health.test/app'
      && normalized.pageOrigin === 'https://runtime.health.test/'
      && normalized.pageOrigin !== '/'
      ? pass('URL evidence preserves a meaningful sanitized origin/path instead of collapsing to slash.')
      : fail('URL/origin evidence is not meaningful.', { configuredBaseUrl: normalized.configuredBaseUrl, pageOrigin: normalized.pageOrigin });
  }),

  makeCase('setup_gap_json_copy_exists', 'Setup-gap and failure JSON are copyable from Runtime E2E UI', () => {
    const sample = createNotRunAutomationReport('Health-test');
    sample.runId = 'health-setup-gap';
    sample.scenarios[0] = {
      ...sample.scenarios[0],
      status: AUTOMATION_STATUS.NOT_AUTOMATABLE,
      failureCategory: 'AUTOMATION_SETUP_GAP',
    };
    const payload = buildAllAutomationSetupGapsJson(sample);
    const absent = missing(runtimePanelSource, [
      'Copy JSON - Automation Fail',
      'Copy JSON - Setup Gap',
      'Copy JSON - Full Automation Report',
    ]);
    return payload.setupGaps.length === 1 && !absent.length
      ? pass('Health UI exports selected failures/setup gaps, all setup gaps, and the full sanitized report.')
      : fail('Setup-gap JSON copy contract is incomplete.', { missing: absent, payload });
  }),

  makeCase('production_target_classified', 'Production custom-domain targets are classified separately from local and Base44 preview targets', () => {
    const production = classifyRuntimeE2ETarget('https://kronoxgame.com/');
    const local = classifyRuntimeE2ETarget('http://127.0.0.1:4174/');
    const preview = classifyRuntimeE2ETarget('https://sample.base44.app/');
    return production === RUNTIME_E2E_TARGET_KIND.PRODUCTION_CUSTOM_DOMAIN
      && local === RUNTIME_E2E_TARGET_KIND.LOCAL_DEV
      && preview === RUNTIME_E2E_TARGET_KIND.BASE44_PREVIEW
      ? pass('Production, local-dev, and Base44 preview targets resolve to distinct target kinds.')
      : fail('Runtime target-kind classification drifted.', { production, local, preview });
  }),

  makeCase('preflight_unknown_not_final_for_prod', 'Production custom-domain preflight never ends at generic UNKNOWN when a specific state applies', () => {
    const withoutProbe = resolveRuntimePreflightStatus({
      productionCustomDomainMode: true,
      directBackendPreflightStatus: BACKEND_PREFLIGHT_STATUS.UNKNOWN,
      canRunRuntimeProbes: false,
    });
    const withProbe = resolveRuntimePreflightStatus({
      productionCustomDomainMode: true,
      directBackendPreflightStatus: BACKEND_PREFLIGHT_STATUS.UNKNOWN,
      canRunRuntimeProbes: true,
    });
    return withoutProbe === BACKEND_PREFLIGHT_STATUS.PROD_CUSTOM_DOMAIN_PREFLIGHT_UNSUPPORTED
      && withProbe === BACKEND_PREFLIGHT_STATUS.PROD_RUNTIME_PROBE_REQUIRED
      ? pass('Generic production UNKNOWN becomes an explicit direct-preflight limitation or runtime-probe requirement.')
      : fail('Production preflight can still dead-end at UNKNOWN.', { withoutProbe, withProbe });
  }),

  makeCase('prod_custom_domain_prefight_limitation_explicit', 'Production custom-domain direct-preflight limitations are explicit in report output', () => {
    const absent = missing(`${runnerSource}\n${reportSource}`, [
      'PROD_CUSTOM_DOMAIN_PREFLIGHT_UNSUPPORTED',
      'PROD_RUNTIME_PROBE_REQUIRED',
      'directBackendPreflightStatus',
      'preflightLimitations',
      'Production custom domains may proxy backend traffic through the app origin',
    ]);
    return absent.length === 0
      ? pass('The report separates direct custom-domain limitations from runtime-probe eligibility.')
      : fail('Production preflight limitations are not explicit.', { missing: absent });
  }),

  makeCase('runtime_probe_allowed_when_prod_preflight_unsupported', 'Safe scenarios may run runtime probes when direct production preflight is unsupported', () => {
    const capabilitySummary = buildRuntimeCapabilitySummary({
      browserAvailable: true,
      preflight: {
        status: BACKEND_PREFLIGHT_STATUS.PROD_RUNTIME_PROBE_REQUIRED,
        documentLoaded: true,
        appConfigAvailable: true,
        guestBootstrapAvailable: true,
        canRunRuntimeProbes: true,
      },
      environment: {
        hasStorageState: true,
        hasStorageStateA: false,
        hasStorageStateB: false,
        allowMatchmaking: false,
      },
    });
    const leaderboard = RUNTIME_E2E_SCENARIOS.find((item) => item.scenarioId === 'runtime_e2e.leaderboard_smoke_privacy');
    const decision = evaluateScenarioCapabilities(leaderboard, capabilitySummary);
    return capabilitySummary.base44Backend.status === RUNTIME_E2E_CAPABILITY_STATUS.PROBE_REQUIRED
      && decision.canRun === true
      && decision.decision === 'RUN_WITH_RUNTIME_PROBES'
      ? pass('A production custom-domain scenario can execute while still owing scenario-level backend evidence.')
      : fail('Direct-preflight limitations still block all safe production runtime probes.', { decision, capabilitySummary });
  }),

  makeCase('backend_pass_requires_runtime_evidence', 'Backend-dependent PASS requires successful scenario-level runtime evidence', () => {
    const definition = RUNTIME_E2E_SCENARIOS.find((item) => item.scenarioId === 'runtime_e2e.leaderboard_smoke_privacy');
    const evidence = {
      executionId: 'health-runtime-evidence-gate',
      browserName: 'chromium health',
      configuredBaseUrl: 'https://kronoxgame.com',
      pageOrigin: 'https://kronoxgame.com',
      baseUrlOrigin: 'https://kronoxgame.com',
      backendPreflight: { status: BACKEND_PREFLIGHT_STATUS.PROD_RUNTIME_PROBE_REQUIRED },
    };
    const normalized = normalizeRuntimeE2EReport({
      runId: 'health-runtime-evidence-gate',
      startedAt: new Date().toISOString(),
      finishedAt: new Date().toISOString(),
      targetKind: RUNTIME_E2E_TARGET_KIND.PRODUCTION_CUSTOM_DOMAIN,
      productionCustomDomainMode: true,
      configuredBaseUrl: 'https://kronoxgame.com',
      pageOrigin: 'https://kronoxgame.com',
      preflight: {
        status: BACKEND_PREFLIGHT_STATUS.PROD_RUNTIME_PROBE_REQUIRED,
        directBackendPreflightStatus: BACKEND_PREFLIGHT_STATUS.PROD_CUSTOM_DOMAIN_PREFLIGHT_UNSUPPORTED,
        canRunRuntimeProbes: true,
      },
      executionEvidence: evidence,
      scenarios: [{
        scenarioId: definition.scenarioId,
        status: AUTOMATION_STATUS.PASS,
        proofLevel: RUNTIME_E2E_PROOF_LEVEL.BACKEND_RUNTIME_PROBE,
        backendEvidence: { observed: false, successful: false, category: null, statusClass: null, safeSummary: 'No classified backend response was observed.' },
        preflightDependency: RUNTIME_E2E_PREFLIGHT_DEPENDENCY.RUNTIME_PROBE,
        executionEvidence: evidence,
        steps: definition.steps.map((step) => ({ ...step, status: AUTOMATION_STATUS.PASS, durationMs: 1 })),
      }],
    }, 'Health-test');
    const result = normalized.scenarios.find((item) => item.scenarioId === definition.scenarioId);
    return result?.status === AUTOMATION_STATUS.NOT_AUTOMATABLE
      && result?.failureCategory === 'BACKEND_RUNTIME_PROBE_NOT_OBSERVED'
      ? pass('A forged backend PASS without successful runtime traffic is demoted to an explicit setup gap.')
      : fail('Backend PASS survived without scenario runtime evidence.', { result });
  }),

  makeCase('ui_only_pass_not_backendproof', 'UI-only PASS is labeled UI_ONLY and cannot become backend proof', () => {
    const definition = RUNTIME_E2E_SCENARIOS.find((item) => item.scenarioId === 'runtime_e2e.bottom_nav_route_sync');
    const evidence = {
      executionId: 'health-ui-proof-level',
      browserName: 'chromium health',
      pageOrigin: 'https://kronoxgame.com',
      baseUrlOrigin: 'https://kronoxgame.com',
    };
    const normalized = normalizeRuntimeE2EReport({
      runId: 'health-ui-proof-level',
      startedAt: new Date().toISOString(),
      finishedAt: new Date().toISOString(),
      configuredBaseUrl: 'https://kronoxgame.com',
      pageOrigin: 'https://kronoxgame.com',
      backendAvailable: false,
      executionEvidence: evidence,
      scenarios: [{
        scenarioId: definition.scenarioId,
        status: AUTOMATION_STATUS.PASS,
        proofLevel: RUNTIME_E2E_PROOF_LEVEL.UI_ONLY,
        preflightDependency: RUNTIME_E2E_PREFLIGHT_DEPENDENCY.NOT_REQUIRED,
        executionEvidence: evidence,
        steps: definition.steps.map((step) => ({ ...step, status: AUTOMATION_STATUS.PASS, durationMs: 1 })),
      }],
    }, 'Health-test');
    const result = normalized.scenarios.find((item) => item.scenarioId === definition.scenarioId);
    return result?.status === AUTOMATION_STATUS.PASS
      && result?.proofLevel === RUNTIME_E2E_PROOF_LEVEL.UI_ONLY
      && result?.backendDependent === false
      ? pass('UI-only browser proof remains valid without being presented as backend-connected proof.')
      : fail('UI-only proof was promoted or rejected incorrectly.', { result });
  }),

  makeCase('service_summary_not_empty_or_explained', 'Service summary is populated with safe categories or carries an explicit unavailable reason', () => {
    const summary = {};
    const category = classifyRuntimeServiceRequest(
      'https://kronoxgame.com/api/functions/getUnifiedLeaderboard?token=secret',
      'https://kronoxgame.com',
      'fetch',
    );
    recordRuntimeServiceObservation(summary, category, 'REQUEST');
    recordRuntimeServiceObservation(summary, category, 'RESPONSE', 200);
    const emptyReason = runtimeServiceSummaryUnavailableReason({});
    const populatedReason = runtimeServiceSummaryUnavailableReason(summary);
    return category === 'leaderboard'
      && summary.leaderboard?.statusClasses?.['2xx'] === 1
      && /No classified backend requests observed/.test(emptyReason || '')
      && populatedReason === null
      ? pass('Service traffic is summarized by category/status only, and empty observation windows explain themselves.')
      : fail('Service summary can remain empty or ambiguous.', { category, summary, emptyReason, populatedReason });
  }),

  makeCase('console_error_categories_are_safe', 'Console errors are categorized and fingerprinted without retaining secrets or raw identity data', () => {
    const classified = classifyRuntimeDiagnostic('CORS blocked backend request token=top-secret owner_key=private user@example.com');
    const serialized = JSON.stringify(classified);
    const criticalExamples = [
      '[Base44 SDK Error] request failed',
      'User auth check failed',
      'Unhandled promise rejection',
      'TypeError: hidden detail\n    at run (/app.js:1:2)',
      'backend returned 503',
      'permission denied by RLS',
      'function call failed',
    ].map((message) => classifyRuntimeDiagnostic(message));
    const browserNoise = classifyRuntimeDiagnostic('chrome-extension://sample devtools message');
    return classified.category === 'BACKEND_CORS_BLOCKED'
      && classified.critical === true
      && /^diag-[a-f0-9]{8}$/.test(classified.fingerprint)
      && criticalExamples.every((item) => item.critical === true && /^diag-[a-f0-9]{8}$/.test(item.fingerprint))
      && browserNoise.category === 'BROWSER_EXTENSION_NOISE'
      && browserNoise.critical === false
      && !serialized.includes('top-secret')
      && !serialized.includes('private')
      && !serialized.includes('user@example.com')
      ? pass('Critical browser errors retain only safe category, summary, action, and fingerprint evidence.')
      : fail('Safe console classification leaked raw diagnostic material or lost severity.', { classified });
  }),

  makeCase('permission_denied_has_safe_diagnostic', 'Permission-denied evidence includes only safe correlation fields', () => {
    const diagnostic = buildRuntimePermissionDiagnostic({
      scenarioId: 'runtime_e2e.profile_navigation_privacy',
      requestUrl: 'https://runtime.health.test/api/entities/UserPresence?owner_key=private&token=top-secret',
      configuredBaseUrl: 'https://runtime.health.test',
      resourceType: 'fetch',
      method: 'GET',
      status: 403,
    });
    const serialized = JSON.stringify(diagnostic);
    const required = ['scenario', 'serviceCategory', 'statusClass', 'endpointCategory', 'actionLabel', 'fingerprint'];
    const absent = required.filter((key) => !diagnostic[key]);
    return diagnostic.diagnosticCategory === RUNTIME_DIAGNOSTIC_CATEGORY.BACKEND_PERMISSION_DENIED
      && diagnostic.critical === true
      && diagnostic.statusClass === '4xx'
      && diagnostic.endpointCategory === 'presence_entity'
      && absent.length === 0
      && !serialized.includes('top-secret')
      && !serialized.includes('private')
      && !serialized.includes('owner_key')
      ? pass('Permission diagnostics retain scenario/category/status/action/fingerprint without URL, identity, or credential material.')
      : fail('Permission diagnostic evidence is incomplete or unsafe.', { diagnostic, missing: absent });
  }),

  makeCase('permission_denied_not_blanket_ignored', 'Permission-denied remains a critical diagnostic unless separately resolved', () => {
    const diagnostic = classifyRuntimeDiagnostic('request failed with status 403: permission denied by RLS');
    return diagnostic.category === RUNTIME_DIAGNOSTIC_CATEGORY.BACKEND_PERMISSION_DENIED
      && diagnostic.critical === true
      && reportSource.includes('buildRuntimePermissionDiagnostic')
      ? pass('The classifier still blocks on permission/RLS denial while safe response correlation adds detail.')
      : fail('Permission denial was hidden or blanket-downgraded.', { diagnostic });
  }),

  makeCase('permission_denied_not_hidden', 'Permission-denied evidence remains visible in the runtime report', () => {
    const absent = missing(`${runnerSource}\n${harnessSource}\n${reportSource}`, [
      'permissionDiagnostics',
      'BACKEND_PERMISSION_DENIED',
      'response.status() === 403',
    ]);
    return absent.length === 0
      ? pass('Preflight and each scenario retain bounded permission diagnostics alongside critical console classification.')
      : fail('Permission-denied evidence can disappear from runtime output.', { missing: absent });
  }),

  makeCase('optional_permission_denied_not_release_blocker_only_if_proven_optional', 'Permission-denied is never optional without explicit proof', () => {
    const diagnostic = classifyRuntimeDiagnostic('403 forbidden');
    const noOptionalDowngrade = !reportSource.includes('BACKEND_PERMISSION_DENIED, critical: false')
      && !reportSource.includes("category === RUNTIME_DIAGNOSTIC_CATEGORY.BACKEND_PERMISSION_DENIED && false");
    return diagnostic.critical === true && noOptionalDowngrade
      ? pass('No generic optional-request exemption weakens permission-denied severity.')
      : fail('Permission-denied can be downgraded without explicit optional-request proof.', { diagnostic, noOptionalDowngrade });
  }),

  makeCase('public_ui_no_raw_permission_error', 'Public runtime screens reject raw permission/RLS transport text', () => {
    const absent = missing(harnessSource, [
      'permission denied',
      'row.level security',
      '\\bforbidden\\b',
      '(?:status(?: code)?|http)\\s*403',
    ]);
    return absent.length === 0
      ? pass('The shared public-text assertion rejects raw permission, RLS, forbidden, and HTTP 403 transport strings.')
      : fail('Public screens can expose raw permission failures.', { missing: absent });
  }),

  makeCase('backend_permission_denied_does_not_leak_private_identity', 'Permission diagnostics omit private identity and request URLs', () => {
    const diagnostic = buildRuntimePermissionDiagnostic({
      scenarioId: 'runtime_e2e.online_random_waiting_cancel_smoke',
      requestUrl: 'https://runtime.health.test/api/functions/randomMatchmaking?guest_id=private-id&guest_token=secret-token',
      configuredBaseUrl: 'https://runtime.health.test',
      resourceType: 'fetch',
      method: 'POST',
      status: 403,
    });
    const serialized = JSON.stringify(diagnostic);
    return !('requestUrl' in diagnostic)
      && !serialized.includes('private-id')
      && !serialized.includes('secret-token')
      && diagnostic.endpointCategory === 'online_matchmaking'
      ? pass('Permission correlation exports only allowlisted categories and a redacted fingerprint.')
      : fail('Permission correlation leaked a URL or private actor proof.', { diagnostic });
  }),

  makeCase('auth_storage_files_gitignored', '.auth, environment, and generated storage-state files are excluded from source control', () => {
    const protectedPatterns = [
      '/.auth/',
      '**/.auth/',
      '**/*storage-state*.json',
      '.env.*',
    ];
    const absent = missing(gitignoreSource, protectedPatterns);
    return absent.length === 0
      ? pass('Authentication fixtures, storage-state exports, and local environment files are covered by repository ignore rules.')
      : fail('Sensitive Runtime E2E fixture ignore coverage is incomplete.', { missing: absent });
  }, [...RELATED_FILES, '.gitignore']),

  makeCase('prod_online_gate_respects_allow_matchmaking', 'Production Online runtime probe honors the explicit matchmaking gate and still requires backend evidence', () => {
    const online = RUNTIME_E2E_SCENARIOS.find((item) => item.scenarioId === 'runtime_e2e.online_random_waiting_cancel_smoke');
    const makeSummary = (allowMatchmaking) => buildRuntimeCapabilitySummary({
      browserAvailable: true,
      preflight: {
        status: BACKEND_PREFLIGHT_STATUS.PROD_RUNTIME_PROBE_REQUIRED,
        documentLoaded: true,
        appConfigAvailable: true,
        guestBootstrapAvailable: true,
        canRunRuntimeProbes: true,
      },
      environment: {
        hasStorageState: true,
        hasStorageStateA: false,
        hasStorageStateB: false,
        allowMatchmaking,
      },
    });
    const allowed = evaluateScenarioCapabilities(online, makeSummary(true));
    const denied = evaluateScenarioCapabilities(online, makeSummary(false));
    const sourceContract = runnerSource.includes('config.canRunBackendProbe')
      && handlerSource.includes('config.allowMatchmaking')
      && reportSource.includes('BACKEND_RUNTIME_PROBE_NOT_OBSERVED');
    return allowed.canRun === true && allowed.decision === 'RUN_WITH_RUNTIME_PROBES'
      && denied.canRun === false && sourceContract
      ? pass('Online queue probing requires the explicit gate, and route success alone cannot satisfy backend proof.')
      : fail('Production Online gate/evidence ownership drifted.', { allowed, denied, sourceContract });
  }),

  makeCase('online_runtime_evidence_missing_has_precise_reason', 'Online request-without-response receives a precise evidence classification', () => {
    const definition = RUNTIME_E2E_SCENARIOS.find((item) => item.scenarioId === 'runtime_e2e.online_random_waiting_cancel_smoke');
    const evidence = {
      executionId: 'health-online-no-response',
      browserName: 'chromium health',
      pageOrigin: 'https://runtime.health.test',
      baseUrlOrigin: 'https://runtime.health.test',
      backendPreflight: { status: BACKEND_PREFLIGHT_STATUS.REACHABLE },
    };
    const backendEvidence = summarizeRuntimeBackendEvidence({
      online_matchmaking: { requests: 1, responses: 0, failures: 0, statusClasses: {} },
    }, ['online_matchmaking']);
    const normalized = normalizeRuntimeE2EReport({
      runId: 'health-online-no-response',
      startedAt: new Date().toISOString(),
      finishedAt: new Date().toISOString(),
      configuredBaseUrl: 'https://runtime.health.test',
      pageOrigin: 'https://runtime.health.test',
      preflight: { status: BACKEND_PREFLIGHT_STATUS.REACHABLE },
      executionEvidence: evidence,
      scenarios: [{
        scenarioId: definition.scenarioId,
        status: AUTOMATION_STATUS.PASS,
        backendEvidence,
        executionEvidence: evidence,
        steps: definition.steps.map((step) => ({ ...step, status: AUTOMATION_STATUS.PASS, durationMs: 1 })),
      }],
    }, 'Health-test');
    const result = normalized.scenarios.find((item) => item.scenarioId === definition.scenarioId);
    return backendEvidence.observed === true
      && backendEvidence.statusClass === 'no_response'
      && result?.status === AUTOMATION_STATUS.NOT_AUTOMATABLE
      && result?.failureCategory === 'BACKEND_RUNTIME_RESPONSE_NOT_OBSERVED'
      ? pass('Request-only matchmaking evidence is preserved and demoted with an exact no-response reason.')
      : fail('Online request-only evidence remains ambiguous or can PASS.', { backendEvidence, result });
  }),

  makeCase('online_route_alone_cannot_pass', 'Online /lobby rendering alone cannot become matchmaking proof', () => {
    const definition = RUNTIME_E2E_SCENARIOS.find((item) => item.scenarioId === 'runtime_e2e.online_random_waiting_cancel_smoke');
    const evidence = {
      executionId: 'health-online-route-only',
      browserName: 'chromium health',
      pageOrigin: 'https://runtime.health.test',
      baseUrlOrigin: 'https://runtime.health.test',
      backendPreflight: { status: BACKEND_PREFLIGHT_STATUS.REACHABLE },
    };
    const normalized = normalizeRuntimeE2EReport({
      runId: 'health-online-route-only',
      startedAt: new Date().toISOString(),
      finishedAt: new Date().toISOString(),
      configuredBaseUrl: 'https://runtime.health.test',
      pageOrigin: 'https://runtime.health.test',
      preflight: { status: BACKEND_PREFLIGHT_STATUS.REACHABLE },
      executionEvidence: evidence,
      scenarios: [{
        scenarioId: definition.scenarioId,
        status: AUTOMATION_STATUS.PASS,
        backendEvidence: summarizeRuntimeBackendEvidence(),
        executionEvidence: evidence,
        steps: definition.steps.map((step) => ({ ...step, status: AUTOMATION_STATUS.PASS, durationMs: 1, route: '/lobby' })),
      }],
    }, 'Health-test');
    const result = normalized.scenarios.find((item) => item.scenarioId === definition.scenarioId);
    return result?.status === AUTOMATION_STATUS.NOT_AUTOMATABLE
      && result?.failureCategory === 'BACKEND_RUNTIME_EVIDENCE_MISSING'
      ? pass('A fully rendered /lobby route is demoted when no matchmaking response proves backend activity.')
      : fail('Online route rendering was accepted as backend matchmaking proof.', { result });
  }),

  makeCase('online_safe_gate_does_not_bypass_backend_proof', 'Safe matchmaking mutation gate cannot bypass response evidence', () => {
    const absent = missing(`${handlerSource}\n${reportSource}`, [
      'config.allowMatchmaking',
      'waitForServiceOutcome',
      'ONLINE_MATCHMAKING_REQUEST_NOT_OBSERVED',
      'ONLINE_MATCHMAKING_RESPONSE_NOT_OBSERVED',
      'BACKEND_RUNTIME_RESPONSE_NOT_OBSERVED',
    ]);
    return absent.length === 0
      ? pass('The mutation gate permits the probe only; PASS still needs a successful classified backend response.')
      : fail('The safe gate can be confused with backend proof.', { missing: absent });
  }),

  makeCase('duello_two_context_still_manual_without_two_actors', 'Duello two-context remains MANUAL_EXTERNAL without two actors and deterministic fixtures', () => {
    const duello = RUNTIME_E2E_SCENARIOS.find((item) => item.scenarioId === 'runtime_e2e.duello_two_context_runtime_sync');
    const capabilitySummary = buildRuntimeCapabilitySummary({
      browserAvailable: true,
      preflight: {
        status: BACKEND_PREFLIGHT_STATUS.PROD_RUNTIME_PROBE_REQUIRED,
        documentLoaded: true,
        appConfigAvailable: true,
        canRunRuntimeProbes: true,
      },
      environment: {
        hasStorageState: true,
        hasStorageStateA: false,
        hasStorageStateB: false,
      },
    });
    const decision = evaluateScenarioCapabilities(duello, capabilitySummary);
    return decision.canRun === false
      && decision.status === AUTOMATION_STATUS.MANUAL_EXTERNAL
      && decision.decision === 'MANUAL_EXTERNAL_REQUIRED'
      ? pass('Production preflight changes do not promote Duello without two isolated actors and deterministic authority fixtures.')
      : fail('Duello manual/external boundary was weakened.', { decision });
  }),

  makeCase('full_run_still_excludes_e2e', 'Full Health Run still excludes Runtime E2E automation', () => {
    const absent = missing(simulationPanelSource, [
      'const DISPLAY_SUITES = [...SUITES, RUNTIME_E2E_SUITE]',
      "const runAll = () => runPack('full')",
      'if (runtimeAutomationSelected) return',
    ]);
    return RUNTIME_E2E_SUITE.fullRunExcluded === true && !absent.length
      ? pass('Runtime browser automation remains a separate report and cannot enter Full Run counts.')
      : fail('Full Run/E2E separation drifted.', { missing: absent });
  }),
];
