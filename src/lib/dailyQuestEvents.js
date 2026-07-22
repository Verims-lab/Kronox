import { recordDailyQuestProgress } from '@/lib/dbGateway/dailyQuestGateway';

const DAILY_SOURCE_RETRY_DELAYS_MS = Object.freeze([0, 120, 280, 520]);
const RETRYABLE_DAILY_PROVENANCE_REASONS = new Set([
  'joker_transaction_not_found',
  'hint_transaction_not_found',
  'persisted_solo_progress_missing',
  'persisted_solo_attempt_mismatch',
  'four_consecutive_correct_attempt_events_missing',
  'correct_question_attempt_event_missing',
  'profile_not_complete',
  'friend_request_provenance_invalid',
]);

function sleep(ms) {
  return ms > 0 ? new Promise((resolve) => setTimeout(resolve, ms)) : Promise.resolve();
}

function sourceReceiptId(payload = {}) {
  return String(
    payload.eventId ||
    payload.event_id ||
    payload.idempotencyKey ||
    payload.idempotency_key ||
    payload.requestId ||
    payload.requestRef ||
    payload.attemptId ||
    '',
  ).trim();
}

function provenanceFailure(error) {
  const body = error?.body || {};
  return {
    code: String(body?.code || ''),
    reason: String(body?.reason || ''),
  };
}

export async function recordDailyQuestSourceEvent(payload = {}, options = {}) {
  const receiptId = sourceReceiptId(payload);
  if (!receiptId && payload?.eventType !== 'profile_complete') {
    return { ok: false, skipped: true, reason: 'daily_source_receipt_missing' };
  }

  const delays = Array.isArray(options?.retryDelaysMs)
    ? options.retryDelaysMs
    : DAILY_SOURCE_RETRY_DELAYS_MS;
  let lastError = null;
  for (let index = 0; index < delays.length; index += 1) {
    await sleep(Number(delays[index]) || 0);
    try {
      return await recordDailyQuestProgress(payload);
    } catch (error) {
      lastError = error;
      const failure = provenanceFailure(error);
      const retryable = failure.code === 'daily_event_provenance_invalid'
        && RETRYABLE_DAILY_PROVENANCE_REASONS.has(failure.reason);
      if (!retryable || index === delays.length - 1) throw error;
    }
  }
  throw lastError || new Error('daily_source_event_record_failed');
}

export const DAILY_SOURCE_EVENT_RECORDER_CONTRACT = Object.freeze({
  backendFunction: 'recordDailyQuestProgress',
  sourceReceiptRequired: true,
  provenanceRetryDelaysMs: DAILY_SOURCE_RETRY_DELAYS_MS,
  cacheRefreshOwnedByGatewaySuccess: true,
  arbitraryClientCompletionAllowed: false,
  noKronoxPuan: true,
  noLeaderboardImpact: true,
});
