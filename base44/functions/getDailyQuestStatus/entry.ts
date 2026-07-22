/* global Deno */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.34';

const DAILY_CALENDAR_RUNTIME_VERSION = 'daily-calendar-streak-v1';
const DAILY_CALENDAR_TASKS_PER_DAY = 3;
const DAILY_CALENDAR_TEMPLATE_CYCLE_LENGTH = 9;
const DAILY_STREAK_REWARD_DAYS = 7;
const DAILY_STREAK_REWARD_DIAMONDS = 200;
const DAILY_TEMPLATE_EPOCH_DATE = '2026-07-06';
const DAY_MS = 24 * 60 * 60 * 1000;
const GUEST_ID_PREFIX = 'guest_';
const ASSIGNMENT_LOCK_TTL_MS = 8_000;
const ASSIGNMENT_LOCK_SETTLE_MS = 80;
const DAILY_PROGRESS_HISTORY_ROW_LIMIT = 420;

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

const TASK_LIBRARY: Record<string, any> = {
  wheel: {
    key: 'wheel',
    title: 'Çark çevir',
    description: 'Günlük çarkı 1 kez çevir.',
    questType: TASK_TYPES.DAILY_WHEEL_CLAIM,
    targetValue: 1,
    icon: 'wheel',
  },
  level1: {
    key: 'level1',
    title: '1 seviye tamamla',
    description: 'Herhangi bir modda 1 seviye tamamla.',
    questType: TASK_TYPES.SOLO_LEVEL_COMPLETE,
    targetValue: 1,
    icon: 'level',
  },
  level2: {
    key: 'level2',
    title: '2 seviye tamamla',
    description: 'Herhangi bir modda 2 seviye tamamla.',
    questType: TASK_TYPES.SOLO_LEVEL_COMPLETE,
    targetValue: 2,
    icon: 'level',
  },
  level3: {
    key: 'level3',
    title: '3 seviye tamamla',
    description: 'Herhangi bir modda 3 seviye tamamla.',
    questType: TASK_TYPES.SOLO_LEVEL_COMPLETE,
    targetValue: 3,
    icon: 'level',
  },
  correct4: {
    key: 'correct4',
    title: 'Üst üste 4 doğru cevap ver',
    description: 'Bir oyun içinde 4 doğru cevabı seri yap.',
    questType: TASK_TYPES.CONSECUTIVE_CORRECT_4,
    targetValue: 1,
    icon: 'star',
    requiresRegisteredUser: true,
  },
  correct5: {
    key: 'correct5',
    title: '5 soruyu doğru cevapla',
    description: 'Bugün toplam 5 doğru cevap ver.',
    questType: TASK_TYPES.CORRECT_ANSWER,
    targetValue: 5,
    icon: 'star',
    requiresRegisteredUser: true,
  },
  joker1: {
    key: 'joker1',
    title: '1 joker kullan',
    description: 'Herhangi bir jokeri 1 kez kullan.',
    questType: TASK_TYPES.JOKER_USED,
    targetValue: 1,
    icon: 'shield',
  },
  joker2: {
    key: 'joker2',
    title: '2 joker kullan',
    description: 'Herhangi bir jokeri 2 kez kullan.',
    questType: TASK_TYPES.JOKER_USED,
    targetValue: 2,
    icon: 'shield',
  },
  timeFreeze: {
    key: 'timeFreeze',
    title: 'Zamanı Dondur jokerini kullan',
    description: 'Zamanı Dondur jokerini 1 kez kullan.',
    questType: TASK_TYPES.TIME_FREEZE_JOKER_USED,
    targetValue: 1,
    icon: 'freeze',
  },
  hint: {
    key: 'hint',
    title: 'İpucu kullan',
    description: 'Solo’da 1 ipucu kullan.',
    questType: TASK_TYPES.HINT_USED,
    targetValue: 1,
    icon: 'hint',
  },
  jokerless: {
    key: 'jokerless',
    title: 'Jokersiz seviye tamamla',
    description: 'Bir seviyeyi joker kullanmadan tamamla.',
    questType: TASK_TYPES.JOKERLESS_LEVEL_COMPLETE,
    targetValue: 1,
    icon: 'star',
  },
  profile: {
    key: 'profile',
    title: 'Profilini tamamla',
    description: 'Profil bilgilerini tamamla.',
    questType: TASK_TYPES.PROFILE_COMPLETE,
    targetValue: 1,
    icon: 'profile',
  },
  friendInvite: {
    key: 'friendInvite',
    title: 'Arkadaşını davet et',
    description: 'Bir arkadaşına davet gönder.',
    questType: TASK_TYPES.FRIEND_INVITE_SENT,
    targetValue: 1,
    icon: 'friends',
    requiresRegisteredUser: true,
  },
  friendAdd: {
    key: 'friendAdd',
    title: '1 arkadaş ekle',
    description: 'Bir arkadaş bağlantısı oluştur.',
    questType: TASK_TYPES.FRIEND_ADDED,
    targetValue: 1,
    icon: 'friends',
    requiresRegisteredUser: true,
  },
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

function addDays(dateKey: string, amount: number) {
  const ms = Date.parse(`${dateKey}T00:00:00.000Z`);
  return new Date(ms + amount * DAY_MS).toISOString().slice(0, 10);
}

function dateKeyMillis(dateKey: string) {
  const ms = Date.parse(`${String(dateKey || '').slice(0, 10)}T00:00:00.000Z`);
  return Number.isFinite(ms) ? ms : Date.parse(`${DAILY_TEMPLATE_EPOCH_DATE}T00:00:00.000Z`);
}

function nextUtcMidnightIso(dateKey: string) {
  return new Date(dateKeyMillis(dateKey) + DAY_MS).toISOString();
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
    return {
      ok: true,
      isGuest: false,
      row: user,
      rowId: rowId(user),
      playerKey: email,
      ownerKey: ownerKeyFromEmail(email),
      playerType: 'registered',
      response: null,
    };
  }

  const guestId = normalizeGuestId(body?.guest_id);
  const guestToken = normalizeGuestToken(body?.guest_token);
  if (!guestId || !guestToken) {
    return { ok: false, response: json({ ok: false, code: 'unauthenticated', error: 'Günlük için profilini tamamlamalısın.' }, 401) };
  }
  const guest = await findGuestProfile(base44, guestId);
  const expectedHash = String(guest?.guest_token_hash || '');
  const providedHash = await hashGuestToken(guestId, guestToken);
  if (!guest || !expectedHash || expectedHash !== providedHash) {
    return { ok: false, response: json({ ok: false, code: 'invalid_guest_token', error: 'Misafir oturumu doğrulanamadı.' }, 401) };
  }
  if (String(guest?.status || '') === 'linked' || !isGuestProfileComplete(guest)) {
    return { ok: false, response: json({ ok: false, code: 'guest_profile_incomplete', error: 'Günlük için profilini tamamlamalısın.' }, 403) };
  }
  return {
    ok: true,
    isGuest: true,
    row: guest,
    rowId: rowId(guest),
    playerKey: guestPlayerKey(guestId),
    ownerKey: ownerKeyFromGuestId(guestId),
    playerType: 'guest',
    response: null,
  };
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
  return tasks.map((task) => canonicalRow(
    rows.filter((row) => String(row?.quest_key || '') === task.questKey),
  )).filter(Boolean);
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
    if (rowId(lock)) {
      await entity.update(rowId(lock), { status: 'released', released_at: new Date().toISOString() }).catch(() => null);
    }
  }
}

