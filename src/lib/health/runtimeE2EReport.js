import {
  RUNTIME_E2E_SCENARIOS,
  RUNTIME_E2E_EXECUTION_SCOPE,
  RUNTIME_E2E_SUITE_ID,
  getRuntimeE2EScenario,
} from './runtimeE2EScenarios.js';

export const AUTOMATION_STATUS = Object.freeze({
  PASS: 'AUTOMATION_PASS',
  FAIL: 'AUTOMATION_FAIL',
  NOT_RUN: 'AUTOMATION_NOT_RUN',
  NOT_AUTOMATABLE: 'AUTOMATION_NOT_AUTOMATABLE',
  MANUAL_EXTERNAL: 'AUTOMATION_MANUAL_EXTERNAL',
});

export const AUTOMATION_COUNTER_KEYS = Object.freeze({
  [AUTOMATION_STATUS.PASS]: 'automationPassed',
  [AUTOMATION_STATUS.FAIL]: 'automationFailed',
  [AUTOMATION_STATUS.NOT_RUN]: 'automationNotRun',
  [AUTOMATION_STATUS.NOT_AUTOMATABLE]: 'automationNotAutomatable',
  [AUTOMATION_STATUS.MANUAL_EXTERNAL]: 'automationManualExternal',
});

const AUTOMATION_STATUSES = new Set(Object.values(AUTOMATION_STATUS));
const PRIVATE_KEY_PATTERN = /(?:password|secret|token|authorization|cookie|session|email|provider.?id|owner.?key|guest.?id|auth.?id|player.?key|actor.?key|storage.?state)/i;
const PRIVATE_TEXT_PATTERN = /\b(?:owner_key|guest_token|guest_id|provider_id|auth_id|internal_player_key|player_key)\b|\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const STACK_TRACE_PATTERN = /(?:\n|^)\s*at\s+[\w.$<>]+\s*\([^\n]+:\d+:\d+\)/g;
const APP_NOT_FOUND_PATTERN = /(?:Base44[^\n]{0,120})?App not found/i;

export const BACKEND_PREFLIGHT_STATUS = Object.freeze({
  REACHABLE: 'REACHABLE',
  APP_NOT_FOUND: 'APP_NOT_FOUND',
  NOT_CONFIGURED: 'NOT_CONFIGURED',
  UNREACHABLE: 'UNREACHABLE',
  UNKNOWN: 'UNKNOWN',
});

function nowIso() {
  return new Date().toISOString();
}

function sanitizeUrl(value) {
  try {
    const parsed = new URL(value, 'https://runtime.invalid');
    return `${parsed.pathname}${parsed.hash || ''}` || '/';
  } catch (_) {
    return String(value || '').split('?')[0].split('#')[0];
  }
}

function sanitizeArtifactPath(value) {
  const normalized = String(value || '').replace(/\\/g, '/');
  const marker = normalized.indexOf('test-results/health-e2e/');
  return marker >= 0 ? normalized.slice(marker) : normalized.split('/').slice(-3).join('/');
}

function sanitizeText(value) {
  return String(value || '')
    .replace(/\u001B\[[0-?]*[ -/]*[@-~]/g, '')
    .replace(PRIVATE_TEXT_PATTERN, '[REDACTED]')
    .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer [REDACTED]')
    .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, '[JWT_REDACTED]')
    .replace(/([?&](?:token|access_token|refresh_token|auth|authorization|session|guest_token|guest_id|owner_key)=)[^&\s#]+/gi, '$1[REDACTED]')
    .replace(STACK_TRACE_PATTERN, '\n[STACK_REDACTED]')
    .slice(0, 4000);
}

export function sanitizeAutomationValue(value, key = '') {
  if (value == null || typeof value === 'boolean' || typeof value === 'number') return value;
  if (PRIVATE_KEY_PATTERN.test(key)) return '[REDACTED]';
  if (Array.isArray(value)) return value.slice(0, 50).map((item) => sanitizeAutomationValue(item));
  if (typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).slice(0, 100).map(([entryKey, entryValue]) => [
      entryKey,
      sanitizeAutomationValue(entryValue, entryKey),
    ]));
  }
  if (/route|url/i.test(key)) return sanitizeUrl(value);
  if (/screenshot|trace|artifact/i.test(key)) return sanitizeArtifactPath(value);
  return sanitizeText(value);
}

