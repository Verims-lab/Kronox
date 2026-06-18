import { base44 } from '@/api/base44Client';
import { getStoredGuestCredentials } from '@/lib/guestProfile';

export const PLAYER_QUESTION_EXPOSURE_CONTRACT = Object.freeze({
  entities: ['PlayerQuestionExposure', 'PlayerQuestionDailyExposure'],
  uniqueKey: 'player_key + question_id + mode',
  dailyUniqueKey: 'date_utc + player_key + question_id + mode',
  actualShownOnly: true,
  bufferedQuestionsCounted: false,
  rawGuestTokenServerStored: false,
  reportAnonymizesPlayerKey: true,
});

function normalizeMode(value) {
  const mode = String(value || 'solo').trim().toLowerCase();
  return ['solo', 'tutorial', 'online'].includes(mode) ? mode : 'solo';
}

function normalizeQuestionId(value) {
  const id = String(value || '').trim();
  return id || '';
}

function normalizeCategoryId(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? Math.trunc(numeric) : null;
}

function guestCredentialsPayload() {
  const credentials = getStoredGuestCredentials();
  if (!credentials?.guest_id || !credentials?.guest_token) return {};
  return {
    guest_id: credentials.guest_id,
    guest_token: credentials.guest_token,
  };
}

function normalizeExposureStat(row = {}) {
  const questionId = normalizeQuestionId(row.question_id ?? row.questionId ?? row.id);
  if (!questionId) return null;
  const shownCount = Math.max(0, Math.trunc(Number(row.shown_count ?? row.shownCount) || 0));
  const lastShownAt = row.last_shown_at ?? row.lastShownAt ?? null;
  return {
    question_id: questionId,
    questionId,
    category_id: normalizeCategoryId(row.category_id ?? row.categoryId),
    mode: normalizeMode(row.mode),
    shown_count: shownCount,
    shownCount,
    first_shown_at: row.first_shown_at ?? row.firstShownAt ?? null,
    last_shown_at: lastShownAt,
    lastShownAt,
    recentRank: Number.isFinite(Number(row.recentRank ?? row.recent_rank))
      ? Math.max(0, Number(row.recentRank ?? row.recent_rank))
      : null,
    source: row.source || 'PlayerQuestionExposure',
  };
}

export async function loadPlayerQuestionExposureStats({ mode = 'solo', limit = 2500 } = {}) {
  try {
    const response = await base44.functions.invoke('getPlayerQuestionExposureStats', {
      ...guestCredentialsPayload(),
      mode: normalizeMode(mode),
      limit,
    });
    const payload = response?.data || response || {};
    const rows = Array.isArray(payload.stats)
      ? payload.stats
      : (Array.isArray(payload.rows) ? payload.rows : []);
    return rows.map(normalizeExposureStat).filter(Boolean);
  } catch {
    return [];
  }
}

export async function recordPlayerQuestionExposure(payload = {}) {
  const questionId = normalizeQuestionId(payload.question_id ?? payload.questionId);
  if (!questionId) return { ok: false, skipped: 'missing_question_id' };
  try {
    const response = await base44.functions.invoke('recordPlayerQuestionExposure', {
      ...guestCredentialsPayload(),
      ...payload,
      question_id: questionId,
      mode: normalizeMode(payload.mode),
      category_id: normalizeCategoryId(payload.category_id ?? payload.categoryId ?? payload.main_category_id),
    });
    return response?.data || response || { ok: true };
  } catch (error) {
    return {
      ok: false,
      skipped: 'player_question_exposure_write_failed',
      error: error?.message || String(error),
    };
  }
}
