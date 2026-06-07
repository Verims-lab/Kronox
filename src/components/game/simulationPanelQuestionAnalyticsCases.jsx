// Kronox Health Center — Question Analytics P3 contracts.
//
// Static coverage for best-effort Solo QuestionAttemptEvent writes and the
// manual admin email report. Live email delivery, deployed RLS probes, and
// analytics volume/performance proof remain manual runtime checks.

import gamePageSource from '../../pages/Game.jsx?raw';
import useGameActionsSource from '../../hooks/useGameActions.js?raw';
import analyticsGatewaySource from '../../lib/dbGateway/analyticsGateway.js?raw';
import questionAnalyticsContractsSource from '../../lib/questionAnalyticsContracts.js?raw';
import settingsPageSource from '../../pages/SettingsPage.jsx?raw';
import questionAnalyticsReportToolSource from '../admin/QuestionAnalyticsReportTool.jsx?raw';
import deleteAccountSource from '../../../base44/functions/deleteAccount/entry.ts?raw';
import questionAttemptEventEntitySource from '../../../base44/entities/QuestionAttemptEvent.jsonc?raw';
import questionStatsProjectionEntitySource from '../../../base44/entities/QuestionStatsProjection.jsonc?raw';
import categoryStatsProjectionEntitySource from '../../../base44/entities/CategoryStatsProjection.jsonc?raw';
import adminAuthSource from '../../../base44/functions/_shared/adminAuth.ts?raw';
import aggregateQuestionStatsSource from '../../../base44/functions/aggregateQuestionStats/entry.ts?raw';
import reportFunctionSource from '../../../base44/functions/sendQuestionAnalyticsReportEmail/entry.ts?raw';
import reportFunctionManifestSource from '../../../base44/functions/sendQuestionAnalyticsReportEmail/function.jsonc?raw';
import deployedRootReportFunctionSource from '../../../functions/sendQuestionAnalyticsReportEmail.js?raw';
import getQuestionsSource from '../../../base44/functions/getQuestions/entry.ts?raw';
import { DB_ARCHITECTURE_IMPLEMENTATION_MIRROR } from '@/lib/dbArchitectureMirrors';
import {
  QUESTION_ANALYTICS_REPORT_SECTIONS,
  QUESTION_ANALYTICS_SECURITY_CONTRACT,
} from '@/lib/questionAnalyticsContracts';

const STATUS = {
  PASS: 'PASS',
  FAIL: 'FAIL',
  NOT_AUTOMATABLE: 'NOT_AUTOMATABLE',
};

const ACTION_TYPES = {
  CODE_FIX: 'CODE_FIX',
  BACKEND_RUNTIME_PROBE: 'BACKEND_RUNTIME_PROBE',
  MANUAL_REVIEW: 'MANUAL_REVIEW',
};

const SUITE_ID = 'question_analytics_health';
const SUITE_NAME = 'Question Analytics Health Suite';

function text(source) {
  if (source == null) return '';
  if (typeof source === 'string') return source;
  try { return String(source); } catch { return ''; }
}

function missingTokens(source, tokens) {
  const value = text(source);
  return tokens.filter((token) => !value.includes(token));
}

function forbiddenTokens(source, tokens) {
  const value = text(source);
  return tokens.filter((token) => value.includes(token));
}

function pass(reason, extra = {}) { return { status: STATUS.PASS, reason, ...extra }; }
function fail(reason, extra = {}) { return { status: STATUS.FAIL, reason, ...extra }; }
function notAutomatable(reason, extra = {}) { return { status: STATUS.NOT_AUTOMATABLE, reason, ...extra }; }

function makeCase(id, name, run, options = {}) {
  return {
    key: `${SUITE_ID}.${id}`,
    suiteId: SUITE_ID,
    suiteName: SUITE_NAME,
    id,
    name,
    critical: options.critical ?? true,
    actionType: options.actionType || ACTION_TYPES.CODE_FIX,
    nextStep: options.nextStep || 'Keep question analytics private, admin-only, best-effort, and gameplay-safe.',
    ...options,
    run,
  };
}

export const EXTRA_SUITES = [
  { id: SUITE_ID, name: SUITE_NAME, critical: true, color: '#38bdf8' },
];

