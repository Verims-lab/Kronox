/* global Deno */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.34';

const DAILY_CALENDAR_RUNTIME_VERSION = 'daily-calendar-streak-v1';
const DAILY_CALENDAR_TASKS_PER_DAY = 3;
const DAILY_CALENDAR_TEMPLATE_CYCLE_LENGTH = 9;
const DAILY_TEMPLATE_EPOCH_DATE = '2026-07-06';
const DAY_MS = 24 * 60 * 60 * 1000;
const GUEST_ID_PREFIX = 'guest_';
const ASSIGNMENT_LOCK_TTL_MS = 8_000;
const ASSIGNMENT_LOCK_SETTLE_MS = 80;

const TASK_TYPES = {
  DAILY_WHEEL_CLAIM: 'daily_wheel_claim',
  SOLO_LEVEL_COMPLETE: 'solo_level_complete',
  CONSECUTIVE_CORRECT_4: 'consecutive_correct_4',
  JOKER_USED: 'joker_used',
  TIME_FREEZE_JOKER_USED: 'time_freeze_joker_used',
  HINT_USED: 'hint_used',
  JOKERLESS_LEVEL_COMPLETE: 'jokerless_solo_level_complete',
  PROFILE_COMPLETE: 'profile_complete',
  CORRECT_ANSWER: 'correct_answer',
  FRIEND_INVITE_SENT: 'friend_invite_sent',
  FRIEND_ADDED: 'friend_added',
} as const;

const LEGACY_EVENT_ALIASES: Record<string, string> = {
  complete_solo_level: TASK_TYPES.SOLO_LEVEL_COMPLETE,
  use_joker: TASK_TYPES.JOKER_USED,
  use_hint: TASK_TYPES.HINT_USED,
  daily_wheel: TASK_TYPES.DAILY_WHEEL_CLAIM,
};

const TASK_LIBRARY: Record<string, any> = {
  wheel: { key: 'wheel', title: 'Çark çevir', description: 'Günlük çarkı 1 kez çevir.', questType: TASK_TYPES.DAILY_WHEEL_CLAIM, targetValue: 1, icon: 'wheel' },
  level1: { key: 'level1', title: '1 seviye tamamla', description: 'Herhangi bir modda 1 seviye tamamla.', questType: TASK_TYPES.SOLO_LEVEL_COMPLETE, targetValue: 1, icon: 'level' },
  level2: { key: 'level2', title: '2 seviye tamamla', description: 'Herhangi bir modda 2 seviye tamamla.', questType: TASK_TYPES.SOLO_LEVEL_COMPLETE, targetValue: 2, icon: 'level' },
  level3: { key: 'level3', title: '3 seviye tamamla', description: 'Herhangi bir modda 3 seviye tamamla.', questType: TASK_TYPES.SOLO_LEVEL_COMPLETE, targetValue: 3, icon: 'level' },
  correct4: { key: 'correct4', title: 'Üst üste 4 doğru cevap ver', description: 'Bir oyun içinde 4 doğru cevabı seri yap.', questType: TASK_TYPES.CONSECUTIVE_CORRECT_4, targetValue: 1, icon: 'star' },
  correct5: { key: 'correct5', title: '5 soruyu doğru cevapla', description: 'Bugün toplam 5 doğru cevap ver.', questType: TASK_TYPES.CORRECT_ANSWER, targetValue: 5, icon: 'star' },
  joker1: { key: 'joker1', title: '1 joker kullan', description: 'Herhangi bir jokeri 1 kez kullan.', questType: TASK_TYPES.JOKER_USED, targetValue: 1, icon: 'shield', requiresRegisteredUser: true },
  joker2: { key: 'joker2', title: '2 joker kullan', description: 'Herhangi bir jokeri 2 kez kullan.', questType: TASK_TYPES.JOKER_USED, targetValue: 2, icon: 'shield', requiresRegisteredUser: true },
  timeFreeze: { key: 'timeFreeze', title: 'Zamanı Dondur jokerini kullan', description: 'Zamanı Dondur jokerini 1 kez kullan.', questType: TASK_TYPES.TIME_FREEZE_JOKER_USED, targetValue: 1, icon: 'freeze', requiresRegisteredUser: true },
  hint: { key: 'hint', title: 'İpucu kullan', description: 'Solo’da 1 ipucu kullan.', questType: TASK_TYPES.HINT_USED, targetValue: 1, icon: 'hint' },
  jokerless: { key: 'jokerless', title: 'Jokersiz seviye tamamla', description: 'Bir seviyeyi joker kullanmadan tamamla.', questType: TASK_TYPES.JOKERLESS_LEVEL_COMPLETE, targetValue: 1, icon: 'star' },
  profile: { key: 'profile', title: 'Profilini tamamla', description: 'Profil bilgilerini tamamla.', questType: TASK_TYPES.PROFILE_COMPLETE, targetValue: 1, icon: 'profile' },
  friendInvite: { key: 'friendInvite', title: 'Arkadaşını davet et', description: 'Bir arkadaşına davet gönder.', questType: TASK_TYPES.FRIEND_INVITE_SENT, targetValue: 1, icon: 'friends', requiresRegisteredUser: true },
  friendAdd: { key: 'friendAdd', title: '1 arkadaş ekle', description: 'Bir arkadaş bağlantısı oluştur.', questType: TASK_TYPES.FRIEND_ADDED, targetValue: 1, icon: 'friends', requiresRegisteredUser: true },
};

