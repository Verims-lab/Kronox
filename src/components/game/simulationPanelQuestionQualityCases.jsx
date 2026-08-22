import reportSource from '../../../base44/functions/adminDuplicateKeyReport/entry.ts?raw';
import questionEntitySource from '../../../base44/entities/Question.jsonc?raw';
import categoryEntitySource from '../../../base44/entities/Category.jsonc?raw';
import getQuestionsSource from '../../../base44/functions/getQuestions/entry.ts?raw';
import startOnlineSource from '../../../base44/functions/startLobbyGame/entry.ts?raw';
import adminSource from '../../pages/AdminPage.jsx?raw';
import appSource from '../../App.jsx?raw';
import panelSource from '../admin/QuestionQualityTool.jsx?raw';
import coverageSource from '../admin/QuestionQualityCoverage.jsx?raw';
import risksSource from '../admin/QuestionQualityRisks.jsx?raw';
import timelineSource from '../admin/QuestionQualityTimeline.jsx?raw';
import onlineScreenSource from '../lobby/OnlineChallengeScreen.jsx?raw';
import functionGateSource from '../../../scripts/checkBase44FunctionsCompile.mjs?raw';

const SUITE_ID = 'question_quality_health';
const SUITE_NAME = 'Question Quality Health Suite';
const RELATED_FILES = [
  'base44/functions/adminDuplicateKeyReport/entry.ts',
  'base44/functions/getQuestions/entry.ts',
  'base44/functions/startLobbyGame/entry.ts',
  'src/components/admin/QuestionQualityTool.jsx',
  'base44/entities/Question.jsonc',
];
const pass = (reason) => ({ status: 'PASS', reason, verification: 'STATIC_CONTRACT' });
const fail = (reason, actual) => ({ status: 'FAIL', reason, actual, verification: 'STATIC_CONTRACT' });
const missing = (source, tokens) => tokens.filter((token) => !String(source || '').includes(token));
const present = (source, tokens) => tokens.filter((token) => String(source || '').includes(token));
const makeCase = (id, name, run) => ({ key: `${SUITE_ID}.${id}`, suiteId: SUITE_ID, suiteName: SUITE_NAME, id, name, critical: true, actionType: 'CODE_FIX', relatedFiles: RELATED_FILES, run });

