import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  AUTOMATION_STATUS,
  BACKEND_PREFLIGHT_STATUS,
  RUNTIME_E2E_PREFLIGHT_DEPENDENCY,
  RUNTIME_E2E_PROOF_LEVEL,
  buildAllAutomationFailuresJson,
  buildAllAutomationSetupGapsJson,
  buildAutomationFailureJson,
  buildRuntimePermissionDiagnostic,
  classifyRuntimeDiagnostic,
  classifyRuntimeServiceAction,
  classifyRuntimeServiceRequest,
  correlateRuntimeConsoleErrors,
  createNotRunAutomationReport,
  normalizeRuntimeE2EReport,
  recordRuntimeServiceObservation,
  resolveRuntimePreflightStatus,
  runtimeServiceSummaryUnavailableReason,
  sanitizeAutomationValue,
  isOptionalRuntimeActivityRequest,
  RUNTIME_SERVICE_ACTION,
} from '../src/lib/health/runtimeE2EReport.js';
import {
  buildRuntimeCapabilitySummary,
  classifyRuntimeE2ETarget,
  evaluateScenarioCapabilities,
  RUNTIME_E2E_CAPABILITY_STATUS,
  RUNTIME_E2E_TARGET_KIND,
} from '../src/lib/health/runtimeE2ECapabilities.js';
import {
  RUNTIME_E2E_EXECUTION_SCOPE,
  RUNTIME_E2E_SCENARIOS,
  RUNTIME_E2E_SUITE,
  RUNTIME_E2E_SUITE_ID,
} from '../src/lib/health/runtimeE2EScenarios.js';
import { RUNTIME_E2E_SCENARIO_HANDLERS } from '../tests/health-e2e/scenarioHandlers.mjs';
import {
  SOLO_EXIT_FAILURE_CATEGORY,
  classifySoloExitFailure,
  createSoloExitRuntimeEvidence,
} from '../src/lib/health/soloExitRuntimeEvidence.js';

assert.equal(RUNTIME_E2E_SUITE.id, RUNTIME_E2E_SUITE_ID);
assert.equal(RUNTIME_E2E_SUITE.externalAutomation, true);
assert.equal(RUNTIME_E2E_SCENARIOS.length, 10);
assert.equal(new Set(RUNTIME_E2E_SCENARIOS.map((item) => item.scenarioId)).size, 10);

for (const scenario of RUNTIME_E2E_SCENARIOS) {
  assert.equal(typeof RUNTIME_E2E_SCENARIO_HANDLERS[scenario.scenarioId], 'function');
  assert.ok(scenario.steps.length > 0);
  assert.ok(scenario.requiredCapabilities.length >= 3);
  assert.ok(Object.values(RUNTIME_E2E_EXECUTION_SCOPE).includes(scenario.executionScope));
}

const actionableSoloExit = {
  ...createSoloExitRuntimeEvidence('/'),
  backButtonPresent: true,
  backButtonVisible: true,
  backButtonEnabled: true,
  backButtonBoundingBox: { x: 16, y: 100, width: 44, height: 44 },
  backButtonCount: 1,
  pointerEventsOnBackButton: 'auto',
};
assert.equal(classifySoloExitFailure(actionableSoloExit), null);
assert.equal(
  classifySoloExitFailure({ ...actionableSoloExit, tutorialOverlayDetected: true }),
  SOLO_EXIT_FAILURE_CATEGORY.BLOCKED_BY_TUTORIAL,
);
assert.equal(
  classifySoloExitFailure({ ...actionableSoloExit, blockingOverlayDetected: true }),
  SOLO_EXIT_FAILURE_CATEGORY.BLOCKED_BY_OVERLAY,
);
assert.equal(
  classifySoloExitFailure({ ...actionableSoloExit, exitClickOutcome: 'timeout' }),
  SOLO_EXIT_FAILURE_CATEGORY.CLICK_TIMEOUT,
);
assert.equal(
  classifySoloExitFailure({
    ...actionableSoloExit,
    exitClickOutcome: 'clicked',
    routeBeforeExit: '/game',
    routeAfterExit: '/game',
  }),
  SOLO_EXIT_FAILURE_CATEGORY.ROUTE_STALL,
);