const DAILY_TASK_TEMPLATE_CYCLE = [
  ['wheel', 'level2', 'joker1'],
  ['wheel', 'correct4', 'level1'],
  ['wheel', 'jokerless', 'profile'],
  ['wheel', 'joker1', 'level2'],
  ['wheel', 'hint', 'friendInvite'],
  ['wheel', 'friendAdd', 'timeFreeze'],
  ['wheel', 'friendAdd', 'level2'],
  ['wheel', 'hint', 'level3'],
  ['wheel', 'joker2', 'level3'],
];
const PROVENANCE_SAFE_FALLBACKS = ['level1', 'hint', 'profile', 'friendInvite', 'joker1', 'timeFreeze'];
const DEFERRED_PROVENANCE_TASK_KEYS = new Set(['correct4', 'correct5', 'jokerless']);

function json(payload: unknown, status = 200) {
  return Response.json(payload, { status });
}

function normalizeEmail(value: unknown) {
  return String(value || '').trim().toLowerCase();
}

function normalizeNumber(value: unknown, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.floor(number)) : fallback;
}

function rowId(row: any) {
  return row?.id || row?._id || null;
}

function utcDateKey(now = new Date()) {
  return now.toISOString().slice(0, 10);
}

function dateKeyMillis(dateKey: string) {
  const ms = Date.parse(`${String(dateKey || '').slice(0, 10)}T00:00:00.000Z`);
  return Number.isFinite(ms) ? ms : Date.parse(`${DAILY_TEMPLATE_EPOCH_DATE}T00:00:00.000Z`);
}

function getCycleDay(dateKey: string) {
  const diff = Math.floor((dateKeyMillis(dateKey) - dateKeyMillis(DAILY_TEMPLATE_EPOCH_DATE)) / DAY_MS);
  return ((diff % DAILY_CALENDAR_TEMPLATE_CYCLE_LENGTH) + DAILY_CALENDAR_TEMPLATE_CYCLE_LENGTH) %
    DAILY_CALENDAR_TEMPLATE_CYCLE_LENGTH + 1;
}

function safeCredentialText(value: unknown, maxLength = 180) {
  const text = String(value || '').trim();
  if (!text || text.length > maxLength) return '';
  return /^[A-Za-z0-9_-]+$/.test(text) ? text : '';
}

function normalizeGuestId(value: unknown) {
  const text = safeCredentialText(value, 80);
  return text.startsWith(GUEST_ID_PREFIX) ? text : '';
}

function normalizeGuestToken(value: unknown) {
  return safeCredentialText(value, 220);
}

function ownerKeyFromText(prefix: string, rawValue: unknown) {
  const value = String(rawValue || '').trim().toLowerCase();
  if (!value) return '';
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `${prefix}_${(hash >>> 0).toString(36)}`;
}

function ownerKeyFromEmail(value: unknown) {
  return ownerKeyFromText('u', normalizeEmail(value));
}

function ownerKeyFromGuestId(value: unknown) {
  return ownerKeyFromText('g', value);
}

function guestPlayerKey(guestId: string) {
  const ownerKey = ownerKeyFromGuestId(guestId);
  return ownerKey ? `guest:${ownerKey}` : '';
}

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = '';
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

async function sha256Base64Url(input: string) {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return bytesToBase64Url(new Uint8Array(digest));
}

async function hashGuestToken(guestId: string, guestToken: string) {
  return sha256Base64Url(`kronox_guest_v1:${guestId}:${guestToken}`);
}