export const EXTRA_TESTS = [
  makeCase('question_attempt_event_schema_exists',
    'QuestionAttemptEvent schema captures shown/answered/swap analytics fields',
    () => {
      const combined = `${questionAttemptEventEntitySource}\n${questionAnalyticsContractsSource}`;
      const missing = missingTokens(combined, [
        'QuestionAttemptEvent',
        'event_id',
        'user_key',
        'question_id',
        'attempt_id',
        'mode',
        'level',
        'is_special_level',
        'event_type',
        'shown',
        'answered',
        'swapped_out',
        'replacement_shown',
        'shown_at',
        'answered_at',
        'is_correct',
        'response_time_ms',
        'category_id',
        'sub_category',
        'answer_year',
        'joker_used',
        'joker_type',
        'replacement_for_question_id',
        'source',
        'build_marker',
      ]);
      if (missing.length) {
        return fail('QuestionAttemptEvent is missing required P3 analytics fields.', {
          verification: 'STATIC_CONTRACT',
          file: 'base44/entities/QuestionAttemptEvent.jsonc',
          missing,
        });
      }
      return pass('QuestionAttemptEvent supports exposure, answer, swap, replacement, and metadata events.', {
        verification: 'STATIC_CONTRACT',
      });
    }),

  makeCase('solo_runtime_writes_best_effort_events',
    'Solo shown/answered runtime path writes analytics best-effort',
    () => {
      const combined = `${gamePageSource}\n${useGameActionsSource}\n${analyticsGatewaySource}`;
      const missing = missingTokens(combined, [
        'recordSoloQuestionAnalyticsEvent(currentQuestion, QUESTION_ANALYTICS_EVENT_TYPES.SHOWN',
        'onQuestionAnswered',
        'handleSoloQuestionAnswered',
        'QUESTION_ANALYTICS_EVENT_TYPES.ANSWERED',
        'writeSoloQuestionAnalyticsEvent',
        '.catch(() => null)',
        'missing_authenticated_user',
        'soloAnalyticsEventIdsRef',
      ]);
      if (missing.length) {
        return fail('Solo runtime analytics wiring is incomplete or could block gameplay.', {
          verification: 'STATIC_CONTRACT',
          files: ['src/pages/Game.jsx', 'src/hooks/useGameActions.js', 'src/lib/dbGateway/analyticsGateway.js'],
          missing,
        });
      }
      return pass('Solo shown/answered analytics are deduped and written through best-effort gateway calls.', {
        verification: 'STATIC_CONTRACT',
      });
    }),

  makeCase('kart_degistir_records_swap_and_replacement',
    'Kart Değiştir records swapped-out and replacement-shown analytics',
    () => {
      const missing = missingTokens(gamePageSource, [
        'QUESTION_ANALYTICS_EVENT_TYPES.SWAPPED_OUT',
        'QUESTION_ANALYTICS_EVENT_TYPES.REPLACEMENT_SHOWN',
        'was_swapped_out: true',
        'replacement_for_question_id',
        'QUESTION_ANALYTICS_SOURCES.REPLACEMENT',
        'soloReplacementQuestionIdsRef',
      ]);
      if (missing.length) {
        return fail('Kart Değiştir analytics events are missing.', {
          verification: 'STATIC_CONTRACT',
          file: 'src/pages/Game.jsx',
          missing,
        });
      }
      return pass('Kart Değiştir records both the removed card and the replacement source.', {
        verification: 'STATIC_CONTRACT',
      });
    }),

  makeCase('manual_admin_email_report_function_exists',
    'Manual admin email report function is admin-only and question-focused',
    () => {
      const sectionMissing = QUESTION_ANALYTICS_REPORT_SECTIONS.filter((section) => !reportFunctionSource.includes(section));
      const combined = `${reportFunctionSource}\n${adminAuthSource}`;
      const missing = missingTokens(combined, [
        'sendQuestionAnalyticsReportEmail',
        'Deno.serve',
        'createClientFromRequest',
        'requireAdmin',
        '../_shared/adminAuth.ts',
        'entities.AdminUser',
        'QuestionAttemptEvent.list',
        'Question.list',
        'Category.list',
        'UserCategoryPreference.list',
        'SendEmail',
        'Kronox Soru Analiz Raporu —',
        'Kronox Soru Analiz Raporu',
        'Executive Summary',
        'Key Insights / Risk Flags',
        'safeSectionHtml',
        'htmlSections',
        'section_render_failed',
        'Rapor Bölümleri',
        'Rapor Şablonu: static-pool-v2',
        'REPORT_TEMPLATE_VERSION = "static-pool-v2"',
        'REPORT_TEMPLATE_LABEL = "Rapor Şablonu: static-pool-v2"',
        'bodyContainsStaticPoolSection',
        'bodyContainsTemplateMarker',
        'bodyContainsQuestionSourceMarker',
        'Sistemdeki Soru Havuzu: Kategori / Zorluk Dağılımı',
        'Kaynak: Question tablosu',
        'Toplam aktif kayıtlı soru',
        'Kategori Bazında Soru Havuzu',
        'Kategori ve Zorluk Bazında Kayıtlı Soru Sayısı',
        'Kategori Bazında Kayıtlı Soru Havuzu',
        'Kategori Bazında Yıl Aralığı',
        'Kategori Tercihleri',
        'Kategori Bazında Gösterim',
        'Kategori İçi Soru Analizi',
        'Kategori Denge Sinyalleri',
        'Rapor Tamamlandı',
        'En Çok Gösterilen Sorular',
        'Az veya Hiç Gösterilmeyen Sorular',
        'En Çok Yanlış Yapılan Sorular',
        'Çok Kolay Görünen Sorular',
        'En Uzun Sürede Cevaplanan Sorular',
        'Veri Kalitesi Uyarıları',
        'AdminMaintenanceLog.create',
      ]);
      const manifestMissing = missingTokens(reportFunctionManifestSource, [
        '"name": "sendQuestionAnalyticsReportEmail"',
        '"entry": "entry.ts"',
      ]);
      if (missing.length || sectionMissing.length || manifestMissing.length) {
        return fail('Manual question analytics report backend contract is incomplete.', {
          verification: 'STATIC_CONTRACT',
          files: ['base44/functions/sendQuestionAnalyticsReportEmail/entry.ts'],
          missing: [...missing, ...sectionMissing, ...manifestMissing],
        });
      }
      return pass('Manual report function is admin-gated and includes the required aggregate sections.', {
        verification: 'STATIC_CONTRACT',
      });
    }),

  makeCase('manual_admin_email_report_deployed_root_entrypoint',
    'Root deploy entrypoint contains the complete current report implementation',
    () => {
      const missing = missingTokens(deployedRootReportFunctionSource, [
        'sendQuestionAnalyticsReportEmail',
        './_shared/adminAuth.js',
        'requireAdmin',
        'Question.list',
        'Sistemdeki Soru Havuzu: Kategori / Zorluk Dağılımı',
        'REPORT_TEMPLATE_VERSION = "static-pool-v2"',
        'REPORT_TEMPLATE_LABEL = "Rapor Şablonu: static-pool-v2"',
        'escapeHtml(REPORT_TEMPLATE_LABEL)',
        'bodyContainsStaticPoolSection',
        'bodyContainsTemplateMarker',
        'bodyContainsQuestionSourceMarker',
        'emailHtml.includes("Sistemdeki Soru Havuzu: Kategori / Zorluk Dağılımı")',
        'emailHtml.includes(REPORT_TEMPLATE_LABEL)',
        'emailHtml.includes("Kaynak: Question tablosu")',
        'body: emailHtml',
        'html: emailHtml',
        'Kaynak: Question tablosu',
        'Toplam aktif kayıtlı soru',
        'Zorluk 1',
        'Zorluk 2',
        'Zorluk 3',
        'Zorluk 4',
        'Zorluk 5',
        'Bilinmiyor',
        'Dağılım',
        'safeSectionHtml("Key Insights / Risk Flags"',
        'safeSectionHtml("Sistemdeki Soru Havuzu: Kategori / Zorluk Dağılımı"',
        'safeSectionHtml("En Çok Gösterilen Sorular"',
        'textLines.join(\'\\n\')',
      ]);
      const orderFailures = [
        ['safeSectionHtml("Key Insights / Risk Flags"', 'safeSectionHtml("Sistemdeki Soru Havuzu: Kategori / Zorluk Dağılımı"'],
        ['safeSectionHtml("Sistemdeki Soru Havuzu: Kategori / Zorluk Dağılımı"', 'safeSectionHtml("En Çok Gösterilen Sorular"'],
        ['safeSectionHtml("Sistemdeki Soru Havuzu: Kategori / Zorluk Dağılımı"', 'safeSectionHtml("Az veya Hiç Gösterilmeyen Sorular"'],
      ].filter(([first, second]) => {
        const firstIndex = deployedRootReportFunctionSource.indexOf(first);
        const secondIndex = deployedRootReportFunctionSource.indexOf(second);
        return firstIndex < 0 || secondIndex < 0 || firstIndex >= secondIndex;
      });
      const forbidden = forbiddenTokens(deployedRootReportFunctionSource, [
        '../base44/functions/sendQuestionAnalyticsReportEmail/entry.ts',
      ]);
      if (missing.length || orderFailures.length || forbidden.length) {
        return fail('Root deploy entrypoint can drift into an old flat report implementation or wrapper-only package.', {
          verification: 'STATIC_CONTRACT',
          file: 'functions/sendQuestionAnalyticsReportEmail.js',
          actual: { missing, orderFailures, forbidden },
        });
      }
      return pass('Root deploy entrypoint contains the current static Question-table chart before long event sections.', {
        verification: 'STATIC_CONTRACT',
      });
    }),

  makeCase('analytics_report_separates_active_solo_and_projection_pools',
    'Question Analytics report separates active pool, Solo-eligible pool, and runtime projection diagnostics',
    () => {
      const combined = `${reportFunctionSource}\n${getQuestionsSource}`;
      const missing = missingTokens(combined, [
        'isSoloEligibleQuestion',
        'buildActiveCategoryIdSet',
        'soloEligibleQuestions',
        'neverShownSoloEligible',
        'Aktif soru havuzu (tüm aktifler)',
        'Solo-eligible soru',
        'Hiç gösterilmeyen Solo-eligible',
        'Runtime projection',
        'getQuestions diagnostics',
        'activeQuestionPoolMeaning',
        'soloEligibleQuestionPoolSize',
        'neverShownSoloEligibleQuestions',
        'runtimeProjectionSizeAvailable: false',
        'runtimeProjectionSizeSource',
        'projectionDiagnostics',
        'fetchedActiveTotal',
        'eligibleAfterNormalization',
        'returnedTotal',
      ]);
      if (missing.length) {
        return fail('Analytics report can still blur all active rows, Solo-eligible rows, and runtime projection size.', {
          verification: 'STATIC_CONTRACT',
          files: ['base44/functions/sendQuestionAnalyticsReportEmail/entry.ts', 'base44/functions/getQuestions/entry.ts'],
          missing,
        });
      }
      return pass('Report wording/metadata distinguishes all active questions, Solo-eligible questions, and getQuestions runtime projection diagnostics.', {
        verification: 'STATIC_CONTRACT',
      });
    }),

  makeCase('analytics_report_detects_top_subcategory_concentration',
    'Question Analytics report flags top-shown category/subcategory concentration without hardcoding labels',
    () => {
      const missing = missingTokens(reportFunctionSource, [
        'getTopShownSubcategoryConcentration',
        'topShownSubcategory',
        'topShownSubcategoryShare',
        'concentrationThreshold: 0.6',
        'Top shown subcategory concentration',
        'pool-proportional değildir diye otomatik varsayılmaz',
        'dağılım Solo-eligible havuzla karşılaştırılmalıdır',
      ]);
      const forbidden = forbiddenTokens(reportFunctionSource, [
        "subCategory === 'Hobbies'",
        "category === 'Chronicle'",
      ]);
      if (missing.length || forbidden.length) {
        return fail('Top-shown concentration guardrail is missing or hardcoded to a specific observed category.', {
          verification: 'STATIC_CONTRACT',
          file: 'base44/functions/sendQuestionAnalyticsReportEmail/entry.ts',
          actual: { missing, forbidden },
        });
      }
      return pass('Report can flag generic top subcategory concentration while preserving pool-proportional interpretation.', {
        verification: 'STATIC_CONTRACT',
      });
    }),

  makeCase('analytics_report_includes_category_level_question_and_preference_analysis',
    'Question Analytics report includes category-level pool, preference, exposure, and internal question analysis',
    () => {
      const actualReportBody = reportFunctionSource;
      const missing = missingTokens(actualReportBody, [
        'MAX_USER_CATEGORY_PREFERENCES',
        'CATEGORY_QUESTION_SAMPLE_LIMIT',
        'UserCategoryPreference.list',
        'buildCategoryAnalytics',
        'isActiveCategoryPreference',
        'getPreferenceOwnerKey',
        'selectedUserCount',
        'totalQuestionCount',
        'activeQuestionCount',
        'getQuestionDifficultyBucket',
        'difficultyCounts',
        'oldestYear',
        'newestYear',
        'categoryPoolSource: "Question.list static current DB rows"',
        'Zorluk 1',
        'Zorluk 2',
        'Zorluk 3',
        'Zorluk 4',
        'Zorluk 5',
        'Zorluk Bilinmiyor',
        'En Eski Yıl',
        'En Yeni Yıl',
        'Question tablosunda soru yok.',
        'soloEligibleQuestionCount',
        'uniqueShownQuestionCount',
        'answeredCount',
        'avgResponseTimeMs',
        'neverShownActiveCount',
        'neverShownSoloEligibleCount',
        'categoryPoolRows',
        'categoryDifficultyChartRows',
        'categoryDifficultyChartSource',
        'categoryDifficultyChartRenderer',
        'registeredQuestionPoolRows',
        'categoryYearRangeRows',
        'reportChecklistRows',
        'registeredQuestionPoolSource',
        'REGISTERED_QUESTION_POOL_ROW_LIMIT',
        'categoryPreferenceRows',
        'categoryExposureRows',
        'categoryFairnessSignalRows',
        'buildCategoryFairnessSignals',
        'CATEGORY_FAIRNESS_SIGNAL_LIMIT',
        'Rapor Bölümleri',
        'Sistemdeki Soru Havuzu: Kategori / Zorluk Dağılımı',
        'Kategori Bazında Soru Havuzu',
        'Kategori ve Zorluk Bazında Kayıtlı Soru Sayısı',
        'Kategori Bazında Kayıtlı Soru Havuzu',
        'Kategori Bazında Yıl Aralığı',
        'Kategori Tercihleri',
        'Kategori Bazında Gösterim',
        'Kategori İçi Soru Analizi',
        'Kategori Denge Sinyalleri',
        'Rapor Tamamlandı',
        'difficultyDistributionBarHtml',
        'DIFFICULTY_CHART_BUCKETS',
        'email_safe_inline_html_css_stacked_bar',
        'role="presentation"',
        'background-color',
        'Kaynak: Question tablosu',
        'Toplam aktif kayıtlı soru',
        'Bu rapor tüm bölümleriyle tamamlandı',
        'clipping/truncation',
        'Dağılım',
        'Tercih eden kullanıcı',
        'Zorluk Seviyesi',
        'Sistemdeki Soru Sayısı',
        'sistemdeki_soru',
        'gösterilmiş ve hiç gösterilmemiş sorular birlikte sayılır',
        'Toplam',
        'Fazla sorulan',
        'Az sorulan',
        'Hiç sorulmayan örnek',
        'categoryAnalytics',
      ]);
      const forbidden = forbiddenTokens(actualReportBody, [
        'user_email</',
        'Kategori ve Alt Kategori Dağılımı',
        'Kategori / alt kategori dağılım verisi yok.',
      ]);
      if (missing.length || forbidden.length) {
        return fail('Category-level question/preference analytics are missing or leak user-level preference details.', {
          verification: 'STATIC_CONTRACT',
          files: ['base44/functions/sendQuestionAnalyticsReportEmail/entry.ts'],
          actual: { missing, forbidden },
        });
      }
      return pass('Report summarizes per-category question pool size, preference users, shown counts, and over/low/never-shown question samples.', {
        verification: 'STATIC_CONTRACT',
      });
    }),

  makeCase('static_category_pool_report_uses_question_table',
    'Static category question pool report is sourced from current Question rows, not analytics projections',
    () => {
      const actualReportBody = reportFunctionSource;
      const missing = missingTokens(actualReportBody, [
        'Question.list',
        'Category.list',
        'buildCategoryAnalytics({',
        'questions,',
        'activeQuestions,',
        'const hasQuestionRows = questions.length > 0',
        'categoryPoolRows',
        'categoryPoolSource: "Question.list static current DB rows"',
        'registeredQuestionPoolRows',
        'registeredQuestionPoolSource: "Question.list active registered rows by category difficulty year range"',
        'REGISTERED_QUESTION_POOL_ROW_LIMIT',
        'Question.list active registered rows by category difficulty year range',
        'Question tablosunda soru yok.',
        'Question tablosunda aktif soru yok.',
        'Unknown / unmapped',
        'pasif kategori',
        'isActiveCategory(category)',
        'getCategoryId(question)',
        'question?.main_category_id',
        'question?.category_id',
        'question?.categoryId',
        'question?.category',
        'question?.cat',
        'getQuestionDifficultyBucket',
        'difficultyDistributionBarHtml',
        'categoryDifficultyChartRows',
        'categoryDifficultyChartSource: "Question.list static active rows by category and difficulty"',
        'categoryDifficultyChartRenderer: "email_safe_inline_html_css_stacked_bar"',
        'difficultyLabel',
        'difficultyCounts',
        'registeredDifficultyStats',
        '"1": 0',
        '"2": 0',
        '"3": 0',
        '"4": 0',
        '"5": 0',
        'unknown: 0',
        'oldestYear',
        'newestYear',
        'oldestYear ?? "Yok"',
        'newestYear ?? "Yok"',
        'reportChecklistRows',
        'Rapor Bölümleri',
        'Sistemdeki Soru Havuzu: Kategori / Zorluk Dağılımı',
        'Kategori Bazında Soru Havuzu',
        'Kategori ve Zorluk Bazında Kayıtlı Soru Sayısı',
        'Kategori Bazında Kayıtlı Soru Havuzu',
        'Kategori Bazında Yıl Aralığı',
        'Toplam Soru',
        'Toplam',
        'Zorluk Seviyesi',
        'Sistemdeki Soru Sayısı',
        'Zorluk 1',
        'Zorluk 2',
        'Zorluk 3',
        'Zorluk 4',
        'Zorluk 5',
        'Zorluk Bilinmiyor',
        'En Eski Yıl',
        'En Yeni Yıl',
        'Kategori Bazında Gösterim',
      ]);
      const forbidden = forbiddenTokens(actualReportBody, [
        'QuestionStatsProjection.list',
        'CategoryStatsProjection.list',
        'QuestionAttemptEvent tablosunda veri yok.',
        'Kategori ve Alt Kategori Dağılımı',
        'Kategori / alt kategori dağılım verisi yok.',
      ]);
      if (missing.length || forbidden.length) {
        return fail('Static category pool analysis may still depend on analytics events/projections or stale alt-category wording.', {
          verification: 'STATIC_CONTRACT',
          files: ['base44/functions/sendQuestionAnalyticsReportEmail/entry.ts'],
          actual: { missing, forbidden },
        });
      }
      return pass('Kategori Bazında Soru Havuzu is built from current Question rows and remains separate from report-period exposure analytics.', {
        verification: 'STATIC_CONTRACT',
      });
    }),

  makeCase('registered_question_pool_by_category_difficulty_year_range',
    'Registered question pool section shows category/difficulty/count/year ranges from Question rows',
    () => {
      const actualReportBody = reportFunctionSource;
      const missing = missingTokens(actualReportBody, [
        'Kategori ve Zorluk Bazında Kayıtlı Soru Sayısı',
        'Kategori Bazında Kayıtlı Soru Havuzu',
        'Kategori Bazında Yıl Aralığı',
        'categoryYearRangeRows',
        'registeredQuestionPoolRows',
        'registeredQuestionPoolRowsRendered',
        'registeredQuestionPoolSource',
        'Question.list active registered rows by category difficulty year range',
        'REGISTERED_QUESTION_POOL_ROW_LIMIT',
        'activeRows',
        'getQuestionDifficultyBucket(question)',
        'difficultyLabel(difficultyBucket)',
        'Bilinmiyor',
        'pasif kategori',
        'registeredDifficultyStats',
        'difficultyStats.questionCount += 1',
        'difficultyStats.oldestYear',
        'difficultyStats.newestYear',
        'oldestYear',
        'newestYear',
        'Zorluk Seviyesi',
        'Sistemdeki Soru Sayısı',
        'sistemdeki_soru',
        'gösterilmiş ve hiç gösterilmemiş sorular birlikte sayılır',
        'En Eski Yıl',
        'En Yeni Yıl',
        'Toplam',
        'Kategori Bazında Gösterim',
        'QuestionAttemptEvent.list',
        'events = rawEvents.filter',
      ]);
      const forbidden = forbiddenTokens(actualReportBody, [
        'registeredQuestionPoolRows = bucketList',
        'registeredQuestionPoolRows = events',
        'registeredQuestionPoolRows = categoryExposureRows',
        'QuestionStatsProjection.list',
        'CategoryStatsProjection.list',
      ]);
      if (missing.length || forbidden.length) {
        return fail('Registered question pool analysis may be missing, analytics-backed, or mixed with shown/answered distribution.', {
          verification: 'STATIC_CONTRACT',
          files: ['base44/functions/sendQuestionAnalyticsReportEmail/entry.ts'],
          actual: { missing, forbidden },
        });
      }
      return pass('Registered pool rows are active Question-table aggregates by category, difficulty, count, and year range; shown/answered category distribution stays separate.', {
        verification: 'STATIC_CONTRACT',
      });
    }),

  makeCase('email_report_static_sections_before_long_details_and_completion_marker',
    'Static pool sections appear near top and report has a final completion marker',
    () => {
      const src = reportFunctionSource;
      const orderedPairs = [
        ['safeSectionHtml("Key Insights / Risk Flags"', 'safeSectionHtml("Sistemdeki Soru Havuzu: Kategori / Zorluk Dağılımı"'],
        ['safeSectionHtml("Rapor Bölümleri"', 'safeSectionHtml("En Çok Gösterilen Sorular"'],
        ['safeSectionHtml("Sistemdeki Soru Havuzu: Kategori / Zorluk Dağılımı"', 'safeSectionHtml("En Çok Gösterilen Sorular"'],
        ['safeSectionHtml("Kategori Bazında Soru Havuzu"', 'safeSectionHtml("En Çok Gösterilen Sorular"'],
        ['safeSectionHtml("Kategori ve Zorluk Bazında Kayıtlı Soru Sayısı"', 'safeSectionHtml("En Çok Gösterilen Sorular"'],
        ['safeSectionHtml("Kategori Bazında Yıl Aralığı"', 'safeSectionHtml("En Çok Gösterilen Sorular"'],
        ['safeSectionHtml("Rapor Tamamlandı"', 'safeSectionHtml("Veri Kalitesi Uyarıları"'],
      ];
      const missing = missingTokens(src, [
        'reportSectionNames',
        'Key Insights / Risk Flags',
        'Rapor Şablonu',
        'REPORT_TEMPLATE_LABEL = "Rapor Şablonu: static-pool-v2"',
        'escapeHtml(REPORT_TEMPLATE_LABEL)',
        'static-pool-v2',
        'Rapor Bölümleri',
        'Sistemdeki Soru Havuzu: Kategori / Zorluk Dağılımı',
        'Kategori Bazında Soru Havuzu',
        'Kategori ve Zorluk Bazında Kayıtlı Soru Sayısı',
        'Kategori Bazında Yıl Aralığı',
        'Rapor Tamamlandı',
        'Bu rapor tüm bölümleriyle tamamlandı',
        'clipping/truncation',
        'reportCompletionMarker: "Rapor Tamamlandı"',
        'clippingDiagnosis',
        '--- Key Insights / Risk Flags ---',
        '--- Rapor Şablonu ---',
        'REPORT_TEMPLATE_LABEL',
        '--- Rapor Bölümleri ---',
        '--- Sistemdeki Soru Havuzu: Kategori / Zorluk Dağılımı ---',
        '--- Rapor Tamamlandı ---',
      ]);
      const orderFailures = orderedPairs.filter(([first, second]) => {
        const firstIndex = src.indexOf(first);
        const secondIndex = src.indexOf(second);
        if (firstIndex < 0 || secondIndex < 0) return true;
        return first === 'safeSectionHtml("Rapor Tamamlandı"' ? firstIndex <= secondIndex : firstIndex >= secondIndex;
      });
      const htmlChartSectionCount = (src.match(/safeSectionHtml\("Sistemdeki Soru Havuzu: Kategori \/ Zorluk Dağılımı"/g) || []).length;
      const textChartSectionCount = (src.match(/--- Sistemdeki Soru Havuzu: Kategori \/ Zorluk Dağılımı ---/g) || []).length;
      const duplicateFailures = [];
      if (htmlChartSectionCount !== 1) duplicateFailures.push(`htmlChartSectionCount:${htmlChartSectionCount}`);
      if (textChartSectionCount !== 1) duplicateFailures.push(`textChartSectionCount:${textChartSectionCount}`);
      if (missing.length || orderFailures.length || duplicateFailures.length) {
        return fail('Static report sections may still be hidden behind long event details or lack a completion marker.', {
          verification: 'STATIC_CONTRACT',
          file: 'base44/functions/sendQuestionAnalyticsReportEmail/entry.ts',
          actual: { missing, orderFailures, duplicateFailures },
        });
      }
      return pass('Static DB pool sections render before long event details, and Rapor Tamamlandı marks the end of the actual email body.', {
        verification: 'STATIC_CONTRACT',
      });
    }),

  makeCase('email_report_is_html_formatted',
    'Question analytics email renders as HTML tables/cards/bars with text fallback',
    () => {
      const missing = missingTokens(reportFunctionSource, [
        '<html>',
        '<body',
        '<table',
        '<tr>',
        '<td',
        '<h1',
        '<h2',
        '<p',
        'summaryCard',
        'sectionHtml',
        'tableHtml',
        'barHtml',
        'const emailHtml = report.html',
        'body: emailHtml',
        'html: emailHtml',
        'const emailText = report.text',
        'text: emailText',
        "textLines.join('\\n')",
        '--- Rapor Bölümleri ---',
        '--- Sistemdeki Soru Havuzu: Kategori / Zorluk Dağılımı ---',
        '--- Kategori Bazında Soru Havuzu ---',
        '--- Kategori ve Zorluk Bazında Kayıtlı Soru Sayısı ---',
        '--- Kategori Bazında Yıl Aralığı ---',
        '--- En Çok Gösterilen Sorular ---',
        '--- Rapor Tamamlandı ---',
        'NEVER_SHOWN_SAMPLE_LIMIT = 15',
        'QUESTION_TABLE_LIMIT = 15',
        'EASY_QUESTION_TABLE_LIMIT = 10',
        'neverShown.slice(0, NEVER_SHOWN_SAMPLE_LIMIT)',
        'slice(0, EASY_QUESTION_TABLE_LIMIT)',
        'Bu dönemde gösterilen soru verisi yok.',
        'Yeterli örneklem yok.',
        'Cevap süresi verisi yok.',
      ]);
      const forbidden = forbiddenTokens(reportFunctionSource, [
        'body: report.body',
        'lines.join',
        'neverShown.slice(0, 30)',
      ]);
      if (missing.length || forbidden.length) {
        return fail('Question analytics email can regress to raw single-line text or unbounded never-shown output.', {
          verification: 'STATIC_CONTRACT',
          file: 'base44/functions/sendQuestionAnalyticsReportEmail/entry.ts',
          actual: { missing, forbidden },
        });
      }
      return pass('Report email is HTML-first with tables, cards, bars, capped samples, and line-broken text fallback.', {
        verification: 'STATIC_CONTRACT',
      });
    }),

  makeCase('admin_only_settings_trigger_exists',
    'Settings admin tools expose report trigger and manual-only analytics reset guidance',
    () => {
      const combined = `${settingsPageSource}\n${questionAnalyticsReportToolSource}`;
      const missing = missingTokens(combined, [
        'isAdmin &&',
        'QuestionAnalyticsReportTool',
        'Soru Analiz Raporu Gönder',
        'callAdminFunction',
        "base44.functions.invoke(name, payload)",
        "callAdminFunction('sendQuestionAnalyticsReportEmail'",
        "headers: { 'Content-Type': 'application/json' }",
        'errorMessageFromBody',
        'missingFunctionMessage',
        'response.status === 404',
        'fonksiyonu bulunamadı veya deploy edilmemiş. Function name/path kontrol edilmeli.',
        'Soru Analitik Verilerini Sıfırla',
        'Bu işlem şu anda manuel DB temizliği ile yapılır. Function reset yolu devre dışı.',
        'QuestionAttemptEvent, QuestionStatsProjection ve CategoryStatsProjection',
        'Son 7 gün',
        'Rapor hazırlanıyor...',
        'Soru analiz raporu e-posta olarak gönderildi.',
      ]);
      const forbidden = forbiddenTokens(questionAnalyticsReportToolSource, [
        "callAdminFunction('resetQuestionAnalyticsData'",
        'RESET_QUESTION_ANALYTICS',
        'resetAnalytics',
        'resetConfirm',
        'confirmText: RESET_CONFIRMATION',
        'confirmation: RESET_CONFIRMATION',
      ]);
      if (missing.length || forbidden.length) {
        return fail('Admin Settings report trigger is missing or still exposes the broken reset function path.', {
          verification: 'STATIC_CONTRACT',
          files: ['src/pages/SettingsPage.jsx', 'src/components/admin/QuestionAnalyticsReportTool.jsx'],
          actual: { missing, forbidden },
        });
      }
      return pass('Question analytics email report has a minimal admin-only Settings trigger, while reset is manual DB guidance only.', {
        verification: 'STATIC_CONTRACT',
      });
    }),

  makeCase('question_stats_projection_event_semantics',
    'Projection aggregation respects event_type semantics',
    () => {
      const combined = `${questionStatsProjectionEntitySource}\n${aggregateQuestionStatsSource}`;
      const missing = missingTokens(combined, [
        'swap_count',
        'last_answered_at',
        'category_id',
        'sub_category',
        'tags',
        'answer_year',
        'Question.list',
        'staleQuestionReferenceEvents',
        "eventType === 'shown' || eventType === 'replacement_shown'",
        "eventType === 'answered'",
        "eventType === 'swapped_out'",
      ]);
      if (missing.length) {
        return fail('QuestionStatsProjection aggregation may double-count event rows or lacks swap metadata.', {
          verification: 'STATIC_CONTRACT',
          files: ['base44/entities/QuestionStatsProjection.jsonc', 'base44/functions/aggregateQuestionStats/entry.ts'],
          missing,
        });
      }
      return pass('Projection refresh counts shown/answered/swapped events separately.', {
        verification: 'STATIC_CONTRACT',
      });
    }),

  makeCase('manual_question_analytics_reset_path_documented',
    'Manual DB reset path is documented and Settings no longer depends on resetQuestionAnalyticsData',
    () => {
      const combined = `${DB_ARCHITECTURE_IMPLEMENTATION_MIRROR}\n${questionAnalyticsContractsSource}\n${questionAnalyticsReportToolSource}\n${questionAttemptEventEntitySource}\n${questionStatsProjectionEntitySource}\n${categoryStatsProjectionEntitySource}`;
      const missing = missingTokens(combined, [
        'manual_db_reset_only',
        'manual_db_clear_QuestionAttemptEvent_QuestionStatsProjection_CategoryStatsProjection_only',
        'manuel DB temizliği',
        'Function reset yolu devre dışı',
        'Manual DB reset path after question pool replacement',
        'QuestionAttemptEvent',
        'QuestionStatsProjection',
        'CategoryStatsProjection',
        'Question',
        'Category',
        'SubCategory',
        'UserCategoryPreference',
        'UserStatsProjection',
        'OnlineMatchResult',
        'Lobby',
        'SoloLeaderboardEntry',
        'Kronox Puan',
        'DiamondTransaction',
        'DailyWheelSpin',
        'GameRecord',
        'users',
        'AdminUser',
      ]);
      const forbidden = forbiddenTokens(questionAnalyticsReportToolSource, [
        "callAdminFunction('resetQuestionAnalyticsData'",
        'RESET_QUESTION_ANALYTICS',
      ]);
      if (missing.length || forbidden.length) {
        return fail('Manual DB analytics reset path is not documented or Settings still calls the broken reset function.', {
          verification: 'STATIC_CONTRACT',
          files: ['src/components/admin/QuestionAnalyticsReportTool.jsx', 'docs/KRONOX_DB_ARCHITECTURE.md', 'src/lib/questionAnalyticsContracts.js'],
          actual: { missing, forbidden },
        });
      }
      return pass('Manual reset clears only QuestionAttemptEvent/QuestionStatsProjection/CategoryStatsProjection by documented DB maintenance; Settings no longer calls resetQuestionAnalyticsData.', {
        verification: 'STATIC_CONTRACT',
      });
    }),

  makeCase('analytics_report_handles_stale_question_ids_and_empty_state',
    'Question Analytics report handles deleted question IDs and empty analytics safely',
    () => {
      const actualReportBody = reportFunctionSource;
      const missing = missingTokens(actualReportBody, [
        'deleted_or_missing_question',
        'staleQuestionIds',
        'STALE_REFERENCE_SAMPLE_LIMIT',
        'Bazı eski analiz kayıtları artık mevcut olmayan sorulara referans verdiği için rapora dahil edilmedi',
        'Deleted / missing question events ignored',
        'staleQuestionReferenceEvents',
        'staleQuestionReferenceHandling',
        'ignored_with_diagnostic_count',
        'shownEvents === 0',
        'Bu dönem için yeterli oynanış verisi yok',
        'Unknown / unmapped',
        'getCategoryId(question)',
        'question?.category',
        'question?.cat',
        'safeSectionHtml',
        'sectionWarningHtml',
        'htmlSections',
        'QUESTION_TABLE_LIMIT',
        'EASY_QUESTION_TABLE_LIMIT',
        'CATEGORY_ANALYTICS_ROW_LIMIT',
        'CATEGORY_FAIRNESS_SIGNAL_LIMIT',
        'categoryAnalyticsForReport',
        'categoryPoolSource: "Question.list static current DB rows"',
        'registeredQuestionPoolSource: "Question.list active registered rows by category difficulty year range"',
        'Question tablosunda soru yok.',
        'Question tablosunda aktif soru yok.',
        'NEVER_SHOWN_SAMPLE_LIMIT = 15',
        'QUESTION_TABLE_LIMIT = 15',
        'EASY_QUESTION_TABLE_LIMIT = 10',
        'CATEGORY_QUESTION_SAMPLE_LIMIT',
        'neverShown.slice(0, NEVER_SHOWN_SAMPLE_LIMIT)',
        'slice(0, QUESTION_TABLE_LIMIT)',
        'slice(0, EASY_QUESTION_TABLE_LIMIT)',
        'slice(0, CATEGORY_ANALYTICS_ROW_LIMIT)',
      ]);
      if (missing.length) {
        return fail('Report can still break, mislead, or grow unbounded when analytics references deleted questions.', {
          verification: 'STATIC_CONTRACT',
          files: ['base44/functions/sendQuestionAnalyticsReportEmail/entry.ts'],
          missing,
        });
      }
      return pass('Report skips stale/deleted question references with diagnostics, renders empty analytics states, and limits large tables.', {
        verification: 'STATIC_CONTRACT',
      });
    }),

  makeCase('analytics_security_and_cleanup_contract',
    'Analytics rows/report are private and included in account deletion cleanup',
    () => {
      const combined = `${questionAttemptEventEntitySource}\n${reportFunctionSource}\n${deleteAccountSource}\n${questionAnalyticsContractsSource}`;
      const missing = missingTokens(combined, [
        '"read"',
        '"role": "admin"',
        'reportAdminOnly: true',
        'playerFacingDashboard: false',
        'QuestionAttemptEvent',
        'user_email: anon.email',
        'user_key: anon.ownerKey',
        'account_deleted: true',
      ]);
      const forbidden = forbiddenTokens(combined, [
        'scheduledReportEnabled: true',
        'analyticsRowsPublic: true',
      ]);
      if (missing.length || forbidden.length) {
        return fail('Question analytics privacy/cleanup contract is incomplete.', {
          verification: 'STATIC_CONTRACT',
          actual: { missing, forbidden },
        });
      }
      return pass('Analytics rows are owner/admin scoped, report is admin-only, and account deletion anonymizes analytics rows.', {
        verification: 'STATIC_CONTRACT',
      });
    }),

  makeCase('analytics_does_not_change_gameplay_rules',
    'Question analytics does not change Solo deck/scoring/joker rules',
    () => {
      const combined = `${gamePageSource}\n${useGameActionsSource}\n${analyticsGatewaySource}`;
      const missing = missingTokens(combined, [
        'orderedQuestionPicker',
        'buildSoloAttemptDeck',
        'calculateSoloAttemptResult',
        'recordSoloQuestionAnalyticsEvent',
      ]);
      const forbidden = forbiddenTokens(analyticsGatewaySource, [
        'setLobbyData',
        'setWinner',
        'calculateSoloAttemptResult',
        'buildSoloAttemptDeck',
      ]);
      if (missing.length || forbidden.length) {
        return fail('Analytics wiring may have leaked into gameplay rule ownership.', {
          verification: 'STATIC_CONTRACT',
          actual: { missing, forbidden },
        });
      }
      return pass('Analytics remains a side-effect only; deck rules, scoring, and jokers stay owned by existing gameplay helpers.', {
        verification: 'STATIC_CONTRACT',
      });
    }),

  makeCase('live_email_delivery_and_rls_remain_manual',
    'Deployed email delivery, analytics RLS, and volume proof remain manual',
    () => {
      if (
        QUESTION_ANALYTICS_SECURITY_CONTRACT.gameplayBlockingWrites !== false ||
        QUESTION_ANALYTICS_SECURITY_CONTRACT.scheduledReportEnabled !== false
      ) {
        return fail('Question analytics security contract drifted toward runtime-blocking or scheduled behavior.', {
          verification: 'STATIC_CONTRACT',
        });
      }
      return notAutomatable('Manual backend proof is still required for deployed SendEmail delivery, RLS probing, and high-volume analytics write performance.', {
        verification: 'BACKEND_RUNTIME_PROBE',
        actionType: ACTION_TYPES.BACKEND_RUNTIME_PROBE,
        nextStep: 'Use an admin account in a non-production/staging environment to trigger the report and verify email delivery, RLS, and write volume.',
      });
    }, { critical: false, actionType: ACTION_TYPES.BACKEND_RUNTIME_PROBE }),
];