const fakePass = createNotRunAutomationReport('contract-test');
fakePass.scenarios[0] = {
  ...fakePass.scenarios[0],
  status: AUTOMATION_STATUS.PASS,
  steps: fakePass.scenarios[0].steps.map((step) => ({
    ...step,
    status: AUTOMATION_STATUS.PASS,
    durationMs: 1,
  })),
};
const rejectedFakePass = normalizeRuntimeE2EReport(fakePass, 'contract-test');
assert.equal(rejectedFakePass.scenarios[0].status, AUTOMATION_STATUS.FAIL);
assert.equal(rejectedFakePass.scenarios[0].failureCategory, 'MISSING_EXECUTION_EVIDENCE');

const appNotFoundEvidence = {
  executionId: 'contract-app-not-found',
  browserName: 'chromium contract',
  configuredBaseUrl: 'https://runtime.contract.test',
  pageOrigin: 'https://runtime.contract.test',
  baseUrlOrigin: 'https://runtime.contract.test',
  contextCount: 1,
  deterministicPairing: false,
  deterministicClaimFixture: false,
  backendPreflight: {
    status: BACKEND_PREFLIGHT_STATUS.APP_NOT_FOUND,
    appConfigPresent: true,
    baseAppReachable: false,
    actorBootstrapReachable: 'NOT_CONFIRMED',
    questionServiceReachable: 'SCENARIO_REQUIRED',
    onlineMatchmakingReachable: 'SCENARIO_REQUIRED',
  },
};
const passResult = (definition) => ({
  scenarioId: definition.scenarioId,
  status: AUTOMATION_STATUS.PASS,
  executionEvidence: appNotFoundEvidence,
  consoleErrors: ['[Base44 SDK Error] 404: App not found'],
  steps: definition.steps.map((step) => ({
    ...step,
    status: AUTOMATION_STATUS.PASS,
    durationMs: 1,
  })),
});
const backendDefinition = RUNTIME_E2E_SCENARIOS.find((item) => item.scenarioId === 'runtime_e2e.solo_gameplay_smoke');
const uiDefinition = RUNTIME_E2E_SCENARIOS.find((item) => item.scenarioId === 'runtime_e2e.bottom_nav_route_sync');
const appNotFoundReport = normalizeRuntimeE2EReport({
  runId: 'contract-app-not-found',
  startedAt: new Date().toISOString(),
  finishedAt: new Date().toISOString(),
  executionEvidence: appNotFoundEvidence,
  configuredBaseUrl: 'https://runtime.contract.test',
  pageOrigin: 'https://runtime.contract.test',
  preflight: appNotFoundEvidence.backendPreflight,
  scenarios: [passResult(backendDefinition), passResult(uiDefinition)],
}, 'contract-test');
const rejectedBackendPass = appNotFoundReport.scenarios.find((item) => item.scenarioId === backendDefinition.scenarioId);
const acceptedUiPass = appNotFoundReport.scenarios.find((item) => item.scenarioId === uiDefinition.scenarioId);
assert.equal(rejectedBackendPass.status, AUTOMATION_STATUS.NOT_AUTOMATABLE);
assert.equal(rejectedBackendPass.failureCategory, 'BACKEND_PREFLIGHT_APP_NOT_FOUND');
assert.match(rejectedBackendPass.statusReason, /configured Base44 app was not found/i);
assert.equal(acceptedUiPass.status, AUTOMATION_STATUS.PASS);
assert.equal(acceptedUiPass.uiOnly, true);
assert.match(acceptedUiPass.statusReason, /Browser-only/);

const failure = buildAutomationFailureJson(rejectedFakePass, rejectedFakePass.scenarios[0].scenarioId);
assert.equal(failure.type, 'KRONOX_RUNTIME_E2E_AUTOMATION_FAILURE');
assert.equal(failure.suiteId, RUNTIME_E2E_SUITE_ID);
assert.ok(failure.failedStepId);
assert.equal(buildAllAutomationFailuresJson(rejectedFakePass).failures.length, 1);

const setupGapReport = createNotRunAutomationReport('contract-test');
setupGapReport.scenarios[0] = {
  ...setupGapReport.scenarios[0],
  status: AUTOMATION_STATUS.NOT_AUTOMATABLE,
  failureCategory: 'AUTOMATION_SETUP_GAP',
};
assert.equal(buildAllAutomationSetupGapsJson(setupGapReport).setupGaps.length, 1);

const classifiedAppNotFound = classifyRuntimeDiagnostic('User auth check failed: Base44Error: App not found');
assert.equal(classifiedAppNotFound.critical, true);