function isGuestProfileComplete(row: any) {
  const status = String(row?.onboarding_status || '').trim();
  if (status === 'onboarding_complete' || status === 'completed') return true;
  const profileCompleted = String(row?.profile_setup_status || '').trim() === 'completed' || Boolean(row?.profile_setup_completed_at);
  const categoryCompleted = String(row?.category_setup_status || '').trim() === 'completed' ||
    Boolean(row?.category_setup_completed_at || row?.onboarding_completed_at);
  return Boolean(profileCompleted && categoryCompleted);
}

function isProfileComplete(row: any, isGuest: boolean) {
  if (isGuest) return isGuestProfileComplete(row);
  return Boolean(
    row?.profile_setup_completed_at ||
    (String(row?.username || '').trim() && String(row?.gender || '').trim() && String(row?.age_group || '').trim())
  );
}

async function findGuestProfile(base44: any, guestId: string) {
  const entity = base44?.asServiceRole?.entities?.GuestProfile || base44?.entities?.GuestProfile;
  if (!entity?.filter || !guestId) return null;
  const rows = await entity.filter({ guest_id: guestId }, '-created_at', 5).catch(() => []);
  return Array.isArray(rows) && rows.length ? rows[0] : null;
}

async function resolveDailyCalendarPlayer(base44: any, body: any) {
  const user = await base44.auth.me().catch(() => null);
  const email = normalizeEmail(user?.email || user?.user_email);
  if (email && rowId(user)) {
    return { ok: true, isGuest: false, row: user, rowId: rowId(user), playerKey: email, ownerKey: ownerKeyFromEmail(email), response: null };
  }
  const guestId = normalizeGuestId(body?.guest_id);
  const guestToken = normalizeGuestToken(body?.guest_token);
  if (!guestId || !guestToken) {
    return { ok: false, response: json({ ok: false, code: 'unauthenticated', error: 'Günlük ilerleme için profilini tamamlamalısın.' }, 401) };
  }
  const guest = await findGuestProfile(base44, guestId);
  const expectedHash = String(guest?.guest_token_hash || '');
  const providedHash = await hashGuestToken(guestId, guestToken);
  if (!guest || !expectedHash || expectedHash !== providedHash) {
    return { ok: false, response: json({ ok: false, code: 'invalid_guest_token', error: 'Misafir oturumu doğrulanamadı.' }, 401) };
  }
  if (String(guest?.status || '') === 'linked' || !isGuestProfileComplete(guest)) {
    return { ok: false, response: json({ ok: false, code: 'guest_profile_incomplete', error: 'Günlük ilerleme için profilini tamamlamalısın.' }, 403) };
  }
  return { ok: true, isGuest: true, row: guest, rowId: rowId(guest), playerKey: guestPlayerKey(guestId), ownerKey: ownerKeyFromGuestId(guestId), response: null };
}

function normalizeEventType(value: unknown) {
  const text = String(value || '').trim();
  return LEGACY_EVENT_ALIASES[text] || (Object.values(TASK_TYPES).includes(text as any) ? text : '');
}

function progressEntity(base44: any, player: any = null) {
  const serviceEntity = base44?.asServiceRole?.entities?.UserDailyQuestProgress || null;
  const authEntity = base44?.entities?.UserDailyQuestProgress || null;
  return serviceEntity || authEntity;
}

function economyOperationLockEntity(base44: any) {
  return base44?.asServiceRole?.entities?.EconomyOperationLock || null;
}

function canonicalRow(rows: any[] = []) {
  return [...rows].sort((left, right) => {
    const timeDelta = Date.parse(String(left?.created_at || left?.created_date || '')) - Date.parse(String(right?.created_at || right?.created_date || ''));
    if (Number.isFinite(timeDelta) && timeDelta !== 0) return timeDelta;
    return String(rowId(left) || '').localeCompare(String(rowId(right) || ''));
  })[0] || null;
}

