import assert from 'node:assert/strict';

import {
  AUTOMATION_STATUS,
  buildAllAutomationFailuresJson,
  buildAutomationFailureJson,
  createNotRunAutomationReport,
  normalizeRuntimeE2EReport,
  sanitizeAutomationValue,
} from '../src/lib/health/runtimeE2EReport.js';
import {
  RUNTIME_E2E_SCENARIOS,
  RUNTIME_E2E_SUITE,
  RUNTIME_E2E_SUITE_ID,
} from '../src/lib/health/runtimeE2EScenarios.js';
import { RUNTIME_E2E_SCENARIO_HANDLERS } from '../tests/health-e2e/scenarioHandlers.mjs';

assert.equal(RUNTIME_E2E_SUITE.id, RUNTIME_E2E_SUITE_ID);
assert.equal(RUNTIME_E2E_SUITE.externalAutomation, true);
assert.equal(RUNTIME_E2E_SCENARIOS.length, 10);
assert.equal(new Set(RUNTIME_E2E_SCENARIOS.map((item) => item.scenarioId)).size, 10);

for (const scenario of RUNTIME_E2E_SCENARIOS) {
  assert.equal(typeof RUNTIME_E2E_SCENARIO_HANDLERS[scenario.scenarioId], 'function');
  assert.ok(scenario.steps.length > 0);
}

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

const failure = buildAutomationFailureJson(rejectedFakePass, rejectedFakePass.scenarios[0].scenarioId);
assert.equal(failure.type, 'KRONOX_RUNTIME_E2E_AUTOMATION_FAILURE');
assert.equal(failure.suiteId, RUNTIME_E2E_SUITE_ID);
assert.ok(failure.failedStepId);
assert.equal(buildAllAutomationFailuresJson(rejectedFakePass).failures.length, 1);

const redacted = JSON.stringify(sanitizeAutomationValue({
  email: 'automation@example.com',
  url: 'https://example.test/path?token=secret-value',
  message: 'Bearer secret-value eyJhbGciOiJIUzI1NiJ9.payload.signature',
}));
assert.ok(!redacted.includes('automation@example.com'));
assert.ok(!redacted.includes('secret-value'));
assert.ok(!redacted.includes('eyJhbGciOiJIUzI1NiJ9'));

let duelloStatus = null;
try {
  await RUNTIME_E2E_SCENARIO_HANDLERS['runtime_e2e.duello_two_context_runtime_sync']();
} catch (error) {
  duelloStatus = error?.automationStatus;
}
assert.equal(duelloStatus, AUTOMATION_STATUS.MANUAL_EXTERNAL);

process.stdout.write('Runtime E2E framework contracts: PASS (10 scenarios, evidence gate, redaction, failure JSON, Duello manual gate).\n');
