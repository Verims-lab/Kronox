import React from 'react';
import { Trophy, Swords } from 'lucide-react';
import { DUELLO_DISPLAY_NAME } from '@/lib/onlineModeDisplay';

export default function DuelResult({ duel }) {
  const { isWinner, myPlayer, opponent, scoreResult, navigate } = duel;
  const delta = isWinner ? '+15' : '-6';
  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-background px-5 text-white" data-kronox-duel-result>
      <section className="kx-a1-panel w-full max-w-sm rounded-3xl p-6 text-center">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-primary text-primary-foreground">
          {isWinner ? <Trophy className="h-8 w-8" /> : <Swords className="h-8 w-8" />}
        </div>
        <h1 className="mt-4 font-cinzel text-2xl font-black text-primary">{isWinner ? `${DUELLO_DISPLAY_NAME} kazandın.` : `${DUELLO_DISPLAY_NAME} kaybettin.`}</h1>
        <p className="mt-1 font-inter text-sm text-muted-foreground">10 kart hedefi</p>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <Stat label="Sen" value={`${myPlayer?.claimed_count || 0}/10`} />
          <Stat label="Rakip" value={`${opponent?.claimed_count || 0}/10`} />
        </div>
        <p className="mt-4 font-inter text-sm font-black text-primary">{delta} Kronox Puan</p>
        <p className="mt-1 min-h-5 font-inter text-xs text-muted-foreground">{scoreResult?.message || 'Sonuç sunucu tarafından doğrulandı.'}</p>
        <button type="button" onClick={() => navigate('/online')} className="mt-5 h-12 w-full rounded-2xl bg-primary font-inter font-black text-primary-foreground">Online Ekranına Dön</button>
      </section>
    </main>
  );
}

function Stat({ label, value }) {
  return <div className="rounded-2xl border border-border bg-muted p-3"><p className="font-inter text-xs text-muted-foreground">{label}</p><p className="kronox-number mt-1 text-xl font-black text-foreground">{value}</p></div>;
}
