import notificationFloodCasesSource from './simulationPanelNotificationFloodCases.jsx?raw';
import dataHygieneReviewCasesSource from './simulationPanelDataHygieneReviewCases.jsx?raw';
import dataHygieneDryRunCasesSource from './simulationPanelDataHygieneDryRunCases.jsx?raw';
import integrityProofCasesSource from './simulationPanelIntegrityProofCases.jsx?raw';
import performanceCasesSource from './simulationPanelPerformanceRuntimeCases.jsx?raw';
import questionQualityCasesSource from './simulationPanelQuestionQualityCases.jsx?raw';
import releaseCasesSource from './simulationPanelReleaseReadinessCases.jsx?raw';
import closureCasesSource from './simulationPanelPaketBClosureCases.jsx?raw';
import healthIntelligenceCasesSource from './simulationPanelHealthIntelligenceCases.jsx?raw';
import automationCasesSource from './simulationPanelAutomationHealthCases.jsx?raw';
import dataHygienePhase1CasesSource from './simulationPanelDataHygienePhase1Cases.jsx?raw';
import backendDeployabilityCasesSource from './simulationPanelBackendDeployabilityCases.jsx?raw';
import catalogSource from './health/healthCatalog.js?raw';
import automationProofSource from '../../lib/health/base44AutomationProof.js?raw';
import {
  HEALTH_GAP_ANALYSIS_DOC,
  RELEASE_PROOF_CHECKLIST_DOC,
  SECURITY_DEPLOYMENT_DOC,
  TECHNICAL_FLOW_DOC,
} from '@/lib/healthAlignmentDocMirrors';
import { DB_ARCHITECTURE_IMPLEMENTATION_MIRROR } from '@/lib/dbArchitectureMirrors';
import { deriveEvidenceClassification, deriveProofQuality } from './health/healthCatalog';

const SUITE_ID = 'health_proof_integrity';
const SUITE_NAME = 'Health Proof Integrity Suite';
const RECENT_CASE_SOURCES = {
  notificationFlood: notificationFloodCasesSource,
  dataHygieneReview: dataHygieneReviewCasesSource,
  dataHygieneDryRun: dataHygieneDryRunCasesSource,
  integrityProof: integrityProofCasesSource,
  performance: performanceCasesSource,
  questionQuality: questionQualityCasesSource,
  releaseReadiness: releaseCasesSource,
  paketBClosure: closureCasesSource,
  healthIntelligence: healthIntelligenceCasesSource,
  automation: automationCasesSource,
  dataHygienePhase1: dataHygienePhase1CasesSource,
  backendDeployability: backendDeployabilityCasesSource,
};
const RELATED_FILES = [
  'src/components/game/health/healthCatalog.js',
  'src/components/game/simulationPanelCaseRegistry.jsx',
  'src/components/game/simulationPanel*Cases.jsx',
  'src/lib/healthAlignmentDocMirrors.js',
  'src/lib/dbArchitectureMirrors.js',
];
const pass = (reason, extra = {}) => ({ status: 'PASS', reason, verification: 'EXECUTABLE_SIMULATION', classification: 'EXECUTABLE', ...extra });
const fail = (reason, actual) => ({ status: 'FAIL', reason, actual, verification: 'EXECUTABLE_SIMULATION', classification: 'REAL_PRODUCT_RISK' });
const makeCase = (id, name, run) => ({ key: `${SUITE_ID}.${id}`, suiteId: SUITE_ID, suiteName: SUITE_NAME, id, name, critical: true, actionType: 'CODE_FIX', relatedFiles: RELATED_FILES, run });
const missing = (source, tokens) => tokens.filter((token) => !String(source || '').includes(token));

export const EXTRA_SUITES = [{ id: SUITE_ID, name: SUITE_NAME, critical: true, color: '#22d3ee' }];

