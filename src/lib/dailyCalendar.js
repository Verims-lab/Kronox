export const DAILY_CALENDAR_RUNTIME_VERSION = 'daily-calendar-streak-v1';
export const DAILY_CALENDAR_TASKS_PER_DAY = 3;
export const DAILY_CALENDAR_TEMPLATE_CYCLE_LENGTH = 9;
export const DAILY_STREAK_REWARD_DAYS = 7;
export const DAILY_STREAK_REWARD_DIAMONDS = 200;
export const DAILY_TEMPLATE_EPOCH_DATE = '2026-07-06';

export const DAILY_TASK_TYPES = Object.freeze({
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
});

const TASK_LIBRARY = Object.freeze({
  wheel: {
    key: 'wheel',
    title: 'Çark çevir',
    description: 'Günlük çarkı 1 kez çevir.',
    questType: DAILY_TASK_TYPES.DAILY_WHEEL_CLAIM,
    targetValue: 1,
    icon: 'wheel',
  },
  level1: {
    key: 'level1',
    title: '1 seviye tamamla',
    description: 'Herhangi bir modda 1 seviye tamamla.',
    questType: DAILY_TASK_TYPES.SOLO_LEVEL_COMPLETE,
    targetValue: 1,
    icon: 'level',
  },
  level2: {
    key: 'level2',
    title: '2 seviye tamamla',
    description: 'Herhangi bir modda 2 seviye tamamla.',
    questType: DAILY_TASK_TYPES.SOLO_LEVEL_COMPLETE,
    targetValue: 2,
    icon: 'level',
  },
  level3: {
    key: 'level3',
    title: '3 seviye tamamla',
    description: 'Herhangi bir modda 3 seviye tamamla.',
    questType: DAILY_TASK_TYPES.SOLO_LEVEL_COMPLETE,
    targetValue: 3,
    icon: 'level',
  },
  correct4: {
    key: 'correct4',
    title: 'Üst üste 4 doğru cevap ver',
    description: 'Bir oyun içinde 4 doğru cevabı seri yap.',
    questType: DAILY_TASK_TYPES.CONSECUTIVE_CORRECT_4,
    targetValue: 1,
    icon: 'star',
  },
  correct5: {
    key: 'correct5',
    title: '5 soruyu doğru cevapla',
    description: 'Bugün toplam 5 doğru cevap ver.',
    questType: DAILY_TASK_TYPES.CORRECT_ANSWER,
    targetValue: 5,
    icon: 'star',
  },
  joker1: {
    key: 'joker1',
    title: '1 joker kullan',
    description: 'Herhangi bir jokeri 1 kez kullan.',
    questType: DAILY_TASK_TYPES.JOKER_USED,
    targetValue: 1,
    icon: 'shield',
    requiresRegisteredUser: true,
  },
  joker2: {
    key: 'joker2',
    title: '2 joker kullan',
    description: 'Herhangi bir jokeri 2 kez kullan.',
    questType: DAILY_TASK_TYPES.JOKER_USED,
    targetValue: 2,
    icon: 'shield',
    requiresRegisteredUser: true,
  },
  timeFreeze: {
    key: 'timeFreeze',
    title: 'Zamanı Dondur jokerini kullan',
    description: 'Zamanı Dondur jokerini 1 kez kullan.',
    questType: DAILY_TASK_TYPES.TIME_FREEZE_JOKER_USED,
    targetValue: 1,
    icon: 'freeze',
    requiresRegisteredUser: true,
  },
  hint: {
    key: 'hint',
    title: 'İpucu kullan',
    description: 'Solo’da 1 ipucu kullan.',
    questType: DAILY_TASK_TYPES.HINT_USED,
    targetValue: 1,
    icon: 'hint',
  },
  jokerless: {
    key: 'jokerless',
    title: 'Jokersiz seviye tamamla',
    description: 'Bir seviyeyi joker kullanmadan tamamla.',
    questType: DAILY_TASK_TYPES.JOKERLESS_LEVEL_COMPLETE,
    targetValue: 1,
    icon: 'star',
  },
  profile: {
    key: 'profile',
    title: 'Profilini tamamla',
    description: 'Profil bilgilerini tamamla.',
    questType: DAILY_TASK_TYPES.PROFILE_COMPLETE,
    targetValue: 1,
    icon: 'profile',
  },
  friendInvite: {
    key: 'friendInvite',
    title: 'Arkadaşını davet et',
    description: 'Bir arkadaşına davet gönder.',
    questType: DAILY_TASK_TYPES.FRIEND_INVITE_SENT,
    targetValue: 1,
    icon: 'friends',
    requiresRegisteredUser: true,
  },
  friendAdd: {
    key: 'friendAdd',
    title: '1 arkadaş ekle',
    description: 'Bir arkadaş bağlantısı oluştur.',
    questType: DAILY_TASK_TYPES.FRIEND_ADDED,
    targetValue: 1,
    icon: 'friends',
    requiresRegisteredUser: true,
  },
});

