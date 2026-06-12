import { base44 } from '@/api/base44Client';

export const DAILY_QUEST_V1_TYPES = Object.freeze([
  'start_solo_attempt',
  'correct_cards',
  'complete_solo_level',
  'use_joker',
]);

export const DAILY_QUEST_TYPE_LABELS = Object.freeze({
  start_solo_attempt: 'Solo oyunu başlat',
  correct_cards: 'Kart doğru yerleştir',
  complete_solo_level: 'Solo level tamamla',
  use_joker: 'Joker kullan',
});

export const DAILY_QUEST_DEFINITION_CONTRACT = Object.freeze({
  entity: 'DailyQuestDefinition',
  progressEntity: 'UserDailyQuestProgress',
  adminFunction: 'createDailyQuestDefinition',
  statusFunction: 'getDailyQuestStatus',
  progressFunction: 'recordDailyQuestProgress',
  claimFunction: 'claimDailyQuestReward',
  displayOnlyFields: ['title', 'description'],
  executableLogicFields: ['quest_type', 'target_value'],
  rewardField: 'reward_diamonds',
  diamondsOnly: true,
  noKronoxPuan: true,
  noLeaderboardImpact: true,
  noFreeTextParser: true,
  runtimeVersion: 'daily-quest-runtime-v1',
  transactionSource: 'daily_quest_reward',
  dayBoundary: 'UTC',
  logicalUniqueKey: 'quest_key',
  adminListSeedsDefaults: false,
  duplicateDefinitionsGrouped: true,
  duplicateCleanupMode: 'manual_after_backup',
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

export function listDailyQuestDefinitions() {
  return callDailyQuestDefinitionAdmin({ action: 'list' });
}

export function createDailyQuestDefinition(payload) {
  return callDailyQuestDefinitionAdmin({ ...payload, action: 'create' });
}

export function updateDailyQuestDefinitionStatus(id, status) {
  return callDailyQuestDefinitionAdmin({ action: 'update_status', id, status });
}

export function seedDailyQuestDefinitions() {
  return callDailyQuestDefinitionAdmin({ action: 'seed' });
}

export async function getDailyQuestStatus(payload = {}) {
  let response;
  try {
    response = await base44.functions.invoke('getDailyQuestStatus', payload);
  } catch (error) {
    const safe = safeRuntimeError(error, 'Görevler yenilenemedi. Tekrar dene.');
    const wrapped = new Error(safe);
    wrapped.body = unwrapInvokeError(error);
    throw wrapped;
  }
  const body = unwrapFunctionResponse(response);
  if (body?.ok === false) {
    throw new Error(safeRuntimeError(body, 'Görevler yenilenemedi. Tekrar dene.'));
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
