import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Gem,
  Loader2,
  RefreshCw,
  Star,
  Trophy,
} from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { getLeaderboardDiamondValue } from '@/lib/leaderboard';
import { isGuestOnboardingComplete } from '@/lib/guestProfile';
import { createParentRouteState } from '@/lib/NavigationStackContext';
import { useDailyQuests } from '@/hooks/useDailyQuests';
import {
  DAILY_CALENDAR_TASKS_PER_DAY,
  DAILY_STREAK_REWARD_DIAMONDS,
  DAILY_STREAK_REWARD_DAYS,
} from '@/lib/dailyCalendar';

const WEEKDAY_LABELS = ['PZT', 'SAL', 'ÇAR', 'PER', 'CUM', 'CMT', 'PAZ'];
const MONTH_LABELS = [
  'OCAK',
  'ŞUBAT',
  'MART',
  'NİSAN',
  'MAYIS',
  'HAZİRAN',
  'TEMMUZ',
  'AĞUSTOS',
  'EYLÜL',
  'EKİM',
  'KASIM',
  'ARALIK',
];

function formatMonthTitle(month) {
  if (month?.label) return String(month.label).toUpperCase('tr-TR');
  const key = String(month?.monthKey || '').slice(0, 7);
  const [year, rawMonth] = key.split('-');
  const index = Number(rawMonth) - 1;
  if (!year || index < 0 || index > 11) return 'GÜNLÜK';
  return `${MONTH_LABELS[index]} ${year}`;
}

function taskIcon(task) {
  if (task.icon === 'wheel') return '◉';
  if (task.icon === 'shield' || task.icon === 'freeze') return '◆';
  if (task.icon === 'friends') return '♢';
  if (task.icon === 'profile') return '◎';
  return '★';
}

