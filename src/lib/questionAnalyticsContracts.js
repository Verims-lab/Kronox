export const QUESTION_ANALYTICS_EVENT_TYPES = Object.freeze({
  SHOWN: 'shown',
  ANSWERED: 'answered',
  SWAPPED_OUT: 'swapped_out',
  REPLACEMENT_SHOWN: 'replacement_shown',
});

export const QUESTION_ANALYTICS_SOURCES = Object.freeze({
  DECK: 'deck',
  RESERVE: 'reserve',
  REPLACEMENT: 'replacement',
});

export const QUESTION_ANALYTICS_REQUIRED_FIELDS = Object.freeze([
  'question_id',
  'mode',
  'level',
  'attempt_id',
  'event_type',
  'shown_at',
  'answered_at',
  'is_correct',
  'category_id',
  'sub_category',
  'answer_year',
]);

export const QUESTION_ANALYTICS_REPORT_FUNCTION = 'sendQuestionAnalyticsReportEmail';
export const QUESTION_ANALYTICS_MANUAL_RESET_MODE = 'manual_db_reset_only';

export const QUESTION_ANALYTICS_REPORT_SECTIONS = Object.freeze([
  'Kronox Soru Analiz Raporu',
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

export const QUESTION_ANALYTICS_REMOVED_REPORT_SECTIONS = Object.freeze([
  'Rapor Şablonu',
  'Rapor Bölümleri',
  'Sistemdeki Soru Havuzu: Kategori / Zorluk Dağılımı',
  'Kategori ve Zorluk Bazında Kayıtlı Soru Sayısı',
  'Kategori Bazında Yıl Aralığı',
  'Kategori İçi Soru Analizi',
]);

export const QUESTION_ANALYTICS_SECURITY_CONTRACT = Object.freeze({
  analyticsRowsPublic: false,
  reportAdminOnly: true,
  playerFacingDashboard: false,
  scheduledReportEnabled: false,
  gameplayBlockingWrites: false,
  accountDeletionHandling: 'delete_or_anonymize_user_owned_QuestionAttemptEvent_rows',
  activeReportSource: 'QuestionAttemptEvent_raw_events_active_report_source',
  projectionRefreshHandling: 'QuestionStatsProjection_and_CategoryStatsProjection_are_manual_aggregateQuestionStats_outputs_and_may_be_empty',
  reportProjectionUsage: 'nine_section_report_does_not_require_projection_tables',
  adminResetHandling: 'manual_db_clear_QuestionAttemptEvent_and_if_populated_QuestionStatsProjection_CategoryStatsProjection',
  adminResetExcludes: 'content_preferences_user_profile_economy_ledgers_inventory_progress_leaderboard_social_data',
  jokerLedgerResetHandling: 'JokerTransaction_and_DiamondTransaction_are_not_question_analytics_reset_tables',
  jokerReportLedgerLimitation: 'Joker_Kullanimi_Analizi_ledger_verisinden_besleniyorsa_question_analytics_resetinden_etkilenmez',
  playRhythmResetHandling: 'Oynanma_Zamani_metrics_reset_with_QuestionAttemptEvent_timestamps',
});