const capabilitySummary = buildRuntimeCapabilitySummary({
  browserAvailable: true,
  preflight: {
    status: BACKEND_PREFLIGHT_STATUS.APP_NOT_FOUND,
    documentLoaded: true,
    appConfigAvailable: false,
  },
  environment: {
    hasStorageState: false,
    hasStorageStateA: false,
    hasStorageStateB: false,
    allowMatchmaking: false,
    allowWheelSpin: false,
    allowDiamondPurchase: false,
  },
});
assert.equal(evaluateScenarioCapabilities(backendDefinition, capabilitySummary).canRun, false);
assert.equal(evaluateScenarioCapabilities(uiDefinition, capabilitySummary).canRun, true);

assert.equal(
  classifyRuntimeE2ETarget('https://kronoxgame.com/'),
  RUNTIME_E2E_TARGET_KIND.PRODUCTION_CUSTOM_DOMAIN,
);
assert.equal(
  classifyRuntimeE2ETarget('http://127.0.0.1:4174/'),
  RUNTIME_E2E_TARGET_KIND.LOCAL_DEV,
);
assert.equal(resolveRuntimePreflightStatus({
  productionCustomDomainMode: true,
  directBackendPreflightStatus: BACKEND_PREFLIGHT_STATUS.UNKNOWN,
  canRunRuntimeProbes: false,
}), BACKEND_PREFLIGHT_STATUS.PROD_CUSTOM_DOMAIN_PREFLIGHT_UNSUPPORTED);
assert.equal(resolveRuntimePreflightStatus({
  productionCustomDomainMode: true,
  directBackendPreflightStatus: BACKEND_PREFLIGHT_STATUS.UNKNOWN,
  canRunRuntimeProbes: true,
}), BACKEND_PREFLIGHT_STATUS.PROD_RUNTIME_PROBE_REQUIRED);

const serviceSummary = {};
const serviceCategory = classifyRuntimeServiceRequest(
  'https://kronoxgame.com/api/functions/getUnifiedLeaderboard?token=never-report',
  'https://kronoxgame.com',
  'fetch',
);
recordRuntimeServiceObservation(serviceSummary, serviceCategory, 'REQUEST');
recordRuntimeServiceObservation(serviceSummary, serviceCategory, 'RESPONSE', 200);
assert.equal(serviceCategory, 'leaderboard');
assert.equal(serviceSummary.leaderboard.statusClasses['2xx'], 1);
assert.equal(runtimeServiceSummaryUnavailableReason(serviceSummary), null);
assert.match(runtimeServiceSummaryUnavailableReason({}), /No classified backend requests observed/);

const appActivityUrl = 'https://kronoxgame.com/api/app-logs/app-safe/log-user-in-app/leaderboard';
const appActivityCategory = classifyRuntimeServiceRequest(appActivityUrl, 'https://kronoxgame.com', 'fetch');
const appActivityDiagnostic = buildRuntimePermissionDiagnostic({
  scenarioId: 'runtime_e2e.leaderboard_smoke_privacy',
  requestUrl: appActivityUrl,
  configuredBaseUrl: 'https://kronoxgame.com',
  resourceType: 'fetch',
  method: 'POST',
  status: 403,
});
const profileDiagnostic = buildRuntimePermissionDiagnostic({
  scenarioId: 'runtime_e2e.profile_navigation_privacy',
  requestUrl: 'https://kronoxgame.com/api/apps/app-safe/entities/User',
  configuredBaseUrl: 'https://kronoxgame.com',
  resourceType: 'fetch',
  method: 'GET',
  status: 403,
});
assert.equal(isOptionalRuntimeActivityRequest(appActivityUrl), true);
assert.equal(appActivityCategory, 'app_activity');
assert.equal(classifyRuntimeServiceAction(appActivityUrl, appActivityCategory), RUNTIME_SERVICE_ACTION.APP_ACTIVITY);
assert.equal(appActivityDiagnostic.optional, true);
assert.equal(appActivityDiagnostic.critical, false);
assert.match(appActivityDiagnostic.optionalityProof, /fire-and-forget/i);
assert.equal(profileDiagnostic.optional, false);
assert.equal(profileDiagnostic.critical, true);
assert.equal(profileDiagnostic.endpointCategory, 'profile_entity');
assert.deepEqual(
  correlateRuntimeConsoleErrors(['request failed with status 403: permission denied'], [appActivityDiagnostic]),
  [],
);
assert.equal(
  correlateRuntimeConsoleErrors(
    ['request failed with status 403: permission denied'],
    [appActivityDiagnostic, profileDiagnostic],
  ).length,
  1,
);