function playerEntity(base44: any, player: any) {
  if (player?.isGuest) return base44?.asServiceRole?.entities?.GuestProfile || base44?.entities?.GuestProfile || null;
  return base44?.asServiceRole?.entities?.User || base44?.entities?.User || null;
}

function resolveTaskTemplates(dateKey: string, player: any) {
  const cycleDay = getCycleDay(dateKey);
  const usedQuestTypes = new Set<string>();
  const profileComplete = isProfileComplete(player?.row, player?.isGuest === true);
  return (DAILY_TASK_TEMPLATE_CYCLE[cycleDay - 1] || DAILY_TASK_TEMPLATE_CYCLE[0]).map((templateKey, index) => {
    let key = templateKey;
    let fallbackReason = '';
    if (key === 'profile' && profileComplete) {
      key = 'correct5';
      fallbackReason = 'profile_already_complete';
    }
    let task = TASK_LIBRARY[key] || TASK_LIBRARY.correct5;
    if ((task.requiresRegisteredUser && player?.isGuest) || usedQuestTypes.has(task.questType)) {
      fallbackReason = task.requiresRegisteredUser && player?.isGuest
        ? `${task.key}_requires_registered_user`
        : `${task.key}_duplicate_event_type`;
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
    return {
      ...task,
      slot: index + 1,
      cycleDay,
      questKey: `daily_calendar:d${cycleDay}:s${index + 1}:${task.key}`,
      fallbackReason,
      runtimeVersion: DAILY_CALENDAR_RUNTIME_VERSION,
    };
  });
}

function isDailyCalendarRow(row: any) {
  return String(row?.quest_key || '').startsWith('daily_calendar:') ||
    String(row?.metadata?.runtimeVersion || '') === DAILY_CALENDAR_RUNTIME_VERSION;
}

function buildAssignmentKey(playerKey: string, dateKey: string, questKey: string) {
  return `daily_calendar:${playerKey}:${dateKey}:${questKey}`;
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
      legacyDefinitionRowsIgnoredAtRuntime: true,
      rawGuestTokenServerStored: false,
      grantsDiamondsOnlyOnStreakClaim: true,
      noKronoxPuan: true,
      noLeaderboardImpact: true,
    },
    created_at: timestamp,
    updated_at: timestamp,
  }).catch(async () => findProgressByAssignment(base44, player, dateKey, task.questKey));
}

