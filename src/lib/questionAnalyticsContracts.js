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
  'Yönetici Özeti',
  'Öne Çıkan Bulgular',
  'Öncelikli Aksiyonlar',
  'PDF Eki',
  'Genel Kullanım Özeti',
  'Solo Soru Algoritması İçin Sinyaller',
  'Doğru Soru Tipi / İçerik Kalitesi',
  'Joker Kullanımı Analizi',
  'Oynanma Zamanı ve Kullanım Ritmi',
  'Daha Uzun Oynama / Retention Sinyalleri',
  'Data Quality and Missing Instrumentation',
  'Önerilen Aksiyonlar',
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
  adminResetHandling: 'manual_db_clear_QuestionAttemptEvent_QuestionStatsProjection_CategoryStatsProjection_only',
});
