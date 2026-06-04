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

export const QUESTION_ANALYTICS_REPORT_SECTIONS = Object.freeze([
  'Summary',
  'Top shown questions',
  'Rarely / never shown active questions',
  'Most wrong questions',
  'Very easy questions',
  'Slow questions',
  'Category/subcategory distribution',
  'Sports/theme focus warning',
  'Data quality warnings',
]);

export const QUESTION_ANALYTICS_SECURITY_CONTRACT = Object.freeze({
  analyticsRowsPublic: false,
  reportAdminOnly: true,
  playerFacingDashboard: false,
  scheduledReportEnabled: false,
  gameplayBlockingWrites: false,
  accountDeletionHandling: 'delete_or_anonymize_user_owned_QuestionAttemptEvent_rows',
});
