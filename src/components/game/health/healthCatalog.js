export const HEALTH_RETIRED_SUITE_IDS = new Set([
  'research_test_strategy',
  'report_ux_human_decision',
  'sre_release_health_signals',
]);

export const HEALTH_RETIRED_CASE_KEYS = new Set([
  'timeline_hit_testing.drop_zone_rects_measurable',
  'timeline_hit_testing.drop_zone_rects_ordered',
  'timeline_hit_testing.no_zero_width_drop_zones',
  'timeline_hit_testing.timeline_scroll_no_page_scroll',
  'visual_guardrails.no_subjective_beauty_pass',
  'fantasy_visual_update.subjective_beauty',
  'historical_kronox_regression.duplicate_lobby_title_contract',
  'random_matchmaking_health.runtime_random_matchmaking_not_detected',
]);

export const HEALTH_PACKS = [
  { id: 'quick_smoke', label: 'Quick Smoke', pattern: /environment|report_integrity|health_intelligence|paket_b_closure/ },
  { id: 'release_gate', label: 'Release Gate', pattern: /release|deploy|security|integrity|question_quality|mobile_safety|paket_b/ },
  { id: 'security', label: 'Security', pattern: /security|privacy|authorization|rls|account_deletion|admin_visibility/ },
  { id: 'economy', label: 'Economy', pattern: /economy|market|joker|diamond|integrity_proof/ },
  { id: 'online', label: 'Online', pattern: /online|lobby|invite|matchmaking|multiplayer|waiting_room|route_bootstrap/ },
  { id: 'daily', label: 'Daily', pattern: /daily|wheel/ },
  { id: 'solo', label: 'Solo', pattern: /solo|timeline|question_card|game_rules|placement/ },
  { id: 'mobile', label: 'Mobile', pattern: /mobile|viewport|gesture|visual|a11y|compatibility/ },
  { id: 'admin_proof', label: 'Admin / Proof', pattern: /admin|proof|report|question_quality|release|integrity/ },
  { id: 'full', label: 'Full', pattern: /.*/ },
];

export function getHealthPack(packId) {
  return HEALTH_PACKS.find((pack) => pack.id === packId) || HEALTH_PACKS[0];
}

export function getHealthPackCases(tests, packId) {
  const pack = getHealthPack(packId);
  return tests.filter((item) => pack.pattern.test(`${item.suiteId} ${item.key}`));
}

export function deriveProofQuality(item = {}) {
  const labels = [item.verification, item.classification, ...(item.verificationLabels || [])].join(' ').toUpperCase();
  if (item.status === 'NOT_AUTOMATABLE' || /MANUAL|EXTERNAL|TWO_ACCOUNT|DEVICE/.test(labels)) return 'MANUAL_EXTERNAL';
  if (/RUNTIME_VERIFIED|EXECUTABLE|SIMULATION/.test(labels)) return 'EXECUTABLE';
  if (/STATIC_CONTRACT|SOURCE/.test(labels) && deriveRelatedFiles(item).length) return 'SOURCE_CONNECTED';
  if (/STATIC/.test(labels)) return 'STATIC_ONLY';
  return 'UNCLASSIFIED';
}

export function deriveRelatedFiles(item = {}) {
  const values = [item.file, item.path, item.sourceFile, ...(item.files || []), ...(item.relatedFiles || [])];
  return Array.from(new Set(values.map((value) => String(value || '').trim()).filter(Boolean)));
}

export function deriveFixOwner(item = {}) {
  if (item.proofQuality === 'MANUAL_EXTERNAL' || item.status === 'NOT_AUTOMATABLE') return 'Manual / external';
  const files = deriveRelatedFiles(item).join(' ').toLowerCase();
  const text = `${item.key || ''} ${item.actionType || ''} ${files}`.toLowerCase();
  if (/docs\/|mirror/.test(text)) return 'Docs / mirror';
  if (/package|lock|sdk|ci_environment/.test(text)) return 'Codex package / repo';
  if (/base44\/functions|backend_runtime|service_role|runtime_probe/.test(text)) return 'Backend / runtime';
  return 'Base44 UI';
}

export function nextActionForOwner(owner) {
  if (owner === 'Manual / external') return 'Attach the required device, account, deployment, or platform evidence.';
  if (owner === 'Docs / mirror') return 'Align the canonical document and its active runtime mirror.';
  if (owner === 'Codex package / repo') return 'Fix the package/build source and rerun the affected pack.';
  if (owner === 'Backend / runtime') return 'Fix or deploy the active backend path, then run a safe authenticated probe.';
  return 'Fix the active UI/helper source and rerun the affected pack.';
}

