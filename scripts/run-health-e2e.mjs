import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

import { chromium } from '@playwright/test';

import {
  AUTOMATION_STATUS,
  buildAutomationCounters,
  normalizeRuntimeE2EReport,
} from '../src/lib/health/runtimeE2EReport.js';
import {
  RUNTIME_E2E_SCENARIOS,
  RUNTIME_E2E_SUITE_ID,
} from '../src/lib/health/runtimeE2EScenarios.js';
import { RUNTIME_E2E_SCENARIO_HANDLERS } from '../tests/health-e2e/scenarioHandlers.mjs';
import { RuntimeScenarioHarness } from '../tests/health-e2e/runtimeHarness.mjs';

const ROOT = process.cwd();
const DEFAULT_BASE_URL = 'http://127.0.0.1:4174';
const TEST_RESULTS_ROOT = path.join(ROOT, 'test-results', 'health-e2e');
const PUBLIC_REPORT_PATH = path.join(ROOT, 'public', 'health-e2e', 'latest.json');
const STORAGE_STATE_PATH = process.env.KRONOX_E2E_STORAGE_STATE
  ? path.resolve(ROOT, process.env.KRONOX_E2E_STORAGE_STATE)
  : null;

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

async function waitForServer(baseUrl, timeoutMs = 30000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(baseUrl, { redirect: 'manual' });
      if (response.status < 500) return;
    } catch (_) {}
    await new Promise((resolve) => setTimeout(resolve, 350));
  }
  throw new Error(`Timed out waiting for ${baseUrl}`);
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

function unavailableResults(reason, status = AUTOMATION_STATUS.NOT_AUTOMATABLE) {
  return RUNTIME_E2E_SCENARIOS.map((scenario) => ({
    scenarioId: scenario.scenarioId,
    scenarioTitle: scenario.title,
    status: scenario.scenarioId === 'runtime_e2e.duello_two_context_runtime_sync'
      ? AUTOMATION_STATUS.MANUAL_EXTERNAL
      : status,
    durationMs: null,
    failureCategory: 'AUTOMATION_SETUP_GAP',
    actual: reason,
    steps: scenario.steps.map((step) => ({
      ...step,
      status: scenario.scenarioId === 'runtime_e2e.duello_two_context_runtime_sync'
        ? AUTOMATION_STATUS.MANUAL_EXTERNAL
        : status,
      actual: `Not executed: ${reason}`,
      route: null,
      durationMs: null,
      screenshotPath: null,
      tracePath: null,
    })),
    consoleErrors: [],
    networkErrors: [],
    relatedFiles: [],
    safeReproductionSteps: scenario.steps.map((step) => step.action),
    nextAction: scenario.manualFallback,
  }));
}

async function runScenario(browser, definition, config, evidence, runArtifactDir) {
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
  if (result.status === AUTOMATION_STATUS.FAIL) {
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
  return result;
}

async function persistReport(report, runArtifactDir) {
  await mkdir(runArtifactDir, { recursive: true });
  await mkdir(path.dirname(PUBLIC_REPORT_PATH), { recursive: true });
  const json = `${JSON.stringify(report, null, 2)}\n`;
  await writeFile(path.join(runArtifactDir, 'report.json'), json);
  await writeFile(path.join(TEST_RESULTS_ROOT, 'latest.json'), json);
  await writeFile(PUBLIC_REPORT_PATH, json);
}

async function main() {
  const baseUrl = process.env.KRONOX_E2E_BASE_URL || DEFAULT_BASE_URL;
  const runId = executionId();
  const runArtifactDir = path.join(TEST_RESULTS_ROOT, runId);
  const buildMarker = await readBuildMarker();
  const startedAt = new Date().toISOString();
  const config = {
    baseUrl,
    hasStorageState: Boolean(STORAGE_STATE_PATH && existsSync(STORAGE_STATE_PATH)),
    hasBackendService: Boolean(process.env.KRONOX_E2E_BASE_URL || process.env.VITE_BASE44_APP_BASE_URL),
    allowWheelSpin: boolEnv('KRONOX_E2E_ALLOW_WHEEL_SPIN'),
    allowDiamondPurchase: boolEnv('KRONOX_E2E_ALLOW_DIAMOND_PURCHASE'),
    allowMatchmaking: boolEnv('KRONOX_E2E_ALLOW_MATCHMAKING'),
  };

  if (process.argv.includes('--list')) {
    process.stdout.write(`${RUNTIME_E2E_SCENARIOS.map((scenario) => scenario.scenarioId).join('\n')}\n`);
    return;
  }

  let server = null;
  let browser = null;
  let scenarios;
  let setupError = null;
  try {
    server = await startLocalServer(baseUrl);
    browser = await launchBrowser();
    const version = browser.version();
    const evidence = {
      executionId: runId,
      browserName: `chromium ${version}`,
      baseUrlOrigin: new URL(baseUrl).origin,
      contextCount: 1,
      deterministicPairing: false,
      deterministicClaimFixture: false,
    };
    scenarios = [];
    for (const definition of RUNTIME_E2E_SCENARIOS) {
      process.stdout.write(`Running ${definition.scenarioId}\n`);
      scenarios.push(await runScenario(browser, definition, config, evidence, runArtifactDir));
    }
  } catch (error) {
    setupError = error;
    scenarios = unavailableResults(`Browser/server setup unavailable: ${error?.message || error}`);
  } finally {
    if (browser) await browser.close();
    stopLocalServer(server);
  }

  const rawReport = {
    type: 'KRONOX_RUNTIME_E2E_AUTOMATION_REPORT',
    version: 1,
    suiteId: RUNTIME_E2E_SUITE_ID,
    runId,
    generatedAt: new Date().toISOString(),
    startedAt,
    finishedAt: new Date().toISOString(),
    buildMarker,
    executionEvidence: setupError ? null : scenarios.find((item) => item.executionEvidence)?.executionEvidence,
    scenarios,
  };
  rawReport.counts = buildAutomationCounters(scenarios);
  const report = normalizeRuntimeE2EReport(rawReport, buildMarker);
  await persistReport(report, runArtifactDir);

  process.stdout.write(`${JSON.stringify({ runId, buildMarker, counts: report.counts, reportPath: 'test-results/health-e2e/latest.json' }, null, 2)}\n`);
  if (report.counts.automationFailed > 0) process.exitCode = 1;
}

main().catch((error) => {
  process.stderr.write(`Runtime E2E runner failed safely: ${error?.message || error}\n`);
  process.exitCode = 1;
});