export const EXTRA_TESTS = [
  makeCase('no_dead_string_proof', 'Recent Health source scans target imported active files/helpers and declare actionable file ownership', () => {
    const problems = Object.entries(RECENT_CASE_SOURCES).flatMap(([name, source]) => {
      const hasActiveSource = source.includes('?raw') || source.includes('import.meta.glob') || source.includes('from \'@/lib/');
      const hasTargetMetadata = source.includes('relatedFiles') || source.includes('files:');
      return [
        ...(!hasActiveSource ? [`${name}: no active source/helper import`] : []),
        ...(!hasTargetMetadata ? [`${name}: no related file ownership metadata`] : []),
      ];
    });
    const retiredCoverage = missing(catalogSource, [
      'HEALTH_RETIRED_CASES',
      'replacementCaseKey',
      'health_proof_integrity.unique_suite_and_case_ids',
      'health_proof_integrity.no_dead_string_proof',
    ]);
    const actual = { problems, retiredCoverage };
    return problems.length || retiredCoverage.length
      ? fail('A recent source-scan suite lacks an active import/target, or retired coverage lacks a named replacement.', actual)
      : pass('Recent source-scan suites import active files/helpers, declare fix targets, and retired checks have named replacement coverage.');
  }),

  makeCase('proof_quality_matches_evidence', 'Proof-quality classification follows executable/source/static/manual evidence', () => {
    const proofQuality = {
      executable: deriveProofQuality({ verification: 'EXECUTABLE_SIMULATION' }),
      sourceConnected: deriveProofQuality({ verification: 'STATIC_CONTRACT', relatedFiles: ['active-source.js'] }),
      staticOnly: deriveProofQuality({ verification: 'STATIC_CONTRACT' }),
      manualExternal: deriveProofQuality({ status: 'NOT_AUTOMATABLE', verification: 'EXECUTABLE_SIMULATION' }),
    };
    const classification = {
      executable: deriveEvidenceClassification({ status: 'PASS' }, ['EXECUTABLE_SIMULATION'], []),
      sourceConnected: deriveEvidenceClassification({ status: 'PASS' }, ['STATIC_CONTRACT'], ['active-source.js']),
      staticOnly: deriveEvidenceClassification({ status: 'PASS' }, ['STATIC_CONTRACT'], []),
      manualExternal: deriveEvidenceClassification({ status: 'NOT_AUTOMATABLE' }, ['EXECUTABLE_SIMULATION'], []),
      unlabeledSource: deriveEvidenceClassification({ status: 'PASS' }, [], ['active-source.js']),
      unlabeledStatic: deriveEvidenceClassification({ status: 'PASS' }, [], []),
    };
    const expectedProofQuality = { executable: 'EXECUTABLE', sourceConnected: 'SOURCE_CONNECTED', staticOnly: 'STATIC_ONLY', manualExternal: 'MANUAL_EXTERNAL' };
    const expectedClassification = { executable: 'RUNTIME_VERIFIED', sourceConnected: 'SOURCE_CONNECTED', staticOnly: 'STATIC_CHECK_LIMITATION', manualExternal: 'MANUAL_EXTERNAL', unlabeledSource: 'SOURCE_CONNECTED', unlabeledStatic: 'STATIC_CHECK_LIMITATION' };
    return JSON.stringify(proofQuality) === JSON.stringify(expectedProofQuality) && JSON.stringify(classification) === JSON.stringify(expectedClassification)
      ? pass('The classifier maps executable, source-connected, static-only, and manual/external evidence without promotion.')
      : fail('Proof-quality classification does not match the supplied evidence.', { expected: { proofQuality: expectedProofQuality, classification: expectedClassification }, actual: { proofQuality, classification } });
  }),

  makeCase('manual_external_not_marked_executable', 'Manual and external gates cannot be promoted to executable PASS', () => {
    const classification = deriveProofQuality({
      status: 'NOT_AUTOMATABLE',
      verification: 'EXECUTABLE_SIMULATION',
      verificationLabels: ['RUNTIME_VERIFIED'],
    });
    const manualBoundaryTokens = missing(`${automationCasesSource}\n${dataHygienePhase1CasesSource}\n${backendDeployabilityCasesSource}\n${releaseCasesSource}`, [
      "status: 'NOT_AUTOMATABLE'",
      'MANUAL_EXTERNAL',
      'runtimeProofRequired: true',
      'npm_build_is_not_backend_deploy_proof',
      'manual_external_boundaries_preserved',
    ]);
    return classification === 'MANUAL_EXTERNAL' && manualBoundaryTokens.length === 0
      ? pass('NOT_AUTOMATABLE takes precedence over executable labels, and deploy/dashboard/data/device gates remain explicit manual proof.')
      : fail('A manual/external gate can be mislabeled executable or its active boundary disappeared.', { classification, missing: manualBoundaryTokens });
  }),

  makeCase('docs_mirrors_match_active_contracts', 'Docs mirrors match active proof, automation, privacy, and deployability contracts', () => {
    const docs = `${TECHNICAL_FLOW_DOC}\n${HEALTH_GAP_ANALYSIS_DOC}\n${RELEASE_PROOF_CHECKLIST_DOC}\n${SECURITY_DEPLOYMENT_DOC}\n${DB_ARCHITECTURE_IMPLEMENTATION_MIRROR}`;
    const absent = missing(`${docs}\n${catalogSource}\n${automationProofSource}`, [
      'Health PASS is not release-ready proof',
      'EXECUTABLE',
      'SOURCE_CONNECTED',
      'STATIC_ONLY',
      'MANUAL_EXTERNAL',
      'automation source of truth',
      'deploy atomically with their function',
      'waitUntil is best-effort',
      '50 function',
      'no two-way sync',
      '31 redundant UserDailyQuestProgress rows',
      'PRIVATE_LOG_IDENTIFIERS',
    ]);
    return absent.length
      ? fail('Canonical mirror text or active proof/automation source is missing a required contract.', { missing: absent })
      : pass('Active classifier/automation source and runtime doc mirrors agree on proof levels, manual gates, automation deploy/source, privacy, Phase 1 history, and the 50-function boundary.');
  }),
];