function progressStatus(row: any) {
  const targetValue = Math.max(1, normalizeNumber(row?.target_value, 1));
  const progressValue = Math.min(targetValue, normalizeNumber(row?.progress_value, 0));
  if (String(row?.status || '') === 'completed' || progressValue >= targetValue) return 'completed';
  return 'active';
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
    status: progressStatus(row),
    completed: progressValue >= targetValue || String(row?.status || '') === 'completed',
    completedAt: row?.completed_at || null,
    icon: String(row?.metadata?.icon || 'star'),
    slot: normalizeNumber(row?.metadata?.slot, 0),
    fallbackReason: String(row?.metadata?.fallbackReason || ''),
  };
}

function dailyWheelSpinEntity(base44: any) {
  return base44?.asServiceRole?.entities?.DailyWheelSpin || base44?.entities?.DailyWheelSpin || null;
}

async function findDailyWheelClaimForDate(base44: any, player: any, dateKey: string) {
  const entity = dailyWheelSpinEntity(base44);
  if (!entity?.filter) return null;
  const rows = await entity.filter({ user_email: player.playerKey, spin_date: dateKey }, '-claimed_at', 5).catch(() => []);
  return Array.isArray(rows)
    ? rows.find((row: any) => rowId(row) && String(row?.spin_date || '').slice(0, 10) === dateKey)
    : null;
}

async function reconcileDailyWheelTaskFromClaim(base44: any, player: any, rows: any[], dateKey: string) {
  // Reconciliation contract: opening or reopening the wheel does not create Daily progress;
  // only an existing same-player/same-day DailyWheelSpin claim can complete Çark çevir.
  const wheelRow = rows.find((row: any) => String(row?.quest_type || '') === TASK_TYPES.DAILY_WHEEL_CLAIM);
  if (!wheelRow || publicTask(wheelRow).completed) return { reconciled: false, reason: 'wheel_task_already_complete_or_absent' };
  const claim = await findDailyWheelClaimForDate(base44, player, dateKey);
  if (!claim) return { reconciled: false, reason: 'daily_wheel_claim_not_found' };

  const entity = progressEntity(base44, player);
  if (!entity?.update || !rowId(wheelRow)) return { reconciled: false, reason: 'daily_wheel_progress_update_unavailable' };

  const timestamp = new Date().toISOString();
  const metadata = wheelRow?.metadata && typeof wheelRow.metadata === 'object' ? wheelRow.metadata : {};
  await entity.update(rowId(wheelRow), {
    progress_value: Math.max(1, normalizeNumber(wheelRow?.target_value, 1)),
    status: 'completed',
    completed_at: wheelRow?.completed_at || claim?.claimed_at || timestamp,
    updated_at: timestamp,
    last_event_key: `daily_calendar_reconcile:${player.playerKey}:${dateKey}:daily_wheel_claim:${rowId(claim)}`,
    metadata: {
      ...metadata,
      runtimeVersion: DAILY_CALENDAR_RUNTIME_VERSION,
      reconciledFromDailyWheelSpin: true,
      reconciliationSource: 'getDailyQuestStatus',
      reconciledDailyWheelSpinId: rowId(claim),
      lastVerificationReason: 'daily_wheel_spin_reconciled',
      noDiamondGrantDuringProgress: true,
      noKronoxPuan: true,
      noLeaderboardImpact: true,
    },
  }).catch(() => null);
  return { reconciled: true, reason: 'daily_wheel_spin_reconciled' };
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
    const refreshed = await readRowsForDate(base44, player, dateKey);
    return canonicalRowsForTasks(refreshed, tasks);
  });
}

