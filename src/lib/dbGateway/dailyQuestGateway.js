import { base44 } from '@/api/base44Client';
import {
  DAILY_CALENDAR_RUNTIME_VERSION,
  DAILY_CALENDAR_TASKS_PER_DAY,
  DAILY_CALENDAR_TEMPLATE_CYCLE_LENGTH,
  DAILY_STREAK_REWARD_DIAMONDS,
  DAILY_STREAK_REWARD_DAYS,
  DAILY_TASK_TYPES,
} from '@/lib/dailyCalendar';

export const DAILY_QUEST_V1_TYPES = Object.freeze(Object.values(DAILY_TASK_TYPES));

export const DAILY_QUEST_TYPE_LABELS = Object.freeze({
  daily_wheel_claim: 'Çark çevir',
  solo_level_complete: 'Solo seviyesi tamamla',
  consecutive_correct_4: 'Üst üste 4 doğru cevap',
  joker_used: 'Joker kullan',
  time_freeze_joker_used: 'Zamanı Dondur jokeri kullan',
  hint_used: 'İpucu kullan',
  jokerless_solo_level_complete: 'Jokersiz seviye tamamla',
  profile_complete: 'Profilini tamamla',
  correct_answer: 'Doğru cevap',
  friend_invite_sent: 'Arkadaş daveti gönder',
  friend_added: 'Arkadaş ekle',
});

export const DAILY_QUEST_DEFINITION_CONTRACT = Object.freeze({
  entity: 'DailyQuestDefinition (legacy/admin-only; new Daily Calendar runtime ignores definition rows)',
  progressEntity: 'UserDailyQuestProgress',
  statusFunction: 'getDailyQuestStatus',
  progressFunction: 'recordDailyQuestProgress',
  claimFunction: 'claimDailyQuestReward',
  legacyCleanupFunction: 'cleanupLegacyDailyQuests',
  canonicalQuestKey: 'daily_calendar:*',
  canonicalQuestType: 'daily_calendar_event_task',
  canonicalTitle: 'GÜNLÜK',
  canonicalDescription: 'Serini koru, ödülünü kazan!',
  executableLogicFields: ['quest_type', 'target_value', 'quest_date'],
  logicContract: 'quest_type + target_value',
  progressMode: 'real_event_based_daily_calendar_tasks',
  rewardField: 'streak_reward_diamonds',
  rewardKind: '7-day Gift Box Diamonds only',
  rewardKindNote: 'Daily Calendar streak reward grants exactly 200 Diamonds server-side/idempotently; it does not grant Kronox Puan and has no leaderboard impact.',
  diamondsOnly: true,
  noKronoxPuan: true,
  noLeaderboardImpact: true,
  noFreeTextParser: true,
  textIsNeverParsedIntoLogic: true,
  noRegexParser: true,
  noAiParser: true,
  noNlpParser: true,
  noArbitraryScripts: true,
  runtimeVersion: DAILY_CALENDAR_RUNTIME_VERSION,
  transactionSource: 'daily_calendar_streak_reward',
  dayBoundary: 'UTC',
  tasksPerDay: DAILY_CALENDAR_TASKS_PER_DAY,
  templateCycleLength: DAILY_CALENDAR_TEMPLATE_CYCLE_LENGTH,
  streakRewardDays: DAILY_STREAK_REWARD_DAYS,
  streakRewardDiamonds: DAILY_STREAK_REWARD_DIAMONDS,
  logicalUniqueKey: 'quest_key + quest_date + player_key',
  // Mirrors the backend getDailyQuestStatus runtime marker: the active Daily
  // Calendar runtime never reads/creates/seeds DailyQuestDefinition rows.
  definitionRowsIgnoredAtRuntime: true,
  adminDefinitionRowsIgnoredAtRuntime: true,
  duplicateCleanupMode: 'cleanupLegacyDailyQuests dry-run first; destructive delete requires explicit admin confirmation',
});

function unwrapFunctionResponse(response) {
  if (response?.data?.data && typeof response.data.data === 'object') return response.data.data;
  if (response?.data && typeof response.data === 'object') return response.data;
  if (response && typeof response === 'object') return response;
  return {};
}

function safeError(body, fallback) {
  const code = String(body?.code || '').trim();
  if (code === 'duplicate_quest_key') return 'Bu görev anahtarı zaten var.';
  if (code === 'invalid_quest_type') return 'Geçerli bir görev tipi seçin.';
  if (code === 'invalid_positive_numbers') return 'Hedef ve ödül 1 veya daha büyük olmalı.';
  if (code === 'admin_required') return 'Admin yetkisi gerekli.';
  if (code === 'unauthenticated') return 'Oturum doğrulaması gerekli.';
  return body?.error || fallback;
}