function emptyCounters() {
  return {
    automationPassed: 0,
    automationFailed: 0,
    automationNotRun: 0,
    automationNotAutomatable: 0,
    automationManualExternal: 0,
  };
}

export function buildAutomationCounters(results = []) {
  return results.reduce((counts, result) => {
    const key = AUTOMATION_COUNTER_KEYS[result?.status] || AUTOMATION_COUNTER_KEYS[AUTOMATION_STATUS.NOT_RUN];
    counts[key] += 1;
    return counts;
  }, emptyCounters());
}

function notRunSteps(scenario) {
  return scenario.steps.map((item) => ({
    ...item,
    status: AUTOMATION_STATUS.NOT_RUN,
    actual: 'Not executed.',
    route: null,
    durationMs: null,
    screenshotPath: null,
    tracePath: null,
  }));
}

export function createNotRunAutomationReport(buildMarker = 'unknown') {
  const generatedAt = nowIso();
  const scenarios = RUNTIME_E2E_SCENARIOS.map((scenario) => ({
    scenarioId: scenario.scenarioId,
    scenarioTitle: scenario.title,
    executionScope: scenario.executionScope,
    backendServices: scenario.backendServices,
    status: AUTOMATION_STATUS.NOT_RUN,
    durationMs: null,
    failureCategory: null,
    actual: 'No runtime automation report has been imported or executed.',
    steps: notRunSteps(scenario),
    consoleErrors: [],
    networkErrors: [],
    relatedFiles: [],
    safeReproductionSteps: [],
    nextAction: scenario.manualFallback,
  }));
  return {
    type: 'KRONOX_RUNTIME_E2E_AUTOMATION_REPORT',
    version: 1,
    suiteId: RUNTIME_E2E_SUITE_ID,
    runId: null,
    generatedAt,
    startedAt: null,
    finishedAt: null,
    buildMarker,
    executionEvidence: null,
    counts: buildAutomationCounters(scenarios),
    scenarios,
  };
}

function normalizeStep(step, definition) {
  const status = AUTOMATION_STATUSES.has(step?.status) ? step.status : AUTOMATION_STATUS.NOT_RUN;
  return sanitizeAutomationValue({
    ...definition,
    ...step,
    id: definition?.id || step?.id || 'unknown-step',
    title: definition?.title || step?.title || 'Unnamed step',
    status,
    actual: step?.actual || (status === AUTOMATION_STATUS.NOT_RUN ? 'Not executed.' : ''),
    screenshotPath: step?.screenshotPath || null,
    tracePath: step?.tracePath || null,
  });
}

export function hasRealAutomationEvidence(report, result) {
  const evidence = result?.executionEvidence || report?.executionEvidence;
  const definition = getRuntimeE2EScenario(result?.scenarioId);
  const requiredSteps = (definition?.steps || []).filter((item) => item.required !== false);
  const completedRequiredSteps = (result?.steps || []).filter((item) => (
    requiredSteps.some((required) => required.id === item.id)
    && item.status === AUTOMATION_STATUS.PASS
    && Number.isFinite(Number(item.durationMs))
  ));
  const baseEvidence = Boolean(
    report?.runId
    && report?.startedAt
    && report?.finishedAt
    && evidence?.executionId
    && evidence?.browserName
    && evidence?.baseUrlOrigin
    && completedRequiredSteps.length === requiredSteps.length,
  );
  if (!baseEvidence) return false;
  if (
    definition?.executionScope === RUNTIME_E2E_EXECUTION_SCOPE.BACKEND_DEPENDENT
    && evidence?.backendPreflight?.status !== BACKEND_PREFLIGHT_STATUS.REACHABLE
  ) return false;
  if (result?.scenarioId !== 'runtime_e2e.duello_two_context_runtime_sync') return true;
  return evidence?.contextCount >= 2
    && evidence?.deterministicPairing === true
    && evidence?.deterministicClaimFixture === true
    && result?.authorityEvidence?.singleAcceptedClaim === true
    && result?.authorityEvidence?.snapshotReconciled === true;
}

