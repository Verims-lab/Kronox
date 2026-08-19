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

export const BACKEND_PREFLIGHT_STATUS = Object.freeze({
  REACHABLE: 'REACHABLE',
  APP_NOT_FOUND: 'APP_NOT_FOUND',
  NOT_CONFIGURED: 'NOT_CONFIGURED',
  UNREACHABLE: 'UNREACHABLE',
  UNKNOWN: 'UNKNOWN',
});

export const RUNTIME_DIAGNOSTIC_CATEGORY = Object.freeze({
  BASE44_APP_NOT_FOUND: 'BASE44_APP_NOT_FOUND',
  BASE44_APP_CONFIG_MISSING: 'BASE44_APP_CONFIG_MISSING',
  ACTOR_BOOTSTRAP_CONFIG_FAILURE: 'ACTOR_BOOTSTRAP_CONFIG_FAILURE',
  NETWORK_REQUEST_FAILED: 'NETWORK_REQUEST_FAILED',
  BROWSER_CONSOLE_ERROR: 'BROWSER_CONSOLE_ERROR',
});

const AUTOMATION_STATUSES = new Set(Object.values(AUTOMATION_STATUS));
const SETUP_GAP_STATUSES = new Set([
  AUTOMATION_STATUS.NOT_AUTOMATABLE,
  AUTOMATION_STATUS.MANUAL_EXTERNAL,
]);
const PRIVATE_KEY_PATTERN = /(?:password|secret|token|authorization|cookie|session|email|provider.?id|owner.?key|guest.?id|auth.?id|player.?key|actor.?key|storage.?state)/i;
const PRIVATE_TEXT_PATTERN = /\b(?:owner_key|guest_token|guest_id|provider_id|auth_id|internal_player_key|player_key)\b|\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const STACK_TRACE_PATTERN = /(?:\n|^)\s*at\s+[\w.$<>]+\s*\([^\n]+:\d+:\d+\)/g;
const APP_NOT_FOUND_PATTERN = /(?:Base44[^\n]{0,120})?App not found|backend app not found/i;
const APP_CONFIG_PATTERN = /missing Base44 app (?:id|config)|VITE_BASE44_APP_ID[^\n]{0,80}(?:missing|required|undefined)|app[_ ]id[^\n]{0,80}(?:missing|required|undefined)/i;
const ACTOR_BOOTSTRAP_PATTERN = /(?:User auth check failed|guest|auth|bootstrap)[^\n]{0,160}App not found/i;

function nowIso() {
  return new Date().toISOString();
}

function sanitizeAbsoluteUrl(value) {
  try {
    const parsed = new URL(String(value));
    return `${parsed.origin}${parsed.pathname}`;
  } catch (_) {
    return String(value || '').split('?')[0].split('#')[0];
  }
}

function sanitizeRoute(value) {
  try {
    return new URL(String(value), 'https://runtime.invalid').pathname || '/';
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
    return Object.fromEntries(Object.entries(value).slice(0, 120).map(([entryKey, entryValue]) => [
      entryKey,
      sanitizeAutomationValue(entryValue, entryKey),
    ]));
  }
  if (/route/i.test(key)) return sanitizeRoute(value);
  if (/(?:url|origin|baseUrl)/i.test(key)) return sanitizeAbsoluteUrl(value);
  if (/screenshot|trace|artifact/i.test(key)) return sanitizeArtifactPath(value);
  return sanitizeText(value);
}

