import React from 'react';
import { CheckCircle2, Gem, Gift, Loader2, ScrollText, Sparkles } from 'lucide-react';
import DailyWheelCard from './DailyWheelCard';
import { useDailyQuests } from '@/hooks/useDailyQuests';
import { sounds } from '@/lib/gameSounds';

export default function DailyRewardsPanel({ user, onUserUpdated, onLogin, ariaLabel = 'Günlük Ödüller' }) {
  return (
    <section
      className="w-full overflow-hidden rounded-[20px] px-3 py-3 font-inter"
      style={{
        border: '1px solid rgba(250,204,21,0.34)',
        background:
          'linear-gradient(180deg, rgba(9,24,58,0.76), rgba(3,9,26,0.82))',
        boxShadow:
          '0 14px 34px rgba(0,0,0,0.28), inset 0 0 0 1px rgba(255,255,255,0.05)',
      }}
      aria-label={ariaLabel}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className="grid h-7 w-7 shrink-0 place-items-center rounded-full"
            style={{
              color: '#fff7d1',
              background: 'linear-gradient(180deg, #facc15, #b97805)',
              boxShadow: '0 0 14px rgba(250,204,21,0.28)',
            }}
          >
            <Gift className="h-4 w-4" />
          </span>
          <h2 className="truncate text-sm font-black text-white">Günlük Ödüller</h2>
        </div>
        <span className="rounded-full px-2 py-1 text-[10px] font-black text-amber-100"
          style={{ background: 'rgba(250,204,21,0.10)', boxShadow: 'inset 0 0 0 1px rgba(250,204,21,0.22)' }}>
          Bugün
        </span>
      </div>

      <div className="grid gap-2">
        <DailyWheelCard
          user={user}
          onUserUpdated={onUserUpdated}
          onLogin={onLogin}
          compact
        />
        <DailyQuestV1Card user={user} onUserUpdated={onUserUpdated} onLogin={onLogin} />
      </div>
    </section>
  );
}

