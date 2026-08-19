import path from 'node:path';

import {
  AUTOMATION_STATUS,
  sanitizeAutomationValue,
  summarizeRuntimeConsoleErrors,
} from '../../src/lib/health/runtimeE2EReport.js';

export class AutomationSetupGap extends Error {
  constructor(message, status = AUTOMATION_STATUS.NOT_AUTOMATABLE) {
    super(message);
    this.name = 'AutomationSetupGap';
    this.automationStatus = status;
  }
}

export function requireCapability(condition, message, status) {
  if (!condition) throw new AutomationSetupGap(message, status);
}

function relativeArtifactPath(value) {
  if (!value) return null;
  const normalized = String(value).replace(/\\/g, '/');
  const marker = normalized.indexOf('test-results/health-e2e/');
  return marker >= 0 ? normalized.slice(marker) : path.basename(normalized);
}

export class RuntimeScenarioHarness {
  constructor({ definition, context, page, reportEvidence, artifactDir }) {
    this.definition = definition;
    this.context = context;
    this.page = page;
    this.reportEvidence = reportEvidence;
    this.artifactDir = artifactDir;
    this.startedAt = new Date().toISOString();
    this.startedMs = Date.now();
    this.stepResults = [];
    this.consoleErrors = [];
    this.networkErrors = [];
    this.failedStep = null;
    this.setupStep = null;
    this.setupStatus = null;
    this.setupReason = '';
    this.tracePath = null;
    this.authorityEvidence = null;

    page.on('console', (message) => {
      if (message.type() === 'error' && this.consoleErrors.length < 50) this.consoleErrors.push(message.text());
    });
    page.on('requestfailed', (request) => {
      if (this.networkErrors.length >= 50) return;
      this.networkErrors.push({
        method: request.method(),
        url: request.url(),
        error: request.failure()?.errorText || 'Request failed',
      });
    });
  }

  definitionFor(stepId) {
    return this.definition.steps.find((item) => item.id === stepId);
  }

  async step(stepId, callback, options = {}) {
    const definition = this.definitionFor(stepId);
    if (!definition) throw new Error(`Unknown scenario step: ${stepId}`);
    const startedMs = Date.now();
    try {
      const actual = await callback();
      this.stepResults.push({
        ...definition,
        status: AUTOMATION_STATUS.PASS,
        actual: actual || 'Expected screen behavior was observed.',
        route: this.safeRoute(),
        durationMs: Date.now() - startedMs,
        screenshotPath: null,
        tracePath: null,
      });
      return actual;
    } catch (error) {
      if (error instanceof AutomationSetupGap || options.optional === true || definition.required === false) {
        const status = error instanceof AutomationSetupGap
          ? error.automationStatus
          : AUTOMATION_STATUS.NOT_AUTOMATABLE;
        let screenshotPath = null;
        if (error instanceof AutomationSetupGap && definition.required !== false && options.optional !== true) {
          const setupScreenshotPath = path.join(this.artifactDir, `${this.definition.scenarioId.replace(/[^a-z0-9]+/gi, '-')}-setup-gap.png`);
          try {
            await this.page.screenshot({ path: setupScreenshotPath, fullPage: true });
            screenshotPath = relativeArtifactPath(setupScreenshotPath);
          } catch (_) {}
        }
        const setupStep = {
          ...definition,
          status,
          actual: error?.message || options.notAutomatableReason || 'Optional capability is unavailable.',
          route: this.safeRoute(),
          durationMs: Date.now() - startedMs,
          failureCategory: 'AUTOMATION_SETUP_GAP',
          screenshotPath,
          tracePath: null,
        };
        this.stepResults.push(setupStep);
        if (definition.required !== false && options.optional !== true) {
          this.setupStep = setupStep;
          this.setupStatus = status;
          this.setupReason = error?.message || 'Required automation setup is unavailable.';
          throw error;
        }
        return null;
      }

      const screenshotPath = path.join(this.artifactDir, `${this.definition.scenarioId.replace(/[^a-z0-9]+/gi, '-')}.png`);
      try {
        await this.page.screenshot({ path: screenshotPath, fullPage: true });
      } catch (_) {}
      const failed = {
        ...definition,
        status: AUTOMATION_STATUS.FAIL,
        actual: error?.message || 'Automation assertion failed.',
        route: this.safeRoute(),
        durationMs: Date.now() - startedMs,
        failureCategory: this.definition.failureCategories[0],
        screenshotPath: relativeArtifactPath(screenshotPath),
        tracePath: null,
      };
      this.stepResults.push(failed);
      this.failedStep = failed;
      throw error;
    }
  }