function canonicalRowsForTasks(rows: any[], tasks: any[]) {
  return tasks.map((task) => canonicalRow(rows.filter((row) => String(row?.quest_key || '') === task.questKey))).filter(Boolean);
}

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withAssignmentLock(base44: any, player: any, dateKey: string, callback: (canCreate: boolean) => Promise<any[]>) {
  const entity = economyOperationLockEntity(base44);
  if (!entity?.filter || !entity?.create || !entity?.update) return callback(true);
  const lockKey = `daily-calendar-assignment:${player.ownerKey}:${dateKey}`;
  const nowMs = Date.now();
  const activeRows = await entity.filter({ lock_key: lockKey, status: 'active' }, 'acquired_at', 20).catch(() => []);
  const active = (activeRows || []).find((row: any) => {
    const expiresAt = Date.parse(String(row?.expires_at || ''));
    return !Number.isFinite(expiresAt) || expiresAt > nowMs;
  });
  if (active) {
    await sleep(ASSIGNMENT_LOCK_SETTLE_MS * 3);
    return callback(false);
  }
  const acquiredAt = new Date().toISOString();
  const lock = await entity.create({
    lock_key: lockKey,
    actor_key: player.playerKey,
    operation_scope: 'daily_calendar_assignment',
    operation_id: `${dateKey}:ensure-three-tasks`,
    status: 'active',
    acquired_at: acquiredAt,
    expires_at: new Date(nowMs + ASSIGNMENT_LOCK_TTL_MS).toISOString(),
    metadata: { runtimeVersion: DAILY_CALENDAR_RUNTIME_VERSION, expectedTaskCount: DAILY_CALENDAR_TASKS_PER_DAY },
  }).catch(() => null);
  await sleep(ASSIGNMENT_LOCK_SETTLE_MS);
  const contenders = await entity.filter({ lock_key: lockKey, status: 'active' }, 'acquired_at', 20).catch(() => []);
  const winner = canonicalRow((contenders || []).filter((row: any) => {
    const expiresAt = Date.parse(String(row?.expires_at || ''));
    return !Number.isFinite(expiresAt) || expiresAt > Date.now();
  }));
  const canCreate = Boolean(rowId(lock) && rowId(winner) === rowId(lock));
  try {
    if (!canCreate) await sleep(ASSIGNMENT_LOCK_SETTLE_MS * 3);
    return await callback(canCreate);
  } finally {
    if (rowId(lock)) await entity.update(rowId(lock), { status: 'released', released_at: new Date().toISOString() }).catch(() => null);
  }
}

function resolveTaskTemplates(dateKey: string, player: any) {
  const cycleDay = getCycleDay(dateKey);
  const usedQuestTypes = new Set<string>();
  const profileComplete = isProfileComplete(player?.row, player?.isGuest === true);
  return (DAILY_TASK_TEMPLATE_CYCLE[cycleDay - 1] || DAILY_TASK_TEMPLATE_CYCLE[0]).map((templateKey, index) => {
    let key = templateKey;
    let fallbackReason = '';
    if (key === 'profile' && profileComplete) {
      key = 'level1';
      fallbackReason = 'profile_already_complete';
    }
    let task = TASK_LIBRARY[key] || TASK_LIBRARY.correct5;
    if (DEFERRED_PROVENANCE_TASK_KEYS.has(task.key) || (task.requiresRegisteredUser && player?.isGuest) || usedQuestTypes.has(task.questType)) {
      fallbackReason = DEFERRED_PROVENANCE_TASK_KEYS.has(task.key)
        ? `${task.key}_awaiting_authoritative_receipt`
        : (task.requiresRegisteredUser && player?.isGuest ? `${task.key}_requires_registered_user` : `${task.key}_duplicate_event_type`);
      const fallbackKey = PROVENANCE_SAFE_FALLBACKS.find((candidate) => {
        const fallbackTask = TASK_LIBRARY[candidate];
        return fallbackTask
          && !(fallbackTask.requiresRegisteredUser && player?.isGuest)
          && !(candidate === 'profile' && profileComplete)
          && !usedQuestTypes.has(fallbackTask.questType);
      }) || 'level1';
      task = TASK_LIBRARY[fallbackKey];
    }
    usedQuestTypes.add(task.questType);
    return { ...task, slot: index + 1, cycleDay, questKey: `daily_calendar:d${cycleDay}:s${index + 1}:${task.key}`, fallbackReason };
  });
}

function isDailyCalendarRow(row: any) {
  return String(row?.quest_key || '').startsWith('daily_calendar:') ||
    String(row?.metadata?.runtimeVersion || '') === DAILY_CALENDAR_RUNTIME_VERSION;
}

function buildAssignmentKey(playerKey: string, dateKey: string, questKey: string) {
  return `daily_calendar:${playerKey}:${dateKey}:${questKey}`;
}

function buildProgressEventKey(playerKey: string, dateKey: string, questKey: string, eventType: string, eventId: string) {
  const safeEventId = String(eventId || 'event').trim().replace(/[^a-zA-Z0-9_.:@-]/g, '_').slice(0, 180);
  return `daily_calendar_progress:${playerKey}:${dateKey}:${questKey}:${eventType}:${safeEventId}`;
}

