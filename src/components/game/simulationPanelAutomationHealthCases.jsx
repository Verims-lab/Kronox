import compileGateSource from '../../../scripts/checkBase44FunctionsCompile.mjs?raw';
import automationProofSource from '../../lib/health/base44AutomationProof.js?raw';
import {
  HEALTH_GAP_ANALYSIS_DOC,
  RELEASE_PROOF_CHECKLIST_DOC,
  SECURITY_DEPLOYMENT_DOC,
  TECHNICAL_FLOW_DOC,
} from '@/lib/healthAlignmentDocMirrors';
import { auditBase44AutomationSurface } from '@/lib/health/base44AutomationProof';

const manifestSources = import.meta.glob('../../../base44/functions/**/function.jsonc', {
  query: '?raw',
  import: 'default',
  eager: true,
});
const entrySources = import.meta.glob('../../../base44/functions/**/entry.ts', {
  query: '?raw',
  import: 'default',
  eager: true,
});

const SUITE_ID = 'automation_health';
const SUITE_NAME = 'Base44 Automation Health Suite';
const SOURCE_FILES = [
  'base44/functions/**/function.jsonc',
  'base44/functions/**/entry.ts',
  'src/lib/health/base44AutomationProof.js',
  'scripts/checkBase44FunctionsCompile.mjs',
];
const pass = (reason, extra = {}) => ({ status: 'PASS', reason, verification: 'SOURCE_CONNECTED', classification: 'SOURCE_CONNECTED', ...extra });
const fail = (reason, actual) => ({ status: 'FAIL', reason, actual, verification: 'SOURCE_CONNECTED', classification: 'REAL_PRODUCT_RISK' });
const manual = (reason, extra = {}) => ({ status: 'NOT_AUTOMATABLE', reason, verification: 'MANUAL_EXTERNAL', classification: 'MANUAL_EXTERNAL', runtimeProofRequired: true, ...extra });
const makeCase = (id, name, run, relatedFiles = SOURCE_FILES) => ({
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
const audit = () => auditBase44AutomationSurface(manifestSources, entrySources);
const missing = (source, tokens) => tokens.filter((token) => !String(source || '').includes(token));

export const EXTRA_SUITES = [{ id: SUITE_ID, name: SUITE_NAME, critical: true, color: '#22d3ee' }];

export const EXTRA_TESTS = [
  makeCase('function_jsonc_configs_valid', 'All local function.jsonc manifests and automation declarations are structurally valid', () => {
    const result = audit();
    return result.manifestCount > 0 && result.manifestIssues.length === 0
      ? pass(`${result.manifestCount} local JSONC manifests parsed and match their function directories; ${result.automationCount} local automation declarations were found.`, { actual: { manifestCount: result.manifestCount, automationCount: result.automationCount } })
      : fail('A committed function.jsonc manifest or automation declaration is invalid.', { manifestCount: result.manifestCount, issues: result.manifestIssues });
  }),

  makeCase('local_config_is_source_of_truth', 'Automation source-of-truth and atomic deploy behavior are documented and gated locally', () => {
    const docs = `${TECHNICAL_FLOW_DOC}\n${HEALTH_GAP_ANALYSIS_DOC}\n${RELEASE_PROOF_CHECKLIST_DOC}\n${SECURITY_DEPLOYMENT_DOC}`;
    const absent = missing(`${docs}\n${compileGateSource}\n${automationProofSource}`, [
      'function.jsonc',
      'automation source of truth',
      'deploy atomically with their function',
      'dashboard changes are overwritten',
      'no two-way sync',
      'auditBase44AutomationSurface',
    ]);
    return absent.length
      ? fail('Local automation source-of-truth or deploy behavior is not aligned across docs and the pre-deploy gate.', { missing: absent })
      : pass('Committed function.jsonc files are the local source of truth; atomic deploy and dashboard overwrite/no-sync behavior are explicit.');
  }, [...SOURCE_FILES, 'docs/KRONOX_HEALTH_GAP_ANALYSIS.md', 'docs/KRONOX_RELEASE_PROOF_CHECKLIST.md', 'docs/KRONOX_SECURITY_DEPLOYMENT.md', 'src/lib/healthAlignmentDocMirrors.js']),

  makeCase('automation_args_validated', 'Configured automation function_args are explicit and handled by the target entry', () => {
    const result = audit();
    if (result.argumentIssues.length) return fail('An automation has unhandled function_args or no matching entry source.', { issues: result.argumentIssues });
    return pass(result.automationCount
      ? `${result.automationCount} automation declarations have explicit object args handled by their target entries.`
      : 'No local automation declarations exist, so no unvalidated function_args can execute; future declarations are guarded by the shared audit.');
  }),

  makeCase('no_critical_work_relies_on_best_effort_wait_until', 'Critical backend work does not rely on best-effort waitUntil', () => {
    const result = audit();
    return result.waitUntilIssues.length
      ? fail('A Base44 function uses waitUntil and requires an explicit must-not-lose criticality review.', { issues: result.waitUntilIssues })
      : pass('No committed Base44 function uses waitUntil; critical writes remain in the awaited request path.');
  }),

  makeCase('cleanup_automation_disabled_or_dry_run_only', 'Cleanup and integrity automation is disabled or explicitly dry-run/report-only', () => {
    const result = audit();
    return result.cleanupAutomationIssues.length
      ? fail('An enabled cleanup/integrity automation can request mutation.', { issues: result.cleanupAutomationIssues })
      : pass(result.automationCount
        ? 'Every cleanup/integrity automation is disabled or explicitly dry-run/report-only.'
        : 'No cleanup, integrity, reset, delete, duplicate, or artifact automation is committed or enabled.');
  }),

  makeCase('no_secret_or_private_id_logs', 'Backend automation/function logs exclude secrets and private identifiers', () => {
    const result = audit();
    return result.privateLogIssues.length
      ? fail('A backend console call includes a private identifier, secret variable, or raw payload.', { issues: result.privateLogIssues })
      : pass('Backend console calls contain bounded status/reason diagnostics without secret variables, private IDs, or raw payloads.');
  }),

  makeCase('deployed_automation_state_requires_dashboard_proof', 'Live deployed automation state remains manual/external proof', () => manual(
    'Local manifests prove committed intent, not live deployment. Before release, inspect the Base44 Automations dashboard/logs and confirm deployed function/automation status matches the local zero-automation baseline.',
    { actionType: 'BACKEND_RUNTIME_PROBE', nextStep: 'Compare Base44 dashboard automation state and execution logs with committed function.jsonc files after deploy.' },
  ), ['base44/functions/**/function.jsonc', 'docs/KRONOX_RELEASE_PROOF_CHECKLIST.md']),
];
