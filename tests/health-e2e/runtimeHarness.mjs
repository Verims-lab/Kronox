import path from 'node:path';

import {
  AUTOMATION_STATUS,
  buildRuntimePermissionDiagnostic,
  classifyRuntimeServiceAction,
  classifyRuntimeServiceRequest,
  correlateRuntimeConsoleErrors,
  isOptionalRuntimeActivityRequest,
  recordRuntimeServiceObservation,
  sanitizeAutomationValue,
  summarizeRuntimeBackendEvidence,
  summarizeRuntimeConsoleErrors,
} from '../../src/lib/health/runtimeE2EReport.js';

export class AutomationSetupGap extends Error {
  constructor(message, status = AUTOMATION_STATUS.NOT_AUTOMATABLE, failureCategory = 'AUTOMATION_SETUP_GAP') {
    super(message);
    this.name = 'AutomationSetupGap';
    this.automationStatus = status;
    this.failureCategory = failureCategory;
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
    this.permissionDiagnostics = [];
    this.serviceSummary = {};
    this.serviceEvents = [];
    this.serviceLifecycles = [];
    this.failedStep = null;
    this.setupStep = null;
    this.setupStatus = null;
    this.setupReason = '';
    this.tracePath = null;
    this.authorityEvidence = null;

    page.on('console', (message) => {
      const sourceUrl = message.location()?.url || '';
      if (
        message.type() === 'error'
        && !isOptionalRuntimeActivityRequest(sourceUrl)
        && this.consoleErrors.length < 50
      ) this.consoleErrors.push(message.text());
    });
    page.on('pageerror', (error) => {
      if (this.consoleErrors.length < 50) {
        this.consoleErrors.push(`Unhandled promise rejection or page error: ${error?.message || 'Unknown browser error'}`);
      }
    });
    page.on('request', (request) => {
      const category = classifyRuntimeServiceRequest(
        request.url(),
        this.reportEvidence?.configuredBaseUrl,
        request.resourceType(),
      );
      const safeActionLabel = classifyRuntimeServiceAction(request.url(), category);
      const observedAt = new Date().toISOString();
      recordRuntimeServiceObservation(this.serviceSummary, category, 'REQUEST', null, { observedAt, safeActionLabel });
      this.serviceEvents.push({ category, safeActionLabel, outcome: 'REQUEST', statusClass: null, observedAt });
    });
    page.on('response', (response) => {
      const request = response.request();
      const category = classifyRuntimeServiceRequest(
        request.url(),
        this.reportEvidence?.configuredBaseUrl,
        request.resourceType(),
      );
      const safeActionLabel = classifyRuntimeServiceAction(request.url(), category);
      const observedAt = new Date().toISOString();
      const statusClass = `${Math.floor(response.status() / 100)}xx`;
      recordRuntimeServiceObservation(this.serviceSummary, category, 'RESPONSE', response.status(), { observedAt, safeActionLabel });
      this.serviceEvents.push({ category, safeActionLabel, outcome: 'RESPONSE', statusClass, observedAt });
      if ((response.status() === 401 || response.status() === 403) && this.permissionDiagnostics.length < 20) {
        const diagnostic = buildRuntimePermissionDiagnostic({
          scenarioId: this.definition.scenarioId,
          requestUrl: request.url(),
          configuredBaseUrl: this.reportEvidence?.configuredBaseUrl,
          resourceType: request.resourceType(),
          method: request.method(),
          status: response.status(),
        });
        if (!this.permissionDiagnostics.some((item) => item.fingerprint === diagnostic.fingerprint)) {
          this.permissionDiagnostics.push(diagnostic);
        }
      }
    });
    page.on('requestfailed', (request) => {
      const category = classifyRuntimeServiceRequest(
        request.url(),
        this.reportEvidence?.configuredBaseUrl,
        request.resourceType(),
      );
      const safeActionLabel = classifyRuntimeServiceAction(request.url(), category);
      const failureText = String(request.failure()?.errorText || '');
      const cancelled = /abort|cancel/i.test(failureText);
      const outcome = cancelled ? 'ABORTED' : 'FAILED';
      const observedAt = new Date().toISOString();
      recordRuntimeServiceObservation(this.serviceSummary, category, outcome, null, {
        observedAt,
        safeActionLabel,
        cancelled,
      });
      this.serviceEvents.push({ category, safeActionLabel, outcome, statusClass: null, observedAt, cancelled });
      if (this.networkErrors.length >= 50) return;
      this.networkErrors.push({
        method: request.method(),
        category,
        summary: cancelled
          ? 'A browser request was aborted or cancelled; URL and raw details were omitted.'
          : 'A browser request failed; URL and raw error details were omitted.',
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
          failureCategory: error instanceof AutomationSetupGap
            ? error.failureCategory
            : 'AUTOMATION_SETUP_GAP',
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

  captureServiceBaseline(safeActionLabel = null) {
    return {
      eventIndex: this.serviceEvents.length,
      capturedAt: new Date().toISOString(),
      safeActionLabel,
    };
  }

  async waitForServiceOutcome(category, timeout = 15000, baseline = null, safeActionLabel = null) {
    const eventIndex = Math.max(0, Number(baseline?.eventIndex) || 0);
    const expectedAction = safeActionLabel || baseline?.safeActionLabel || null;
    const startedAt = Date.now();
    const matchingEvents = () => this.serviceEvents.slice(eventIndex).filter((event) => (
      event.category === category && (!expectedAction || event.safeActionLabel === expectedAction)
    ));
    const complete = (state, events, terminalEvent = null, noResponseTimeout = false) => {
      const requestEvent = events.find((event) => event.outcome === 'REQUEST') || null;
      const lifecycle = {
        category,
        safeActionLabel: expectedAction || requestEvent?.safeActionLabel || terminalEvent?.safeActionLabel || null,
        requestedAt: requestEvent?.observedAt || null,
        completedAt: terminalEvent?.observedAt || null,
        responseStatusClass: terminalEvent?.statusClass || null,
        aborted: terminalEvent?.outcome === 'ABORTED',
        cancelled: terminalEvent?.cancelled === true,
        noResponseTimeout,
        state,
      };
      this.serviceLifecycles.push(lifecycle);
      return {
        state,
        lifecycle,
        entry: this.serviceSummary[category]
          ? { ...this.serviceSummary[category], statusClasses: { ...(this.serviceSummary[category].statusClasses || {}) } }
          : null,
      };
    };

    while (Date.now() - startedAt < timeout) {
      const events = matchingEvents();
      const requests = events.filter((event) => event.outcome === 'REQUEST');
      const terminals = events.filter((event) => event.outcome !== 'REQUEST');
      const successful = requests.length > 0 && terminals.find((event) => (
        event.outcome === 'RESPONSE' && (event.statusClass === '2xx' || event.statusClass === '3xx')
      ));
      if (successful) return complete('successful_response', events, successful);
      if (requests.length > 0 && terminals.length >= requests.length) {
        const rejected = terminals.find((event) => event.outcome === 'RESPONSE');
        if (rejected) return complete('backend_rejected', events, rejected);
        const aborted = terminals.find((event) => event.outcome === 'ABORTED');
        if (aborted) return complete('aborted', events, aborted);
        const failed = terminals.find((event) => event.outcome === 'FAILED');
        if (failed) return complete('network_failure', events, failed);
      }
      await this.page.waitForTimeout(200);
    }
    const events = matchingEvents();
    const requestObserved = events.some((event) => event.outcome === 'REQUEST');
    if (requestObserved) {
      recordRuntimeServiceObservation(this.serviceSummary, category, 'NO_RESPONSE_TIMEOUT', null, {
        observedAt: new Date().toISOString(),
        safeActionLabel: expectedAction,
      });
    }
    return complete(
      requestObserved ? 'request_without_response' : 'request_not_observed',
      events,
      null,
      requestObserved,
    );
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

    const reportableConsoleErrors = correlateRuntimeConsoleErrors(
      this.consoleErrors,
      this.permissionDiagnostics,
    );
    const consoleErrorSummary = summarizeRuntimeConsoleErrors(reportableConsoleErrors);
    const backendEvidence = summarizeRuntimeBackendEvidence(
      this.serviceSummary,
      this.definition.backendServices,
    );
    return sanitizeAutomationValue({
      scenarioId: this.definition.scenarioId,
      scenarioTitle: this.definition.title,
      status,
      startedAt: this.startedAt,
      finishedAt: new Date().toISOString(),
      durationMs: Date.now() - this.startedMs,
      failureCategory: this.failedStep
        ? this.definition.failureCategories[0]
        : (status === AUTOMATION_STATUS.PASS ? null : this.setupStep?.failureCategory || 'AUTOMATION_SETUP_GAP'),
      failedStepId: this.failedStep?.id || null,
      failedStepTitle: this.failedStep?.title || null,
      actual: this.failedStep?.actual
        || this.setupReason
        || (error instanceof AutomationSetupGap ? error.message : '')
        || (status === AUTOMATION_STATUS.PASS ? 'All required steps passed in a real browser context.' : 'Required scenario steps did not execute.'),
      executionEvidence: this.reportEvidence,
      authorityEvidence: this.authorityEvidence,
      backendEvidence,
      serviceSummary: this.serviceSummary,
      serviceLifecycles: this.serviceLifecycles,
      serviceSummaryUnavailableReason: backendEvidence.observed
        ? null
        : 'No classified backend requests observed during this scenario.',
      permissionDiagnostics: this.permissionDiagnostics,
      steps: this.stepResults,
      consoleErrors: reportableConsoleErrors,
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
  const rawErrorPattern = /Request failed with status code|TypeError:|ReferenceError:|permission denied|row.level security|\bforbidden\b|(?:status(?: code)?|http)\s*403|\bat\s+\w+[\w.$]*\s*\([^\n]+:\d+:\d+\)/i;
  if (privatePattern.test(text)) throw new Error('Public screen rendered a private identity token or email.');
  if (rawErrorPattern.test(text)) throw new Error('Public screen rendered a raw backend error or stack trace.');
  return 'No private identity token, email, raw backend error, or stack trace is visible.';
}
