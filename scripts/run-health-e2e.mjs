import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

import { chromium } from '@playwright/test';

import {
  AUTOMATION_STATUS,
  BACKEND_PREFLIGHT_STATUS,
  RUNTIME_BACKEND_PROBE_STATUS,
  RUNTIME_E2E_PREFLIGHT_DEPENDENCY,
  RUNTIME_E2E_PROOF_LEVEL,
  buildAutomationCounters,
  buildRuntimePermissionDiagnostic,
  classifyRuntimeDiagnostic,
  classifyRuntimeServiceAction,
  classifyRuntimeServiceRequest,
  correlateRuntimeConsoleErrors,
  isRuntimeBackendServiceCategory,
  isOptionalRuntimeActivityRequest,
  normalizeRuntimeE2EReport,
  recordRuntimeServiceObservation,
  resolveRuntimePreflightStatus,
  runtimeServiceSummaryUnavailableReason,
  summarizeRuntimeBackendEvidence,
  summarizeRuntimeConsoleErrors,
} from '../src/lib/health/runtimeE2EReport.js';
import {
  buildRuntimeCapabilitySummary,
  classifyRuntimeE2ETarget,
  evaluateScenarioCapabilities,
  RUNTIME_E2E_TARGET_KIND,
} from '../src/lib/health/runtimeE2ECapabilities.js';
import {
  RUNTIME_E2E_EXECUTION_SCOPE,
  RUNTIME_E2E_SCENARIOS,
  RUNTIME_E2E_SUITE_ID,
} from '../src/lib/health/runtimeE2EScenarios.js';
import { RUNTIME_E2E_SCENARIO_HANDLERS } from '../tests/health-e2e/scenarioHandlers.mjs';
import { RuntimeScenarioHarness } from '../tests/health-e2e/runtimeHarness.mjs';

const ROOT = process.cwd();
const DEFAULT_BASE_URL = 'http://127.0.0.1:4174';
const TEST_RESULTS_ROOT = path.join(ROOT, 'test-results', 'health-e2e');
const PUBLIC_REPORT_PATH = path.join(ROOT, 'public', 'health-e2e', 'latest.json');
const STORAGE_STATE_PATH = resolveStorageState('KRONOX_E2E_STORAGE_STATE');
const STORAGE_STATE_A_PATH = resolveStorageState('KRONOX_E2E_STORAGE_STATE_A');
const STORAGE_STATE_B_PATH = resolveStorageState('KRONOX_E2E_STORAGE_STATE_B');

function resolveStorageState(name) {
  return process.env[name] ? path.resolve(ROOT, process.env[name]) : null;
}

function boolEnv(name) {
  return String(process.env[name] || '').trim().toLowerCase() === 'true';
}