const lifecycleSummary = {};
recordRuntimeServiceObservation(lifecycleSummary, 'daily_status', 'REQUEST', null, {
  observedAt: '2026-08-19T10:00:00.000Z',
  safeActionLabel: RUNTIME_SERVICE_ACTION.DAILY_CALENDAR_STATUS,
});
recordRuntimeServiceObservation(lifecycleSummary, 'daily_status', 'NO_RESPONSE_TIMEOUT', null, {
  observedAt: '2026-08-19T10:00:15.000Z',
  safeActionLabel: RUNTIME_SERVICE_ACTION.DAILY_CALENDAR_STATUS,
});
assert.equal(lifecycleSummary.daily_status.requestedAt, '2026-08-19T10:00:00.000Z');
assert.equal(lifecycleSummary.daily_status.completedAt, null);
assert.equal(lifecycleSummary.daily_status.noResponseTimeouts, 1);
assert.ok(lifecycleSummary.daily_status.safeActionLabels.includes(RUNTIME_SERVICE_ACTION.DAILY_CALENDAR_STATUS));

const productionCapabilities = buildRuntimeCapabilitySummary({
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
    allowMatchmaking: true,
    allowWheelSpin: false,
    allowDiamondPurchase: false,
  },
});
assert.equal(productionCapabilities.base44Backend.status, RUNTIME_E2E_CAPABILITY_STATUS.PROBE_REQUIRED);
const onlineDefinition = RUNTIME_E2E_SCENARIOS.find((item) => item.scenarioId === 'runtime_e2e.online_random_waiting_cancel_smoke');
assert.equal(evaluateScenarioCapabilities(onlineDefinition, productionCapabilities).canRun, true);
assert.equal(evaluateScenarioCapabilities(onlineDefinition, productionCapabilities).decision, 'RUN_WITH_RUNTIME_PROBES');

const productionEvidence = {
  executionId: 'contract-production-runtime',
  browserName: 'chromium contract',
  configuredBaseUrl: 'https://kronoxgame.com',
  pageOrigin: 'https://kronoxgame.com',
  baseUrlOrigin: 'https://kronoxgame.com',
  backendPreflight: { status: BACKEND_PREFLIGHT_STATUS.PROD_RUNTIME_PROBE_REQUIRED },
};
const productionReportInput = {
  runId: 'contract-production-runtime',
  startedAt: new Date().toISOString(),
  finishedAt: new Date().toISOString(),
  targetKind: RUNTIME_E2E_TARGET_KIND.PRODUCTION_CUSTOM_DOMAIN,
  productionCustomDomainMode: true,
  configuredBaseUrl: 'https://kronoxgame.com',
  pageOrigin: 'https://kronoxgame.com',
  homeVisible: true,
  authenticatedOrStoredSession: true,
  canRunRuntimeProbes: true,
  preflight: {
    status: BACKEND_PREFLIGHT_STATUS.PROD_RUNTIME_PROBE_REQUIRED,
    directBackendPreflightStatus: BACKEND_PREFLIGHT_STATUS.PROD_CUSTOM_DOMAIN_PREFLIGHT_UNSUPPORTED,
    canRunRuntimeProbes: true,
    homeVisible: true,
    authenticatedOrStoredSession: true,
  },
  executionEvidence: productionEvidence,
};
const runtimeProbePass = {
  scenarioId: backendDefinition.scenarioId,
  status: AUTOMATION_STATUS.PASS,
  proofLevel: RUNTIME_E2E_PROOF_LEVEL.BACKEND_RUNTIME_PROBE,
  preflightDependency: RUNTIME_E2E_PREFLIGHT_DEPENDENCY.RUNTIME_PROBE,
  backendEvidence: {
    observed: false,
    successful: false,
    category: null,
    statusClass: null,
    safeSummary: 'No classified backend response was observed.',
  },
  executionEvidence: productionEvidence,
  steps: backendDefinition.steps.map((step) => ({ ...step, status: AUTOMATION_STATUS.PASS, durationMs: 1 })),
};
const missingRuntimeEvidenceReport = normalizeRuntimeE2EReport({
  ...productionReportInput,
  scenarios: [runtimeProbePass],
}, 'contract-test');
assert.equal(
  missingRuntimeEvidenceReport.scenarios.find((item) => item.scenarioId === backendDefinition.scenarioId).status,
  AUTOMATION_STATUS.NOT_AUTOMATABLE,
);