async function readRowsForDate(base44: any, player: any, dateKey: string) {
  const entity = progressEntity(base44, player);
  if (!entity?.filter) return [];
  const rows = await entity.filter({ user_email: player.playerKey, quest_date: dateKey }, 'created_at', 30).catch(() => []);
  return Array.isArray(rows) ? rows.filter(isDailyCalendarRow) : [];
}

async function findProgressByAssignment(base44: any, player: any, dateKey: string, questKey: string) {
  const entity = progressEntity(base44, player);
  if (!entity?.filter) return null;
  const idempotencyKey = buildAssignmentKey(player.playerKey, dateKey, questKey);
  const [byKey, byQuest] = await Promise.all([
    entity.filter({ user_email: player.playerKey, idempotency_key: idempotencyKey }, '-created_at', 1).catch(() => []),
    entity.filter({ user_email: player.playerKey, quest_date: dateKey, quest_key: questKey }, '-created_at', 1).catch(() => []),
  ]);
  return [...(Array.isArray(byKey) ? byKey : []), ...(Array.isArray(byQuest) ? byQuest : [])]
    .find((row: any) => rowId(row)) || null;
}

async function createProgressRow(base44: any, player: any, dateKey: string, task: any) {
  const entity = progressEntity(base44, player);
  if (!entity?.create) return null;
  const existing = await findProgressByAssignment(base44, player, dateKey, task.questKey);
  if (existing) return existing;
  const timestamp = new Date().toISOString();
  return entity.create({
    user_email: player.playerKey,
    owner_key: player.ownerKey,
    player_type: player.isGuest ? 'guest' : 'registered',
    quest_definition_id: `system:${task.questKey}`,
    quest_key: task.questKey,
    quest_date: dateKey,
    title: task.title,
    description: task.description,
    quest_type: task.questType,
    progress_value: 0,
    target_value: Math.max(1, normalizeNumber(task.targetValue, 1)),
    reward_diamonds: 0,
    status: 'active',
    completed_at: null,
    claimed_at: null,
    idempotency_key: buildAssignmentKey(player.playerKey, dateKey, task.questKey),
    metadata: {
      runtimeVersion: DAILY_CALENDAR_RUNTIME_VERSION,
      slot: task.slot,
      cycleDay: task.cycleDay,
      icon: task.icon,
      fallbackReason: task.fallbackReason || '',
      serverDayBoundary: 'UTC',
      taskCompletionSource: 'real_event_based',
      rewardSource: 'daily_calendar_streak_reward',
      rawGuestTokenServerStored: false,
      noKronoxPuan: true,
      noLeaderboardImpact: true,
    },
    created_at: timestamp,
    updated_at: timestamp,
  }).catch(async () => findProgressByAssignment(base44, player, dateKey, task.questKey));
}

async function ensureTodayTasks(base44: any, player: any, dateKey: string) {
  const tasks = resolveTaskTemplates(dateKey, player).slice(0, DAILY_CALENDAR_TASKS_PER_DAY);
  return withAssignmentLock(base44, player, dateKey, async (canCreate) => {
    const rows = await readRowsForDate(base44, player, dateKey);
    if (canCreate) {
      const existingKeys = new Set(rows.map((row: any) => String(row?.quest_key || '')));
      for (const task of tasks) {
        if (!existingKeys.has(task.questKey)) await createProgressRow(base44, player, dateKey, task);
      }
    }
    return canonicalRowsForTasks(await readRowsForDate(base44, player, dateKey), tasks);
  });
}

function boundedEventKeys(metadata: any) {
  const keys = metadata?.progress_event_keys;
  return Array.isArray(keys) ? keys.map((key) => String(key)).slice(-120) : [];
}

function publicTask(row: any) {
  const targetValue = Math.max(1, normalizeNumber(row?.target_value, 1));
  const progressValue = Math.min(targetValue, normalizeNumber(row?.progress_value, 0));
  return {
    id: String(row?.quest_key || ''),
    questKey: String(row?.quest_key || ''),
    questDate: String(row?.quest_date || ''),
    title: String(row?.title || ''),
    description: String(row?.description || ''),
    questType: String(row?.quest_type || ''),
    progressValue,
    targetValue,
    status: progressValue >= targetValue ? 'completed' : String(row?.status || 'active'),
    completed: progressValue >= targetValue || String(row?.status || '') === 'completed',
    completedAt: row?.completed_at || null,
    icon: String(row?.metadata?.icon || 'star'),
  };
}

function timestampMatchesDate(value: unknown, dateKey: string) {
  const time = Date.parse(String(value || ''));
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === dateKey;
}