export const DAILY_TASK_TEMPLATE_CYCLE = Object.freeze([
  Object.freeze(['wheel', 'level2', 'joker1']),
  Object.freeze(['wheel', 'correct4', 'level1']),
  Object.freeze(['wheel', 'jokerless', 'profile']),
  Object.freeze(['wheel', 'joker1', 'level2']),
  Object.freeze(['wheel', 'hint', 'friendInvite']),
  Object.freeze(['wheel', 'friendAdd', 'timeFreeze']),
  Object.freeze(['wheel', 'friendAdd', 'level2']),
  Object.freeze(['wheel', 'hint', 'level3']),
  Object.freeze(['wheel', 'joker2', 'level3']),
]);

const SAFE_FALLBACK_SEQUENCE = Object.freeze(['correct5', 'level1']);

function parseDateKey(value) {
  const ms = Date.parse(`${String(value || '').slice(0, 10)}T00:00:00.000Z`);
  return Number.isFinite(ms) ? ms : Date.parse(`${DAILY_TEMPLATE_EPOCH_DATE}T00:00:00.000Z`);
}

export function getDailyTemplateCycleDay(dateKey) {
  const dayMs = 24 * 60 * 60 * 1000;
  const diff = Math.floor((parseDateKey(dateKey) - parseDateKey(DAILY_TEMPLATE_EPOCH_DATE)) / dayMs);
  return ((diff % DAILY_CALENDAR_TEMPLATE_CYCLE_LENGTH) + DAILY_CALENDAR_TEMPLATE_CYCLE_LENGTH) %
    DAILY_CALENDAR_TEMPLATE_CYCLE_LENGTH + 1;
}

export function resolveDailyTaskTemplates({ dateKey, profileComplete = false, playerType = 'registered' } = {}) {
  const cycleDay = getDailyTemplateCycleDay(dateKey);
  const usedQuestTypes = new Set();
  return (DAILY_TASK_TEMPLATE_CYCLE[cycleDay - 1] || DAILY_TASK_TEMPLATE_CYCLE[0]).map((templateKey, index) => {
    let key = templateKey;
    let fallbackReason = '';
    if (key === 'profile' && profileComplete) {
      key = 'correct5';
      fallbackReason = 'profile_already_complete';
    }
    let task = TASK_LIBRARY[key] || TASK_LIBRARY.correct5;
    if (task.requiresRegisteredUser && playerType === 'guest') {
      fallbackReason = `${task.key}_requires_registered_user`;
      const fallbackKey = SAFE_FALLBACK_SEQUENCE.find((candidate) => {
        const fallbackTask = TASK_LIBRARY[candidate];
        return fallbackTask && !usedQuestTypes.has(fallbackTask.questType);
      }) || 'correct5';
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

export function normalizeDailyTask(row) {
  const targetValue = Math.max(1, Math.floor(Number(row?.targetValue ?? row?.target_value) || 1));
  const progressValue = Math.max(0, Math.min(targetValue, Math.floor(Number(row?.progressValue ?? row?.progress_value) || 0)));
  return {
    id: row?.id || null,
    questKey: String(row?.questKey || row?.quest_key || ''),
    questDate: String(row?.questDate || row?.quest_date || ''),
    title: String(row?.title || ''),
    description: String(row?.description || ''),
    questType: String(row?.questType || row?.quest_type || ''),
    progressValue,
    targetValue,
    status: String(row?.status || (progressValue >= targetValue ? 'completed' : 'active')),
    completed: Boolean(row?.completed) || progressValue >= targetValue || String(row?.status || '') === 'completed',
    completedAt: row?.completedAt || row?.completed_at || null,
    icon: row?.icon || row?.metadata?.icon || 'star',
    slot: Number(row?.slot || row?.metadata?.slot) || 0,
    fallbackReason: row?.fallbackReason || row?.metadata?.fallbackReason || '',
  };
}

export function buildEmptyCalendarState() {
  return {
    serverDate: null,
    month: null,
    calendarDays: [],
    tasks: [],
    currentStreak: 0,
    streakRewardProgress: 0,
    streakRewardReady: false,
    streakRewardDiamonds: DAILY_STREAK_REWARD_DIAMONDS,
    dayCompleted: false,
  };
}