export function classifyRuntimeDiagnostic(value) {
  if (
    value
    && typeof value === 'object'
    && Object.values(RUNTIME_DIAGNOSTIC_CATEGORY).includes(value.category)
    && typeof value.critical === 'boolean'
  ) {
    return {
      category: value.category,
      critical: value.critical,
      summary: sanitizeText(value.summary || 'A classified browser diagnostic was observed.'),
      nextAction: sanitizeText(value.nextAction || 'Inspect the affected runtime scenario.'),
    };
  }
  const text = sanitizeText(typeof value === 'string' ? value : value?.summary || value?.message || JSON.stringify(value || ''));
  if (ACTOR_BOOTSTRAP_PATTERN.test(text)) {
    return {
      category: RUNTIME_DIAGNOSTIC_CATEGORY.ACTOR_BOOTSTRAP_CONFIG_FAILURE,
      critical: true,
      summary: 'Guest/auth bootstrap failed because the configured Base44 app was not found.',
      nextAction: 'Configure VITE_BASE44_APP_ID or approved app_id bootstrap and verify the target app.',
    };
  }
  if (APP_NOT_FOUND_PATTERN.test(text)) {
    return {
      category: RUNTIME_DIAGNOSTIC_CATEGORY.BASE44_APP_NOT_FOUND,
      critical: true,
      summary: 'The configured Base44 app was not found.',
      nextAction: 'Verify VITE_BASE44_APP_ID/app_id and the configured app base URL.',
    };
  }
  if (APP_CONFIG_PATTERN.test(text)) {
    return {
      category: RUNTIME_DIAGNOSTIC_CATEGORY.BASE44_APP_CONFIG_MISSING,
      critical: true,
      summary: 'Required Base44 app configuration is missing.',
      nextAction: 'Set VITE_BASE44_APP_ID or provide app_id through approved runtime bootstrap.',
    };
  }
  if (/request failed|networkerror|failed to fetch|net::/i.test(text)) {
    return {
      category: RUNTIME_DIAGNOSTIC_CATEGORY.NETWORK_REQUEST_FAILED,
      critical: false,
      summary: 'A browser network request failed.',
      nextAction: 'Inspect the redacted service summary and rerun against the intended environment.',
    };
  }
  return {
    category: RUNTIME_DIAGNOSTIC_CATEGORY.BROWSER_CONSOLE_ERROR,
    critical: false,
    summary: 'A browser console error was observed.',
    nextAction: 'Inspect the affected scenario and its retained trace when available.',
  };
}

export function summarizeRuntimeConsoleErrors(values = []) {
  const items = [];
  const seen = new Set();
  for (const value of values || []) {
    const diagnostic = classifyRuntimeDiagnostic(value);
    const key = `${diagnostic.category}:${diagnostic.summary}`;
    if (seen.has(key)) continue;
    seen.add(key);
    items.push(diagnostic);
    if (items.length >= 20) break;
  }
  return {
    observedCount: Array.isArray(values) ? values.length : 0,
    summaryCount: items.length,
    criticalCount: items.filter((item) => item.critical).length,
    categories: items.reduce((counts, item) => ({
      ...counts,
      [item.category]: (counts[item.category] || 0) + 1,
    }), {}),
    items,
  };
}

export function summarizeRuntimeNetworkErrors(values = []) {
  const methods = [...new Set((values || []).map((item) => String(item?.method || 'UNKNOWN').toUpperCase()))].slice(0, 10);
  return {
    observedCount: Array.isArray(values) ? values.length : 0,
    summaryCount: methods.length,
    items: methods.map((method) => ({
      category: RUNTIME_DIAGNOSTIC_CATEGORY.NETWORK_REQUEST_FAILED,
      method,
      summary: 'A browser network request failed; request URL and raw error were omitted.',
    })),
  };
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
    failureCategory: null,
    screenshotPath: null,
    tracePath: null,
  }));
}

export function createNotRunAutomationReport(buildMarker = 'unknown') {
  const scenarios = RUNTIME_E2E_SCENARIOS.map((scenario) => ({
    scenarioId: scenario.scenarioId,
    scenarioTitle: scenario.title,
    requiredCapabilities: scenario.requiredCapabilities,
    optionalCapabilities: scenario.optionalCapabilities,
    capabilityStatus: [],
    executionScope: scenario.executionScope,
    backendDependent: scenario.executionScope === RUNTIME_E2E_EXECUTION_SCOPE.BACKEND_DEPENDENT,
    uiOnly: scenario.executionScope === RUNTIME_E2E_EXECUTION_SCOPE.UI_ONLY,
    backendServices: scenario.backendServices,
    preflightDecision: 'NOT_RUN',
    status: AUTOMATION_STATUS.NOT_RUN,
    statusReason: 'No runtime automation report has been imported or executed.',
    durationMs: null,
    failureCategory: null,
    actual: 'No runtime automation report has been imported or executed.',
    steps: notRunSteps(scenario),
    consoleErrorSummary: summarizeRuntimeConsoleErrors(),
    criticalConsoleErrors: [],
    consoleErrors: [],
    networkErrors: [],
    relatedFiles: [],
    safeReproductionSteps: [],
    safeSetupInstructions: scenario.manualFallback,
    nextAction: scenario.manualFallback,
    screenshotPath: null,
    tracePath: null,
  }));
  return {
    type: 'KRONOX_RUNTIME_E2E_AUTOMATION_REPORT',
    version: 2,
    suiteId: RUNTIME_E2E_SUITE_ID,
    runId: null,
    generatedAt: nowIso(),
    startedAt: null,
    finishedAt: null,
    buildMarker,
    configuredBaseUrl: null,
    pageUrl: null,
    pageOrigin: null,
    appRoute: null,
    preflight: null,
    environment: null,
    capabilitySummary: {},
    criticalConsoleErrorCount: 0,
    backendAvailable: false,
    appConfigAvailable: false,
    base44AppReachable: false,
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
    route: step?.route || null,
    durationMs: Number.isFinite(Number(step?.durationMs)) ? Number(step.durationMs) : null,
    failureCategory: step?.failureCategory || null,
    screenshotPath: step?.screenshotPath || null,
    tracePath: step?.tracePath || null,
  });
}

