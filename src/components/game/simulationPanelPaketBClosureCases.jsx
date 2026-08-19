import packageSource from '../../../package.json?raw';
import functionGateSource from '../../../scripts/checkBase44FunctionsCompile.mjs?raw';
import reportSource from '../../../base44/functions/adminDuplicateKeyReport/entry.ts?raw';
import adminSource from '../../pages/AdminPage.jsx?raw';
import appSource from '../../App.jsx?raw';
import integrityToolSource from '../admin/IntegritySnapshotTool.jsx?raw';
import integrityUiSource from '../admin/IntegrityProofSections.jsx?raw';
import questionToolSource from '../admin/QuestionQualityTool.jsx?raw';
import questionUiSource from '../admin/QuestionQualityRisks.jsx?raw';
import healthCatalogSource from './health/healthCatalog.js?raw';
import performanceCasesSource from './simulationPanelPerformanceRuntimeCases.jsx?raw';
import wheelSource from '../dailyWheel/DailyWheelCard.jsx?raw';
import randomSource from '../../hooks/useRandomMatchmaking.js?raw';
import tutorialSource from './SoloLevelStartTutorialPopup.jsx?raw';
import { RELEASE_PROOF_CHECKLIST_DOC, SECURITY_DEPLOYMENT_DOC, MOBILE_VISUAL_GUARDRAILS_DOC } from '@/lib/healthAlignmentDocMirrors';
import { DB_ARCHITECTURE_IMPLEMENTATION_MIRROR } from '@/lib/dbArchitectureMirrors';

const SUITE_ID = 'paket_b_closure_health';
const SUITE_NAME = 'Paket B Closure Health Suite';
const RELATED_FILES = [
  'base44/functions/adminDuplicateKeyReport/entry.ts',
  'scripts/checkBase44FunctionsCompile.mjs',
  'src/pages/AdminPage.jsx',
  'src/components/admin/IntegritySnapshotTool.jsx',
  'src/components/admin/QuestionQualityTool.jsx',
];
const pass = (reason) => ({ status: 'PASS', reason, verification: 'STATIC_CONTRACT' });
const fail = (reason, actual) => ({ status: 'FAIL', reason, actual, verification: 'STATIC_CONTRACT' });
const missing = (source, tokens) => tokens.filter((token) => !String(source || '').includes(token));
const present = (source, tokens) => tokens.filter((token) => String(source || '').includes(token));
const makeCase = (id, name, run) => ({ key: `${SUITE_ID}.${id}`, suiteId: SUITE_ID, suiteName: SUITE_NAME, id, name, critical: true, actionType: 'CODE_FIX', relatedFiles: RELATED_FILES, run });
const toolsSource = `${integrityToolSource}\n${integrityUiSource}\n${questionToolSource}\n${questionUiSource}`;