export default function DailyPage() {
  const navigate = useNavigate();
  const { user, guestProfile } = useAuth();
  const completedGuestProfile = !user && isGuestOnboardingComplete(guestProfile) ? guestProfile : null;
  const daily = useDailyQuests({ user, guestProfile: completedGuestProfile });
  const diamonds = getLeaderboardDiamondValue(user || completedGuestProfile);
  const monthTitle = formatMonthTitle(daily.month);
  const streakSteps = Array.from({ length: DAILY_STREAK_REWARD_DAYS }, (_, index) => index + 1);
  const streakProgress = Math.max(0, Math.min(DAILY_STREAK_REWARD_DAYS, Number(daily.streakRewardProgress) || 0));

  return (
    <main
      data-kronox-daily-page-root="true"
      className="min-h-[100dvh] w-full max-w-full overflow-x-hidden overflow-y-auto text-white"
      style={{
        boxSizing: 'border-box',
        maxWidth: '100vw',
        overscrollBehaviorX: 'none',
        paddingTop: 'calc(env(safe-area-inset-top) + 0.85rem)',
        paddingLeft: 'max(env(safe-area-inset-left), 0.75rem)',
        paddingRight: 'max(env(safe-area-inset-right), 0.75rem)',
        paddingBottom: 'calc(env(safe-area-inset-bottom) + 6rem)',
        background:
          'radial-gradient(ellipse at 50% 8%, rgba(42, 145, 245, 0.18), transparent 42%), linear-gradient(180deg, #061225 0%, #0A2346 52%, #061225 100%)',
      }}
    >
      <header
        data-kronox-daily-header="true"
        className="mx-auto flex w-full min-w-0 max-w-[min(30rem,100%)] items-center justify-between gap-2"
      >
        <button
          type="button"
          onClick={() => navigate('/', { replace: true })}
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-slate-100 active:scale-95"
          style={{ background: 'rgba(7,18,38,0.72)', boxShadow: 'inset 0 0 0 1px rgba(148,163,184,0.22)' }}
          aria-label="Ana sayfaya dön"
        >
          <ChevronLeft className="h-6 w-6" strokeWidth={2.4} />
        </button>
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-amber-200"
            style={{
              background: 'linear-gradient(180deg, rgba(250,204,21,0.12), rgba(15,23,42,0.72))',
              boxShadow: 'inset 0 0 0 1px rgba(250,204,21,0.44), 0 0 16px rgba(250,204,21,0.16)',
            }}
          >
            <CalendarDays className="h-5 w-5" strokeWidth={2.3} />
          </span>
          <div className="min-w-0">
            <h1
              className="truncate text-[1.45rem] font-black italic leading-none text-white"
              style={{ fontFamily: '"Barlow Condensed", "Inter", sans-serif', letterSpacing: '0.06em' }}
            >
              GÜNLÜK
            </h1>
          </div>
        </div>
        <button
          type="button"
          onClick={() => navigate('/market', { state: createParentRouteState('daily', '/daily') })}
          className="inline-flex h-11 max-w-[8.5rem] shrink-0 items-center gap-1.5 rounded-full px-2.5 text-sm font-black text-white active:scale-95"
          style={{ background: 'rgba(7,18,38,0.72)', boxShadow: 'inset 0 0 0 1px rgba(250,204,21,0.26)' }}
          aria-label="Elmas mağazası"
        >
          <Gem className="h-5 w-5 fill-yellow-300 text-yellow-300" />
          <span className="kronox-number min-w-0 truncate">{diamonds.toLocaleString('tr-TR')}</span>
        </button>
      </header>

      <section
        data-kronox-daily-scroll-frame="true"
        className="mx-auto mt-4 grid w-full min-w-0 max-w-[min(30rem,100%)] gap-3"
      >
        <Panel>
          <div className="mb-3 flex min-w-0 items-center justify-between gap-2">
            <button type="button" className="grid h-8 w-8 place-items-center rounded-full text-amber-300/70" aria-label="Önceki ay">
              <ChevronLeft className="h-5 w-5" />
            </button>
            <h2
              className="min-w-0 truncate text-center text-lg font-black text-white"
              style={{ fontFamily: '"Barlow Condensed", "Inter", sans-serif', letterSpacing: '0.04em' }}
            >
              {monthTitle}
            </h2>
            <button type="button" className="grid h-8 w-8 place-items-center rounded-full text-amber-300/70" aria-label="Sonraki ay">
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>

          <div
            data-kronox-daily-calendar-grid="true"
            className="grid w-full min-w-0 max-w-full overflow-hidden rounded-xl"
            style={{
              border: '1px solid rgba(125,211,252,0.22)',
              gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
            }}
          >
            {WEEKDAY_LABELS.map((label) => (
              <div key={label} className="min-w-0 truncate bg-slate-950/35 px-0.5 py-2 text-center font-inter text-[10px] font-black text-slate-400">
                {label}
              </div>
            ))}
            {daily.calendarDays.map((day) => (
              <CalendarCell key={day.dateKey} day={day} />
            ))}
            {daily.calendarDays.length === 0 && Array.from({ length: 35 }, (_, index) => (
              <div key={index} className="aspect-square bg-slate-950/20" />
            ))}
          </div>
          <div className="mt-3 flex min-w-0 flex-wrap justify-center gap-x-3 gap-y-2 font-inter text-[10px] font-semibold text-slate-300">
            <LegendDot tone="done" label="Tamamlandı" />
            <LegendDot tone="today" label="Bugün" />
          </div>
        </Panel>

        <Panel>
          <div className="mb-3 flex min-w-0 items-center">
            <h2
              className="min-w-0 text-base font-black italic text-white"
              style={{ fontFamily: '"Barlow Condensed", "Inter", sans-serif', letterSpacing: '0.04em' }}
            >
              BUGÜNKÜ GÖREVLER
            </h2>
          </div>

          {daily.status === 'loading' && (
            <div className="grid min-h-32 place-items-center text-slate-300">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          )}

          {daily.status === 'error' && (
            <button
              type="button"
              onClick={daily.refresh}
              className="flex w-full items-center justify-center gap-2 rounded-xl px-4 py-4 font-inter text-sm font-black text-amber-100"
              style={{ background: 'rgba(250,204,21,0.10)', boxShadow: 'inset 0 0 0 1px rgba(250,204,21,0.28)' }}
            >
              <RefreshCw className="h-4 w-4" />
              {daily.error || 'Günlük verileri yüklenemedi.'}
            </button>
          )}

          {daily.status === 'ready' && (
            <div className="grid min-w-0 gap-2">
              {daily.tasks.slice(0, DAILY_CALENDAR_TASKS_PER_DAY).map((task) => (
                <TaskRow key={task.id || task.questKey} task={task} />
              ))}
            </div>
          )}
        </Panel>

        <Panel>
          <div className="grid w-full min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_10rem] sm:items-center">
            <div className="min-w-0">
              <div className="mb-3 flex min-w-0 flex-wrap items-center gap-2">
                <span className="grid h-9 w-9 place-items-center rounded-full text-orange-200" style={{ background: 'rgba(251,146,60,0.16)' }}>
                  <Trophy className="h-5 w-5" />
                </span>
                <h2
                  className="text-base font-black italic text-white"
                  style={{ fontFamily: '"Barlow Condensed", "Inter", sans-serif', letterSpacing: '0.04em' }}
                >
                  ZAMAN SERİSİ
                </h2>
                <span className="rounded-full bg-slate-700/70 px-2 py-0.5 font-inter text-[10px] font-black text-slate-200">
                  {streakProgress}/{DAILY_STREAK_REWARD_DAYS}
                </span>
              </div>
              <div data-kronox-daily-streak-strip="true" className="flex w-full min-w-0 items-center gap-1 overflow-hidden">
                {streakSteps.map((step) => (
                  <React.Fragment key={step}>
                    <span
                      className="grid h-6 w-6 shrink-0 place-items-center rounded-full font-inter text-[10px] font-black sm:h-7 sm:w-7 sm:text-xs"
                      style={{
                        color: step <= streakProgress ? '#061225' : '#94a3b8',
                        background: step <= streakProgress ? '#facc15' : 'rgba(15,23,42,0.62)',
                        boxShadow: `inset 0 0 0 1px ${step <= streakProgress ? 'rgba(250,204,21,0.8)' : 'rgba(148,163,184,0.24)'}`,
                      }}
                    >
                      {step <= streakProgress ? <Check className="h-4 w-4" /> : step}
                    </span>
                    {step < DAILY_STREAK_REWARD_DAYS && (
                      <span className="h-px min-w-0 flex-1" style={{ background: step < streakProgress ? '#facc15' : 'rgba(148,163,184,0.28)' }} />
                    )}
                  </React.Fragment>
                ))}
              </div>
            </div>

            <div
              data-kronox-daily-streak-reward-card="true"
              className="w-full min-w-0 max-w-full rounded-xl p-3 text-center sm:max-w-[10rem]"
              style={{ background: 'rgba(3,7,18,0.34)', boxShadow: 'inset 0 0 0 1px rgba(250,204,21,0.22)' }}
            >
              <p
                data-kronox-daily-streak-reward-amount="true"
                className="kronox-number inline-flex min-h-20 items-center justify-center gap-1 text-sm font-black text-amber-200"
              >
                <Gem className="h-4 w-4 fill-yellow-300 text-yellow-300" />
                {DAILY_STREAK_REWARD_DIAMONDS} Elmas
              </p>
              <button
                type="button"
                onClick={daily.claim}
                disabled={!daily.streakRewardReady || Boolean(daily.claimingId)}
                className="mt-3 h-9 w-full rounded-xl font-inter text-xs font-black active:scale-95 disabled:active:scale-100"
                style={{
                  color: daily.streakRewardReady ? '#111827' : '#94a3b8',
                  background: daily.streakRewardReady
                    ? 'linear-gradient(180deg, #fde68a, #f59e0b)'
                    : 'rgba(148,163,184,0.12)',
                  boxShadow: daily.streakRewardReady
                    ? '0 0 16px rgba(250,204,21,0.28)'
                    : 'inset 0 0 0 1px rgba(148,163,184,0.16)',
                }}
              >
                {daily.claimingId ? 'Alınıyor...' : daily.streakRewardReady ? 'Ödülü Al' : 'Seriyi Tamamla'}
              </button>
            </div>
          </div>
        </Panel>
      </section>
    </main>
  );
}

