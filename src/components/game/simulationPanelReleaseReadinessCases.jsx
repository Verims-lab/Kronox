import adminSource from '../../pages/AdminPage.jsx?raw';
import appSource from '../../App.jsx?raw';
import bottomNavSource from '../layout/BottomNav.jsx?raw';
import catalogSource from './health/healthCatalog.js?raw';
import reportSource from './health/simulationReportBuilder.jsx?raw';
import actionsSource from './health/SimulationReportActions.jsx?raw';
import { RELEASE_PROOF_CHECKLIST_DOC, SECURITY_DEPLOYMENT_DOC, MOBILE_VISUAL_GUARDRAILS_DOC } from '@/lib/healthAlignmentDocMirrors';

const SUITE_ID = 'release_readiness_health';
const SUITE_NAME = 'Release Gate Health Suite';
const pass = (reason) => ({ status: 'PASS', reason, verification: 'SOURCE_CONNECTED' });
const fail = (reason, actual) => ({ status: 'FAIL', reason, actual, verification: 'SOURCE_CONNECTED' });
const missing = (source, tokens) => tokens.filter((token) => !String(source || '').includes(token));
const present = (source, tokens) => tokens.filter((token) => String(source || '').includes(token));
const makeCase = (id, name, run, relatedFiles) => ({ key: `${SUITE_ID}.${id}`, suiteId: SUITE_ID, suiteName: SUITE_NAME, id, name, critical: true, actionType: 'CODE_FIX', relatedFiles, run });
const docsSource = `${RELEASE_PROOF_CHECKLIST_DOC}\n${SECURITY_DEPLOYMENT_DOC}\n${MOBILE_VISUAL_GUARDRAILS_DOC}`;

export const EXTRA_SUITES = [{ id: SUITE_ID, name: SUITE_NAME, critical: true, color: '#fbbf24' }];
export const EXTRA_TESTS = [
  makeCase('release_readiness_panel_removed', 'Admin Release Readiness panel is removed', () => {
    const forbidden = present(adminSource, ['ReleaseReadinessTool', '<ReleaseReadinessTool', 'Yayın Hazırlığı', 'Release Readiness']);
    const publicRoutes = present(appSource, ['path="/release-readiness"', 'path="/release-proof"']);
    return forbidden.length || publicRoutes.length ? fail('A stale Release Readiness Admin surface or public route remains.', { forbidden, publicRoutes }) : pass('Admin renders no Release Readiness panel, launcher, section, or public route.');
  }, ['src/pages/AdminPage.jsx', 'src/App.jsx']),
  makeCase('release_readiness_tracked_by_health_and_docs', 'Release readiness is tracked by HealthCenter and proof docs', () => {
    const absent = missing(`${catalogSource}\n${docsSource}`, ["id: 'release_gate'", "label: 'Release Gate'", 'Health PASS is not release-ready proof', 'Health is a contract guard, not release proof']);
    return absent.length ? fail('Health/docs release-gate ownership drifted.', { missing: absent }) : pass('Release Gate Health and canonical proof docs own release readiness without an Admin checklist panel.');
  }, ['src/components/game/health/healthCatalog.js', 'docs/KRONOX_RELEASE_PROOF_CHECKLIST.md']),
  makeCase('manual_external_boundaries_preserved', 'Manual and external proof boundaries remain documented', () => {
    const absent = missing(docsSource, ['production Base44', 'real Android/iOS/WebView devices', 'RLS/multi-account', 'platform unique indexes', 'VAPID production provisioning', 'store validation']);
    return absent.length ? fail('Manual/external release boundaries are incomplete.', { missing: absent }) : pass('Deploy, devices, RLS, indexes, VAPID, and store evidence remain manual/external gates.');
  }, ['docs/KRONOX_RELEASE_PROOF_CHECKLIST.md', 'docs/KRONOX_SECURITY_DEPLOYMENT.md', 'docs/KRONOX_MOBILE_VISUAL_GUARDRAILS.md']),
  makeCase('no_fake_release_pass_ui', 'Health UI does not fabricate release-ready status', () => {
    const absent = missing(`${reportSource}\n${actionsSource}\n${docsSource}`, ['releaseReady', 'manualRequiredCount', 'Health PASS is not release-ready proof']);
    const fakeAdmin = present(adminSource, ['releaseReady: true', 'Yayına Hazır', 'Release Ready']);
    return absent.length || fakeAdmin.length ? fail('Release completion can be implied without proof.', { missing: absent, fakeAdmin }) : pass('Health reports manual requirements and Admin shows no fabricated release-complete panel.');
  }, ['src/components/game/health/simulationReportBuilder.jsx', 'src/components/game/health/SimulationReportActions.jsx', 'src/pages/AdminPage.jsx']),
  makeCase('admin_release_surface_has_no_private_output', 'Admin release surface exposes no secrets or private identifiers', () => {
    const forbidden = present(adminSource, ['VAPID_PRIVATE_KEY', 'KRONOX_ADMIN_EMAILS', 'google_oauth_client_secret', '{row.email}', '{guest_token}', '{owner_key}', '{actor_key_hash}', 'error.message']);
    return forbidden.length ? fail('Admin source renders private release/security values.', { forbidden }) : pass('No Release Readiness UI remains to render secrets, private IDs, or raw errors.');
  }, ['src/pages/AdminPage.jsx']),
  makeCase('bottom_nav_contract_unchanged', 'BottomNav remains exactly three product tabs', () => {
    const labels = Array.from(bottomNavSource.matchAll(/label:\s*'([^']+)'/g)).map((match) => match[1]);
    return JSON.stringify(labels) === JSON.stringify(['Ana Sayfa', 'Liderlik', 'Profil']) ? pass('BottomNav remains Ana Sayfa, Liderlik, and Profil only.') : fail('BottomNav labels changed.', { labels });
  }, ['src/components/layout/BottomNav.jsx']),
];