export function backendPreflightBlock(report, result) {
  const definition = getRuntimeE2EScenario(result?.scenarioId);
  if (definition?.executionScope !== RUNTIME_E2E_EXECUTION_SCOPE.BACKEND_DEPENDENT) return null;
  const evidence = result?.executionEvidence || report?.executionEvidence;
  const preflightStatus = evidence?.backendPreflight?.status;
  const diagnosticText = JSON.stringify([
    result?.actual,
    result?.consoleErrors,
    result?.networkErrors,
    evidence?.backendPreflight,
  ]);
  if (preflightStatus === BACKEND_PREFLIGHT_STATUS.APP_NOT_FOUND || APP_NOT_FOUND_PATTERN.test(diagnosticText)) {
    return {
      category: 'BACKEND_PREFLIGHT_APP_NOT_FOUND',
      actual: 'Backend-dependent scenario was not accepted: the configured Base44 app was not found.',
      expected: 'A reachable configured Base44 app before backend-dependent browser steps run.',
    };
  }
  if (preflightStatus && preflightStatus !== BACKEND_PREFLIGHT_STATUS.REACHABLE) {
    return {
      category: `BACKEND_PREFLIGHT_${preflightStatus}`,
      actual: `Backend-dependent scenario was not accepted: backend preflight is ${preflightStatus}.`,
      expected: 'Backend preflight status REACHABLE before backend-dependent browser steps run.',
    };
  }
  return null;
}

function normalizeScenarioResult(report, result = {}) {
  const definition = getRuntimeE2EScenario(result.scenarioId);
  if (!definition) return null;
  const suppliedSteps = Array.isArray(result.steps) ? result.steps : [];
  let steps = definition.steps.map((item) => normalizeStep(
    suppliedSteps.find((step) => step?.id === item.id),
    item,
  ));
  let status = AUTOMATION_STATUSES.has(result.status) ? result.status : AUTOMATION_STATUS.NOT_RUN;
  let actual = result.actual || '';
  let failureCategory = result.failureCategory || null;
  let failedStepId = result.failedStepId || null;
  let failedStepTitle = result.failedStepTitle || null;
  let expected = result.expected || null;
  const backendBlock = backendPreflightBlock(report, result);
  if (status === AUTOMATION_STATUS.PASS && backendBlock) {
    status = AUTOMATION_STATUS.NOT_AUTOMATABLE;
    actual = backendBlock.actual;
    failureCategory = backendBlock.category;
    failedStepId = 'backend-preflight';
    failedStepTitle = 'Backend reachability preflight';
    expected = backendBlock.expected;
    steps = steps.map((item) => ({
      ...item,
      status: AUTOMATION_STATUS.NOT_AUTOMATABLE,
      actual: backendBlock.actual,
    }));
  }
  if (status === AUTOMATION_STATUS.PASS && !hasRealAutomationEvidence(report, { ...result, steps })) {
    status = AUTOMATION_STATUS.FAIL;
    actual = 'PASS rejected: real browser execution evidence is incomplete.';
    failureCategory = 'MISSING_EXECUTION_EVIDENCE';
    failedStepId = 'runtime-evidence-gate';
    failedStepTitle = 'Real browser execution evidence';
    expected = 'A completed run, browser/context identity, and timed PASS evidence for every required step.';
  }
  return sanitizeAutomationValue({
    ...result,
    scenarioId: definition.scenarioId,
    scenarioTitle: definition.title,
    executionScope: definition.executionScope,
    backendServices: definition.backendServices,
    status,
    durationMs: result.durationMs != null && Number.isFinite(Number(result.durationMs))
      ? Number(result.durationMs)
      : null,
    failureCategory,
    failedStepId,
    failedStepTitle,
    expected,
    actual,
    steps,
    consoleErrors: result.consoleErrors || [],
    networkErrors: result.networkErrors || [],
    relatedFiles: result.relatedFiles || [],
    safeReproductionSteps: result.safeReproductionSteps || definition.steps.map((item) => item.action),
    nextAction: result.nextAction || definition.manualFallback,
  });
}