export function buildHealthInventory(cases, suites) {
  const counts = { useful: 0, weakProof: 0, duplicate: 0, staleOrRetired: 0, manualExternal: 0, deadSource: 0, broadAggregate: 0, missingTarget: 0 };
  const seen = new Set();
  cases.forEach((item) => {
    const quality = item.proofQuality || deriveProofQuality(item);
    const files = deriveRelatedFiles(item);
    if (seen.has(item.key)) counts.duplicate += 1; else seen.add(item.key);
    if (HEALTH_RETIRED_CASE_KEYS.has(item.key) || HEALTH_RETIRED_SUITE_IDS.has(item.suiteId)) counts.staleOrRetired += 1;
    if (quality === 'MANUAL_EXTERNAL') counts.manualExternal += 1;
    else if (quality === 'STATIC_ONLY' || quality === 'UNCLASSIFIED') counts.weakProof += 1;
    else counts.useful += 1;
    if (!files.length && quality === 'SOURCE_CONNECTED') counts.deadSource += 1;
    if (!files.length && item.critical && quality !== 'EXECUTABLE' && quality !== 'MANUAL_EXTERNAL') counts.missingTarget += 1;
    if (files.length > 5 || (Array.isArray(item.expected) && item.expected.length > 16)) counts.broadAggregate += 1;
  });
  return { ...counts, caseCount: cases.length, suiteCount: suites.filter((suite) => cases.some((item) => item.suiteId === suite.id)).length };
}

export function auditHealthCatalog(suites, tests) {
  const duplicateSuiteIds = duplicateValues(suites.map((suite) => suite.id));
  const duplicateCaseKeys = duplicateValues(tests.map((item) => item.key));
  const suiteIds = new Set(suites.map((suite) => suite.id));
  const orphanCases = tests.filter((item) => !suiteIds.has(item.suiteId)).map((item) => item.key);
  const malformedCases = tests.filter((item) => !item.key || !item.id || !item.name || typeof item.run !== 'function').map((item) => item.key || item.id || 'unknown');
  const retiredStillActive = tests.filter((item) => HEALTH_RETIRED_CASE_KEYS.has(item.key) || HEALTH_RETIRED_SUITE_IDS.has(item.suiteId)).map((item) => item.key);
  const emptyPacks = HEALTH_PACKS.filter((pack) => pack.id !== 'full' && getHealthPackCases(tests, pack.id).length === 0).map((pack) => pack.id);
  return { duplicateSuiteIds, duplicateCaseKeys, orphanCases, malformedCases, retiredStillActive, emptyPacks };
}

export function createHealthCatalogAuditCases(suites, tests) {
  const make = (id, name, run) => ({ key: `health_intelligence.${id}`, suiteId: 'health_intelligence', suiteName: 'HealthCenter Intelligence Suite', id, name, critical: true, actionType: 'CODE_FIX', relatedFiles: ['healthCatalog.js', 'simulationCases.jsx'], run });
  return [
    make('catalog_ids_and_targets_valid', 'Health catalog has unique IDs, valid suites, and executable case definitions', () => {
      const audit = auditHealthCatalog(suites, tests);
      const issues = [...audit.duplicateSuiteIds, ...audit.duplicateCaseKeys, ...audit.orphanCases, ...audit.malformedCases];
      return issues.length ? { status: 'FAIL', reason: 'Health catalog identity or target integrity failed.', verification: 'EXECUTABLE_SIMULATION', actual: audit } : { status: 'PASS', reason: 'Suite/case IDs are unique and every case targets a registered suite with an executable runner.', verification: 'EXECUTABLE_SIMULATION', actual: audit };
    }),
    make('retired_cases_are_absent', 'Retired stale/duplicate Health cases are absent from the active catalog', () => {
      const active = tests.filter((item) => HEALTH_RETIRED_CASE_KEYS.has(item.key) || HEALTH_RETIRED_SUITE_IDS.has(item.suiteId)).map((item) => item.key);
      return active.length ? { status: 'FAIL', reason: 'Retired Health coverage is still active.', verification: 'EXECUTABLE_SIMULATION', actual: active } : { status: 'PASS', reason: 'Obsolete comment-scan, duplicate visual, duplicate DOM, and stale matchmaking cases are removed or replaced.', verification: 'EXECUTABLE_SIMULATION' };
    }),
    make('run_packs_have_cases', 'Every grouped Health pack resolves to active cases', () => {
      const empty = HEALTH_PACKS.filter((pack) => getHealthPackCases(tests, pack.id).length === 0).map((pack) => pack.id);
      return empty.length ? { status: 'FAIL', reason: 'A Health run pack is empty.', verification: 'EXECUTABLE_SIMULATION', actual: empty } : { status: 'PASS', reason: 'Quick, release, domain, admin/proof, and full packs all resolve active cases.', verification: 'EXECUTABLE_SIMULATION' };
    }),
  ];
}

function duplicateValues(values) {
  const seen = new Set();
  const duplicates = new Set();
  values.forEach((value) => seen.has(value) ? duplicates.add(value) : seen.add(value));
  return Array.from(duplicates);
}