import React from 'react';
import { Loader2 } from 'lucide-react';
import useSameQuestionDuel from '@/hooks/useSameQuestionDuel';
import DuelArena from '@/components/duel/DuelArena';
import DuelResult from '@/components/duel/DuelResult';
import { getOnlineModeDisplayName, SAME_QUESTION_DUEL_MODE } from '@/lib/onlineModeDisplay';

export default function SameQuestionDuelPage() {
  const duel = useSameQuestionDuel();
  if (duel.loading) return <State text="Duello hazırlanıyor..." loading />;
  if (duel.error && !duel.lobby) return <State text={duel.error} onRetry={duel.refresh} />;
  if (duel.lobby?.game_mode !== SAME_QUESTION_DUEL_MODE) return <State text={`Bu lobi ${getOnlineModeDisplayName(SAME_QUESTION_DUEL_MODE)} modunda değil.`} />;
  if (duel.lobby?.status === 'finished') return <DuelResult duel={duel} />;
  return <DuelArena duel={duel} />;
}

function State({ text, loading, onRetry }) {
  return <main className="flex min-h-[100dvh] items-center justify-center bg-background p-6 text-center text-foreground"><div>{loading && <Loader2 className="mx-auto mb-3 h-6 w-6 animate-spin text-primary" />}<p className="font-inter font-semibold">{text}</p>{onRetry && <button onClick={onRetry} className="mt-4 rounded-xl bg-primary px-4 py-2 font-inter font-bold text-primary-foreground">Tekrar Dene</button>}</div></main>;
}