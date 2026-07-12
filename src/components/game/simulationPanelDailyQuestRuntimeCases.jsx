// Kronox Health Center — Daily Calendar / Streak runtime contracts.
//
// Scope: the legacy Daily Quest/Görevler runtime has been replaced by the
// Home GÜNLÜK shortcut, a calendar screen, real-event-based daily tasks, and
// a server-side 7-day streak Diamond reward.

import userEntitySource from '../../../base44/entities/User.jsonc?raw';
import guestProfileEntitySource from '../../../base44/entities/GuestProfile.jsonc?raw';
import dailyQuestProgressEntitySource from '../../../base44/entities/UserDailyQuestProgress.jsonc?raw';
import diamondTransactionEntitySource from '../../../base44/entities/DiamondTransaction.jsonc?raw';
import getDailyQuestStatusSource from '../../../base44/functions/getDailyQuestStatus/entry.ts?raw';
import recordDailyQuestProgressSource from '../../../base44/functions/recordDailyQuestProgress/entry.ts?raw';
import claimDailyWheelRewardSource from '../../../base44/functions/claimDailyWheelReward/entry.ts?raw';
import claimDailyQuestRewardSource from '../../../base44/functions/claimDailyQuestReward/entry.ts?raw';
import cleanupLegacyDailyQuestsSource from '../../../base44/functions/cleanupLegacyDailyQuests/entry.ts?raw';
import dailyQuestGatewaySource from '../../lib/dbGateway/dailyQuestGateway.js?raw';
import dailyStatusCacheSource from '../../lib/dailyStatusCache.js?raw';
import dailyCalendarSource from '../../lib/dailyCalendar.js?raw';
import useDailyQuestsSource from '../../hooks/useDailyQuests.js?raw';
import useDailyWheelSource from '../../hooks/useDailyWheel.js?raw';
import dailyRewardsPanelSource from '../dailyWheel/DailyRewardsPanel.jsx?raw';
import dailyPageSource from '../../pages/DailyPage.jsx?raw';
import mainMenuSource from '../../pages/MainMenu.jsx?raw';
import appSource from '../../App.jsx?raw';
import bottomNavSource from '../layout/BottomNav.jsx?raw';
import gameSource from '../../pages/Game.jsx?raw';
import friendsApiSource from '../../lib/friendsApi.js?raw';
import {
  isCanonicalDailyDayComplete,
  selectCanonicalDailyTaskRows,
} from '@/lib/dailyCalendar';
import {
  RELEASE_PROOF_CHECKLIST_DOC as releaseProofSource,
  SECURITY_DEPLOYMENT_DOC as securitySource,
} from '@/lib/healthAlignmentDocMirrors';
import { DB_ARCHITECTURE_IMPLEMENTATION_MIRROR as dbArchitectureSource } from '@/lib/dbArchitectureMirrors';
import { SOLO_QUESTION_ENGINE_DOC as soloEngineSource } from '@/lib/soloQuestionEngineDoc';

const STATUS = { PASS: 'PASS', FAIL: 'FAIL', NOT_AUTOMATABLE: 'NOT_AUTOMATABLE' };
const ACTION_TYPES = { CODE_FIX: 'CODE_FIX', BACKEND_RUNTIME_PROBE: 'BACKEND_RUNTIME_PROBE', MANUAL_VERIFY: 'MANUAL_VERIFY' };
const SUITE_ID = 'daily_quest_runtime_health';
const SUITE_NAME = 'Daily Quest Runtime Health Suite';

function text(source) {
  if (source == null) return '';
  if (typeof source === 'string') return source;
  try { return String(source); } catch { return ''; }
}

function missingTokens(source, tokens) {
  const value = text(source);
  return tokens.filter((token) => !value.includes(token));
}

function forbiddenTokens(source, tokens) {
  const value = text(source);
  return tokens.filter((token) => value.includes(token));
}

function pass(reason, extra = {}) { return { status: STATUS.PASS, reason, ...extra }; }
function fail(reason, extra = {}) { return { status: STATUS.FAIL, reason, ...extra }; }
function notAutomatable(reason, extra = {}) { return { status: STATUS.NOT_AUTOMATABLE, reason, ...extra }; }