function meaningfulOrigin(value) {
  return /^https?:\/\/[^/]+/i.test(String(value || ''));
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
    && meaningfulOrigin(report?.pageOrigin || evidence?.pageOrigin || evidence?.baseUrlOrigin)
    && completedRequiredSteps.length === requiredSteps.length,
  );
  if (!baseEvidence) return false;
  if (
    definition?.executionScope === RUNTIME_E2E_EXECUTION_SCOPE.BACKEND_DEPENDENT
    && (report?.preflight?.status || evidence?.backendPreflight?.status) !== BACKEND_PREFLIGHT_STATUS.REACHABLE
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
  const preflightStatus = report?.preflight?.status || evidence?.backendPreflight?.status;
  const diagnostics = summarizeRuntimeConsoleErrors([
    ...(result?.consoleErrors || []),
    ...(result?.consoleErrorSummary?.items || []),
    result?.actual,
  ]);
  const appNotFound = diagnostics.items.some((item) => (
    item.category === RUNTIME_DIAGNOSTIC_CATEGORY.BASE44_APP_NOT_FOUND
    || item.category === RUNTIME_DIAGNOSTIC_CATEGORY.ACTOR_BOOTSTRAP_CONFIG_FAILURE
  ));
  if (preflightStatus === BACKEND_PREFLIGHT_STATUS.APP_NOT_FOUND || appNotFound) {
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
      failureCategory: backendBlock.category,
      actual: backendBlock.actual,
    }));
  }
  if (status === AUTOMATION_STATUS.PASS && !hasRealAutomationEvidence(report, { ...result, steps })) {
    status = AUTOMATION_STATUS.FAIL;
    actual = 'PASS rejected: real browser execution evidence is incomplete.';
    failureCategory = 'MISSING_EXECUTION_EVIDENCE';
    failedStepId = 'runtime-evidence-gate';
    failedStepTitle = 'Real browser execution evidence';
    expected = 'A completed run, meaningful page origin, browser identity, and timed PASS evidence for every required step.';
  }
  const consoleErrorSummary = summarizeRuntimeConsoleErrors([
    ...(result.consoleErrors || []),
    ...(result.consoleErrorSummary?.items || []),
  ]);
  const uiOnly = definition.executionScope === RUNTIME_E2E_EXECUTION_SCOPE.UI_ONLY;
  const backendDependent = !uiOnly;
  const failedStep = steps.find((item) => item.status === AUTOMATION_STATUS.FAIL);
  const networkErrorSummary = summarizeRuntimeNetworkErrors(result.networkErrors || []);
  const screenshotPath = result.screenshotPath || failedStep?.screenshotPath || null;
  const tracePath = result.tracePath || failedStep?.tracePath || null;
  const statusWasDemoted = result.status === AUTOMATION_STATUS.PASS && status !== AUTOMATION_STATUS.PASS;
  const statusReason = (statusWasDemoted ? actual : result.statusReason) || actual || (
    status === AUTOMATION_STATUS.PASS
      ? uiOnly && !report.backendAvailable
        ? 'Browser-only UI assertions passed; backend was unavailable and this is not backend proof.'
        : 'All required runtime steps passed.'
      : 'Scenario did not complete.'
  );
  return sanitizeAutomationValue({
    ...result,
    scenarioId: definition.scenarioId,
    scenarioTitle: definition.title,
    requiredCapabilities: definition.requiredCapabilities,
    optionalCapabilities: definition.optionalCapabilities,
    capabilityStatus: result.capabilityStatus || [],
    executionScope: definition.executionScope,
    backendDependent,
    uiOnly,
    backendServices: definition.backendServices,
    preflightDecision: result.preflightDecision || 'NOT_RECORDED',
    status,
    statusReason,
    durationMs: result.durationMs != null && Number.isFinite(Number(result.durationMs))
      ? Number(result.durationMs)
      : null,
    failureCategory,
    failedStepId,
    failedStepTitle,
    expected,
    actual,
    steps,
    executionEvidence: report.executionEvidence,
    consoleErrorSummary,
    criticalConsoleErrors: consoleErrorSummary.items.filter((item) => item.critical),
    consoleErrors: consoleErrorSummary.items,
    networkErrorSummary,
    networkErrors: networkErrorSummary.items,
    relatedFiles: result.relatedFiles || [],
    safeReproductionSteps: result.safeReproductionSteps || definition.steps.map((item) => item.action),
    safeSetupInstructions: result.safeSetupInstructions || definition.manualFallback,
    nextAction: result.nextAction || definition.manualFallback,
    screenshotPath,
    tracePath,
  });
}