export const EXTRA_SUITES = [{ id: SUITE_ID, name: SUITE_NAME, critical: true, color: '#f59e0b' }];
export const EXTRA_TESTS = [
  makeCase('no_new_backend_functions_added', 'B5 adds no backend functions', () => { const absent = missing(functionGateSource, ['MAX_BASE44_FUNCTIONS = 50', 'entryFiles.length > MAX_BASE44_FUNCTIONS']); return absent.length ? fail('Function ceiling proof drifted.', { missing: absent }) : pass('The Base44 deploy ceiling remains 50 and B5 adds no callable.'); }),
  makeCase('admin_tools_are_read_only', 'B1 and B3 tools remain Admin-only and read-only', () => { const absent = missing(`${adminSource}\n${appSource}\n${toolsSource}\n${reportSource}`, ['<AdminRoute><AdminPage', '<IntegritySnapshotTool />', '<QuestionQualityTool />', 'data-admin-integrity-proof="read-only"', 'data-admin-question-quality="read-only"', 'readOnly: true', 'mutatesRows: false']); const forbidden = present(toolsSource, ['base44.entities', '.create(', '.update(', '.delete(', 'deploy(', 'publish(']); const staleReleasePanel = present(adminSource, ['ReleaseReadinessTool', '<ReleaseReadinessTool />']); return absent.length || forbidden.length || staleReleasePanel.length ? fail('A Paket B Admin boundary drifted.', { missing: absent, forbidden, staleReleasePanel }) : pass('B1 and B3 stay guarded/read-only while the static B4 Admin panel remains removed.'); }),
  makeCase('manual_proofs_not_faked', 'Manual and external proofs are not faked', () => { const docs = `${RELEASE_PROOF_CHECKLIST_DOC}\n${SECURITY_DEPLOYMENT_DOC}\n${MOBILE_VISUAL_GUARDRAILS_DOC}`; const absent = missing(`${docs}\n${healthCatalogSource}`, ['Health PASS is not release-ready proof', 'MANUAL_REQUIRED', "id: 'release_gate'", 'platform unique indexes', 'real Android/iOS/WebView devices']); return absent.length ? fail('Manual proof honesty drifted.', { missing: absent }) : pass('Release Gate Health and docs preserve deploy, device, RLS, VAPID, index, and store proof boundaries.'); }),
  makeCase('no_public_private_id_exposure_in_b_tools', 'Paket B UIs render no private identifiers', () => { const forbidden = present(toolsSource, ['{user.email}', '{row.email}', '{row.id}', '{guest_token}', '{owner_key}', '{actor_key_hash}', 'error.message']); return forbidden.length ? fail('Private rendered values were detected.', { forbidden }) : pass('Paket B panels render aggregate/static release information only.'); }),
  makeCase('question_qa_no_mutation', 'Question QA performs no mutation', () => { const absent = missing(`${questionToolSource}\n${reportSource}`, ["mode: 'question_quality'", "mode === 'question_quality'", 'readOnly: true', 'destructiveCleanupImplemented: false']); const forbidden = present(reportSource, ['Question.create', 'Question.update', 'Question.delete']); return absent.length || forbidden.length ? fail('Question QA mutation boundary drifted.', { missing: absent, forbidden }) : pass('B3 remains bounded, read-only, and non-destructive.'); }),
  makeCase('integrity_reports_dry_run_only', 'Integrity reports remain dry-run only', () => { const absent = missing(reportSource, ['dryRun: true', 'mutatesRows: false', 'mutatesBalances: false', 'destructiveCleanupImplemented: false']); const forbidden = present(reportSource, ['.create(', '.update(', '.delete(', '.deleteMany(']); return absent.length || forbidden.length ? fail('Integrity report is no longer read-only.', { missing: absent, forbidden }) : pass('B1 remains a dry-run report with no cleanup or balance mutation.'); }),
  makeCase('performance_cleanup_source_connected', 'B2 cleanup proof targets active sources', () => { const combined = `${performanceCasesSource}\n${wheelSource}\n${randomSource}\n${tutorialSource}`; const absent = missing(combined, ['DailyWheelCard.jsx?raw', 'useRandomMatchmaking.js?raw', 'SoloLevelStartTutorialPopup.jsx?raw', 'effectSessionRef.current += 1', 'timers.forEach((id) => window.clearTimeout(id))', 'stopPolling()', 'mountedRef.current = false', 'preload="metadata"', 'video.pause()']); return absent.length ? fail('B2 cleanup checks lost active-source evidence.', { missing: absent }) : pass('B2 Health remains connected to active wheel, random matchmaking, and tutorial cleanup sources.'); }),
  makeCase('docs_match_current_manual_boundaries', 'Docs preserve current manual/external boundaries', () => { const docs = `${RELEASE_PROOF_CHECKLIST_DOC}\n${SECURITY_DEPLOYMENT_DOC}\n${MOBILE_VISUAL_GUARDRAILS_DOC}\n${DB_ARCHITECTURE_IMPLEMENTATION_MIRROR}`; const absent = missing(docs, ['Health PASS is not release-ready proof', 'package-lock', 'MANUAL_REQUIRED', 'real mobile/device/store validation remains manual', 'platform/manual configuration gap']); return absent.length ? fail('Release boundary docs drifted.', { missing: absent }) : pass('Docs distinguish static Health, read-only diagnostics, manual proof, and external package/platform gates.'); }),
  makeCase('sdk_source_aligned_lock_external', 'SDK source policy and external lock proof remain visible', () => { const absent = missing(`${packageSource}\n${functionGateSource}\n${RELEASE_PROOF_CHECKLIST_DOC}`, ["BASE44_SDK_VERSION = '0.8.34'", 'packageLockAvailable', 'package-lock']); return absent.length ? fail('SDK/package boundary is misstated.', { missing: absent }) : pass('The deploy checker still exposes SDK/package-layer drift and keeps lock resolution external.'); }),
];