function makeCase(id, name, run, options = {}) {
  return {
    key: `${SUITE_ID}.${id}`,
    suiteId: SUITE_ID,
    suiteName: SUITE_NAME,
    id,
    name,
    critical: options.critical ?? true,
    actionType: options.actionType || ACTION_TYPES.CODE_FIX,
    nextStep: options.nextStep || 'Keep Daily Calendar/Streak server-backed, event-based, Diamond-only, and separate from Leaderboard/Puan.',
    ...options,
    run,
  };
}

const runtimeSources = [
  dailyCalendarSource,
  dailyQuestProgressEntitySource,
  getDailyQuestStatusSource,
  recordDailyQuestProgressSource,
  claimDailyQuestRewardSource,
  dailyQuestGatewaySource,
  dailyStatusCacheSource,
  useDailyQuestsSource,
  dailyPageSource,
  mainMenuSource,
  gameSource,
  useDailyWheelSource,
  friendsApiSource,
].join('\n');
const docsCombined = `${releaseProofSource}\n${dbArchitectureSource}\n${securitySource}\n${soloEngineSource}`;

export const EXTRA_SUITES = [
  { id: SUITE_ID, name: SUITE_NAME, critical: true, color: '#7dd3fc' },
];

export const EXTRA_TESTS = [
  makeCase('daily_calendar_helper_contract',
    'Daily Calendar helper defines provenance-safe tasks, canonical rows, and the 200-Diamond 7-day reward',
    () => {
      const missing = missingTokens(dailyCalendarSource, [
        "DAILY_CALENDAR_RUNTIME_VERSION = 'daily-calendar-streak-v1'",
        'DAILY_CALENDAR_TASKS_PER_DAY = 3',
        'DAILY_CALENDAR_TEMPLATE_CYCLE_LENGTH = 9',
        'DAILY_STREAK_REWARD_DAYS = 7',
        'DAILY_STREAK_REWARD_DIAMONDS = 200',
        'DAILY_TASK_TEMPLATE_CYCLE',
        "'wheel', 'level2', 'joker1'",
        "'wheel', 'hint', 'friendInvite'",
        'HINT_USED',
        'hint_used',
        'İpucu kullan',
        'profile_already_complete',
        'requires_registered_user',
        'DEFERRED_PROVENANCE_TASK_KEYS',
        'PROVENANCE_SAFE_FALLBACKS',
        'resolveDailyTaskTemplates',
        'selectCanonicalDailyTaskRows',
        'isCanonicalDailyDayComplete',
      ]);
      if (missing.length) {
        return fail('Daily Calendar helper contract is incomplete.', {
          verification: 'STATIC_CONTRACT',
          file: 'src/lib/dailyCalendar.js',
          missing,
        });
      }
      return pass('Daily Calendar helper owns deterministic task/streak constants, provenance-safe fallbacks, and canonical-row completion.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('home_shortcut_route_and_bottom_nav_contract',
    'Home GÜNLÜK shortcut opens /daily and BottomNav remains three tabs',
    () => {
      const missing = missingTokens(`${mainMenuSource}\n${appSource}\n${bottomNavSource}`, [
        'CalendarDays',
        'label="GÜNLÜK"',
        "navigate('/daily'",
        'const DailyPage',
        'path="/daily"',
        'element={<DailyPage />}',
        "{ label: 'Ana Sayfa'",
        "{ label: 'Liderlik'",
        "{ label: 'Profil'",
        'BottomNav has exactly three visible tabs',
      ]);
      const forbidden = forbiddenTokens(`${mainMenuSource}\n${bottomNavSource}`, [
        'label="Görevler"',
        "activeShortcut === 'quests'",
        "'quests'",
        'DailyQuestV1Card',
        "{ label: 'Günlük'",
        "{ label: 'GÜNLÜK'",
      ]);
      if (missing.length || forbidden.length) {
        return fail('Home shortcut route or BottomNav contract can regress.', {
          verification: 'STATIC_CONTRACT',
          files: ['src/pages/MainMenu.jsx', 'src/App.jsx', 'src/components/layout/BottomNav.jsx'],
          actual: { missing, forbidden },
        });
      }
      return pass('Home exposes a calendar GÜNLÜK shortcut to /daily while BottomNav remains Ana Sayfa/Liderlik/Profil only.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('daily_screen_calendar_and_task_ui',
    'Daily screen renders simplified calendar, title-only tasks, and 200-Elmas streak reward UI',
    () => {
      const missing = missingTokens(dailyPageSource, [
        'GÜNLÜK',
        'calendarDays',
        'CalendarCell',
        'isToday',
        'completed',
        'label="Tamamlandı"',
        'label="Bugün"',
        'BUGÜNKÜ GÖREVLER',
        'DAILY_CALENDAR_TASKS_PER_DAY',
        'data-kronox-daily-task-title="true"',
        'ZAMAN SERİSİ',
        'DAILY_STREAK_REWARD_DAYS',
        'DAILY_STREAK_REWARD_DIAMONDS',
        'data-kronox-daily-streak-reward-amount="true"',
        '{DAILY_STREAK_REWARD_DIAMONDS} Elmas',
        'daily.claim',
      ]);
      const forbidden = forbiddenTokens(dailyPageSource, [
        'Serini koru',
        'ödülünü kazan',
        'label="Gelecek Gün"',
        'Görevler ${resetTimer} sonra yenilenecek',
        'UTC gün sonunda yenilenir',
        'task.description',
        '<Gift',
        'Hediye Kutusu',
        'Hediye Kutusunu Aç',
      ]);
      if (missing.length || forbidden.length) {
        return fail('Daily screen UI is missing the simplified calendar/task/streak contract or still renders removed copy.', {
          verification: 'STATIC_CONTRACT',
          file: 'src/pages/DailyPage.jsx',
          actual: { missing, forbidden },
        });
      }
      return pass('DailyPage keeps the calendar and task/progress controls while removing subtitle, future legend, renewal timer, task descriptions, and Gift Box UI.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('daily_screen_mobile_width_fit_contract',
    'Daily screen fits narrow mobile widths without horizontal page panning',
    () => {
      const missing = missingTokens(dailyPageSource, [
        'data-kronox-daily-page-root="true"',
        'maxWidth: \'100vw\'',
        'overscrollBehaviorX: \'none\'',
        'overflow-x-hidden overflow-y-auto',
        'data-kronox-daily-scroll-frame="true"',
        'max-w-[min(30rem,100%)]',
        'data-kronox-daily-calendar-grid="true"',
        'gridTemplateColumns: \'repeat(7, minmax(0, 1fr))\'',
        'flex-wrap justify-center',
        'data-kronox-daily-streak-strip="true"',
        'min-w-0 flex-1',
        'w-full min-w-0 max-w-full overflow-hidden rounded-2xl p-3',
      ]);
      if (missing.length) {
        return fail('Daily screen can regress into horizontal overflow on narrow mobile widths.', {
          verification: 'STATIC_CONTRACT',
          file: 'src/pages/DailyPage.jsx',
          missing,
        });
      }
      return pass('DailyPage uses scoped width containment for the header, calendar grid, task rows, legend, and streak strip while preserving vertical scroll.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('server_status_creates_three_daily_calendar_rows',
    'getDailyQuestStatus creates/returns exactly 3 Daily Calendar task rows for the server day',
    () => {
      const missing = missingTokens(getDailyQuestStatusSource, [
        'utcDateKey',
        'ensureTodayTasks',
        'withAssignmentLock',
        'daily-calendar-assignment:',
        'canonicalRowsForTasks',
        'resolveTaskTemplates(dateKey, player).slice(0, DAILY_CALENDAR_TASKS_PER_DAY)',
        'daily_calendar:',
        'reward_diamonds: 0',
        'buildMonthGrid',
        'computeCurrentStreak',
        'streakRewardReady',
        'templateCycleLength: DAILY_CALENDAR_TEMPLATE_CYCLE_LENGTH',
        'hintTasksUse: TASK_TYPES.HINT_USED',
        'legacyCleanupDryRun',
        'definitionRowsIgnoredAtRuntime: true',
      ]);
      const forbidden = forbiddenTokens(getDailyQuestStatusSource, [
        'ensureDefaultDefinitions',
        'DailyQuestDefinition.create',
        'reward_diamonds: 20',
        'solo_level_completion_only',
      ]);
      if (missing.length || forbidden.length) {
        return fail('Daily status can still behave like the old one-row quest runtime.', {
          verification: 'STATIC_CONTRACT',
          file: 'base44/functions/getDailyQuestStatus/entry.ts',
          actual: { missing, forbidden },
        });
      }
      return pass('Status function is code-owned, creates 3 Daily Calendar rows, builds calendar/streak state, and ignores old definitions.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('duplicate_rows_cannot_complete_day_or_reward',
    'Duplicate Daily rows cannot substitute for three distinct canonical task slots',
    () => {
      const rows = [
        { id: 'a', quest_key: 'daily_calendar:d1:s1:wheel', progress_value: 1, target_value: 1, created_at: '2026-07-11T00:00:00.000Z' },
        { id: 'b', quest_key: 'daily_calendar:d1:s1:wheel', progress_value: 1, target_value: 1, created_at: '2026-07-11T00:00:01.000Z' },
        { id: 'c', quest_key: 'daily_calendar:d1:s2:level1', progress_value: 1, target_value: 1, created_at: '2026-07-11T00:00:00.000Z' },
      ];
      const duplicateOnlyComplete = isCanonicalDailyDayComplete(rows);
      const withThirdSlot = [...rows, { id: 'd', quest_key: 'daily_calendar:d1:s3:hint', progress_value: 1, target_value: 1, created_at: '2026-07-11T00:00:00.000Z' }];
      const canonicalRows = selectCanonicalDailyTaskRows(withThirdSlot);
      const backendMissing = missingTokens(`${getDailyQuestStatusSource}\n${claimDailyQuestRewardSource}`, [
        'canonicalRowsForTasks',
        'new Set(canonicalRows.map',
        'dailyCalendarSlot',
        'canonicalRows.every',
      ]);
      if (duplicateOnlyComplete || !isCanonicalDailyDayComplete(withThirdSlot) || canonicalRows.length !== 3 || backendMissing.length) {
        return fail('Duplicate Daily rows can still satisfy day/reward completion or backend canonical selection drifted.', {
          verification: 'EXECUTABLE',
          actual: { duplicateOnlyComplete, canonicalCount: canonicalRows.length, backendMissing },
        });
      }
      return pass('Executable fixture requires slots 1/2/3 exactly once; duplicate slot-1 rows cannot complete a day or reward.', { verification: 'EXECUTABLE' });
    }),

  makeCase('task_progress_is_real_event_based_and_idempotent',
    'Daily task progress is driven by verified app/game events and deduped per task/day/event',
    () => {
      const combined = `${recordDailyQuestProgressSource}\n${gameSource}\n${useDailyWheelSource}\n${friendsApiSource}`;
      const missing = missingTokens(combined, [
        'daily_wheel_claim',
        'solo_level_complete',
        'correct_answer',
        'consecutive_correct_4',
        'joker_used',
        'time_freeze_joker_used',
        'friend_invite_sent',
        'friend_added',
        'DailyWheelSpin',
        'JokerTransaction',
        'HintTransaction',
        'QuestionAttemptEvent',
        'eventSourceIsVerified',
        'daily_event_provenance_invalid',
        'Günlük ilerleme kaynağı doğrulanamadı.',
        'const amount = 1',
        'buildProgressEventKey',
        'progress_event_keys',
        'duplicate_event',
        'noDiamondGrantDuringProgress: true',
        "recordDailyQuestSoloEvent('solo_level_complete'",
        "recordDailyQuestSoloEvent('correct_answer'",
        "recordDailyQuestSoloEvent('consecutive_correct_4'",
        "eventType: 'daily_wheel_claim'",
        "eventType: 'friend_invite_sent'",
        "eventType: 'friend_added'",
      ]);
      const forbidden = forbiddenTokens(recordDailyQuestProgressSource, [
        'DiamondTransaction.create',
        'daily_calendar_streak_reward_transaction_missing',
        'clientMarkedComplete',
        'kronox_puan_total',
        'SoloLeaderboardEntry',
      ]);
      if (missing.length || forbidden.length) {
        return fail('Daily task progress can be client-only, duplicate, or reward-granting.', {
          verification: 'STATIC_CONTRACT',
          actual: { missing, forbidden },
        });
      }
      return pass('Progress updates require same-actor/day backend receipts, ignore client amount, dedupe events, and never grant Diamonds/Puan directly.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('daily_wheel_claim_completes_task_and_refreshes_status',
    'Successful Daily Wheel claim completes Çark çevir and refreshes Daily status',
    () => {
      const combined = `${claimDailyWheelRewardSource}\n${getDailyQuestStatusSource}\n${recordDailyQuestProgressSource}\n${useDailyWheelSource}\n${useDailyQuestsSource}\n${dailyStatusCacheSource}\n${docsCombined}`;
      const missing = missingTokens(combined, [
        'recordDailyWheelDailyTaskProgress',
        'dailyQuestProgressRecorded',
        'taskCompletionSource: \'daily_wheel_claim_backend\'',
        'reconcileDailyWheelTaskFromClaim',
        'findDailyWheelClaimForDate',
        'DailyWheelSpin',
        'TASK_TYPES.DAILY_WHEEL_CLAIM',
        'reconciledFromDailyWheelSpin: true',
        "eventType: 'daily_wheel_claim'",
        "reason: 'daily_wheel_claim_success'",
        'markDailyQuestStatusStale',
        'DAILY_QUEST_STATUS_CHANGED_EVENT',
        'dailyQuestStatusStore.invalidate',
        'subscribeDailyQuestStatusChanged',
        'refresh({ ignoreCache: true })',
        'refreshVersionRef',
        'same-player/same-day DailyWheelSpin',
        'opening or reopening the wheel does not create Daily progress',
      ]);
      const forbidden = forbiddenTokens(useDailyWheelSource, [
        'recordDailyQuestProgress({',
        "openClaimedResult = useCallback(async () => {\n    recordDailyQuestProgress",
        "setShowPrompt(false);\n    recordDailyQuestProgress",
      ]);
      if (missing.length || forbidden.length) {
        return fail('Daily Wheel can still claim a reward without completing or refreshing Çark çevir safely.', {
          verification: 'STATIC_CONTRACT',
          files: [
            'base44/functions/getDailyQuestStatus/entry.ts',
            'base44/functions/claimDailyWheelReward/entry.ts',
            'src/hooks/useDailyWheel.js',
            'src/hooks/useDailyQuests.js',
            'src/lib/dailyStatusCache.js',
          ],
          actual: { missing, forbidden },
        });
      }
      return pass('Successful wheel claims record the Daily Calendar wheel task backend-side, stale Daily status immediately, and status reconciles from DailyWheelSpin while opening or reopening the wheel does not create Daily progress.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('daily_task_event_source_matrix_and_training_exclusions',
    'All Daily task event sources are wired and training Joker/Hint use is excluded',
    () => {
      const combined = `${dailyCalendarSource}\n${getDailyQuestStatusSource}\n${recordDailyQuestProgressSource}\n${gameSource}\n${friendsApiSource}`;
      const missing = missingTokens(combined, [
        'daily_wheel_claim',
        'solo_level_complete',
        'correct_answer',
        'consecutive_correct_4',
        'joker_used',
        'time_freeze_joker_used',
        'hint_used',
        'jokerless_solo_level_complete',
        'profile_complete',
        'friend_invite_sent',
        'friend_added',
        "recordDailyQuestSoloEvent('solo_level_complete'",
        "recordDailyQuestSoloEvent('correct_answer'",
        "recordDailyQuestSoloEvent('consecutive_correct_4'",
        "eventType: 'joker_used'",
        "eventType: 'time_freeze_joker_used'",
        "eventType: 'hint_used'",
        "eventType: 'friend_invite_sent'",
        "eventType: 'friend_added'",
        'isSoloTrainingConsumables',
        'soloTrainingConsumableUsedRef.current = true',
        'hintUseSeparateFromJoker: true',
        'JokerTransaction',
        'HintTransaction',
        'hint_transaction_verified',
        'levelNumber > 6',
        'authoritative_jokerless_attempt_receipt_unavailable',
      ]);
      const forbidden = forbiddenTokens(combined, [
        "eventType: 'joker_used',\n        mode: 'solo_hint'",
        "eventType: 'hint_used',\n        mode: 'joker'",
        'clientMarkedComplete',
        'trainingJokerCompletesDaily',
        'trainingHintCompletesDaily',
      ]);
      if (missing.length || forbidden.length) {
        return fail('Daily task event coverage can regress or training Hint/Joker use can complete tasks.', {
          verification: 'STATIC_CONTRACT',
          actual: { missing, forbidden },
        });
      }
      return pass('Daily event verification covers wheel, persisted level, answer, real spend, profile, and friend receipts; training consumables and jokerless-without-receipt are rejected.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('guest_and_logged_in_paths_are_supported',
    'Completed guests and logged-in users can read/progress/claim the Daily Calendar safely',
    () => {
      const combined = `${userEntitySource}\n${guestProfileEntitySource}\n${useDailyQuestsSource}\n${getDailyQuestStatusSource}\n${recordDailyQuestProgressSource}\n${claimDailyQuestRewardSource}`;
      const missing = missingTokens(combined, [
        'getCompletedGuestCredentialsPayload',
        'resolveDailyCalendarPlayer',
        'guestPlayerKey',
        'isGuestProfileComplete',
        'GuestProfile',
        'guest_token_hash',
        'rawGuestTokenServerStored: false',
        'daily_calendar_current_streak',
        'daily_calendar_streak_anchor_date',
        'daily_calendar_streak_reward_claim_count',
        'playerType: player.isGuest ?',
      ]);
      const forbidden = forbiddenTokens(`${getDailyQuestStatusSource}\n${recordDailyQuestProgressSource}\n${claimDailyQuestRewardSource}`, [
        'raw_guest_id_public',
        'owner_key_public',
        'provider_id',
      ]);
      if (missing.length || forbidden.length) {
        return fail('Guest/logged-in Daily Calendar support or private ID safety is incomplete.', {
          verification: 'STATIC_CONTRACT',
          actual: { missing, forbidden },
        });
      }
      return pass('Daily Calendar accepts authenticated users or completed guest token proof and returns sanitized state.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('seven_day_reward_is_server_side_200_diamonds_idempotent',
    '7-day streak reward grants exactly 200 Diamonds server-side and idempotently',
    () => {
      const missing = missingTokens(`${claimDailyQuestRewardSource}\n${diamondTransactionEntitySource}\n${dailyQuestGatewaySource}`, [
        'DAILY_STREAK_REWARD_DIAMONDS = 200',
        'DAILY_CALENDAR_REWARD_SOURCE = \'daily_calendar_streak_reward\'',
        'buildRewardState',
        'currentStreak >= DAILY_STREAK_REWARD_DAYS',
        'findDiamondTransaction',
        'withEconomyLock',
        'dailyCalendarSlot',
        'canonicalRows.every',
        'new Set(canonicalRows.map',
        'balanceAfter = balanceBefore + DAILY_STREAK_REWARD_DIAMONDS',
        'source: DAILY_CALENDAR_REWARD_SOURCE',
        "direction: 'earn'",
        'daily_calendar_streak_reward_claim_count',
        'clientRewardIgnored: true',
        'noKronoxPuan: true',
        'noLeaderboardImpact: true',
        '"daily_calendar_streak_reward"',
      ]);
      const forbidden = forbiddenTokens(claimDailyQuestRewardSource, [
        'body?.reward',
        'body?.reward_diamonds',
        'body?.amount',
        'kronox_puan_total',
        'SoloLeaderboardEntry',
      ]);
      if (missing.length || forbidden.length) {
        return fail('7-day streak reward can be client-controlled, non-idempotent, or affect score/leaderboard.', {
          verification: 'STATIC_CONTRACT',
          file: 'base44/functions/claimDailyQuestReward/entry.ts',
          actual: { missing, forbidden },
        });
      }
      return pass('Streak reward claim requires 7 completed days, writes one daily_calendar_streak_reward DiamondTransaction for 200 Diamonds, and is idempotent.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('legacy_daily_quest_cleanup_path_is_scoped_and_admin_gated',
    'Legacy Daily Quest cleanup has admin-gated dry-run/delete scope and protects unrelated data',
    () => {
      const missing = missingTokens(`${cleanupLegacyDailyQuestsSource}\n${dailyQuestGatewaySource}`, [
        'cleanupLegacyDailyQuests',
        "mode: 'dry_run'",
        'DELETE_LEGACY_DAILY_QUESTS',
        'AdminUser',
        'DailyQuestDefinition',
        'UserDailyQuestProgress',
        'legacyRows',
        'protectedEntities',
        'DailyWheelSpin',
        'DiamondTransaction',
        'UserJokerInventory',
        'SoloLeaderboardEntry',
        'cleanupLegacyDailyQuestData',
      ]);
      const forbidden = forbiddenTokens(cleanupLegacyDailyQuestsSource, [
        'base44.entities.User.delete',
        'base44.entities.GuestProfile.delete',
        'base44.entities.DiamondTransaction.delete',
        'base44.entities.DailyWheelSpin.delete',
      ]);
      if (missing.length || forbidden.length) {
        return fail('Legacy cleanup can be destructive outside scoped Daily Quest data or lacks dry-run/admin guard.', {
          verification: 'STATIC_CONTRACT',
          files: ['base44/functions/cleanupLegacyDailyQuests/entry.ts', 'src/lib/dbGateway/dailyQuestGateway.js'],
          actual: { missing, forbidden },
        });
      }
      return pass('Legacy Daily Quest cleanup defaults to admin-gated dry-run and only targets legacy definitions/progress rows.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('old_daily_quest_ui_removed_from_runtime',
    'Old Daily Quest card/modal runtime UI is removed',
    () => {
      const missing = missingTokens(`${dailyRewardsPanelSource}\n${mainMenuSource}`, [
        'DailyWheelCard',
        'HomeShortcutModal',
        'activeShortcut === \'wheel\'',
      ]);
      const forbidden = forbiddenTokens(`${dailyRewardsPanelSource}\n${mainMenuSource}\n${dailyPageSource}`, [
        'DailyQuestV1Card',
        'Günlük Görevleri Yap, Elmasları Kazan!',
        'Solo’da Seviye Geç',
        'Bugün 1 Solo seviyesini tamamla.',
        'Görevler yükleniyor',
        'daily_quest_reward',
      ]);
      if (missing.length || forbidden.length) {
        return fail('Legacy Daily Quest UI/copy can still be reachable.', {
          verification: 'STATIC_CONTRACT',
          actual: { missing, forbidden },
        });
      }
      return pass('Legacy Daily Quest panel/card/copy is gone from runtime UI; Daily Wheel modal remains separate.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('docs_and_mirrors_describe_new_daily_calendar',
    'Docs/mirrors describe Daily Calendar/Streak instead of old Daily Quest Runtime v1',
    () => {
      const missing = missingTokens(docsCombined, [
        'Daily Calendar / Streak',
        'Home GÜNLÜK shortcut',
        '9-day rotating task template cycle',
        'exactly 3 deterministic',
        'Daily header shows only GÜNLÜK',
        'Calendar legend shows only Tamamlandı and Bugün',
        'task cards show title-only rows',
        '7-day streak reward',
        '200 Elmas',
        '200 Diamonds',
        'daily_calendar_streak_reward',
        'does not grant Kronox Puan',
        'does not affect Leaderboard',
        'cleanupLegacyDailyQuests',
      ]);
      const forbidden = forbiddenTokens(docsCombined, [
        'Daily Quest Runtime v1 is active',
        'Solo’da Seviye Geç / Bugün 1 Solo seviyesini tamamla.',
        'daily_quest_reward:<playerKey>:<YYYY-MM-DD>:<quest_key>',
      ]);
      if (missing.length || forbidden.length) {
        return fail('Docs/mirrors still describe the removed one-quest runtime.', {
          verification: 'STATIC_CONTRACT',
          actual: { missing, forbidden },
        });
      }
      return pass('Docs and mirrors now align to the Daily Calendar/Streak runtime and legacy cleanup path.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('runtime_manual_rls_and_cleanup_proof',
    'Daily Calendar deployed RLS/race/cleanup proof remains manual',
    () => notAutomatable(
      'Static Health verifies source contracts. Live proof still requires deployed Base44 checks: two-account ownership/RLS, duplicate streak reward claim race, completed guest claim, and cleanupLegacyDailyQuests dry-run/delete counts against production data.',
      {
        verification: 'NOT_AUTOMATABLE',
        classification: 'RUNTIME_BACKEND_PROBE_REQUIRED',
        expected: 'Users cannot read/claim other players Daily Calendar rows; duplicate 7-day claims create one 200-Diamond transaction; cleanup deletes only scoped legacy Daily Quest rows after explicit admin confirmation.',
        actionType: ACTION_TYPES.BACKEND_RUNTIME_PROBE,
      },
    ),
    { critical: false, actionType: ACTION_TYPES.BACKEND_RUNTIME_PROBE }),
];
