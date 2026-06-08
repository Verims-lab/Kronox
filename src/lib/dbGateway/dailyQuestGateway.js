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
  adminFunction: 'createDailyQuestDefinition',
  displayOnlyFields: ['title', 'description'],
  executableLogicFields: ['quest_type', 'target_value'],
  rewardField: 'reward_diamonds',
  diamondsOnly: true,
  noKronoxPuan: true,
  noLeaderboardImpact: true,
  noFreeTextParser: true,
  futureProgressEntity: 'UserDailyQuestProgress',
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