function readSoloLevelNumber(body: any) {
  const value = body?.soloLevelNumber ?? body?.solo_level_number ?? body?.levelNumber ?? body?.level_number
    ?? body?.metadata?.soloLevelNumber ?? body?.metadata?.solo_level_number;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.max(1, Math.floor(numeric)) : 0;
}

function readAttemptId(body: any) {
  return String(body?.attemptId || body?.attempt_id || body?.metadata?.soloAttemptId || '').trim();
}

async function eventSourceIsVerified(base44: any, player: any, body: any, eventType: string, dateKey: string) {
  if (eventType === TASK_TYPES.DAILY_WHEEL_CLAIM) {
    const entity = base44?.asServiceRole?.entities?.DailyWheelSpin || base44?.entities?.DailyWheelSpin;
    if (!entity?.filter) return { ok: false, reason: 'daily_wheel_spin_entity_missing' };
    const rows = await entity.filter({ user_email: player.playerKey, spin_date: dateKey }, '-claimed_at', 3).catch(() => []);
    return Array.isArray(rows) && rows.some((row: any) => rowId(row) && timestampMatchesDate(row?.claimed_at, dateKey))
      ? { ok: true, reason: 'daily_wheel_spin_verified' }
      : { ok: false, reason: 'daily_wheel_not_claimed' };
  }

  if (eventType === TASK_TYPES.JOKER_USED || eventType === TASK_TYPES.TIME_FREEZE_JOKER_USED) {
    if (player.isGuest) return { ok: false, reason: 'guest_joker_task_disabled' };
    const entity = base44?.asServiceRole?.entities?.JokerTransaction || base44?.entities?.JokerTransaction;
    if (!entity?.filter) return { ok: false, reason: 'joker_transaction_entity_missing' };
    const idempotencyKey = String(body?.idempotencyKey || body?.idempotency_key || '').trim();
    const filters: Record<string, unknown>[] = [];
    if (idempotencyKey) filters.push({ user_email: player.playerKey, idempotency_key: idempotencyKey });
    if (!filters.length) return { ok: false, reason: 'joker_ledger_key_missing' };
    for (const filter of filters) {
      const rows = await entity.filter(filter, '-created_at', 3).catch(() => []);
      const match = Array.isArray(rows)
        ? rows.find((row: any) => {
          const levelNumber = Number(row?.metadata?.soloLevelNumber || 0);
          return rowId(row)
            && Number(row?.quantity_delta) === -1
            && String(row?.reason || '') === 'solo_use'
            && timestampMatchesDate(row?.created_at, dateKey)
            && levelNumber > 6
            && (eventType !== TASK_TYPES.TIME_FREEZE_JOKER_USED || String(row?.joker_type || '') === 'time_freeze');
        })
        : null;
      if (match) return { ok: true, reason: 'joker_transaction_verified' };
    }
    return { ok: false, reason: 'joker_transaction_not_found' };
  }

  if (eventType === TASK_TYPES.HINT_USED) {
    const entity = base44?.asServiceRole?.entities?.HintTransaction || base44?.entities?.HintTransaction;
    if (!entity?.filter) return { ok: false, reason: 'hint_transaction_entity_missing' };
    const idempotencyKey = String(body?.idempotencyKey || body?.idempotency_key || '').trim();
    const filters: Record<string, unknown>[] = [];
    if (idempotencyKey) filters.push({ user_email: player.playerKey, idempotency_key: idempotencyKey });
    if (!filters.length) return { ok: false, reason: 'hint_ledger_key_missing' };
    for (const filter of filters) {
      const rows = await entity.filter(filter, '-created_at', 3).catch(() => []);
      const match = Array.isArray(rows)
        ? rows.find((row: any) => rowId(row)
          && Number(row?.quantity_delta) === -1
          && String(row?.reason || '') === 'solo_use'
          && Number(row?.metadata?.soloLevelNumber || 0) > 6
          && timestampMatchesDate(row?.created_at, dateKey))
        : null;
      if (match) return { ok: true, reason: 'hint_transaction_verified' };
    }
    return { ok: false, reason: 'hint_transaction_not_found' };
  }

  if (eventType === TASK_TYPES.FRIEND_INVITE_SENT || eventType === TASK_TYPES.FRIEND_ADDED) {
    if (player.isGuest) return { ok: false, reason: 'guest_friend_task_disabled' };
    const requestRef = String(body?.requestRef || body?.requestId || body?.request_id || body?.eventId || body?.event_id || '').trim();
    if (!requestRef) return { ok: false, reason: 'friend_request_ref_missing' };
    const entity = base44?.asServiceRole?.entities?.FriendRequest;
    if (!entity?.filter) return { ok: false, reason: 'friend_request_entity_missing' };
    const rows = await entity.filter({ public_ref: requestRef }, '-updated_date', 2).catch(() => []);
    const match = (rows || []).find((row: any) => {
      const fromEmail = normalizeEmail(row?.from_email);
      const toEmail = normalizeEmail(row?.to_email);
      if (eventType === TASK_TYPES.FRIEND_INVITE_SENT) {
        return fromEmail === player.playerKey
          && timestampMatchesDate(row?.created_at || row?.created_date, dateKey);
      }
      return String(row?.status || '') === 'accepted'
        && (fromEmail === player.playerKey || toEmail === player.playerKey)
        && timestampMatchesDate(row?.accepted_at, dateKey);
    });
    return match
      ? { ok: true, reason: eventType === TASK_TYPES.FRIEND_ADDED ? 'friend_acceptance_verified' : 'friend_invite_verified' }
      : { ok: false, reason: 'friend_request_provenance_invalid' };
  }

  if (eventType === TASK_TYPES.PROFILE_COMPLETE) {
    return isProfileComplete(player?.row, player?.isGuest === true)
      ? { ok: true, reason: 'profile_state_verified' }
      : { ok: false, reason: 'profile_not_complete' };
  }

  if (eventType === TASK_TYPES.JOKERLESS_LEVEL_COMPLETE) {
    return { ok: false, reason: 'authoritative_jokerless_attempt_receipt_unavailable' };
  }

  if (eventType === TASK_TYPES.SOLO_LEVEL_COMPLETE) {
    if (body?.passed !== true) return { ok: false, reason: 'solo_level_not_passed' };
    const levelNumber = readSoloLevelNumber(body);
    const entry = player?.row?.solo_progress?.levels?.[String(levelNumber)] || null;
    const completedAt = entry?.lastAttemptAt || entry?.completedAt;
    return levelNumber > 0 && Number(entry?.bestStars || 0) > 0 && timestampMatchesDate(completedAt, dateKey)
      ? { ok: true, reason: 'persisted_solo_progress_verified' }
      : { ok: false, reason: 'persisted_solo_progress_missing' };
  }

  if (eventType === TASK_TYPES.CORRECT_ANSWER || eventType === TASK_TYPES.CONSECUTIVE_CORRECT_4) {
    if (player.isGuest) return { ok: false, reason: 'guest_answer_receipt_unavailable' };
    const entity = base44?.asServiceRole?.entities?.QuestionAttemptEvent;
    if (!entity?.filter) return { ok: false, reason: 'question_attempt_event_entity_missing' };
    const attemptId = readAttemptId(body);
    if (!attemptId) return { ok: false, reason: 'question_attempt_id_missing' };
    let rows: any[] = [];
    for (const delay of [0, 100, 220]) {
      if (delay) await sleep(delay);
      rows = await entity.filter({ user_email: player.playerKey, attempt_id: attemptId, event_type: 'answered' }, '-answered_at', 20).catch(() => []);
      const correctCount = rows.filter((row: any) => row?.is_correct === true).length;
      if ((eventType === TASK_TYPES.CONSECUTIVE_CORRECT_4 && correctCount >= 4) || (eventType === TASK_TYPES.CORRECT_ANSWER && rows.length)) break;
    }
    const verifiedCorrectRows = (rows || []).filter((row: any) => row?.is_correct === true && timestampMatchesDate(row?.answered_at || row?.created_at, dateKey));
    if (eventType === TASK_TYPES.CONSECUTIVE_CORRECT_4) {
      return verifiedCorrectRows.length >= 4
        ? { ok: true, reason: 'four_correct_attempt_events_verified' }
        : { ok: false, reason: 'four_correct_attempt_events_missing' };
    }
    const eventId = String(body?.eventId || body?.event_id || '').trim();
    return verifiedCorrectRows.some((row: any) => !eventId || String(row?.event_id || '') === eventId)
      ? { ok: true, reason: 'correct_question_attempt_event_verified' }
      : { ok: false, reason: 'correct_question_attempt_event_missing' };
  }
  return { ok: false, reason: 'event_provenance_not_supported' };
}

