import React from 'react';
import { Gem, X } from 'lucide-react';

export default function DailyRewardClaimModal({ result, onClose }) {
  if (!result) return null;
  const amount = Math.max(0, Math.floor(Number(result.rewardDiamonds) || 0));
  return (
    <div className="fixed inset-0 z-[220] grid place-items-center bg-black/60 px-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Günlük ödül alındı">
      <div className="kx-a1-modal relative w-full max-w-sm rounded-3xl border border-amber-300/40 bg-card p-6 text-center shadow-2xl">
        <button type="button" onClick={onClose} className="absolute right-2 top-2 grid h-11 w-11 place-items-center rounded-full bg-muted text-foreground" aria-label="Kapat">
          <X className="h-5 w-5" />
        </button>
        <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-primary/15 text-primary">
          <Gem className="h-8 w-8 fill-current" />
        </span>
        <h2 className="mt-4 font-bangers text-2xl font-black text-foreground">Ödül Alındı!</h2>
        <p className="kronox-number mt-2 text-xl font-black text-primary">+{amount.toLocaleString('tr-TR')} Elmas</p>
        <p className="mt-2 text-sm font-semibold text-muted-foreground">Elmas bakiyen güncellendi.</p>
        <button type="button" onClick={onClose} className="mt-5 min-h-11 w-full rounded-xl bg-primary px-4 font-bold text-primary-foreground active:scale-[0.98]">
          Tamam
        </button>
      </div>
    </div>
  );
}