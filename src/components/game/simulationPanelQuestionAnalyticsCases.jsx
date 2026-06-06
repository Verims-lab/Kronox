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
import adminAuthSource from '../../../base44/functions/_shared/adminAuth.ts?raw';
import aggregateQuestionStatsSource from '../../../base44/functions/aggregateQuestionStats/entry.ts?raw';
import reportFunctionSource from '../../../base44/functions/sendQuestionAnalyticsReportEmail/entry.ts?raw';
import getQuestionsSource from '../../../base44/functions/getQuestions/entry.ts?raw';
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
        'requireAdmin',
        '../_shared/adminAuth.ts',
        'entities.AdminUser',
        'QuestionAttemptEvent.list',
        'Question.list',
        'Category.list',
        'SendEmail',
        'Kronox Soru Analiz Raporu —',
        'Kronox Soru Analiz Raporu',
        'Executive Summary',
        'Key Insights / Risk Flags',
        'En Çok Gösterilen Sorular',
        'Az veya Hiç Gösterilmeyen Sorular',
        'En Çok Yanlış Yapılan Sorular',
        'Çok Kolay Görünen Sorular',
        'En Uzun Sürede Cevaplanan Sorular',
        'Kategori ve Alt Kategori Dağılımı',
        'Veri Kalitesi Uyarıları',
        'AdminMaintenanceLog.create',
      ]);
      if (missing.length || sectionMissing.length) {
        return fail('Manual question analytics report backend contract is incomplete.', {
          verification: 'STATIC_CONTRACT',
          file: 'base44/functions/sendQuestionAnalyticsReportEmail/entry.ts',
          missing: [...missing, ...sectionMissing],
        });
      }
      return pass('Manual report function is admin-gated and includes the required aggregate sections.', {
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
        'body: report.html',
        'html: report.html',
        'text: report.text',
        "textLines.join('\\n')",
        '--- En Çok Gösterilen Sorular ---',
        'NEVER_SHOWN_SAMPLE_LIMIT = 20',
        'neverShown.slice(0, NEVER_SHOWN_SAMPLE_LIMIT)',
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
    'Settings admin tools expose a minimal report trigger',
    () => {
      const combined = `${settingsPageSource}\n${questionAnalyticsReportToolSource}`;
      const missing = missingTokens(combined, [
        'isAdmin &&',
        'QuestionAnalyticsReportTool',
        'Soru Analiz Raporu Gönder',
        '/sendQuestionAnalyticsReportEmail',
        'Son 7 gün',
        'Rapor hazırlanıyor...',
        'Soru analiz raporu e-posta olarak gönderildi.',
        'Rapor gönderilemedi. Lütfen tekrar dene.',
      ]);
      if (missing.length) {
        return fail('Admin Settings report trigger is missing or not admin-scoped.', {
          verification: 'STATIC_CONTRACT',
          files: ['src/pages/SettingsPage.jsx', 'src/components/admin/QuestionAnalyticsReportTool.jsx'],
          missing,
        });
      }
      return pass('Question analytics email report has a minimal admin-only Settings trigger.', {
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