Deno.serve(async (req: Request) => {
  try {
    if (req.method !== 'POST') {
      return json({ ok: false, code: 'method_not_allowed', error: 'Bu işlem desteklenmiyor.' }, 405);
    }

    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const player = await resolveDailyCalendarPlayer(base44, body);
    if (!player.ok) return player.response;

    const eventType = normalizeEventType(body?.eventType || body?.quest_type || body?.questType);
    if (!eventType) {
      return json({
        ok: true,
        skipped: true,
        reason: 'unsupported_daily_calendar_event',
        updated: [],
        noDiamondGrantDuringProgress: true,
        noKronoxPuan: true,
        noLeaderboardImpact: true,
      });
    }

    const dateKey = utcDateKey();
    const verification = await eventSourceIsVerified(base44, player, body, eventType, dateKey);
    if (!verification.ok) {
      return json({
        ok: false,
        code: 'daily_event_provenance_invalid',
        reason: verification.reason,
        error: 'Günlük ilerleme kaynağı doğrulanamadı.',
        eventType,
        updated: [],
        noDiamondGrantDuringProgress: true,
      }, 422);
    }

    const rows = await ensureTodayTasks(base44, player, dateKey);
    const entity = progressEntity(base44, player);
    const baseEventId = String(body?.eventId || body?.event_id || body?.idempotencyKey || body?.idempotency_key || body?.transactionId || body?.requestId || '').trim();
    const amount = 1;
    const updates: any[] = [];

    for (const row of rows) {
      if (String(row?.quest_type || '') !== eventType) continue;
      const targetValue = Math.max(1, normalizeNumber(row?.target_value, 1));
      const currentProgress = Math.min(targetValue, normalizeNumber(row?.progress_value, 0));
      if (currentProgress >= targetValue || String(row?.status || '') === 'completed') {
        updates.push({ questKey: row?.quest_key, skipped: true, reason: 'already_completed' });
        continue;
      }
      const eventKey = buildProgressEventKey(player.playerKey, dateKey, String(row?.quest_key || ''), eventType, baseEventId || `${Date.now()}`);
      const metadata = row?.metadata && typeof row.metadata === 'object' ? row.metadata : {};
      const eventKeys = boundedEventKeys(metadata);
      if (eventKeys.includes(eventKey)) {
        updates.push({ questKey: row?.quest_key, skipped: true, reason: 'duplicate_event' });
        continue;
      }
      if (!entity?.update || !rowId(row)) {
        updates.push({ questKey: row?.quest_key, skipped: true, reason: 'progress_update_unavailable' });
        continue;
      }
      const nextProgress = Math.min(targetValue, currentProgress + amount);
      const timestamp = new Date().toISOString();
      const completedNow = currentProgress < targetValue && nextProgress >= targetValue;
      const updated = await entity.update(rowId(row), {
        progress_value: nextProgress,
        status: nextProgress >= targetValue ? 'completed' : 'active',
        completed_at: row?.completed_at || (completedNow ? timestamp : null),
        updated_at: timestamp,
        last_event_key: eventKey,
        metadata: {
          ...metadata,
          runtimeVersion: DAILY_CALENDAR_RUNTIME_VERSION,
          progress_event_keys: [...eventKeys, eventKey].slice(-120),
          lastEventType: eventType,
          lastEventId: baseEventId || null,
          lastMode: String(body?.mode || ''),
          lastVerificationReason: verification.reason,
          noDiamondGrantDuringProgress: true,
        },
      });
      updates.push(publicTask(updated));
    }

    const refreshedRows = await ensureTodayTasks(base44, player, dateKey);
    return json({
      ok: true,
      runtimeVersion: DAILY_CALENDAR_RUNTIME_VERSION,
      eventType,
      mode: String(body?.mode || ''),
      playerType: player.isGuest ? 'guest' : 'registered',
      guestProfile: player.isGuest,
      serverDate: dateKey,
      updated: updates,
      tasks: refreshedRows.map(publicTask).slice(0, DAILY_CALENDAR_TASKS_PER_DAY),
      quests: refreshedRows.map(publicTask).slice(0, DAILY_CALENDAR_TASKS_PER_DAY),
      eventVerifiedBy: verification.reason,
      noDiamondGrantDuringProgress: true,
      grantsDiamondsOnlyOnStreakClaim: true,
      noKronoxPuan: true,
      noLeaderboardImpact: true,
      rawGuestTokenServerStored: false,
    });
  } catch (error) {
    console.error('[recordDailyQuestProgress] failed', error?.message || error);
    return json({
      ok: false,
      code: 'daily_calendar_progress_failed',
      error: 'Günlük ilerleme kaydedilemedi.',
    }, 500);
  }
});