const connectedRuntimeReport = normalizeRuntimeE2EReport({
  ...productionReportInput,
  scenarios: [{
    ...runtimeProbePass,
    proofLevel: RUNTIME_E2E_PROOF_LEVEL.BACKEND_CONNECTED,
    backendEvidence: {
      observed: true,
      successful: true,
      category: 'question_service',
      statusClass: '2xx',
      safeSummary: 'Observed a successful question_service runtime response.',
    },
  }],
}, 'contract-test');
assert.equal(
  connectedRuntimeReport.scenarios.find((item) => item.scenarioId === backendDefinition.scenarioId).status,
  AUTOMATION_STATUS.PASS,
);

const appBootstrapDefinition = RUNTIME_E2E_SCENARIOS.find((item) => item.scenarioId === 'runtime_e2e.app_bootstrap_guest_home');
const restoredSessionReport = normalizeRuntimeE2EReport({
  ...productionReportInput,
  scenarios: [{
    scenarioId: appBootstrapDefinition.scenarioId,
    status: AUTOMATION_STATUS.PASS,
    proofLevel: RUNTIME_E2E_PROOF_LEVEL.SESSION_RESTORED,
    preflightDependency: RUNTIME_E2E_PREFLIGHT_DEPENDENCY.RUNTIME_PROBE,
    executionEvidence: productionEvidence,
    steps: appBootstrapDefinition.steps.map((step) => ({ ...step, status: AUTOMATION_STATUS.PASS, durationMs: 1 })),
  }],
}, 'contract-test');
assert.equal(
  restoredSessionReport.scenarios.find((item) => item.scenarioId === appBootstrapDefinition.scenarioId).status,
  AUTOMATION_STATUS.PASS,
);

const redacted = JSON.stringify(sanitizeAutomationValue({
  email: 'automation@example.com',
  url: 'https://example.test/path?token=secret-value',
  message: 'Bearer secret-value eyJhbGciOiJIUzI1NiJ9.payload.signature',
}));
assert.ok(!redacted.includes('automation@example.com'));
assert.ok(!redacted.includes('secret-value'));
assert.ok(!redacted.includes('eyJhbGciOiJIUzI1NiJ9'));

const redactedBrowserFailure = String(sanitizeAutomationValue(
  'Browser failed.\nBrowser logs:\n<launching> /Users/private/test-browser --user-data-dir=/private/var/tmp/private-profile\nCall log:\nraw launch details',
));
assert.ok(!redactedBrowserFailure.includes('Browser logs:'));
assert.ok(!redactedBrowserFailure.includes('/Users/private'));
assert.ok(!redactedBrowserFailure.includes('private-profile'));
assert.match(redactedBrowserFailure, /\[BROWSER_DIAGNOSTIC_REDACTED\]/);

const safeDiagnostic = classifyRuntimeDiagnostic('CORS blocked token=secret owner_key=private user@example.com');
const serializedDiagnostic = JSON.stringify(safeDiagnostic);
assert.equal(safeDiagnostic.category, 'BACKEND_CORS_BLOCKED');
assert.match(safeDiagnostic.fingerprint, /^diag-[a-f0-9]{8}$/);
assert.ok(!serializedDiagnostic.includes('secret'));
assert.ok(!serializedDiagnostic.includes('user@example.com'));

const gitignore = await readFile(new URL('../.gitignore', import.meta.url), 'utf8');
assert.match(gitignore, /^\/\.auth\/$/m);
assert.match(gitignore, /^\*\*\/\.auth\/$/m);
assert.match(gitignore, /^\*\*\/\*storage-state\*\.json$/m);

let duelloStatus = null;
try {
  await RUNTIME_E2E_SCENARIO_HANDLERS['runtime_e2e.duello_two_context_runtime_sync']();
} catch (error) {
  duelloStatus = error?.automationStatus;
}
assert.equal(duelloStatus, AUTOMATION_STATUS.MANUAL_EXTERNAL);

process.stdout.write('Runtime E2E V2 contracts: PASS (10 scenarios, bounded per-action backend lifecycles, proof-only optional app activity, permission safety, Online 2xx gate, Duello manual gate).\n');
