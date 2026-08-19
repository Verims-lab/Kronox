export const HEALTH_RETIRED_SUITES = [
  {
    id: 'research_test_strategy',
    replacementSuiteId: 'health_intelligence',
    reason: 'Retired after B6 because orchestration-comment scans duplicated executable catalog and proof-quality coverage.',
    proofCoverageRetained: true,
  },
  {
    id: 'report_ux_human_decision',
    replacementSuiteId: 'health_intelligence',
    reason: 'Retired after B6 because report actionability is covered by source-connected HealthCenter Intelligence cases.',
    proofCoverageRetained: true,
  },
  {
    id: 'sre_release_health_signals',
    replacementSuiteId: 'health_intelligence',
    reason: 'Retired after B6 because report timing, counts, ownership, and recoverability intelligence moved to the active report builder.',
    proofCoverageRetained: true,
  },
];

export const HEALTH_RETIRED_SUITE_IDS = new Set(HEALTH_RETIRED_SUITES.map((suite) => suite.id));

export const HEALTH_CANONICAL_REPLACEMENT_CASE_KEYS = new Set([
  'offline_solo.daily_quest_solo_completion_only',
  'waiting_room_start.start_not_route_only',
  'waiting_room_start.backend_snapshot_polling_detectable',
  'route_bootstrap.live_lobby_priority',
]);

export function canonicalizeHealthCases(cases) {
  const lastReplacementIndex = new Map();
  cases.forEach((item, index) => {
    if (HEALTH_CANONICAL_REPLACEMENT_CASE_KEYS.has(item?.key)) lastReplacementIndex.set(item.key, index);
  });
  return cases.filter((item, index) => (
    !HEALTH_CANONICAL_REPLACEMENT_CASE_KEYS.has(item?.key)
    || lastReplacementIndex.get(item.key) === index
  ));
}

export const HEALTH_RETIRED_CASES = [
  { key: 'timeline_hit_testing.drop_zone_rects_measurable', replacementCaseKey: 'mobile_safety.timeline_geometry_runtime_manual', reason: 'Duplicate DOM-manual proof.' },
  { key: 'timeline_hit_testing.drop_zone_rects_ordered', replacementCaseKey: 'mobile_safety.timeline_geometry_runtime_manual', reason: 'Duplicate DOM-manual proof.' },
  { key: 'timeline_hit_testing.no_zero_width_drop_zones', replacementCaseKey: 'mobile_safety.timeline_geometry_runtime_manual', reason: 'Duplicate DOM-manual proof.' },
  { key: 'timeline_hit_testing.timeline_scroll_no_page_scroll', replacementCaseKey: 'mobile_safety.timeline_geometry_runtime_manual', reason: 'Duplicate DOM-manual proof.' },
  { key: 'visual_guardrails.no_subjective_beauty_pass', replacementCaseKey: 'visual_composition_regression.no_subjective_beauty_pass', reason: 'Duplicate subjective visual guard.' },
  { key: 'fantasy_visual_update.subjective_beauty', replacementCaseKey: 'visual_composition_regression.no_subjective_beauty_pass', reason: 'Duplicate subjective visual guard.' },
  { key: 'historical_kronox_regression.duplicate_lobby_title_contract', replacementCaseKey: 'online_challenge.current_lobby_copy', reason: 'Stale duplicate lobby-title check.' },
  { key: 'random_matchmaking_health.runtime_random_matchmaking_not_detected', replacementCaseKey: 'random_matchmaking_health.runtime_random_matchmaking_detected', reason: 'Obsolete negative matchmaking warning.' },
  { key: 'health_intelligence.catalog_ids_and_targets_valid', replacementCaseKey: 'health_proof_integrity.unique_suite_and_case_ids', reason: 'Consolidated into the dedicated proof-integrity suite.' },
  { key: 'health_intelligence.retired_cases_are_absent', replacementCaseKey: 'health_proof_integrity.no_dead_string_proof', reason: 'Consolidated into the dedicated proof-integrity suite.' },
  { key: 'health_intelligence.run_packs_have_cases', replacementCaseKey: 'health_proof_integrity.unique_suite_and_case_ids', reason: 'Pack emptiness is part of the catalog identity audit.' },
];