function unwrapInvokeError(error) {
  if (error?.body && typeof error.body === 'object') return error.body;
  if (error?.response) return unwrapFunctionResponse(error.response);
  if (error?.data) return unwrapFunctionResponse({ data: error.data });
  return {};
}

function safeRuntimeError(errorOrBody, fallback) {
  const body = errorOrBody?.response || errorOrBody?.body || errorOrBody?.data
    ? unwrapInvokeError(errorOrBody)
    : errorOrBody;
  const code = String(body?.code || '').trim();
  if (code === 'unauthenticated') return 'Oturum doğrulaması gerekli.';
  if (code === 'daily_quest_not_completed') return 'Görev henüz tamamlanmadı.';
  if (code === 'daily_quest_already_claimed') return 'Bu görev ödülü zaten alındı.';
  if (code === 'daily_quest_legacy_not_claimable') return 'Bu günlük görev artık geçerli değil.';
  return fallback;
}

export async function callDailyQuestDefinitionAdmin(payload = {}) {
  const response = await base44.functions.invoke('createDailyQuestDefinition', payload);
  const body = unwrapFunctionResponse(response);
  if (body?.ok === false) {
    throw new Error(safeError(body, 'Günlük görev işlemi başarısız oldu.'));
  }
  return body;
}

export function legacyListDailyQuestDefinitionRows() {
  return callDailyQuestDefinitionAdmin({ action: 'list' });
}

export function legacyCreateDailyQuestDefinitionRow(payload) {
  return callDailyQuestDefinitionAdmin({ ...payload, action: 'create' });
}

export function legacyUpdateDailyQuestDefinitionStatus(id, status) {
  return callDailyQuestDefinitionAdmin({ action: 'update_status', id, status });
}

export function legacySeedDailyQuestDefinitionRows() {
  return callDailyQuestDefinitionAdmin({ action: 'seed' });
}

export async function getDailyQuestStatus(payload = {}) {
  let response;
  try {
    response = await base44.functions.invoke('getDailyQuestStatus', payload);
  } catch (error) {
    const safe = safeRuntimeError(error, 'Günlük yenilenemedi. Tekrar dene.');
    const wrapped = new Error(safe);
    wrapped.body = unwrapInvokeError(error);
    throw wrapped;
  }
  const body = unwrapFunctionResponse(response);
  if (body?.ok === false) {
    throw new Error(safeRuntimeError(body, 'Günlük yenilenemedi. Tekrar dene.'));
  }
  return body;
}

export async function recordDailyQuestProgress(payload = {}) {
  let response;
  try {
    response = await base44.functions.invoke('recordDailyQuestProgress', payload);
  } catch (error) {
    const wrapped = new Error(safeRuntimeError(error, 'Günlük görev ilerlemesi kaydedilemedi.'));
    wrapped.body = unwrapInvokeError(error);
    throw wrapped;
  }
  const body = unwrapFunctionResponse(response);
  if (body?.ok === false) {
    const error = new Error(safeRuntimeError(body, 'Günlük görev ilerlemesi kaydedilemedi.'));
    error.body = body;
    throw error;
  }
  return body;
}

export async function claimDailyQuestReward(payload = {}) {
  let response;
  try {
    response = await base44.functions.invoke('claimDailyQuestReward', payload);
  } catch (error) {
    const wrapped = new Error(safeRuntimeError(error, 'Ödül alınamadı. Tekrar dene.'));
    wrapped.body = unwrapInvokeError(error);
    throw wrapped;
  }
  const body = unwrapFunctionResponse(response);
  if (body?.ok === false) {
    const error = new Error(safeRuntimeError(body, 'Ödül alınamadı. Tekrar dene.'));
    error.body = body;
    throw error;
  }
  return body;
}

export async function cleanupLegacyDailyQuestData(payload = {}) {
  let response;
  try {
    response = await base44.functions.invoke('cleanupLegacyDailyQuests', {
      mode: 'dry_run',
      ...payload,
    });
  } catch (error) {
    const wrapped = new Error(safeRuntimeError(error, 'Eski günlük görev temizliği hazırlanamadı.'));
    wrapped.body = unwrapInvokeError(error);
    throw wrapped;
  }
  const body = unwrapFunctionResponse(response);
  if (body?.ok === false) {
    const error = new Error(body?.error || 'Eski günlük görev temizliği hazırlanamadı.');
    error.body = body;
    throw error;
  }
  return body;
}