  safeRoute() {
    try {
      return new URL(this.page.url()).pathname;
    } catch (_) {
      return null;
    }
  }

  markRemaining(status, actual) {
    this.definition.steps.forEach((definition) => {
      if (this.stepResults.some((item) => item.id === definition.id)) return;
      this.stepResults.push({
        ...definition,
        status,
        actual,
        route: this.safeRoute(),
        durationMs: null,
        failureCategory: status === AUTOMATION_STATUS.NOT_RUN ? null : 'AUTOMATION_SETUP_GAP',
        screenshotPath: null,
        tracePath: this.tracePath,
      });
    });
  }

  attachTrace(tracePath) {
    this.tracePath = relativeArtifactPath(tracePath);
    if (this.failedStep) this.failedStep.tracePath = this.tracePath;
    if (this.setupStep) this.setupStep.tracePath = this.tracePath;
  }

  result(error) {
    if (error instanceof AutomationSetupGap) {
      this.markRemaining(error.automationStatus, `Not executed: ${error.message}`);
    } else if (error) {
      this.markRemaining(AUTOMATION_STATUS.NOT_RUN, 'Not executed after the first failed required step.');
    } else {
      this.markRemaining(AUTOMATION_STATUS.NOT_RUN, 'Step was not reached by this scenario handler.');
    }

    const required = this.definition.steps.filter((item) => item.required !== false);
    const allRequiredPassed = required.every((definition) => (
      this.stepResults.some((item) => item.id === definition.id && item.status === AUTOMATION_STATUS.PASS)
    ));
    const status = error instanceof AutomationSetupGap
      ? error.automationStatus
      : (error ? AUTOMATION_STATUS.FAIL : (allRequiredPassed ? AUTOMATION_STATUS.PASS : AUTOMATION_STATUS.NOT_AUTOMATABLE));

    const consoleErrorSummary = summarizeRuntimeConsoleErrors(this.consoleErrors);
    return sanitizeAutomationValue({
      scenarioId: this.definition.scenarioId,
      scenarioTitle: this.definition.title,
      status,
      startedAt: this.startedAt,
      finishedAt: new Date().toISOString(),
      durationMs: Date.now() - this.startedMs,
      failureCategory: this.failedStep
        ? this.definition.failureCategories[0]
        : (status === AUTOMATION_STATUS.PASS ? null : 'AUTOMATION_SETUP_GAP'),
      failedStepId: this.failedStep?.id || null,
      failedStepTitle: this.failedStep?.title || null,
      actual: this.failedStep?.actual
        || this.setupReason
        || (error instanceof AutomationSetupGap ? error.message : '')
        || (status === AUTOMATION_STATUS.PASS ? 'All required steps passed in a real browser context.' : 'Required scenario steps did not execute.'),
      executionEvidence: this.reportEvidence,
      authorityEvidence: this.authorityEvidence,
      steps: this.stepResults,
      consoleErrors: this.consoleErrors,
      consoleErrorSummary,
      criticalConsoleErrors: consoleErrorSummary.items.filter((item) => item.critical),
      networkErrors: this.networkErrors,
      relatedFiles: [],
      safeReproductionSteps: this.definition.steps.map((item) => item.action),
      nextAction: status === AUTOMATION_STATUS.PASS
        ? 'Keep the scenario in the separate runtime automation gate.'
        : this.definition.manualFallback,
      screenshotPath: this.failedStep?.screenshotPath || this.setupStep?.screenshotPath || null,
      tracePath: this.failedStep?.tracePath || this.setupStep?.tracePath || null,
    });
  }
}

export async function expectVisible(page, selector, timeout = 12000) {
  const locator = page.locator(selector).first();
  await locator.waitFor({ state: 'visible', timeout });
  return locator;
}

export async function expectPath(page, pathname, timeout = 12000) {
  await page.waitForURL((url) => url.pathname === pathname, { timeout });
  return `Committed route is ${pathname}.`;
}

export async function assertPublicTextSafe(page) {
  const text = await page.locator('body').innerText();
  const privatePattern = /\b(?:owner_key|guest_token|guest_id|provider_id|auth_id|internal_player_key|player_key)\b|[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/i;
  const rawErrorPattern = /Request failed with status code|TypeError:|ReferenceError:|\bat\s+\w+[\w.$]*\s*\([^\n]+:\d+:\d+\)/i;
  if (privatePattern.test(text)) throw new Error('Public screen rendered a private identity token or email.');
  if (rawErrorPattern.test(text)) throw new Error('Public screen rendered a raw backend error or stack trace.');
  return 'No private identity token, email, raw backend error, or stack trace is visible.';
}