export const HEALTH_RETIRED_CASE_KEYS = new Set(HEALTH_RETIRED_CASES.map((item) => item.key));

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
  if (['NOT_AUTOMATABLE', 'MANUAL_REQUIRED'].includes(item.status) || /MANUAL|EXTERNAL|TWO_ACCOUNT|DEVICE/.test(labels)) return 'MANUAL_EXTERNAL';
  if (/RUNTIME_VERIFIED|EXECUTABLE|SIMULATION/.test(labels)) return 'EXECUTABLE';
  if (/STATIC_CONTRACT|SOURCE/.test(labels) && deriveRelatedFiles(item).length) return 'SOURCE_CONNECTED';
  if (/STATIC/.test(labels)) return 'STATIC_ONLY';
  return 'UNCLASSIFIED';
}

export function deriveEvidenceClassification(item = {}, labels = [], relatedFiles = deriveRelatedFiles(item)) {
  const normalized = labels.map((label) => String(label || '').toUpperCase());
  const explicitClassification = String(item.classification || '').toUpperCase();
  const joined = [...normalized, explicitClassification].join(' ');
  if (['NOT_AUTOMATABLE', 'MANUAL_REQUIRED'].includes(item.status) || /MANUAL|EXTERNAL|TWO_ACCOUNT|DEVICE/.test(joined)) return 'MANUAL_EXTERNAL';
  if (item.classification) return item.classification;
  if (normalized.includes('STATIC_CHECK_LIMITATION')) return 'STATIC_CHECK_LIMITATION';
  if (/RUNTIME_VERIFIED|EXECUTABLE|SIMULATION/.test(joined)) return 'RUNTIME_VERIFIED';
  if (/SOURCE_CONNECTED|SOURCE/.test(joined)) return 'SOURCE_CONNECTED';
  if (/STATIC_CONTRACT|STATIC_ONLY|STATIC/.test(joined)) return relatedFiles.length ? 'SOURCE_CONNECTED' : 'STATIC_CHECK_LIMITATION';
  if (item.status === 'PASS') return relatedFiles.length ? 'SOURCE_CONNECTED' : 'STATIC_CHECK_LIMITATION';
  return 'REAL_PRODUCT_RISK';
}

export function deriveRelatedFiles(item = {}) {
  const values = [item.file, item.path, item.sourceFile, ...(item.files || []), ...(item.relatedFiles || [])];
  return Array.from(new Set(values.map((value) => String(value || '').trim()).filter(Boolean)));
}

export function deriveFixOwner(item = {}) {
  if (item.proofQuality === 'MANUAL_EXTERNAL' || ['NOT_AUTOMATABLE', 'MANUAL_REQUIRED'].includes(item.status)) return 'Manual / external';
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
  const make = (id, name, run) => ({ key: `health_proof_integrity.${id}`, suiteId: 'health_proof_integrity', suiteName: 'Health Proof Integrity Suite', id, name, critical: true, actionType: 'CODE_FIX', relatedFiles: ['src/components/game/health/healthCatalog.js', 'src/components/game/health/simulationCases.jsx'], run });
  return [
    make('unique_suite_and_case_ids', 'Health catalog has unique suite/case IDs, active targets, and non-empty packs', () => {
      const audit = auditHealthCatalog(suites, tests);
      const issues = [...audit.duplicateSuiteIds, ...audit.duplicateCaseKeys, ...audit.orphanCases, ...audit.malformedCases, ...audit.retiredStillActive, ...audit.emptyPacks];
      return issues.length
        ? { status: 'FAIL', reason: 'Health catalog identity, target, retirement, or pack integrity failed.', verification: 'EXECUTABLE_SIMULATION', classification: 'EXECUTABLE', actual: audit }
        : { status: 'PASS', reason: 'Suite/case IDs are unique; every case targets a registered suite with a runner; retired cases are absent; every pack resolves active cases.', verification: 'EXECUTABLE_SIMULATION', classification: 'EXECUTABLE', actual: audit };
    }),
  ];
}

function duplicateValues(values) {
  const seen = new Set();
  const duplicates = new Set();
  values.forEach((value) => seen.has(value) ? duplicates.add(value) : seen.add(value));
  return Array.from(duplicates);
}
