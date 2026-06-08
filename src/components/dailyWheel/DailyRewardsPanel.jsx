import React from 'react';
import { Gift, ScrollText, Sparkles } from 'lucide-react';
import DailyWheelCard from './DailyWheelCard';

export default function DailyRewardsPanel({ user, onUserUpdated, onLogin }) {
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
      aria-label="Günlük Ödüller"
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
        <DailyQuestV1Card />
      </div>
    </section>
  );
}

function DailyQuestV1Card() {
  return (
    <div
      className="flex min-h-[52px] items-center gap-3 rounded-2xl px-3 py-2"
      style={{
        border: '1px solid rgba(125,211,252,0.26)',
        background:
          'linear-gradient(135deg, rgba(14,165,233,0.11), rgba(15,23,42,0.60))',
      }}
      aria-label="Günlük Görev v1"
    >
      <span
        className="grid h-9 w-9 shrink-0 place-items-center rounded-full"
        style={{
          color: '#bae6fd',
          background: 'linear-gradient(180deg, rgba(14,165,233,0.24), rgba(8,47,73,0.84))',
          boxShadow: 'inset 0 0 0 1px rgba(125,211,252,0.28)',
        }}
      >
        <ScrollText className="h-4.5 w-4.5" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-xs font-black text-sky-100">Günlük Görev</p>
          <Sparkles className="h-3.5 w-3.5 shrink-0 text-amber-200" />
        </div>
        <p className="truncate text-[10px] font-bold text-slate-300">Görev alanı hazırlanıyor.</p>
      </div>
      <span
        className="shrink-0 rounded-full px-2 py-1 text-[10px] font-black text-sky-100"
        style={{ background: 'rgba(14,165,233,0.16)' }}
      >
        v1
      </span>
    </div>
  );
}