export function normalizeRuntimeE2EReport(input, buildMarker = 'unknown') {
  if (!input || typeof input !== 'object') return createNotRunAutomationReport(buildMarker);
  const evidence = input.executionEvidence || null;
  const rawPreflight = input.preflight || evidence?.backendPreflight || null;
  const preflightConsoleSummary = summarizeRuntimeConsoleErrors(rawPreflight?.consoleErrors || []);
  const preflight = rawPreflight ? sanitizeAutomationValue({
    ...rawPreflight,
    consoleErrorSummary: preflightConsoleSummary,
    consoleErrors: preflightConsoleSummary.items,
  }) : null;
  const backendAvailable = input.backendAvailable ?? preflight?.status === BACKEND_PREFLIGHT_STATUS.REACHABLE;
  const appConfigAvailable = input.appConfigAvailable ?? Boolean(preflight?.appConfigAvailable);
  const base44AppReachable = input.base44AppReachable ?? Boolean(preflight?.base44AppReachable);
  const safeEvidence = evidence ? {
    ...evidence,
    preflight,
    backendPreflight: preflight,
    environment: input.environment || evidence.environment || null,
    capabilitySummary: input.capabilitySummary || evidence.capabilitySummary || {},
  } : null;
  const shell = sanitizeAutomationValue({
    ...input,
    type: 'KRONOX_RUNTIME_E2E_AUTOMATION_REPORT',
    version: 2,
    suiteId: RUNTIME_E2E_SUITE_ID,
    buildMarker: input.buildMarker || buildMarker,
    configuredBaseUrl: input.configuredBaseUrl || evidence?.configuredBaseUrl || null,
    pageUrl: input.pageUrl || preflight?.pageUrl || evidence?.pageUrl || null,
    pageOrigin: input.pageOrigin || preflight?.pageOrigin || evidence?.pageOrigin || null,
    appRoute: input.appRoute || preflight?.appRoute || evidence?.appRoute || null,
    preflight,
    environment: input.environment || evidence?.environment || null,
    capabilitySummary: input.capabilitySummary || evidence?.capabilitySummary || {},
    backendAvailable,
    appConfigAvailable,
    base44AppReachable,
    executionEvidence: safeEvidence,
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
  const criticalConsoleErrorCount = preflightConsoleSummary.criticalCount
    + scenarios.reduce((count, scenario) => count + (scenario.consoleErrorSummary?.criticalCount || 0), 0);
  return {
    ...shell,
    criticalConsoleErrorCount,
    scenarios,
    counts: buildAutomationCounters(scenarios),
  };
}

function issueStepFor(result) {
  return (result?.steps || []).find((step) => step.status === AUTOMATION_STATUS.FAIL)
    || (result?.steps || []).find((step) => step.id === result?.failedStepId)
    || (result?.steps || []).find((step) => SETUP_GAP_STATUSES.has(step.status))
    || null;
}

function buildAutomationIssueJson(report, scenarioId, setupGapOnly = false) {
  const normalized = normalizeRuntimeE2EReport(report, report?.buildMarker);
  const result = normalized.scenarios.find((item) => item.scenarioId === scenarioId);
  const isFailure = result?.status === AUTOMATION_STATUS.FAIL;
  const isSetupGap = SETUP_GAP_STATUSES.has(result?.status);
  if (!result || (setupGapOnly ? !isSetupGap : !isFailure && !isSetupGap)) return null;
  const issueStep = issueStepFor(result);
  return sanitizeAutomationValue({
    type: isFailure ? 'KRONOX_RUNTIME_E2E_AUTOMATION_FAILURE' : 'KRONOX_RUNTIME_E2E_AUTOMATION_SETUP_GAP',
    runId: normalized.runId,
    generatedAt: normalized.generatedAt,
    buildMarker: normalized.buildMarker,
    suiteId: RUNTIME_E2E_SUITE_ID,
    configuredBaseUrl: normalized.configuredBaseUrl,
    pageOrigin: normalized.pageOrigin,
    preflight: normalized.preflight,
    scenarioId: result.scenarioId,
    scenarioTitle: result.scenarioTitle,
    status: result.status,
    requiredCapabilities: result.requiredCapabilities,
    capabilityStatus: result.capabilityStatus,
    preflightDecision: result.preflightDecision,
    failedStepId: issueStep?.id || result.failedStepId || null,
    failedStepTitle: issueStep?.title || result.failedStepTitle || null,
    failureCategory: result.failureCategory || (isSetupGap ? 'AUTOMATION_SETUP_GAP' : 'UNCLASSIFIED_AUTOMATION_FAILURE'),
    expected: issueStep?.expected || result.expected || null,
    actual: issueStep?.actual || result.actual || null,
    route: issueStep?.route || result.route || null,
    selector: issueStep?.selector || result.selector || null,
    screenshotPath: issueStep?.screenshotPath || result.screenshotPath || null,
    tracePath: issueStep?.tracePath || result.tracePath || null,
    consoleErrorSummary: result.consoleErrorSummary,
    criticalConsoleErrors: result.criticalConsoleErrors,
    networkErrorSummary: result.networkErrorSummary,
    networkErrors: result.networkErrors || [],
    relatedFiles: result.relatedFiles || [],
    safeReproductionSteps: result.safeReproductionSteps || [],
    safeSetupInstructions: result.safeSetupInstructions,
    nextAction: result.nextAction || 'Inspect the scenario setup and rerun it in isolation.',
  });
}

export function buildAutomationFailureJson(report, scenarioId) {
  return buildAutomationIssueJson(report, scenarioId, false);
}

export function buildAutomationSetupGapJson(report, scenarioId) {
  return buildAutomationIssueJson(report, scenarioId, true);
}

export function buildAllAutomationFailuresJson(report) {
  const normalized = normalizeRuntimeE2EReport(report, report?.buildMarker);
  return {
    type: 'KRONOX_RUNTIME_E2E_AUTOMATION_ISSUES',
    runId: normalized.runId,
    generatedAt: normalized.generatedAt,
    buildMarker: normalized.buildMarker,
    suiteId: RUNTIME_E2E_SUITE_ID,
    failures: normalized.scenarios
      .filter((item) => item.status === AUTOMATION_STATUS.FAIL)
      .map((item) => buildAutomationFailureJson(normalized, item.scenarioId)),
    setupGaps: normalized.scenarios
      .filter((item) => SETUP_GAP_STATUSES.has(item.status))
      .map((item) => buildAutomationSetupGapJson(normalized, item.scenarioId)),
  };
}

export function buildAllAutomationSetupGapsJson(report) {
  const normalized = normalizeRuntimeE2EReport(report, report?.buildMarker);
  return {
    type: 'KRONOX_RUNTIME_E2E_AUTOMATION_SETUP_GAPS',
    runId: normalized.runId,
    generatedAt: normalized.generatedAt,
    buildMarker: normalized.buildMarker,
    suiteId: RUNTIME_E2E_SUITE_ID,
    setupGaps: normalized.scenarios
      .filter((item) => SETUP_GAP_STATUSES.has(item.status))
      .map((item) => buildAutomationSetupGapJson(normalized, item.scenarioId)),
  };
}

export function buildFullAutomationReportJson(report) {
  return normalizeRuntimeE2EReport(report, report?.buildMarker);
}
