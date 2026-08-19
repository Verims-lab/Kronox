import packageSource from '../../../package.json?raw';
import runnerSource from '../../../scripts/run-health-e2e.mjs?raw';
import handlerSource from '../../../tests/health-e2e/scenarioHandlers.mjs?raw';
import harnessSource from '../../../tests/health-e2e/runtimeHarness.mjs?raw';
import simulationPanelSource from './SimulationPanel.jsx?raw';
import runtimePanelSource from './health/RuntimeE2EAutomationPanel.jsx?raw';
import reportSource from '../../lib/health/runtimeE2EReport.js?raw';
import capabilitySource from '../../lib/health/runtimeE2ECapabilities.js?raw';
import scenarioRegistrySource from '../../lib/health/runtimeE2EScenarios.js?raw';
import { HEALTH_GAP_ANALYSIS_DOC, RELEASE_PROOF_CHECKLIST_DOC } from '@/lib/healthAlignmentDocMirrors';
import {
  AUTOMATION_STATUS,
  BACKEND_PREFLIGHT_STATUS,
  buildAllAutomationSetupGapsJson,
  buildAutomationFailureJson,
  classifyRuntimeDiagnostic,
  createNotRunAutomationReport,
  normalizeRuntimeE2EReport,
} from '@/lib/health/runtimeE2EReport';
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
    const required = ['preflight', 'environment', 'capabilitySummary', 'configuredBaseUrl', 'pageOrigin', 'backendAvailable', 'appConfigAvailable', 'base44AppReachable'];
    const absent = required.filter((key) => !(key in report));
    const scenarioAbsent = ['requiredCapabilities', 'capabilityStatus', 'backendDependent', 'uiOnly', 'preflightDecision', 'statusReason', 'safeSetupInstructions']
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