function isDayCompleted(rows: any[] = [], dateKey: string, player: any) {
  const tasks = resolveTaskTemplates(dateKey, player).slice(0, DAILY_CALENDAR_TASKS_PER_DAY);
  const canonicalRows = canonicalRowsForTasks(rows.filter(isDailyCalendarRow), tasks);
  return canonicalRows.length === DAILY_CALENDAR_TASKS_PER_DAY
    && new Set(canonicalRows.map((row) => String(row?.quest_key || ''))).size === DAILY_CALENDAR_TASKS_PER_DAY
    && canonicalRows.every((row) => publicTask(row).completed);
}

async function readPlayerCalendarRows(base44: any, player: any, limit = DAILY_PROGRESS_HISTORY_ROW_LIMIT) {
  const entity = progressEntity(base44, player);
  if (!entity?.filter) return [];
  const rows = await entity.filter({ user_email: player.playerKey }, '-quest_date', limit).catch(() => []);
  return Array.isArray(rows) ? rows.filter(isDailyCalendarRow) : [];
}

function groupRowsByDate(rows: any[] = []) {
  const grouped = new Map<string, any[]>();
  for (const row of rows) {
    const key = String(row?.quest_date || '').slice(0, 10);
    if (!key) continue;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)?.push(row);
  }
  return grouped;
}

function buildMonthGrid(monthKey: string, serverDate: string, groupedRows: Map<string, any[]>, player: any) {
  const [yearRaw, monthRaw] = String(monthKey || '').split('-');
  const year = Number(yearRaw);
  const monthIndex = Number(monthRaw) - 1;
  const firstDate = new Date(Date.UTC(year, monthIndex, 1));
  const firstDayMondayIndex = (firstDate.getUTCDay() + 6) % 7;
  const startKey = addDays(firstDate.toISOString().slice(0, 10), -firstDayMondayIndex);
  const days = [];
  for (let index = 0; index < 42; index += 1) {
    const dateKey = addDays(startKey, index);
    const date = new Date(`${dateKey}T00:00:00.000Z`);
    const inCurrentMonth = date.getUTCFullYear() === year && date.getUTCMonth() === monthIndex;
    days.push({
      dateKey,
      dayNumber: date.getUTCDate(),
      inCurrentMonth,
      isToday: dateKey === serverDate,
      completed: isDayCompleted(groupedRows.get(dateKey) || [], dateKey, player),
      future: dateKey > serverDate,
    });
  }
  return days;
}

function computeCurrentStreak(groupedRows: Map<string, any[]>, serverDate: string, player: any) {
  const todayCompleted = isDayCompleted(groupedRows.get(serverDate) || [], serverDate, player);
  let cursor = todayCompleted ? serverDate : addDays(serverDate, -1);
  let streak = 0;
  while (isDayCompleted(groupedRows.get(cursor) || [], cursor, player)) {
    streak += 1;
    cursor = addDays(cursor, -1);
    if (streak > 365) break;
  }
  return { todayCompleted, currentStreak: streak };
}