function executionId() {
  return `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function readBuildMarker() {
  const source = await readFile(path.join(ROOT, 'src', 'components', 'dev', 'BuildMarker.jsx'), 'utf8');
  return source.match(/BUILD_MARKER\s*=\s*['"]([^'"]+)/)?.[1] || 'unknown';
}

async function envKeyHasValue(name) {
  if (String(process.env[name] || '').trim()) return true;
  const mode = process.env.NODE_ENV || 'development';
  const candidates = ['.env', '.env.local', `.env.${mode}`, `.env.${mode}.local`];
  for (const candidate of candidates) {
    try {
      const source = await readFile(path.join(ROOT, candidate), 'utf8');
      const line = source.split(/\r?\n/).find((item) => item.trim().startsWith(`${name}=`));
      if (line && line.slice(line.indexOf('=') + 1).trim().replace(/^['"]|['"]$/g, '')) return true;
    } catch (_) {}
  }
  return false;
}

async function waitForServer(baseUrl, timeoutMs = 30000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(baseUrl, { redirect: 'manual' });
      if (response.status < 500) return;
    } catch (_) {}
    await new Promise((resolve) => setTimeout(resolve, 350));
  }
  throw new Error(`Timed out waiting for ${new URL(baseUrl).origin}`);
}

async function startLocalServer(baseUrl) {
  if (process.env.KRONOX_E2E_BASE_URL) return null;
  const parsed = new URL(baseUrl);
  const child = spawn('npm', ['run', 'dev', '--', '--host', parsed.hostname, '--port', parsed.port], {
    cwd: ROOT,
    env: { ...process.env, BROWSER: 'none' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.on('data', () => {});
  child.stderr.on('data', () => {});
  try {
    await waitForServer(baseUrl);
    return child;
  } catch (error) {
    child.kill('SIGTERM');
    throw error;
  }
}

function stopLocalServer(server) {
  if (!server || server.killed) return;
  server.kill('SIGTERM');
}

function systemChromiumPath() {
  const candidates = [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
  ];
  return candidates.find(existsSync) || null;
}

async function launchBrowser() {
  try {
    return await chromium.launch({ headless: true });
  } catch (bundledError) {
    const executablePath = systemChromiumPath();
    if (!executablePath) throw bundledError;
    return chromium.launch({ headless: true, executablePath });
  }
}

function preflightNextAction(status) {
  if (status === BACKEND_PREFLIGHT_STATUS.APP_NOT_FOUND) {
    return 'Set the correct VITE_BASE44_APP_ID or approved app_id bootstrap and verify VITE_BASE44_APP_BASE_URL for this target.';
  }
  if (status === BACKEND_PREFLIGHT_STATUS.NOT_CONFIGURED) {
    return 'Set VITE_BASE44_APP_ID or provide app_id through the approved runtime bootstrap; an app base URL alone is insufficient here.';
  }
  if (status === BACKEND_PREFLIGHT_STATUS.UNREACHABLE) {
    return 'Verify network access and the deployed Base44 app endpoint, then rerun preflight.';
  }
  if (
    status === BACKEND_PREFLIGHT_STATUS.PROD_CUSTOM_DOMAIN_PREFLIGHT_UNSUPPORTED
    || status === BACKEND_PREFLIGHT_STATUS.PROD_RUNTIME_PROBE_REQUIRED
  ) {
    return 'Run the safe scenario-level probes; direct custom-domain preflight is not treated as backend proof.';
  }
  return 'Inspect the safe preflight service summary; direct observation was inconclusive.';
}

async function runRuntimePreflight(browser, baseUrl, environment) {
  const contextOptions = {
    viewport: { width: 390, height: 844 },
    locale: 'tr-TR',
    colorScheme: 'dark',
  };
  if (environment.hasStorageState) contextOptions.storageState = STORAGE_STATE_PATH;
  else if (environment.hasStorageStateA) contextOptions.storageState = STORAGE_STATE_A_PATH;
  const context = await browser.newContext(contextOptions);
  const page = await context.newPage();
  const consoleErrors = [];
  const permissionDiagnostics = [];
  const serviceSummary = {};
  const responseInspections = [];
  let appNotFound = false;
  let backendRequestObserved = false;
  let backendRequestFailed = false;
  let backendSuccessfulResponseObserved = false;

  const observeRequest = (request, outcome, status = null) => {
    const category = classifyRuntimeServiceRequest(request.url(), baseUrl, request.resourceType());
    const safeActionLabel = classifyRuntimeServiceAction(request.url(), category);
    recordRuntimeServiceObservation(serviceSummary, category, outcome, status, {
      observedAt: new Date().toISOString(),
      safeActionLabel,
    });
    if (!isRuntimeBackendServiceCategory(category)) return category;
    backendRequestObserved = true;
    if (
      !isOptionalRuntimeActivityRequest(request.url())
      && (outcome === 'FAILED' || outcome === 'ABORTED' || (outcome === 'RESPONSE' && Number(status) >= 400))
    ) {
      backendRequestFailed = true;
    }
    if (outcome === 'RESPONSE' && Number(status) >= 200 && Number(status) < 400) {
      backendSuccessfulResponseObserved = true;
    }
    return category;
  };

  page.on('console', (message) => {
    if (message.type() !== 'error') return;
    if (isOptionalRuntimeActivityRequest(message.location()?.url || '')) return;
    consoleErrors.push(message.text());
    if (/App not found/i.test(message.text())) appNotFound = true;
  });
  page.on('pageerror', (error) => {
    consoleErrors.push(`Unhandled promise rejection or page error: ${error?.message || 'Unknown browser error'}`);
  });
  page.on('request', (request) => {
    observeRequest(request, 'REQUEST');
  });
  page.on('requestfailed', (request) => {
    const failureText = String(request.failure()?.errorText || '');
    observeRequest(request, /abort|cancel/i.test(failureText) ? 'ABORTED' : 'FAILED');
  });
  page.on('response', (response) => {
    const request = response.request();
    const category = observeRequest(request, 'RESPONSE', response.status());
    if ((response.status() === 401 || response.status() === 403) && permissionDiagnostics.length < 20) {
      const diagnostic = buildRuntimePermissionDiagnostic({
        scenarioId: 'runtime_preflight',
        requestUrl: request.url(),
        configuredBaseUrl: baseUrl,
        resourceType: request.resourceType(),
        method: request.method(),
        status: response.status(),
      });
      if (!permissionDiagnostics.some((item) => item.fingerprint === diagnostic.fingerprint)) {
        permissionDiagnostics.push(diagnostic);
      }
    }
    if (isRuntimeBackendServiceCategory(category) && response.status() === 404) {
      responseInspections.push(response.text()
        .then((body) => {
          if (/App not found/i.test(body)) appNotFound = true;
        })
        .catch(() => null));
    }
  });

  let documentLoaded = false;
  try {
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    documentLoaded = true;
    await page.waitForTimeout(4000);
  } catch (_) {}
  await Promise.allSettled(responseInspections);

  const pageState = await page.evaluate(() => ({
    pageUrl: window.location.href,
    pageOrigin: window.location.origin,
    appRoute: window.location.pathname,
    appIdInRuntimeStorage: Boolean(window.localStorage.getItem('base44_app_id')),
    appBaseUrlInRuntimeStorage: Boolean(window.localStorage.getItem('base44_app_base_url')),
    guestCredentialPairInStorage: Boolean(
      window.localStorage.getItem('kronox.guestProfile.guest_id')
      && window.localStorage.getItem('kronox.guestProfile.guest_token'),
    ),
    homeVisible: Boolean(document.querySelector('[data-testid="home-screen"]')),
  })).catch(() => ({
    pageUrl: baseUrl,
    pageOrigin: new URL(baseUrl).origin,
    appRoute: '/',
    appIdInRuntimeStorage: false,
    appBaseUrlInRuntimeStorage: false,
    guestCredentialPairInStorage: false,
    homeVisible: false,
  }));
  const authenticatedOrStoredSession = Boolean(
    environment.hasStorageState || environment.hasStorageStateA || pageState.guestCredentialPairInStorage,
  );
  const appIdConfigured = environment.appIdEnvConfigured || pageState.appIdInRuntimeStorage;
  const appBaseUrlConfigured = environment.appBaseUrlEnvConfigured || pageState.appBaseUrlInRuntimeStorage;
  const runtimeConfiguredProduction = environment.productionCustomDomainMode
    && pageState.homeVisible
    && authenticatedOrStoredSession;
  const appConfigAvailable = appIdConfigured || runtimeConfiguredProduction;
  const reportableConsoleErrors = correlateRuntimeConsoleErrors(consoleErrors, permissionDiagnostics);
  const consoleErrorSummary = summarizeRuntimeConsoleErrors(reportableConsoleErrors);
  const hasCriticalAppDiagnostic = consoleErrorSummary.items.some((item) => (
    item.category === 'BASE44_APP_NOT_FOUND'
    || item.category === 'BASE44_APP_CONFIG_MISSING'
    || item.category === 'ACTOR_BOOTSTRAP_CONFIG_FAILURE'
  ));
  const directBackendPreflightStatus = appNotFound
    ? BACKEND_PREFLIGHT_STATUS.APP_NOT_FOUND
    : !appConfigAvailable
      ? BACKEND_PREFLIGHT_STATUS.NOT_CONFIGURED
      : backendSuccessfulResponseObserved
        ? BACKEND_PREFLIGHT_STATUS.REACHABLE
        : backendRequestObserved && backendRequestFailed
          ? BACKEND_PREFLIGHT_STATUS.UNREACHABLE
          : environment.productionCustomDomainMode && documentLoaded
            ? BACKEND_PREFLIGHT_STATUS.PROD_CUSTOM_DOMAIN_PREFLIGHT_UNSUPPORTED
            : documentLoaded
              ? BACKEND_PREFLIGHT_STATUS.OBSERVATION_INCONCLUSIVE
              : BACKEND_PREFLIGHT_STATUS.UNREACHABLE;
  const canRunRuntimeProbes = Boolean(
    environment.productionCustomDomainMode
    && documentLoaded
    && appConfigAvailable
    && pageState.homeVisible
    && authenticatedOrStoredSession
    && !appNotFound
    && !hasCriticalAppDiagnostic,
  );
  const status = resolveRuntimePreflightStatus({
    productionCustomDomainMode: environment.productionCustomDomainMode,
    directBackendPreflightStatus,
    canRunRuntimeProbes,
  });
  const runtimeBackendProbeStatus = directBackendPreflightStatus === BACKEND_PREFLIGHT_STATUS.REACHABLE
    ? RUNTIME_BACKEND_PROBE_STATUS.NOT_REQUIRED
    : canRunRuntimeProbes
      ? RUNTIME_BACKEND_PROBE_STATUS.REQUIRED
      : RUNTIME_BACKEND_PROBE_STATUS.NOT_RUN;
  const preflightStatusReason = directBackendPreflightStatus === BACKEND_PREFLIGHT_STATUS.REACHABLE
    ? 'A successful classified backend response was observed during direct preflight.'
    : canRunRuntimeProbes
      ? 'The production custom domain loaded Home with a restored actor session; direct backend observation is limited, so scenario-level runtime evidence is required.'
      : directBackendPreflightStatus === BACKEND_PREFLIGHT_STATUS.PROD_CUSTOM_DOMAIN_PREFLIGHT_UNSUPPORTED
        ? 'The production document loaded, but direct backend traffic was not observable and the actor/session prerequisites for safe runtime probes were incomplete.'
        : `Direct backend preflight resolved to ${directBackendPreflightStatus}.`;
  const preflightLimitations = environment.productionCustomDomainMode
    ? ['Production custom domains may proxy backend traffic through the app origin, so direct preflight is not treated as scenario backend proof.']
    : [];
  const backendProofLevel = directBackendPreflightStatus === BACKEND_PREFLIGHT_STATUS.REACHABLE
    ? RUNTIME_E2E_PROOF_LEVEL.BACKEND_CONNECTED
    : pageState.homeVisible && authenticatedOrStoredSession
      ? RUNTIME_E2E_PROOF_LEVEL.SESSION_RESTORED
      : RUNTIME_E2E_PROOF_LEVEL.UI_ONLY;
  await context.close();

  return {
    status,
    targetKind: environment.targetKind,
    productionCustomDomainMode: environment.productionCustomDomainMode,
    directBackendPreflightStatus,
    runtimeBackendProbeStatus,
    preflightStatusReason,
    documentLoaded,
    configuredBaseUrl: baseUrl,
    pageUrl: pageState.pageUrl,
    pageOrigin: pageState.pageOrigin,
    appRoute: pageState.appRoute,
    appIdConfigured,
    appBaseUrlConfigured,
    appConfigAvailable,
    base44AppReachable: directBackendPreflightStatus === BACKEND_PREFLIGHT_STATUS.REACHABLE,
    guestBootstrapAvailable: pageState.homeVisible && authenticatedOrStoredSession,
    actorBootstrapStatus: directBackendPreflightStatus === BACKEND_PREFLIGHT_STATUS.REACHABLE || canRunRuntimeProbes
      ? 'RUNTIME_PROBE_REQUIRED'
      : 'NOT_AVAILABLE',
    questionBootstrapStatus: directBackendPreflightStatus === BACKEND_PREFLIGHT_STATUS.REACHABLE || canRunRuntimeProbes
      ? 'RUNTIME_PROBE_REQUIRED'
      : 'NOT_AVAILABLE',
    onlineMatchmakingStatus: directBackendPreflightStatus === BACKEND_PREFLIGHT_STATUS.REACHABLE || canRunRuntimeProbes
      ? 'RUNTIME_PROBE_REQUIRED'
      : 'NOT_AVAILABLE',
    backendProofLevel,
    homeVisible: pageState.homeVisible,
    authenticatedOrStoredSession,
    bootstrapProofLevel: backendProofLevel,
    canRunRuntimeProbes,
    preflightLimitations,
    serviceSummary,
    serviceSummaryUnavailableReason: runtimeServiceSummaryUnavailableReason(serviceSummary),
    permissionDiagnostics,
    consoleErrors: reportableConsoleErrors,
    consoleErrorSummary,
    nextAction: directBackendPreflightStatus === BACKEND_PREFLIGHT_STATUS.REACHABLE ? null : preflightNextAction(status),
  };
}

function unavailableResult(definition, decision, evidence) {
  const status = decision.status === AUTOMATION_STATUS.MANUAL_EXTERNAL
    ? AUTOMATION_STATUS.MANUAL_EXTERNAL
    : AUTOMATION_STATUS.NOT_AUTOMATABLE;
  const failureCategory = decision.decision === 'MANUAL_EXTERNAL_REQUIRED'
    ? 'MANUAL_EXTERNAL_SETUP_GAP'
    : 'AUTOMATION_SETUP_GAP';
  const uiOnly = definition.executionScope === RUNTIME_E2E_EXECUTION_SCOPE.UI_ONLY;
  const proofLevel = status === AUTOMATION_STATUS.MANUAL_EXTERNAL
    ? RUNTIME_E2E_PROOF_LEVEL.MANUAL_EXTERNAL
    : uiOnly
      ? RUNTIME_E2E_PROOF_LEVEL.UI_ONLY
      : RUNTIME_E2E_PROOF_LEVEL.BACKEND_RUNTIME_PROBE;
  return {
    scenarioId: definition.scenarioId,
    scenarioTitle: definition.title,
    status,
    statusReason: decision.reason,
    durationMs: null,
    failureCategory,
    actual: decision.reason,
    requiredCapabilities: definition.requiredCapabilities,
    optionalCapabilities: definition.optionalCapabilities,
    capabilityStatus: [...decision.required, ...decision.optional],
    preflightDecision: decision.decision,
    proofLevel,
    backendEvidence: summarizeRuntimeBackendEvidence(),
    preflightDependency: uiOnly
      ? RUNTIME_E2E_PREFLIGHT_DEPENDENCY.NOT_REQUIRED
      : evidence?.preflight?.productionCustomDomainMode
        ? RUNTIME_E2E_PREFLIGHT_DEPENDENCY.RUNTIME_PROBE
        : RUNTIME_E2E_PREFLIGHT_DEPENDENCY.DIRECT,
    blockReason: decision.reason,
    steps: definition.steps.map((step) => ({
      ...step,
      status,
      actual: `Not executed: ${decision.reason}`,
      route: evidence?.appRoute || null,
      durationMs: null,
      failureCategory,
      screenshotPath: null,
      tracePath: null,
    })),
    consoleErrors: [],
    networkErrors: [],
    executionEvidence: evidence,
    relatedFiles: [],
    safeReproductionSteps: definition.steps.map((step) => step.action),
    safeSetupInstructions: decision.nextAction || definition.manualFallback,
    nextAction: decision.nextAction || definition.manualFallback,
    screenshotPath: null,
    tracePath: null,
  };
}

function unavailableResults(reason) {
  return RUNTIME_E2E_SCENARIOS.map((definition) => unavailableResult(definition, {
    status: definition.scenarioId === 'runtime_e2e.duello_two_context_runtime_sync'
      ? AUTOMATION_STATUS.MANUAL_EXTERNAL
      : AUTOMATION_STATUS.NOT_AUTOMATABLE,
    decision: definition.scenarioId === 'runtime_e2e.duello_two_context_runtime_sync'
      ? 'MANUAL_EXTERNAL_REQUIRED'
      : 'BLOCKED_BY_SETUP_GAP',
    reason,
    required: [],
    optional: [],
    nextAction: definition.manualFallback,
  }, null));
}

function unavailablePreflight(baseUrl, environment, error) {
  const diagnostic = classifyRuntimeDiagnostic(error);
  const directBackendPreflightStatus = environment.productionCustomDomainMode
    ? BACKEND_PREFLIGHT_STATUS.PROD_CUSTOM_DOMAIN_PREFLIGHT_UNSUPPORTED
    : BACKEND_PREFLIGHT_STATUS.OBSERVATION_INCONCLUSIVE;
  const preflightStatusReason = `Browser/server preflight could not run (${diagnostic.category}); no backend reachability claim was made.`;
  const serviceSummary = {};
  const preflightLimitations = ['A compatible headless browser was unavailable in this execution environment.'];
  if (environment.productionCustomDomainMode) {
    preflightLimitations.push('Production custom-domain runtime probes require a working browser session.');
  }
  return {
    status: resolveRuntimePreflightStatus({
      productionCustomDomainMode: environment.productionCustomDomainMode,
      directBackendPreflightStatus,
      canRunRuntimeProbes: false,
    }),
    targetKind: environment.targetKind,
    productionCustomDomainMode: environment.productionCustomDomainMode,
    directBackendPreflightStatus,
    runtimeBackendProbeStatus: RUNTIME_BACKEND_PROBE_STATUS.NOT_RUN,
    preflightStatusReason,
    documentLoaded: false,
    configuredBaseUrl: baseUrl,
    pageUrl: null,
    pageOrigin: null,
    appRoute: null,
    appIdConfigured: environment.appIdEnvConfigured,
    appBaseUrlConfigured: environment.appBaseUrlEnvConfigured,
    appConfigAvailable: environment.appIdEnvConfigured && environment.appBaseUrlEnvConfigured,
    base44AppReachable: false,
    guestBootstrapAvailable: false,
    actorBootstrapStatus: 'NOT_AVAILABLE',
    questionBootstrapStatus: 'NOT_AVAILABLE',
    onlineMatchmakingStatus: 'NOT_AVAILABLE',
    backendProofLevel: RUNTIME_E2E_PROOF_LEVEL.UI_ONLY,
    homeVisible: false,
    authenticatedOrStoredSession: false,
    bootstrapProofLevel: RUNTIME_E2E_PROOF_LEVEL.UI_ONLY,
    canRunRuntimeProbes: false,
    preflightLimitations,
    serviceSummary,
    serviceSummaryUnavailableReason: runtimeServiceSummaryUnavailableReason(serviceSummary),
    permissionDiagnostics: [],
    consoleErrors: [diagnostic],
    consoleErrorSummary: summarizeRuntimeConsoleErrors([diagnostic]),
    nextAction: 'Make a compatible headless browser available, then rerun Runtime E2E.',
    backendAvailable: false,
  };
}

async function runScenario(browser, definition, config, evidence, decision, runArtifactDir) {
  const isTwoActorDuello = definition.scenarioId === 'runtime_e2e.duello_two_context_runtime_sync'
    && config.hasTwoStorageStates;
  const contextOptions = {
    viewport: { width: 390, height: 844 },
    locale: 'tr-TR',
    colorScheme: 'dark',
  };
  if (isTwoActorDuello) contextOptions.storageState = STORAGE_STATE_A_PATH;
  else if (config.hasStorageState) contextOptions.storageState = STORAGE_STATE_PATH;
  else if (config.hasStorageStateA) contextOptions.storageState = STORAGE_STATE_A_PATH;
  const context = await browser.newContext(contextOptions);
  await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
  const page = await context.newPage();
  let secondaryContext = null;
  let secondaryPage = null;
  if (isTwoActorDuello) {
    secondaryContext = await browser.newContext({
      ...contextOptions,
      storageState: STORAGE_STATE_B_PATH,
    });
    await secondaryContext.tracing.start({ screenshots: true, snapshots: true, sources: true });
    secondaryPage = await secondaryContext.newPage();
  }
  const harness = new RuntimeScenarioHarness({
    definition,
    context,
    page,
    secondaryContext,
    secondaryPage,
    reportEvidence: evidence,
    artifactDir: runArtifactDir,
  });
  let error = null;
  try {
    const handler = RUNTIME_E2E_SCENARIO_HANDLERS[definition.scenarioId];
    if (!handler) throw new Error(`No runtime handler is registered for ${definition.scenarioId}.`);
    await handler(harness, config);
  } catch (scenarioError) {
    error = scenarioError;
  }

  let result = harness.result(error);
  if (result.status === AUTOMATION_STATUS.FAIL || result.screenshotPath) {
    const tracePath = path.join(runArtifactDir, `${definition.scenarioId.replace(/[^a-z0-9]+/gi, '-')}.zip`);
    try {
      await context.tracing.stop({ path: tracePath });
      harness.attachTrace(tracePath);
    } catch (_) {}
    if (secondaryContext) {
      const secondaryTracePath = path.join(runArtifactDir, `${definition.scenarioId.replace(/[^a-z0-9]+/gi, '-')}-actor-b.zip`);
      try {
        await secondaryContext.tracing.stop({ path: secondaryTracePath });
      } catch (_) {}
    }
    result = harness.result(error);
  } else {
    try {
      await context.tracing.stop();
    } catch (_) {}
    if (secondaryContext) {
      try {
        await secondaryContext.tracing.stop();
      } catch (_) {}
    }
  }
  if (secondaryContext) await secondaryContext.close();
  await context.close();
  const uiOnly = definition.executionScope === RUNTIME_E2E_EXECUTION_SCOPE.UI_ONLY;
  const backendConnected = result.backendEvidence?.observed === true
    && result.backendEvidence?.successful === true;
  const sessionRestored = definition.scenarioId === 'runtime_e2e.app_bootstrap_guest_home'
    && result.status === AUTOMATION_STATUS.PASS
    && evidence.preflight.homeVisible
    && evidence.preflight.authenticatedOrStoredSession;
  const proofLevel = uiOnly
    ? RUNTIME_E2E_PROOF_LEVEL.UI_ONLY
    : result.status === AUTOMATION_STATUS.MANUAL_EXTERNAL
      ? RUNTIME_E2E_PROOF_LEVEL.MANUAL_EXTERNAL
      : backendConnected
        ? RUNTIME_E2E_PROOF_LEVEL.BACKEND_CONNECTED
        : sessionRestored
          ? RUNTIME_E2E_PROOF_LEVEL.SESSION_RESTORED
          : RUNTIME_E2E_PROOF_LEVEL.BACKEND_RUNTIME_PROBE;
  const preflightDependency = uiOnly
    ? RUNTIME_E2E_PREFLIGHT_DEPENDENCY.NOT_REQUIRED
    : evidence.preflight.directBackendPreflightStatus === BACKEND_PREFLIGHT_STATUS.REACHABLE
      ? RUNTIME_E2E_PREFLIGHT_DEPENDENCY.DIRECT
      : RUNTIME_E2E_PREFLIGHT_DEPENDENCY.RUNTIME_PROBE;
  const passReason = uiOnly
    ? 'Browser-only UI assertions passed with UI_ONLY proof; this is not backend proof.'
    : proofLevel === RUNTIME_E2E_PROOF_LEVEL.SESSION_RESTORED
      ? 'Home and the stored actor session were restored; this SESSION_RESTORED result is not full backend proof.'
      : proofLevel === RUNTIME_E2E_PROOF_LEVEL.BACKEND_CONNECTED
        ? `Scenario assertions passed with a successful ${result.backendEvidence.category} runtime response.`
        : result.actual;
  return {
    ...result,
    requiredCapabilities: definition.requiredCapabilities,
    optionalCapabilities: definition.optionalCapabilities,
    capabilityStatus: [...decision.required, ...decision.optional],
    preflightDecision: decision.decision,
    proofLevel,
    preflightDependency,
    blockReason: result.status === AUTOMATION_STATUS.PASS ? null : result.actual,
    statusReason: result.status === AUTOMATION_STATUS.PASS ? passReason : result.actual,
    safeSetupInstructions: decision.nextAction || definition.manualFallback,
  };
}

function mergeServiceSummaries(...summaries) {
  const merged = {};
  for (const summary of summaries) {
    for (const [category, entry] of Object.entries(summary || {})) {
      const current = merged[category] || {
        category,
        safeActionLabels: [],
        requests: 0,
        responses: 0,
        failures: 0,
        aborted: 0,
        cancelled: 0,
        noResponseTimeouts: 0,
        statusClasses: {},
        requestedAt: null,
        lastRequestedAt: null,
        completedAt: null,
        lastCompletedAt: null,
        lastOutcome: null,
      };
      current.safeActionLabels = [...new Set([
        ...current.safeActionLabels,
        ...(Array.isArray(entry?.safeActionLabels) ? entry.safeActionLabels : []),
      ])];
      current.requests += Number(entry?.requests || 0);
      current.responses += Number(entry?.responses || 0);
      current.failures += Number(entry?.failures || 0);
      current.aborted += Number(entry?.aborted || 0);
      current.cancelled += Number(entry?.cancelled || 0);
      current.noResponseTimeouts += Number(entry?.noResponseTimeouts || 0);
      current.requestedAt ||= entry?.requestedAt || null;
      current.lastRequestedAt = entry?.lastRequestedAt || current.lastRequestedAt;
      current.completedAt ||= entry?.completedAt || null;
      current.lastCompletedAt = entry?.lastCompletedAt || current.lastCompletedAt;
      current.lastOutcome = entry?.lastOutcome || current.lastOutcome;
      for (const [statusClass, count] of Object.entries(entry?.statusClasses || {})) {
        current.statusClasses[statusClass] = (current.statusClasses[statusClass] || 0) + Number(count || 0);
      }
      merged[category] = current;
    }
  }
  return merged;
}

function finalizeRuntimeProbe(preflight, scenarios) {
  const scenarioSummaries = scenarios.map((scenario) => scenario?.serviceSummary || {});
  const serviceSummary = mergeServiceSummaries(preflight?.serviceSummary || {}, ...scenarioSummaries);
  const backendScenarios = scenarios.filter((scenario) => (
    scenario?.proofLevel !== RUNTIME_E2E_PROOF_LEVEL.UI_ONLY
    && scenario?.proofLevel !== RUNTIME_E2E_PROOF_LEVEL.MANUAL_EXTERNAL
  ));
  const connected = backendScenarios.some((scenario) => (
    scenario?.backendEvidence?.observed === true && scenario?.backendEvidence?.successful === true
  ));
  const failed = backendScenarios.some((scenario) => (
    scenario?.backendEvidence?.observed === true
    && scenario?.backendEvidence?.successful === false
    && scenario?.backendEvidence?.statusClass !== 'no_response'
  ));
  const attempted = backendScenarios.some((scenario) => scenario?.preflightDependency === RUNTIME_E2E_PREFLIGHT_DEPENDENCY.RUNTIME_PROBE);
  const runtimeBackendProbeStatus = connected
    ? RUNTIME_BACKEND_PROBE_STATUS.CONNECTED
    : failed
      ? RUNTIME_BACKEND_PROBE_STATUS.FAILED
      : attempted
        ? RUNTIME_BACKEND_PROBE_STATUS.NOT_OBSERVED
        : preflight?.directBackendPreflightStatus === BACKEND_PREFLIGHT_STATUS.REACHABLE
          ? RUNTIME_BACKEND_PROBE_STATUS.NOT_REQUIRED
          : preflight?.canRunRuntimeProbes
            ? RUNTIME_BACKEND_PROBE_STATUS.REQUIRED
            : RUNTIME_BACKEND_PROBE_STATUS.NOT_RUN;
  const backendAvailable = preflight?.directBackendPreflightStatus === BACKEND_PREFLIGHT_STATUS.REACHABLE || connected;
  const backendProofLevel = connected || preflight?.directBackendPreflightStatus === BACKEND_PREFLIGHT_STATUS.REACHABLE
    ? RUNTIME_E2E_PROOF_LEVEL.BACKEND_CONNECTED
    : preflight?.homeVisible && preflight?.authenticatedOrStoredSession
      ? RUNTIME_E2E_PROOF_LEVEL.SESSION_RESTORED
      : RUNTIME_E2E_PROOF_LEVEL.UI_ONLY;
  return {
    ...preflight,
    runtimeBackendProbeStatus,
    serviceSummary,
    serviceSummaryUnavailableReason: runtimeServiceSummaryUnavailableReason(serviceSummary),
    backendProofLevel,
    base44AppReachable: backendAvailable,
    backendAvailable,
  };
}

async function persistReport(report, runArtifactDir) {
  await mkdir(runArtifactDir, { recursive: true });
  await mkdir(path.dirname(PUBLIC_REPORT_PATH), { recursive: true });
  const json = `${JSON.stringify(report, null, 2)}\n`;
  await writeFile(path.join(runArtifactDir, 'report.json'), json);
  await writeFile(path.join(TEST_RESULTS_ROOT, 'latest.json'), json);
  await writeFile(PUBLIC_REPORT_PATH, json);
}

async function buildEnvironment(baseUrl) {
  const targetKind = classifyRuntimeE2ETarget(baseUrl);
  return {
    targetKind,
    productionCustomDomainMode: targetKind === RUNTIME_E2E_TARGET_KIND.PRODUCTION_CUSTOM_DOMAIN,
    configuredBaseUrl: baseUrl,
    appIdEnvConfigured: await envKeyHasValue('VITE_BASE44_APP_ID'),
    appBaseUrlEnvConfigured: await envKeyHasValue('VITE_BASE44_APP_BASE_URL'),
    hasStorageState: Boolean(STORAGE_STATE_PATH && existsSync(STORAGE_STATE_PATH)),
    hasStorageStateA: Boolean(STORAGE_STATE_A_PATH && existsSync(STORAGE_STATE_A_PATH)),
    hasStorageStateB: Boolean(STORAGE_STATE_B_PATH && existsSync(STORAGE_STATE_B_PATH)),
    allowWheelSpin: boolEnv('KRONOX_E2E_ALLOW_WHEEL_SPIN'),
    allowDiamondPurchase: boolEnv('KRONOX_E2E_ALLOW_DIAMOND_PURCHASE'),
    allowMatchmaking: boolEnv('KRONOX_E2E_ALLOW_MATCHMAKING'),
  };
}

async function main() {
  const baseUrl = process.env.KRONOX_E2E_BASE_URL || DEFAULT_BASE_URL;
  const runId = executionId();
  const runArtifactDir = path.join(TEST_RESULTS_ROOT, runId);
  const buildMarker = await readBuildMarker();
  const startedAt = new Date().toISOString();
  const environment = await buildEnvironment(baseUrl);
  const config = {
    baseUrl,
    hasStorageState: environment.hasStorageState,
    hasStorageStateA: environment.hasStorageStateA,
    hasStorageStateB: environment.hasStorageStateB,
    hasTwoStorageStates: environment.hasStorageStateA && environment.hasStorageStateB,
    hasBackendService: false,
    canRunBackendProbe: false,
    allowWheelSpin: environment.allowWheelSpin,
    allowDiamondPurchase: environment.allowDiamondPurchase,
    allowMatchmaking: environment.allowMatchmaking,
  };

  if (process.argv.includes('--list')) {
    process.stdout.write(`${RUNTIME_E2E_SCENARIOS.map((scenario) => scenario.scenarioId).join('\n')}\n`);
    return;
  }

  let server = null;
  let browser = null;
  let scenarios;
  let setupError = null;
  let evidence = null;
  let preflight = null;
  let capabilitySummary = {};
  try {
    server = await startLocalServer(baseUrl);
    browser = await launchBrowser();
    preflight = await runRuntimePreflight(browser, baseUrl, environment);
    capabilitySummary = buildRuntimeCapabilitySummary({
      browserAvailable: true,
      preflight,
      environment,
    });
    config.hasBackendService = preflight.directBackendPreflightStatus === BACKEND_PREFLIGHT_STATUS.REACHABLE;
    config.canRunBackendProbe = config.hasBackendService || preflight.canRunRuntimeProbes;
    evidence = {
      executionId: runId,
      browserName: `chromium ${browser.version()}`,
      configuredBaseUrl: baseUrl,
      pageUrl: preflight.pageUrl,
      pageOrigin: preflight.pageOrigin,
      baseUrlOrigin: preflight.pageOrigin,
      appRoute: preflight.appRoute,
      contextCount: environment.hasStorageStateA && environment.hasStorageStateB ? 2 : 1,
      deterministicPairing: false,
      deterministicResultFixture: false,
      preflight,
      backendPreflight: preflight,
      environment,
      capabilitySummary,
    };
    scenarios = [];
    for (const definition of RUNTIME_E2E_SCENARIOS) {
      const decision = evaluateScenarioCapabilities(definition, capabilitySummary);
      process.stdout.write(`Running ${definition.scenarioId}: ${decision.decision}\n`);
      if (!decision.canRun) {
        scenarios.push(unavailableResult(definition, decision, evidence));
        continue;
      }
      scenarios.push(await runScenario(browser, definition, config, evidence, decision, runArtifactDir));
    }
    preflight = finalizeRuntimeProbe(preflight, scenarios);
    evidence.preflight = preflight;
    evidence.backendPreflight = preflight;
  } catch (error) {
    setupError = error;
    preflight = unavailablePreflight(baseUrl, environment, error);
    capabilitySummary = buildRuntimeCapabilitySummary({
      browserAvailable: false,
      preflight,
      environment,
    });
    scenarios = unavailableResults(preflight.preflightStatusReason);
  } finally {
    if (browser) await browser.close();
    stopLocalServer(server);
  }

  const rawReport = {
    type: 'KRONOX_RUNTIME_E2E_AUTOMATION_REPORT',
    version: 2,
    suiteId: RUNTIME_E2E_SUITE_ID,
    runId,
    generatedAt: new Date().toISOString(),
    startedAt,
    finishedAt: new Date().toISOString(),
    buildMarker,
    targetKind: environment.targetKind,
    productionCustomDomainMode: environment.productionCustomDomainMode,
    configuredBaseUrl: baseUrl,
    pageUrl: preflight?.pageUrl || null,
    pageOrigin: preflight?.pageOrigin || null,
    appRoute: preflight?.appRoute || null,
    preflight,
    directBackendPreflightStatus: preflight?.directBackendPreflightStatus || null,
    runtimeBackendProbeStatus: preflight?.runtimeBackendProbeStatus || RUNTIME_BACKEND_PROBE_STATUS.NOT_RUN,
    preflightStatusReason: preflight?.preflightStatusReason || null,
    serviceSummary: preflight?.serviceSummary || {},
    serviceSummaryUnavailableReason: preflight?.serviceSummaryUnavailableReason || null,
    backendProofLevel: preflight?.backendProofLevel || RUNTIME_E2E_PROOF_LEVEL.UI_ONLY,
    homeVisible: Boolean(preflight?.homeVisible),
    authenticatedOrStoredSession: Boolean(preflight?.authenticatedOrStoredSession),
    canRunRuntimeProbes: Boolean(preflight?.canRunRuntimeProbes),
    preflightLimitations: preflight?.preflightLimitations || [],
    environment,
    capabilitySummary,
    backendAvailable: Boolean(preflight?.backendAvailable),
    appConfigAvailable: Boolean(preflight?.appConfigAvailable),
    base44AppReachable: Boolean(preflight?.base44AppReachable),
    executionEvidence: setupError ? null : evidence,
    scenarios,
  };
  rawReport.counts = buildAutomationCounters(scenarios);
  const report = normalizeRuntimeE2EReport(rawReport, buildMarker);
  await persistReport(report, runArtifactDir);

  process.stdout.write(`${JSON.stringify({
    runId,
    buildMarker,
    preflightStatus: report.preflight?.status || 'UNAVAILABLE',
    counts: report.counts,
    reportPath: 'test-results/health-e2e/latest.json',
  }, null, 2)}\n`);
  if (report.counts.automationFailed > 0) process.exitCode = 1;
}

main().catch((error) => {
  process.stderr.write(`Runtime E2E runner failed safely: ${error?.message || error}\n`);
  process.exitCode = 1;
});
