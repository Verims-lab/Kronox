import React from 'react';
import { Gift } from 'lucide-react';
import DailyWheelCard from './DailyWheelCard';

export default function DailyRewardsPanel({
  user,
  guestProfile,
  onUserUpdated,
  onLogin,
  ariaLabel = 'Günlük Ödüller',
  onDailyWheelResultClose,
}) {
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
          guestProfile={guestProfile}
          onUserUpdated={onUserUpdated}
          onLogin={onLogin}
          compact
          onResultClose={onDailyWheelResultClose}
        />
      </div>
    </section>
  );
}