async function updatePlayerCalendarSummary(base44: any, player: any, patch: Record<string, unknown>) {
  const entity = playerEntity(base44, player);
  if (!entity?.update || !player?.rowId) return null;
  const hasChanged = Object.entries(patch).some(([key, value]) => (
    String(player?.row?.[key] ?? '') !== String(value ?? '')
  ));
  if (!hasChanged) return { skipped: true, reason: 'projection_unchanged' };
  return entity.update(player.rowId, patch).catch(() => null);
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

    const serverDate = utcDateKey();
    const monthKey = String(body?.monthKey || serverDate.slice(0, 7)).slice(0, 7);
    const todayRows = await ensureTodayTasks(base44, player, serverDate);

    if (isProfileComplete(player.row, player.isGuest)) {
      const profileRow = todayRows.find((row: any) => String(row?.quest_type || '') === TASK_TYPES.PROFILE_COMPLETE);
      if (profileRow && !publicTask(profileRow).completed && progressEntity(base44, player)?.update) {
        const timestamp = new Date().toISOString();
        await progressEntity(base44, player).update(rowId(profileRow), {
          progress_value: Math.max(1, normalizeNumber(profileRow.target_value, 1)),
          status: 'completed',
          completed_at: profileRow.completed_at || timestamp,
          updated_at: timestamp,
          metadata: {
            ...(profileRow.metadata && typeof profileRow.metadata === 'object' ? profileRow.metadata : {}),
            autoCompletedFromProfileState: true,
            runtimeVersion: DAILY_CALENDAR_RUNTIME_VERSION,
          },
        }).catch(() => null);
      }
    }

    const wheelReconciliation = await reconcileDailyWheelTaskFromClaim(base44, player, todayRows, serverDate);

    const allRows = await readPlayerCalendarRows(base44, player);
    const groupedRows = groupRowsByDate(allRows);
    const { todayCompleted, currentStreak } = computeCurrentStreak(groupedRows, serverDate, player);
    const streakAnchorDate = currentStreak > 0 ? addDays(todayCompleted ? serverDate : addDays(serverDate, -1), -(currentStreak - 1)) : serverDate;
    const storedAnchor = String(player.row?.daily_calendar_streak_anchor_date || '');
    const storedClaimCount = storedAnchor === streakAnchorDate
      ? normalizeNumber(player.row?.daily_calendar_streak_reward_claim_count, 0)
      : 0;
    const earnedRewardCount = Math.floor(currentStreak / DAILY_STREAK_REWARD_DAYS);
    const streakRewardReady = currentStreak >= DAILY_STREAK_REWARD_DAYS && earnedRewardCount > storedClaimCount;
    const streakRewardProgress = streakRewardReady
      ? DAILY_STREAK_REWARD_DAYS
      : Math.max(0, Math.min(DAILY_STREAK_REWARD_DAYS, currentStreak - storedClaimCount * DAILY_STREAK_REWARD_DAYS));
    const streakRewardCycleId = `daily_calendar_streak:${streakAnchorDate}:${storedClaimCount + 1}`;

    await updatePlayerCalendarSummary(base44, player, {
      daily_calendar_current_streak: currentStreak,
      daily_calendar_last_completed_date: todayCompleted ? serverDate : addDays(serverDate, -1),
      daily_calendar_streak_anchor_date: streakAnchorDate,
      daily_quest_next_available_at: nextUtcMidnightIso(serverDate),
    });

    const refreshedTodayRows = canonicalRowsForTasks(
      groupedRows.get(serverDate) || [],
      resolveTaskTemplates(serverDate, player).slice(0, DAILY_CALENDAR_TASKS_PER_DAY),
    );
    return json({
      ok: true,
      runtimeVersion: DAILY_CALENDAR_RUNTIME_VERSION,
      serverDate,
      nextAvailableAt: nextUtcMidnightIso(serverDate),
      playerType: player.isGuest ? 'guest' : 'registered',
      guestProfile: player.isGuest,
      tasksPerDay: DAILY_CALENDAR_TASKS_PER_DAY,
      tasks: refreshedTodayRows.map(publicTask).slice(0, DAILY_CALENDAR_TASKS_PER_DAY),
      quests: refreshedTodayRows.map(publicTask).slice(0, DAILY_CALENDAR_TASKS_PER_DAY),
      dayCompleted: isDayCompleted(refreshedTodayRows, serverDate, player),
      currentStreak,
      streakRewardProgress,
      streakRewardReady,
      streakRewardDays: DAILY_STREAK_REWARD_DAYS,
      streakRewardDiamonds: DAILY_STREAK_REWARD_DIAMONDS,
      streakRewardCycleId,
      month: {
        monthKey,
        calendarDays: buildMonthGrid(monthKey, serverDate, groupedRows, player),
      },
      calendarDays: buildMonthGrid(monthKey, serverDate, groupedRows, player),
      templateCycleLength: DAILY_CALENDAR_TEMPLATE_CYCLE_LENGTH,
      progressHistoryRowLimit: DAILY_PROGRESS_HISTORY_ROW_LIMIT,
      statusReadWritePolicy: {
        assignmentRepair: 'guarded_idempotent_missing_today_rows_only',
        receiptReconciliation: 'guarded_same_player_same_day_daily_wheel_claim_only',
        wheelReceiptReconciled: wheelReconciliation.reconciled === true,
        summaryProjectionWrite: 'only_when_value_changes',
        redundantSecondAssignmentRepair: false,
      },
      hintTasksUse: TASK_TYPES.HINT_USED,
      legacyCleanupDryRun: {
        available: true,
        functionName: 'cleanupLegacyDailyQuests',
        executed: false,
        defaultMode: 'dry_run',
      },
      grantsDiamondsOnlyOnStreakClaim: true,
      noKronoxPuan: true,
      noLeaderboardImpact: true,
      definitionRowsIgnoredAtRuntime: true,
      rawGuestTokenServerStored: false,
    });
  } catch (error) {
    console.error('[getDailyQuestStatus] failed', error?.message || error);
    return json({
      ok: false,
      code: 'daily_calendar_status_failed',
      error: 'Günlük verileri yüklenemedi.',
    }, 500);
  }
});
