import { base44 } from '@/api/base44Client';

export const STARTER_HINT_QUANTITY = 3;
export const SOLO_HINT_REVEAL_STAGE_COUNT = 3;

export const HINT_INVENTORY_CONTRACT = [
  'Solo Hint / İpucu is separate from Joker inventory.',
  'Every player gets three starter Hints exactly once through server-side idempotent inventory initialization.',
  'Opening the Hint popup never spends inventory; a reveal stage advances only after consumeUserHint succeeds.',
  'Hint use writes HintTransaction reason solo_use and never sets JokerTransaction, joker_used, Kronox Puan, or leaderboard state.',
  'Guest players use a token-proven internal guest:<g_owner_key> economy key and receive sanitized responses only.',
].join(' ');

export function normalizeHintQuantity(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.max(0, Math.floor(numeric)) : 0;
}

export function normalizeHintRevealStage(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.min(SOLO_HINT_REVEAL_STAGE_COUNT, Math.floor(numeric)));
}

function safeKeyPart(value, fallback = 'unknown') {
  const text = String(value || '').trim();
  return (text || fallback).replace(/[^a-zA-Z0-9_.:@-]/g, '_').slice(0, 120);
}

function normalizeFunctionResult(response) {
  const data = response?.data && typeof response.data === 'object' ? response.data : response;
  return data && typeof data === 'object' ? data : {};
}

export function buildSoloHintUseIdempotencyKey({ soloAttemptId, questionId, revealStage } = {}) {
  const stage = normalizeHintRevealStage(revealStage);
  if (!stage) return '';
  return [
    'solo_hint',
    safeKeyPart(soloAttemptId, 'solo_attempt'),
    safeKeyPart(questionId, 'question'),
    `stage_${stage}`,
  ].join(':');
}

export async function ensureUserHintInventory({ guestCredentials = null } = {}) {
  const payload = guestCredentials && typeof guestCredentials === 'object' ? guestCredentials : {};
  const response = await base44.functions.invoke('ensureUserHintInventory', payload);
  const data = normalizeFunctionResult(response);
  return {
    ...data,
    hintBalance: normalizeHintQuantity(data.hintBalance ?? data.balance ?? data.quantity),
    starterQuantity: normalizeHintQuantity(data.starterQuantity ?? STARTER_HINT_QUANTITY),
  };
}

export async function consumeUserHint({
  guestCredentials = null,
  idempotencyKey,
  soloAttemptId,
  soloLevelNumber,
  questionId,
  revealStage,
} = {}) {
  const stage = normalizeHintRevealStage(revealStage);
  const payload = {
    ...(guestCredentials && typeof guestCredentials === 'object' ? guestCredentials : {}),
    idempotencyKey: String(idempotencyKey || '').trim(),
    soloAttemptId: String(soloAttemptId || '').trim(),
    soloLevelNumber: Number.isFinite(Number(soloLevelNumber)) ? Math.floor(Number(soloLevelNumber)) : null,
    questionId: String(questionId || '').trim(),
    revealStage: stage,
    relatedEntityType: 'solo_question',
    relatedEntityId: String(questionId || '').trim(),
  };
  const response = await base44.functions.invoke('consumeUserHint', payload);
  const data = normalizeFunctionResult(response);
  return {
    ...data,
    hintBalance: normalizeHintQuantity(data.hintBalance ?? data.balanceAfter ?? data.balance),
    revealStage: normalizeHintRevealStage(data.revealStage ?? stage),
  };
}