function DailyQuestV1Card({ user, onUserUpdated, onLogin }) {
  const dailyQuests = useDailyQuests({ user, onUserUpdated });
  const canSeeAdminQuestHint = Boolean(
    user?.is_admin === true ||
    user?.role === 'admin' ||
    user?.role === 'owner' ||
    user?.admin_status_debug?.parsedIsAdmin === true
  );
  const emptyCopy = dailyQuests.emptyStateReason === 'progress_rows_missing_after_ensure'
    ? 'Görevler yenilenemedi. Tekrar dene.'
    : 'Bugünkü görevler yakında hazır olacak.';

  const handleLogin = () => {
    sounds.tap();
    onLogin?.();
  };

  return (
    <div
      className="rounded-2xl px-3 py-2"
      style={{
        border: '1px solid rgba(125,211,252,0.26)',
        background:
          'linear-gradient(135deg, rgba(14,165,233,0.11), rgba(15,23,42,0.60))',
      }}
      aria-label="Bugünkü Görevler"
    >
      <div className="mb-2 flex items-center gap-2">
        <span
          className="grid h-8 w-8 shrink-0 place-items-center rounded-full"
          style={{
            color: '#bae6fd',
            background: 'linear-gradient(180deg, rgba(14,165,233,0.24), rgba(8,47,73,0.84))',
            boxShadow: 'inset 0 0 0 1px rgba(125,211,252,0.28)',
          }}
        >
          <ScrollText className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-xs font-black text-sky-100">Bugünkü Görevler</p>
            <Sparkles className="h-3.5 w-3.5 shrink-0 text-amber-200" />
          </div>
          <p className="truncate text-[10px] font-bold text-slate-300">Ödüller Elmas verir; Kronox Puan yok.</p>
        </div>
      </div>

      {!dailyQuests.isSignedIn && (
        <button
          type="button"
          onClick={handleLogin}
          className="w-full rounded-xl px-3 py-2 text-left text-[11px] font-black text-sky-100"
          style={{ background: 'rgba(14,165,233,0.14)', boxShadow: 'inset 0 0 0 1px rgba(125,211,252,0.18)' }}
        >
          Görevleri görmek için giriş yap.
        </button>
      )}

      {dailyQuests.isSignedIn && dailyQuests.status === 'loading' && (
        <div className="flex items-center gap-2 rounded-xl px-3 py-2 text-[11px] font-bold text-slate-300">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-sky-200" />
          Görevler yükleniyor...
        </div>
      )}

      {dailyQuests.isSignedIn && dailyQuests.status === 'error' && (
        <button
          type="button"
          onClick={dailyQuests.refresh}
          className="w-full rounded-xl px-3 py-2 text-left text-[11px] font-black text-rose-100"
          style={{ background: 'rgba(248,113,113,0.12)', boxShadow: 'inset 0 0 0 1px rgba(248,113,113,0.22)' }}
        >
          {dailyQuests.error || 'Günlük görevler yüklenemedi.'}
        </button>
      )}

      {dailyQuests.isSignedIn && dailyQuests.status === 'empty' && (
        <div className="rounded-xl px-3 py-2 text-[11px] font-bold text-slate-300"
          style={{ background: 'rgba(15,23,42,0.45)' }}>
          <p>{emptyCopy}</p>
          {canSeeAdminQuestHint && dailyQuests.adminWarning === 'insufficient_active_definitions' && (
            <p className="mt-1 text-[10px] font-semibold text-amber-100">
              Aktif günlük görev tanımı yok. Ayarlar &gt; Günlük Görev Yönetimi bölümünden aktif görev ekleyin.
            </p>
          )}
        </div>
      )}

      {dailyQuests.isSignedIn && dailyQuests.quests.length > 0 && (
        <div className="grid gap-2">
          {dailyQuests.quests.map((quest) => (
            <DailyQuestRow
              key={quest.id || quest.questKey}
              quest={quest}
              claiming={dailyQuests.claimingId === quest.id}
              onClaim={() => dailyQuests.claim(quest)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function DailyQuestRow({ quest, claiming, onClaim }) {
  const claimed = quest.status === 'claimed';
  const completed = quest.status === 'completed' || quest.progressValue >= quest.targetValue;
  const percent = Math.max(0, Math.min(100, Math.round((quest.progressValue / Math.max(1, quest.targetValue)) * 100)));
  const ctaLabel = claimed ? 'Alındı' : completed ? 'Al' : 'Devam Et';
  return (
    <div
      className="rounded-xl px-3 py-2"
      style={{
        background: 'rgba(3,7,18,0.34)',
        boxShadow: 'inset 0 0 0 1px rgba(148,163,184,0.14)',
      }}
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[11px] font-black text-white">{quest.title}</p>
          <p className="truncate text-[10px] font-semibold text-slate-300">{quest.description}</p>
        </div>
        <span className="kronox-number inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-[10px] font-black text-amber-100"
          style={{ background: 'rgba(250,204,21,0.12)', boxShadow: 'inset 0 0 0 1px rgba(250,204,21,0.20)' }}>
          <Gem className="h-3 w-3" />
          {quest.rewardDiamonds}
        </span>
      </div>

      <div className="mt-2 flex items-center gap-2">
        <div className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-slate-950/70">
          <div
            className="h-full rounded-full"
            style={{
              width: `${percent}%`,
              background: claimed
                ? 'linear-gradient(90deg, #64748b, #94a3b8)'
                : 'linear-gradient(90deg, #38bdf8, #facc15)',
              transition: 'width 220ms ease',
            }}
          />
        </div>
        <span className="kronox-number w-12 shrink-0 text-right text-[10px] font-black text-sky-100">
          {quest.progressValue}/{quest.targetValue}
        </span>
        <button
          type="button"
          onClick={completed && !claimed ? onClaim : undefined}
          disabled={!completed || claimed || claiming}
          className="inline-flex h-7 min-w-[4.25rem] shrink-0 items-center justify-center gap-1 rounded-full px-2 text-[10px] font-black"
          style={{
            color: claimed ? '#cbd5e1' : completed ? '#111827' : '#bae6fd',
            background: claimed
              ? 'rgba(148,163,184,0.12)'
              : completed
                ? 'linear-gradient(180deg, #fde68a, #f59e0b)'
                : 'rgba(14,165,233,0.14)',
            boxShadow: completed && !claimed ? '0 0 12px rgba(250,204,21,0.18)' : 'inset 0 0 0 1px rgba(125,211,252,0.16)',
          }}
        >
          {claiming ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : claimed ? <CheckCircle2 className="h-3.5 w-3.5" /> : null}
          {ctaLabel}
        </button>
      </div>
    </div>
  );
}
