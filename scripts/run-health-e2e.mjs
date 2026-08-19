import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

import { chromium } from '@playwright/test';

import {
  AUTOMATION_STATUS,
  BACKEND_PREFLIGHT_STATUS,
  buildAutomationCounters,
  normalizeRuntimeE2EReport,
  summarizeRuntimeConsoleErrors,
} from '../src/lib/health/runtimeE2EReport.js';
import {
  buildRuntimeCapabilitySummary,
  evaluateScenarioCapabilities,
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

function isBase44Request(requestUrl, baseUrl) {
  try {
    const request = new URL(requestUrl);
    const local = new URL(baseUrl);
    if (request.origin === local.origin) return false;
    return /base44/i.test(request.hostname) || /(?:\/api\/apps\/|\/functions\/|\/auth\/)/i.test(request.pathname);
  } catch (_) {
    return false;
  }
}

function serviceCategory(requestUrl) {
  const value = String(requestUrl || '').toLowerCase();
  if (/getquestions/.test(value)) return 'question_service';
  if (/randommatchmaking/.test(value)) return 'online_matchmaking';
  if (/createguestprofile|\/auth\//.test(value)) return 'actor_bootstrap';
  if (/dailywheel/.test(value)) return 'daily_wheel';
  if (/leaderboard/.test(value)) return 'leaderboard';
  return 'base_app';
}

function serviceSummaryEntry(summary, category, outcome) {
  const current = summary[category] || { requests: 0, responses: 0, failures: 0, statusClasses: {} };
  current.requests += outcome === 'REQUEST' ? 1 : 0;
  current.responses += typeof outcome === 'number' ? 1 : 0;
  current.failures += outcome === 'FAILED' ? 1 : 0;
  if (typeof outcome === 'number') {
    const statusClass = `${Math.floor(outcome / 100)}xx`;
    current.statusClasses[statusClass] = (current.statusClasses[statusClass] || 0) + 1;
  }
  summary[category] = current;
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
  return 'Inspect the safe preflight service summary and provide a valid app configuration.';
}

async function runRuntimePreflight(browser, baseUrl, environment) {
  const contextOptions = {
    viewport: { width: 390, height: 844 },
    locale: 'tr-TR',
    colorScheme: 'dark',
  };
  if (environment.hasStorageState) contextOptions.storageState = STORAGE_STATE_PATH;
  const context = await browser.newContext(contextOptions);
  const page = await context.newPage();
  const consoleErrors = [];
  const serviceSummary = {};
  const responseInspections = [];
  let appNotFound = false;
  let backendRequestObserved = false;
  let backendRequestFailed = false;
  let backendValidResponseObserved = false;

  page.on('console', (message) => {
    if (message.type() !== 'error') return;
    consoleErrors.push(message.text());
    if (/App not found/i.test(message.text())) appNotFound = true;
  });
  page.on('request', (request) => {
    if (!isBase44Request(request.url(), baseUrl)) return;
    backendRequestObserved = true;
    serviceSummaryEntry(serviceSummary, serviceCategory(request.url()), 'REQUEST');
  });
  page.on('requestfailed', (request) => {
    if (!isBase44Request(request.url(), baseUrl)) return;
    backendRequestObserved = true;
    backendRequestFailed = true;
    serviceSummaryEntry(serviceSummary, serviceCategory(request.url()), 'FAILED');
  });
  page.on('response', (response) => {
    if (!isBase44Request(response.url(), baseUrl)) return;
    backendRequestObserved = true;
    serviceSummaryEntry(serviceSummary, serviceCategory(response.url()), response.status());
    if (response.status() !== 404 && response.status() < 500) backendValidResponseObserved = true;
    if (response.status() === 404) {
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
  } catch (_) {
    backendRequestFailed = true;
  }
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
  const appIdConfigured = environment.appIdEnvConfigured || pageState.appIdInRuntimeStorage;
  const appBaseUrlConfigured = environment.appBaseUrlEnvConfigured || pageState.appBaseUrlInRuntimeStorage;
  const appConfigAvailable = appIdConfigured;
  const status = appNotFound
    ? BACKEND_PREFLIGHT_STATUS.APP_NOT_FOUND
    : !appConfigAvailable
      ? BACKEND_PREFLIGHT_STATUS.NOT_CONFIGURED
      : backendValidResponseObserved
        ? BACKEND_PREFLIGHT_STATUS.REACHABLE
        : backendRequestObserved || backendRequestFailed
          ? BACKEND_PREFLIGHT_STATUS.UNREACHABLE
          : BACKEND_PREFLIGHT_STATUS.UNKNOWN;
  const consoleErrorSummary = summarizeRuntimeConsoleErrors(consoleErrors);
  await context.close();

  return {
    status,
    documentLoaded,
    configuredBaseUrl: baseUrl,
    pageUrl: pageState.pageUrl,
    pageOrigin: pageState.pageOrigin,
    appRoute: pageState.appRoute,
    appIdConfigured,
    appBaseUrlConfigured,
    appConfigAvailable,
    base44AppReachable: status === BACKEND_PREFLIGHT_STATUS.REACHABLE,
    guestBootstrapAvailable: status === BACKEND_PREFLIGHT_STATUS.REACHABLE
      && (pageState.homeVisible || pageState.guestCredentialPairInStorage || environment.hasStorageState),
    actorBootstrapStatus: status === BACKEND_PREFLIGHT_STATUS.REACHABLE ? 'RUNTIME_PROBE_REQUIRED' : 'NOT_AVAILABLE',
    questionBootstrapStatus: status === BACKEND_PREFLIGHT_STATUS.REACHABLE ? 'RUNTIME_PROBE_REQUIRED' : 'NOT_AVAILABLE',
    onlineMatchmakingStatus: status === BACKEND_PREFLIGHT_STATUS.REACHABLE ? 'RUNTIME_PROBE_REQUIRED' : 'NOT_AVAILABLE',
    serviceSummary,
    consoleErrors,
    consoleErrorSummary,
    nextAction: status === BACKEND_PREFLIGHT_STATUS.REACHABLE ? null : preflightNextAction(status),
  };
}

function unavailableResult(definition, decision, evidence) {
  const status = decision.status === AUTOMATION_STATUS.MANUAL_EXTERNAL
    ? AUTOMATION_STATUS.MANUAL_EXTERNAL
    : AUTOMATION_STATUS.NOT_AUTOMATABLE;
  const failureCategory = decision.decision === 'MANUAL_EXTERNAL_REQUIRED'
    ? 'MANUAL_EXTERNAL_SETUP_GAP'
    : 'AUTOMATION_SETUP_GAP';
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

async function runScenario(browser, definition, config, evidence, decision, runArtifactDir) {
  const contextOptions = {
    viewport: { width: 390, height: 844 },
    locale: 'tr-TR',
    colorScheme: 'dark',
  };
  if (config.hasStorageState) contextOptions.storageState = STORAGE_STATE_PATH;
  const context = await browser.newContext(contextOptions);
  await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
  const page = await context.newPage();
  const harness = new RuntimeScenarioHarness({
    definition,
    context,
    page,
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
    result = harness.result(error);
  } else {
    try {
      await context.tracing.stop();
    } catch (_) {}
  }
  await context.close();
  const uiOnlyWithoutBackend = definition.executionScope === RUNTIME_E2E_EXECUTION_SCOPE.UI_ONLY
    && evidence.preflight.status !== BACKEND_PREFLIGHT_STATUS.REACHABLE;
  return {
    ...result,
    requiredCapabilities: definition.requiredCapabilities,
    optionalCapabilities: definition.optionalCapabilities,
    capabilityStatus: [...decision.required, ...decision.optional],
    preflightDecision: decision.decision,
    statusReason: result.status === AUTOMATION_STATUS.PASS && uiOnlyWithoutBackend
      ? 'Browser-only UI assertions passed; backend preflight was unavailable, so this is explicitly not backend proof.'
      : result.actual,
    safeSetupInstructions: decision.nextAction || definition.manualFallback,
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
  return {
    targetKind: process.env.KRONOX_E2E_BASE_URL ? 'configured' : 'local-vite',
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
    hasBackendService: false,
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
    config.hasBackendService = preflight.status === BACKEND_PREFLIGHT_STATUS.REACHABLE;
    evidence = {
      executionId: runId,
      browserName: `chromium ${browser.version()}`,
      configuredBaseUrl: baseUrl,
      pageUrl: preflight.pageUrl,
      pageOrigin: preflight.pageOrigin,
      baseUrlOrigin: preflight.pageOrigin,
      appRoute: preflight.appRoute,
      contextCount: 1,
      deterministicPairing: false,
      deterministicClaimFixture: false,
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
  } catch (error) {
    setupError = error;
    scenarios = unavailableResults(`Browser/server preflight unavailable: ${error?.message || error}`);
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
    configuredBaseUrl: baseUrl,
    pageUrl: preflight?.pageUrl || null,
    pageOrigin: preflight?.pageOrigin || null,
    appRoute: preflight?.appRoute || null,
    preflight,
    environment,
    capabilitySummary,
    backendAvailable: preflight?.status === BACKEND_PREFLIGHT_STATUS.REACHABLE,
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
