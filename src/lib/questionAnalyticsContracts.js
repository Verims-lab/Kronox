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
  'Rapor Bölümleri',
  'Sistemdeki Soru Havuzu: Kategori / Zorluk Dağılımı',
  'Key Insights / Risk Flags',
  'Kategori Bazında Soru Havuzu',
  'Kategori ve Zorluk Bazında Kayıtlı Soru Sayısı',
  'Kategori Bazında Kayıtlı Soru Havuzu',
  'Kategori Bazında Yıl Aralığı',
  'Kategori Tercihleri',
  'Kategori Bazında Gösterim',
  'Kategori İçi Soru Analizi',
  'Kategori Denge Sinyalleri',
  'En Çok Gösterilen Sorular',
  'Az veya Hiç Gösterilmeyen Sorular',
  'En Çok Yanlış Yapılan Sorular',
  'Çok Kolay Görünen Sorular',
  'En Uzun Sürede Cevaplanan Sorular',
  'Veri Kalitesi Uyarıları',
  'Rapor Tamamlandı',
]);

export const QUESTION_ANALYTICS_SECURITY_CONTRACT = Object.freeze({
  analyticsRowsPublic: false,
  reportAdminOnly: true,
  playerFacingDashboard: false,
  scheduledReportEnabled: false,
  gameplayBlockingWrites: false,
  accountDeletionHandling: 'delete_or_anonymize_user_owned_QuestionAttemptEvent_rows',
  adminResetHandling: 'manual_db_clear_QuestionAttemptEvent_QuestionStatsProjection_CategoryStatsProjection_only',
});