function Panel({ children }) {
  return (
    <section
      className="w-full min-w-0 max-w-full overflow-hidden rounded-2xl p-3"
      style={{
        background: 'linear-gradient(180deg, rgba(15,35,73,0.78), rgba(6,18,37,0.82))',
        boxShadow: 'inset 0 0 0 1px rgba(96,165,250,0.32), 0 16px 34px rgba(0,0,0,0.20)',
      }}
    >
      {children}
    </section>
  );
}

function CalendarCell({ day }) {
  const isToday = day.isToday === true;
  const isCompleted = day.completed === true;
  const isCurrentMonth = day.inCurrentMonth !== false;
  return (
    <div
      className="relative grid aspect-square min-w-0 place-items-center bg-slate-950/18 font-inter text-sm font-bold"
      style={{
        color: isCurrentMonth ? '#e5edf9' : 'rgba(148,163,184,0.28)',
      }}
    >
      <span
        className="grid h-[clamp(1.75rem,8vw,2rem)] w-[clamp(1.75rem,8vw,2rem)] place-items-center rounded-full"
        style={{
          color: isToday ? '#fff7d1' : undefined,
          boxShadow: isToday ? '0 0 14px rgba(250,204,21,0.70), inset 0 0 0 2px #facc15' : undefined,
        }}
      >
        {day.dayNumber}
      </span>
      {isCompleted && (
        <span
          className="absolute bottom-1.5 grid h-4 w-4 place-items-center rounded-full"
          style={{ background: '#071225', boxShadow: 'inset 0 0 0 1px #facc15' }}
          aria-label="Tamamlandı"
        >
          <Check className="h-3 w-3 text-amber-300" />
        </span>
      )}
    </div>
  );
}