export const EXTRA_SUITES = [{ id: SUITE_ID, name: SUITE_NAME, critical: true, color: '#a78bfa' }];
export const EXTRA_TESTS = [
  makeCase('admin_only_question_quality_panel', 'Question QA panel is Admin-only', () => {
    const absent = missing(`${adminSource}\n${appSource}\n${panelSource}\n${reportSource}`, ['<AdminRoute><AdminPage', '<QuestionQualityTool />', 'data-admin-question-quality="read-only"', 'requireAdmin(base44)', "code: 'admin_required'"]);
    return absent.length ? fail('Question QA Admin boundary drifted.', { missing: absent }) : pass('The panel exists only inside guarded Admin Ekranı and the reused report independently requires AdminUser authorization.');
  }),
  makeCase('question_quality_report_is_read_only', 'Question quality report is read-only', () => {
    const absent = missing(reportSource, ["mode === 'question_quality'", 'dryRun: true', 'readOnly: true', 'mutatesRows: false', 'destructiveCleanupImplemented: false']);
    const forbidden = present(reportSource, ['.create(', '.update(', '.delete(', '.deleteMany(', '.updateMany(', '.bulkCreate(', '.bulkUpdate(']);
    return absent.length || forbidden.length ? fail('B3 report is not provably read-only.', { missing: absent, forbidden }) : pass('B3 performs bounded service-role reads only and explicitly reports no mutation or cleanup capability.');
  }),
  makeCase('no_public_full_question_bank_exposure', 'Full question bank remains protected', () => {
    const absent = missing(`${questionEntitySource}\n${getQuestionsSource}\n${reportSource}`, ['"read": {\n      "user_condition": {\n        "role": "admin"', 'MAX_AUTH_GAMEPLAY_RESPONSE_LIMIT', 'responseCapApplied', "mode === 'question_quality'", 'requireAdmin(base44)']);
    return absent.length ? fail('Question bank protection or bounded gameplay projection drifted.', { missing: absent }) : pass('Question entity reads remain admin-only while gameplay receives the existing bounded backend projection.');
  }),
  makeCase('category_distribution_reported', 'Canonical category distribution is reported', () => {
    const absent = missing(`${reportSource}\n${categoryEntitySource}\n${coverageSource}`, ["fetchWindow(base44, 'Category', 500)", 'categoryById', 'categoryCoverage', 'canonicalCategoryCount', 'unknownOrOrphanedQuestionCount', 'categoriesWithZeroActive', 'categoriesUnderfilled', 'Kategori ve Zorluk Dağılımı']);
    return absent.length ? fail('Canonical taxonomy coverage metrics are incomplete.', { missing: absent }) : pass('Category names/IDs, active/passive counts, orphan references, empty categories, and underfilled categories are reported.');
  }),
  makeCase('difficulty_distribution_reported', 'Difficulty distribution and invalid values are reported', () => {
    const absent = missing(`${reportSource}\n${coverageSource}`, ['difficultyDistribution', 'validDifficulty', 'difficultyDistribution.invalid', 'invalidDifficultyCount', 'metric.difficulty[difficulty]', '[1, 2].includes(difficulty)']);
    return absent.length ? fail('Difficulty balance proof drifted.', { missing: absent }) : pass('B3 reports active question difficulty totals, per-category difficulty, and invalid/missing values without rebalancing.');
  }),
  makeCase('year_quality_reported', 'Timeline year quality is reported', () => {
    const absent = missing(reportSource, ['parseQuestionYear', 'invalidOrMissingYearCount', 'denseYearClusters', 'sameYearRiskCount', 'veryOldOrFutureOutlierCount', 'highRiskActiveMissingYearCount', 'distribution: yearDistribution']);
    return absent.length ? fail('Timeline/year quality signals are incomplete.', { missing: absent }) : pass('Missing/invalid years, same-year concentration, dense clusters, outliers, and active-pool risk are reported.');
  }),
  makeCase('duplicate_question_risk_reported', 'Exact and normalized duplicate risks are reported', () => {
    const absent = missing(reportSource, ['normalizeQuestionText', 'exactTextGroups', 'normalizedTextGroups', 'answerYearCategoryGroups', 'idGroups', 'boundedDuplicateSummary', 'duplicateRowCount']);
    return absent.length ? fail('Question duplicate-risk checks drifted.', { missing: absent }) : pass('Exact text, normalized text, answer/year/category, and duplicate-ID signals use bounded deterministic grouping.');
  }),
  makeCase('metadata_completeness_reported', 'Question metadata completeness is reported', () => {
    const absent = missing(`${reportSource}\n${risksSource}\n${timelineSource}`, ['questionText: 0', 'answerText: 0', 'year: 0', 'category: 0', 'subcategory: 0', 'tag: 0', 'difficulty: 0', 'state: 0', 'totalMissingSignals', 'Eksik metadata sinyali', 'Yıl ve Metadata Tamlığı']);
    return absent.length ? fail('Metadata completeness coverage drifted.', { missing: absent }) : pass('Question text, answer, year, category, subcategory, tag, difficulty, and state gaps are counted.');
  }),
  makeCase('online_all_active_category_coverage_reported', 'Online all-active-category readiness is reported', () => {
    const absent = missing(`${reportSource}\n${startOnlineSource}\n${onlineScreenSource}`, ['allActiveCategoryPolicy: true', 'onlineCategorySelectorAllowed: false', 'onlineSharedDeckReady', 'onlineEligibleCount', 'online_shared_all_active_random_deck_v1', 'allCategoriesRandom: true', 'const random = useRandomMatchmaking(STANDARD_RANDOM_MODE)']);
    const forbidden = present(onlineScreenSource, ['OnlineCategoryCarousel', 'selectedCategoryIds']);
    return absent.length || forbidden.length ? fail('Online readiness proof or no-category UI contract drifted.', { missing: absent, forbidden }) : pass('B3 measures all-active random shared-deck coverage without adding Online category selection.');
  }),
  makeCase('no_backend_function_count_growth', 'B3 does not increase backend function count', () => {
    const absent = missing(`${functionGateSource}\n${panelSource}`, ['MAX_BASE44_FUNCTIONS = 50', 'entryFiles.length > MAX_BASE44_FUNCTIONS', "invoke('adminDuplicateKeyReport'"]);
    return absent.length ? fail('B3 function reuse or deploy ceiling proof drifted.', { missing: absent }) : pass('B3 reuses adminDuplicateKeyReport and the 50-function ceiling remains enforced.');
  }),
  makeCase('admin_samples_are_bounded', 'Question QA samples are bounded and fingerprint-only', () => {
    const absent = missing(reportSource, ['sampleLimit = 5', 'duplicates.slice(0, sampleLimit)', 'fingerprint: keyFingerprint(key)', "sampleExposure: 'fingerprint_only'", 'sampleLimitPerCheck: 5', '.slice(0, 100)', '.slice(0, 40)']);
    return absent.length ? fail('Admin QA output can return unbounded or raw question samples.', { missing: absent }) : pass('Samples expose fingerprints/counts only; category, year, and subcategory outputs are bounded.');
  }),
  makeCase('no_auto_question_mutation', 'B3 adds no automatic question mutation', () => {
    const forbidden = present(`${reportSource}\n${panelSource}`, ['Question.create', 'Question.update', 'Question.delete', 'autoActivate', 'autoDeactivate', 'rewriteQuestion', 'deleteDuplicateQuestion']);
    return forbidden.length ? fail('An automatic question mutation path was detected.', { forbidden }) : pass('B3 has no rewrite, activation, deactivation, deletion, cleanup, or auto-rebalance path.');
  }),
];
