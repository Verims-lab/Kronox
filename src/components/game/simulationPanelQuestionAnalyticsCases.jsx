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
import adminPageSource from '../../pages/AdminPage.jsx?raw';
import questionAnalyticsReportToolSource from '../admin/QuestionAnalyticsReportTool.jsx?raw';
import deleteAccountSource from '../../../base44/functions/deleteAccount/entry.ts?raw';
import questionAttemptEventEntitySource from '../../../base44/entities/QuestionAttemptEvent.jsonc?raw';
import questionStatsProjectionEntitySource from '../../../base44/entities/QuestionStatsProjection.jsonc?raw';
import categoryStatsProjectionEntitySource from '../../../base44/entities/CategoryStatsProjection.jsonc?raw';
import aggregateQuestionStatsSource from '../../../base44/functions/aggregateQuestionStats/entry.ts?raw';
import reportFunctionSource from '../../../base44/functions/sendQuestionAnalyticsReportEmail/entry.ts?raw';
import reportFunctionManifestSource from '../../../base44/functions/sendQuestionAnalyticsReportEmail/function.jsonc?raw';
import getQuestionsSource from '../../../base44/functions/getQuestions/entry.ts?raw';
import { DB_ARCHITECTURE_IMPLEMENTATION_MIRROR } from '@/lib/dbArchitectureMirrors';
import {
  QUESTION_ANALYTICS_REPORT_SECTIONS,
  QUESTION_ANALYTICS_REMOVED_REPORT_SECTIONS,
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
      const removedOutputMissing = missingTokens(reportFunctionSource, [
        'REMOVED_REPORT_SECTION_TITLES',
        'bodyRemovedSectionsPresent',
        'report_body_validation_failed',
      ]);
      const missing = missingTokens(reportFunctionSource, [
        'sendQuestionAnalyticsReportEmail',
        'Deno.serve',
        'createClientFromRequest',
        'function requireAdmin(base44)',
        'getAdminAuthorization',
        'entities?.AdminUser',
        'QuestionAttemptEvent.list',
        'Question.list',
        'Category.list',
        'UserCategoryPreference.list',
        'SendEmail',
        'Kronox Soru Analiz Raporu —',
        'Kronox Soru Analiz Raporu',
        'safeSectionHtml',
        'htmlSections',
        'section_render_failed',
        'REPORT_TEMPLATE_VERSION = "nine-section-email-v1"',
        'bodyContainsExecutiveSummary',
        'bodyContainsNineRequiredSections',
        'bodyContainsExactlyRequiredSections',
        'requiredSectionOrderValid',
        'renderedSectionHeaderCount',
        'emailBodyMode: "nine_section_email_body"',
        'reportDeliveryMode: "email_body_only"',
        'missingBodySections',
        'bodyLength',
        'Executive Summary',
        'Kategori Bazında Soru Havuzu',
        'Kategori Tercihleri',
        'Kategori Bazında Gösterim',
        'En Çok Gösterilen Sorular',
        'Az ya da Hiç Gösterilmeyen Sorular',
        'En Çok Yanlış Yapılan Sorular',
        'Joker Kullanımı Analizi',
        'Oynanma Zamanı ve Kullanım Ritmi',
        'Joker Tipi Özeti',
        'Saat Bazında Oynanma',
        'UserJokerInventory',
        'AdminMaintenanceLog.create',
      ]);
      const manifestMissing = missingTokens(reportFunctionManifestSource, [
        '"name": "sendQuestionAnalyticsReportEmail"',
        '"entry": "entry.ts"',
      ]);
      if (missing.length || sectionMissing.length || removedOutputMissing.length || manifestMissing.length) {
        return fail('Manual question analytics report backend contract is incomplete.', {
          verification: 'STATIC_CONTRACT',
          files: ['base44/functions/sendQuestionAnalyticsReportEmail/entry.ts'],
          missing: [...missing, ...sectionMissing, ...removedOutputMissing, ...manifestMissing],
        });
      }
      return pass('Manual report function is admin-gated and sends the exact nine-section report in the email body.', {
        verification: 'STATIC_CONTRACT',
      });
    }),

  makeCase('manual_admin_email_report_deployed_root_entrypoint',
    'Callable report entrypoint contains the complete current report implementation',
    () => {
      const missing = missingTokens(reportFunctionSource, [
        'sendQuestionAnalyticsReportEmail',
        'function requireAdmin(base44)',
        'getAdminAuthorization',
        'entities?.AdminUser',
        'Question.list',
        'REPORT_TEMPLATE_VERSION = "nine-section-email-v1"',
        'REMOVED_REPORT_SECTION_TITLES',
        'bodyContainsExecutiveSummary',
        'bodyRemovedSectionsPresent',
        'bodyContainsNineRequiredSections',
        'bodyContainsExactlyRequiredSections',
        'requiredSectionOrderValid',
        'report_body_validation_failed',
        'emailBodyMode: "nine_section_email_body"',
        'reportDeliveryMode: "email_body_only"',
        'body: emailHtml',
        'html: emailHtml',
        'safeSectionHtml("Executive Summary"',
        'safeSectionHtml("Kategori Bazında Soru Havuzu"',
        'safeSectionHtml("Kategori Tercihleri"',
        'safeSectionHtml("Kategori Bazında Gösterim"',
        'safeSectionHtml("En Çok Gösterilen Sorular"',
        'safeSectionHtml("Az ya da Hiç Gösterilmeyen Sorular"',
        'safeSectionHtml("En Çok Yanlış Yapılan Sorular"',
        'safeSectionHtml("Joker Kullanımı Analizi"',
        'safeSectionHtml("Oynanma Zamanı ve Kullanım Ritmi"',
        'tableCaptionHtml("Joker Tipi Özeti"',
        'tableCaptionHtml("Saat Bazında Oynanma"',
        'reportSections',
        'textLines.join(\'\\n\')',
      ]);
      const emailForbidden = QUESTION_ANALYTICS_REMOVED_REPORT_SECTIONS.filter((section) => {
        const sectionIndex = reportFunctionSource.indexOf(`safeSectionHtml("${section}"`);
        const textIndex = reportFunctionSource.indexOf(`--- ${section} ---`);
        return sectionIndex >= 0 || textIndex >= 0;
      });
      const forbidden = forbiddenTokens(reportFunctionSource, [
        "from './_shared/adminAuth.js'",
        "from './_shared/adminAuth.ts'",
        '../base44/functions/sendQuestionAnalyticsReportEmail/entry.ts',
        'bodyContainsStaticPoolSection',
        'bodyContainsTemplateMarker',
        'bodyContainsQuestionSourceMarker',
        'PDF Eki',
        'Detaylı rapor PDF olarak ekte yer almaktadır',
        'PDF_ATTACHMENT_CONTENT_TYPE',
        'buildQuestionAnalyticsPdfAttachment',
        'buildSendEmailAttachmentPayload',
        'attachments: emailAttachments',
        'application/pdf',
        'pdfGenerated',
        'attachmentCount',
      ]);
      if (missing.length || emailForbidden.length || forbidden.length) {
        return fail('Callable report entrypoint can drift into an old report implementation or wrapper-only package.', {
          verification: 'STATIC_CONTRACT',
          file: 'base44/functions/sendQuestionAnalyticsReportEmail/entry.ts',
          actual: { missing, emailForbidden, forbidden },
        });
      }
      return pass('Callable report entrypoint contains the current exact nine-section email-body report implementation with no attachment requirement.', {
        verification: 'STATIC_CONTRACT',
      });
    }),

  makeCase('manual_admin_email_report_recipient_is_requesting_admin',
    'Question Analytics report emails the requesting active admin and returns safe dispatch diagnostics',
    () => {
      const perFunctionMissing = [
        { name: 'base44/functions/sendQuestionAnalyticsReportEmail/entry.ts', source: reportFunctionSource },
      ].map((item) => ({
        file: item.name,
        missing: missingTokens(item.source, [
          'const requestedByEmail = normalizeEmail(admin.user?.email)',
          'const requestedRecipientEmail = normalizeEmail(body?.recipientEmail)',
          'recipient_override_not_allowed',
          'const recipient = requestedByEmail',
          'const recipientEmail = recipient',
          'recipientSource',
          '"authenticated_admin"',
          'requestedBy: requestedByEmail',
          'recipientEmail',
          'adminAuthorized: true',
          'emailDispatchStatus',
          'sendEmailOk',
          'safeErrorReason',
          'emailProviderMessageId',
          'target_email: normalizeEmail(metadata?.recipientEmail || metadata?.recipient || user?.email)',
          'to: recipient',
          'body: emailHtml',
          'html: emailHtml',
        ]),
        forbidden: forbiddenTokens(item.source, [
          'body?.recipientEmail || admin.user?.email',
          'target_email: normalizeEmail(user?.email),',
          `to: "${[['sari', 'verim'].join(''), 'gmail.com'].join('@')}`,
          `to: '${[['sari', 'verim'].join(''), 'gmail.com'].join('@')}`,
        ]),
      })).filter((item) => item.missing.length || item.forbidden.length);
      const uiMissing = missingTokens(questionAnalyticsReportToolSource, [
        'result?.recipientEmail',
        'result?.emailDispatchStatus',
          'email_failed',
          'recipient_override_not_allowed',
          'report_body_validation_failed',
          'adresine',
          'Gönderim:',
        ]);
      if (perFunctionMissing.length || uiMissing.length) {
        return fail('Question Analytics report may still send to a stale/hardcoded recipient or hide SendEmail dispatch failures.', {
          verification: 'STATIC_CONTRACT',
          files: [
            'base44/functions/sendQuestionAnalyticsReportEmail/entry.ts',
            'src/components/admin/QuestionAnalyticsReportTool.jsx',
          ],
          actual: { perFunctionMissing, uiMissing },
        });
      }
      return pass('Report recipient defaults to the authenticated requesting admin, mismatched overrides are rejected, and Settings shows safe recipient/dispatch diagnostics.', {
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
        'Aktif soru havuzu',
        'Solo-eligible havuz',
        'hiç gösterilmeyen Solo-eligible soru',
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
    'Question Analytics email keeps aggregate category/question/preference tables',
    () => {
      const actualReportBody = reportFunctionSource;
      const missing = missingTokens(actualReportBody, [
        'MAX_USER_CATEGORY_PREFERENCES',
        'UserCategoryPreference.list',
        'buildCategoryAnalytics',
        'isActiveCategoryPreference',
        'getPreferenceOwnerKey',
        'selectedUserCount',
        'totalQuestionCount',
        'activeQuestionCount',
        'CATEGORY_TOP_ANSWER_YEAR_LIMIT',
        'buildTopAnswerYearCounts',
        'topAnswerYearCounts',
        'getQuestionDifficultyBucket',
        'difficultyCounts',
        'soloEligibleQuestionCount',
        'uniqueShownQuestionCount',
        'answeredCount',
        'avgResponseTimeMs',
        'neverShownActiveCount',
        'neverShownSoloEligibleCount',
        'reportSections',
        'nineSectionEmailReport',
        'categoryAnalyticsRowsAnalyzed',
        'aggregatePreferenceSelectionsAnalyzed',
        'safeSectionHtml("Kategori Bazında Soru Havuzu"',
        'safeSectionHtml("Kategori Tercihleri"',
        'safeSectionHtml("Kategori Bazında Gösterim"',
        'Toplam Soru',
        'Kategori Bazında Top 10 Cevap Yılı',
        'Top 10 cevap yılı/adet',
        'Tercih Eden Kullanıcı',
        'Gösterim Payı',
        'role="presentation"',
        'emailBodyMode: "nine_section_email_body"',
        'categoryAnalytics',
      ]);
      const forbidden = forbiddenTokens(actualReportBody, [
        'user_email</',
        'Kategori ve Alt Kategori Dağılımı',
        'Kategori / alt kategori dağılım verisi yok.',
        'title: "Kategori ve Zorluk Bazında Kayıtlı Soru Sayısı"',
        'title: "Kategori Bazında Yıl Aralığı"',
        'title: "Kategori İçi Soru Analizi"',
      ]);
      if (missing.length || forbidden.length) {
        return fail('Category-level question/preference analytics are missing or leak user-level preference details.', {
          verification: 'STATIC_CONTRACT',
          files: ['base44/functions/sendQuestionAnalyticsReportEmail/entry.ts'],
          actual: { missing, forbidden },
        });
      }
      return pass('Report uses aggregate category/question/preference tables without restoring removed legacy sections.', {
        verification: 'STATIC_CONTRACT',
      });
    }),

  makeCase('nine_section_email_sections_exist',
    'Question Analytics email includes exactly the required nine sections and rejects legacy/PDF sections',
    () => {
      const actualReportBody = reportFunctionSource;
      const missing = missingTokens(actualReportBody, [
        'reportSections',
        'Executive Summary',
        'Kategori Bazında Soru Havuzu',
        'Kategori Tercihleri',
        'Kategori Bazında Gösterim',
        'En Çok Gösterilen Sorular',
        'Az ya da Hiç Gösterilmeyen Sorular',
        'En Çok Yanlış Yapılan Sorular',
        'Joker Kullanımı Analizi',
        'Oynanma Zamanı ve Kullanım Ritmi',
        'Joker Tipi Özeti',
        'Joker Kullanımı - Kategori / Zorluk Kırılımı',
        'Joker Stok / Ekonomi Sinyali',
        'Saat Bazında Oynanma',
        'Gün Bazında Oynanma',
        'Aktivite Sinyali',
        'jokerLedgerRowsAnalyzed',
        'userJokerInventoryRowsAnalyzed',
        'peakPlayHour',
        'bodyContainsExactlyRequiredSections',
        'renderedSectionHeaderCount',
        'reportDeliveryMode: "email_body_only"',
      ]);
      const forbidden = forbiddenTokens(actualReportBody, [
        'QuestionStatsProjection.list',
        'CategoryStatsProjection.list',
        'QuestionAttemptEvent tablosunda veri yok.',
        'Kategori ve Alt Kategori Dağılımı',
        'Kategori / alt kategori dağılım verisi yok.',
        'title: "Kategori ve Zorluk Bazında Kayıtlı Soru Sayısı"',
        'title: "Kategori Bazında Yıl Aralığı"',
        'title: "Kategori İçi Soru Analizi"',
        'safeSectionHtml("Solo Soru Algoritması İçin Sinyaller"',
        'safeSectionHtml("Doğru Soru Tiplerini Öğrenme',
        'safeSectionHtml("Daha Uzun Oynama',
        'safeSectionHtml("Önerilen Aksiyonlar"',
        'safeSectionHtml("Data Quality / Eksik Ölçüm"',
      ]);
      if (missing.length || forbidden.length) {
        return fail('Nine-section email may be missing required sections/tables or may have restored legacy/PDF sections.', {
          verification: 'STATIC_CONTRACT',
          files: ['base44/functions/sendQuestionAnalyticsReportEmail/entry.ts'],
          actual: { missing, forbidden },
        });
      }
      return pass('Email builder contains exactly the required nine-section structure with table-based Joker and play-rhythm sections.', {
        verification: 'STATIC_CONTRACT',
      });
    }),

  makeCase('analytics_report_removed_sections_are_not_rendered',
    'Removed Question Analytics sections are not rendered in email output',
    () => {
      const missing = missingTokens(reportFunctionSource, [
        'REMOVED_REPORT_SECTION_TITLES',
        'findRemovedReportSections',
        'bodyRemovedSectionsPresent',
        'report_body_validation_failed',
        'removedReportSections',
      ]);
      const renderedForbidden = QUESTION_ANALYTICS_REMOVED_REPORT_SECTIONS.filter((section) => {
        const htmlRendered = reportFunctionSource.includes(`safeSectionHtml("${section}"`);
        const textRendered = reportFunctionSource.includes(`--- ${section} ---`);
        const sectionRendered = reportFunctionSource.includes(`title: "${section}"`);
        return htmlRendered || textRendered || sectionRendered;
      });
      if (missing.length || renderedForbidden.length) {
        return fail('Removed report sections can still appear in the generated email body.', {
          verification: 'STATIC_CONTRACT',
          files: ['base44/functions/sendQuestionAnalyticsReportEmail/entry.ts'],
          actual: { missing, renderedForbidden },
        });
      }
      return pass('The report function keeps removed section titles only as forbidden-section validation and does not render them as email sections.', {
        verification: 'STATIC_CONTRACT',
      });
    }),

  makeCase('email_report_is_full_body_without_attachment_notice',
    'Question Analytics email contains the exact nine-section body and no attachment notice',
    () => {
      const src = reportFunctionSource;
      const orderedPairs = [
        ['safeSectionHtml("Executive Summary"', 'safeSectionHtml("Kategori Bazında Soru Havuzu"'],
        ['safeSectionHtml("Kategori Bazında Soru Havuzu"', 'safeSectionHtml("Kategori Tercihleri"'],
        ['safeSectionHtml("Kategori Tercihleri"', 'safeSectionHtml("Kategori Bazında Gösterim"'],
        ['safeSectionHtml("Kategori Bazında Gösterim"', 'safeSectionHtml("En Çok Gösterilen Sorular"'],
        ['safeSectionHtml("En Çok Gösterilen Sorular"', 'safeSectionHtml("Az ya da Hiç Gösterilmeyen Sorular"'],
        ['safeSectionHtml("Az ya da Hiç Gösterilmeyen Sorular"', 'safeSectionHtml("En Çok Yanlış Yapılan Sorular"'],
        ['safeSectionHtml("En Çok Yanlış Yapılan Sorular"', 'safeSectionHtml("Joker Kullanımı Analizi"'],
        ['safeSectionHtml("Joker Kullanımı Analizi"', 'safeSectionHtml("Oynanma Zamanı ve Kullanım Ritmi"'],
      ];
      const missing = missingTokens(src, [
        'emailBodyMode: "nine_section_email_body"',
        'reportDeliveryMode: "email_body_only"',
        'bodyContainsNineRequiredSections',
        'bodyContainsExactlyRequiredSections',
        'requiredSectionOrderValid',
        'missingBodySections',
        'Executive Summary',
        'Kategori Bazında Soru Havuzu',
        'Kategori Tercihleri',
        'Kategori Bazında Gösterim',
        'En Çok Gösterilen Sorular',
        'Az ya da Hiç Gösterilmeyen Sorular',
        'En Çok Yanlış Yapılan Sorular',
        'Joker Kullanımı Analizi',
        'Oynanma Zamanı ve Kullanım Ritmi',
      ]);
      const orderFailures = orderedPairs.filter(([first, second]) => {
        const firstIndex = src.indexOf(first);
        const secondIndex = src.indexOf(second);
        if (firstIndex < 0 || secondIndex < 0) return true;
        return firstIndex >= secondIndex;
      });
      const renderedForbidden = QUESTION_ANALYTICS_REMOVED_REPORT_SECTIONS.filter((section) => src.includes(`safeSectionHtml("${section}"`) || src.includes(`--- ${section} ---`));
      const attachmentForbidden = forbiddenTokens(src, [
        'PDF Eki',
        'Detaylı rapor PDF olarak ekte yer almaktadır',
        'attachments: emailAttachments',
        'application/pdf',
        'buildSendEmailAttachmentPayload',
        'buildQuestionAnalyticsPdfAttachment',
      ]);
      if (missing.length || orderFailures.length || renderedForbidden.length || attachmentForbidden.length) {
        return fail('Email report may still be blank/summary-only, out of order, include attachment copy, or restore removed sections.', {
          verification: 'STATIC_CONTRACT',
          file: 'base44/functions/sendQuestionAnalyticsReportEmail/entry.ts',
          actual: { missing, orderFailures, renderedForbidden, attachmentForbidden },
        });
      }
      return pass('Email body contains the exact nine-section report and has no attachment notice or payload.', {
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
        'sectionHtml',
        'summaryCardGrid',
        'const emailHtml = report.html',
        'body: emailHtml',
        'html: emailHtml',
        'const emailText = report.text',
        'text: emailText',
        "textLines.join('\\n')",
        '--- Executive Summary ---',
        '--- Kategori Bazında Soru Havuzu ---',
        '--- Kategori Tercihleri ---',
        '--- Kategori Bazında Gösterim ---',
        '--- En Çok Gösterilen Sorular ---',
        '--- Az ya da Hiç Gösterilmeyen Sorular ---',
        '--- En Çok Yanlış Yapılan Sorular ---',
        '--- Joker Kullanımı Analizi ---',
        '--- Oynanma Zamanı ve Kullanım Ritmi ---',
        'Toplam Gösterim',
        'Kategori ID',
        'Question ID',
        'Joker Tipi Özeti',
        'Saat Bazında Oynanma',
        'jokerLedgerRowsAnalyzed',
        'userJokerInventoryRowsAnalyzed',
        'Yeterli veri yok',
      ]);
      const forbidden = forbiddenTokens(reportFunctionSource, [
        'body: report.body',
        'body: lines.join',
        'neverShown.slice(0, 30)',
        'bodyContainsStaticPoolSection',
        'PDF Eki',
        'PDFDocument.create()',
        'buildQuestionAnalyticsPdfAttachment',
        'attachments: emailAttachments',
        'application/pdf',
      ]);
      if (missing.length || forbidden.length) {
        return fail('Question analytics email can regress to raw single-line text or unbounded never-shown output.', {
          verification: 'STATIC_CONTRACT',
          file: 'base44/functions/sendQuestionAnalyticsReportEmail/entry.ts',
          actual: { missing, forbidden },
        });
      }
      return pass('Report email is HTML-first, bounded, and includes the exact nine sections plus text fallback.', {
        verification: 'STATIC_CONTRACT',
      });
    }),

  makeCase('admin_only_settings_trigger_exists',
    'Admin Ekranı exposes report trigger and manual-only analytics reset guidance',
    () => {
      const combined = `${adminPageSource}\n${questionAnalyticsReportToolSource}`;
      const missing = missingTokens(combined, [
        'Admin Ekranı',
        'const isAdmin = parsedAdminStatus',
        'if (!isAdmin)',
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
        'Soru gösterim/cevap/zaman geçmişinin aktif kaynağı QuestionAttemptEvent',
        'mevcut 9 bölümlü rapor ham olaylardan hesaplanır',
        'QuestionStatsProjection ve CategoryStatsProjection manuel aggregateQuestionStats refresh',
        'boş olmaları normal olabilir',
        'Tam analitik reset için QuestionAttemptEvent ve varsa bu iki projection tablosu',
        'Soru havuzu, kategori tercihleri, kullanıcı/profil verileri',
        'elmas/joker bakiyeleri',
        'JokerTransaction/DiamondTransaction gibi ekonomi ledger kayıtları silinmez',
        'Joker Kullanımı Analizi ledger verisinden besleniyorsa bu resetten etkilenmez',
        'Oynanma Zamanı metrikleri QuestionAttemptEvent temizliğiyle sıfırlanır',
        'Son 7 gün',
        'Rapor hazırlanıyor...',
        'result?.recipientEmail',
        'result?.emailDispatchStatus',
        'Soru analiz raporu',
        'adresine',
        'Gönderim:',
      ]);
      const settingsForbidden = forbiddenTokens(settingsPageSource, [
        'QuestionAnalyticsReportTool',
        'Soru Analiz Raporu Gönder',
      ]);
      const forbidden = forbiddenTokens(questionAnalyticsReportToolSource, [
        "callAdminFunction('resetQuestionAnalyticsData'",
        'RESET_QUESTION_ANALYTICS',
        'resetAnalytics',
        'resetConfirm',
        'confirmText: RESET_CONFIRMATION',
        'confirmation: RESET_CONFIRMATION',
      ]);
      if (missing.length || forbidden.length || settingsForbidden.length) {
        return fail('Admin Ekranı report trigger is missing, Settings still hosts it, or the broken reset function path returned.', {
          verification: 'STATIC_CONTRACT',
          files: ['src/pages/AdminPage.jsx', 'src/pages/SettingsPage.jsx', 'src/components/admin/QuestionAnalyticsReportTool.jsx'],
          actual: { missing, forbidden, settingsForbidden },
        });
      }
      return pass('Question analytics email report has a minimal admin-only Admin Ekranı trigger, while reset is manual DB guidance only.', {
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
        'QuestionAttemptEvent_raw_events_active_report_source',
        'QuestionStatsProjection_and_CategoryStatsProjection_are_manual_aggregateQuestionStats_outputs_and_may_be_empty',
        'nine_section_report_does_not_require_projection_tables',
        'manual_db_clear_QuestionAttemptEvent_and_if_populated_QuestionStatsProjection_CategoryStatsProjection',
        'manuel DB temizliği',
        'Function reset yolu devre dışı',
        'boş olmaları normal olabilir',
        'aggregateQuestionStats',
        'Manual DB reset path after question pool replacement',
        'QuestionAttemptEvent',
        'QuestionStatsProjection',
        'CategoryStatsProjection',
        'adminResetExcludes',
        'jokerLedgerResetHandling',
        'jokerReportLedgerLimitation',
        'playRhythmResetHandling',
        'JokerTransaction_and_DiamondTransaction_are_not_question_analytics_reset_tables',
        'Joker_Kullanimi_Analizi_ledger_verisinden_besleniyorsa_question_analytics_resetinden_etkilenmez',
        'Oynanma_Zamani_metrics_reset_with_QuestionAttemptEvent_timestamps',
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
      return pass('Manual reset clears QuestionAttemptEvent and any populated manual projection rows by documented DB maintenance; Settings no longer calls resetQuestionAnalyticsData and warns that economy ledgers are outside scope.', {
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
        'staleQuestionReferenceEvents',
        'staleQuestionReferenceHandling',
        'ignored_with_diagnostic_count',
        'Unknown / unmapped',
        'getCategoryId(question)',
        'question?.category',
        'question?.cat',
        'safeSectionHtml',
        'sectionWarningHtml',
        'htmlSections',
        'QUESTION_TABLE_LIMIT',
        'CATEGORY_ANALYTICS_ROW_LIMIT',
        'categoryAnalyticsForReport',
        'nineSectionEmailReport',
        'legacyStaticInventorySectionsRemoved',
        'bodyContainsExactlyRequiredSections',
        'Az ya da Hiç Gösterilmeyen Sorular',
        'Yeterli veri yok',
        'filterRowsSince',
        'QUESTION_TABLE_LIMIT = 15',
        'slice(0, QUESTION_TABLE_LIMIT)',
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