function LegendDot({ tone, label }) {
  const style = tone === 'done'
    ? { boxShadow: 'inset 0 0 0 1px #facc15', background: '#071225' }
    : tone === 'today'
      ? { boxShadow: '0 0 10px rgba(250,204,21,0.55), inset 0 0 0 2px #facc15' }
      : { boxShadow: 'inset 0 0 0 1px rgba(125,211,252,0.22)', background: 'rgba(14,165,233,0.10)' };
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5 whitespace-nowrap">
      <span className="grid h-4 w-4 shrink-0 place-items-center rounded-full" style={style}>
        {tone === 'done' && <Check className="h-3 w-3 text-amber-300" />}
      </span>
      {label}
    </span>
  );
}

function TaskRow({ task }) {
  const completed = task.completed === true || task.status === 'completed';
  return (
    <div
      className="flex w-full min-w-0 max-w-full items-center gap-2 overflow-hidden rounded-xl px-2.5 py-2 sm:gap-3 sm:px-3"
      style={{
        background: 'rgba(3,7,18,0.24)',
        boxShadow: 'inset 0 0 0 1px rgba(125,211,252,0.15)',
      }}
    >
      <span
        className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-lg font-black"
        style={{
          color: completed ? '#061225' : '#e0f2fe',
          background: completed ? 'linear-gradient(180deg, #fde68a, #f59e0b)' : 'rgba(14,165,233,0.16)',
          boxShadow: completed ? '0 0 14px rgba(250,204,21,0.18)' : 'inset 0 0 0 1px rgba(125,211,252,0.20)',
        }}
      >
        {taskIcon(task)}
      </span>
      <div className="min-w-0 flex-1">
        <p data-kronox-daily-task-title="true" className="truncate font-inter text-sm font-black text-white">{task.title}</p>
      </div>
      <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
        {task.targetValue > 1 && !completed && (
          <span className="kronox-number whitespace-nowrap font-inter text-xs font-black text-amber-200">
            {task.progressValue}/{task.targetValue}
          </span>
        )}
        <span
          className="grid h-9 w-9 place-items-center rounded-full"
          style={{
            color: completed ? '#061225' : '#facc15',
            background: completed ? '#facc15' : 'transparent',
            boxShadow: 'inset 0 0 0 2px #facc15',
          }}
        >
          {completed ? <Check className="h-5 w-5" strokeWidth={2.8} /> : <Star className="h-4 w-4" />}
        </span>
      </div>
    </div>
  );
}