export function normalizeRuntimeE2EReport(input, buildMarker = 'unknown') {
  if (!input || typeof input !== 'object') return createNotRunAutomationReport(buildMarker);
  const shell = sanitizeAutomationValue({
    ...input,
    type: 'KRONOX_RUNTIME_E2E_AUTOMATION_REPORT',
    version: 1,
    suiteId: RUNTIME_E2E_SUITE_ID,
    buildMarker: input.buildMarker || buildMarker,
  });
  const suppliedResults = Array.isArray(input.scenarios) ? input.scenarios : [];
  const scenarios = RUNTIME_E2E_SCENARIOS.map((definition) => normalizeScenarioResult(
    shell,
    suppliedResults.find((item) => item?.scenarioId === definition.scenarioId) || {
      scenarioId: definition.scenarioId,
      status: AUTOMATION_STATUS.NOT_RUN,
      actual: 'Scenario was not included in this run.',
    },
  ));
  return {
    ...shell,
    scenarios,
    counts: buildAutomationCounters(scenarios),
  };
}

function failedStepFor(result) {
  return (result?.steps || []).find((step) => step.status === AUTOMATION_STATUS.FAIL)
    || (result?.steps || []).find((step) => step.id === result?.failedStepId)
    || null;
}

export function buildAutomationFailureJson(report, scenarioId) {
  const normalized = normalizeRuntimeE2EReport(report, report?.buildMarker);
  const result = normalized.scenarios.find((item) => item.scenarioId === scenarioId);
  if (!result || result.status !== AUTOMATION_STATUS.FAIL) return null;
  const failedStep = failedStepFor(result);
  return sanitizeAutomationValue({
    type: 'KRONOX_RUNTIME_E2E_AUTOMATION_FAILURE',
    runId: normalized.runId,
    generatedAt: normalized.generatedAt,
    buildMarker: normalized.buildMarker,
    suiteId: RUNTIME_E2E_SUITE_ID,
    scenarioId: result.scenarioId,
    scenarioTitle: result.scenarioTitle,
    status: AUTOMATION_STATUS.FAIL,
    failedStepId: failedStep?.id || result.failedStepId || null,
    failedStepTitle: failedStep?.title || result.failedStepTitle || null,
    failureCategory: result.failureCategory || 'UNCLASSIFIED_AUTOMATION_FAILURE',
    expected: failedStep?.expected || result.expected || null,
    actual: failedStep?.actual || result.actual || null,
    route: failedStep?.route || result.route || null,
    selector: failedStep?.selector || result.selector || null,
    screenshotPath: failedStep?.screenshotPath || result.screenshotPath || null,
    tracePath: failedStep?.tracePath || result.tracePath || null,
    consoleErrors: result.consoleErrors || [],
    networkErrors: result.networkErrors || [],
    relatedFiles: result.relatedFiles || [],
    safeReproductionSteps: result.safeReproductionSteps || [],
    nextAction: result.nextAction || 'Inspect the failed step and rerun the isolated scenario.',
  });
}

export function buildAllAutomationFailuresJson(report) {
  const normalized = normalizeRuntimeE2EReport(report, report?.buildMarker);
  return {
    type: 'KRONOX_RUNTIME_E2E_AUTOMATION_FAILURES',
    runId: normalized.runId,
    generatedAt: normalized.generatedAt,
    buildMarker: normalized.buildMarker,
    suiteId: RUNTIME_E2E_SUITE_ID,
    failures: normalized.scenarios
      .filter((item) => item.status === AUTOMATION_STATUS.FAIL)
      .map((item) => buildAutomationFailureJson(normalized, item.scenarioId)),
  };
}
